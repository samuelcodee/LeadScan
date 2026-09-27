import type { ProviderId } from "@/lib/domain/search";

/**
 * MOTOR DE LEADS — contrato de qualquer fonte de dados empresariais.
 *
 * Para conectar uma nova API (ex.: base de CNPJ licenciada, outra API de mapas):
 *   1. implemente DataProvider em lib/providers/<nome>.ts
 *   2. registre em lib/providers/index.ts
 * O resto do app (score, filtros, cache, fila, CRM) não muda.
 *
 * Regra de ouro: NUNCA inventar dados. Campo que a fonte não informa = null.
 */
export type ProviderQuery = {
  category: string;
  city: string;
  uf: string;
  limit: number;
  /** Pular os N primeiros (só fontes paginadas, ex.: demonstração). */
  offset?: number;
};

/** Foto real do negócio (hoje: Google Places). `ref` = nome do recurso na API. */
export type PhotoRef = { ref: string; width?: number; height?: number; credits?: string[] };

export type ProviderBusiness = {
  externalId: string;
  name: string;
  address: string | null;
  neighborhood: string | null;
  city: string;
  state: string;
  phone: string | null;
  whatsapp: string | null;
  website: string | null;
  instagram: string | null;
  facebook: string | null;
  mapsUrl: string | null;
  rating: number | null;
  reviewCount: number | null;
  openingHours: string[];
  description: string | null;
  services: string[];
  latitude: number | null;
  longitude: number | null;
  photos?: PhotoRef[];
};

export type ProviderCapabilities = {
  reviews: boolean;
  instagram: boolean;
  whatsapp: boolean;
  /** Máximo de resultados por consulta (categoria × cidade). */
  maxResults: number;
};

export interface DataProvider {
  id: ProviderId;
  label: string;
  description: string;
  /** Dados fictícios — marcados como DEMO em toda a interface. */
  isDemo: boolean;
  capabilities: ProviderCapabilities;
  /** Por quanto tempo reaproveitar a resposta (cache no banco). 0 = não cachear. */
  cacheTtlMs: number;
  /** Intervalo mínimo entre chamadas (respeita limites da fonte). */
  minIntervalMs: number;
  isConfigured(): boolean;
  search(query: ProviderQuery, signal?: AbortSignal): Promise<ProviderBusiness[]>;
}

export class ProviderError extends Error {
  constructor(
    message: string,
    public readonly retryable = false,
  ) {
    super(message);
  }
}
