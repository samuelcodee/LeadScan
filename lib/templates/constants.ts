/**
 * Constantes do SiteSpec sem dependência de validação (zod). Ficam separadas para o
 * editor no navegador não carregar a biblioteca de schemas inteira (~50 KB a menos).
 */

// Só http(s) — bloqueia javascript:, data: etc. em qualquer campo de URL editável.
// Também aceita as rotas internas de imagem (upload/IA e fotos do Google via proxy assinado).
export const INTERNAL_IMAGE_RE = /^\/api\/(media\/[a-z0-9]{20,40}|places-photo\/[A-Za-z0-9_-]{10,700}\.[A-Za-z0-9_-]{20,60})$/;

export const FONT_PAIRS = ["marcellus", "bricolage", "anton", "playfair", "cormorant", "manrope", "nunito", "sora"] as const;
export type FontPairId = (typeof FONT_PAIRS)[number];

export const HERO_LAYOUTS = ["split", "overlay", "stacked"] as const;
export type HeroLayout = (typeof HERO_LAYOUTS)[number];

export const SECTION_TYPES = ["hero", "about", "services", "benefits", "gallery", "testimonials", "faq", "location", "contact", "cta"] as const;
export type SectionType = (typeof SECTION_TYPES)[number];

export const SECTION_LABEL: Record<SectionType, string> = {
  hero: "Topo (hero)",
  about: "Sobre",
  services: "Serviços",
  benefits: "Diferenciais",
  gallery: "Galeria",
  testimonials: "Depoimentos",
  faq: "Perguntas frequentes",
  location: "Localização",
  contact: "Contato",
  cta: "Chamada para WhatsApp",
};
