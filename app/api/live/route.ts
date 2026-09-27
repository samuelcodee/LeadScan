import { getCurrentUser } from "@/lib/auth/session";
import { subscribe, type LiveEvent } from "@/lib/realtime";

/**
 * Server-Sent Events: /api/live?t=me,community
 *  - "me": eventos da própria conta (cobranças, vendas) — o servidor decide o userId,
 *    nunca o cliente (ninguém assina o canal privado de outra pessoa).
 *  - "community": vendas verificadas da plataforma (ranking e faturamento ao vivo).
 * Heartbeat a cada 25 s mantém a conexão aberta atrás de proxies.
 * Em serverless (Vercel) a função tem tempo máximo: o servidor fecha a conexão um pouco antes
 * (LIFETIME_MS) e o navegador reconecta sozinho em ~1,5 s; o cliente ressincroniza ao voltar.
 */
export const maxDuration = 300;
const LIFETIME_MS = 280_000;
/** Evento da comunidade não carrega dado privado: só tipo, pontos e se foi você. */
function toPayload(e: LiveEvent, me: string) {
  switch (e.type) {
    case "sale":
      return { type: e.type, mine: e.userId === me, points: e.points };
    case "message":
      return { type: e.type, mine: e.fromUserId === me, conversationId: e.conversationId, messageId: e.messageId };
    case "deleted":
    case "edited":
      return { type: e.type, conversationId: e.conversationId, messageId: e.messageId };
    case "read":
    case "typing":
      return { type: e.type, mine: e.byUserId === me, conversationId: e.conversationId };
    default:
      return { type: e.type, mine: e.userId === me };
  }
}

export async function GET(request: Request) {
  const user = await getCurrentUser();
  if (!user) return new Response("Não autenticado", { status: 401 });

  const wanted = new URL(request.url).searchParams.get("t")?.split(",") ?? ["me"];
  const topics = [...new Set(wanted.flatMap((t) => (t === "me" ? [`user:${user.id}`] : t === "community" ? ["community"] : [])))];
  if (!topics.length) return new Response("Tópico inválido", { status: 400 });

  const encoder = new TextEncoder();
  let cleanup = () => {};
  const stream = new ReadableStream({
    start(controller) {
      const send = (chunk: string) => {
        try {
          controller.enqueue(encoder.encode(chunk));
        } catch {
          cleanup();
        }
      };
      send("retry: 1500\n\n");
      // Uma assinatura por tópico: o cliente sabe se o evento é seu ("me") ou da comunidade
      const offs = topics.map((t) =>
        subscribe([t], (e: LiveEvent) => {
          const scope = t === "community" ? "community" : "me";
          send(`data: ${JSON.stringify({ ...toPayload(e, user.id), scope })}\n\n`);
        }),
      );
      const unsubscribe = () => offs.forEach((off) => off());
      const beat = setInterval(() => send(": ping\n\n"), 25_000);
      // fecha antes do limite da plataforma (o EventSource reconecta sozinho)
      const lifetime = setTimeout(() => {
        cleanup();
        try {
          controller.close();
        } catch {
          // já fechado
        }
      }, LIFETIME_MS);
      cleanup = () => {
        clearInterval(beat);
        clearTimeout(lifetime);
        unsubscribe();
      };
      request.signal.addEventListener("abort", () => {
        cleanup();
        try {
          controller.close();
        } catch {
          // já fechado
        }
      });
    },
    cancel() {
      cleanup();
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}
