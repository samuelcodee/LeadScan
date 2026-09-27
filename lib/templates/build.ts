import { getCategory, type TemplateId } from "@/lib/domain/categories";
import { articles } from "@/lib/domain/grammar";
import { getTemplate } from "@/lib/templates/registry";
import { palettesFor } from "@/lib/templates/styles";
import { HERO_LAYOUTS, type Section, type SiteSpec, type SiteTheme } from "@/lib/templates/types";

/**
 * Monta o SiteSpec de um lead — 100% determinístico, instantâneo, zero tokens.
 * Passos: categoria → template → dados reais → identidade visual → textos → pronto para renderizar.
 * `variant` muda a seleção de textos/imagens/layout (botão "Regenerar" sem IA).
 */
export type LeadForSite = {
  id: string;
  name: string;
  category: string;
  city: string;
  state: string;
  neighborhood: string | null;
  address: string | null;
  phone: string | null;
  whatsapp: string | null;
  instagram: string | null;
  facebook: string | null;
  openingHours: string[];
  rating: number | null;
  reviewCount: number | null;
  mapsUrl: string | null;
  services: string[];
  isDemo: boolean;
  /** Fotos reais do negócio já prontas para uso (URLs do proxy assinado). */
  photos?: string[];
  photoCredits?: string[];
};

export type BuildOptions = {
  templateId?: TemplateId;
  variant?: number;
  /** Cor detectada da marca (logo/Instagram). Sobrescreve a do template. */
  brandColor?: string | null;
};

function hash(s: string) {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return h >>> 0;
}

export function fillTokens(text: string, lead: LeadForSite) {
  const cat = getCategory(lead.category);
  const a = articles(lead.name);
  const bairro = lead.neighborhood?.trim();
  let t = text;
  // Sem bairro: "em {bairro}, {city}" vira "em {city}" (e nunca "Fortaleza, Fortaleza").
  if (!bairro) t = t.replace(/\{bairro\},\s*\{city\}/g, "{city}");
  return t
    .replace(/\{do_name\}/g, a.de)
    .replace(/\{no_name\}/g, a.em)
    .replace(/\{No_name\}/g, a.Em)
    .replace(/\{name\}/g, lead.name)
    .replace(/\{city\}/g, lead.city)
    .replace(/\{bairro\}/g, bairro || lead.city)
    .replace(/\{cta\}/g, cat.cta.toLowerCase())
    .replace(/\{goal\}/g, cat.goal)
    .replace(/\{categoria\}/g, cat.label.toLowerCase());
}

function sectionFactory(lead: LeadForSite, tpl: ReturnType<typeof getTemplate>, variant: number) {
  const cat = getCategory(lead.category);
  const seed = hash(`${lead.id}:${variant}`);
  const pick = <T,>(arr: T[], salt = 0) => arr[(seed + salt) % arr.length];
  const f = (s: string) => fillTokens(s, lead);
  const a = articles(lead.name);
  const rotate = <T,>(arr: T[]) => arr.map((_, i) => arr[(i + seed) % arr.length]);

  const services = (lead.services.length ? lead.services : cat.services).slice(0, 6);
  // Fotos reais do negócio têm prioridade sobre o banco de imagens do template
  const real = lead.photos ?? [];
  const heroImg = real[0] ?? pick(tpl.images.hero, 3);
  const aboutImg = real[1] ?? pick(tpl.images.about, 5);
  const galleryImgs = real.length >= 3 ? [...real.slice(2), ...rotate(tpl.images.gallery)].slice(0, 6) : rotate(tpl.images.gallery).slice(0, 6);
  const heroLayout = variant === 0 ? tpl.heroLayout : HERO_LAYOUTS[(HERO_LAYOUTS.indexOf(tpl.heroLayout) + variant) % HERO_LAYOUTS.length];
  const where = [lead.neighborhood, lead.city].filter(Boolean).join(", ");

  const make: Record<Section["type"], () => Section> = {
    hero: () => ({
      id: "hero",
      type: "hero",
      visible: true,
      data: {
        eyebrow: `${cat.label} · ${where}`,
        title: f(pick(tpl.copy.heroTitles, 1)),
        subtitle: f(pick(tpl.copy.heroSubtitles, 2)),
        ctaLabel: cat.cta,
        secondaryLabel: tpl.id === "restaurant" ? "Ver o cardápio" : "Ver serviços",
        image: heroImg,
        layout: heroLayout,
      },
    }),
    about: () => ({
      id: "about",
      type: "about",
      visible: true,
      data: {
        title: `Sobre ${a.o}`,
        body: f(pick(tpl.copy.about, 4)),
        image: aboutImg,
        highlights: tpl.copy.highlights.map(f).slice(0, 4),
      },
    }),
    services: () => ({
      id: "services",
      type: "services",
      visible: true,
      data: {
        title: tpl.copy.servicesTitle,
        subtitle: f(tpl.copy.servicesSubtitle),
        items: services.map((s, i) => ({ title: s, description: f(tpl.copy.serviceBlurbs[(seed + i) % tpl.copy.serviceBlurbs.length]) })),
      },
    }),
    benefits: () => ({
      id: "benefits",
      type: "benefits",
      visible: true,
      data: { title: tpl.copy.benefitsTitle, items: tpl.copy.benefits.map((b) => ({ title: f(b.title), description: f(b.description) })) },
    }),
    gallery: () => ({
      id: "gallery",
      type: "gallery",
      visible: true,
      data: { title: tpl.copy.galleryTitle, images: galleryImgs },
    }),
    testimonials: () => ({
      id: "testimonials",
      type: "testimonials",
      visible: true,
      data: { title: "Quem já passou por aqui", items: tpl.copy.testimonials, illustrative: true },
    }),
    faq: () => ({
      id: "faq",
      type: "faq",
      visible: true,
      data: { title: "Perguntas frequentes", items: tpl.copy.faq.map((q) => ({ question: f(q.question), answer: f(q.answer) })) },
    }),
    location: () => ({
      id: "location",
      type: "location",
      visible: true,
      data: { title: "Onde estamos", note: lead.address ? "" : `Atendimento em ${where}. Peça o endereço completo pelo WhatsApp.` },
    }),
    contact: () => ({
      id: "contact",
      type: "contact",
      visible: true,
      data: { title: "Fale com a gente", subtitle: f(tpl.copy.ctaSubtitle), ctaLabel: "Chamar no WhatsApp" },
    }),
    cta: () => ({
      id: "cta",
      type: "cta",
      visible: true,
      data: { title: f(pick(tpl.copy.ctaTitles, 6)), subtitle: f(tpl.copy.ctaSubtitle), ctaLabel: cat.cta },
    }),
  };

  return make;
}

export function buildSiteSpec(lead: LeadForSite, opts: BuildOptions = {}): SiteSpec {
  const cat = getCategory(lead.category);
  const tpl = getTemplate(opts.templateId ?? cat.template);
  const make = sectionFactory(lead, tpl, opts.variant ?? 0);
  // Cada cliente do mesmo segmento ganha uma paleta (determinística pelo id do lead);
  // "Regenerar" percorre as outras. A cor da marca, quando conhecida, manda.
  const palettes = palettesFor(tpl.id);
  const palette = palettes[(hash(lead.id) + (opts.variant ?? 0)) % palettes.length];
  const theme: SiteTheme = { ...tpl.theme, primary: palette.primary, accent: palette.accent, ...(opts.brandColor ? { primary: opts.brandColor } : {}) };
  const hero = make.hero() as Extract<Section, { type: "hero" }>;

  return {
    v: 1,
    templateId: tpl.id,
    demo: lead.isDemo,
    business: {
      name: lead.name,
      categoryLabel: cat.label,
      city: lead.city,
      state: lead.state,
      neighborhood: lead.neighborhood,
      address: lead.address,
      phone: lead.phone,
      whatsapp: lead.whatsapp,
      instagram: lead.instagram,
      facebook: lead.facebook,
      hours: lead.openingHours.slice(0, 8),
      rating: lead.rating,
      reviewCount: lead.reviewCount,
      mapsUrl: lead.mapsUrl,
    },
    theme,
    sections: tpl.order.map((t) => (t === "hero" ? hero : make[t]())),
    seo: { title: `${lead.name} | ${cat.label} em ${lead.city}`, description: hero.data.subtitle.slice(0, 300) },
    ...(lead.photoCredits?.length ? { credits: lead.photoCredits.slice(0, 12) } : {}),
  };
}

/** Seção nova (botão "Adicionar seção" do editor), já preenchida para o lead. */
export function buildSection(spec: SiteSpec, type: Section["type"], lead: LeadForSite): Section {
  const existing = new Set(spec.sections.map((x) => x.id));
  let id: string = type;
  for (let i = 2; existing.has(id); i++) id = `${type}-${i}`;
  const section = sectionFactory(lead, getTemplate(spec.templateId), existing.size)[type]();
  return { ...section, id } as Section;
}

/** Ordem sugerida de seções para a categoria (determinístico — suggestSections sem IA). */
export function suggestSections(category: string) {
  return getTemplate(getCategory(category).template).order;
}
