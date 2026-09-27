import "server-only";
import type { ProviderId } from "@/lib/domain/search";
import { dataProviderId, isDemoMode } from "@/lib/env";
import { googlePlacesProvider } from "@/lib/providers/google-places";
import { mockProvider } from "@/lib/providers/mock";
import { osmProvider } from "@/lib/providers/osm";
import type { DataProvider } from "@/lib/providers/types";

/** Registro de fontes. REAL_PROVIDERs novos entram aqui. */
const REGISTRY: Record<ProviderId, DataProvider> = {
  mock: mockProvider,
  osm: osmProvider,
  google: googlePlacesProvider,
};

/**
 * Fonte pedida (ou a padrão). Na versão pública (AUTH_MODE=public) a fonte fictícia nunca
 * entra: pedido de "mock" ou fonte sem chave cai na padrão real, e por fim no OpenStreetMap.
 */
export function getProvider(id?: ProviderId): DataProvider {
  const wanted = REGISTRY[id ?? dataProviderId()];
  if (isDemoMode()) return wanted.isConfigured() ? wanted : mockProvider;
  if (!wanted.isDemo && wanted.isConfigured()) return wanted;
  const fallback = REGISTRY[dataProviderId()];
  return !fallback.isDemo && fallback.isConfigured() ? fallback : osmProvider;
}

export function defaultProviderId(): ProviderId {
  return getProvider().id;
}

/** Lista para a interface (sem segredos). */
export function listProviders() {
  const demo = isDemoMode();
  return Object.values(REGISTRY)
    .filter((p) => demo || !p.isDemo)
    .map((p) => ({
    id: p.id,
    label: p.label,
    description: p.description,
    isDemo: p.isDemo,
    configured: p.isConfigured(),
    capabilities: p.capabilities,
  }));
}

export type ProviderInfo = ReturnType<typeof listProviders>[number];
