import "server-only";
import { db } from "@/lib/db";
import { getCategory } from "@/lib/domain/categories";
import { fold } from "@/lib/format";
import { Prisma } from "@/lib/generated/prisma/client";
import type { ProviderBusiness } from "@/lib/providers/types";
import { SCORE_VERSION, scoreLead } from "@/lib/scoring";
import { normalizeBrazilPhone } from "@/lib/whatsapp/phone";
import { leadDedupeKey } from "@/lib/leads/dedupe";

export { leadDedupeKey } from "@/lib/leads/dedupe";

/** Dados públicos normalizados + score calculado (sem campos de CRM). */
export function toLeadData(b: ProviderBusiness, category: string) {
  const cat = getCategory(category);
  const phone = normalizeBrazilPhone(b.phone)?.e164 ?? null;
  const whatsapp = normalizeBrazilPhone(b.whatsapp)?.e164 ?? null;
  let instagram = b.instagram?.replace(/^@/, "").trim() || null;
  if (!instagram && b.website) {
    const m = b.website.match(/instagram\.com\/([A-Za-z0-9._]+)/i);
    if (m) instagram = m[1];
  }
  const base = {
    name: b.name.trim().slice(0, 120),
    category: cat.slug,
    categoryLabel: cat.label,
    city: b.city,
    state: b.state,
    address: b.address,
    neighborhood: b.neighborhood,
    phone,
    whatsapp,
    website: b.website?.trim() || null,
    instagram,
    facebook: b.facebook,
    mapsUrl: b.mapsUrl,
    rating: b.rating,
    reviewCount: b.reviewCount,
    openingHours: b.openingHours,
    description: b.description,
    services: b.services,
    latitude: b.latitude,
    longitude: b.longitude,
    photos: (b.photos ?? []) as unknown as Prisma.InputJsonValue,
    fetchedAt: new Date(),
  };
  const dedupeKey = leadDedupeKey(base.name, base.city, base.state);
  const s = scoreLead(base);
  return {
    ...base,
    dedupeKey,
    score: s.score,
    scoreTier: s.tier,
    scoreReasons: s.reasons as unknown as Prisma.InputJsonValue,
    scoreVersion: s.version,
  };
}

export function suppressionKeys(b: { externalId: string; name: string; city: string; phone: string | null }) {
  const keys = [{ kind: "external", value: b.externalId }, { kind: "name_city", value: `${fold(b.name)}|${fold(b.city)}` }];
  const phone = normalizeBrazilPhone(b.phone)?.e164;
  if (phone) keys.push({ kind: "phone", value: phone });
  return keys;
}

/**
 * Quando os pesos do score mudam (SCORE_VERSION), recalcula os leads antigos a partir
 * dos dados já salvos — sem nova chamada à fonte. Barato: só roda se houver desatualizados.
 */
const rescored = new Set<string>();

export async function rescoreOutdated(userId: string) {
  // Roda no layout de toda página: depois da primeira checagem do processo, não consulta de novo
  if (rescored.has(userId)) return 0;
  const outdated = await db.lead.findMany({
    where: { userId, scoreVersion: { lt: SCORE_VERSION } },
    take: 500,
    select: {
      id: true,
      category: true,
      website: true,
      instagram: true,
      facebook: true,
      phone: true,
      whatsapp: true,
      rating: true,
      reviewCount: true,
      address: true,
      openingHours: true,
      description: true,
    },
  });
  for (let i = 0; i < outdated.length; i += 25) {
    await db.$transaction(
      outdated.slice(i, i + 25).map((l) => {
        const s = scoreLead(l);
        return db.lead.update({
          where: { id: l.id },
          data: { score: s.score, scoreTier: s.tier, scoreReasons: s.reasons as unknown as Prisma.InputJsonValue, scoreVersion: s.version },
        });
      }),
    );
  }
  if (outdated.length < 500) rescored.add(userId);
  return outdated.length;
}

/**
 * Leads antigos (de antes da chave de duplicidade) ganham a chave aos poucos, sem script.
 * Um UPDATE por lote de 250 (não 250 updates numa transação: estoura o tempo em banco lento).
 */
export async function backfillDedupeKeys(userId: string) {
  const rows = await db.lead.findMany({ where: { userId, dedupeKey: null }, take: 2000, select: { id: true, name: true, city: true, state: true } });
  for (let i = 0; i < rows.length; i += 250) {
    const values = rows.slice(i, i + 250).map((r) => Prisma.sql`(${r.id}, ${leadDedupeKey(r.name, r.city, r.state)})`);
    await db.$executeRaw`UPDATE "Lead" AS l SET "dedupeKey" = v.k FROM (VALUES ${Prisma.join(values)}) AS v(id, k) WHERE l.id = v.id`;
  }
  return rows.length;
}

/**
 * Tira da lista o que o usuário já tem (qualquer busca anterior, qualquer fonte):
 * mesmo id na fonte, mesmo nome na mesma cidade ou, em dados reais, mesmo telefone.
 */
export async function excludeKnown(userId: string, items: ProviderBusiness[], opts: { usePhone: boolean; uniqueNames?: boolean; seen: Set<string> }) {
  if (items.length === 0) return { fresh: items, known: 0 };
  const keyOf = (b: ProviderBusiness) => leadDedupeKey(b.name, b.city, b.state);
  const phoneOf = (b: ProviderBusiness) => (opts.usePhone ? normalizeBrazilPhone(b.phone)?.e164 : undefined);
  const phones = [...new Set(items.map(phoneOf).filter((p): p is string => !!p))];
  const rows = await db.lead.findMany({
    where: {
      userId,
      OR: [
        { externalId: { in: items.map((i) => i.externalId) } },
        { dedupeKey: { in: [...new Set(items.map(keyOf))] } },
        ...(phones.length ? [{ phone: { in: phones } }] : []),
      ],
    },
    select: { externalId: true, dedupeKey: true, phone: true },
  });
  const have = new Set(rows.flatMap((r) => [`x:${r.externalId}`, `k:${r.dedupeKey}`, ...(r.phone ? [`p:${r.phone}`] : [])]));
  let known = 0;
  const fresh = items.filter((b) => {
    const marks = [`x:${b.externalId}`, `k:${keyOf(b)}`];
    const phone = phoneOf(b);
    if (phone) marks.push(`p:${phone}`);
    if (marks.some((m) => have.has(m))) {
      known++;
      return false;
    }
    // Duplicata dentro da própria busca (ex.: a mesma clínica em duas categorias).
    // Na demonstração, nome repetido em outra cidade também sai (parece a mesma empresa).
    if (opts.uniqueNames) marks.push(`n:${keyOf(b).split("|")[0]}`);
    if (marks.some((m) => opts.seen.has(m))) return false;
    for (const m of marks) opts.seen.add(m);
    return true;
  });
  return { fresh, known };
}

/** LGPD: remove empresas que pediram para não ser contatadas. */
export async function filterSuppressed(items: ProviderBusiness[]) {
  if (items.length === 0) return items;
  const keys = items.flatMap(suppressionKeys);
  const blocked = await db.suppression.findMany({
    where: { OR: keys.map((k) => ({ kind: k.kind, value: k.value })) },
    select: { kind: true, value: true },
  });
  if (blocked.length === 0) return items;
  const set = new Set(blocked.map((b) => `${b.kind}:${b.value}`));
  return items.filter((i) => !suppressionKeys(i).some((k) => set.has(`${k.kind}:${k.value}`)));
}

/**
 * Grava/atualiza os leads do usuário em lote (poucas queries, não uma por lead).
 * Campos de CRM (status, notas, favoritos…) nunca são sobrescritos por uma nova busca.
 */
export async function upsertLeads(opts: {
  userId: string;
  provider: string;
  isDemo: boolean;
  category: string;
  items: ProviderBusiness[];
}) {
  const { userId, provider, isDemo, category, items } = opts;
  if (items.length === 0) return [];
  const externalIds = items.map((i) => i.externalId);
  const existing = await db.lead.findMany({
    where: { userId, provider, externalId: { in: externalIds } },
    select: { id: true, externalId: true, fetchedAt: true },
  });
  const existingByExt = new Map(existing.map((e) => [e.externalId, e]));

  const toCreate = items.filter((i) => !existingByExt.has(i.externalId));
  if (toCreate.length) {
    await db.lead.createMany({
      data: toCreate.map((i) => ({ userId, provider, externalId: i.externalId, isDemo, ...toLeadData(i, category) })),
      skipDuplicates: true,
    });
  }

  // Atualiza dados públicos só se estiverem velhos (> 24h) — evita escrita à toa.
  const stale = items.filter((i) => {
    const e = existingByExt.get(i.externalId);
    return e && Date.now() - e.fetchedAt.getTime() > 24 * 60 * 60 * 1000;
  });
  for (let i = 0; i < stale.length; i += 25) {
    await db.$transaction(
      stale.slice(i, i + 25).map((b) =>
        db.lead.update({ where: { id: existingByExt.get(b.externalId)!.id }, data: toLeadData(b, category) }),
      ),
    );
  }

  const rows = await db.lead.findMany({
    where: { userId, provider, externalId: { in: externalIds } },
    select: { id: true, externalId: true, score: true },
  });

  const created = rows.filter((r) => toCreate.some((c) => c.externalId === r.externalId));
  if (created.length) {
    await db.leadEvent.createMany({
      data: created.map((r) => ({ leadId: r.id, userId, type: "FOUND" as const, meta: { provider } })),
    });
  }
  return rows;
}
