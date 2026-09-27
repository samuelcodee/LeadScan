import "server-only";
import { db } from "@/lib/db";
import type { Prisma } from "@/lib/generated/prisma/client";
import { logger } from "@/lib/logger";

/**
 * Resposta de fonte guardada no banco (ProviderCache): a mesma consulta não é paga duas vezes,
 * nem por outra pessoa. Serve para as consultas de lista inteira (lib/leads/search.ts) e para
 * os pedaços da varredura (quadrantes do Google, viewport da cidade).
 */
export async function cachedProviderCall<T>(key: string, provider: string, ttlMs: number, fn: () => Promise<T>): Promise<T> {
  if (ttlMs <= 0) return fn();
  const hit = await db.providerCache.findUnique({ where: { key } });
  if (hit && hit.expiresAt > new Date()) {
    logger.debug("provider cache hit", { provider, key });
    return hit.payload as unknown as T;
  }
  const value = await fn();
  const payload = value as unknown as Prisma.InputJsonValue;
  const expiresAt = new Date(Date.now() + ttlMs);
  await db.providerCache.upsert({ where: { key }, create: { key, provider, payload, expiresAt }, update: { payload, expiresAt } });
  return value;
}
