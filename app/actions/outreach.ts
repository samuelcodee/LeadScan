"use server";

import { refresh } from "next/cache";
import { z } from "zod";
import { action, idSchema, UserFacingError } from "@/lib/action";
import { db } from "@/lib/db";
import { logEvent } from "@/lib/leads/events";
import { generateOutreachForLead } from "@/lib/outreach/service";

export const generateOutreachAction = action(
  {
    name: "generateOutreach",
    schema: z.object({ leadId: idSchema, useAI: z.boolean().default(false), force: z.boolean().default(false) }),
    limit: "ai",
  },
  async ({ leadId, useAI, force }, user) => {
    const { rows, reused } = await generateOutreachForLead(user, leadId, { useAI, force });
    return {
      reused,
      messages: rows.map((r) => ({ id: r.id, variant: r.variant, content: r.content, source: r.source })),
    };
  },
);

export const updateOutreach = action(
  { name: "updateOutreach", schema: z.object({ id: idSchema, content: z.string().trim().min(1).max(2000) }) },
  async ({ id, content }, user) => {
    const row = await db.outreach.findFirst({ where: { id, userId: user.id }, select: { id: true } });
    if (!row) throw new UserFacingError("Mensagem não encontrada.");
    await db.outreach.update({ where: { id }, data: { content, source: "MANUAL" } });
    return { ok: true };
  },
);

export const markOutreachCopied = action(
  { name: "markOutreachCopied", schema: z.object({ leadId: idSchema, variant: z.string().max(20) }) },
  async ({ leadId, variant }, user) => {
    const lead = await db.lead.findFirst({ where: { id: leadId, userId: user.id }, select: { id: true } });
    if (!lead) throw new UserFacingError("Lead não encontrado.");
    await logEvent(user.id, leadId, "OUTREACH_COPIED", { variant });
    refresh();
    return { ok: true };
  },
);
