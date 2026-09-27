import "server-only";
import { db } from "@/lib/db";
import type { LeadStatus, Prisma } from "@/lib/generated/prisma/client";
import type { ScoreReason } from "@/lib/scoring";

/** Campos usados por cards/listas — nada além disso vai para o cliente. */
export const leadListSelect = {
  id: true,
  name: true,
  category: true,
  categoryLabel: true,
  city: true,
  state: true,
  neighborhood: true,
  address: true,
  phone: true,
  whatsapp: true,
  website: true,
  instagram: true,
  facebook: true,
  mapsUrl: true,
  rating: true,
  reviewCount: true,
  openingHours: true,
  description: true,
  services: true,
  score: true,
  scoreTier: true,
  scoreReasons: true,
  status: true,
  saved: true,
  favorite: true,
  isDemo: true,
  provider: true,
  dealValue: true,
  lastContactAt: true,
  createdAt: true,
  updatedAt: true,
  _count: { select: { prototypes: true, outreaches: true } },
} satisfies Prisma.LeadSelect;

type RawListLead = Prisma.LeadGetPayload<{ select: typeof leadListSelect }>;
export type LeadListItem = Omit<RawListLead, "scoreReasons"> & { scoreReasons: ScoreReason[] };

function normalize(l: RawListLead): LeadListItem {
  return { ...l, scoreReasons: (l.scoreReasons as unknown as ScoreReason[]) ?? [] };
}

export async function getSearchResults(userId: string, searchId: string) {
  const search = await db.search.findFirst({ where: { id: searchId, userId } });
  if (!search) return null;
  const leads = search.leadIds.length
    ? await db.lead.findMany({ where: { userId, id: { in: search.leadIds } }, select: leadListSelect })
    : [];
  const order = new Map(search.leadIds.map((id, i) => [id, i]));
  leads.sort((a, b) => (order.get(a.id) ?? 0) - (order.get(b.id) ?? 0));
  return { search, leads: leads.map(normalize) };
}

export async function recentSearches(userId: string, take = 6) {
  return db.search.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
    take,
    select: { id: true, query: true, provider: true, resultCount: true, status: true, createdAt: true },
  });
}

export type LeadListQuery = {
  saved?: boolean;
  favorite?: boolean;
  status?: LeadStatus;
  q?: string;
  sort?: "score" | "recent" | "name";
  page?: number;
  pageSize?: number;
};

export async function listLeads(userId: string, query: LeadListQuery) {
  const pageSize = Math.min(query.pageSize ?? 50, 100);
  const page = Math.max(query.page ?? 1, 1);
  const where: Prisma.LeadWhereInput = {
    userId,
    ...(query.saved !== undefined ? { saved: query.saved } : {}),
    ...(query.favorite ? { favorite: true } : {}),
    ...(query.status ? { status: query.status } : {}),
    ...(query.q
      ? {
          OR: [
            { name: { contains: query.q, mode: "insensitive" } },
            { city: { contains: query.q, mode: "insensitive" } },
            { categoryLabel: { contains: query.q, mode: "insensitive" } },
          ],
        }
      : {}),
  };
  const orderBy: Prisma.LeadOrderByWithRelationInput =
    query.sort === "recent" ? { updatedAt: "desc" } : query.sort === "name" ? { name: "asc" } : { score: "desc" };
  const [total, leads] = await Promise.all([
    db.lead.count({ where }),
    db.lead.findMany({ where, orderBy, select: leadListSelect, skip: (page - 1) * pageSize, take: pageSize }),
  ]);
  return { total, page, pageSize, leads: leads.map(normalize) };
}

export async function getLeadDetail(userId: string, id: string) {
  const lead = await db.lead.findFirst({
    where: { id, userId },
    include: {
      events: { orderBy: { createdAt: "desc" }, take: 50 },
      outreaches: true,
      prototypes: { orderBy: { createdAt: "desc" }, select: { id: true, name: true, version: true, status: true, shareSlug: true, shareEnabled: true, views: true, createdAt: true, updatedAt: true, templateId: true, spec: true } },
    },
  });
  if (!lead) return null;
  return { ...lead, scoreReasons: (lead.scoreReasons as unknown as ScoreReason[]) ?? [] };
}

export type LeadDetail = NonNullable<Awaited<ReturnType<typeof getLeadDetail>>>;

/** Tudo que o painel lateral da busca precisa para um lead (abordagens + último protótipo). */
export async function getLeadWorkbench(userId: string, id: string) {
  const lead = await db.lead.findFirst({
    where: { id, userId },
    select: {
      id: true,
      outreaches: { select: { id: true, variant: true, content: true, source: true, updatedAt: true } },
      prototypes: {
        orderBy: { createdAt: "desc" },
        take: 1,
        select: { id: true, name: true, version: true, shareSlug: true, shareEnabled: true, spec: true, updatedAt: true },
      },
    },
  });
  return lead;
}

export async function quickFind(userId: string, q: string) {
  if (!q.trim()) return [];
  return db.lead.findMany({
    where: {
      userId,
      OR: [{ name: { contains: q, mode: "insensitive" } }, { city: { contains: q, mode: "insensitive" } }],
    },
    orderBy: [{ saved: "desc" }, { score: "desc" }],
    take: 8,
    select: { id: true, name: true, city: true, state: true, categoryLabel: true, score: true, scoreTier: true, saved: true },
  });
}
