import { bestWhatsAppNumber } from "@/lib/whatsapp/phone";

/**
 * Links wa.me (oficiais, sem API). Funcionam no celular (app) e no desktop (WhatsApp Web).
 * Para a futura integração com a API oficial do WhatsApp Business, esta é a única
 * função a ser trocada.
 */
export function buildWhatsAppLink(e164: string | null, message?: string) {
  const text = message?.trim() ? `?text=${encodeURIComponent(message.trim())}` : "";
  // Sem número: abre o seletor de contatos do WhatsApp com a mensagem pronta.
  return e164 ? `https://wa.me/${e164}${text}` : `https://wa.me/${text}`;
}

type LeadForLink = { whatsapp?: string | null; phone?: string | null; isDemo?: boolean };

/**
 * Leads DEMO têm telefones fictícios — nunca abrimos conversa com eles
 * (poderiam pertencer a pessoas reais). Nesse caso a mensagem abre sem destinatário.
 */
export function leadWhatsAppLink(lead: LeadForLink, message?: string) {
  if (lead.isDemo) return buildWhatsAppLink(null, message);
  const n = bestWhatsAppNumber(lead);
  return n ? buildWhatsAppLink(n.e164, message) : null;
}
