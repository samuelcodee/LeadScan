import { z } from "zod";
import type { TemplateId } from "@/lib/domain/categories";
import { FONT_PAIRS, HERO_LAYOUTS, INTERNAL_IMAGE_RE, type HeroLayout, type SectionType } from "@/lib/templates/constants";

export { FONT_PAIRS, HERO_LAYOUTS, INTERNAL_IMAGE_RE, SECTION_LABEL, SECTION_TYPES } from "@/lib/templates/constants";
export type { FontPairId, HeroLayout, SectionType } from "@/lib/templates/constants";

/**
 * SiteSpec — o protótipo inteiro é este JSON. O renderer (components/site) só lê isto.
 * Vantagens: editar = mudar campos; versionar = copiar JSON; publicar/exportar no
 * futuro = renderizar o mesmo JSON em outro destino. Nenhum HTML gerado por IA.
 */

const safeUrl = z
  .string()
  .trim()
  .max(900)
  .refine((u) => u === "" || /^https:\/\//i.test(u) || INTERNAL_IMAGE_RE.test(u), "Use um link que comece com https://");

const text = (max: number) => z.string().trim().max(max);

const item = z.object({ title: text(80), description: text(280) });

const sectionBase = { id: z.string().min(1).max(40), visible: z.boolean() };

export const sectionSchema = z.discriminatedUnion("type", [
  z.object({
    ...sectionBase,
    type: z.literal("hero"),
    data: z.object({
      eyebrow: text(80),
      title: text(120),
      subtitle: text(280),
      ctaLabel: text(40),
      secondaryLabel: text(40),
      image: safeUrl,
      layout: z.enum(HERO_LAYOUTS),
    }),
  }),
  z.object({
    ...sectionBase,
    type: z.literal("about"),
    data: z.object({ title: text(100), body: text(900), image: safeUrl, highlights: z.array(text(60)).max(4) }),
  }),
  z.object({
    ...sectionBase,
    type: z.literal("services"),
    data: z.object({ title: text(100), subtitle: text(240), items: z.array(item).max(9) }),
  }),
  z.object({
    ...sectionBase,
    type: z.literal("benefits"),
    data: z.object({ title: text(100), items: z.array(item).max(6) }),
  }),
  z.object({
    ...sectionBase,
    type: z.literal("gallery"),
    data: z.object({ title: text(100), images: z.array(safeUrl).max(8) }),
  }),
  z.object({
    ...sectionBase,
    type: z.literal("testimonials"),
    data: z.object({
      title: text(100),
      items: z.array(z.object({ name: text(40), text: text(300) })).max(6),
      illustrative: z.boolean(),
    }),
  }),
  z.object({
    ...sectionBase,
    type: z.literal("faq"),
    data: z.object({ title: text(100), items: z.array(z.object({ question: text(140), answer: text(500) })).max(8) }),
  }),
  z.object({
    ...sectionBase,
    type: z.literal("location"),
    data: z.object({ title: text(100), note: text(240) }),
  }),
  z.object({
    ...sectionBase,
    type: z.literal("contact"),
    data: z.object({ title: text(100), subtitle: text(240), ctaLabel: text(40) }),
  }),
  z.object({
    ...sectionBase,
    type: z.literal("cta"),
    data: z.object({ title: text(120), subtitle: text(240), ctaLabel: text(40) }),
  }),
]);

export const siteSpecSchema = z.object({
  v: z.literal(1),
  templateId: z.string().max(40),
  demo: z.boolean(),
  business: z.object({
    name: text(120),
    categoryLabel: text(60),
    city: text(60),
    state: text(2),
    neighborhood: text(80).nullable(),
    address: text(200).nullable(),
    phone: text(20).nullable(),
    whatsapp: text(20).nullable(),
    instagram: text(40).nullable(),
    facebook: text(120).nullable(),
    hours: z.array(text(80)).max(8),
    rating: z.number().min(0).max(5).nullable(),
    reviewCount: z.number().int().min(0).nullable(),
    mapsUrl: z.string().max(600).nullable(),
  }),
  theme: z.object({
    primary: z.string().regex(/^#[0-9a-fA-F]{6}$/),
    accent: z.string().regex(/^#[0-9a-fA-F]{6}$/),
    surface: z.enum(["light", "tint", "dark"]),
    font: z.enum(FONT_PAIRS),
    radius: z.enum(["none", "soft", "round"]),
    /** Estilo pronto aplicado (lib/templates/styles.ts) — só para destacar na interface. */
    style: z.string().max(20).optional(),
  }),
  sections: z.array(sectionSchema).min(1).max(16),
  seo: z.object({ title: text(120), description: text(300) }),
  /** Créditos das fotos reais (autores no Google Maps) — exigência da fonte. */
  credits: z.array(text(120)).max(12).optional(),
});

export type SiteSpec = z.infer<typeof siteSpecSchema>;
export type Section = z.infer<typeof sectionSchema>;
export type SectionOf<T extends SectionType> = Extract<Section, { type: T }>;
export type SiteTheme = SiteSpec["theme"];

export type TemplateDefinition = {
  id: TemplateId;
  label: string;
  /** Uma frase sobre a direção visual (aparece no editor). */
  mood: string;
  theme: SiteTheme;
  heroLayout: HeroLayout;
  order: SectionType[];
  images: { hero: string[]; about: string[]; gallery: string[] };
  copy: {
    heroTitles: string[];
    heroSubtitles: string[];
    about: string[];
    highlights: string[];
    servicesTitle: string;
    servicesSubtitle: string;
    serviceBlurbs: string[];
    benefitsTitle: string;
    benefits: { title: string; description: string }[];
    galleryTitle: string;
    testimonials: { name: string; text: string }[];
    faq: { question: string; answer: string }[];
    ctaTitles: string[];
    ctaSubtitle: string;
  };
};

