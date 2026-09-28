import "server-only";
import { getCategory } from "@/lib/domain/categories";
import ibgeCodes from "@/lib/domain/data/municipios-ibge.json";
import { env } from "@/lib/env";
import { logger } from "@/lib/logger";
import { cachedProviderCall } from "@/lib/providers/cache";
import { citiesWithData, datasetBusinesses, datasetCounts } from "@/lib/providers/osm-dataset";
import { ProviderError, type DataProvider, type ProviderBusiness, type ProviderQuery, type SweepPage } from "@/lib/providers/types";
import { hashKey } from "@/lib/hash";
import { STATES } from "@/lib/domain/geo";
import { normalizeBrazilPhone, pickPhone } from "@/lib/whatsapp/phone";

/**
 * OpenStreetMap via Overpass API — fonte REAL, gratuita e aberta (ODbL).
 * Pontos fortes: site, telefone, Instagram/WhatsApp quando mapeados, horários.
 * Limitação: não possui avaliações (o score trata como "sem dados", não como zero).
 *
 * As instâncias públicas vivem sobrecarregadas (504/429, ou simplesmente não respondem).
 * Por isso: tempo curto por servidor, rodízio entre 4 instâncias (cada cidade começa por uma
 * diferente, então várias cidades rodam em paralelo sem fila no mesmo servidor) e um teto de
 * tempo por cidade — a busca nunca fica "pendurada".
 * Política: https://wiki.openstreetmap.org/wiki/Overpass_API#Public_Overpass_API_instances
 */

type OsmElement = {
  type: "node" | "way" | "relation" | "area";
  id: number;
  lat?: number;
  lon?: number;
  center?: { lat: number; lon: number };
  tags?: Record<string, string>;
};

/**
 * Principais: os que costumam responder (as buscas em paralelo se dividem entre eles).
 * Reserva: instáveis — só entram se os principais falharem, e com espera menor.
 * Ordem fixa importa: na Vercel cada instância nova começa sem saber quem está fora do ar.
 */
const PRIMARY_ENDPOINTS = ["https://overpass-api.de/api/interpreter", "https://maps.mail.ru/osm/tools/overpass/api/interpreter"];
const BACKUP_ENDPOINTS = ["https://overpass.kumi.systems/api/interpreter", "https://overpass.private.coffee/api/interpreter"];
/** Tempo máximo esperando UM servidor (principal / reserva); e o teto de uma cidade inteira. */
const PER_SERVER_MS = 22_000;
const PER_BACKUP_MS = 10_000;
const PER_CITY_MS = 50_000;
/** Servidor que deu tempo esgotado/5xx/429 fica de castigo: as próximas consultas nem tentam nele. */
const DOWN_FOR_MS = 2 * 60_000;
const g = globalThis as unknown as { __osmHealth?: Map<string, number> };
const downUntil: Map<string, number> = (g.__osmHealth ??= new Map());

function markDown(url: string) {
  downUntil.set(url, Date.now() + DOWN_FOR_MS);
}
function markUp(url: string) {
  downUntil.delete(url);
}

const DAY: Record<string, string> = {
  Mo: "Seg",
  Tu: "Ter",
  We: "Qua",
  Th: "Qui",
  Fr: "Sex",
  Sa: "Sáb",
  Su: "Dom",
  PH: "Feriados",
};

function osmString(s: string) {
  return s.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
}

function filterToQl(f: string) {
  if (f.startsWith("[")) return f;
  const [k, v] = f.split("=");
  return `["${osmString(k)}"="${osmString(v)}"]`;
}

const CODES = ibgeCodes as Record<string, number>;

/** Código IBGE do município (o OpenStreetMap marca cada município com IBGE:GEOCODIGO). */
export function ibgeCode(city: string, uf: string) {
  return CODES[`${uf.toUpperCase()}|${city}`] ?? null;
}

/**
 * Consulta Overpass. Com o código IBGE, a área do município sai direto de um índice
 * (2x mais rápido que achar a UF e depois a relação pelo nome — medido: 4,8 s x 10,5 s em Curitiba).
 * `.city out ids` devolve a própria área: se ela não vier, o município não tem o código no
 * OpenStreetMap e a busca refaz pelo nome (`byName`).
 */
export function buildOverpassQuery(q: ProviderQuery, filters: string[], opts: { byName?: boolean } = {}) {
  const parts = filters.map((f) => `  nwr(area.city)${filterToQl(f)}["name"];`).join("\n");
  const code = opts.byName ? null : ibgeCode(q.city, q.uf);
  const area = code
    ? `area["IBGE:GEOCODIGO"="${code}"]->.city;
.city out ids;`
    : `area["ISO3166-2"="BR-${osmString(q.uf)}"]->.uf;
rel(area.uf)["boundary"="administrative"]["admin_level"="8"]["name"="${osmString(q.city)}"];
map_to_area->.city;`;
  return `[out:json][timeout:20];
${area}
(
${parts}
);
out center tags ${Math.min(q.limit, 1000)};`;
}

function translateHours(raw?: string) {
  if (!raw) return [];
  return raw
    .split(";")
    .map((p) => p.trim())
    .filter(Boolean)
    .map((p) =>
      p
        .replace(/\b(Mo|Tu|We|Th|Fr|Sa|Su|PH)\b/g, (d) => DAY[d])
        .replace(/\boff\b/g, "fechado")
        .replace("24/7", "24 horas"),
    )
    .slice(0, 7);
}

function instagramHandle(raw?: string) {
  if (!raw) return null;
  const m = raw.match(/instagram\.com\/([A-Za-z0-9._]+)/i);
  const h = (m ? m[1] : raw).replace(/^@/, "").trim();
  return /^[A-Za-z0-9._]{2,30}$/.test(h) ? h : null;
}

/** Google Maps pela busca "nome, endereço, cidade" — abre a ficha do negócio sem chave de API. */
export function googleMapsSearchUrl(parts: (string | null | undefined)[]) {
  const query = parts.filter(Boolean).join(", ");
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}`;
}

export function mapOsmElement(el: OsmElement, q: ProviderQuery): ProviderBusiness | null {
  const t = el.tags ?? {};
  if (!t.name) return null;
  const street = [t["addr:street"], t["addr:housenumber"]].filter(Boolean).join(", ");
  const neighborhood = t["addr:suburb"] ?? t["addr:neighbourhood"] ?? null;
  // Telefones podem vir em vários campos e com vários números no mesmo campo: fica o melhor (celular primeiro)
  const phone = pickPhone([t["contact:mobile"], t.mobile, t["contact:phone"], t.phone].filter(Boolean).join(" ; "));
  // WhatsApp só quando o próprio cadastro declara (não inventamos a partir do celular)
  const whatsappRaw = t["contact:whatsapp"] ?? t.whatsapp ?? null;
  const whatsapp = whatsappRaw ? (pickPhone(whatsappRaw) ?? normalizeBrazilPhone(whatsappRaw.replace(/\D/g, ""))) : null;
  return {
    externalId: `osm:${el.type}/${el.id}`,
    name: t.name,
    address: street ? `${street}${neighborhood ? ` — ${neighborhood}` : ""}` : null,
    neighborhood,
    city: q.city,
    state: q.uf,
    phone: phone?.national ?? null,
    whatsapp: whatsapp?.national ?? null,
    website: t.website ?? t["contact:website"] ?? t.url ?? null,
    instagram: instagramHandle(t["contact:instagram"] ?? t.instagram),
    facebook: t["contact:facebook"] ?? t.facebook ?? null,
    mapsUrl: googleMapsSearchUrl([t.name, street || null, neighborhood, `${q.city} - ${q.uf}`]),
    rating: null,
    reviewCount: null,
    openingHours: translateHours(t.opening_hours),
    description: t.description ?? null,
    services: [],
    latitude: el.lat ?? el.center?.lat ?? null,
    longitude: el.lon ?? el.center?.lon ?? null,
  };
}

/**
 * Ordem de tentativa: servidores que estão respondendo primeiro (cada cidade paralela começa
 * por um diferente), os de castigo por último — só são tentados se todos os bons falharem.
 */
function endpoints(hint = 0) {
  const primary = [...new Set([env().OVERPASS_URL, ...PRIMARY_ENDPOINTS])];
  const backup = BACKUP_ENDPOINTS.filter((u) => !primary.includes(u));
  const now = Date.now();
  const isUp = (u: string) => (downUntil.get(u) ?? 0) <= now;
  const up = primary.filter(isUp);
  const start = up.length ? Math.abs(hint) % up.length : 0;
  // principais de pé (cada busca paralela começa por um) → reservas de pé → quem está de castigo
  return [...up.slice(start), ...up.slice(0, start), ...backup.filter(isUp), ...primary.filter((u) => !isUp(u)), ...backup.filter((u) => !isUp(u))];
}

const isBackup = (url: string) => BACKUP_ENDPOINTS.includes(url);

/** Tamanho de cada pedaço da varredura na base do Brasil (a cidade inteira já está no arquivo). */
const DATASET_PAGE = 250;
const LIVE_CACHE_MS = 30 * 24 * 60 * 60 * 1000;

/** Quem tem como ser contatado vem primeiro: telefone/WhatsApp, depois Instagram/site. */
function contactRank(t: Record<string, string>) {
  const phone = t.phone || t["contact:phone"] || t.mobile || t["contact:mobile"] || t.whatsapp || t["contact:whatsapp"];
  return (phone ? 0 : 2) + (t.instagram || t["contact:instagram"] || t.website || t["contact:website"] ? 0 : 1);
}

function mapUnique(elements: OsmElement[], q: ProviderQuery) {
  const seen = new Set<string>();
  return elements
    .map((el) => mapOsmElement(el, q))
    .filter((b): b is ProviderBusiness => {
      if (!b) return false;
      const key = b.name.toLowerCase();
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
}

/** Cidade inteira da base do Brasil, ordenada por quem dá para contatar. null = sem base. */
async function fromDataset(q: ProviderQuery) {
  const els = await datasetBusinesses(q.category, q.city, q.uf);
  if (!els) return null;
  const sorted = els.map((el, i) => ({ el, i, r: contactRank(el.tags) })).sort((a, b) => a.r - b.r || a.i - b.i);
  return mapUnique(sorted.map((x) => x.el as OsmElement), q);
}

/** Overpass ao vivo (reserva): cache de 30 dias no banco, compartilhado por todos. */
async function liveSearch(q: ProviderQuery, signal?: AbortSignal) {
  const key = hashKey("osm-live", q.category, q.city.toLowerCase(), q.uf);
  return cachedProviderCall(key, "osm", LIVE_CACHE_MS, async () => {
    const cat = getCategory(q.category);
    const deadline = Date.now() + PER_CITY_MS;
    const byCode = ibgeCode(q.city, q.uf) !== null;
    let json = await overpass(buildOverpassQuery({ ...q, limit: 1000 }, cat.osm), q.hint, deadline, signal);
    if (byCode && json && !json.elements?.some((e) => e.type === "area")) {
      json = await overpass(buildOverpassQuery({ ...q, limit: 1000 }, cat.osm, { byName: true }), (q.hint ?? 0) + 1, deadline, signal);
    }
    return mapUnique(json?.elements ?? [], q);
  });
}

/** A cidade toda: base do Brasil; se ela falhar (rede), o Overpass ao vivo. */
async function cityBusinesses(q: ProviderQuery, signal?: AbortSignal) {
  const cat = getCategory(q.category);
  if (cat.osm.length === 0) throw new ProviderError(`O OpenStreetMap não cobre a categoria “${cat.plural}”. Tente outra fonte.`);
  try {
    const list = await fromDataset(q);
    if (list) return list;
  } catch (err) {
    logger.warn("base OSM indisponível", { city: q.city, uf: q.uf, regional: !!q.regional, err: String(err) });
    // Busca geral: melhor avisar já do que consultar o Overpass (lento) em dezenas de cidades
    if (q.regional) throw new ProviderError("A base de empresas não carregou agora. Tente de novo em instantes.", true);
  }
  return liveSearch(q, signal);
}

export const osmProvider: DataProvider = {
  id: "osm",
  label: "OpenStreetMap",
  description: "Dados reais e gratuitos do OpenStreetMap. Sem avaliações; cobertura varia por cidade.",
  isDemo: false,
  capabilities: {
    reviews: false,
    instagram: true,
    whatsapp: true,
    // a cidade inteira numa consulta: a varredura segue por ela até a última empresa
    maxResults: 1000,
  },
  // A base do Brasil já vem do próprio site (sem banco); o Overpass de reserva tem cache próprio.
  cacheTtlMs: 0,
  minIntervalMs: 0,
  maxAttempts: 1,
  // leitura local: várias cidades ao mesmo tempo sem fila (a rodada grava tudo numa leva só)
  concurrency: 20,
  isConfigured: () => true,
  async search(q, signal) {
    return (await cityBusinesses(q, signal)).slice(0, q.limit);
  },
  // Varredura em pedaços: a cidade inteira está na base; cada busca continua de onde parou
  async sweep(q, cursor, signal): Promise<SweepPage> {
    const all = await cityBusinesses(q, signal);
    const offset = cursor && typeof cursor === "object" && "offset" in cursor ? Number((cursor as { offset: number }).offset) || 0 : 0;
    const items = all.slice(offset, offset + DATASET_PAGE);
    const next = offset + DATASET_PAGE < all.length ? { offset: offset + DATASET_PAGE } : null;
    return { items, next };
  },
  async regionCities(uf, categories) {
    const ufs = uf ? [uf.toUpperCase()] : STATES.map((s) => s.uf);
    const maps = await Promise.all(ufs.map((u) => citiesWithData(u, categories)));
    const all = new Map<string, number>();
    for (const m of maps) for (const [k, v] of m) all.set(k, v);
    return all;
  },
  categoryCounts: () => datasetCounts(),
};

/** Uma consulta com rodízio de servidores dentro do prazo. Erro claro se nenhum responder. */
async function overpass(query: string, hint: number | undefined, deadline: number, signal?: AbortSignal) {
  const body = new URLSearchParams({ data: query }).toString();
  let json: { elements?: OsmElement[]; remark?: string } | null = null;
  let lastStatus = 0;
  for (const url of endpoints(hint)) {
    const left = deadline - Date.now();
    if (left < 4_000) break;
    const startedAt = Date.now();
    const server = url.split("/")[2];
    try {
      const res = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
          Accept: "application/json",
          "User-Agent": "LeadScan/0.3 (prospeccao comercial; contato via app)",
        },
        body,
        signal: (() => {
          const wait = AbortSignal.timeout(Math.min(isBackup(url) ? PER_BACKUP_MS : PER_SERVER_MS, left));
          return signal ? AbortSignal.any([signal, wait]) : wait;
        })(),
        cache: "no-store",
      });
      lastStatus = res.status;
      if (!res.ok) logger.info("overpass: servidor recusou", { server, status: res.status, ms: Date.now() - startedAt });
      if (res.status === 429 || res.status >= 500) markDown(url);
      if (res.ok) {
        const data = (await res.json().catch(() => null)) as {
          elements?: OsmElement[];
          remark?: string;
        } | null;
        // "runtime error: Query timed out" vem com 200 e sem elementos: vale tentar outro servidor
        if (data && !(data.remark && /timed out|out of memory/i.test(data.remark) && !data.elements?.length)) {
          markUp(url);
          json = data;
          break;
        }
        logger.info("overpass: resposta sem dados", { server, remark: data?.remark?.slice(0, 120), ms: Date.now() - startedAt });
        markDown(url);
        continue;
      }
      if (res.status === 400) throw new ProviderError("O OpenStreetMap não entendeu a consulta desta cidade.");
    } catch (err) {
      if (err instanceof ProviderError) throw err;
      if (signal?.aborted) throw new ProviderError("Busca cancelada.");
      logger.info("overpass: sem resposta", { server, err: String((err as Error)?.name ?? err), cause: String((err as { cause?: { code?: string } })?.cause?.code ?? ""), ms: Date.now() - startedAt });
      markDown(url);
      lastStatus = 0; // tempo esgotado ou rede: próximo servidor
    }
  }
  if (!json) {
    throw new ProviderError(
      lastStatus === 429
        ? "Limite do OpenStreetMap atingido. Tente em alguns minutos."
        : "Os servidores gratuitos do OpenStreetMap estão lentos agora. Tente de novo em instantes.",
      true,
    );
  }
  return json;
}
