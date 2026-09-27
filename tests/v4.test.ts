import { describe, expect, it } from "vitest";
import { facebookUrl, instagramUrl, leadLinks } from "@/lib/leads/links";
import { generateMockBusiness } from "@/lib/providers/mock";
import { buildSiteSpec } from "@/lib/templates/build";
import { previewSpec } from "@/lib/templates/preview";

const base = { isDemo: false, website: null, instagram: null, facebook: null, phone: null, whatsapp: null, mapsUrl: null };

describe("ícones de presença viram links", () => {
  it("Instagram aceita @, nome puro ou URL; recusa lixo", () => {
    expect(instagramUrl("@clinica.bella")).toBe("https://instagram.com/clinica.bella");
    expect(instagramUrl("clinicabella")).toBe("https://instagram.com/clinicabella");
    expect(instagramUrl("https://www.instagram.com/clinicabella/")).toBe("https://www.instagram.com/clinicabella/");
    expect(instagramUrl("javascript:alert(1)")).toBeNull();
    expect(instagramUrl("nome com espaço")).toBeNull();
  });

  it("Facebook monta a URL a partir do nome da página", () => {
    expect(facebookUrl("padaria-sol")).toBe("https://facebook.com/padaria-sol");
    expect(facebookUrl(null)).toBeNull();
  });

  it("lead real: WhatsApp com número e telefone clicável", () => {
    const l = leadLinks({ ...base, phone: "5585988887777", whatsapp: "5585988887777", website: "clinicabella.com.br" });
    expect(l.whatsapp.href).toBe("https://wa.me/5585988887777");
    expect(l.phone.href).toBe("tel:+5585988887777");
    expect(l.site.href).toBe("https://clinicabella.com.br/");
    expect(l.site.own).toBe(true);
  });

  it("lead DEMO: WhatsApp abre sem destinatário e telefone não vira link", () => {
    const l = leadLinks({ ...base, isDemo: true, phone: "5585900001234", whatsapp: "5585900001234", instagram: "espacoatlas" });
    expect(l.whatsapp.href).toBe("https://wa.me/");
    expect(l.phone.href).toBeNull();
    expect(l.instagram.href).toBe("https://instagram.com/espacoatlas");
  });

  it("sem dado, sem link (nada de inventar destino)", () => {
    const l = leadLinks(base);
    expect([l.site.href, l.instagram.href, l.whatsapp.href, l.phone.href, l.maps.href]).toEqual([null, null, null, null, null]);
  });

  it("link de bio abre, mas não conta como site próprio", () => {
    const l = leadLinks({ ...base, website: "https://linktr.ee/barbeariax" });
    expect(l.site.href).toBe("https://linktr.ee/barbeariax");
    expect(l.site.own).toBe(false);
  });
});

describe("miniatura do protótipo", () => {
  const b = generateMockBusiness({ category: "clinica-estetica", city: "Fortaleza", uf: "CE" }, 3);
  const spec = buildSiteSpec({ id: "t", ...b, category: "clinica-estetica", isDemo: true, photos: [] });

  it("leva só as primeiras seções visíveis", () => {
    const p = previewSpec(spec, 2);
    expect(p.sections).toHaveLength(2);
    expect(p.sections.every((s) => s.visible)).toBe(true);
    expect(spec.sections.length).toBeGreaterThan(2); // o original fica intacto
  });

  it("pede fotos menores (Unsplash e Google)", () => {
    const withPhotos = {
      ...spec,
      sections: spec.sections.map((s, i) =>
        i === 0 ? ({ ...s, data: { ...(s as { data: object }).data, image: "https://images.unsplash.com/photo-1?auto=format&fit=crop&w=1600&q=75" } } as typeof s) : s,
      ),
    };
    const json = JSON.stringify(previewSpec(withPhotos, 2, 640));
    expect(json).toContain("w=640");
    expect(json).not.toContain("w=1600");
    const google = JSON.stringify(previewSpec(JSON.parse(JSON.stringify(withPhotos).replace(/https:\/\/images\.unsplash\.com[^"]+/, "/api/places-photo/abc_DEF-1.sig9")), 2, 640));
    expect(google).toContain("/api/places-photo/abc_DEF-1.sig9?w=640");
  });
});
