import "server-only";
import { db } from "@/lib/db";
import type { LeadEventType, Prisma } from "@/lib/generated/prisma/client";

export async function logEvent(userId: string, leadId: string, type: LeadEventType, meta?: Prisma.InputJsonValue) {
  await db.leadEvent.create({ data: { userId, leadId, type, meta } });
}

export const EVENT_LABEL: Record<LeadEventType, string> = {
  FOUND: "Lead encontrado",
  SAVED: "Salvo nos seus leads",
  UNSAVED: "Removido dos seus leads",
  STATUS_CHANGED: "Etapa alterada",
  NOTE_UPDATED: "Observações atualizadas",
  OUTREACH_GENERATED: "Abordagem criada",
  OUTREACH_COPIED: "Mensagem copiada",
  WHATSAPP_OPENED: "WhatsApp aberto",
  PROTOTYPE_CREATED: "Protótipo criado",
  PROTOTYPE_SHARED: "Link da proposta gerado",
  PROPOSAL_VIEWED: "Cliente abriu a proposta",
  PROPOSAL_CTA_CLICKED: "Cliente clicou em “Quero conversar”",
  PAYMENT_LINK_CREATED: "Link de pagamento criado",
  PAYMENT_RECEIVED: "Pagamento recebido",
  SALE_RECORDED: "Venda registrada",
};
