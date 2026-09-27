/**
 * Níveis da comunidade — 100% determinístico.
 *
 * Só contam vendas VERIFICADAS (pagas pela plataforma e confirmadas pelo provedor de
 * pagamento) com valor mínimo (RANKING_MIN_SALE_CENTS). Venda registrada à mão entra
 * no seu financeiro, mas não sobe nível: selo que qualquer um pode digitar não vale nada.
 *
 * Os níveis 9 e 10 pedem volume E constância (vendas em muitos meses diferentes),
 * pra não serem alcançados com um único mês fora da curva.
 */
export type LevelDef = {
  n: number;
  name: string;
  /** Frase curta que aparece no perfil e no tooltip do selo. */
  description: string;
  minSales: number;
  minRevenueCents: number;
  minActiveMonths: number;
  /** Tom do selo (tokens CSS em globals.css: --level-*) */
  tone: "base" | "mid" | "high" | "elite" | "legend";
};

export const LEVELS: LevelDef[] = [
  { n: 1, name: "Primeira Venda", description: "Fechou a primeira venda pela plataforma.", minSales: 1, minRevenueCents: 0, minActiveMonths: 0, tone: "base" },
  { n: 2, name: "Em Ritmo", description: "5 vendas fechadas.", minSales: 5, minRevenueCents: 0, minActiveMonths: 0, tone: "base" },
  { n: 3, name: "Profissional", description: "15 vendas e R$ 15 mil faturados.", minSales: 15, minRevenueCents: 15_000_00, minActiveMonths: 0, tone: "mid" },
  { n: 4, name: "Especialista", description: "40 vendas e R$ 50 mil faturados.", minSales: 40, minRevenueCents: 50_000_00, minActiveMonths: 0, tone: "mid" },
  { n: 5, name: "Referência", description: "80 vendas e R$ 120 mil faturados.", minSales: 80, minRevenueCents: 120_000_00, minActiveMonths: 0, tone: "high" },
  { n: 6, name: "Estúdio", description: "150 vendas e R$ 250 mil faturados.", minSales: 150, minRevenueCents: 250_000_00, minActiveMonths: 0, tone: "high" },
  { n: 7, name: "Agência", description: "300 vendas e R$ 550 mil faturados.", minSales: 300, minRevenueCents: 550_000_00, minActiveMonths: 0, tone: "high" },
  { n: 8, name: "Autoridade", description: "600 vendas e R$ 1,2 milhão faturados.", minSales: 600, minRevenueCents: 1_200_000_00, minActiveMonths: 0, tone: "elite" },
  {
    n: 9,
    name: "Elite",
    description: "1.200 vendas, R$ 2,5 milhões e vendas em 10 meses diferentes.",
    minSales: 1200,
    minRevenueCents: 2_500_000_00,
    minActiveMonths: 10,
    tone: "elite",
  },
  {
    n: 10,
    name: "Lenda",
    description: "2.500 vendas, R$ 6 milhões e vendas em 24 meses diferentes.",
    minSales: 2500,
    minRevenueCents: 6_000_000_00,
    minActiveMonths: 24,
    tone: "legend",
  },
];

export type SalesStats = { sales: number; revenueCents: number; activeMonths: number };

export function levelFor(stats: SalesStats): number {
  let level = 0;
  for (const l of LEVELS) {
    if (stats.sales >= l.minSales && stats.revenueCents >= l.minRevenueCents && stats.activeMonths >= l.minActiveMonths) level = l.n;
    else break;
  }
  return level;
}

export function getLevel(n: number): LevelDef | null {
  return LEVELS.find((l) => l.n === n) ?? null;
}

/** Progresso rumo ao próximo nível (0–1 por critério), para a barra do perfil. */
export function nextLevelProgress(stats: SalesStats) {
  const current = levelFor(stats);
  const next = LEVELS.find((l) => l.n === current + 1);
  if (!next) return null;
  const parts = [
    { key: "sales", label: "vendas", have: stats.sales, need: next.minSales },
    ...(next.minRevenueCents ? [{ key: "revenue", label: "faturamento", have: stats.revenueCents, need: next.minRevenueCents }] : []),
    ...(next.minActiveMonths ? [{ key: "months", label: "meses com venda", have: stats.activeMonths, need: next.minActiveMonths }] : []),
  ].map((p) => ({ ...p, ratio: Math.min(1, p.have / p.need) }));
  return { next, parts, ratio: Math.min(...parts.map((p) => p.ratio)) };
}

/** Títulos especiais (campeonatos) — também viram selo ao lado da foto. */
export const SPECIAL_BADGES = ["week-champion", "month-champion", "month-podium"] as const;

/**
 * Qual selo aparece ao lado da foto: o título escolhido pela pessoa (se ainda vale)
 * ou o do nível atual. Null = ainda sem selo (antes da primeira venda).
 */
export function badgeKeyFor(displayTitle: string | null | undefined, level: number): string | null {
  if (displayTitle && (SPECIAL_BADGES as readonly string[]).includes(displayTitle)) return displayTitle;
  if (displayTitle?.startsWith("level-") && Number(displayTitle.slice(6)) <= level) return displayTitle;
  return level > 0 ? `level-${level}` : null;
}
