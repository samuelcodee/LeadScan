import "server-only";
import { revalidateTag, unstable_cache } from "next/cache";
import { logger } from "@/lib/logger";
import { closedPodiums, leaderboard, platformDailyRevenue, platformTotals, type Podium, type RankedUser } from "@/lib/ranking/queries";
import type { Period } from "@/lib/time/periods";

/**
 * Cache compartilhado do placar da comunidade. As consultas são iguais para todo mundo
 * (somam todas as vendas), então com muita gente olhando o ranking o banco calcula uma
 * vez e serve de novo. Tag "community": invalidada em publish() quando entra venda
 * verificada, estorno ou mudança de perfil (os mesmos eventos que atualizam a tela ao vivo).
 * Rede de segurança: expira sozinho em 60 s.
 * O cache guarda JSON: datas voltam como texto e são reconvertidas aqui.
 */
export const COMMUNITY_TAG = "community";
const REVALIDATE = 60;

const reviveUser = (u: RankedUser): RankedUser => ({ ...u, lastSaleAt: new Date(u.lastSaleAt) });
const revivePodium = (p: Podium): Podium => ({ ...p, start: new Date(p.start), winners: p.winners.map(reviveUser) });

export async function cachedLeaderboard(period: Pick<Period, "start" | "end"> | null, limit = 100) {
  const key = period ? [period.start.toISOString(), period.end.toISOString()] : ["all"];
  const run = unstable_cache(() => leaderboard(period, limit), ["leaderboard", ...key, String(limit)], { tags: [COMMUNITY_TAG], revalidate: REVALIDATE });
  return (await run()).map(reviveUser);
}

export async function cachedClosedPodiums(unit: "week" | "month", opts: { userId?: string; limitPeriods?: number } = {}) {
  const run = unstable_cache(() => closedPodiums(unit, opts), ["podiums", unit, opts.userId ?? "-", String(opts.limitPeriods ?? 0)], {
    tags: [COMMUNITY_TAG],
    revalidate: REVALIDATE * 5,
  });
  return (await run()).map(revivePodium);
}

export async function cachedPlatformTotals() {
  const run = unstable_cache(platformTotals, ["platform-totals"], { tags: [COMMUNITY_TAG], revalidate: REVALIDATE });
  const t = await run();
  const revive = (p: Period): Period => ({ ...p, start: new Date(p.start), end: new Date(p.end) });
  return { ...t, week: revive(t.week), month: revive(t.month) };
}

export async function cachedPlatformDailyRevenue(days = 30) {
  const run = unstable_cache(() => platformDailyRevenue(days), ["platform-daily", String(days)], { tags: [COMMUNITY_TAG], revalidate: REVALIDATE });
  return run();
}

/** Chamado por publish() nos eventos da comunidade. Fora de uma requisição (scripts), só ignora. */
export function invalidateCommunity() {
  try {
    revalidateTag(COMMUNITY_TAG, { expire: 0 });
  } catch (err) {
    logger.info("cache da comunidade: invalidação ignorada fora de requisição", { err: String(err) });
  }
}
