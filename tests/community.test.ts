import { describe, expect, it } from "vitest";
import { getLevel, LEVELS, levelFor, nextLevelProgress } from "@/lib/gamification/levels";
import { compareRank, pointsForSale } from "@/lib/gamification/points";
import { lastDays, monthPeriod, weekPeriod, zonedToUtc } from "@/lib/time/periods";

describe("níveis", () => {
  it("são 10, com requisitos crescentes", () => {
    expect(LEVELS).toHaveLength(10);
    for (let i = 1; i < LEVELS.length; i++) {
      expect(LEVELS[i].minSales).toBeGreaterThan(LEVELS[i - 1].minSales);
      expect(LEVELS[i].minRevenueCents).toBeGreaterThanOrEqual(LEVELS[i - 1].minRevenueCents);
    }
  });

  it("primeira venda = nível 1; sem vendas = 0", () => {
    expect(levelFor({ sales: 0, revenueCents: 0, activeMonths: 0 })).toBe(0);
    expect(levelFor({ sales: 1, revenueCents: 150000, activeMonths: 1 })).toBe(1);
    expect(getLevel(1)?.name).toBe("Primeira Venda");
  });

  it("volume sem faturamento não sobe de nível", () => {
    expect(levelFor({ sales: 20, revenueCents: 1_000_00, activeMonths: 3 })).toBe(2);
  });

  it("níveis 9 e 10 exigem constância (meses com venda)", () => {
    const huge = { sales: 5000, revenueCents: 10_000_000_00 };
    expect(levelFor({ ...huge, activeMonths: 5 })).toBe(8);
    expect(levelFor({ ...huge, activeMonths: 12 })).toBe(9);
    expect(levelFor({ ...huge, activeMonths: 24 })).toBe(10);
  });

  it("progresso aponta o próximo nível e o critério mais atrasado", () => {
    const p = nextLevelProgress({ sales: 10, revenueCents: 5_000_00, activeMonths: 2 });
    expect(p?.next.n).toBe(3);
    expect(p?.ratio).toBeCloseTo(1 / 3, 2);
  });
});

describe("pontos do ranking", () => {
  it("100 por venda + 1 a cada R$ 10, com teto", () => {
    expect(pointsForSale(150000, 10000)).toBe(250);
    expect(pointsForSale(25_000_00, 10000)).toBe(1100);
    // abaixo do mínimo: conta, sem o bônus de 100
    expect(pointsForSale(99_00, 10000)).toBe(9);
    expect(pointsForSale(5_00, 10000)).toBe(1);
    expect(pointsForSale(0, 10000)).toBe(0);
  });

  it("desempate: pontos → faturamento → quem chegou antes", () => {
    const a = { userId: "a", points: 500, revenueCents: 100, sales: 2, lastSaleAt: new Date("2026-09-20T10:00:00Z") };
    const b = { ...a, userId: "b", revenueCents: 200 };
    const c = { ...a, userId: "c", lastSaleAt: new Date("2026-09-19T10:00:00Z") };
    expect([a, b, c].sort(compareRank).map((r) => r.userId)).toEqual(["b", "c", "a"]);
  });
});

describe("períodos em Brasília", () => {
  it("semana vai de segunda 00:00 a domingo 23:59:59.999 (UTC-3)", () => {
    // sábado 26/09/2026 22:00 em Brasília = domingo 01:00 UTC
    const w = weekPeriod(new Date("2026-09-27T01:00:00Z"));
    expect(w.start.toISOString()).toBe("2026-09-21T03:00:00.000Z");
    expect(w.end.toISOString()).toBe("2026-09-28T02:59:59.999Z");
    expect(w.label).toBe("21/09 a 27/09");
  });

  it("domingo 23:59 ainda é a mesma semana; segunda 00:00 começa outra", () => {
    const sunday = weekPeriod(new Date("2026-09-28T02:59:00Z"));
    const monday = weekPeriod(new Date("2026-09-28T03:00:00Z"));
    expect(sunday.key).not.toBe(monday.key);
    expect(monday.start.toISOString()).toBe("2026-09-28T03:00:00.000Z");
  });

  it("mês local e semanas anteriores", () => {
    const m = monthPeriod(new Date("2026-10-01T02:00:00Z")); // ainda 30/09 em Brasília
    expect(m.key).toBe("2026-09");
    expect(weekPeriod(new Date("2026-09-27T01:00:00Z"), -1).label).toBe("14/09 a 20/09");
    expect(zonedToUtc(2026, 1, 1).toISOString()).toBe("2026-01-01T03:00:00.000Z");
    expect(lastDays(3, new Date("2026-09-27T01:00:00Z"))).toEqual(["2026-09-24", "2026-09-25", "2026-09-26"]);
  });
});
