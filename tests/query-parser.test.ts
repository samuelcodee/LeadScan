import { describe, expect, it } from "vitest";
import { parseSearchQuery } from "@/lib/domain/query-parser";

describe("parseSearchQuery", () => {
  it("entende a frase completa do briefing", () => {
    const r = parseSearchQuery(
      "Quero encontrar 100 clínicas de estética em Fortaleza que não possuem site, possuem Instagram e WhatsApp e tenham pelo menos 50 avaliações.",
    );
    expect(r.categories).toEqual(["clinica-estetica"]);
    expect(r.city).toEqual({ name: "Fortaleza", uf: "CE" });
    expect(r.limit).toBe(100);
    expect(r.filters).toMatchObject({ website: "without", instagram: "with", whatsapp: "with", minReviews: 50 });
  });

  it("frase curta", () => {
    const r = parseSearchQuery("Clínicas de estética em Fortaleza");
    expect(r.categories).toEqual(["clinica-estetica"]);
    expect(r.city?.name).toBe("Fortaleza");
  });

  it("várias categorias e UF explícita", () => {
    const r = parseSearchQuery("dentistas e barbearias em Recife - PE com nota acima de 4.5");
    expect(r.categories).toEqual(expect.arrayContaining(["dentista", "barbearia"]));
    expect(r.city).toEqual({ name: "Recife", uf: "PE" });
    expect(r.filters.minRating).toBe(4.5);
  });

  it("cidade fora da lista com UF", () => {
    const r = parseSearchQuery("pizzarias em Quixadá - CE");
    expect(r.categories).toEqual(["pizzaria"]);
    expect(r.city).toEqual({ name: "Quixadá", uf: "CE" });
  });

  it("não confunde 'de' com UF", () => {
    const r = parseSearchQuery("escritórios de advocacia em São Paulo");
    expect(r.categories).toEqual(["advocacia"]);
    expect(r.city).toEqual({ name: "São Paulo", uf: "SP" });
  });
});
