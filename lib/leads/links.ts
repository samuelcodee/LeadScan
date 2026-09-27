import { classifyWebsite, parseUrl, WEBSITE_KIND_LABEL } from "@/lib/scoring/website";
import { leadWhatsAppLink } from "@/lib/whatsapp/link";
import { whatsappAvailability } from "@/lib/whatsapp/phone";

/**
 * Destinos dos ícones de presença (site, Instagram, WhatsApp, Facebook, Google, telefone).
 * Um clique leva direto para o perfil/conversa. Só http(s) — nada de javascript: vindo da fonte.
 * Leads DEMO: Instagram/site abrem normalmente (só leitura); WhatsApp abre sem destinatário
 * e telefone não vira link (o número fictício pode ser de alguém real).
 */
export type LinkLead = {
  isDemo: boolean;
  website: string | null;
  instagram: string | null;
  facebook?: string | null;
  phone: string | null;
  whatsapp: string | null;
  mapsUrl?: string | null;
};

const handle = (v: string) => v.trim().replace(/^@/, "").replace(/\/+$/, "");

export function instagramUrl(v: string | null) {
  if (!v) return null;
  if (/^https?:\/\//i.test(v.trim())) return parseUrl(v)?.toString() ?? null;
  const h = handle(v);
  return /^[\w.]{1,30}$/.test(h) ? `https://instagram.com/${h}` : null;
}

export function facebookUrl(v: string | null | undefined) {
  if (!v) return null;
  if (/^https?:\/\//i.test(v.trim())) return parseUrl(v)?.toString() ?? null;
  const h = handle(v);
  return /^[\w.-]{1,80}$/.test(h) ? `https://facebook.com/${h}` : null;
}

export function leadLinks(l: LinkLead) {
  const site = classifyWebsite(l.website);
  const wa = whatsappAvailability(l);
  const digits = (l.phone ?? "").replace(/\D/g, "");
  return {
    site: {
      href: parseUrl(l.website)?.toString() ?? null,
      /** "tem site próprio" (o ícone fica aceso); link de bio/rede social abre mas fica apagado */
      own: site.kind === "own" || site.kind === "free-builder",
      label: site.kind === "none" ? "Sem site" : site.kind === "own" ? (site.host ?? "Site") : WEBSITE_KIND_LABEL[site.kind],
    },
    instagram: { href: instagramUrl(l.instagram), label: l.instagram ? `@${handle(l.instagram)}` : "Sem Instagram" },
    facebook: { href: facebookUrl(l.facebook) },
    whatsapp: {
      href: wa === "none" ? null : leadWhatsAppLink(l),
      on: wa === "confirmed" || wa === "likely",
      state: wa,
    },
    phone: { href: !l.isDemo && digits.length >= 10 ? `tel:+${digits.startsWith("55") ? digits : `55${digits}`}` : null },
    maps: { href: l.mapsUrl && /^https:\/\//i.test(l.mapsUrl) ? l.mapsUrl : null },
  };
}
