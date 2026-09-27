import "server-only";
import { db } from "@/lib/db";
import { env } from "@/lib/env";

/**
 * Trava da cota grátis do Google Maps. Cada requisição de verdade ao Google (cache não conta)
 * reserva uma vaga no contador do mês ANTES de sair. Chegou no limite (GOOGLE_MAPS_MONTHLY_LIMIT,
 * padrão 900 — abaixo das 1.000 grátis do Google), nada mais sai até virar o mês e a busca usa
 * o OpenStreetMap. A reserva é um UPDATE condicional: buscas em paralelo nunca passam do limite.
 */
export const monthKey = (provider: string, now = new Date()) => `${provider}:${now.toISOString().slice(0, 7)}`;

export function googleMonthlyLimit() {
  return env().GOOGLE_MAPS_MONTHLY_LIMIT;
}

/** Reserva uma requisição. false = cota do mês acabou (não chame a API). */
export async function reserveGoogleRequest() {
  const key = monthKey("google");
  const limit = googleMonthlyLimit();
  await db.$executeRaw`INSERT INTO "ApiUsage" ("key", "count", "updatedAt") VALUES (${key}, 0, NOW()) ON CONFLICT ("key") DO NOTHING`;
  const rows = await db.$queryRaw<{ count: number }[]>`
    UPDATE "ApiUsage" SET "count" = "count" + 1, "updatedAt" = NOW()
    WHERE "key" = ${key} AND "count" < ${limit}::int
    RETURNING "count"`;
  return rows.length > 0;
}

/** Quanto já foi usado no mês (tela de Configurações e decisão da fonte). */
export async function googleUsage() {
  const row = await db.apiUsage.findUnique({ where: { key: monthKey("google") }, select: { count: true } });
  const used = row?.count ?? 0;
  const limit = googleMonthlyLimit();
  return { used, limit, left: Math.max(0, limit - used) };
}
