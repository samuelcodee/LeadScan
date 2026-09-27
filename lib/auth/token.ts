/**
 * Token de sessão assinado (HMAC-SHA256 via Web Crypto).
 * Sem dependências de Node: roda no proxy e no servidor.
 * Formato: base64url(userId).versão.expiraEmSegundos.assinatura
 *
 * A versão acompanha User.sessionVersion: "sair de todos os dispositivos" incrementa
 * o número e todo token antigo deixa de valer (checado em getCurrentUser).
 */
export const SESSION_COOKIE = "ls_session";
export const SESSION_TTL_SECONDS = 60 * 60 * 24 * 30;

const encoder = new TextEncoder();

function secret() {
  const s = process.env.AUTH_SECRET;
  if (s && s.length >= 16) return s;
  if (process.env.NODE_ENV === "production") throw new Error("AUTH_SECRET ausente");
  return "leadsite-dev-only-insecure-secret";
}

export function toB64Url(bytes: ArrayBuffer | Uint8Array) {
  const arr = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  let bin = "";
  for (const b of arr) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function fromB64Url(s: string) {
  const bin = atob(s.replace(/-/g, "+").replace(/_/g, "/"));
  return Uint8Array.from(bin, (c) => c.charCodeAt(0));
}

async function hmac(data: string) {
  const key = await crypto.subtle.importKey("raw", encoder.encode(secret()), { name: "HMAC", hash: "SHA-256" }, false, [
    "sign",
  ]);
  return toB64Url(await crypto.subtle.sign("HMAC", key, encoder.encode(data)));
}

export function safeEqual(a: string, b: string) {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

export async function signSession(userId: string, version = 0, ttlSeconds = SESSION_TTL_SECONDS) {
  const exp = Math.floor(Date.now() / 1000) + ttlSeconds;
  const payload = `${toB64Url(encoder.encode(userId))}.${version}.${exp}`;
  return `${payload}.${await hmac(payload)}`;
}

export type SessionClaims = { userId: string; version: number };

export async function verifySession(token: string | undefined | null): Promise<SessionClaims | null> {
  if (!token) return null;
  const parts = token.split(".");
  if (parts.length !== 4) return null;
  const [uid, ver, exp, sig] = parts;
  if (!safeEqual(sig, await hmac(`${uid}.${ver}.${exp}`))) return null;
  if (Number(exp) < Math.floor(Date.now() / 1000)) return null;
  try {
    return { userId: new TextDecoder().decode(fromB64Url(uid)), version: Number(ver) || 0 };
  } catch {
    return null;
  }
}

/** Assina um valor curto (cookies de estado do OAuth, links assinados). */
export async function signValue(value: string) {
  return `${toB64Url(encoder.encode(value))}.${await hmac(`v:${value}`)}`;
}

export async function unsignValue(signed: string | undefined | null): Promise<string | null> {
  if (!signed) return null;
  const [b64, sig] = signed.split(".");
  if (!b64 || !sig) return null;
  try {
    const value = new TextDecoder().decode(fromB64Url(b64));
    return safeEqual(sig, await hmac(`v:${value}`)) ? value : null;
  } catch {
    return null;
  }
}
