/**
 * Pontos do ranking. Uma regra só, pública e fácil de conferir:
 *
 *   pontos = 1 ponto a cada R$ 10 (no máx. 1.000 pts) + bônus de 100 por venda a partir do mínimo
 *
 * Ex.: site de R$ 1.500 → 100 + 150 = 250 pts. Contrato de R$ 25.000 → 100 + 1.000 = 1.100 pts.
 * Venda abaixo do mínimo (RANKING_MIN_SALE_CENTS, padrão R$ 100) também conta, sem o bônus:
 * R$ 50 → 5 pts, R$ 5 → 1 pt. Toda venda paga pelo link aparece no ranking; o bônus só vem
 * com valor de verdade, então "farmar" com cobranças pequenas não compensa.
 * O teto por venda evita que um único contrato gigante decida o mês.
 */
export const POINTS_PER_SALE = 100;
export const VALUE_POINTS_CAP = 1000;

export function pointsForSale(amountCents: number, minSaleCents: number) {
  if (amountCents <= 0) return 0;
  const value = Math.min(VALUE_POINTS_CAP, Math.floor(amountCents / 1000));
  return amountCents >= minSaleCents ? POINTS_PER_SALE + value : Math.max(1, value);
}

export type RankRow = { userId: string; points: number; revenueCents: number; sales: number; lastSaleAt: Date };

/** Desempate: pontos → faturamento → quem chegou primeiro (última venda mais antiga). */
export function compareRank(a: RankRow, b: RankRow) {
  return b.points - a.points || b.revenueCents - a.revenueCents || a.lastSaleAt.getTime() - b.lastSaleAt.getTime();
}
