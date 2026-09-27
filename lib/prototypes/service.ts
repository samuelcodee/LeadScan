import "server-only";
import { headers } from "next/headers";
import { isAIEnabled } from "@/lib/ai";
import { generateCopyAI, personalizeTemplate } from "@/lib/ai/tasks";
import { db } from "@/lib/db";
import type { TemplateId } from "@/lib/domain/categories";
import { slugify } from "@/lib/format";
import type { Lead, Prisma } from "@/lib/generated/prisma/client";
import { randomSlug } from "@/lib/hash";
import { parsePhotos, photoUrl } from "@/lib/providers/photos";
import { logEvent } from "@/lib/leads/events";
import { logger } from "@/lib/logger";
import { buildSiteSpec, type LeadForSite } from "@/lib/templates/build";
import { siteSpecSchema, type SiteSpec } from "@/lib/templates/types";

export function leadToSite(lead: Lead): LeadForSite {
  return {
    id: lead.id,
    name: lead.name,
    category: lead.category,
    city: lead.city,
    state: lead.state,
    neighborhood: lead.neighborhood,
    address: lead.address,
    phone: lead.phone,
    whatsapp: lead.whatsapp,
    instagram: lead.instagram,
    facebook: lead.facebook,
    openingHours: lead.openingHours,
    rating: lead.rating,
    reviewCount: lead.reviewCount,
    mapsUrl: lead.mapsUrl,
    services: lead.services,
    isDemo: lead.isDemo,
    ...leadPhotos(lead),
  };
}

/** Fotos reais do lead (Google Places) → URLs do proxy assinado + créditos dos autores. */
export function leadPhotos(lead: Pick<Lead, "photos">) {
  const refs = parsePhotos(lead.photos);
  return {
    photos: refs.map((p) => photoUrl(p.ref)),
    photoCredits: [...new Set(refs.flatMap((p) => p.credits ?? []))],
  };
}

export function parseSpec(json: unknown): SiteSpec {
  return siteSpecSchema.parse(json);
}

/**
 * URL base pública. Em produção defina NEXT_PUBLIC_APP_URL; sem ela, usa o host
 * da requisição atual (útil em dev, quando a porta muda).
 */
export async function appUrl() {
  const fromEnv = process.env.NEXT_PUBLIC_APP_URL;
  if (fromEnv) return fromEnv.replace(/\/$/, "");
  try {
    const h = await headers();
    const host = h.get("x-forwarded-host") ?? h.get("host");
    if (host) return `${h.get("x-forwarded-proto") ?? "http"}://${host}`;
  } catch {
    // fora de uma requisição (ex.: seed via CLI)
  }
  return "http://localhost:3000";
}

export async function proposalUrl(slug: string) {
  return `${await appUrl()}/proposta/${slug}`;
}

async function getOwnedLead(userId: string, leadId: string) {
  const lead = await db.lead.findFirst({ where: { id: leadId, userId } });
  if (!lead) throw new Error("Lead não encontrado.");
  return lead;
}

/**
 * Cria um protótipo: template + dados reais (zero tokens).
 * Com IA configurada e `useAI`, só os TEXTOS são personalizados (resultado em cache).
 */
export async function createPrototype(userId: string, leadId: string, opts: { templateId?: TemplateId; useAI?: boolean; aiProvider?: string | null } = {}) {
  const lead = await getOwnedLead(userId, leadId);
  const count = await db.prototype.count({ where: { leadId, userId } });
  let spec = buildSiteSpec(leadToSite(lead), { templateId: opts.templateId, variant: count });
  let usedAI = false;
  if (opts.useAI && (await isAIEnabled(userId))) {
    try {
      spec = personalizeTemplate(spec, await generateCopyAI(lead, { userId, provider: opts.aiProvider }));
      usedAI = true;
    } catch (err) {
      logger.warn("IA indisponível para copy; usando template", { err });
    }
  }
  const version = count + 1;
  const prototype = await db.prototype.create({
    data: {
      userId,
      leadId,
      name: `Protótipo ${String(version).padStart(2, "0")}`,
      version,
      templateId: spec.templateId,
      spec: spec as unknown as Prisma.InputJsonValue,
    },
  });
  await logEvent(userId, leadId, "PROTOTYPE_CREATED", { prototypeId: prototype.id, version, ai: usedAI });
  return prototype;
}

/** Regenera o conteúdo (nova variação determinística) mantendo o mesmo registro. */
export async function regeneratePrototype(userId: string, prototypeId: string, opts: { templateId?: TemplateId; useAI?: boolean; aiProvider?: string | null } = {}) {
  const proto = await db.prototype.findFirst({ where: { id: prototypeId, userId }, include: { lead: true } });
  if (!proto) throw new Error("Protótipo não encontrado.");
  const current = parseSpec(proto.spec);
  const variant = Math.floor(Math.random() * 1000) + 1;
  let spec = buildSiteSpec(leadToSite(proto.lead), { templateId: opts.templateId ?? (current.templateId as TemplateId), variant });
  if (opts.useAI && (await isAIEnabled(userId))) {
    try {
      spec = personalizeTemplate(spec, await generateCopyAI(proto.lead, { force: true, userId, provider: opts.aiProvider }));
    } catch (err) {
      logger.warn("IA indisponível ao regenerar", { err });
    }
  }
  return db.prototype.update({
    where: { id: proto.id },
    data: { spec: spec as unknown as Prisma.InputJsonValue, templateId: spec.templateId },
  });
}

/** Gera (ou reaproveita) o link público da proposta. */
export async function enableShare(userId: string, prototypeId: string) {
  const proto = await db.prototype.findFirst({ where: { id: prototypeId, userId }, include: { lead: true } });
  if (!proto) throw new Error("Protótipo não encontrado.");
  if (proto.shareSlug && proto.shareEnabled) return proto;
  const slug = proto.shareSlug ?? `${slugify(proto.lead.name).slice(0, 32) || "proposta"}-${randomSlug(8)}`;
  const updated = await db.prototype.update({
    where: { id: proto.id },
    data: { shareSlug: slug, shareEnabled: true, status: "PUBLISHED", publishedAt: proto.publishedAt ?? new Date() },
  });
  await logEvent(userId, proto.leadId, "PROTOTYPE_SHARED", { prototypeId: proto.id });
  return updated;
}
