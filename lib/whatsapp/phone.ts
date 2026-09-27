/**
 * Telefones brasileiros — normalização determinística (sem IA, sem API).
 */
const VALID_DDD = new Set([
  11, 12, 13, 14, 15, 16, 17, 18, 19, 21, 22, 24, 27, 28, 31, 32, 33, 34, 35, 37, 38, 41, 42, 43, 44, 45, 46, 47, 48, 49,
  51, 53, 54, 55, 61, 62, 63, 64, 65, 66, 67, 68, 69, 71, 73, 74, 75, 77, 79, 81, 82, 83, 84, 85, 86, 87, 88, 89, 91, 92,
  93, 94, 95, 96, 97, 98, 99,
]);

export type BrazilPhone = {
  /** Somente dígitos com DDI: 5585999998888 */
  e164: string;
  ddd: string;
  /** (85) 99999-8888 */
  national: string;
  isMobile: boolean;
};

export function normalizeBrazilPhone(raw: string | null | undefined): BrazilPhone | null {
  if (!raw) return null;
  let d = raw.replace(/\D/g, "");
  if (!d) return null;
  if (d.startsWith("00")) d = d.slice(2);
  // DDI 55 presente (12 ou 13 dígitos)
  if ((d.length === 12 || d.length === 13) && d.startsWith("55")) d = d.slice(2);
  // Prefixo de operadora "0XX" ou "0" de discagem nacional
  if (d.length === 13 && d.startsWith("0")) d = d.slice(3);
  if ((d.length === 11 || d.length === 12) && d.startsWith("0")) d = d.slice(1);
  if (d.length !== 10 && d.length !== 11) return null;

  const ddd = d.slice(0, 2);
  if (!VALID_DDD.has(Number(ddd))) return null;
  const local = d.slice(2);
  const isMobile = local.length === 9 && local.startsWith("9");
  if (local.length === 9 && !isMobile) return null;
  if (local.length === 8 && !/^[2-5]/.test(local)) return null; // fixo começa com 2–5

  const national = isMobile
    ? `(${ddd}) ${local.slice(0, 5)}-${local.slice(5)}`
    : `(${ddd}) ${local.slice(0, 4)}-${local.slice(4)}`;
  return { e164: `55${d}`, ddd, national, isMobile };
}

export function formatPhone(e164OrRaw: string | null | undefined) {
  return normalizeBrazilPhone(e164OrRaw)?.national ?? e164OrRaw ?? null;
}

export type WhatsAppAvailability = "confirmed" | "likely" | "unknown" | "none";

/**
 * Não inventamos WhatsApp: "confirmed" só quando a fonte declara o número;
 * celular sem declaração vira "likely" (provável); fixo vira "unknown".
 */
export function whatsappAvailability(lead: { whatsapp?: string | null; phone?: string | null }): WhatsAppAvailability {
  if (normalizeBrazilPhone(lead.whatsapp)) return "confirmed";
  const phone = normalizeBrazilPhone(lead.phone);
  if (!phone) return "none";
  return phone.isMobile ? "likely" : "unknown";
}

/** Melhor número para abrir conversa (WhatsApp declarado > celular > fixo). */
export function bestWhatsAppNumber(lead: { whatsapp?: string | null; phone?: string | null }) {
  return normalizeBrazilPhone(lead.whatsapp) ?? normalizeBrazilPhone(lead.phone);
}

export const WHATSAPP_AVAILABILITY_LABEL: Record<WhatsAppAvailability, string> = {
  confirmed: "Disponível",
  likely: "Provável (celular)",
  unknown: "Não confirmado (fixo)",
  none: "Não encontrado",
};
