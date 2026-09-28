import { describe, expect, it } from "vitest";
import { interleave } from "@/lib/domain/regions";
import { mixTarget, planMix } from "@/lib/leads/mix";
import type { DataProvider } from "@/lib/providers/types";

// Base fictícia: 3 estados, 4 categorias, algumas cidades com empresas
const COUNTS: Record<string, Record<string, number>> = {
  CE: { restaurante: 300, dentista: 40, barbearia: 25 },
  SP: { restaurante: 3000, dentista: 400, academia: 200 },
  RS: { restaurante: 800, barbearia: 90, academia: 60 },
};
const CITIES: Record<string, Record<string, [string, number][]>> = {
  CE: { restaurante: [["Fortaleza", 200], ["Sobral", 60], ["Crato", 40]], dentista: [["Fortaleza", 40]], barbearia: [["Fortaleza", 20], ["Sobral", 5]] },
  SP: { restaurante: [["São Paulo", 2000], ["Campinas", 1000]], dentista: [["São Paulo", 400]], academia: [["São Paulo", 150], ["Santos", 50]] },
  RS: { restaurante: [["Porto Alegre", 600], ["Alvorada", 200]], barbearia: [["Alvorada", 90]], academia: [["Porto Alegre", 60]] },
};
const fake = {
  id: "osm",
  isDemo: false,
  categoryCounts: async () => COUNTS,
  regionCities: async (uf: string | undefined, cats: string[]) =>
    new Map((CITIES[uf!]?.[cats[0]] ?? []).map(([name, n]) => [`${name}|${uf}`, n] as [string, number])),
} as unknown as DataProvider;

const base = { categories: [], cities: [], limit: 50 };

describe("busca variada (sem categoria)", () => {
  it("mistura categorias e estados já na primeira leva", async () => {
    const tasks = await planMix(base, fake, "s1", new Set(), 400);
    const firstRound = tasks.slice(0, 6);
    expect(new Set(firstRound.map((t) => t.category)).size).toBeGreaterThanOrEqual(3);
    expect(new Set(firstRound.map((t) => t.city.uf)).size).toBeGreaterThanOrEqual(3);
    // só combinações que existem na base
    for (const t of tasks) expect(CITIES[t.city.uf][t.category].some(([n]) => n === t.city.name)).toBe(true);
  });

  it("com cidade escolhida, fica nela e usa as categorias que ela tem", async () => {
    const tasks = await planMix({ ...base, cities: [{ name: "Alvorada", uf: "RS" }] }, fake, "s2", new Set(), 400);
    expect(tasks.every((t) => t.city.name === "Alvorada")).toBe(true);
    expect(new Set(tasks.map((t) => t.category))).toEqual(new Set(["restaurante", "barbearia"]));
  });

  it("pula cidade × categoria já varrida até o fim", async () => {
    const tasks = await planMix({ ...base, cities: [{ name: "Alvorada", uf: "RS" }] }, fake, "s3", new Set(["barbearia|Alvorada|RS"]), 400);
    expect(tasks.map((t) => t.category)).toEqual(["restaurante"]);
  });

  it("sorteio muda por busca, mas é o mesmo ao retomar a mesma busca", async () => {
    const a = await planMix(base, fake, "busca-1", new Set(), 400);
    const b = await planMix(base, fake, "busca-1", new Set(), 400);
    expect(a).toEqual(b);
  });

  it("alvo de combinações cresce com a quantidade pedida", () => {
    expect(mixTarget(10)).toBe(5);
    expect(mixTarget(100)).toBe(25);
    expect(mixTarget(500)).toBe(60);
  });

  it("intercala listas um de cada vez", () => {
    expect(interleave([[1, 2, 3], [4], [5, 6]])).toEqual([1, 4, 5, 2, 6, 3]);
  });
});
