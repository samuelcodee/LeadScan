import "server-only";
import type { ProviderId } from "@/lib/domain/search";
import { env } from "@/lib/env";
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

export function getProvider(id?: ProviderId): DataProvider {
  const wanted = REGISTRY[id ?? env().DATA_PROVIDER];
  return wanted.isConfigured() ? wanted : mockProvider;
}

export function defaultProviderId(): ProviderId {
  return getProvider().id;
}

/** Lista para a interface (sem segredos). */
export function listProviders() {
  return Object.values(REGISTRY).map((p) => ({
    id: p.id,
    label: p.label,
    description: p.description,
    isDemo: p.isDemo,
    configured: p.isConfigured(),
    capabilities: p.capabilities,
  }));
}

export type ProviderInfo = ReturnType<typeof listProviders>[number];
