import "server-only";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { gunzipSync } from "node:zlib";
import ibgeCodes from "@/lib/domain/data/municipios-ibge.json";
import { cleanValue } from "@/lib/env";
import { logger } from "@/lib/logger";

/** Endereço público do site (a base fica na CDN dele). Sem importar o app inteiro (scripts usam este módulo). */
function siteUrl() {
  const fromEnv = process.env.NEXT_PUBLIC_APP_URL ? cleanValue(process.env.NEXT_PUBLIC_APP_URL).replace(/\/$/, "") : "";
  if (fromEnv) return fromEnv;
  if (process.env.VERCEL_URL) return `https://${process.env.VERCEL_URL}`;
  return "http://localhost:3000";
}

/**
 * Base de empresas do OpenStreetMap do Brasil já separada por estado, categoria e município
 * (IBGE), gerada por scripts/build-osm-data.mjs e publicada em public/osm/<UF>/<categoria>.json.gz.
 *
 * É o que deixa a busca em segundos: em vez de esperar os servidores públicos do Overpass
 * (10–40 s por cidade, quando respondem), a busca lê um arquivo pequeno (cache em memória
 * da instância depois da primeira vez). O Overpass ao vivo fica só de reserva.
 *
 * Arquivo: { v: 1, at: "AAAA-MM-DD", cities: { "<código IBGE>": Registro[] } }
 * Registro: [id, lat, lon, ...FIELDS] (posições fixas; campo ausente = 0; zeros do fim cortados).
 */
export const FIELDS = [
  "name", "addr:street", "addr:housenumber", "addr:suburb", "addr:neighbourhood", "phone", "contact:phone", "mobile", "contact:mobile",
  "whatsapp", "contact:whatsapp", "website", "contact:website", "url", "instagram", "contact:instagram", "facebook", "contact:facebook",
  "opening_hours", "description",
] as const;

type Row = [string, number, number, ...(string | 0)[]];
type Shard = { v: number; at: string; cities: Record<string, Row[]> };

export type DatasetElement = { type: "node" | "way"; id: number; lat: number; lon: number; tags: Record<string, string> };

const CODES = ibgeCodes as Record<string, number>;
/** código IBGE → { nome, UF } (para a busca geral percorrer só cidades que têm empresas) */
const BY_CODE = new Map<string, { name: string; uf: string }>();
for (const [key, code] of Object.entries(CODES)) {
  const [uf, name] = key.split("|");
  BY_CODE.set(String(code), { name, uf });
}

export function ibgeFor(city: string, uf: string) {
  const code = CODES[`${uf.toUpperCase()}|${city}`];
  return code === undefined ? null : String(code);
}

/* Cache em memória por instância: poucos MB, e cada arquivo é lido uma vez por instância. */
const MAX_SHARDS = 120;
const g = globalThis as unknown as { __osmShards?: Map<string, Promise<Shard | null>> };
const shards: Map<string, Promise<Shard | null>> = (g.__osmShards ??= new Map());

function decode(buf: Buffer): Shard {
  const raw = buf[0] === 0x1f && buf[1] === 0x8b ? gunzipSync(buf) : buf;
  return JSON.parse(raw.toString("utf8")) as Shard;
}

async function fetchShard(uf: string, slug: string): Promise<Shard | null> {
  const rel = `osm/${uf}/${slug}.json.gz`;
  // 1) disco (dev e `next start` locais têm public/ ao lado)
  try {
    return decode(await readFile(join(process.cwd(), "public", rel)));
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code !== "ENOENT") throw err;
  }
  // 2) CDN do próprio site (na Vercel, public/ não fica dentro da função)
  const res = await fetch(`${siteUrl()}/${rel}`, { signal: AbortSignal.timeout(10_000) });
  if (res.status === 404) return null; // categoria sem nenhuma empresa nesse estado
  if (!res.ok) throw new Error(`base OSM respondeu ${res.status}`);
  return decode(Buffer.from(await res.arrayBuffer()));
}

type Index = { v: number; at: string; counts: Record<string, Record<string, number>> };
const gi = globalThis as unknown as { __osmIndex?: Promise<Index | null> };

/** index.json: quantas empresas há por estado e categoria (só existe arquivo onde há alguma). */
function loadIndex(): Promise<Index | null> {
  gi.__osmIndex ??= (async () => {
    try {
      return JSON.parse(await readFile(join(process.cwd(), "public", "osm", "index.json"), "utf8")) as Index;
    } catch {
      try {
        const res = await fetch(`${siteUrl()}/osm/index.json`, { signal: AbortSignal.timeout(8_000) });
        return res.ok ? ((await res.json()) as Index) : null;
      } catch {
        return null;
      }
    }
  })().then((ix) => {
    if (!ix) gi.__osmIndex = undefined; // sem índice: tenta de novo na próxima busca
    return ix;
  });
  return gi.__osmIndex;
}

export async function loadShard(uf: string, slug: string): Promise<Shard | null> {
  const index = await loadIndex();
  // Categoria sem nenhuma empresa neste estado: resposta certa é "nenhuma", sem consultar nada
  if (index && !index.counts[uf]?.[slug]) return null;
  return loadShardFile(uf, slug);
}

function loadShardFile(uf: string, slug: string): Promise<Shard | null> {
  const key = `${uf}/${slug}`;
  let p = shards.get(key);
  if (!p) {
    p = fetchShard(uf, slug).catch((err) => {
      shards.delete(key); // erro não fica em cache: a próxima busca tenta de novo
      throw err;
    });
    shards.set(key, p);
    if (shards.size > MAX_SHARDS) shards.delete(shards.keys().next().value!);
  }
  return p;
}

function toElement(row: Row): DatasetElement {
  const [id, lat, lon, ...values] = row;
  const tags: Record<string, string> = {};
  values.forEach((v, i) => {
    if (v) tags[FIELDS[i]] = v;
  });
  return { type: id[0] === "w" ? "way" : "node", id: Number(id.slice(1)), lat, lon, tags };
}

/** Empresas da categoria no município (lista completa, na ordem do arquivo). null = sem base. */
export async function datasetBusinesses(slug: string, city: string, uf: string): Promise<DatasetElement[] | null> {
  const code = ibgeFor(city, uf);
  if (!code) return null;
  const shard = await loadShard(uf.toUpperCase(), slug);
  if (!shard) return [];
  return (shard.cities[code] ?? []).map(toElement);
}

/**
 * Cidades de uma UF com pelo menos uma empresa das categorias (busca geral: nada de consultar
 * as milhares de cidades vazias). Retorna "Nome|UF" → quantidade.
 */
export async function citiesWithData(uf: string, slugs: string[]) {
  const counts = new Map<string, number>();
  await Promise.all(
    slugs.map(async (slug) => {
      const shard = await loadShard(uf, slug).catch((err) => {
        logger.warn("base OSM: estado indisponível", { uf, slug, err: String(err) });
        throw err;
      });
      for (const [code, rows] of Object.entries(shard?.cities ?? {})) {
        const c = BY_CODE.get(code);
        if (c) counts.set(`${c.name}|${c.uf}`, (counts.get(`${c.name}|${c.uf}`) ?? 0) + rows.length);
      }
    }),
  );
  return counts;
}
