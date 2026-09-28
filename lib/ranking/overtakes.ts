import "server-only";
import { db } from "@/lib/db";
import { isDemoMode } from "@/lib/env";
import { logger } from "@/lib/logger";
import { leaderboard } from "@/lib/ranking/queries";
import { publish } from "@/lib/realtime";
import { monthPeriod, weekPeriod } from "@/lib/time/periods";

/**
 * Ultrapassagens ao vivo. Depois de uma venda verificada, compara o placar da semana e do mês
 * antes e depois dela: quem subiu recebe "Você passou Fulano e está em 3º", e cada pessoa
 * ultrapassada recebe "Fulano passou você". Só entre quem participa do ranking (opt-in).
 */
export async function announceOvertakes(sellerId: string, salePoints: number, saleCents: number) {
  if (salePoints <= 0) return;
  try {
    for (const [period, range] of [
      ["week", weekPeriod()],
      ["month", monthPeriod()],
    ] as const) {
      const rows = await leaderboard(range, 200);
      const me = rows.find((r) => r.userId === sellerId);
      if (!me) continue;
      const before = { points: me.points - salePoints, revenue: me.revenueCents - saleCents };
      // Estava na frente antes da venda e agora ficou atrás
      const passed = rows.filter((r) => r.position > me.position && (r.points > before.points || (r.points === before.points && r.revenueCents > before.revenue)));
      if (!passed.length) continue;
      await publish({ type: "rank", userId: sellerId, kind: "up", period, position: me.position, other: passed[0].name, count: passed.length });
      for (const p of passed.slice(0, 25)) {
        await publish({ type: "rank", userId: p.userId, kind: "down", period, position: p.position, other: me.name, count: 1 });
      }
    }
  } catch (err) {
    // aviso é enfeite: nunca atrapalha a confirmação do pagamento
    logger.warn("ultrapassagens: falhou", { err: String(err) });
  }
}

/** Últimas vendas pagas pela plataforma (quem participa do ranking): o "agora" da comunidade. */
export async function recentCommunitySales(limit = 8) {
  const demo = isDemoMode();
  return db.sale.findMany({
    where: {
      verified: true,
      refundedAt: null,
      points: { gt: 0 },
      user: { rankingOptIn: true, ...(demo ? {} : { isDemo: false }) },
      ...(demo ? {} : { isTest: false }),
    },
    orderBy: { closedAt: "desc" },
    take: limit,
    select: { id: true, amountCents: true, points: true, closedAt: true, user: { select: { name: true, username: true, avatarId: true, level: true, displayTitle: true } } },
  });
}
export type CommunitySale = Awaited<ReturnType<typeof recentCommunitySales>>[number];
