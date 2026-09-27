import "server-only";
import { UserFacingError } from "@/lib/action";
import { getCurrentUser } from "@/lib/auth/session";
import { logger } from "@/lib/logger";
import { RateLimitError, assertRateLimit, type LimitName } from "@/lib/rate-limit";

/** Envelope das rotas do chat: sessão + cadastro completo + rate limit + erro seguro. */
export async function withChatUser<T>(limit: LimitName | null, fn: (user: NonNullable<Awaited<ReturnType<typeof getCurrentUser>>>) => Promise<T>) {
  const user = await getCurrentUser();
  if (!user || !user.onboardedAt) return Response.json({ error: "Não autenticado." }, { status: 401 });
  try {
    if (limit) assertRateLimit(limit, user.id);
    const data = await fn(user);
    return data instanceof Response ? data : Response.json(data, { headers: { "Cache-Control": "no-store" } });
  } catch (err) {
    if (err instanceof UserFacingError || err instanceof RateLimitError) return Response.json({ error: err.message }, { status: err instanceof RateLimitError ? 429 : 400 });
    logger.error("rota do chat falhou", { err });
    return Response.json({ error: "Algo deu errado. Tente novamente." }, { status: 500 });
  }
}
