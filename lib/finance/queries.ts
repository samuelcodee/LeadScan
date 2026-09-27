import "server-only";
import { db } from "@/lib/db";
import { Prisma } from "@/lib/generated/prisma/client";
import { dayKey, monthPeriod, weekPeriod } from "@/lib/time/periods";

/**
 * Financeiro PRIVADO do usuário (todas as consultas filtram por userId).
 * "Recebido" = vendas pagas pela plataforma; "manual" = registradas à mão.
 */
const LOCAL_TS = Prisma.sql`(s."closedAt" AT TIME ZONE 'UTC') AT TIME ZONE 'America/Sao_Paulo'`;

export async function financeSummary(userId: string) {
  const week = weekPeriod();
  const month = monthPeriod();
  const prevMonth = monthPeriod(new Date(), -1);
  const live = { userId, refundedAt: null };
  const sum = (where: Prisma.SaleWhereInput) => db.sale.aggregate({ where: { ...live, ...where }, _sum: { amountCents: true }, _count: true });

  const [all, platform, monthAgg, prevAgg, weekAgg, pending, fees, byMethod] = await Promise.all([
    sum({}),
    sum({ source: "PLATFORM" }),
    sum({ closedAt: { gte: month.start, lte: month.end } }),
    sum({ closedAt: { gte: prevMonth.start, lte: prevMonth.end } }),
    sum({ closedAt: { gte: week.start, lte: week.end } }),
    db.charge.aggregate({ where: { userId, status: "PENDING" }, _sum: { amountCents: true }, _count: true }),
    db.charge.aggregate({ where: { userId, status: "PAID" }, _sum: { feeCents: true } }),
    db.sale.groupBy({ by: ["method"], where: { ...live }, _sum: { amountCents: true }, _count: true }),
  ]);

  const total = all._sum.amountCents ?? 0;
  return {
    totalCents: total,
    totalSales: all._count,
    platformCents: platform._sum.amountCents ?? 0,
    platformSales: platform._count,
    monthCents: monthAgg._sum.amountCents ?? 0,
    monthSales: monthAgg._count,
    prevMonthCents: prevAgg._sum.amountCents ?? 0,
    weekCents: weekAgg._sum.amountCents ?? 0,
    weekSales: weekAgg._count,
    pendingCents: pending._sum.amountCents ?? 0,
    pendingCount: pending._count,
    feesCents: fees._sum.feeCents ?? 0,
    avgTicketCents: all._count ? Math.round(total / all._count) : 0,
    byMethod: byMethod
      .map((m) => ({ method: m.method ?? "manual", cents: m._sum.amountCents ?? 0, count: m._count }))
      .sort((a, b) => b.cents - a.cents),
    week,
    month,
  };
}

export type RevenueRange = "30d" | "12m";

/** Série de faturamento: por dia (30 dias) ou por mês (12 meses), plataforma × manual. */
export async function revenueSeries(userId: string, range: RevenueRange) {
  const unit = range === "30d" ? "day" : "month";
  const since = range === "30d" ? new Date(Date.now() - 29 * 86400000) : monthPeriod(new Date(), -11).start;
  const fmt = unit === "day" ? "YYYY-MM-DD" : "YYYY-MM";
  const rows = await db.$queryRaw<{ bucket: string; source: string; cents: bigint }[]>`
    SELECT to_char(${LOCAL_TS}, ${fmt}) AS bucket, s.source::text AS source, SUM(s."amountCents") AS cents
    FROM "Sale" s
    WHERE s."userId" = ${userId} AND s."refundedAt" IS NULL AND s."closedAt" >= ${since}
    GROUP BY 1, 2`;
  const map = new Map<string, { platform: number; manual: number }>();
  for (const r of rows) {
    const cur = map.get(r.bucket) ?? { platform: 0, manual: 0 };
    if (r.source === "PLATFORM") cur.platform += Number(r.cents);
    else cur.manual += Number(r.cents);
    map.set(r.bucket, cur);
  }

  const keys: { key: string; label: string }[] = [];
  if (unit === "day") {
    for (let i = 29; i >= 0; i--) {
      const k = dayKey(new Date(Date.now() - i * 86400000));
      keys.push({ key: k, label: `${k.slice(8, 10)}/${k.slice(5, 7)}` });
    }
  } else {
    const names = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];
    for (let i = 11; i >= 0; i--) {
      const p = monthPeriod(new Date(), -i);
      keys.push({ key: p.key, label: `${names[Number(p.key.slice(5, 7)) - 1]}/${p.key.slice(2, 4)}` });
    }
  }
  return keys.map(({ key, label }) => {
    const v = map.get(key) ?? { platform: 0, manual: 0 };
    return { label, values: { platform: v.platform, manual: v.manual, total: v.platform + v.manual } };
  });
}

export async function listCharges(userId: string, take = 30) {
  return db.charge.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
    take,
    select: {
      id: true,
      slug: true,
      description: true,
      amountCents: true,
      status: true,
      provider: true,
      paidMethod: true,
      feeCents: true,
      netCents: true,
      isTest: true,
      paidAt: true,
      createdAt: true,
      lead: { select: { id: true, name: true, whatsapp: true, phone: true, isDemo: true } },
    },
  });
}

export async function listManualSales(userId: string, take = 10) {
  return db.sale.findMany({
    where: { userId, source: "MANUAL", refundedAt: null },
    orderBy: { closedAt: "desc" },
    take,
    select: { id: true, amountCents: true, note: true, closedAt: true, lead: { select: { id: true, name: true } } },
  });
}

/** Leads que fazem sentido cobrar (salvos, em negociação/proposta primeiro). */
export async function chargeableLeads(userId: string) {
  return db.lead.findMany({
    where: { userId, saved: true, status: { notIn: ["NOT_INTERESTED", "LOST"] } },
    orderBy: [{ updatedAt: "desc" }],
    take: 200,
    select: { id: true, name: true, city: true, status: true, dealValue: true, isDemo: true, prototypes: { select: { id: true }, orderBy: { updatedAt: "desc" }, take: 1 } },
  });
}
