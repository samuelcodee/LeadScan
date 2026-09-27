import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { fold } from "@/lib/format";
import { logEvent } from "@/lib/leads/events";
import { getPublicProposal } from "@/lib/prototypes/public";
import { rateLimit } from "@/lib/rate-limit";
import { normalizeBrazilPhone } from "@/lib/whatsapp/phone";

const body = z.object({ event: z.enum(["view", "cta", "opt-out"]) });

/**
 * Eventos da página pública (sem login): visualização, clique no CTA e
 * pedido de remoção de dados (LGPD). Limitado por IP.
 */
export async function POST(request: NextRequest, ctx: RouteContext<"/api/public/proposal/[slug]">) {
  const { slug } = await ctx.params;
  const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "local";
  if (!rateLimit("publicView", `${ip}:${slug}`).ok) return NextResponse.json({ ok: false }, { status: 429 });

  const parsed = body.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ ok: false }, { status: 400 });
  const proposal = await getPublicProposal(slug);
  if (!proposal) return NextResponse.json({ ok: false }, { status: 404 });

  if (parsed.data.event === "view") {
    await db.prototype.update({ where: { id: proposal.id }, data: { views: { increment: 1 }, lastViewedAt: new Date() } });
    await logEvent(proposal.userId, proposal.leadId, "PROPOSAL_VIEWED");
  } else if (parsed.data.event === "cta") {
    await logEvent(proposal.userId, proposal.leadId, "PROPOSAL_CTA_CLICKED");
  } else {
    // Opt-out: bloqueia a empresa em buscas futuras (plataforma inteira) e tira a proposta do ar.
    const lead = await db.lead.findUnique({ where: { id: proposal.leadId }, select: { externalId: true, name: true, city: true, phone: true } });
    if (lead) {
      const keys = [
        { kind: "external", value: lead.externalId },
        { kind: "name_city", value: `${fold(lead.name)}|${fold(lead.city)}` },
        ...(normalizeBrazilPhone(lead.phone) ? [{ kind: "phone", value: normalizeBrazilPhone(lead.phone)!.e164 }] : []),
      ];
      await db.suppression.createMany({ data: keys.map((k) => ({ ...k, reason: "Pedido pela página de proposta" })), skipDuplicates: true });
      await db.prototype.updateMany({ where: { leadId: proposal.leadId }, data: { shareEnabled: false } });
      await db.lead.update({ where: { id: proposal.leadId }, data: { status: "NOT_INTERESTED", notes: "Pediu remoção dos dados (LGPD) pela página da proposta." } });
    }
  }
  return NextResponse.json({ ok: true });
}
