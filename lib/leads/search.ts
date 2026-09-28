import "server-only";
import { db } from "@/lib/db";
import { getCategory } from "@/lib/domain/categories";
import type { SearchRequest } from "@/lib/domain/search";
import { hashKey } from "@/lib/hash";
import { Prisma } from "@/lib/generated/prisma/client";
import { regionLabel, regionOrder } from "@/lib/domain/regions";
import { backfillDedupeKeys, excludeKnown, filterSuppressed, upsertLeads } from "@/lib/leads/ingest";
import { logger } from "@/lib/logger";
import { getProvider } from "@/lib/providers";
import { cachedProviderCall } from "@/lib/providers/cache";
import { googleUsage } from "@/lib/providers/usage";
import { ProviderError, QuotaExhaustedError, type DataProvider, type ProviderBusiness, type ProviderQuery, type SweepPage } from "@/lib/providers/types";

const lastCallAt = new Map<string, number>();
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** Espaça as chamadas à mesma fonte. Reserva o horário antes de esperar: chamadas em paralelo não saem juntas. */
async function throttle(p: DataProvider) {
  const now = Date.now();
  const slot = Math.max(now, (lastCallAt.get(p.id) ?? 0) + p.minIntervalMs);
  lastCallAt.set(p.id, slot);
  if (slot > now) await sleep(slot - now);
}

/** Repete erros temporários da fonte (429/5xx) com espera exponencial. */
async function retrying<T>(p: DataProvider, fn: () => Promise<T>): Promise<T> {
  let lastError: unknown;
  const attempts = p.maxAttempts ?? 3;
  for (let attempt = 0; attempt < attempts; attempt++) {
    try {
      return await fn();
    } catch (err) {
      lastError = err;
      if (!(err instanceof ProviderError && err.retryable) || attempt === attempts - 1) break;
      await sleep(1500 * 2 ** attempt);
    }
  }
  throw lastError;
}

/** Busca na fonte com cache no banco: a mesma consulta não é paga duas vezes. */
export async function fetchWithCache(p: DataProvider, q: ProviderQuery): Promise<ProviderBusiness[]> {
  // hint não entra na chave: é só a ordem dos servidores, o resultado é o mesmo
  const key = hashKey("provider", p.id, q.category, q.city.toLowerCase(), q.uf, q.limit, q.offset ?? 0);
  return cachedProviderCall(key, p.id, p.cacheTtlMs, () =>
    retrying(p, async () => {
      await throttle(p);
      return p.search(q);
    }),
  );
}

/** Tamanho do pedaço da demonstração (paginada por offset). */
const DEMO_PAGE = 60;

/**
 * Próximo pedaço de uma cidade. Fontes com varredura própria (Google: quadrantes) cuidam do
 * cursor; as outras vêm inteiras numa consulta (OpenStreetMap) ou em páginas (demonstração).
 */
export async function sweepPage(p: DataProvider, q: ProviderQuery, cursor: unknown): Promise<SweepPage> {
  if (p.sweep) return retrying(p, () => p.sweep!(q, cursor));
  const offset = cursor && typeof cursor === "object" && "offset" in cursor ? Number((cursor as { offset: number }).offset) || 0 : 0;
  const pool = p.isDemo ? DEMO_PAGE : p.capabilities.maxResults;
  const items = await fetchWithCache(p, { ...q, limit: pool, ...(p.isDemo ? { offset } : {}) });
  return { items, next: p.isDemo && items.length >= pool ? { offset: offset + pool } : null };
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
  // Base do Brasil (OpenStreetMap): consulta local, dá para percorrer muitas cidades em segundos
  if (provider.regionCities) return { maxCities: 400, spread: 12 };
  return { maxCities: 12, spread: 6 };
}

/** Cidade varrida até o fim volta a ser consultada depois disso (empresas novas abrem). */
export const REVISIT_MS = 30 * 24 * 60 * 60 * 1000;
/** Pedaços (quadrantes/páginas) por cidade numa busca: teto de custo mesmo se tudo vier repetido. */
const MAX_PAGES_PER_TASK = 20;

type City = { name: string; uf: string };
type Task = { category: string; city: City };
type SweepKey = { userId: string; provider: string; category: string; city: string; state: string };

const sweepWhere = (k: SweepKey) => ({ userId_provider_category_city_state: k });
const recentlyExhausted = (s: { exhausted: boolean; exhaustedAt: Date | null } | null) =>
  !!s?.exhausted && !!s.exhaustedAt && Date.now() - s.exhaustedAt.getTime() < REVISIT_MS;

/** Chave da posição da busca geral (city "*"): mesma região + mesmas categorias. */
function regionKey(userId: string, provider: string, req: SearchRequest): SweepKey {
  return { userId, provider, category: [...req.categories].sort().join(","), city: "*", state: req.uf ?? "BR" };
}

/**
 * Cidades × categorias de uma busca. Com cidade escolhida, é ela. Na busca geral, a lista
 * completa da região numa ordem fixa por pessoa, sem as cidades já varridas até o fim; cada
 * busca começa de onde a anterior parou (rodízio), então o estado — ou o Brasil — inteiro vai
 * sendo coberto sem repetir.
 */
async function planTasks(userId: string, req: SearchRequest, provider: DataProvider) {
  if (req.cities.length) {
    // Cidade por cidade (todas as categorias de uma cidade antes de ir para a próxima)
    return { tasks: req.cities.flatMap((city) => req.categories.map((category) => ({ category, city }))), rotation: null, regionDone: false, noData: false };
  }
  const done = await db.searchSweep.findMany({
    where: {
      userId,
      provider: provider.id,
      category: { in: req.categories },
      exhausted: true,
      exhaustedAt: { gt: new Date(Date.now() - REVISIT_MS) },
      ...(req.uf ? { state: req.uf } : {}),
    },
    select: { category: true, city: true, state: true },
  });
  const doneSet = new Set(done.map((d) => `${d.category}|${d.city}|${d.state}`));
  const pending = (c: City) => req.categories.filter((cat) => !doneSet.has(`${cat}|${c.name}|${c.uf}`));
  // Fonte que sabe onde há empresas (base do Brasil): só entram cidades com pelo menos uma
  const withData = provider.regionCities ? await provider.regionCities(req.uf, req.categories).catch(() => null) : null;
  let open = regionOrder(req.uf, `${userId}|${req.uf ?? "BR"}`).filter((c) => pending(c).length > 0 && (!withData || withData.has(`${c.name}|${c.uf}`)));
  // Base local: cidades com mais empresas primeiro (menos cidades até completar 250/500);
  // a ordem da região desempata, então cada pessoa ainda vê uma sequência própria
  if (withData) {
    const pos = new Map(open.map((c, i) => [`${c.name}|${c.uf}`, i]));
    const size = (c: City) => withData.get(`${c.name}|${c.uf}`) ?? 0;
    open = [...open].sort((a, b) => Math.min(size(b), 200) - Math.min(size(a), 200) || pos.get(`${a.name}|${a.uf}`)! - pos.get(`${b.name}|${b.uf}`)!);
  }
  const key = regionKey(userId, provider.id, req);
  const region = await db.searchSweep.findUnique({ where: sweepWhere(key), select: { cursor: true } });
  const pos = Number((region?.cursor as { pos?: number } | null)?.pos ?? 0) || 0;
  const start = open.length ? pos % open.length : 0;
  const picked = [...open.slice(start), ...open.slice(0, start)].slice(0, regionBudget(provider).maxCities);
  return {
    tasks: picked.flatMap((city) => pending(city).map((category) => ({ category, city }))),
    rotation: { key, start },
    regionDone: open.length === 0,
    /** A fonte sabe que não há nenhuma empresa dessas categorias na região */
    noData: !!withData && withData.size === 0,
  };
}

/** Cria o registro da busca. Buscas simples rodam na hora; lotes vão para a fila. */
/** Fonte da busca: a pedida, mas o Google com a cota grátis do mês usada vira OpenStreetMap. */
async function resolveProvider(id: SearchRequest["provider"]) {
  const provider = getProvider(id);
  if (provider.id === "google" && (await googleUsage()).left <= 0) return { provider: getProvider("osm"), quotaOut: true };
  return { provider, quotaOut: false };
}

export async function createSearch(userId: string, req: SearchRequest) {
  const { provider, quotaOut } = await resolveProvider(req.provider);
  const total = req.cities.length ? req.categories.length * req.cities.length : req.categories.length * regionBudget(provider).maxCities;
  return db.search.create({
    data: {
      userId,
      query: req.query?.trim() || describeSearch(req),
      // quotaFallback: pediu Google, mas a cota do mês acabou (a tela explica a troca)
      params: { ...req, provider: provider.id, ...(quotaOut ? { quotaFallback: true } : {}) } as unknown as Prisma.InputJsonValue,
      provider: provider.id,
      status: "QUEUED",
      total,
    },
  });
}

/**
 * Tempo máximo de uma rodada do job. A função na Vercel morre em 300 s (maxDuration da página
 * de busca): paramos antes, gravamos o que achou e a busca termina com o que tem — nunca fica
 * presa em "Buscando…".
 */
const JOB_BUDGET_MS = 230_000;

/**
 * Processa uma busca. Só entram empresas NOVAS para o usuário, e cada cidade continua de onde
 * a última busca parou (SearchSweep): "50 padarias em Fortaleza" duas vezes traz 100 padarias
 * diferentes, e assim por diante até a fonte não ter mais nenhuma ("varredura completa").
 */
export async function runSearchJob(searchId: string) {
  const startedAt = Date.now();
  const search = await db.search.findUnique({ where: { id: searchId } });
  if (!search || search.status === "DONE") return;
  const userId = search.userId;
  const req = { cities: [], ...(search.params as object) } as unknown as SearchRequest & { provider: DataProvider["id"] };
  const resolved = await resolveProvider(req.provider);
  const provider = resolved.provider;
  const quotaOut = resolved.quotaOut || (search.params as { quotaFallback?: boolean }).quotaFallback === true;
  const regional = req.cities.length === 0;
  const { tasks, rotation, regionDone, noData } = await planTasks(userId, req, provider);
  const { spread } = regionBudget(provider);
  const concurrency = Math.max(1, provider.concurrency ?? 2);
  const plural = (cat: string) => getCategory(cat).plural.toLowerCase();

  // Retomada: a instância anterior pode ter morrido no meio — segue de onde parou, com o que já achou
  const resumeAt = Math.min(search.progress, tasks.length);
  const previous = search.leadIds.length
    ? await db.lead.findMany({ where: { id: { in: search.leadIds }, userId }, select: { id: true, score: true } })
    : [];
  await db.search.update({ where: { id: searchId }, data: { status: "RUNNING", total: tasks.length, progress: resumeAt } });
  if (resumeAt === 0) await backfillDedupeKeys(userId);
  const collected: { id: string; score: number }[] = [...previous];
  const errors: string[] = [];
  const seen = new Set<string>();
  const finished: Task[] = [];
  const alreadyDone: Task[] = [];
  let skipped = 0;
  let done = resumeAt;
  let stoppedEarly = false;
  let failures = 0;
  let quotaHit = false;

  const top = () => [...new Map(collected.map((c) => [c.id, c])).values()].sort((a, b) => b.score - a.score).slice(0, req.limit);

  // Onde cada cidade parou, numa consulta só (antes: uma por cidade)
  const sweepRows = await db.searchSweep.findMany({
    where: { userId, provider: provider.id, category: { in: req.categories }, ...(regional ? {} : { OR: req.cities.map((c) => ({ city: c.name, state: c.uf })) }) },
  });
  const sweeps = new Map(sweepRows.map((s) => [`${s.category}|${s.city}|${s.state}`, s]));

  const runTask = async (t: Task, index: number, quota: number) => {
    const key: SweepKey = { userId, provider: provider.id, category: t.category, city: t.city.name, state: t.city.uf };
    const sweep = sweeps.get(`${t.category}|${t.city.name}|${t.city.uf}`) ?? null;
    if (recentlyExhausted(sweep)) {
      alreadyDone.push(t);
      return;
    }
    // Varrida há mais de 30 dias: recomeça (só entra o que abriu desde então — o resto já é conhecido)
    const startCursor: unknown = sweep && !sweep.exhausted ? (sweep.cursor ?? null) : null;
    let cursor = startCursor;
    let exhausted = false;
    let failed = false;
    const fresh: ProviderBusiness[] = [];
    const q: ProviderQuery = { category: t.category, city: t.city.name, uf: t.city.uf, limit: quota, hint: index, regional };
    try {
      for (let page = 0; page < MAX_PAGES_PER_TASK && fresh.length < quota; page++) {
        if (Date.now() - startedAt > JOB_BUDGET_MS) break;
        const res = await sweepPage(provider, q, cursor);
        const allowed = await filterSuppressed(res.items);
        const r = await excludeKnown(userId, allowed, { usePhone: !provider.isDemo, uniqueNames: provider.isDemo, seen });
        skipped += r.known;
        const take = r.fresh.slice(0, quota - fresh.length);
        fresh.push(...take);
        // Sobrou empresa nova neste pedaço: a próxima busca recomeça por ele (o que já veio é pulado)
        if (r.fresh.length > take.length) break;
        cursor = res.next;
        if (cursor === null || cursor === undefined) {
          exhausted = true;
          break;
        }
      }
    } catch (err) {
      if (err instanceof QuotaExhaustedError) quotaHit = true;
      failed = true;
      failures++;
      const msg = err instanceof ProviderError ? err.message : "Falha ao consultar a fonte de dados.";
      if (!regional) errors.push(`${getCategory(t.category).plural} em ${t.city.name}: ${msg}`);
      else if (errors.length === 0) errors.push(msg);
      logger.warn("tarefa de busca falhou", { searchId, task: t, err: String(err) });
    }
    // O que achou antes de um erro fica; o cursor só anda pelos pedaços que deram certo
    const rows = await upsertLeads({ userId, provider: provider.id, isDemo: provider.isDemo, category: t.category, items: fresh, allNew: true });
    collected.push(...rows);
    if (failed && fresh.length === 0 && cursor === startCursor) return;
    const json = (c: unknown) => (c === null || c === undefined ? Prisma.DbNull : (c as Prisma.InputJsonValue));
    const state = { cursor: exhausted ? Prisma.DbNull : json(cursor), exhausted, exhaustedAt: exhausted ? new Date() : null };
    await db.searchSweep.upsert({
      where: sweepWhere(key),
      create: { ...key, ...state, found: fresh.length },
      update: { ...state, found: { increment: fresh.length } },
    });
    if (exhausted) finished.push(t);
  };

  // Várias cidades ao mesmo tempo (cada uma num servidor diferente da fonte); grava a cada rodada
  for (let i = resumeAt; i < tasks.length; i += concurrency) {
    const missing = req.limit - top().length;
    if (missing <= 0 || quotaHit) break;
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
    await Promise.all(
      batch.map((t, k) =>
        runTask(t, i + k, quotaFor()).catch((err) => {
          // erro do nosso lado (banco): a cidade fica para a próxima busca, as outras seguem
          failures++;
          logger.error("tarefa de busca quebrou", { searchId, task: t, err: String(err) });
        }),
      ),
    );
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

  // Busca geral: a próxima começa pelas cidades seguintes
  if (rotation) {
    const visited = new Set(tasks.slice(0, done).map((t) => `${t.city.name}|${t.city.uf}`)).size;
    const cursor = { pos: rotation.start + Math.max(1, visited) } as Prisma.InputJsonValue;
    await db.searchSweep.upsert({ where: sweepWhere(rotation.key), create: { ...rotation.key, cursor }, update: { cursor } });
  }

  // Ordena por potencial (código, não IA) e corta no limite pedido.
  const unique = top();
  const failedAll = unique.length === 0 && errors.length > 0;
  const source = provider.isDemo ? "na demonstração" : `no ${provider.label}`;
  const notes = [...new Set(errors)].slice(0, 3);
  if (quotaOut) notes.unshift("A cota grátis do Google Maps deste mês acabou: esta busca usou o OpenStreetMap (grátis). O Google volta quando o mês virar.");
  if (stoppedEarly && unique.length === 0 && errors.length) {
    // a fonte caiu logo de cara: a mensagem do erro já explica (ex.: servidores lentos)
  } else if (stoppedEarly) {
    notes.unshift(`A fonte estava lenta: consultamos ${done} de ${tasks.length} cidades${unique.length ? " e mostramos o que achamos" : ""}. Busque de novo para continuar pelas outras.`);
  }
  if (regional) {
    const cats = req.categories.map(plural).join(" e ");
    if (noData) notes.push(`Não há ${cats} ${req.uf ? `em ${req.uf}` : "no Brasil"} na base do ${provider.label}. Tente outra categoria ou outro estado.`);
    else if (regionDone) notes.push(`Varredura completa: você já percorreu todas as cidades ${req.uf ? `de ${req.uf}` : "do Brasil"} atrás de ${cats} ${source}.`);
    else if (finished.length) notes.push(`${finished.length} ${finished.length === 1 ? "cidade foi varrida" : "cidades foram varridas"} até o fim nesta busca. As próximas buscas seguem pelas outras.`);
  } else {
    for (const t of finished) {
      notes.push(`Varredura completa: estas são as últimas ${plural(t.category)} de ${t.city.name} ${source}. Para mais, tente outra cidade ou a busca geral pelo estado.`);
    }
    for (const t of alreadyDone) {
      notes.push(`Você já viu todas as ${plural(t.category)} de ${t.city.name} ${source} (varredura completa). Tente outra cidade ou a busca geral pelo estado.`);
    }
    if (unique.length < req.limit && skipped > 0 && !finished.length && !alreadyDone.length) {
      notes.push(`${unique.length ? `Achamos ${unique.length} empresas novas` : "Nenhuma empresa nova"}: outras ${skipped} desta busca você já tinha em Meus leads.`);
    }
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

/**
 * Quanto já foi varrido de cada cidade de uma busca (para a tela de resultados dizer se ainda
 * há mais ou se acabou). Só buscas com cidade escolhida.
 */
export async function sweepStatus(userId: string, search: { provider: string; params: unknown }) {
  const req = { cities: [], ...(search.params as object) } as unknown as SearchRequest;
  if (!req.cities?.length || !req.categories?.length) return [];
  const rows = await db.searchSweep.findMany({
    where: {
      userId,
      provider: search.provider,
      category: { in: req.categories },
      OR: req.cities.map((c) => ({ city: c.name, state: c.uf })),
    },
    select: { category: true, city: true, state: true, found: true, exhausted: true, exhaustedAt: true },
  });
  return rows.map((r) => ({ ...r, exhausted: recentlyExhausted(r), label: getCategory(r.category).plural }));
}
