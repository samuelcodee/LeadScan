import "server-only";
import { db } from "@/lib/db";
import { OPEN_STAGES } from "@/lib/domain/lead-status";
import type { LeadStatus } from "@/lib/generated/prisma/enums";

const CONTACTED: LeadStatus[] = ["CONTACTED", "REPLIED", "NEGOTIATION", "PROPOSAL", "WON", "NOT_INTERESTED", "LOST"];
const REPLIED: LeadStatus[] = ["REPLIED", "NEGOTIATION", "PROPOSAL", "WON", "NOT_INTERESTED"];
const NEGOTIATING: LeadStatus[] = ["NEGOTIATION", "PROPOSAL", "WON"];
const DAY = 24 * 60 * 60 * 1000;

/**
 * Métricas do dashboard numa consulta só (agregados com FILTER), nada de carregar leads em
 * memória. Antes eram 9 idas ao banco por carga de página — com muita gente abrindo o
 * dashboard ao mesmo tempo, isso é o que pesa.
 */
export async function getDashboardMetrics(userId: string, defaultTicket: number) {
  const weekAgo = new Date(Date.now() - 7 * DAY);
  const [r] = await db.$queryRaw<
    {
      found: bigint;
      saved: bigint;
      qualified: bigint;
      found_week: bigint;
      contacted_week: bigint;
      contacted: bigint;
      replied: bigint;
      negotiating: bigint;
      proposals: bigint;
      won: bigint;
      open_deals: bigint;
      pipeline_value: bigint | null;
      won_value: bigint | null;
      prototypes: bigint;
      published: bigint;
      views: bigint | null;
    }[]
  >`
    WITH l AS (
      SELECT
        COUNT(*) AS found,
        COUNT(*) FILTER (WHERE "saved") AS saved,
        COUNT(*) FILTER (WHERE "scoreTier" = 'HIGH') AS qualified,
        COUNT(*) FILTER (WHERE "createdAt" >= ${weekAgo}) AS found_week,
        COUNT(*) FILTER (WHERE "lastContactAt" >= ${weekAgo}) AS contacted_week,
        COUNT(*) FILTER (WHERE "status"::text = ANY(${CONTACTED})) AS contacted,
        COUNT(*) FILTER (WHERE "status"::text = ANY(${REPLIED})) AS replied,
        COUNT(*) FILTER (WHERE "status"::text = ANY(${NEGOTIATING})) AS negotiating,
        COUNT(*) FILTER (WHERE "status"::text IN ('PROPOSAL', 'WON')) AS proposals,
        COUNT(*) FILTER (WHERE "status" = 'WON') AS won,
        COUNT(*) FILTER (WHERE "status"::text = ANY(${OPEN_STAGES})) AS open_deals,
        SUM(COALESCE("dealValue", ${defaultTicket}::int)) FILTER (WHERE "status"::text = ANY(${OPEN_STAGES})) AS pipeline_value,
        SUM(COALESCE("dealValue", ${defaultTicket}::int)) FILTER (WHERE "status" = 'WON') AS won_value
      FROM "Lead" WHERE "userId" = ${userId}
    ), p AS (
      SELECT COUNT(*) AS prototypes,
             COUNT(*) FILTER (WHERE "shareEnabled") AS published,
             SUM("views") FILTER (WHERE "shareEnabled") AS views
      FROM "Prototype" WHERE "userId" = ${userId}
    )
    SELECT * FROM l, p`;

  const num = (v: bigint | null | undefined) => Number(v ?? 0);
  const found = num(r?.found);
  const saved = num(r?.saved);
  const qualified = num(r?.qualified);
  const contacted = num(r?.contacted);
  const replied = num(r?.replied);
  const negotiating = num(r?.negotiating);
  const proposals = num(r?.proposals);
  const won = num(r?.won);
  const prototypes = num(r?.prototypes);
  const foundWeek = num(r?.found_week);
  const contactedWeek = num(r?.contacted_week);
  const pipelineValue = num(r?.pipeline_value);
  const wonValue = num(r?.won_value);

  return {
    found,
    saved,
    qualified,
    contacted,
    replied,
    negotiating,
    proposals,
    won,
    prototypes,
    publishedProposals: num(r?.published),
    proposalViews: num(r?.views),
    responseRate: contacted ? replied / contacted : 0,
    conversionRate: contacted ? won / contacted : 0,
    pipelineValue,
    openDeals: num(r?.open_deals),
    wonValue,
    foundWeek,
    contactedWeek,
    funnel: [
      { key: "found", label: "Encontrados", value: found },
      { key: "qualified", label: "Alto potencial", value: qualified },
      { key: "contacted", label: "Contatados", value: contacted },
      { key: "replied", label: "Responderam", value: replied },
      { key: "negotiating", label: "Em negociação", value: negotiating },
      { key: "won", label: "Fechados", value: won },
    ],
  };
}

export type DashboardMetrics = Awaited<ReturnType<typeof getDashboardMetrics>>;

export async function recentActivity(userId: string, take = 10) {
  return db.leadEvent.findMany({
    where: { userId, type: { not: "FOUND" } },
    orderBy: { createdAt: "desc" },
    take,
    select: { id: true, type: true, createdAt: true, meta: true, lead: { select: { id: true, name: true } } },
  });
}

/** Melhores leads que ainda não receberam mensagem — a lista de "o que fazer hoje". */
export async function topUncontacted(userId: string, take = 5) {
  return db.lead.findMany({
    where: { userId, status: { in: ["NEW", "INTERESTING"] }, lastContactAt: null },
    orderBy: [{ score: "desc" }, { reviewCount: "desc" }],
    take,
    select: {
      id: true,
      name: true,
      city: true,
      categoryLabel: true,
      score: true,
      scoreTier: true,
      isDemo: true,
      phone: true,
      whatsapp: true,
      _count: { select: { prototypes: true } },
    },
  });
}

export async function viewedProposals(userId: string, take = 4) {
  return db.prototype.findMany({
    where: { userId, shareEnabled: true, views: { gt: 0 } },
    orderBy: { lastViewedAt: "desc" },
    take,
    select: { id: true, name: true, views: true, lastViewedAt: true, lead: { select: { id: true, name: true, status: true } } },
  });
}
