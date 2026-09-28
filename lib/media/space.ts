import "server-only";
import { UserFacingError } from "@/lib/action";
import { db } from "@/lib/db";
import { env } from "@/lib/env";
import { logger } from "@/lib/logger";

/**
 * Teto de espaço da plataforma inteira (STORAGE_TOTAL_MB). Fotos, vídeos e áudios ficam no
 * Postgres; no plano grátis da Neon o banco todo tem 0,5 GB e, se lotar, o app inteiro para de
 * gravar (leads, mensagens, vendas). Este teto recusa o envio antes disso, com uma mensagem clara.
 * A soma é cacheada por 30 s por instância; envios em sequência somam por cima do cache.
 */
let cached: { at: number; bytes: number } | null = null;
const TTL = 30_000;

export async function platformMediaBytes() {
  if (cached && Date.now() - cached.at < TTL) return cached.bytes;
  const rows = await db.$queryRaw<{ total: bigint | number | null }[]>`SELECT COALESCE(SUM("size"), 0) AS total FROM "Media"`;
  const bytes = Number(rows[0]?.total ?? 0);
  cached = { at: Date.now(), bytes };
  return bytes;
}

export async function assertPlatformSpace(incoming: number) {
  const limit = env().STORAGE_TOTAL_MB * 1024 * 1024;
  const used = await platformMediaBytes();
  if (used + incoming > limit) {
    logger.warn("espaço de arquivos da plataforma no limite", { used, incoming, limit });
    throw new UserFacingError("O espaço de arquivos da plataforma está cheio no momento. Tente um arquivo menor ou apague arquivos antigos em Arquivos.");
  }
  if (cached) cached.bytes += incoming;
}
