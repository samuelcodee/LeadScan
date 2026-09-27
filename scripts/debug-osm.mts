// Depuração: roda a fonte OpenStreetMap do app isolada e mostra o tempo.
// Uso: npx tsx --conditions=react-server --env-file=.env scripts/debug-osm.ts barbearia "Belo Horizonte" MG
import { osmProvider } from "@/lib/providers/osm";

const [category = "barbearia", city = "Belo Horizonte", uf = "MG"] = process.argv.slice(2);
const t = Date.now();
const origFetch = globalThis.fetch;
globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
  const s = Date.now();
  const url = String(input);
  try {
    const r = await origFetch(input, init);
    console.log(`  ${url.split("/")[2]} → ${r.status} em ${Date.now() - s} ms`);
    return r;
  } catch (e) {
    console.log(`  ${url.split("/")[2]} → ${(e as Error).name} em ${Date.now() - s} ms`);
    throw e;
  }
}) as typeof fetch;

try {
  const items = await osmProvider.search({ category, city, uf, limit: 500, hint: 0 });
  console.log(`${items.length} empresas em ${Date.now() - t} ms; exemplo:`, items[0]?.name, items[0]?.phone, items[0]?.mapsUrl?.slice(0, 80));
} catch (e) {
  console.log(`ERRO em ${Date.now() - t} ms:`, (e as Error).message);
}
