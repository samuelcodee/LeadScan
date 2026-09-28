import "server-only";
import { EventEmitter } from "node:events";
import { randomUUID } from "node:crypto";
import { Client } from "pg";
import { db } from "@/lib/db";
import { env } from "@/lib/env";
import { logger } from "@/lib/logger";
import { invalidateCommunity } from "@/lib/ranking/cached";

/**
 * Tempo real (SSE). Um evento publicado aqui chega em até ~1s a todas as abas abertas.
 *
 *  - Dentro do processo: EventEmitter (funciona em `next dev` / `next start`).
 *  - Entre instâncias (Vercel, várias réplicas): PostgreSQL LISTEN/NOTIFY no canal `leadsite_live`.
 *      NOTIFY sai pelo pool normal (funciona até atrás de pooler);
 *      LISTEN precisa de conexão direta (sem pooler em modo transação): use REALTIME_DATABASE_URL
 *      (ou DATABASE_URL_UNPOOLED / POSTGRES_URL_NON_POOLING, que Neon e Supabase criam na Vercel).
 *      Só abre essa conexão a instância que tem alguém ouvindo (uma por instância).
 *    Cada instância ignora o eco das próprias mensagens.
 *
 * Tópicos: "community" (ranking, faturamento da plataforma) e "user:<id>" (financeiro privado
 * e mensagens). Nos eventos de chat, userId é QUEM RECEBE o aviso.
 */
export type LiveEvent =
  | { type: "sale"; userId: string; amountCents: number; points: number; verified: boolean }
  | { type: "charge"; userId: string; chargeId: string; status: string }
  | { type: "profile"; userId: string }
  | { type: "message"; userId: string; conversationId: string; messageId: string; fromUserId: string }
  | { type: "deleted"; userId: string; conversationId: string; messageId: string }
  | { type: "edited"; userId: string; conversationId: string; messageId: string }
  | { type: "read"; userId: string; conversationId: string; byUserId: string }
  | { type: "typing"; userId: string; conversationId: string; byUserId: string }
  /** convite de amizade recebido/aceito, amizade desfeita, bloqueio */
  | { type: "friend"; userId: string }
  /** pedido de mensagem aceito/recusado: a conversa muda de caixa */
  | { type: "inbox"; userId: string; conversationId: string }
  /** Ultrapassagem no ranking: kind "up" = você passou alguém; "down" = alguém passou você */
  | { type: "rank"; userId: string; kind: "up" | "down"; period: "week" | "month"; position: number; other: string; count: number };

type Envelope = { origin: string; topics: string[]; event: LiveEvent };

const CHANNEL = "leadsite_live";

type State = { emitter: EventEmitter; origin: string; listener: Client | null; connecting: Promise<Client | null> | null; retryAt: number };
const g = globalThis as unknown as { __leadsiteLive?: State };
const state: State = (g.__leadsiteLive ??= { emitter: new EventEmitter(), origin: randomUUID(), listener: null, connecting: null, retryAt: 0 });
state.emitter.setMaxListeners(0);

/**
 * LISTEN/NOTIFY só faz sentido com várias instâncias. No Postgres embutido do `prisma dev`
 * (uma conexão só) fica desligado; REALTIME_PG=false desliga em qualquer ambiente.
 */
function pgEnabled() {
  return process.env.REALTIME_PG !== "false" && !/localhost:5121\d/.test(env().DATABASE_URL);
}

function listenUrl() {
  return process.env.REALTIME_DATABASE_URL || process.env.DATABASE_URL_UNPOOLED || process.env.POSTGRES_URL_NON_POOLING || env().DATABASE_URL;
}

async function ensureListener() {
  if (!pgEnabled()) return null;
  if (state.listener) return state.listener;
  if (state.connecting) return state.connecting;
  if (Date.now() < state.retryAt) return null;
  state.connecting = (async () => {
    const client = new Client({ connectionString: listenUrl() });
    try {
      await client.connect();
      await client.query(`LISTEN ${CHANNEL}`);
      client.on("notification", (msg) => {
        if (!msg.payload) return;
        try {
          const envelope = JSON.parse(msg.payload) as Envelope;
          if (envelope.origin === state.origin) return;
          for (const t of envelope.topics) state.emitter.emit(t, envelope.event);
        } catch {
          // payload malformado: ignora
        }
      });
      const drop = (err?: unknown) => {
        if (err) logger.warn("realtime: conexão LISTEN caiu", { err: String(err) });
        if (state.listener === client) state.listener = null;
        client.removeAllListeners();
        void client.end().catch(() => {});
      };
      client.on("error", drop);
      client.on("end", () => drop());
      state.listener = client;
      return client;
    } catch (err) {
      logger.info("realtime: LISTEN indisponível, usando só eventos locais", { err: String(err) });
      state.retryAt = Date.now() + 30_000;
      void client.end().catch(() => {});
      return null;
    } finally {
      state.connecting = null;
    }
  })();
  return state.connecting;
}

export function topicsFor(event: LiveEvent) {
  const topics = [`user:${event.userId}`];
  if ((event.type === "sale" && event.verified) || event.type === "profile") topics.push("community");
  return topics;
}

export async function publish(event: LiveEvent) {
  const topics = topicsFor(event);
  // placar/faturamento da comunidade mudou: o cache compartilhado cai antes das telas recarregarem
  if (topics.includes("community")) invalidateCommunity();
  for (const t of topics) state.emitter.emit(t, event);
  if (!pgEnabled()) return;
  try {
    const payload: Envelope = { origin: state.origin, topics, event };
    await db.$executeRaw`SELECT pg_notify(${CHANNEL}, ${JSON.stringify(payload)})`;
  } catch (err) {
    logger.warn("realtime: NOTIFY falhou", { err: String(err) });
  }
}

export function subscribe(topics: string[], onEvent: (e: LiveEvent) => void) {
  void ensureListener();
  for (const t of topics) state.emitter.on(t, onEvent);
  return () => {
    for (const t of topics) state.emitter.off(t, onEvent);
  };
}
