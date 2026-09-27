import "server-only";
import { cache } from "react";
import { db } from "@/lib/db";
import { parseSpec } from "@/lib/prototypes/service";

/**
 * Leitura pública de uma proposta: só o necessário para a página do cliente.
 * Nada de notas, status, score ou qualquer dado de CRM sai daqui.
 */
export const getPublicProposal = cache(async (slug: string) => {
  if (!/^[a-z0-9-]{6,64}$/.test(slug)) return null;
  const p = await db.prototype.findUnique({
    where: { shareSlug: slug },
    select: {
      id: true,
      shareEnabled: true,
      spec: true,
      updatedAt: true,
      leadId: true,
      userId: true,
      user: { select: { name: true, agencyName: true, whatsapp: true, isDemo: true } },
      // Cobrança em aberto vinculada a esta proposta (vira o botão "Pagar" da página pública)
      charges: { where: { status: "PENDING" }, orderBy: { createdAt: "desc" }, take: 1, select: { slug: true, amountCents: true } },
    },
  });
  if (!p || !p.shareEnabled) return null;
  return {
    id: p.id,
    leadId: p.leadId,
    userId: p.userId,
    spec: parseSpec(p.spec),
    updatedAt: p.updatedAt,
    charge: p.charges[0] ?? null,
    author: {
      name: p.user.isDemo ? null : p.user.name,
      agency: p.user.agencyName,
      whatsapp: p.user.whatsapp,
    },
  };
});
