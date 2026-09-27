import "server-only";
import { isAIEnabled } from "@/lib/ai";
import { generateOutreachAI } from "@/lib/ai/tasks";
import { db } from "@/lib/db";
import type { OutreachVariant } from "@/lib/generated/prisma/client";
import { logEvent } from "@/lib/leads/events";
import { logger } from "@/lib/logger";
import { generateOutreach } from "@/lib/outreach/generate";

const VARIANTS: OutreachVariant[] = ["SHORT", "PROFESSIONAL", "CONVERSATIONAL"];

export const DEMO_USER_NAME = "Conta demonstração";

export function senderNameFor(user: { name: string; isDemo: boolean }) {
  // Enquanto a conta demo não tiver nome real, a mensagem sai sem "Meu nome é…".
  return user.isDemo && user.name === DEMO_USER_NAME ? null : user.name;
}

/**
 * Gera as 3 variantes. Reutiliza as existentes (cache) a menos que `force`.
 * Com IA configurada e `useAI`, usa o modelo (cacheado); senão, templates determinísticos.
 */
export async function generateOutreachForLead(
  user: { id: string; name: string; isDemo: boolean; agencyName: string | null },
  leadId: string,
  opts: { useAI?: boolean; force?: boolean } = {},
) {
  const lead = await db.lead.findFirst({
    where: { id: leadId, userId: user.id },
    include: { _count: { select: { prototypes: true } }, outreaches: true },
  });
  if (!lead) throw new Error("Lead não encontrado.");

  if (!opts.force && lead.outreaches.length === VARIANTS.length) {
    return { rows: lead.outreaches, reused: true };
  }

  const hasPrototype = lead._count.prototypes > 0;
  let messages: Record<OutreachVariant, string> | null = null;
  let source: "AI" | "TEMPLATE" = "TEMPLATE";

  if (opts.useAI && (await isAIEnabled(user.id))) {
    try {
      const ai = await generateOutreachAI(lead, { senderName: senderNameFor(user), hasPrototype, force: opts.force, userId: user.id });
      messages = { SHORT: ai.SHORT, PROFESSIONAL: ai.PROFESSIONAL, CONVERSATIONAL: ai.CONVERSATIONAL };
      source = "AI";
    } catch (err) {
      logger.warn("IA indisponível para abordagem; usando template", { err });
    }
  }
  if (!messages) {
    messages = generateOutreach({
      // `force` sem IA = nova variação determinística das frases
      seed: opts.force ? `${lead.id}:${Date.now()}` : lead.id,
      name: lead.name,
      category: lead.category,
      city: lead.city,
      instagram: lead.instagram,
      website: lead.website,
      rating: lead.rating,
      reviewCount: lead.reviewCount,
      services: lead.services,
      senderName: senderNameFor(user),
      agencyName: user.agencyName,
      hasPrototype,
    });
  }

  const rows = await db.$transaction(
    VARIANTS.map((variant) =>
      db.outreach.upsert({
        where: { leadId_variant: { leadId, variant } },
        create: { leadId, userId: user.id, variant, content: messages![variant], source },
        update: { content: messages![variant], source },
      }),
    ),
  );
  await logEvent(user.id, leadId, "OUTREACH_GENERATED", { source });
  return { rows, reused: false };
}
