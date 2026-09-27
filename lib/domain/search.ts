import { z } from "zod";
import { DEFAULT_FILTERS, PROVIDER_IDS, type SearchFilters } from "@/lib/domain/filters";

export { activeFilterCount, DEFAULT_FILTERS, filtersToParams, LIMIT_OPTIONS, matchesFilters, PROVIDER_IDS } from "@/lib/domain/filters";
export type { ProviderId, SearchFilters } from "@/lib/domain/filters";

/** Pós-filtros: aplicados por código sobre os resultados (instantâneos, sem nova requisição). */
export const filtersSchema = z.object({
  website: z.enum(["any", "without", "with"]).default("any"),
  instagram: z.enum(["any", "with", "without"]).default("any"),
  whatsapp: z.enum(["any", "with", "without"]).default("any"),
  minReviews: z.coerce.number().int().min(0).max(100000).default(0),
  minRating: z.coerce.number().min(0).max(5).default(0),
  potential: z.enum(["any", "high", "medium-up"]).default("any"),
});

/** Requisição à fonte de dados (o que custa chamada de API). */
export const searchRequestSchema = z.object({
  query: z.string().max(300).optional(),
  categories: z.array(z.string().min(1).max(40)).min(1, "Escolha ao menos uma categoria.").max(5),
  /** Vazio = busca geral: todas as cidades da UF escolhida (ou do Brasil, sem UF). */
  cities: z
    .array(z.object({ name: z.string().trim().min(2).max(60), uf: z.string().length(2).toUpperCase() }))
    .max(10)
    .default([]),
  uf: z.string().length(2).toUpperCase().optional(),
  limit: z.coerce.number().int().min(1).max(500).default(50),
  provider: z.enum(PROVIDER_IDS).optional(),
});
export type SearchRequest = z.infer<typeof searchRequestSchema>;

/** O retorno tipado garante que o schema e o tipo do navegador (lib/domain/filters) batem. */
export function filtersFromParams(params: Record<string, string | string[] | undefined>): SearchFilters {
  const flat = Object.fromEntries(Object.entries(params).map(([k, v]) => [k, Array.isArray(v) ? v[0] : v]));
  const r = filtersSchema.safeParse(flat);
  return r.success ? r.data : DEFAULT_FILTERS;
}
