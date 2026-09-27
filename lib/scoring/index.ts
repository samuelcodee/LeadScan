import { getCategory } from "@/lib/domain/categories";
import { formatInt, formatRating } from "@/lib/format";
import { classifyWebsite } from "@/lib/scoring/website";
import { whatsappAvailability } from "@/lib/whatsapp/phone";

/**
 * MOTOR DE OPORTUNIDADE
 * Score 0–100 de "potencial de prospecção" — estimativa baseada em sinais públicos,
 * nunca uma verdade absoluta. 100% determinístico: custo zero de IA, instantâneo,
 * auditável (cada ponto vem com um motivo legível).
 *
 * Ao mudar pesos, incremente SCORE_VERSION: leads com versão antiga são recalculados.
 */
export const SCORE_VERSION = 2;

export type ScoreTier = "HIGH" | "MEDIUM" | "LOW";

export type ScoreReason = {
  key: string;
  label: string;
  points: number;
  kind: "positive" | "negative" | "neutral";
};

export type ScoreInput = {
  category: string;
  website?: string | null;
  instagram?: string | null;
  facebook?: string | null;
  phone?: string | null;
  whatsapp?: string | null;
  rating?: number | null;
  reviewCount?: number | null;
  address?: string | null;
  openingHours?: string[] | null;
  description?: string | null;
};

export type ScoreResult = { score: number; tier: ScoreTier; reasons: ScoreReason[]; version: number };

export const TIER_THRESHOLDS = { HIGH: 70, MEDIUM: 45 } as const;

export const TIER_LABEL: Record<ScoreTier, string> = {
  HIGH: "Alto potencial",
  MEDIUM: "Médio potencial",
  LOW: "Baixo potencial",
};

export function tierFor(score: number): ScoreTier {
  if (score >= TIER_THRESHOLDS.HIGH) return "HIGH";
  if (score >= TIER_THRESHOLDS.MEDIUM) return "MEDIUM";
  return "LOW";
}

export function scoreLead(input: ScoreInput): ScoreResult {
  const reasons: ScoreReason[] = [];
  const add = (key: string, label: string, points: number, kind?: ScoreReason["kind"]) =>
    reasons.push({ key, label, points, kind: kind ?? (points > 0 ? "positive" : points < 0 ? "negative" : "neutral") });

  // 1) Site — o sinal mais forte de necessidade
  const site = classifyWebsite(input.website);
  const lacksOwnSite = site.kind !== "own" && site.kind !== "free-builder";
  switch (site.kind) {
    case "none":
      add("site", "Não encontramos site próprio", 28);
      break;
    case "social":
      add("site", "Usa rede social no lugar de um site", 25);
      break;
    case "link-in-bio":
      add("site", "Usa link de bio em vez de site próprio", 24);
      break;
    case "discontinued":
      add("site", "Site em plataforma desativada (business.site)", 27);
      break;
    case "free-builder":
      add("site", `Site em construtor gratuito (${site.host})`, 14);
      break;
    case "own":
      if (!site.https) add("site", "Site sem HTTPS — aparece como “não seguro”", 6);
      else add("site", "Já possui site próprio", -6);
      break;
  }

  // 2) Avaliações — demanda local comprovada
  const reviews = input.reviewCount;
  if (reviews === null || reviews === undefined) {
    add("reviews", "Fonte sem dados de avaliações", 0, "neutral");
  } else if (reviews >= 300) {
    add("reviews", `${formatInt(reviews)} avaliações — forte presença local`, 18);
  } else if (reviews >= 100) {
    add("reviews", `${formatInt(reviews)} avaliações — boa presença local`, 14);
  } else if (reviews >= 50) {
    add("reviews", `${formatInt(reviews)} avaliações`, 10);
  } else if (reviews >= 15) {
    add("reviews", `${formatInt(reviews)} avaliações`, 5);
  } else {
    add("reviews", `Poucas avaliações (${formatInt(reviews)})`, 0, "negative");
  }

  // 3) Nota
  const rating = input.rating;
  if (rating !== null && rating !== undefined && (reviews ?? 0) > 0) {
    if (rating >= 4.5) add("rating", `Nota ${formatRating(rating)} — reputação excelente`, 8);
    else if (rating >= 4.0) add("rating", `Nota ${formatRating(rating)} — boa reputação`, 5);
    else if (rating >= 3.5) add("rating", `Nota ${formatRating(rating)}`, 2);
    else add("rating", `Nota ${formatRating(rating)} — reputação pode dificultar a venda`, -5);
  }

  // 4) Canais existentes (conteúdo pronto + canal de conversa)
  if (input.instagram) add("instagram", "Instagram ativo — já produz conteúdo visual", 10);
  else add("instagram", "Instagram não encontrado", 0, "neutral");

  const wa = whatsappAvailability(input);
  if (wa === "confirmed") add("whatsapp", "WhatsApp disponível", 8);
  else if (wa === "likely") add("whatsapp", "Celular informado (provável WhatsApp)", 6);
  else if (wa === "unknown") add("whatsapp", "Só telefone fixo para contato", 3);
  else add("whatsapp", "Sem telefone — difícil de contatar", -12);

  // 5) Segmento
  const cat = getCategory(input.category);
  const catPoints = cat.potential === "high" ? 10 : cat.potential === "medium" ? 6 : 3;
  const catLabel =
    cat.potential === "high"
      ? `${cat.plural}: segmento onde site gera ${cat.goal}`
      : cat.potential === "medium"
        ? `${cat.plural}: site ajuda a gerar ${cat.goal}`
        : `${cat.plural}: conversão moderada via site`;
  add("category", catLabel, catPoints);

  // 6) Informações comerciais completas (facilita montar o protótipo)
  const complete = Boolean(input.address) && (input.openingHours?.length ?? 0) > 0;
  if (complete) add("complete", "Informações comerciais completas", 3);

  // 7) Negócio estabelecido sem canal próprio = melhor argumento de venda
  if (lacksOwnSite && (reviews ?? 0) >= 100 && (rating ?? 0) >= 4.3) {
    add("established", "Negócio consolidado sem canal próprio de conversão", 6);
  }

  // 8) Presença digital já muito bem estruturada = pouca margem
  if (site.kind === "own" && site.https && input.instagram && (reviews ?? 0) >= 100) {
    add("mature", "Presença digital já bem estruturada", -10);
  }

  let raw = reasons.reduce((s, r) => s + r.points, 0);
  // Fonte sem avaliações (ex.: OpenStreetMap): avaliações + nota + "negócio consolidado"
  // valem até 32 pontos que ninguém pode ganhar. Normaliza pelo máximo alcançável para
  // não jogar todos os leads dessa fonte em "baixo potencial".
  if (reviews === null || reviews === undefined) {
    raw = Math.round((raw * 98) / (98 - 32));
    add("normalized", "Pontuação ajustada: a fonte não informa avaliações", 0, "neutral");
  }
  const score = Math.max(0, Math.min(98, Math.round(raw)));
  reasons.sort((a, b) => kindOrder(a.kind) - kindOrder(b.kind) || Math.abs(b.points) - Math.abs(a.points));
  return { score, tier: tierFor(score), reasons, version: SCORE_VERSION };
}

function kindOrder(k: ScoreReason["kind"]) {
  return k === "positive" ? 0 : k === "negative" ? 1 : 2;
}
