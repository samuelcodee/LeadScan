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
  /** Posição da tarefa na busca: fontes com vários servidores espalham as consultas paralelas. */
  hint?: number;
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
  /** Tentativas em fetchWithCache (padrão 3). Fontes que já fazem rodízio de servidor usam 1. */
  maxAttempts?: number;
  /** Quantas cidades consultar ao mesmo tempo (padrão 2). */
  concurrency?: number;
  isConfigured(): boolean;
  search(query: ProviderQuery, signal?: AbortSignal): Promise<ProviderBusiness[]>;
  /**
   * Opcional: varre a cidade em pedaços (fontes que limitam quantos resultados cada consulta
   * devolve). `cursor` null = começo; a busca guarda o `next` em SearchSweep e a próxima
   * continua dali. Sem este método, a cidade inteira vem de search() de uma vez.
   */
  sweep?(query: ProviderQuery, cursor: unknown, signal?: AbortSignal): Promise<SweepPage>;
}

export type SweepPage = {
  items: ProviderBusiness[];
  /** Cursor do próximo pedaço; null = a fonte não tem mais nada nesta cidade. */
  next: unknown;
};

export class ProviderError extends Error {
  constructor(
    message: string,
    public readonly retryable = false,
  ) {
    super(message);
  }
}

/** A cota grátis do mês da fonte paga acabou: nada mais é chamado até virar o mês. */
export class QuotaExhaustedError extends ProviderError {
  constructor() {
    super("A cota grátis do Google Maps deste mês acabou. As próximas buscas usam o OpenStreetMap até o mês virar.");
  }
}
