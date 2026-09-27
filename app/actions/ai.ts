"use server";

import { refresh } from "next/cache";
import { z } from "zod";
import { action, idSchema, UserFacingError } from "@/lib/action";
import { connectAi } from "@/lib/ai/connections";
import { generateCoverImage } from "@/lib/ai/images";
import { generateCopyAI, personalizeTemplate } from "@/lib/ai/tasks";
import { AIUnavailableError } from "@/lib/ai/types";
import { db } from "@/lib/db";
import type { Prisma } from "@/lib/generated/prisma/client";
import { parseSpec } from "@/lib/prototypes/service";

export const connectAiAction = action(
  {
    schema: z.object({
      provider: z.string().min(2).max(30),
      apiKey: z.string().max(400),
      model: z.string().max(80).optional(),
      imageModel: z.string().max(80).optional(),
    }),
    limit: "ai",
    name: "connectAi",
  },
  async (input, user) => {
    await connectAi(user.id, input);
    refresh();
    return { ok: true };
  },
);

export const disconnectAiAction = action({ schema: z.object({ provider: z.string().max(30) }), name: "disconnectAi" }, async ({ provider }, user) => {
  await db.aIConnection.deleteMany({ where: { userId: user.id, provider } });
  if (user.aiDefault === provider) {
    const next = await db.aIConnection.findFirst({ where: { userId: user.id, status: "ACTIVE" }, select: { provider: true } });
    await db.user.update({ where: { id: user.id }, data: { aiDefault: next?.provider ?? null } });
  }
  refresh();
  return { ok: true };
});

export const setDefaultAiAction = action({ schema: z.object({ provider: z.string().max(30) }), name: "setDefaultAi" }, async ({ provider }, user) => {
  const conn = await db.aIConnection.findUnique({ where: { userId_provider: { userId: user.id, provider } } });
  if (!conn) throw new UserFacingError("Conecte essa IA primeiro.");
  await db.user.update({ where: { id: user.id }, data: { aiDefault: provider } });
  refresh();
  return { ok: true };
});

/** Reescreve os TEXTOS do protótipo com a IA escolhida, mantendo estrutura, cores e fotos. */
export const aiRewriteSite = action(
  { schema: z.object({ id: idSchema, provider: z.string().max(30).nullable().optional() }), limit: "ai", name: "aiRewriteSite" },
  async ({ id, provider }, user) => {
    const proto = await db.prototype.findFirst({ where: { id, userId: user.id }, include: { lead: true } });
    if (!proto) throw new UserFacingError("Protótipo não encontrado.");
    try {
      const copy = await generateCopyAI(proto.lead, { force: true, userId: user.id, provider: provider ?? user.aiDefault });
      const spec = personalizeTemplate(parseSpec(proto.spec), copy);
      await db.prototype.update({ where: { id }, data: { spec: spec as unknown as Prisma.InputJsonValue } });
      return { spec };
    } catch (err) {
      if (err instanceof AIUnavailableError) throw new UserFacingError(err.message);
      throw err;
    }
  },
);

/** Gera uma imagem de capa (Nano Banana / GPT Image) com a chave do usuário. */
export const aiCoverImage = action(
  { schema: z.object({ id: idSchema, style: z.string().max(120).optional(), provider: z.enum(["gemini", "openai"]).optional() }), limit: "ai", name: "aiCoverImage" },
  async ({ id, style, provider }, user) => {
    const proto = await db.prototype.findFirst({ where: { id, userId: user.id }, select: { lead: { select: { category: true, city: true } } } });
    if (!proto) throw new UserFacingError("Protótipo não encontrado.");
    return generateCoverImage(user.id, { category: proto.lead.category, city: proto.lead.city, style, provider });
  },
);
