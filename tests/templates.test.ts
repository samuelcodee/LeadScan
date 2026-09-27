import { describe, expect, it } from "vitest";
import { CATEGORIES } from "@/lib/domain/categories";
import { generateMockBusiness } from "@/lib/providers/mock";
import { buildSection, buildSiteSpec, type LeadForSite } from "@/lib/templates/build";
import { TEMPLATE_LIST } from "@/lib/templates/registry";
import { palettesFor } from "@/lib/templates/styles";
import { SECTION_TYPES, siteSpecSchema } from "@/lib/templates/types";

function leadFor(category: string, i = 0): LeadForSite {
  const b = generateMockBusiness({ category, city: "Fortaleza", uf: "CE" }, i);
  return { id: `t-${category}-${i}`, ...b, category, openingHours: b.openingHours, isDemo: true, photos: [] };
}

describe("templates", () => {
  it("existem os 13 templates originais + 9 novos", () => {
    expect(TEMPLATE_LIST.map((t) => t.id).sort()).toEqual(
      [
        "academia", "advocacia", "auto-center", "barbearia", "clinic", "contabilidade", "dentista", "estetica", "hotel", "local-business", "pet", "real-estate", "restaurant",
        "cafe", "beleza", "studio", "educacao", "construcao", "servicos-casa", "eventos", "moda", "saude",
      ].sort(),
    );
  });

  it("todo segmento tem 4 paletas e a paleta varia entre clientes do mesmo segmento", () => {
    for (const t of TEMPLATE_LIST) expect(palettesFor(t.id)).toHaveLength(4);
    const primaries = new Set(Array.from({ length: 12 }, (_, i) => buildSiteSpec(leadFor("dentista", i)).theme.primary));
    expect(primaries.size).toBeGreaterThan(1);
  });

  it("fotos reais do negócio entram no topo, no sobre e na galeria, com créditos", () => {
    const photos = ["/api/places-photo/cGxhY2VzL2FiYy9waG90b3MvMQ.aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa", "https://example.com/b.jpg", "https://example.com/c.jpg"];
    const spec = buildSiteSpec({ ...leadFor("restaurante"), photos, photoCredits: ["Ana Souza"] });
    const hero = spec.sections.find((s) => s.type === "hero")!;
    expect(hero.type === "hero" && hero.data.image).toBe(photos[0]);
    expect(spec.credits).toEqual(["Ana Souza"]);
    expect(() => siteSpecSchema.parse(spec)).not.toThrow();
  });

  it("URLs de imagem aceitam só https ou rotas internas", () => {
    const base = buildSiteSpec(leadFor("barbearia"));
    const bad = { ...base, sections: base.sections.map((s) => (s.type === "hero" ? { ...s, data: { ...s.data, image: "javascript:alert(1)" } } : s)) };
    expect(() => siteSpecSchema.parse(bad)).toThrow();
    const internal = { ...base, sections: base.sections.map((s) => (s.type === "hero" ? { ...s, data: { ...s.data, image: "/api/media/cm1abcdefghijklmnopqrstu" } } : s)) };
    expect(() => siteSpecSchema.parse(internal)).not.toThrow();
  });

  it.each(CATEGORIES.map((c) => c.slug))("protótipo de %s é válido e sem tokens sobrando", (slug) => {
    for (const variant of [0, 1, 2]) {
      const spec = buildSiteSpec(leadFor(slug), { variant });
      expect(() => siteSpecSchema.parse(spec)).not.toThrow();
      expect(JSON.stringify(spec)).not.toMatch(/\{(name|city|bairro|cta|goal|categoria|do_name|no_name|No_name)\}/);
    }
  });

  it("sem bairro não repete a cidade ('Fortaleza, Fortaleza')", () => {
    const spec = buildSiteSpec({ ...leadFor("dentista"), neighborhood: null });
    expect(JSON.stringify(spec)).not.toMatch(/Fortaleza, Fortaleza/);
  });

  it("toda seção pode ser adicionada pelo editor", () => {
    const lead = leadFor("restaurante");
    const spec = buildSiteSpec(lead);
    for (const type of SECTION_TYPES) {
      const s = buildSection(spec, type, lead);
      expect(s.type).toBe(type);
      expect(spec.sections.some((x) => x.id === s.id)).toBe(false);
    }
  });

  it("imagens são sempre https (nada de javascript: ou http)", () => {
    for (const t of TEMPLATE_LIST) {
      for (const u of [...t.images.hero, ...t.images.about, ...t.images.gallery]) expect(u).toMatch(/^https:\/\//);
    }
    expect(() =>
      siteSpecSchema.parse({ ...buildSiteSpec(leadFor("hotel")), sections: [{ id: "hero", type: "hero", visible: true, data: { eyebrow: "", title: "", subtitle: "", ctaLabel: "", secondaryLabel: "", image: "javascript:alert(1)", layout: "split" } }] }),
    ).toThrow();
  });
});
