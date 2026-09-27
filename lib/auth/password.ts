import "server-only";
import { randomBytes, scrypt as scryptCb, timingSafeEqual, type ScryptOptions } from "node:crypto";

/**
 * Senhas com scrypt (nativo do Node, sem dependência). Formato guardado:
 *   scrypt$N$r$p$<sal base64url>$<hash base64url>
 * Os parâmetros ficam junto do hash: dá para endurecer depois sem invalidar senhas antigas.
 */
const N = 16384;
const R = 8;
const P = 1;
const KEYLEN = 64;

export const PASSWORD_MIN = 8;
export const PASSWORD_MAX = 128;

function scrypt(password: string, salt: Buffer, keylen: number, opts: ScryptOptions) {
  return new Promise<Buffer>((resolve, reject) => scryptCb(password.normalize("NFKC"), salt, keylen, { ...opts, maxmem: 64 * 1024 * 1024 }, (err, key) => (err ? reject(err) : resolve(key))));
}

export async function hashPassword(password: string) {
  const salt = randomBytes(16);
  const key = await scrypt(password, salt, KEYLEN, { N, r: R, p: P });
  return ["scrypt", N, R, P, salt.toString("base64url"), key.toString("base64url")].join("$");
}

export async function verifyPassword(password: string, stored: string | null | undefined) {
  if (!stored) return false;
  const [algo, n, r, p, salt, hash] = stored.split("$");
  if (algo !== "scrypt" || !salt || !hash) return false;
  const expected = Buffer.from(hash, "base64url");
  const key = await scrypt(password, Buffer.from(salt, "base64url"), expected.length, { N: Number(n), r: Number(r), p: Number(p) });
  return key.length === expected.length && timingSafeEqual(key, expected);
}

/** Hash de mentira para comparar quando a conta não existe: o tempo de resposta não entrega quem tem conta. */
let dummy: Promise<string> | null = null;
export function dummyHash() {
  return (dummy ??= hashPassword(randomBytes(12).toString("hex")));
}

/** Regras simples e explicáveis (sem exigir símbolo — o que protege é o tamanho). */
export function passwordProblem(password: string, identifier?: string) {
  if (password.length < PASSWORD_MIN) return `A senha precisa de pelo menos ${PASSWORD_MIN} caracteres.`;
  if (password.length > PASSWORD_MAX) return "Senha longa demais.";
  if (/^(.)\1+$/.test(password) || /^(?:12345678|123456789|1234567890|senha123|password|qwerty123)$/i.test(password)) return "Essa senha é fácil demais de adivinhar. Tente outra.";
  if (identifier && password.toLowerCase() === identifier.toLowerCase()) return "A senha não pode ser igual ao e-mail ou celular.";
  return null;
}
