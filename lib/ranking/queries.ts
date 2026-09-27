import "server-only";
import { db } from "@/lib/db";
import { isDemoMode } from "@/lib/env";
import { Prisma } from "@/lib/generated/prisma/client";
import { monthPeriod, weekPeriod, zonedToUtc, type Period } from "@/lib/time/periods";

/**
 * Ranking da comunidade — calculado direto das vendas (sem tabela de placar para
 * dessincronizar). Só entram:
 *  - vendas verificadas (pagas pela plataforma), não estornadas, com pontos (valor mínimo)
 *  - usuários que deram consentimento (rankingOptIn)
 *  - fora do modo demo: nada de pagamento de teste nem conta demo
 *
 * Datas no banco são UTC (timestamp sem fuso); convertemos para Brasília antes de
 * agrupar por semana (segunda a domingo) ou mês.
 */
const LOCAL_TS = Prisma.sql`(s."closedAt" AT TIME ZONE 'UTC') AT TIME ZONE 'America/Sao_Paulo'`;

function baseFilter() {
  const demo = isDemoMode();
  return Prisma.sql`s.verified = true AND s."refundedAt" IS NULL AND s.points > 0 AND u."rankingOptIn" = true
    ${demo ? Prisma.empty : Prisma.sql`AND s."isTest" = false AND u."isDemo" = false`}`;
}

export type RankedUser = {
  userId: string;
  position: number;
  points: number;
  revenueCents: number;
  sales: number;
  lastSaleAt: Date;
  name: string;
  username: string | null;
  avatarId: string | null;
  level: number;
  displayTitle: string | null;
  isDemo: boolean;
};

type RawRow = { userId: string; points: bigint; revenue: bigint; sales: bigint; last: Date };

async function hydrate(rows: RawRow[]): Promise<RankedUser[]> {
  if (!rows.length) return [];
  const users = await db.user.findMany({
    where: { id: { in: rows.map((r) => r.userId) } },
    select: { id: true, name: true, username: true, avatarId: true, level: true, displayTitle: true, isDemo: true },
  });
  const byId = new Map(users.map((u) => [u.id, u]));
  return rows.flatMap((r, i) => {
    const u = byId.get(r.userId);
    if (!u) return [];
    return [
      {
        userId: r.userId,
        position: i + 1,
        points: Number(r.points),
        revenueCents: Number(r.revenue),
        sales: Number(r.sales),
        lastSaleAt: r.last,
        name: u.name,
        username: u.username,
        avatarId: u.avatarId,
        level: u.level,
        displayTitle: u.displayTitle,
        isDemo: u.isDemo,
      },
    ];
  });
}

/** Top N do período (null = desde sempre). Desempate: pontos → faturamento → quem chegou antes. */
export async function leaderboard(period: Pick<Period, "start" | "end"> | null, limit = 100) {
  const range = period ? Prisma.sql`AND s."closedAt" BETWEEN ${period.start} AND ${period.end}` : Prisma.empty;
  const rows = await db.$queryRaw<RawRow[]>`
    SELECT s."userId", SUM(s.points) AS points, SUM(s."amountCents") AS revenue, COUNT(*) AS sales, MAX(s."closedAt") AS last
    FROM "Sale" s JOIN "User" u ON u.id = s."userId"
    WHERE ${baseFilter()} ${range}
    GROUP BY s."userId"
    ORDER BY points DESC, revenue DESC, last ASC
    LIMIT ${limit}`;
  return hydrate(rows);
}

export type Podium = { key: string; start: Date; winners: RankedUser[] };

/**
 * Pódios (top 3) de todas as semanas ou meses JÁ ENCERRADOS, do mais recente para trás.
 * Uma única consulta com ROW_NUMBER() — serve para o mural de campeões e para os títulos.
 */
export async function closedPodiums(unit: "week" | "month", opts: { userId?: string; limitPeriods?: number } = {}) {
  const trunc = unit === "week" ? Prisma.sql`'week'` : Prisma.sql`'month'`;
  const current = unit === "week" ? weekPeriod() : monthPeriod();
  const rows = await db.$queryRaw<(RawRow & { bucket: string; rn: bigint })[]>`
    WITH per AS (
      SELECT s."userId", to_char(date_trunc(${trunc}, ${LOCAL_TS}), 'YYYY-MM-DD') AS bucket,
             SUM(s.points) AS points, SUM(s."amountCents") AS revenue, COUNT(*) AS sales, MAX(s."closedAt") AS last
      FROM "Sale" s JOIN "User" u ON u.id = s."userId"
      WHERE ${baseFilter()} AND s."closedAt" < ${current.start}
      GROUP BY 1, 2
    ), ranked AS (
      SELECT *, ROW_NUMBER() OVER (PARTITION BY bucket ORDER BY points DESC, revenue DESC, last ASC) AS rn FROM per
    )
    SELECT * FROM ranked WHERE rn <= 3 ${opts.userId ? Prisma.sql`AND "userId" = ${opts.userId}` : Prisma.empty}
    ORDER BY bucket DESC, rn ASC
    ${opts.limitPeriods ? Prisma.sql`LIMIT ${opts.limitPeriods * 3}` : Prisma.empty}`;

  const users = await hydrate(rows);
  const byUser = new Map(users.map((u) => [u.userId, u]));
  const groups = new Map<string, Podium>();
  for (const r of rows) {
    // bucket = data local (AAAA-MM-DD) do início da semana/mês em Brasília
    const [y, m, d] = r.bucket.split("-").map(Number);
    const b = zonedToUtc(y, m, d);
    const key = unit === "week" ? r.bucket : r.bucket.slice(0, 7);
    const u = byUser.get(r.userId);
    if (!u) continue;
    const g = groups.get(key) ?? { key, start: b, winners: [] };
    g.winners.push({ ...u, position: Number(r.rn), points: Number(r.points), revenueCents: Number(r.revenue), sales: Number(r.sales) });
    groups.set(key, g);
  }
  return [...groups.values()];
}

/** Totais da plataforma (agregado anônimo: inclui quem não está no ranking). */
export async function platformTotals() {
  const week = weekPeriod();
  const month = monthPeriod();
  const demo = isDemoMode();
  const where = { verified: true, refundedAt: null, ...(demo ? {} : { isTest: false, user: { isDemo: false } }) };
  const [all, w, m, sellers] = await Promise.all([
    db.sale.aggregate({ where, _sum: { amountCents: true }, _count: true }),
    db.sale.aggregate({ where: { ...where, closedAt: { gte: week.start, lte: week.end } }, _sum: { amountCents: true }, _count: true }),
    db.sale.aggregate({ where: { ...where, closedAt: { gte: month.start, lte: month.end } }, _sum: { amountCents: true }, _count: true }),
    db.sale.groupBy({ by: ["userId"], where: { ...where, closedAt: { gte: month.start, lte: month.end } } }),
  ]);
  return {
    totalCents: all._sum.amountCents ?? 0,
    totalSales: all._count,
    weekCents: w._sum.amountCents ?? 0,
    weekSales: w._count,
    monthCents: m._sum.amountCents ?? 0,
    monthSales: m._count,
    activeSellersMonth: sellers.length,
    week,
    month,
  };
}

/** Faturamento diário da plataforma (últimos N dias, Brasília) para o gráfico ao vivo. */
export async function platformDailyRevenue(days = 30) {
  const demo = isDemoMode();
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
  const rows = await db.$queryRaw<{ day: string; revenue: bigint; sales: bigint }[]>`
    SELECT to_char(${LOCAL_TS}, 'YYYY-MM-DD') AS day, SUM(s."amountCents") AS revenue, COUNT(*) AS sales
    FROM "Sale" s JOIN "User" u ON u.id = s."userId"
    WHERE s.verified = true AND s."refundedAt" IS NULL AND s."closedAt" >= ${since}
      ${demo ? Prisma.empty : Prisma.sql`AND s."isTest" = false AND u."isDemo" = false`}
    GROUP BY 1 ORDER BY 1`;
  return rows.map((r) => ({ day: r.day, revenueCents: Number(r.revenue), sales: Number(r.sales) }));
}
