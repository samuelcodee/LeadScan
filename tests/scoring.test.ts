import { describe, expect, it } from "vitest";
import { scoreLead } from "@/lib/scoring";
import { classifyWebsite } from "@/lib/scoring/website";

describe("scoreLead — exemplos do briefing", () => {
  it("Lead A (sem site, Instagram, WhatsApp, 487 avaliações, 4.8) → ALTO", () => {
    const r = scoreLead({
      category: "clinica-estetica",
      website: null,
      instagram: "studiobella",
      whatsapp: "5585999990000",
      phone: "5585999990000",
      rating: 4.8,
      reviewCount: 487,
      address: "Rua X, 10",
      openingHours: ["Seg–Sex 9h–18h"],
    });
    expect(r.tier).toBe("HIGH");
    expect(r.score).toBeGreaterThanOrEqual(85);
    expect(r.reasons.find((x) => x.key === "site")?.label).toMatch(/Não encontramos site/);
  });

  it("Lead B (site próprio, Instagram, 25 avaliações) → BAIXO/MÉDIO", () => {
    const r = scoreLead({
      category: "restaurante",
      website: "https://restaurantex.com.br",
      instagram: "restx",
      phone: "5585999990001",
      rating: 4.3,
      reviewCount: 25,
    });
    expect(["LOW", "MEDIUM"]).toContain(r.tier);
    expect(r.reasons.some((x) => x.key === "site" && x.kind === "negative")).toBe(true);
  });

  it("Lead C (sem site, sem Instagram, 312 avaliações) → ALTO", () => {
    const r = scoreLead({
      category: "clinica-medica",
      website: null,
      instagram: null,
      phone: "558532345678",
      rating: 4.6,
      reviewCount: 312,
    });
    expect(r.tier).toBe("HIGH");
  });

  it("presença digital madura é penalizada", () => {
    const r = scoreLead({
      category: "dentista",
      website: "https://odonto.com.br",
      instagram: "odonto",
      phone: "5511999990000",
      rating: 4.9,
      reviewCount: 800,
    });
    expect(r.tier).not.toBe("HIGH");
    expect(r.reasons.some((x) => x.key === "mature")).toBe(true);
  });

  it("sem telefone reduz o potencial", () => {
    const a = scoreLead({ category: "barbearia", website: null, phone: "5585999990000" });
    const b = scoreLead({ category: "barbearia", website: null, phone: null });
    expect(a.score).toBeGreaterThan(b.score);
  });

  it("fonte sem avaliações (OSM) não derruba todo mundo para baixo potencial", () => {
    const r = scoreLead({
      category: "dentista",
      website: null,
      instagram: "sorrisobelo",
      phone: "5585999990000",
      reviewCount: null,
      rating: null,
      address: "Rua X, 1",
      openingHours: ["Seg–Sex 8h–18h"],
    });
    expect(r.tier).toBe("HIGH");
    expect(r.reasons.some((x) => x.key === "normalized")).toBe(true);
    const fraco = scoreLead({ category: "loja", website: "https://loja.com.br", reviewCount: null, phone: null });
    expect(fraco.tier).toBe("LOW");
  });

  it("score fica entre 0 e 98", () => {
    const r = scoreLead({ category: "loja", website: "https://x.com.br", instagram: "x", phone: null, rating: 2, reviewCount: 500 });
    expect(r.score).toBeGreaterThanOrEqual(0);
    expect(r.score).toBeLessThanOrEqual(98);
  });
});

describe("classifyWebsite", () => {
  it.each([
    [null, "none"],
    ["", "none"],
    ["instagram.com/studiobella", "social"],
    ["https://linktr.ee/bella", "link-in-bio"],
    ["https://bella.business.site", "discontinued"],
    ["https://bella.wixsite.com/site", "free-builder"],
    ["https://www.bella.com.br", "own"],
  ])("%s → %s", (url, kind) => {
    expect(classifyWebsite(url).kind).toBe(kind);
  });

  it("detecta falta de HTTPS", () => {
    expect(classifyWebsite("http://bella.com.br").https).toBe(false);
  });
});
