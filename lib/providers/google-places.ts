import "server-only";
import { getCategory } from "@/lib/domain/categories";
import { neighborhoodsFor } from "@/lib/domain/geo";
import { env } from "@/lib/env";
import { ProviderError, type DataProvider, type ProviderBusiness, type ProviderQuery } from "@/lib/providers/types";

/**
 * Google Places API (New) — Text Search.
 * Docs: https://developers.google.com/maps/documentation/places/web-service/text-search
 *
 * Custos: cada página (até 20 resultados) é uma requisição cobrada; campos como
 * telefone, site e avaliações pertencem a SKUs mais caros. Por isso: FieldMask mínimo,
 * cache no banco e paginação sob demanda.
 * Termos: o Google restringe armazenar conteúdo do Places além do place_id. Revise
 * https://cloud.google.com/maps-platform/terms antes de usar em produção.
 * Instagram/WhatsApp não são fornecidos pela API → ficam "Não encontrado".
 */

const FIELD_MASK = [
  "places.id",
  "places.displayName",
  "places.formattedAddress",
  "places.addressComponents",
  "places.nationalPhoneNumber",
  "places.internationalPhoneNumber",
  "places.websiteUri",
  "places.rating",
  "places.userRatingCount",
  "places.regularOpeningHours.weekdayDescriptions",
  "places.googleMapsUri",
  "places.editorialSummary",
  "places.location",
  "places.businessStatus",
  "places.photos",
  "nextPageToken",
].join(",");

type Place = {
  id: string;
  displayName?: { text: string };
  formattedAddress?: string;
  addressComponents?: { longText: string; types: string[] }[];
  nationalPhoneNumber?: string;
  internationalPhoneNumber?: string;
  websiteUri?: string;
  rating?: number;
  userRatingCount?: number;
  regularOpeningHours?: { weekdayDescriptions?: string[] };
  googleMapsUri?: string;
  editorialSummary?: { text: string };
  location?: { latitude: number; longitude: number };
  businessStatus?: string;
  photos?: { name: string; widthPx?: number; heightPx?: number; authorAttributions?: { displayName?: string }[] }[];
};

function mapPlace(p: Place, q: ProviderQuery): ProviderBusiness {
  const comp = (type: string) => p.addressComponents?.find((c) => c.types.includes(type))?.longText ?? null;
  return {
    externalId: `google:${p.id}`,
    name: p.displayName?.text ?? "Sem nome",
    address: p.formattedAddress ?? null,
    neighborhood: comp("sublocality_level_1") ?? comp("sublocality"),
    city: comp("administrative_area_level_2") ?? q.city,
    state: q.uf,
    phone: p.internationalPhoneNumber ?? p.nationalPhoneNumber ?? null,
    whatsapp: null,
    website: p.websiteUri ?? null,
    instagram: null,
    facebook: null,
    mapsUrl: p.googleMapsUri ?? null,
    rating: p.rating ?? null,
    reviewCount: p.userRatingCount ?? 0,
    openingHours: p.regularOpeningHours?.weekdayDescriptions ?? [],
    description: p.editorialSummary?.text ?? null,
    services: [],
    latitude: p.location?.latitude ?? null,
    longitude: p.location?.longitude ?? null,
    // Fotos reais (até 6). Os autores precisam aparecer junto — ver SiteSpec.credits.
    photos: (p.photos ?? []).slice(0, 6).map((ph) => ({
      ref: ph.name,
      width: ph.widthPx,
      height: ph.heightPx,
      credits: (ph.authorAttributions ?? []).map((a) => a.displayName ?? "").filter(Boolean),
    })),
  };
}

async function textSearch(textQuery: string, pageToken: string | undefined, signal?: AbortSignal) {
  const res = await fetch("https://places.googleapis.com/v1/places:searchText", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Goog-Api-Key": env().MAPS_API_KEY,
      "X-Goog-FieldMask": FIELD_MASK,
    },
    body: JSON.stringify({ textQuery, languageCode: "pt-BR", regionCode: "BR", pageSize: 20, pageToken }),
    signal: signal ?? AbortSignal.timeout(15_000),
    cache: "no-store",
  });
  if (res.status === 429) throw new ProviderError("Limite da Google Places API atingido. Aguarde e tente novamente.", true);
  if (res.status === 403) throw new ProviderError("Chave do Google Maps inválida ou Places API (New) não habilitada.");
  if (!res.ok) throw new ProviderError(`Google Places respondeu ${res.status}.`, res.status >= 500);
  return (await res.json()) as { places?: Place[]; nextPageToken?: string };
}

export const googlePlacesProvider: DataProvider = {
  id: "google",
  label: "Google Places",
  description: "Dados do Google Maps (avaliações, nota, site, telefone). Requer MAPS_API_KEY; cobrado por requisição.",
  isDemo: false,
  capabilities: { reviews: true, instagram: false, whatsapp: false, maxResults: 300 },
  cacheTtlMs: 24 * 60 * 60 * 1000,
  minIntervalMs: 250,
  isConfigured: () => env().MAPS_API_KEY.length > 0,
  async search(q, signal) {
    if (!this.isConfigured()) throw new ProviderError("Configure MAPS_API_KEY para usar o Google Places.");
    const cat = getCategory(q.category);
    const found = new Map<string, ProviderBusiness>();
    // A API devolve no máx. 60 por consulta (3 páginas); para mais, varre bairros.
    const queries = [`${cat.searchTerm} em ${q.city}, ${q.uf}`, ...neighborhoodsFor(q.city, q.uf).map((n) => `${cat.searchTerm} em ${n}, ${q.city}, ${q.uf}`)];
    for (const textQuery of queries) {
      let token: string | undefined;
      for (let page = 0; page < 3 && found.size < q.limit; page++) {
        const data = await textSearch(textQuery, token, signal);
        for (const p of data.places ?? []) {
          if (p.businessStatus === "CLOSED_PERMANENTLY") continue;
          if (!found.has(p.id)) found.set(p.id, mapPlace(p, q));
        }
        token = data.nextPageToken;
        if (!token) break;
      }
      if (found.size >= q.limit) break;
    }
    return [...found.values()].slice(0, q.limit);
  },
};
