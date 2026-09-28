/**
 * Base de empresas do OpenStreetMap do Brasil, pronta para a busca responder em segundos.
 *
 * Por quê: os servidores públicos do Overpass levam 10–40 s por cidade (quando respondem) e
 * bloqueiam consultas seguidas. Aqui o recorte do Brasil (Geofabrik, ~2 GB) é lido UMA vez,
 * cada empresa das nossas categorias vai para o município certo (contorno oficial do IBGE) e
 * sai um arquivo compactado por estado e categoria em public/osm/<UF>/<categoria>.json.gz.
 * A busca lê esses arquivos (CDN da Vercel + cache em memória), sem fila e sem servidor externo.
 *
 * Uso (refazer 1x por mês para pegar empresas novas):
 *   curl -L -o brazil.osm.pbf https://download.geofabrik.de/south-america/brazil-latest.osm.pbf
 *   for uf in AC AL ...; do curl -o malhas/$uf.json "https://servicodados.ibge.gov.br/api/v3/malhas/estados/$uf?intrarregiao=municipio&formato=application/vnd.geo%2Bjson&qualidade=intermediaria"; done
 *   npx tsx scripts/export-categories.mts categories.json
 *   node scripts/build-osm-data.mjs brazil.osm.pbf malhas categories.json public/osm
 *
 * Dados © colaboradores do OpenStreetMap (ODbL). Malhas municipais: IBGE.
 */
import { Worker, isMainThread, parentPort, workerData } from "node:worker_threads";
import { openSync, readSync, closeSync, fstatSync, readFileSync, writeFileSync, mkdirSync, readdirSync, rmSync } from "node:fs";
import { gzipSync, inflateSync } from "node:zlib";
import { cpus } from "node:os";
import { fileURLToPath } from "node:url";
import Pbf from "pbf";

/** Chaves que decidem se um elemento pode ser empresa (o resto nem é olhado). */
const INTEREST = ["shop", "amenity", "craft", "office", "healthcare", "leisure", "tourism"];
/** Chaves guardadas (as que o mapeamento do app usa) + as que os filtros das categorias leem. */
const KEEP = [
  "name", "addr:street", "addr:housenumber", "addr:suburb", "addr:neighbourhood", "addr:city",
  "contact:mobile", "mobile", "contact:phone", "phone", "contact:whatsapp", "whatsapp",
  "website", "contact:website", "url", "contact:instagram", "instagram", "contact:facebook", "facebook",
  "opening_hours", "description",
  ...INTEREST, "cuisine", "sport", "service:vehicle:tyres", "operator:type",
];
const KEEP_SET = new Set(KEEP);

/* ─────────────────────── filtros das categorias ─────────────────────── */

/** "shop=beauty" ou Overpass QL ['["amenity"="restaurant"]["cuisine"~"pizza"]'] → função(tags). */
function compileFilter(f) {
  if (!f.startsWith("[")) {
    const [k, v] = f.split("=");
    return (t) => t[k] === v;
  }
  const conds = [...f.matchAll(/\["([^"]+)"(?:(=|~)"([^"]*)"(,i)?)?\]/g)].map(([, k, op, v, ci]) => {
    if (!op) return (t) => t[k] !== undefined;
    if (op === "=") return (t) => t[k] === v;
    const re = new RegExp(v, ci ? "i" : "");
    return (t) => t[k] !== undefined && re.test(t[k]);
  });
  return (t) => conds.every((c) => c(t));
}

function compileCategories(categories) {
  return categories
    .filter((c) => c.osm.length)
    .map((c) => ({ slug: c.slug, tests: c.osm.map(compileFilter) }));
}

function matchCategories(cats, tags) {
  if (!tags.name) return null;
  const hit = [];
  for (const c of cats) if (c.tests.some((test) => test(tags))) hit.push(c.slug);
  return hit.length ? hit : null;
}

/* ─────────────────────── leitura do PBF (workers) ─────────────────────── */

function readBlob(buf) {
  const pbf = new Pbf(buf);
  const blob = {};
  pbf.readFields((tag, b, p) => {
    if (tag === 1) b.raw = p.readBytes();
    else if (tag === 2) b.rawSize = p.readVarint();
    else if (tag === 3) b.zlib = p.readBytes();
  }, blob);
  if (blob.raw) return blob.raw;
  if (blob.zlib) return inflateSync(blob.zlib);
  throw new Error("Blob sem zlib/raw (compressão não suportada)");
}

function decodeBlock(data, mode, needed) {
  const pbf = new Pbf(data);
  const strings = [];
  const groups = [];
  let granularity = 100;
  let latOffset = 0;
  let lonOffset = 0;
  pbf.readFields((tag, _, p) => {
    if (tag === 1) {
      const end = p.readVarint() + p.pos;
      while (p.pos < end) {
        const t = p.readVarint();
        if (t >> 3 === 1) strings.push(p.readString());
        else p.skip(t);
      }
    } else if (tag === 2) {
      const len = p.readVarint();
      groups.push([p.pos, p.pos + len]);
      p.pos += len;
    } else if (tag === 17) granularity = p.readVarint();
    else if (tag === 19) latOffset = p.readVarint(true);
    else if (tag === 20) lonOffset = p.readVarint(true);
  });
  const coord = (off, v) => (off + granularity * v) / 1e9;
  const interesting = new Set();
  strings.forEach((s, i) => INTEREST.includes(s) && interesting.add(i));
  const out = { nodes: [], ways: [], coords: [], hasWays: false, hasNodes: false };
  const tagsFrom = (keys, vals) => {
    const t = {};
    for (let i = 0; i < keys.length; i++) {
      const k = strings[keys[i]];
      if (KEEP_SET.has(k)) t[k] = strings[vals[i]];
    }
    return t;
  };

  for (const [start, end] of groups) {
    pbf.pos = start;
    while (pbf.pos < end) {
      const t = pbf.readVarint();
      const field = t >> 3;
      const len = pbf.readVarint();
      const msgEnd = pbf.pos + len;
      if (field === 2) {
        // DenseNodes
        out.hasNodes = true;
        let ids = [];
        let lats = [];
        let lons = [];
        let kv = [];
        while (pbf.pos < msgEnd) {
          const tt = pbf.readVarint();
          const f = tt >> 3;
          if (f === 1) ids = pbf.readPackedSVarint([]);
          else if (f === 8) lats = pbf.readPackedSVarint([]);
          else if (f === 9) lons = pbf.readPackedSVarint([]);
          else if (f === 10) kv = pbf.readPackedVarint([]);
          else pbf.skip(tt);
        }
        let id = 0;
        let lat = 0;
        let lon = 0;
        let k = 0;
        for (let i = 0; i < ids.length; i++) {
          id += ids[i];
          lat += lats[i];
          lon += lons[i];
          if (mode === 2) {
            if (needed.has(id)) out.coords.push([id, coord(latOffset, lat), coord(lonOffset, lon)]);
            if (kv.length) while (kv[k] !== 0 && k < kv.length) k += 2;
            k++;
            continue;
          }
          if (!kv.length) continue;
          let candidate = false;
          const keys = [];
          const vals = [];
          while (k < kv.length && kv[k] !== 0) {
            keys.push(kv[k]);
            vals.push(kv[k + 1]);
            if (interesting.has(kv[k])) candidate = true;
            k += 2;
          }
          k++;
          if (!candidate) continue;
          const tags = tagsFrom(keys, vals);
          const cats = matchCategories(WORKER_CATS, tags);
          if (cats) out.nodes.push({ id: `n${id}`, lat: coord(latOffset, lat), lon: coord(lonOffset, lon), tags, cats });
        }
      } else if (field === 3 && mode === 1) {
        // Way
        out.hasWays = true;
        let id = 0;
        let keys = [];
        let vals = [];
        let first = null;
        while (pbf.pos < msgEnd) {
          const tt = pbf.readVarint();
          const f = tt >> 3;
          if (f === 1) id = pbf.readVarint();
          else if (f === 2) keys = pbf.readPackedVarint([]);
          else if (f === 3) vals = pbf.readPackedVarint([]);
          else if (f === 8) {
            const refEnd = pbf.readVarint() + pbf.pos;
            if (pbf.pos < refEnd) first = pbf.readSVarint();
            pbf.pos = refEnd;
          } else pbf.skip(tt);
        }
        if (first === null || !keys.some((x) => interesting.has(x))) continue;
        const tags = tagsFrom(keys, vals);
        const cats = matchCategories(WORKER_CATS, tags);
        if (cats) out.ways.push({ id: `w${id}`, ref: first, tags, cats });
      } else if (field === 1) {
        // Node simples (raro nos extratos da Geofabrik)
        out.hasNodes = true;
        let id = 0;
        let lat = 0;
        let lon = 0;
        let keys = [];
        let vals = [];
        while (pbf.pos < msgEnd) {
          const tt = pbf.readVarint();
          const f = tt >> 3;
          if (f === 1) id = pbf.readSVarint();
          else if (f === 2) keys = pbf.readPackedVarint([]);
          else if (f === 3) vals = pbf.readPackedVarint([]);
          else if (f === 8) lat = pbf.readSVarint();
          else if (f === 9) lon = pbf.readSVarint();
          else pbf.skip(tt);
        }
        if (mode === 2) {
          if (needed.has(id)) out.coords.push([id, coord(latOffset, lat), coord(lonOffset, lon)]);
          continue;
        }
        if (!keys.some((x) => interesting.has(x))) continue;
        const tags = tagsFrom(keys, vals);
        const cats = matchCategories(WORKER_CATS, tags);
        if (cats) out.nodes.push({ id: `n${id}`, lat: coord(latOffset, lat), lon: coord(lonOffset, lon), tags, cats });
      } else {
        if (field === 3) out.hasWays = true;
        pbf.pos = msgEnd;
      }
      pbf.pos = msgEnd;
    }
  }
  return out;
}

/** Filtros compilados dentro de cada worker (funções não atravessam threads). */
const WORKER_CATS = isMainThread ? [] : compileCategories(workerData.categories);

if (!isMainThread) {
  const needed = workerData.needed ? new Set(workerData.needed) : null;
  parentPort.on("message", ({ seq, buf }) => {
    try {
      const res = decodeBlock(readBlob(Buffer.from(buf)), workerData.mode, needed);
      parentPort.postMessage({ seq, res });
    } catch (err) {
      parentPort.postMessage({ seq, error: String(err?.stack ?? err) });
    }
  });
}

/* ─────────────────────── principal ─────────────────────── */

/** Lê blob a blob e distribui entre os workers (com limite de blobs em voo). */
async function scan(file, mode, categories, needed, stopAt = Infinity) {
  const fd = openSync(file, "r");
  const size = fstatSync(fd).size;
  const n = Math.max(1, Math.min(cpus().length - 1, 4));
  const workers = Array.from({ length: n }, () => new Worker(fileURLToPath(import.meta.url), { workerData: { mode, categories, needed: needed ? [...needed] : null } }));
  const results = [];
  let inflight = 0;
  let seq = 0;
  let pos = 0;
  let firstWayBlob = Infinity;
  let wake = null;
  const offsets = new Map();
  const onMessage = (msg) => {
    inflight--;
    if (msg.error) throw new Error(msg.error);
    results.push(msg.res);
    if (msg.res.hasWays) firstWayBlob = Math.min(firstWayBlob, offsets.get(msg.seq));
    offsets.delete(msg.seq);
    wake?.();
  };
  workers.forEach((w) => w.on("message", onMessage));
  const lenBuf = Buffer.alloc(4);
  const t0 = Date.now();
  let lastLog = 0;
  while (pos < size && pos < stopAt) {
    readSync(fd, lenBuf, 0, 4, pos);
    const hlen = lenBuf.readUInt32BE(0);
    const header = Buffer.alloc(hlen);
    readSync(fd, header, 0, hlen, pos + 4);
    const h = {};
    new Pbf(header).readFields((tag, o, p) => {
      if (tag === 1) o.type = p.readString();
      else if (tag === 3) o.datasize = p.readVarint();
    }, h);
    const blob = Buffer.alloc(h.datasize);
    readSync(fd, blob, 0, h.datasize, pos + 4 + hlen);
    const blobAt = pos;
    pos += 4 + hlen + h.datasize;
    if (h.type !== "OSMData") continue;
    while (inflight >= n * 3) await new Promise((r) => (wake = r));
    inflight++;
    offsets.set(seq, blobAt);
    workers[seq % n].postMessage({ seq, buf: blob }, [blob.buffer]);
    seq++;
    if (Date.now() - lastLog > 10_000) {
      lastLog = Date.now();
      console.log(`  passo ${mode}: ${((pos / size) * 100).toFixed(1)}% · ${Math.round((Date.now() - t0) / 1000)} s`);
    }
  }
  while (inflight > 0) await new Promise((r) => (wake = r));
  closeSync(fd);
  await Promise.all(workers.map((w) => w.terminate()));
  return { results, firstWayBlob };
}

/* ── municípios (IBGE) e ponto-no-polígono ── */

function loadMunicipalities(dir) {
  const list = [];
  for (const f of readdirSync(dir).filter((x) => x.endsWith(".json"))) {
    const uf = f.replace(".json", "");
    const gj = JSON.parse(readFileSync(`${dir}/${f}`, "utf8"));
    for (const ft of gj.features) {
      const polys = ft.geometry.type === "Polygon" ? [ft.geometry.coordinates] : ft.geometry.coordinates;
      let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
      for (const poly of polys) for (const [x, y] of poly[0]) {
        if (x < minX) minX = x;
        if (y < minY) minY = y;
        if (x > maxX) maxX = x;
        if (y > maxY) maxY = y;
      }
      list.push({ code: ft.properties.codarea, uf, polys, bbox: [minX, minY, maxX, maxY] });
    }
  }
  // grade de 0,25° para achar candidatos rápido
  const grid = new Map();
  const cell = (x, y) => `${Math.floor(x * 4)}|${Math.floor(y * 4)}`;
  for (const m of list) {
    for (let x = Math.floor(m.bbox[0] * 4); x <= Math.floor(m.bbox[2] * 4); x++)
      for (let y = Math.floor(m.bbox[1] * 4); y <= Math.floor(m.bbox[3] * 4); y++) {
        const k = `${x}|${y}`;
        if (!grid.has(k)) grid.set(k, []);
        grid.get(k).push(m);
      }
  }
  return (lon, lat) => {
    for (const m of grid.get(cell(lon, lat)) ?? []) {
      const [a, b, c, d] = m.bbox;
      if (lon < a || lon > c || lat < b || lat > d) continue;
      for (const poly of m.polys) {
        if (!inRing(lon, lat, poly[0])) continue;
        if (poly.slice(1).some((hole) => inRing(lon, lat, hole))) continue;
        return m;
      }
    }
    return null;
  };
}

function inRing(x, y, ring) {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i];
    const [xj, yj] = ring[j];
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

/** Registro compacto (posições fixas; o app remonta as tags). */
const FIELDS = ["name", "addr:street", "addr:housenumber", "addr:suburb", "addr:neighbourhood", "phone", "contact:phone", "mobile", "contact:mobile", "whatsapp", "contact:whatsapp", "website", "contact:website", "url", "instagram", "contact:instagram", "facebook", "contact:facebook", "opening_hours", "description"];
function compact(rec) {
  const row = [rec.id, Math.round(rec.lat * 1e5) / 1e5, Math.round(rec.lon * 1e5) / 1e5];
  for (const f of FIELDS) {
    const v = rec.tags[f];
    row.push(v === undefined ? 0 : f === "description" ? v.slice(0, 240) : v);
  }
  while (row[row.length - 1] === 0) row.pop();
  return row;
}

async function main() {
  const [file, malhas, catsFile, outDir] = process.argv.slice(2);
  if (!file || !malhas || !catsFile || !outDir) {
    console.error("uso: node scripts/build-osm-data.mjs <brazil.osm.pbf> <malhas> <categories.json> <saida>");
    process.exit(1);
  }
  const t0 = Date.now();
  const categories = JSON.parse(readFileSync(catsFile, "utf8"));
  const cats = compileCategories(categories);
  console.log(`${cats.length} categorias com filtros do OpenStreetMap`);

  console.log("passo 1: empresas (pontos e prédios)…");
  const p1 = await scan(file, 1, categories, null);
  const nodes = p1.results.flatMap((r) => r.nodes);
  const ways = p1.results.flatMap((r) => r.ways);
  console.log(`  ${nodes.length} pontos e ${ways.length} prédios em ${Math.round((Date.now() - t0) / 1000)} s`);

  console.log("passo 2: posição dos prédios…");
  const needed = new Set(ways.map((w) => w.ref));
  const p2 = await scan(file, 2, categories, needed, p1.firstWayBlob);
  const where = new Map();
  for (const r of p2.results) for (const [id, lat, lon] of r.coords) where.set(id, [lat, lon]);
  for (const w of ways) {
    const c = where.get(w.ref);
    if (c) nodes.push({ id: w.id, lat: c[0], lon: c[1], tags: w.tags, cats: w.cats });
  }
  console.log(`  ${where.size}/${needed.size} posições em ${Math.round((Date.now() - t0) / 1000)} s`);

  console.log("municípios (IBGE)…");
  const locate = loadMunicipalities(malhas);
  /** uf → categoria → município → registros */
  const shards = new Map();
  let placed = 0;
  let outside = 0;
  for (const rec of nodes) {
    const m = locate(rec.lon, rec.lat);
    if (!m) {
      outside++;
      continue;
    }
    placed++;
    const row = compact(rec);
    for (const slug of rec.cats) {
      const key = `${m.uf}/${slug}`;
      if (!shards.has(key)) shards.set(key, {});
      (shards.get(key)[m.code] ??= []).push(row);
    }
  }
  console.log(`  ${placed} empresas em municípios, ${outside} fora do Brasil/sem município`);

  rmSync(outDir, { recursive: true, force: true });
  let bytes = 0;
  const index = {};
  const stamp = new Date().toISOString().slice(0, 10);
  for (const [key, cities] of shards) {
    const [uf, slug] = key.split("/");
    mkdirSync(`${outDir}/${uf}`, { recursive: true });
    const gz = gzipSync(JSON.stringify({ v: 1, at: stamp, cities }), { level: 9 });
    writeFileSync(`${outDir}/${uf}/${slug}.json.gz`, gz);
    bytes += gz.length;
    ((index[uf] ??= {})[slug] = Object.values(cities).reduce((s, l) => s + l.length, 0));
  }
  writeFileSync(`${outDir}/index.json`, JSON.stringify({ v: 1, at: stamp, fields: FIELDS, counts: index }));
  console.log(`${shards.size} arquivos, ${(bytes / 1024 / 1024).toFixed(1)} MB compactados, ${Math.round((Date.now() - t0) / 1000)} s no total`);
}

if (isMainThread) main().catch((err) => {
  console.error(err);
  process.exit(1);
});
