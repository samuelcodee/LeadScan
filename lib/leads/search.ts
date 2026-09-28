import "server-only";
import { db } from "@/lib/db";
import { getCategory } from "@/lib/domain/categories";
import type { SearchRequest } from "@/lib/domain/search";
import { hashKey } from "@/lib/hash";
import { Prisma } from "@/lib/generated/prisma/client";
import { interleave, regionLabel, regionOrder } from "@/lib/domain/regions";
import { randomUUID } from "node:crypto";
import { backfillDedupeKeys, excludeKnown, filterSuppressed, insertNewLeads, knownMarks } from "@/lib/leads/ingest";
import { mixTarget, planMix } from "@/lib/leads/mix";
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
  const cats = req.categories.length ? req.categories.map((c) => getCategory(c).plural).join(", ") : "Vários negócios";
  const where = req.cities.length ? req.cities.map((c) => `${c.name} - ${c.uf}`).join(", ") : regionLabel(req.uf);
  return `${cats} · ${where}`;
}

/**
 * Quantas cidades uma busca geral percorre (maxCities) e por quantas espalha os resultados
 * (spread), por fonte: demonstração é grátis; real custa tempo/cota.
 */
function regionBudget(provider: DataProvider, limit = 50) {
  if (provider.isDemo) return { maxCities: 40, spread: 10 };
  if (provider.id === "google") return { maxCities: 8, spread: 5 };
  // Base do Brasil (OpenStreetMap): consulta local, então espalha de verdade: ≈4 empresas por
  // cidade (100 leads ≈ 25 cidades; 500 ≈ 80), em vez de lotar a primeira capital
  if (provider.regionCities) return { maxCities: 400, spread: Math.min(80, Math.max(12, Math.ceil(limit / 4))) };
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

/** Onde cada cidade de uma rodada parou, numa consulta só (upsert em lote; antes, uma por cidade). */
type SweepSave = { category: string; city: City; cursor: unknown; exhausted: boolean; found: number };
async function saveSweeps(userId: string, provider: string, rows: SweepSave[]) {
  if (!rows.length) return;
  // timestamp sem fuso, em UTC (como o Prisma grava)
  const ts = (d: Date) => d.toISOString().replace("T", " ").replace("Z", "");
  const now = ts(new Date());
  const unique = [...new Map(rows.map((r) => [`${r.category}|${r.city.name}|${r.city.uf}`, r])).values()];
  const values = unique.map((r) => {
    const cursor = r.exhausted || r.cursor === null || r.cursor === undefined ? null : JSON.stringify(r.cursor);
    return Prisma.sql`(${randomUUID()}, ${userId}, ${provider}, ${r.category}, ${r.city.name}, ${r.city.uf}, ${cursor}::jsonb, ${r.found}::int, ${r.exhausted}, ${r.exhausted ? now : null}::timestamp(3), ${now}::timestamp(3), ${now}::timestamp(3))`;
  });
  await db.$executeRaw`
    INSERT INTO "SearchSweep" ("id", "userId", "provider", "category", "city", "state", "cursor", "found", "exhausted", "exhaustedAt", "createdAt", "updatedAt")
    VALUES ${Prisma.join(values)}
    ON CONFLICT ("userId", "provider", "category", "city", "state") DO UPDATE SET
      "cursor" = EXCLUDED."cursor",
      "found" = "SearchSweep"."found" + EXCLUDED."found",
      "exhausted" = EXCLUDED."exhausted",
      "exhaustedAt" = EXCLUDED."exhaustedAt",
      "updatedAt" = EXCLUDED."updatedAt"`;
}
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
async function planTasks(userId: string, req: SearchRequest, provider: DataProvider, seed: string) {
  const { maxCities, spread } = regionBudget(provider, req.limit);
  if (!req.categories.length) {
    // Sem categoria: vários tipos de negócio em várias cidades, sorteados a cada busca
    const done = await db.searchSweep.findMany({
      where: {
        userId,
        provider: provider.id,
        city: { not: "*" },
        exhausted: true,
        exhaustedAt: { gt: new Date(Date.now() - REVISIT_MS) },
        ...(req.cities.length ? { OR: req.cities.map((c) => ({ city: c.name, state: c.uf })) } : req.uf ? { state: req.uf } : {}),
      },
      select: { category: true, city: true, state: true },
    });
    const blocked = new Set(done.map((d) => `${d.category}|${d.city}|${d.state}`));
    const tasks = await planMix(req, provider, seed, blocked, maxCities);
    const perTask = Math.max(2, Math.ceil(req.limit / mixTarget(req.limit)));
    return { tasks, rotation: null, regionDone: false, noData: tasks.length === 0, perTask };
  }
  if (req.cities.length) {
    // Cidade por cidade (todas as categorias de uma cidade antes de ir para a próxima)
    return { tasks: req.cities.flatMap((city) => req.categories.map((category) => ({ category, city }))), rotation: null, regionDone: false, noData: false, perTask: req.limit };
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
  // Base local: espalha pelo mapa. Brasil = um estado de cada vez (as maiores cidades de cada
  // estado primeiro); estado = maiores primeiro. A ordem da região desempata (cada pessoa vê
  // uma sequência própria) e a quota por cidade é pequena (spread): 100 leads ≈ 25 cidades.
  if (withData) {
    const pos = new Map(open.map((c, i) => [`${c.name}|${c.uf}`, i]));
    const size = (c: City) => Math.min(withData.get(`${c.name}|${c.uf}`) ?? 0, 200);
    const groups = new Map<string, City[]>();
    for (const c of open) {
      const g = groups.get(c.uf);
      if (g) g.push(c);
      else groups.set(c.uf, [c]);
    }
    const bySize = (a: City, b: City) => size(b) - size(a) || pos.get(`${a.name}|${a.uf}`)! - pos.get(`${b.name}|${b.uf}`)!;
    open = interleave([...groups.values()].map((g) => g.sort(bySize)));
  }
  const key = regionKey(userId, provider.id, req);
  const region = await db.searchSweep.findUnique({ where: sweepWhere(key), select: { cursor: true } });
  const pos = Number((region?.cursor as { pos?: number } | null)?.pos ?? 0) || 0;
  const start = open.length ? pos % open.length : 0;
  const picked = [...open.slice(start), ...open.slice(0, start)].slice(0, maxCities);
  return {
    tasks: picked.flatMap((city) => pending(city).map((category) => ({ category, city }))),
    rotation: { key, start },
    regionDone: open.length === 0,
    /** A fonte sabe que não há nenhuma empresa dessas categorias na região */
    noData: !!withData && withData.size === 0,
    /** Empresas por cidade × categoria: poucas de cada, muitas cidades */
    perTask: Math.max(2, Math.ceil(req.limit / (spread * req.categories.length))),
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
  const total = !req.categories.length
    ? mixTarget(req.limit) * 3
    : req.cities.length
      ? req.categories.length * req.cities.length
      : req.categories.length * regionBudget(provider, req.limit).maxCities;
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
  const mix = req.categories.length === 0;
  const { tasks, rotation, regionDone, noData, perTask } = await planTasks(userId, req, provider, searchId);
  const taskCats = [...new Set(tasks.map((t) => t.category))];
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
  let done = resumeAt;
  let stoppedEarly = false;
  let failures = 0;
  let quotaHit = false;

  const top = () => [...new Map(collected.map((c) => [c.id, c])).values()].sort((a, b) => b.score - a.score).slice(0, req.limit);

  // Onde cada cidade parou, numa consulta só (antes: uma por cidade)
  const sweepRows = await db.searchSweep.findMany({
    where: { userId, provider: provider.id, category: { in: taskCats }, ...(regional ? {} : { OR: req.cities.map((c) => ({ city: c.name, state: c.uf })) }) },
  });
  const sweeps = new Map(sweepRows.map((s) => [`${s.category}|${s.city}|${s.state}`, s]));

  type Outcome = { t: Task; fresh: ProviderBusiness[]; cursor: unknown; exhausted: boolean };
  type Prep = { t: Task; q: ProviderQuery; startCursor: unknown; first: Promise<SweepPage> };
  const usePhone = !provider.isDemo;
  /** Quantas empresas conferir de uma vez: a busca geral pede poucas por cidade (não checa as 250 do pedaço) */
  const chunk = (quota: number, have: number) => Math.max(30, (quota - have) * 3);

  /** Começa uma cidade × categoria: onde parou e o primeiro pedaço (já pedido à fonte). */
  const prepare = (t: Task, index: number, quota: number): Prep | null => {
    const sweep = sweeps.get(`${t.category}|${t.city.name}|${t.city.uf}`) ?? null;
    if (recentlyExhausted(sweep)) {
      alreadyDone.push(t);
      return null;
    }
    // Varrida há mais de 30 dias: recomeça (só entra o que abriu desde então — o resto já é conhecido)
    const startCursor: unknown = sweep && !sweep.exhausted ? (sweep.cursor ?? null) : null;
    const q: ProviderQuery = { category: t.category, city: t.city.name, uf: t.city.uf, limit: quota, hint: index, regional };
    const first = sweepPage(provider, q, startCursor);
    first.catch(() => {}); // o erro é tratado em runTask
    return { t, q, startCursor, first };
  };

  /** Consulta uma cidade × categoria (sem gravar nada: a rodada grava tudo junto). */
  const runTask = async ({ t, q, startCursor, first }: Prep, quota: number, probed: Set<string> | null): Promise<Outcome | null> => {
    let cursor = startCursor;
    let exhausted = false;
    let failed = false;
    const fresh: ProviderBusiness[] = [];
    try {
      for (let page = 0; page < MAX_PAGES_PER_TASK && fresh.length < quota; page++) {
        if (Date.now() - startedAt > JOB_BUDGET_MS) break;
        const res = page === 0 ? await first : await sweepPage(provider, q, cursor);
        const allowed = await filterSuppressed(res.items);
        let rest = false;
        for (let k = 0; k < allowed.length; ) {
          const size = chunk(quota, fresh.length);
          // 1º pedaço: já consultado junto com o resto da rodada (uma consulta para 20 cidades)
          const have = page === 0 && k === 0 && probed ? probed : undefined;
          const r = await excludeKnown(userId, allowed.slice(k, k + size), { usePhone, uniqueNames: provider.isDemo, seen, have });
          k += size;
          const take = r.fresh.slice(0, quota - fresh.length);
          fresh.push(...take);
          // Sobrou empresa nova (ou parte do pedaço nem foi conferida): a próxima busca recomeça
          // por este pedaço (o que já veio é pulado)
          if (r.fresh.length > take.length || (fresh.length >= quota && k < allowed.length)) {
            rest = true;
            break;
          }
        }
        if (rest) break;
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
      if (!regional && !mix) errors.push(`${getCategory(t.category).plural} em ${t.city.name}: ${msg}`);
      else if (errors.length === 0) errors.push(msg);
      logger.warn("tarefa de busca falhou", { searchId, task: t, err: String(err) });
    }
    // O que achou antes de um erro fica; o cursor só anda pelos pedaços que deram certo
    if (failed && fresh.length === 0 && cursor === startCursor) return null;
    return { t, fresh, cursor, exhausted };
  };

  /** Grava a rodada inteira: leads novos (2 consultas) e onde cada cidade parou (1 consulta). */
  const persist = async (outs: Outcome[]) => {
    const rows = await insertNewLeads({
      userId,
      provider: provider.id,
      isDemo: provider.isDemo,
      items: outs.flatMap((o) => o.fresh.map((item) => ({ item, category: o.t.category }))),
    });
    collected.push(...rows);
    await saveSweeps(
      userId,
      provider.id,
      outs.map((o) => ({ category: o.t.category, city: o.t.city, cursor: o.cursor, exhausted: o.exhausted, found: o.fresh.length })),
    );
    for (const o of outs) if (o.exhausted) finished.push(o.t);
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
    // Busca geral/variada: poucas de cada cidade, sem passar muito do que falta (o que passa
    // do limite fica gravado como visto e só volta como "Já apareceu")
    const quota = regional || mix ? Math.max(1, Math.min(perTask, Math.ceil(missing / batch.length))) : Math.max(1, Math.ceil(missing / remainingTasks));
    const failuresBefore = failures;
    // Primeiro pedaço de cada cidade (em paralelo) e UMA consulta do que a pessoa já conhece
    const preps = batch.map((t, k) => prepare(t, i + k, quota));
    const firstPages = await Promise.allSettled(preps.map((p) => p?.first ?? Promise.resolve(null)));
    const sample = (
      await Promise.all(firstPages.map(async (s) => (s.status === "fulfilled" && s.value ? (await filterSuppressed(s.value.items)).slice(0, chunk(quota, 0)) : [])))
    ).flat();
    const probed = await knownMarks(userId, sample, usePhone).catch(() => null);
    const outs = await Promise.all(
      preps.map((p) =>
        !p
          ? null
          : runTask(p, quota, probed).catch((err) => {
              // erro do nosso lado (banco): a cidade fica para a próxima busca, as outras seguem
              failures++;
              logger.error("tarefa de busca quebrou", { searchId, task: p.t, err: String(err) });
              return null;
            }),
      ),
    );
    try {
      await persist(outs.filter((o): o is Outcome => o !== null));
    } catch (err) {
      failures += batch.length;
      logger.error("rodada da busca não gravou", { searchId, err: String(err) });
    }
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
  const freshTop = top();
  // Faltou empresa nova: completa com as que já apareceram em buscas anteriores (mesmas
  // categorias e lugar). Nada se perde por não ter sido salvo; a tela marca "Já apareceu".
  // Fica de fora só quem a pessoa descartou (sem interesse) ou já fechou.
  const repeats =
    freshTop.length < req.limit
      ? await db.lead.findMany({
          where: {
            userId,
            isDemo: provider.isDemo,
            status: { notIn: ["NOT_INTERESTED", "WON"] },
            id: { notIn: [...new Set(collected.map((c) => c.id))] },
            ...(mix ? {} : { category: { in: req.categories } }),
            ...(req.cities.length ? { OR: req.cities.map((c) => ({ city: c.name, state: c.uf })) } : req.uf ? { state: req.uf } : {}),
          },
          orderBy: [{ score: "desc" }, { createdAt: "desc" }],
          take: req.limit - freshTop.length,
          select: { id: true, score: true },
        })
      : [];
  const unique = [...freshTop, ...repeats];
  const failedAll = unique.length === 0 && errors.length > 0;
  const source = provider.isDemo ? "na demonstração" : `no ${provider.label}`;
  const cats = mix ? "empresas" : req.categories.map(plural).join(" e ");
  const notes = [...new Set(errors)].slice(0, 3);
  if (quotaOut) notes.unshift("A cota grátis do Google Maps deste mês acabou: esta busca usou o OpenStreetMap (grátis). O Google volta quando o mês virar.");
  if (stoppedEarly && unique.length === 0 && errors.length) {
    // a fonte caiu logo de cara: a mensagem do erro já explica (ex.: servidores lentos)
  } else if (stoppedEarly) {
    notes.unshift(`A fonte estava lenta: consultamos ${done} de ${tasks.length} cidades${unique.length ? " e mostramos o que achamos" : ""}. Busque de novo para continuar pelas outras.`);
  }
  const where = req.cities.length ? `em ${req.cities.map((c) => c.name).join(", ")}` : req.uf ? `em ${req.uf}` : "no Brasil";
  if (noData) {
    notes.push(mix ? `Não há empresas novas ${where} na base do ${provider.label}.` : `Não há ${cats} ${where} na base do ${provider.label}. Tente outra categoria ou outro estado.`);
  } else if (regional && !mix) {
    if (regionDone) notes.push(`Varredura completa: você já percorreu todas as cidades ${req.uf ? `de ${req.uf}` : "do Brasil"} atrás de ${cats} ${source}.`);
  } else if (!regional && !mix) {
    for (const t of [...finished, ...alreadyDone]) {
      notes.push(`Varredura completa: você já viu tudo o que há de ${plural(t.category)} em ${t.city.name} ${source}.`);
    }
  }
  if (repeats.length) {
    const n = repeats.length;
    notes.push(
      `${freshTop.length ? `${freshTop.length} ${freshTop.length === 1 ? "empresa nova" : "empresas novas"} e ` : ""}${n} que já ${n === 1 ? "tinha aparecido" : "tinham aparecido"} em buscas anteriores (marcadas “Já apareceu”).`,
    );
  } else if (unique.length < req.limit && unique.length > 0 && !stoppedEarly && !errors.length && !finished.length && !alreadyDone.length) {
    notes.push(`Isso é tudo o que existe para essa busca ${source}.`);
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
