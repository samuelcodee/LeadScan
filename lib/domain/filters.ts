import { hasOwnWebsite } from "@/lib/scoring/website";
import { whatsappAvailability } from "@/lib/whatsapp/phone";

/**
 * Filtros da busca SEM a biblioteca de validação: é o que roda no navegador (lista de
 * resultados e formulário). A validação com zod mora em lib/domain/search.ts (servidor).
 */
export type SearchFilters = {
  website: "any" | "without" | "with";
  instagram: "any" | "with" | "without";
  whatsapp: "any" | "with" | "without";
  minReviews: number;
  minRating: number;
  potential: "any" | "high" | "medium-up";
};

export const DEFAULT_FILTERS: SearchFilters = { website: "any", instagram: "any", whatsapp: "any", minReviews: 0, minRating: 0, potential: "any" };

export const PROVIDER_IDS = ["mock", "osm", "google"] as const;
export type ProviderId = (typeof PROVIDER_IDS)[number];

export const LIMIT_OPTIONS = [10, 25, 50, 100, 250, 500] as const;

type FilterableLead = {
  website: string | null;
  instagram: string | null;
  phone: string | null;
  whatsapp: string | null;
  reviewCount: number | null;
  rating: number | null;
  scoreTier: "HIGH" | "MEDIUM" | "LOW";
};

export function matchesFilters(lead: FilterableLead, f: SearchFilters) {
  if (f.website === "without" && hasOwnWebsite(lead.website)) return false;
  if (f.website === "with" && !hasOwnWebsite(lead.website)) return false;
  if (f.instagram === "with" && !lead.instagram) return false;
  if (f.instagram === "without" && lead.instagram) return false;
  const wa = whatsappAvailability(lead);
  const hasWa = wa === "confirmed" || wa === "likely";
  if (f.whatsapp === "with" && !hasWa) return false;
  if (f.whatsapp === "without" && hasWa) return false;
  if (f.minReviews > 0 && (lead.reviewCount ?? 0) < f.minReviews) return false;
  if (f.minRating > 0 && (lead.rating ?? 0) < f.minRating) return false;
  if (f.potential === "high" && lead.scoreTier !== "HIGH") return false;
  if (f.potential === "medium-up" && lead.scoreTier === "LOW") return false;
  return true;
}

export function activeFilterCount(f: SearchFilters) {
  return (Object.keys(DEFAULT_FILTERS) as (keyof SearchFilters)[]).filter((k) => f[k] !== DEFAULT_FILTERS[k]).length;
}

/** Filtros ↔ querystring (links compartilháveis, voltar/avançar do navegador funciona). */
export function filtersToParams(f: SearchFilters, params = new URLSearchParams()) {
  for (const k of Object.keys(DEFAULT_FILTERS) as (keyof SearchFilters)[]) {
    if (f[k] !== DEFAULT_FILTERS[k]) params.set(k, String(f[k]));
    else params.delete(k);
  }
  return params;
}
