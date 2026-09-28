import "server-only";
import { createCipheriv, createDecipheriv, createHash, createHmac, hkdfSync, randomBytes, timingSafeEqual } from "node:crypto";
import { env } from "@/lib/env";

/**
 * Criptografia de segredos guardados no banco (chaves de API dos usuários, tokens
 * OAuth de pagamento). AES-256-GCM com IV aleatório; formato: v1.<iv>.<tag>.<dados> (base64url).
 *
 * A chave vem de ENCRYPTION_KEY (32 bytes em base64). Em desenvolvimento, sem ela,
 * derivamos uma de AUTH_SECRET — em produção ENCRYPTION_KEY é obrigatória.
 */
let key: Buffer | null = null;

/**
 * Aceita a chave em qualquer formato comum, porque quem configura cola o que o gerador deu:
 *  - 32 bytes em base64 / base64url (openssl rand -base64 32) → usada como está (formato original);
 *  - 64 caracteres hex (openssl rand -hex 32) → os 32 bytes;
 *  - qualquer outro texto forte (≥ 16 caracteres) → chave derivada dele (HKDF).
 * Antes, um valor fora do 1º formato derrubava toda gravação criptografada (conectar Mercado
 * Pago, contas bancárias, IAs) — como nunca gravou nada com ele, derivar não perde dado.
 * Sem ENCRYPTION_KEY em produção, deriva de AUTH_SECRET (trocar AUTH_SECRET invalida os segredos).
 */
export function keyFromSetting(raw: string, fallback: string): { key: Buffer; source: "base64" | "hex" | "derivada" | "auth" } {
  const v = raw.trim();
  if (v) {
    if (/^[0-9a-f]{64}$/i.test(v)) return { key: Buffer.from(v, "hex"), source: "hex" };
    if (/^[A-Za-z0-9+/_-]+={0,2}$/.test(v)) {
      const b = Buffer.from(v.replace(/-/g, "+").replace(/_/g, "/"), "base64");
      if (b.length === 32) return { key: b, source: "base64" };
    }
    if (v.length >= 16) return { key: Buffer.from(hkdfSync("sha256", v, "leadsite", "secrets-key-v1", 32)), source: "derivada" };
  }
  return { key: Buffer.from(hkdfSync("sha256", fallback, "leadsite", "secrets-v1", 32)), source: "auth" };
}

function encryptionKey(): Buffer {
  if (key) return key;
  const e = env();
  const fallback = e.AUTH_SECRET || (e.NODE_ENV === "production" ? "" : "leadsite-dev-only-insecure-secret");
  if (!e.ENCRYPTION_KEY.trim() && !fallback) throw new Error("Defina ENCRYPTION_KEY em produção.");
  const k = keyFromSetting(e.ENCRYPTION_KEY, fallback);
  if (e.NODE_ENV === "production" && k.source !== "base64" && k.source !== "hex") {
    console.warn(`[segredos] ENCRYPTION_KEY ${k.source === "auth" ? "ausente: usando chave derivada de AUTH_SECRET" : "fora do formato base64 de 32 bytes: usando chave derivada dela"}`);
  }
  return (key = k.key);
}

export function encryptSecret(plain: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", encryptionKey(), iv);
  const data = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  return ["v1", iv.toString("base64url"), cipher.getAuthTag().toString("base64url"), data.toString("base64url")].join(".");
}

export function decryptSecret(sealed: string): string {
  const [v, iv, tag, data] = sealed.split(".");
  if (v !== "v1" || !iv || !tag || !data) throw new Error("Segredo em formato inválido.");
  const decipher = createDecipheriv("aes-256-gcm", encryptionKey(), Buffer.from(iv, "base64url"));
  decipher.setAuthTag(Buffer.from(tag, "base64url"));
  return Buffer.concat([decipher.update(Buffer.from(data, "base64url")), decipher.final()]).toString("utf8");
}

/** Últimos 4 caracteres, para mostrar "••••abcd" sem nunca devolver a chave. */
export function last4(secret: string) {
  return secret.trim().slice(-4);
}

/** HMAC com o segredo da aplicação (códigos de login, URLs assinadas). */
export function appHmac(data: string) {
  const secret = env().AUTH_SECRET || "leadsite-dev-only-insecure-secret";
  return createHmac("sha256", secret).update(data).digest("base64url");
}

export function safeEqualStr(a: string, b: string) {
  const ba = Buffer.from(a);
  const bb = Buffer.from(b);
  return ba.length === bb.length && timingSafeEqual(ba, bb);
}

export function sha256(data: string) {
  return createHash("sha256").update(data).digest("hex");
}
