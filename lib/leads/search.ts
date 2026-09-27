import "server-only";
import { db } from "@/lib/db";
import { getCategory } from "@/lib/domain/categories";
import type { SearchRequest } from "@/lib/domain/search";
import { hashKey } from "@/lib/hash";
import type { Prisma } from "@/lib/generated/prisma/client";
import { regionCities, regionLabel } from "@/lib/domain/regions";
import { backfillDedupeKeys, excludeKnown, filterSuppressed, upsertLeads } from "@/lib/leads/ingest";
import { logger } from "@/lib/logger";
import { getProvider } from "@/lib/providers";
import { ProviderError, type DataProvider, type ProviderBusiness, type ProviderQuery } from "@/lib/providers/types";

const lastCallAt = new Map<string, number>();
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** Respeita o intervalo mínimo entre chamadas de cada fonte (nada de rajadas). */
async function throttle(p: DataProvider) {
  const wait = (lastCallAt.get(p.id) ?? 0) + p.minIntervalMs - Date.now();
  if (wait > 0) await sleep(wait);
  lastCallAt.set(p.id, Date.now());
}

/** Busca na fonte com cache no banco: a mesma consulta não é paga duas vezes. */
export async function fetchWithCache(p: DataProvider, q: ProviderQuery): Promise<ProviderBusiness[]> {
  if (p.cacheTtlMs === 0) return p.search(q);
  const key = hashKey("provider", p.id, q.category, q.city.toLowerCase(), q.uf, q.limit, q.offset ?? 0);
  const hit = await db.providerCache.findUnique({ where: { key } });
  if (hit && hit.expiresAt > new Date()) {
    logger.debug("provider cache hit", { provider: p.id, key });
    return hit.payload as unknown as ProviderBusiness[];
  }
  let lastError: unknown;
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      await throttle(p);
      const items = await p.search(q);
      await db.providerCache.upsert({
        where: { key },
        create: { key, provider: p.id, payload: items as unknown as Prisma.InputJsonValue, expiresAt: new Date(Date.now() + p.cacheTtlMs) },
        update: { payload: items as unknown as Prisma.InputJsonValue, expiresAt: new Date(Date.now() + p.cacheTtlMs) },
      });
      return items;
    } catch (err) {
      lastError = err;
      if (!(err instanceof ProviderError && err.retryable)) break;
      await sleep(1500 * 2 ** attempt); // backoff exponencial
    }
  }
  throw lastError;
}

export function describeSearch(req: SearchRequest) {
  const cats = req.categories.map((c) => getCategory(c).plural).join(", ");
  const where = req.cities.length ? req.cities.map((c) => `${c.name} - ${c.uf}`).join(", ") : regionLabel(req.uf);
  return `${cats} · ${where}`;
}

/** Quantas cidades uma busca geral percorre, por fonte (demonstração é grátis; real custa tempo/cota). */
function regionBudget(provider: DataProvider) {
  if (provider.isDemo) return { maxCities: 40, spread: 10 };
  if (provider.id === "google") return { maxCities: 8, spread: 5 };
  return { maxCities: 12, spread: 6 };
}

type Task = { category: string; city: { name: string; uf: string } };

function planTasks(req: SearchRequest, provider: DataProvider, seed: string): Task[] {
  const cities = req.cities.length ? req.cities : regionCities(req.uf, seed, regionBudget(provider).maxCities);
  // Cidade por cidade (todas as categorias de uma cidade antes de ir para a próxima)
  return cities.flatMap((city) => req.categories.map((category) => ({ category, city })));
}

/** Cria o registro da busca. Buscas simples rodam na hora; lotes vão para a fila. */
export async function createSearch(userId: string, req: SearchRequest) {
  const provider = getProvider(req.provider);
  const total = req.cities.length ? req.categories.length * req.cities.length : req.categories.length * regionBudget(provider).maxCities;
  return db.search.create({
    data: {
      userId,
      query: req.query?.trim() || describeSearch(req),
      params: { ...req, provider: provider.id } as unknown as Prisma.InputJsonValue,
      provider: provider.id,
      status: "QUEUED",
      total,
    },
  });
}

/**
 * Processa uma busca. Só entram empresas NOVAS para o usuário: o que ele já tem (de
 * qualquer busca anterior ou fonte) é pulado e a fonte é consultada além disso
 * (paginação na demonstração, lote maior nas fontes reais) para completar a quantidade.
 */
export async function runSearchJob(searchId: string) {
  const search = await db.search.findUnique({ where: { id: searchId } });
  if (!search || search.status === "DONE") return;
  const req = { cities: [], ...(search.params as object) } as unknown as SearchRequest & { provider: DataProvider["id"] };
  const provider = getProvider(req.provider);
  const regional = req.cities.length === 0;
  const tasks = planTasks(req, provider, search.id);
  const { spread } = regionBudget(provider);

  await db.search.update({ where: { id: searchId }, data: { status: "RUNNING", total: tasks.length, progress: 0 } });
  await backfillDedupeKeys(search.userId);
  const collected: { id: string; score: number }[] = [];
  const errors: string[] = [];
  const seen = new Set<string>();
  let skipped = 0;

  for (const [i, t] of tasks.entries()) {
    const missing = req.limit - collected.length;
    if (missing <= 0) break;
    // Busca geral espalha pelas cidades; cidades escolhidas dividem a quantidade (a sobra passa adiante)
    const quota = regional
      ? Math.min(missing, Math.max(2, Math.ceil(req.limit / (spread * req.categories.length))))
      : Math.ceil(missing / (tasks.length - i));
    try {
      const known = await db.lead.count({ where: { userId: search.userId, provider: provider.id, category: t.category, city: t.city.name, state: t.city.uf } });
      const fresh: ProviderBusiness[] = [];
      // Demonstração: páginas seguintes da mesma cidade; reais: um lote que cobre o que já foi visto
      for (let attempt = 0, offset = known; attempt < (provider.isDemo ? 6 : 1) && fresh.length < quota; attempt++) {
        const pool = provider.isDemo ? quota * 2 : provider.id === "osm" ? provider.capabilities.maxResults : Math.min(provider.capabilities.maxResults, known + quota + 10);
        const raw = await fetchWithCache(provider, { category: t.category, city: t.city.name, uf: t.city.uf, limit: pool, ...(provider.isDemo ? { offset } : {}) });
        offset += pool;
        const allowed = await filterSuppressed(raw);
        const r = await excludeKnown(search.userId, allowed, { usePhone: !provider.isDemo, uniqueNames: provider.isDemo, seen });
        skipped += r.known;
        fresh.push(...r.fresh.slice(0, quota - fresh.length));
        if (raw.length < pool) break; // a fonte não tem mais nada nessa cidade
      }
      const rows = await upsertLeads({ userId: search.userId, provider: provider.id, isDemo: provider.isDemo, category: t.category, items: fresh });
      collected.push(...rows);
    } catch (err) {
      const msg = err instanceof ProviderError ? err.message : "Falha ao consultar a fonte de dados.";
      if (!regional) errors.push(`${getCategory(t.category).plural} em ${t.city.name}: ${msg}`);
      else if (errors.length === 0) errors.push(msg);
      logger.warn("tarefa de busca falhou", { searchId, task: t, err });
    }
    await db.search.update({ where: { id: searchId }, data: { progress: i + 1 } });
  }

  // Ordena por potencial (código, não IA) e corta no limite pedido.
  const unique = [...new Map(collected.map((c) => [c.id, c])).values()].sort((a, b) => b.score - a.score).slice(0, req.limit);
  const failedAll = unique.length === 0 && errors.length > 0;
  const notes = [...errors.slice(0, 3)];
  if (unique.length < req.limit && skipped > 0) {
    notes.push(
      `${unique.length ? `Achamos ${unique.length} empresas novas` : "Nenhuma empresa nova"}: outras ${skipped} desta busca você já tinha em Meus leads${regional ? "" : ". Tente outra cidade ou a busca geral pelo estado"}.`,
    );
  }
  await db.search.update({
    where: { id: searchId },
    data: {
      status: failedAll ? "FAILED" : "DONE",
      progress: tasks.length,
      leadIds: unique.map((u) => u.id),
      resultCount: unique.length,
      error: notes.length ? notes.join(" · ") : null,
      finishedAt: new Date(),
    },
  });
}
