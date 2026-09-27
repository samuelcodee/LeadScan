import "server-only";
import { randomInt } from "node:crypto";
import { appHmac, safeEqualStr } from "@/lib/crypto/secrets";
import { db } from "@/lib/db";
import type { AuthChannel } from "@/lib/generated/prisma/client";
import { UserFacingError } from "@/lib/action";

/**
 * Códigos de 6 dígitos (login por e-mail e por celular).
 *  - só o HMAC do código fica no banco
 *  - expira em 10 min, no máximo 5 tentativas, uso único
 *  - no máximo 1 código a cada 45 s e 6 por hora para o mesmo destino
 */
const TTL_MS = 10 * 60 * 1000;
const MAX_ATTEMPTS = 5;
const RESEND_AFTER_MS = 45 * 1000;
const MAX_PER_HOUR = 6;

const hashCode = (channel: AuthChannel, target: string, code: string) => appHmac(`otp:${channel}:${target}:${code}`);

export async function issueCode(channel: AuthChannel, target: string, purpose: "LOGIN" | "LINK" = "LOGIN", userId?: string) {
  const since = new Date(Date.now() - 60 * 60 * 1000);
  const recent = await db.authCode.findMany({
    where: { channel, target, createdAt: { gte: since } },
    orderBy: { createdAt: "desc" },
    select: { createdAt: true },
  });
  if (recent[0] && Date.now() - recent[0].createdAt.getTime() < RESEND_AFTER_MS) {
    const wait = Math.ceil((RESEND_AFTER_MS - (Date.now() - recent[0].createdAt.getTime())) / 1000);
    throw new UserFacingError(`Aguarde ${wait}s para pedir outro código.`);
  }
  if (recent.length >= MAX_PER_HOUR) throw new UserFacingError("Muitos códigos pedidos para este contato. Tente de novo em 1 hora.");

  const code = String(randomInt(0, 1_000_000)).padStart(6, "0");
  // Um código novo invalida os anteriores ainda abertos
  await db.authCode.updateMany({ where: { channel, target, consumedAt: null }, data: { consumedAt: new Date() } });
  await db.authCode.create({
    data: { channel, target, purpose, userId, codeHash: hashCode(channel, target, code), expiresAt: new Date(Date.now() + TTL_MS) },
  });
  return code;
}

export async function consumeCode(channel: AuthChannel, target: string, code: string, purpose: "LOGIN" | "LINK" = "LOGIN") {
  const row = await db.authCode.findFirst({
    where: { channel, target, purpose, consumedAt: null },
    orderBy: { createdAt: "desc" },
  });
  if (!row || row.expiresAt < new Date()) throw new UserFacingError("Código expirado. Peça um novo.");
  if (row.attempts >= MAX_ATTEMPTS) throw new UserFacingError("Muitas tentativas. Peça um novo código.");
  const ok = safeEqualStr(row.codeHash, hashCode(channel, target, code.replace(/\D/g, "")));
  if (!ok) {
    await db.authCode.update({ where: { id: row.id }, data: { attempts: { increment: 1 } } });
    const left = MAX_ATTEMPTS - row.attempts - 1;
    throw new UserFacingError(left > 0 ? `Código incorreto. Restam ${left} tentativa${left > 1 ? "s" : ""}.` : "Código incorreto. Peça um novo.");
  }
  await db.authCode.update({ where: { id: row.id }, data: { consumedAt: new Date() } });
  return row;
}
