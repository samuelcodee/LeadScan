import { describe, expect, it } from "vitest";
import { articles } from "@/lib/domain/grammar";
import { generateOutreach } from "@/lib/outreach/generate";

const base = { seed: "lead-1", name: "Studio Bella", category: "clinica-estetica", city: "Fortaleza", hasPrototype: false };

describe("generateOutreach", () => {
  it("gera as 3 variantes", () => {
    const r = generateOutreach({ ...base, instagram: "studiobella", website: null });
    expect(Object.keys(r)).toEqual(["SHORT", "PROFESSIONAL", "CONVERSATIONAL"]);
    for (const v of Object.values(r)) expect(v.length).toBeGreaterThan(40);
  });

  it("usa a reputação real quando existe", () => {
    const r = generateOutreach({ ...base, website: null, rating: 4.8, reviewCount: 487 });
    expect(r.SHORT).toContain("487 avaliações");
    expect(r.SHORT).toContain("4,8");
  });

  it("não inventa nota nem avaliações quando a fonte não tem", () => {
    const r = generateOutreach({ ...base, website: null, rating: null, reviewCount: null });
    for (const v of Object.values(r)) {
      expect(v).not.toMatch(/avalia/);
      expect(v).not.toMatch(/nota/i);
    }
  });

  it("aponta site desativado do Google (business.site)", () => {
    const r = generateOutreach({ ...base, website: "https://studiobella.business.site" });
    expect(r.SHORT).toMatch(/fora do ar/);
  });

  it("só oferece prévia quando existe protótipo; link só quando pedido", () => {
    const sem = generateOutreach({ ...base, website: null, hasPrototype: false });
    expect(sem.SHORT).not.toMatch(/prévia|rascunho/);
    const com = generateOutreach({ ...base, website: null, hasPrototype: true });
    expect(com.SHORT).toMatch(/prévia|rascunho/);
    expect(com.SHORT).not.toMatch(/https?:\/\//);
    const link = generateOutreach({ ...base, website: null, hasPrototype: true, includeLink: true, prototypeUrl: "https://app.test/proposta/x" });
    expect(link.SHORT).toContain("https://app.test/proposta/x");
  });

  it("sem nome do remetente, não escreve 'Meu nome é'", () => {
    const r = generateOutreach({ ...base, website: null, senderName: null });
    expect(r.PROFESSIONAL).not.toMatch(/Meu nome é|Aqui é/);
  });

  it("varia a redação entre leads diferentes (evita disparo idêntico)", () => {
    const texts = new Set(["a", "b", "c", "d", "e", "f"].map((seed) => generateOutreach({ ...base, seed, website: null }).PROFESSIONAL));
    expect(texts.size).toBeGreaterThan(1);
  });
});

describe("articles", () => {
  it.each([
    ["Studio Bella", "do Studio Bella"],
    ["Clínica Vida", "da Clínica Vida"],
    ["Barbearia Navalha", "da Barbearia Navalha"],
    ["Hotel Brisa", "do Hotel Brisa"],
    ["Bella Napoli", "de Bella Napoli"],
  ])("%s → %s", (name, de) => {
    expect(articles(name).de).toBe(de);
  });
});
