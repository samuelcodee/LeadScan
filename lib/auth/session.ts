import "server-only";
import { cache } from "react";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { SESSION_COOKIE, SESSION_TTL_SECONDS, signSession, verifySession } from "@/lib/auth/token";

/**
 * Sessão: cookie httpOnly assinado (HMAC) + checagem da versão no banco.
 * Todo o app (actions, queries, controle de acesso por userId) depende só de getCurrentUser().
 */
export const getCurrentUser = cache(async () => {
  const store = await cookies();
  const claims = await verifySession(store.get(SESSION_COOKIE)?.value);
  if (!claims) return null;
  const user = await db.user.findUnique({ where: { id: claims.userId }, include: { avatar: { select: { id: true, moderation: true } } } });
  if (!user || user.sessionVersion !== claims.version) return null;
  return user;
});

export type CurrentUser = NonNullable<Awaited<ReturnType<typeof getCurrentUser>>>;

/** Para páginas: exige sessão e cadastro completo (nome, @usuário e termos aceitos). */
export async function requireUser(opts: { allowIncomplete?: boolean } = {}): Promise<CurrentUser> {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (!opts.allowIncomplete && !user.onboardedAt) redirect("/onboarding");
  return user;
}

export class UnauthorizedError extends Error {
  constructor() {
    super("Sessão expirada. Entre novamente.");
  }
}

/** Para server actions / route handlers: lança erro em vez de redirecionar. */
export async function requireUserForAction(): Promise<CurrentUser> {
  const user = await getCurrentUser();
  if (!user) throw new UnauthorizedError();
  return user;
}

export async function setSessionCookie(user: { id: string; sessionVersion: number }) {
  const store = await cookies();
  store.set(SESSION_COOKIE, await signSession(user.id, user.sessionVersion), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: SESSION_TTL_SECONDS,
  });
}

export async function clearSessionCookie() {
  const store = await cookies();
  store.delete(SESSION_COOKIE);
}

/** Destino pós-login seguro (só caminhos internos — evita open redirect). */
export function safeNext(next: unknown, fallback = "/dashboard") {
  return typeof next === "string" && next.startsWith("/") && !next.startsWith("//") && !next.startsWith("/\\") ? next : fallback;
}
