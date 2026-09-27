import "server-only";
import { getCategory } from "@/lib/domain/categories";
import ibgeCodes from "@/lib/domain/data/municipios-ibge.json";
import { env } from "@/lib/env";
import { logger } from "@/lib/logger";
import { ProviderError, type DataProvider, type ProviderBusiness, type ProviderQuery } from "@/lib/providers/types";
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
out center tags ${Math.min(q.limit, 500)};`;
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

export const osmProvider: DataProvider = {
  id: "osm",
  label: "OpenStreetMap",
  description: "Dados reais e gratuitos do OpenStreetMap. Sem avaliações; cobertura varia por cidade.",
  isDemo: false,
  capabilities: {
    reviews: false,
    instagram: true,
    whatsapp: true,
    maxResults: 500,
  },
  cacheTtlMs: 7 * 24 * 60 * 60 * 1000,
  minIntervalMs: 400,
  // o rodízio de servidores já é a nova tentativa
  maxAttempts: 1,
  // 2 servidores públicos costumam estar de pé; mais que isso só enfileira neles
  concurrency: 2,
  isConfigured: () => true,
  async search(q, signal) {
    const cat = getCategory(q.category);
    if (cat.osm.length === 0) {
      throw new ProviderError(`O OpenStreetMap não cobre a categoria “${cat.plural}”. Tente outra fonte.`);
    }
    const deadline = Date.now() + PER_CITY_MS;
    const byCode = ibgeCode(q.city, q.uf) !== null;
    let json = await overpass(buildOverpassQuery(q, cat.osm), q.hint, deadline, signal);
    if (byCode && json && !json.elements?.some((e) => e.type === "area")) {
      json = await overpass(buildOverpassQuery(q, cat.osm, { byName: true }), (q.hint ?? 0) + 1, deadline, signal);
    }
    const seen = new Set<string>();
    return (json?.elements ?? [])
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
