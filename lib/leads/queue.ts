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
type QueueState = { pending: string[]; running: Promise<void> | null; active: string | null };
const g = globalThis as unknown as { __leadsiteQueue?: QueueState };
const state: QueueState = (g.__leadsiteQueue ??= { pending: [], running: null, active: null });

const STALE_MS = 2 * 60_000;

function keepAlive(p: Promise<void>) {
  try {
    after(() => p);
  } catch {
    // fora de uma requisição (scripts/testes): a promessa segue sozinha
  }
}

export function enqueueSearch(id: string) {
  if (state.active === id || state.pending.includes(id)) return;
  state.pending.push(id);
  state.running ??= drain();
  keepAlive(state.running);
}

export function isQueued(id: string) {
  return state.active === id || state.pending.includes(id);
}

async function drain() {
  try {
    while (state.pending.length) {
      const id = state.pending.shift()!;
      // Reserva atômica: se outra instância já pegou, pula
      const { count } = await db.search.updateMany({ where: { id, status: "QUEUED" }, data: { status: "RUNNING" } });
      if (!count) continue;
      state.active = id;
      try {
        await runSearchJob(id);
      } catch (err) {
        logger.error("job de busca falhou", { id, err });
        await db.search.update({ where: { id }, data: { status: "FAILED", error: "Erro inesperado ao processar a busca." } }).catch(() => {});
      }
    }
  } finally {
    state.active = null;
    state.running = null;
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
