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

function encryptionKey(): Buffer {
  if (key) return key;
  const e = env();
  if (e.ENCRYPTION_KEY) {
    const k = Buffer.from(e.ENCRYPTION_KEY, "base64");
    if (k.length !== 32) throw new Error("ENCRYPTION_KEY precisa ter 32 bytes em base64 (openssl rand -base64 32).");
    return (key = k);
  }
  if (e.NODE_ENV === "production") throw new Error("Defina ENCRYPTION_KEY em produção.");
  const base = e.AUTH_SECRET || "leadsite-dev-only-insecure-secret";
  return (key = Buffer.from(hkdfSync("sha256", base, "leadsite", "secrets-v1", 32)));
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
