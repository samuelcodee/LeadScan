import "server-only";
import { after } from "next/server";
import { db } from "@/lib/db";
import { runSearchJob } from "@/lib/leads/search";
import { logger } from "@/lib/logger";

/**
 * Fila de buscas em lote — em processo, concorrência 1 por instância (respeita limites das fontes).
 * Pronta para serverless (Vercel):
 *  - `after()` mantém a função viva até a fila esvaziar (sem ele a instância congela após a resposta);
 *  - cada busca é "reservada" no banco (QUEUED → RUNNING) antes de rodar: duas instâncias nunca
 *    processam a mesma busca;
 *  - busca RUNNING sem avanço há 2 min (instância morreu no meio) volta para a fila quando o
 *    cliente consulta o progresso.
 * Para escalar mais, troque este módulo por Inngest / QStash mantendo enqueueSearch() como porta.
 */
type QueueState = { pending: string[]; workers: Set<Promise<void>>; active: Set<string> };
const g = globalThis as unknown as { __leadsiteQueue2?: QueueState };
const state: QueueState = (g.__leadsiteQueue2 ??= { pending: [], workers: new Set(), active: new Set() });
/** Buscas simultâneas por instância: a busca de uma pessoa não espera a de outra terminar. */
const MAX_JOBS = 4;

const STALE_MS = 2 * 60_000;

function keepAlive(p: Promise<void>) {
  try {
    after(() => p);
  } catch {
    // fora de uma requisição (scripts/testes): a promessa segue sozinha
  }
}

export function enqueueSearch(id: string) {
  if (state.active.has(id) || state.pending.includes(id)) return;
  state.pending.push(id);
  if (state.workers.size < MAX_JOBS) {
    const worker = drain().finally(() => state.workers.delete(worker));
    state.workers.add(worker);
    keepAlive(worker);
  } else {
    // todos os trabalhadores ocupados: a busca entra no próximo que liberar (e segura a função viva até lá)
    keepAlive(Promise.allSettled([...state.workers]).then(() => undefined));
  }
}

export function isQueued(id: string) {
  return state.active.has(id) || state.pending.includes(id);
}

async function drain() {
  while (state.pending.length) {
    const id = state.pending.shift()!;
    // Reserva atômica: se outra instância já pegou, pula
    const { count } = await db.search.updateMany({ where: { id, status: "QUEUED" }, data: { status: "RUNNING" } });
    if (!count) continue;
    state.active.add(id);
    try {
      await runSearchJob(id);
    } catch (err) {
      logger.error("job de busca falhou", { id, err });
      await db.search.update({ where: { id }, data: { status: "FAILED", error: "Erro inesperado ao processar a busca." } }).catch(() => {});
    } finally {
      state.active.delete(id);
    }
  }
}

/** Retoma buscas que ficaram paradas (servidor reiniciou ou a instância foi encerrada no meio). */
export async function resumeIfStale(search: { id: string; status: string; updatedAt?: Date }) {
  if (isQueued(search.id)) return;
  if (search.status === "QUEUED") return enqueueSearch(search.id);
  if (search.status === "RUNNING" && search.updatedAt && Date.now() - search.updatedAt.getTime() > STALE_MS) {
    const { count } = await db.search.updateMany({ where: { id: search.id, status: "RUNNING", updatedAt: search.updatedAt }, data: { status: "QUEUED" } });
    if (count) enqueueSearch(search.id);
  }
}
