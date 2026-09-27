import "server-only";
import { db } from "@/lib/db";
import type { Prisma } from "@/lib/generated/prisma/client";
import { logger } from "@/lib/logger";

/**
 * Resposta de fonte guardada no banco (ProviderCache): a mesma consulta não é paga (nem esperada)
 * duas vezes, nem por outra pessoa. Serve para as consultas de lista inteira (lib/leads/search.ts)
 * e para os pedaços da varredura (quadrantes do Google, viewport da cidade).
 *
 * Fonte fora do ar (o Overpass público vive dando 504): se já houve uma resposta para a mesma
 * consulta, mesmo vencida, ela é usada no lugar do erro — melhor a lista de semanas atrás do que nada.
 */
const KEEP_STALE_MS = 90 * 24 * 60 * 60 * 1000;

export async function cachedProviderCall<T>(key: string, provider: string, ttlMs: number, fn: () => Promise<T>): Promise<T> {
  if (ttlMs <= 0) return fn();
  const hit = await db.providerCache.findUnique({ where: { key } });
  if (hit && hit.expiresAt > new Date()) {
    logger.debug("provider cache hit", { provider, key });
    return hit.payload as unknown as T;
  }
  let value: T;
  try {
    value = await fn();
  } catch (err) {
    if (hit) {
      logger.warn("fonte falhou; usando resposta guardada vencida", { provider, key, err: String(err) });
      return hit.payload as unknown as T;
    }
    throw err;
  }
  const payload = value as unknown as Prisma.InputJsonValue;
  const expiresAt = new Date(Date.now() + ttlMs);
  await db.providerCache.upsert({ where: { key }, create: { key, provider, payload, expiresAt }, update: { payload, expiresAt } });
  // Limpeza preguiçosa (1 em 50 gravações): some o que venceu há muito tempo
  if (Math.random() < 0.02) {
    await db.providerCache.deleteMany({ where: { expiresAt: { lt: new Date(Date.now() - KEEP_STALE_MS) } } }).catch(() => {});
  }
  return value;
}
