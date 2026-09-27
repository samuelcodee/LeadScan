import "server-only";
import { db } from "@/lib/db";
import { isDemoMode } from "@/lib/env";
import { nextLevelProgress } from "@/lib/gamification/levels";
import { resolveDisplayTitle, salesStats, userTitles } from "@/lib/gamification/service";
import { cachedLeaderboard } from "@/lib/ranking/cached";
import { monthPeriod, weekPeriod } from "@/lib/time/periods";

/**
 * Atividade semanal (últimas N semanas, seg–dom em Brasília) — alimenta os gráficos do perfil.
 *  fechados   = leads que foram para "Fechado"
 *  recusados  = leads que foram para "Sem interesse" ou "Perdido"
 *  buscas / protótipos / abordagens (WhatsApp aberto ou mensagem copiada)
 */
export async function weeklyActivity(userId: string, weeks = 12) {
  const since = weekPeriod(new Date(), -(weeks - 1)).start;
  const wk = (col: string) => `to_char(date_trunc('week', ("${col}" AT TIME ZONE 'UTC') AT TIME ZONE 'America/Sao_Paulo'), 'YYYY-MM-DD')`;
  const [events, searches, prototypes] = await Promise.all([
    db.$queryRawUnsafe<{ bucket: string; won: bigint; refused: bigint; outreach: bigint }[]>(
      `SELECT ${wk("createdAt")} AS bucket,
              COUNT(*) FILTER (WHERE type = 'STATUS_CHANGED' AND meta->>'to' = 'WON') AS won,
              COUNT(*) FILTER (WHERE type = 'STATUS_CHANGED' AND meta->>'to' IN ('NOT_INTERESTED','LOST')) AS refused,
              COUNT(*) FILTER (WHERE type IN ('WHATSAPP_OPENED','OUTREACH_COPIED')) AS outreach
       FROM "LeadEvent" WHERE "userId" = $1 AND "createdAt" >= $2 GROUP BY 1`,
      userId,
      since,
    ),
    db.$queryRawUnsafe<{ bucket: string; n: bigint }[]>(`SELECT ${wk("createdAt")} AS bucket, COUNT(*) AS n FROM "Search" WHERE "userId" = $1 AND "createdAt" >= $2 GROUP BY 1`, userId, since),
    db.$queryRawUnsafe<{ bucket: string; n: bigint }[]>(`SELECT ${wk("createdAt")} AS bucket, COUNT(*) AS n FROM "Prototype" WHERE "userId" = $1 AND "createdAt" >= $2 GROUP BY 1`, userId, since),
  ]);
  const ev = new Map(events.map((e) => [e.bucket, e]));
  const se = new Map(searches.map((e) => [e.bucket, Number(e.n)]));
  const pr = new Map(prototypes.map((e) => [e.bucket, Number(e.n)]));

  const points = [];
  for (let i = weeks - 1; i >= 0; i--) {
    const p = weekPeriod(new Date(), -i);
    const key = p.label.slice(0, 5); // dd/mm do início da semana
    const iso = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo" }).format(p.start);
    const e = ev.get(iso);
    points.push({
      label: key,
      values: {
        won: Number(e?.won ?? 0),
        refused: Number(e?.refused ?? 0),
        outreach: Number(e?.outreach ?? 0),
        searches: se.get(iso) ?? 0,
        prototypes: pr.get(iso) ?? 0,
      },
    });
  }
  return points;
}

export async function activityTotals(userId: string) {
  const [won, refused, searches, prototypes, outreach] = await Promise.all([
    db.lead.count({ where: { userId, status: "WON" } }),
    db.lead.count({ where: { userId, status: { in: ["NOT_INTERESTED", "LOST"] } } }),
    db.search.count({ where: { userId } }),
    db.prototype.count({ where: { userId } }),
    db.leadEvent.count({ where: { userId, type: { in: ["WHATSAPP_OPENED", "OUTREACH_COPIED"] } } }),
  ]);
  return { won, refused, searches, prototypes, outreach };
}

export const PROFILE_SELECT = {
  id: true,
  name: true,
  username: true,
  bio: true,
  instagram: true,
  agencyName: true,
  avatarId: true,
  level: true,
  displayTitle: true,
  profilePublic: true,
  showAccountAge: true,
  rankingOptIn: true,
  isDemo: true,
  createdAt: true,
  lastActiveAt: true,
  presenceVisible: true,
} as const;

/** Monta a página de perfil respeitando a privacidade escolhida pelo dono. */
export async function profileView(username: string, viewerId: string) {
  const user = await db.user.findUnique({ where: { username }, select: PROFILE_SELECT });
  if (!user) return null;
  const isOwner = user.id === viewerId;
  // Conta demo só aparece para outros usuários no modo demonstração
  if (!isOwner && user.isDemo && !isDemoMode()) return null;
  if (!isOwner && !user.profilePublic) return { user, isOwner, closed: true as const };

  const [titles, achievements, stats, weekly, totals, weekRank, monthRank] = await Promise.all([
    userTitles(user.id, user.level),
    db.achievement.findMany({ where: { userId: user.id }, orderBy: { unlockedAt: "desc" }, select: { key: true, unlockedAt: true } }),
    salesStats(user.id),
    weeklyActivity(user.id),
    activityTotals(user.id),
    user.rankingOptIn ? cachedLeaderboard(weekPeriod(), 100) : Promise.resolve([]),
    user.rankingOptIn ? cachedLeaderboard(monthPeriod(), 100) : Promise.resolve([]),
  ]);
  const showMoney = isOwner || user.rankingOptIn;
  return {
    user,
    isOwner,
    closed: false as const,
    title: resolveDisplayTitle(user.displayTitle, user.level, titles),
    titles,
    achievements,
    stats: { sales: stats.sales, revenueCents: showMoney ? stats.revenueCents : null, activeMonths: stats.activeMonths },
    progress: nextLevelProgress(stats),
    weekly,
    totals,
    weekRank: weekRank.find((r) => r.userId === user.id) ?? null,
    monthRank: monthRank.find((r) => r.userId === user.id) ?? null,
  };
}
