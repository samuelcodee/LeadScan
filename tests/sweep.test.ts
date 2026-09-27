import { describe, expect, it, vi } from "vitest";
import { advanceGrid, cellRect, currentCell, isGridCursor, startGrid, type GridCursor, type Rect } from "@/lib/providers/grid";
import { regionCities, regionOrder } from "@/lib/domain/regions";
import { citiesOfState } from "@/lib/domain/municipalities";

vi.mock("server-only", () => ({}));
// módulos de fonte importam o banco (cache); nada aqui chega a conectar
process.env.DATABASE_URL ??= "postgres://teste";

const FORTALEZA: Rect = { s: -3.89, w: -38.64, n: -3.69, e: -38.4 };

describe("grade de quadrantes (varredura do Google)", () => {
  it("cada dígito escolhe um quarto do retângulo", () => {
    expect(cellRect(FORTALEZA, "")).toEqual(FORTALEZA);
    const sw = cellRect(FORTALEZA, "0");
    const ne = cellRect(FORTALEZA, "3");
    expect(sw.s).toBe(FORTALEZA.s);
    expect(sw.w).toBe(FORTALEZA.w);
    expect(ne.n).toBe(FORTALEZA.n);
    expect(ne.e).toBe(FORTALEZA.e);
    expect(sw.n).toBeCloseTo(ne.s);
    expect(sw.e).toBeCloseTo(ne.w);
  });

  it("quadrante cheio vira 4 filhos; vazio só sai da pilha", () => {
    const c = startGrid(FORTALEZA);
    expect(currentCell(c)).toBe("");
    const split = advanceGrid(c, true, 7)!;
    expect(currentCell(split)).toBe("0");
    expect(split.stack).toHaveLength(4);
    const next = advanceGrid(split, false, 7)!;
    expect(currentCell(next)).toBe("1");
    expect(advanceGrid(startGrid(FORTALEZA), false, 7)).toBeNull();
  });

  it("não divide além da profundidade máxima", () => {
    const deep: GridCursor = { v: FORTALEZA, stack: ["0123"] };
    expect(advanceGrid(deep, true, 4)).toBeNull();
  });

  it("cobre a cidade inteira uma vez só e o cursor fica pequeno", () => {
    // Centro denso (quadrantes perto do meio enchem até o nível 5), periferia rala
    const full = (path: string) => path.length < 2 || (path.length < 5 && path.split("").every((d) => d === "0" || d === "3"));
    let c: GridCursor | null = startGrid(FORTALEZA);
    const visited: string[] = [];
    let biggest = 0;
    while (c) {
      const path = currentCell(c)!;
      visited.push(path);
      biggest = Math.max(biggest, c.stack.length);
      c = advanceGrid(c, full(path), 7);
      expect(c === null || isGridCursor(c)).toBe(true);
    }
    expect(new Set(visited).size).toBe(visited.length);
    // Folhas (não divididas) cobrem a área toda: soma das áreas = área da cidade
    const area = (r: Rect) => (r.n - r.s) * (r.e - r.w);
    const leaves = visited.filter((p) => !full(p) || p.length >= 7);
    const total = leaves.reduce((sum, p) => sum + area(cellRect(FORTALEZA, p)), 0);
    expect(total).toBeCloseTo(area(FORTALEZA), 10);
    expect(biggest).toBeLessThanOrEqual(3 * 7 + 1);
  });

  it("cursor gravado no banco volta como cursor", () => {
    const c = advanceGrid(startGrid(FORTALEZA), true, 7);
    expect(isGridCursor(JSON.parse(JSON.stringify(c)))).toBe(true);
    expect(isGridCursor({ offset: 60 })).toBe(false);
    expect(isGridCursor(null)).toBe(false);
  });
});

describe("busca geral: todas as cidades, sem repetir", () => {
  it("com UF, a lista tem o estado inteiro, cada cidade uma vez", () => {
    const list = regionOrder("CE", "u1|CE");
    expect(list).toHaveLength(citiesOfState("CE").length);
    expect(new Set(list.map((c) => c.name)).size).toBe(list.length);
    expect(["Fortaleza", "Caucaia", "Maracanaú", "Juazeiro do Norte", "Sobral"]).toContain(list[0].name);
  });

  it("sem UF, cobre os 5 mil municípios e mistura estados logo no começo", () => {
    const list = regionOrder(undefined, "u1|BR");
    expect(list.length).toBeGreaterThan(5500);
    expect(new Set(list.map((c) => `${c.name}|${c.uf}`)).size).toBe(list.length);
    expect(new Set(list.slice(0, 30).map((c) => c.uf)).size).toBeGreaterThan(8);
  });

  it("mesma pessoa, mesma ordem (a varredura anda por ela); regionCities é o começo da lista", () => {
    expect(regionOrder("SP", "a")).toEqual(regionOrder("SP", "a"));
    expect(regionCities("SP", "a", 5)).toEqual(regionOrder("SP", "a").slice(0, 5));
  });
});

describe("Google: lugares de outra cidade ficam de fora", () => {
  it("compara o município ignorando acento e caixa", async () => {
    const { inCity } = await import("@/lib/providers/google-places");
    const place = (city: string) => ({ addressComponents: [{ longText: city, types: ["administrative_area_level_2", "political"] }] });
    expect(inCity(place("Fortaleza"), "Fortaleza")).toBe(true);
    expect(inCity(place("Caucaia"), "Fortaleza")).toBe(false);
    expect(inCity(place("São Luís"), "Sao Luis")).toBe(true);
    expect(inCity({ addressComponents: [] }, "Fortaleza")).toBe(true);
  });
});

describe("demonstração: cada cidade tem fim", () => {
  it("a lista fictícia acaba e sempre no mesmo ponto", async () => {
    const { mockCityTotal, mockProvider } = await import("@/lib/providers/mock");
    const q = { category: "padaria", city: "Fortaleza", uf: "CE" };
    const total = mockCityTotal(q);
    expect(total).toBeGreaterThanOrEqual(80);
    expect(total).toBeLessThan(400);
    const last = await mockProvider.search({ ...q, limit: 60, offset: total - 10 });
    expect(last).toHaveLength(10);
    expect(await mockProvider.search({ ...q, limit: 60, offset: total })).toHaveLength(0);
  });
});
