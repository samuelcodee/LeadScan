"use server";

import { refresh } from "next/cache";
import { z } from "zod";
import { action, idSchema, UserFacingError } from "@/lib/action";
import { db } from "@/lib/db";
import type { TemplateId } from "@/lib/domain/categories";
import type { Prisma } from "@/lib/generated/prisma/client";
import { createPrototype, enableShare, leadToSite, parseSpec, proposalUrl, regeneratePrototype } from "@/lib/prototypes/service";
import { buildSection } from "@/lib/templates/build";
import { TEMPLATES } from "@/lib/templates/registry";
import { SECTION_TYPES, siteSpecSchema } from "@/lib/templates/types";

const templateIdSchema = z.enum(Object.keys(TEMPLATES) as [TemplateId, ...TemplateId[]]);

export const createPrototypeAction = action(
  {
    name: "createPrototype",
    schema: z.object({ leadId: idSchema, templateId: templateIdSchema.optional(), useAI: z.boolean().default(false) }),
  },
  async ({ leadId, templateId, useAI }, user) => {
    const p = await createPrototype(user.id, leadId, { templateId, useAI });
    await db.lead.update({ where: { id: leadId }, data: { saved: true } });
    refresh();
    return { id: p.id, name: p.name, spec: p.spec };
  },
);

/** Autosave do editor. O JSON é revalidado inteiro no servidor (URLs, tamanhos, cores). */
export const savePrototypeSpec = action(
  { name: "savePrototypeSpec", schema: z.object({ id: idSchema, spec: siteSpecSchema, name: z.string().trim().min(1).max(80).optional() }) },
  async ({ id, spec, name }, user) => {
    const p = await db.prototype.findFirst({ where: { id, userId: user.id }, select: { id: true } });
    if (!p) throw new UserFacingError("Protótipo não encontrado.");
    const updated = await db.prototype.update({
      where: { id },
      data: { spec: spec as unknown as Prisma.InputJsonValue, templateId: spec.templateId, ...(name ? { name } : {}) },
      select: { updatedAt: true },
    });
    return { savedAt: updated.updatedAt };
  },
);

export const regeneratePrototypeAction = action(
  {
    name: "regeneratePrototype",
    schema: z.object({ id: idSchema, templateId: templateIdSchema.optional(), useAI: z.boolean().default(false) }),
    limit: "ai",
  },
  async ({ id, templateId, useAI }, user) => {
    const p = await regeneratePrototype(user.id, id, { templateId, useAI });
    return { spec: parseSpec(p.spec) };
  },
);

/** Nova versão = cópia do JSON atual (histórico preservado). */
export const duplicatePrototype = action({ name: "duplicatePrototype", schema: z.object({ id: idSchema }) }, async ({ id }, user) => {
  const p = await db.prototype.findFirst({ where: { id, userId: user.id } });
  if (!p) throw new UserFacingError("Protótipo não encontrado.");
  const count = await db.prototype.count({ where: { leadId: p.leadId, userId: user.id } });
  const copy = await db.prototype.create({
    data: {
      userId: user.id,
      leadId: p.leadId,
      name: `Protótipo ${String(count + 1).padStart(2, "0")}`,
      version: count + 1,
      templateId: p.templateId,
      spec: p.spec as Prisma.InputJsonValue,
    },
  });
  refresh();
  return { id: copy.id };
});

export const shareAction = action({ name: "sharePrototype", schema: z.object({ id: idSchema }) }, async ({ id }, user) => {
  const p = await enableShare(user.id, id);
  refresh();
  return { url: await proposalUrl(p.shareSlug!), slug: p.shareSlug! };
});

export const unshareAction = action({ name: "unsharePrototype", schema: z.object({ id: idSchema }) }, async ({ id }, user) => {
  const { count } = await db.prototype.updateMany({ where: { id, userId: user.id }, data: { shareEnabled: false } });
  if (!count) throw new UserFacingError("Protótipo não encontrado.");
  refresh();
  return { ok: true };
});

export const setPrototypeFavorite = action(
  { name: "setPrototypeFavorite", schema: z.object({ id: idSchema, favorite: z.boolean() }) },
  async ({ id, favorite }, user) => {
    // SQL direto: o @updatedAt do Prisma ficaria "agora" e o card diria "editado há 1 min" sem edição
    const count = await db.$executeRaw`UPDATE "Prototype" SET "favorite" = ${favorite} WHERE "id" = ${id} AND "userId" = ${user.id}`;
    if (!count) throw new UserFacingError("Protótipo não encontrado.");
    refresh();
    return { favorite };
  },
);

export const deletePrototypeAction = action({ name: "deletePrototype", schema: z.object({ id: idSchema }) }, async ({ id }, user) => {
  const { count } = await db.prototype.deleteMany({ where: { id, userId: user.id } });
  if (!count) throw new UserFacingError("Protótipo não encontrado.");
  refresh();
  return { ok: true };
});

export const newSectionAction = action(
  { name: "newSection", schema: z.object({ id: idSchema, type: z.enum(SECTION_TYPES), spec: siteSpecSchema }) },
  async ({ id, type, spec }, user) => {
    const p = await db.prototype.findFirst({ where: { id, userId: user.id }, include: { lead: true } });
    if (!p) throw new UserFacingError("Protótipo não encontrado.");
    return { section: buildSection(spec, type, leadToSite(p.lead)) };
  },
);
