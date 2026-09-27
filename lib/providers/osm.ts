import "server-only";
import { getCategory } from "@/lib/domain/categories";
import { env } from "@/lib/env";
import { ProviderError, type DataProvider, type ProviderBusiness, type ProviderQuery } from "@/lib/providers/types";

/**
 * OpenStreetMap via Overpass API — fonte REAL, gratuita e aberta (ODbL).
 * Pontos fortes: site, telefone, Instagram/WhatsApp quando mapeados, horários.
 * Limitação: não possui avaliações (o score trata como "sem dados", não como zero).
 * Uso responsável: 1 requisição por vez, cache de 7 dias, User-Agent identificado.
 * Política: https://wiki.openstreetmap.org/wiki/Overpass_API#Public_Overpass_API_instances
 */

type OsmElement = {
  type: "node" | "way" | "relation";
  id: number;
  lat?: number;
  lon?: number;
  center?: { lat: number; lon: number };
  tags?: Record<string, string>;
};

const FALLBACK_ENDPOINTS = ["https://overpass-api.de/api/interpreter", "https://maps.mail.ru/osm/tools/overpass/api/interpreter", "https://overpass.kumi.systems/api/interpreter"];

const DAY: Record<string, string> = { Mo: "Seg", Tu: "Ter", We: "Qua", Th: "Qui", Fr: "Sex", Sa: "Sáb", Su: "Dom", PH: "Feriados" };

function osmString(s: string) {
  return s.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
}

function filterToQl(f: string) {
  if (f.startsWith("[")) return f;
  const [k, v] = f.split("=");
  return `["${osmString(k)}"="${osmString(v)}"]`;
}

export function buildOverpassQuery(q: ProviderQuery, filters: string[]) {
  const parts = filters.map((f) => `  nwr(area.city)${filterToQl(f)}["name"];`).join("\n");
  return `[out:json][timeout:25];
area["ISO3166-2"="BR-${osmString(q.uf)}"]->.uf;
rel(area.uf)["boundary"="administrative"]["admin_level"="8"]["name"="${osmString(q.city)}"];
map_to_area->.city;
(
${parts}
);
out center tags ${Math.min(q.limit, 500)};`;
}

function translateHours(raw?: string) {
  if (!raw) return [];
  return raw
    .split(";")
    .map((p) => p.trim())
    .filter(Boolean)
    .map((p) => p.replace(/\b(Mo|Tu|We|Th|Fr|Sa|Su|PH)\b/g, (d) => DAY[d]).replace(/\boff\b/g, "fechado").replace("24/7", "24 horas"))
    .slice(0, 7);
}

function instagramHandle(raw?: string) {
  if (!raw) return null;
  const m = raw.match(/instagram\.com\/([A-Za-z0-9._]+)/i);
  const h = (m ? m[1] : raw).replace(/^@/, "").trim();
  return /^[A-Za-z0-9._]{2,30}$/.test(h) ? h : null;
}

export function mapOsmElement(el: OsmElement, q: ProviderQuery): ProviderBusiness | null {
  const t = el.tags ?? {};
  if (!t.name) return null;
  const street = [t["addr:street"], t["addr:housenumber"]].filter(Boolean).join(", ");
  const neighborhood = t["addr:suburb"] ?? t["addr:neighbourhood"] ?? null;
  const phone = (t["contact:phone"] ?? t.phone ?? t["contact:mobile"] ?? "").split(";")[0].trim() || null;
  return {
    externalId: `osm:${el.type}/${el.id}`,
    name: t.name,
    address: street ? `${street}${neighborhood ? ` — ${neighborhood}` : ""}` : null,
    neighborhood,
    city: q.city,
    state: q.uf,
    phone,
    whatsapp: (t["contact:whatsapp"] ?? "").split(";")[0].trim() || null,
    website: t.website ?? t["contact:website"] ?? null,
    instagram: instagramHandle(t["contact:instagram"] ?? t.instagram),
    facebook: t["contact:facebook"] ?? t.facebook ?? null,
    mapsUrl: `https://www.openstreetmap.org/${el.type}/${el.id}`,
    rating: null,
    reviewCount: null,
    openingHours: translateHours(t.opening_hours),
    description: t.description ?? null,
    services: [],
    latitude: el.lat ?? el.center?.lat ?? null,
    longitude: el.lon ?? el.center?.lon ?? null,
  };
}

export const osmProvider: DataProvider = {
  id: "osm",
  label: "OpenStreetMap",
  description: "Dados reais e gratuitos do OpenStreetMap. Sem avaliações; cobertura varia por cidade.",
  isDemo: false,
  capabilities: { reviews: false, instagram: true, whatsapp: true, maxResults: 500 },
  cacheTtlMs: 7 * 24 * 60 * 60 * 1000,
  minIntervalMs: 1500,
  isConfigured: () => true,
  async search(q, signal) {
    const cat = getCategory(q.category);
    if (cat.osm.length === 0) {
      throw new ProviderError(`O OpenStreetMap não cobre a categoria “${cat.plural}”. Tente outra fonte.`);
    }
    // Instâncias públicas oscilam (429/504). Tenta a configurada e depois as alternativas.
    const endpoints = [...new Set([env().OVERPASS_URL, ...FALLBACK_ENDPOINTS])];
    const body = new URLSearchParams({ data: buildOverpassQuery(q, cat.osm) });
    let json: { elements?: OsmElement[] } | null = null;
    let lastStatus = 0;
    for (const url of endpoints) {
      try {
        const res = await fetch(url, {
          method: "POST",
          headers: {
            "Content-Type": "application/x-www-form-urlencoded",
            Accept: "application/json",
            "User-Agent": "LeadScan/0.2 (prospeccao comercial; contato via app)",
          },
          body,
          signal: signal ?? AbortSignal.timeout(40_000),
          cache: "no-store",
        });
        lastStatus = res.status;
        if (res.ok) {
          json = (await res.json()) as { elements?: OsmElement[] };
          break;
        }
        if (res.status !== 429 && res.status < 500) throw new ProviderError(`OpenStreetMap respondeu ${res.status}.`);
      } catch (err) {
        if (err instanceof ProviderError) throw err;
        lastStatus = 0; // timeout/rede: tenta a próxima instância
      }
    }
    if (!json) {
      throw new ProviderError(
        lastStatus === 429 ? "Limite do OpenStreetMap atingido. Tente em alguns minutos." : "Os servidores do OpenStreetMap estão ocupados. Tente novamente em instantes.",
        true,
      );
    }
    const seen = new Set<string>();
    return (json.elements ?? [])
      .map((el) => mapOsmElement(el, q))
      .filter((b): b is ProviderBusiness => {
        if (!b) return false;
        const key = b.name.toLowerCase();
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      })
      .slice(0, q.limit);
  },
};
