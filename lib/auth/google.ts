import "server-only";
import { createHash, randomBytes } from "node:crypto";
import { env } from "@/lib/env";
import type { GoogleProfile } from "@/lib/auth/accounts";

/**
 * "Continuar com Google" — OAuth 2.0 Authorization Code + PKCE + state.
 * Docs: https://developers.google.com/identity/protocols/oauth2/web-server
 * Escopos mínimos: openid email profile (não pedimos nada além disso).
 */
export const googleEnabled = () => Boolean(env().AUTH_GOOGLE_ID && env().AUTH_GOOGLE_SECRET);

export function newPkce() {
  const verifier = randomBytes(32).toString("base64url");
  const challenge = createHash("sha256").update(verifier).digest("base64url");
  return { verifier, challenge, state: randomBytes(16).toString("base64url") };
}

export function googleAuthUrl(opts: { redirectUri: string; state: string; challenge: string }) {
  const params = new URLSearchParams({
    client_id: env().AUTH_GOOGLE_ID,
    redirect_uri: opts.redirectUri,
    response_type: "code",
    scope: "openid email profile",
    state: opts.state,
    code_challenge: opts.challenge,
    code_challenge_method: "S256",
    prompt: "select_account",
  });
  return `https://accounts.google.com/o/oauth2/v2/auth?${params}`;
}

export async function googleExchange(opts: { code: string; verifier: string; redirectUri: string }): Promise<GoogleProfile> {
  const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code: opts.code,
      client_id: env().AUTH_GOOGLE_ID,
      client_secret: env().AUTH_GOOGLE_SECRET,
      redirect_uri: opts.redirectUri,
      grant_type: "authorization_code",
      code_verifier: opts.verifier,
    }),
    signal: AbortSignal.timeout(10_000),
  });
  if (!tokenRes.ok) throw new Error(`Google token ${tokenRes.status}`);
  const token = (await tokenRes.json()) as { access_token?: string };
  if (!token.access_token) throw new Error("Google não devolveu access_token");

  // Token obtido direto do Google (TLS + client_secret): o userinfo é confiável.
  const infoRes = await fetch("https://openidconnect.googleapis.com/v1/userinfo", {
    headers: { Authorization: `Bearer ${token.access_token}` },
    signal: AbortSignal.timeout(10_000),
  });
  if (!infoRes.ok) throw new Error(`Google userinfo ${infoRes.status}`);
  const info = (await infoRes.json()) as { sub: string; email?: string; email_verified?: boolean; name?: string };
  return {
    sub: info.sub,
    email: info.email?.toLowerCase() ?? null,
    emailVerified: info.email_verified === true,
    name: info.name ?? null,
  };
}
