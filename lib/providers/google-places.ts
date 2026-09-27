import "server-only";
import { getCategory } from "@/lib/domain/categories";
import { getState, neighborhoodsFor } from "@/lib/domain/geo";
import { env } from "@/lib/env";
import { fold } from "@/lib/format";
import { hashKey } from "@/lib/hash";
import { cachedProviderCall } from "@/lib/providers/cache";
import { advanceGrid, cellRect, currentCell, isGridCursor, startGrid, type GridCursor, type Rect } from "@/lib/providers/grid";
import { ProviderError, type DataProvider, type ProviderBusiness, type ProviderQuery, type SweepPage } from "@/lib/providers/types";

/**
 * Google Maps — Places API (New), Text Search.
 * Docs: https://developers.google.com/maps/documentation/places/web-service/text-search
 *
 * Custos: cada página (até 20 resultados) é uma requisição cobrada. Telefone, site e avaliações
 * caem no SKU "Text Search Enterprise" (1.000 grátis/mês, depois ~US$ 35 por mil). NÃO pedir
 * editorialSummary: ele sobe para "Enterprise + Atmosphere" (mais caro, cota grátis menor).
 * Por isso: FieldMask mínimo, cache no banco e varredura que nunca repete quadrante.
 * Termos: o Google restringe armazenar conteúdo do Places além do place_id. Revise
 * https://cloud.google.com/maps-platform/terms antes de usar em produção.
 * Instagram/WhatsApp não são fornecidos pela API → ficam "Não encontrado".
 *
 * Varredura (sweep): uma consulta devolve no máximo 60 lugares. Para passar disso, a cidade
 * vira uma grade (lib/providers/grid.ts): o retângulo da cidade é dividido em quadrantes até
 * cada um caber em 60. A busca guarda onde parou e a próxima continua do quadrante seguinte.
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
  "places.location",
  "places.businessStatus",
  "places.photos",
  "nextPageToken",
].join(",");

/** Só o contorno da cidade (SKU Pro, bem mais barato; uma vez por cidade, guardado 180 dias). */
const VIEWPORT_MASK = "places.displayName,places.types,places.viewport,places.addressComponents";

/** A API devolve no máximo 60 por consulta (3 páginas de 20). */
const PER_QUERY_MAX = 60;
/** Profundidade máxima da grade: 7 níveis ≈ quadrantes de ~500 m no centro de São Paulo. */
const MAX_DEPTH = 7;
const CELL_TTL = 24 * 60 * 60 * 1000;
const VIEWPORT_TTL = 180 * 24 * 60 * 60 * 1000;

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
  location?: { latitude: number; longitude: number };
  businessStatus?: string;
  photos?: { name: string; widthPx?: number; heightPx?: number; authorAttributions?: { displayName?: string }[] }[];
  types?: string[];
  viewport?: { low: { latitude: number; longitude: number }; high: { latitude: number; longitude: number } };
};

const component = (p: Place, type: string) => p.addressComponents?.find((c) => c.types.includes(type))?.longText ?? null;

/** Município do lugar segundo o Google (no Brasil vem como administrative_area_level_2). */
export function placeCity(p: Pick<Place, "addressComponents">) {
  return component(p as Place, "administrative_area_level_2") ?? component(p as Place, "locality");
}

/**
 * O retângulo da cidade pega pedaço das vizinhas (Fortaleza × Caucaia): lugar de outro
 * município fica para a varredura dele. Sem município informado, fica (não dá para saber).
 */
export function inCity(p: Pick<Place, "addressComponents">, city: string) {
  const c = placeCity(p);
  return !c || fold(c) === fold(city);
}

function mapPlace(p: Place, q: ProviderQuery): ProviderBusiness {
  return {
    externalId: `google:${p.id}`,
    name: p.displayName?.text ?? "Sem nome",
    address: p.formattedAddress ?? null,
    neighborhood: component(p, "sublocality_level_1") ?? component(p, "sublocality"),
    // Grafia oficial (IBGE) da cidade buscada: é ela que entra na chave de duplicidade
    city: q.city,
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
    description: null,
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

// Espaça as requisições (a cota padrão é 600 por minuto por projeto)
let lastCallAt = 0;
async function pace(ms = 120) {
  const now = Date.now();
  const slot = Math.max(now, lastCallAt + ms);
  lastCallAt = slot;
  if (slot > now) await new Promise((r) => setTimeout(r, slot - now));
}

async function textSearch(body: Record<string, unknown>, fieldMask: string, signal?: AbortSignal) {
  await pace();
  const res = await fetch("https://places.googleapis.com/v1/places:searchText", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Goog-Api-Key": env().MAPS_API_KEY,
      "X-Goog-FieldMask": fieldMask,
    },
    body: JSON.stringify({ languageCode: "pt-BR", regionCode: "BR", ...body }),
    signal: signal ?? AbortSignal.timeout(15_000),
    cache: "no-store",
  });
  if (res.status === 429) throw new ProviderError("Limite da Google Places API atingido. Aguarde e tente novamente.", true);
  if (res.status === 403) throw new ProviderError("Chave do Google Maps inválida ou Places API (New) não habilitada.");
  if (!res.ok) throw new ProviderError(`Google Places respondeu ${res.status}.`, res.status >= 500);
  return (await res.json()) as { places?: Place[]; nextPageToken?: string };
}

/** Todas as páginas (até 60) de uma consulta. `full` = veio cheia: pode haver mais do que isso. */
async function allPages(body: Record<string, unknown>, signal?: AbortSignal) {
  const places: Place[] = [];
  let token: string | undefined;
  for (let page = 0; page < 3; page++) {
    const data = await textSearch({ ...body, pageSize: 20, pageToken: token }, FIELD_MASK, signal);
    places.push(...(data.places ?? []));
    token = data.nextPageToken;
    if (!token) break;
  }
  return { places, full: places.length >= PER_QUERY_MAX };
}

/** Retângulo do município (viewport do Google), guardado por 180 dias. null = não achou. */
async function cityViewport(city: string, uf: string, signal?: AbortSignal): Promise<Rect | null> {
  const key = hashKey("google-viewport", fold(city), uf);
  return cachedProviderCall(key, "google", VIEWPORT_TTL, async () => {
    const stateName = getState(uf)?.name ?? uf;
    const data = await textSearch({ textQuery: `${city}, ${stateName}, Brasil`, pageSize: 5 }, VIEWPORT_MASK, signal);
    const places = (data.places ?? []).filter((p) => p.viewport);
    const isArea = (p: Place) => (p.types ?? []).some((t) => t === "locality" || t === "administrative_area_level_2");
    const best = places.find((p) => isArea(p) && fold(p.displayName?.text ?? "") === fold(city)) ?? places.find(isArea) ?? null;
    if (!best?.viewport) return null;
    const { low, high } = best.viewport;
    return { s: low.latitude, w: low.longitude, n: high.latitude, e: high.longitude };
  });
}

/** Um quadrante da grade (todas as páginas), guardado 24 h para quem varrer a mesma cidade. */
function fetchCell(term: string, rect: Rect, signal?: AbortSignal) {
  const round = (n: number) => Math.round(n * 1e5) / 1e5;
  const key = hashKey("google-cell", term, round(rect.s), round(rect.w), round(rect.n), round(rect.e));
  return cachedProviderCall(key, "google", CELL_TTL, () =>
    allPages(
      {
        textQuery: term,
        locationRestriction: { rectangle: { low: { latitude: rect.s, longitude: rect.w }, high: { latitude: rect.n, longitude: rect.e } } },
      },
      signal,
    ),
  );
}

/** Consulta por texto ("padaria em Aldeota, Fortaleza, CE") — reserva quando não há viewport. */
function fetchText(textQuery: string, signal?: AbortSignal) {
  return cachedProviderCall(hashKey("google-text", textQuery), "google", CELL_TTL, () => allPages({ textQuery }, signal));
}

type TextCursor = { texts: string[] };
const isTextCursor = (x: unknown): x is TextCursor => !!x && typeof x === "object" && Array.isArray((x as TextCursor).texts);

function toBusinesses(places: Place[], q: ProviderQuery) {
  return places.filter((p) => p.businessStatus !== "CLOSED_PERMANENTLY" && inCity(p, q.city)).map((p) => mapPlace(p, q));
}

export const googlePlacesProvider: DataProvider = {
  id: "google",
  label: "Google Maps",
  description: "Dados do Google Maps: nota, avaliações, site, telefone e fotos. Mais rápido e completo; varre a cidade inteira aos poucos.",
  isDemo: false,
  capabilities: { reviews: true, instagram: false, whatsapp: false, maxResults: 300 },
  cacheTtlMs: CELL_TTL,
  minIntervalMs: 120,
  // Google aguenta várias cidades ao mesmo tempo (as páginas já são espaçadas em pace())
  concurrency: 4,
  isConfigured: () => env().MAPS_API_KEY.length > 0,

  /** Lista direta (sem varredura): cidade + bairros conhecidos, até `limit`. */
  async search(q, signal) {
    if (!this.isConfigured()) throw new ProviderError("Configure MAPS_API_KEY para usar o Google Maps.");
    const cat = getCategory(q.category);
    const found = new Map<string, ProviderBusiness>();
    const queries = [`${cat.searchTerm} em ${q.city}, ${q.uf}`, ...neighborhoodsFor(q.city, q.uf).map((n) => `${cat.searchTerm} em ${n}, ${q.city}, ${q.uf}`)];
    for (const textQuery of queries) {
      const { places } = await fetchText(textQuery, signal);
      for (const b of toBusinesses(places, q)) if (!found.has(b.externalId)) found.set(b.externalId, b);
      if (found.size >= q.limit) break;
    }
    return [...found.values()].slice(0, q.limit);
  },

  /** Um quadrante por vez. O cursor guarda o retângulo da cidade e a pilha de quadrantes. */
  async sweep(q, cursor, signal): Promise<SweepPage> {
    if (!this.isConfigured()) throw new ProviderError("Configure MAPS_API_KEY para usar o Google Maps.");
    const term = getCategory(q.category).searchTerm;

    // Sem contorno da cidade (raro): cidade + bairros conhecidos, uma consulta por vez
    if (isTextCursor(cursor)) {
      const [head, ...rest] = cursor.texts;
      const { places } = await fetchText(head, signal);
      return { items: toBusinesses(places, q), next: rest.length ? { texts: rest } : null };
    }

    let grid: GridCursor | null = isGridCursor(cursor) ? cursor : null;
    if (!grid) {
      const viewport = await cityViewport(q.city, q.uf, signal);
      if (!viewport) {
        const texts = [`${term} em ${q.city}, ${q.uf}`, ...neighborhoodsFor(q.city, q.uf).map((n) => `${term} em ${n}, ${q.city}, ${q.uf}`)];
        return this.sweep!(q, { texts }, signal);
      }
      grid = startGrid(viewport);
    }
    const path = currentCell(grid) ?? "";
    const { places, full } = await fetchCell(term, cellRect(grid.v, path), signal);
    return { items: toBusinesses(places, q), next: advanceGrid(grid, full, MAX_DEPTH) };
  },
};
