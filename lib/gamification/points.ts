/**
 * Pontos do ranking. Uma regra só, pública e fácil de conferir:
 *
 *   pontos = 100 por venda + 1 ponto a cada R$ 10 (a parte do valor vale no máx. 1.000 pts)
 *
 * Ex.: site de R$ 1.500 → 100 + 150 = 250 pts. Contrato de R$ 25.000 → 100 + 1.000 = 1.100 pts.
 * O teto por venda evita que um único contrato gigante decida o mês; o valor mínimo
 * (RANKING_MIN_SALE_CENTS, padrão R$ 100) evita "farmar" pontos com cobranças de centavos.
 */
export const POINTS_PER_SALE = 100;
export const VALUE_POINTS_CAP = 1000;

export function pointsForSale(amountCents: number, minSaleCents: number) {
  if (amountCents < minSaleCents) return 0;
  return POINTS_PER_SALE + Math.min(VALUE_POINTS_CAP, Math.floor(amountCents / 1000));
}

export type RankRow = { userId: string; points: number; revenueCents: number; sales: number; lastSaleAt: Date };

/** Desempate: pontos → faturamento → quem chegou primeiro (última venda mais antiga). */
export function compareRank(a: RankRow, b: RankRow) {
  return b.points - a.points || b.revenueCents - a.revenueCents || a.lastSaleAt.getTime() - b.lastSaleAt.getTime();
}
