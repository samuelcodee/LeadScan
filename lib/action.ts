import "server-only";
import { headers } from "next/headers";
import { z } from "zod";
import { logger } from "@/lib/logger";
import { RateLimitError, assertRateLimit, type LimitName } from "@/lib/rate-limit";
import { UnauthorizedError, requireUserForAction, type CurrentUser } from "@/lib/auth/session";

export type ActionResult<T = void> = { ok: true; data: T } | { ok: false; error: string };

export class UserFacingError extends Error {}

/**
 * Envelope padrão das server actions:
 *  - autentica (usuário da sessão; nunca confiar em userId vindo do cliente)
 *  - valida a entrada com zod
 *  - aplica rate limit
 *  - converte erros em mensagens seguras (sem stack/segredos para o cliente)
 */
export function action<S extends z.ZodType, T>(
  opts: { schema: S; limit?: LimitName; name: string },
  handler: (input: z.infer<S>, user: CurrentUser) => Promise<T>,
) {
  return async (raw: z.input<S>): Promise<ActionResult<T>> => {
    try {
      const user = await requireUserForAction();
      assertRateLimit(opts.limit ?? "mutation", user.id);
      const parsed = opts.schema.safeParse(raw);
      if (!parsed.success) {
        return { ok: false, error: parsed.error.issues[0]?.message ?? "Dados inválidos." };
      }
      return { ok: true, data: await handler(parsed.data, user) };
    } catch (err) {
      if (err instanceof UnauthorizedError || err instanceof RateLimitError || err instanceof UserFacingError) {
        return { ok: false, error: err.message };
      }
      logger.error(`action ${opts.name} falhou`, { err });
      return { ok: false, error: "Algo deu errado. Tente novamente em instantes." };
    }
  };
}

export const idSchema = z.string().min(1).max(64);

/** IP do cliente (atrás de proxy/CDN confiável). Só para rate limit — nunca gravado. */
export async function clientIp() {
  const h = await headers();
  return h.get("x-forwarded-for")?.split(",")[0]?.trim() || h.get("x-real-ip") || "local";
}

/**
 * Actions SEM sessão (login, cadastro): mesmo envelope de validação e erros,
 * com rate limit por IP no lugar do usuário.
 */
export function publicAction<S extends z.ZodType, T>(opts: { schema: S; limit: LimitName; name: string }, handler: (input: z.infer<S>) => Promise<T>) {
  return async (raw: z.input<S>): Promise<ActionResult<T>> => {
    try {
      assertRateLimit(opts.limit, await clientIp());
      const parsed = opts.schema.safeParse(raw);
      if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Dados inválidos." };
      return { ok: true, data: await handler(parsed.data) };
    } catch (err) {
      if (err instanceof RateLimitError || err instanceof UserFacingError) return { ok: false, error: err.message };
      logger.error(`publicAction ${opts.name} falhou`, { err });
      return { ok: false, error: "Algo deu errado. Tente novamente em instantes." };
    }
  };
}
