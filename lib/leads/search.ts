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
/** Espaça as chamadas à mesma fonte. Reserva o horário antes de esperar: chamadas em paralelo não saem juntas. */
async function throttle(p: DataProvider) {
  const now = Date.now();
  const slot = Math.max(now, (lastCallAt.get(p.id) ?? 0) + p.minIntervalMs);
  lastCallAt.set(p.id, slot);
  if (slot > now) await sleep(slot - now);
}

/** Busca na fonte com cache no banco: a mesma consulta não é paga duas vezes. */
export async function fetchWithCache(p: DataProvider, q: ProviderQuery): Promise<ProviderBusiness[]> {
  if (p.cacheTtlMs === 0) return p.search(q);
  // hint não entra na chave: é só a ordem dos servidores, o resultado é o mesmo
  const key = hashKey("provider", p.id, q.category, q.city.toLowerCase(), q.uf, q.limit, q.offset ?? 0);
  const hit = await db.providerCache.findUnique({ where: { key } });
  if (hit && hit.expiresAt > new Date()) {
    logger.debug("provider cache hit", { provider: p.id, key });
    return hit.payload as unknown as ProviderBusiness[];
  }
  let lastError: unknown;
  const attempts = p.maxAttempts ?? 3;
  for (let attempt = 0; attempt < attempts; attempt++) {
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
      if (!(err instanceof ProviderError && err.retryable) || attempt === attempts - 1) break;
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
/**
 * Tempo máximo de uma rodada do job. A função na Vercel morre em 300 s (maxDuration da página
 * de busca): paramos antes, gravamos o que achou e a busca termina com o que tem — nunca fica
 * presa em "Buscando…".
 */
const JOB_BUDGET_MS = 230_000;

export async function runSearchJob(searchId: string) {
  const startedAt = Date.now();
  const search = await db.search.findUnique({ where: { id: searchId } });
  if (!search || search.status === "DONE") return;
  const req = { cities: [], ...(search.params as object) } as unknown as SearchRequest & { provider: DataProvider["id"] };
  const provider = getProvider(req.provider);
  const regional = req.cities.length === 0;
  const tasks = planTasks(req, provider, search.id);
  const { spread } = regionBudget(provider);
  const concurrency = Math.max(1, provider.concurrency ?? 2);

  // Retomada: a instância anterior pode ter morrido no meio — segue de onde parou, com o que já achou
  const resumeAt = Math.min(search.progress, tasks.length);
  const previous = search.leadIds.length
    ? await db.lead.findMany({ where: { id: { in: search.leadIds }, userId: search.userId }, select: { id: true, score: true } })
    : [];
  await db.search.update({ where: { id: searchId }, data: { status: "RUNNING", total: tasks.length, progress: resumeAt } });
  if (resumeAt === 0) await backfillDedupeKeys(search.userId);
  const collected: { id: string; score: number }[] = [...previous];
  const errors: string[] = [];
  const seen = new Set<string>();
  let skipped = 0;
  let done = resumeAt;
  let stoppedEarly = false;
  let failures = 0;

  const top = () => [...new Map(collected.map((c) => [c.id, c])).values()].sort((a, b) => b.score - a.score).slice(0, req.limit);

  const runTask = async (t: Task, index: number, quota: number) => {
    try {
      const known = await db.lead.count({ where: { userId: search.userId, provider: provider.id, category: t.category, city: t.city.name, state: t.city.uf } });
      const fresh: ProviderBusiness[] = [];
      // Demonstração: páginas seguintes da mesma cidade; reais: um lote que cobre o que já foi visto
      for (let attempt = 0, offset = known; attempt < (provider.isDemo ? 6 : 1) && fresh.length < quota; attempt++) {
        const pool = provider.isDemo ? quota * 2 : provider.id === "osm" ? provider.capabilities.maxResults : Math.min(provider.capabilities.maxResults, known + quota + 10);
        const raw = await fetchWithCache(provider, { category: t.category, city: t.city.name, uf: t.city.uf, limit: pool, hint: index, ...(provider.isDemo ? { offset } : {}) });
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
      failures++;
      const msg = err instanceof ProviderError ? err.message : "Falha ao consultar a fonte de dados.";
      if (!regional) errors.push(`${getCategory(t.category).plural} em ${t.city.name}: ${msg}`);
      else if (errors.length === 0) errors.push(msg);
      logger.warn("tarefa de busca falhou", { searchId, task: t, err: String(err) });
    }
  };

  // Várias cidades ao mesmo tempo (cada uma num servidor diferente da fonte); grava a cada rodada
  for (let i = resumeAt; i < tasks.length; i += concurrency) {
    const missing = req.limit - top().length;
    if (missing <= 0) break;
    if (Date.now() - startedAt > JOB_BUDGET_MS) {
      stoppedEarly = true;
      break;
    }
    const batch = tasks.slice(i, i + concurrency);
    const remainingTasks = tasks.length - i;
    const quotaFor = () =>
      regional
        ? Math.min(missing, Math.max(2, Math.ceil(req.limit / (spread * req.categories.length))))
        : Math.max(1, Math.ceil(missing / remainingTasks));
    const failuresBefore = failures;
    await Promise.all(batch.map((t, k) => runTask(t, i + k, quotaFor())));
    done = i + batch.length;
    // Primeira rodada inteira falhou e nada foi achado: a fonte está fora — avisa agora em vez de insistir por minutos
    if (i === resumeAt && failures - failuresBefore === batch.length && top().length === 0) {
      await db.search.update({ where: { id: searchId }, data: { progress: done } });
      stoppedEarly = true;
      break;
    }
    const best = top();
    await db.search.update({ where: { id: searchId }, data: { progress: done, leadIds: best.map((u) => u.id), resultCount: best.length } });
  }

  // Ordena por potencial (código, não IA) e corta no limite pedido.
  const unique = top();
  const failedAll = unique.length === 0 && errors.length > 0;
  const notes = [...errors.slice(0, 3)];
  if (stoppedEarly && unique.length === 0 && errors.length) {
    // a fonte caiu logo de cara: a mensagem do erro já explica (ex.: servidores lentos)
  } else if (stoppedEarly) {
    notes.unshift(`A fonte estava lenta: consultamos ${done} de ${tasks.length} cidades${unique.length ? " e mostramos o que achamos" : ""}. Busque de novo para continuar pelas outras.`);
  }
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
