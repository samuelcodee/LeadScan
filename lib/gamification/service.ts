import "server-only";
import { db } from "@/lib/db";
import { env, isDemoMode } from "@/lib/env";
import { Prisma } from "@/lib/generated/prisma/client";
import { getLevel, LEVELS, levelFor, type SalesStats } from "@/lib/gamification/levels";
import { cachedClosedPodiums } from "@/lib/ranking/cached";

/**
 * Vendas que valem para NÍVEL: verificadas, não estornadas e a partir do valor mínimo
 * (RANKING_MIN_SALE_CENTS). Níveis ficam protegidos de cobranças pequenas; o ranking e o
 * faturamento mostrado no perfil contam tudo (verifiedTotals).
 */
export async function salesStats(userId: string): Promise<SalesStats> {
  const demo = isDemoMode();
  const [row] = await db.$queryRaw<{ sales: bigint; revenue: bigint | null; months: bigint }[]>`
    SELECT COUNT(*) AS sales, SUM(s."amountCents") AS revenue,
           COUNT(DISTINCT to_char((s."closedAt" AT TIME ZONE 'UTC') AT TIME ZONE 'America/Sao_Paulo', 'YYYY-MM')) AS months
    FROM "Sale" s
    WHERE s."userId" = ${userId} AND s.verified = true AND s."refundedAt" IS NULL AND s."amountCents" >= ${env().RANKING_MIN_SALE_CENTS}
      ${demo ? Prisma.empty : Prisma.sql`AND s."isTest" = false`}`;
  return { sales: Number(row?.sales ?? 0), revenueCents: Number(row?.revenue ?? 0), activeMonths: Number(row?.months ?? 0) };
}

/** Tudo que foi pago pela plataforma (qualquer valor): o que o perfil mostra em "vendas verificadas". */
export async function verifiedTotals(userId: string): Promise<SalesStats> {
  const demo = isDemoMode();
  const [row] = await db.$queryRaw<{ sales: bigint; revenue: bigint | null; months: bigint }[]>`
    SELECT COUNT(*) AS sales, SUM(s."amountCents") AS revenue,
           COUNT(DISTINCT to_char((s."closedAt" AT TIME ZONE 'UTC') AT TIME ZONE 'America/Sao_Paulo', 'YYYY-MM')) AS months
    FROM "Sale" s
    WHERE s."userId" = ${userId} AND s.verified = true AND s."refundedAt" IS NULL AND s.points > 0
      ${demo ? Prisma.empty : Prisma.sql`AND s."isTest" = false`}`;
  return { sales: Number(row?.sales ?? 0), revenueCents: Number(row?.revenue ?? 0), activeMonths: Number(row?.months ?? 0) };
}

/** Recalcula o nível e registra as conquistas novas (com data). Retorna os níveis ganhos agora. */
export async function recomputeLevel(userId: string) {
  const stats = await salesStats(userId);
  const level = levelFor(stats);
  const user = await db.user.findUnique({ where: { id: userId }, select: { level: true } });
  if (!user) return { level, gained: [] as number[] };
  if (user.level !== level) await db.user.update({ where: { id: userId }, data: { level } });
  const gained: number[] = [];
  if (level > 0) {
    const have = await db.achievement.findMany({ where: { userId, key: { startsWith: "level-" } }, select: { key: true } });
    const haveSet = new Set(have.map((a) => a.key));
    const missing = LEVELS.filter((l) => l.n <= level && !haveSet.has(`level-${l.n}`)).map((l) => l.n);
    if (missing.length) {
      await db.achievement.createMany({ data: missing.map((n) => ({ userId, key: `level-${n}` })), skipDuplicates: true });
      gained.push(...missing);
    }
  }
  return { level, gained, stats };
}

export type Title = { key: string; label: string; detail: string; count?: number };

/** Títulos que o usuário pode exibir ao lado do nome: níveis conquistados + campeonatos. */
export async function userTitles(userId: string, level: number): Promise<Title[]> {
  const [weeks, months] = await Promise.all([cachedClosedPodiums("week", { userId }), cachedClosedPodiums("month", { userId })]);
  const weekWins = weeks.filter((p) => p.winners[0]?.position === 1).length;
  const monthWins = months.filter((p) => p.winners[0]?.position === 1).length;
  const monthPodiums = months.length;
  const titles: Title[] = LEVELS.filter((l) => l.n <= level)
    .reverse()
    .map((l) => ({ key: `level-${l.n}`, label: l.name, detail: `Nível ${l.n}` }));
  if (monthWins) titles.unshift({ key: "month-champion", label: "Campeão do mês", detail: `${monthWins}× primeiro lugar no mês`, count: monthWins });
  if (weekWins) titles.unshift({ key: "week-champion", label: "Campeão da semana", detail: `${weekWins}× primeiro lugar na semana`, count: weekWins });
  if (monthPodiums) titles.push({ key: "month-podium", label: "Pódio do mês", detail: `${monthPodiums}× entre os 3 do mês`, count: monthPodiums });
  return titles;
}

/** Título escolhido pelo usuário, se ainda for válido; senão o nome do nível atual. */
const SPECIAL_TITLES: Record<string, string> = { "week-champion": "Campeão da semana", "month-champion": "Campeão do mês", "month-podium": "Pódio do mês" };

export function resolveDisplayTitle(displayTitle: string | null, level: number, titles?: Title[]) {
  if (displayTitle && titles?.some((t) => t.key === displayTitle)) return titles.find((t) => t.key === displayTitle)!.label;
  // Sem a lista (ex.: menu lateral): confia no título salvo, que só é gravado se tiver sido conquistado
  if (displayTitle && !titles && SPECIAL_TITLES[displayTitle]) return SPECIAL_TITLES[displayTitle];
  if (displayTitle?.startsWith("level-")) {
    const n = Number(displayTitle.slice(6));
    if (n <= level) return getLevel(n)?.name ?? null;
  }
  return getLevel(level)?.name ?? null;
}
