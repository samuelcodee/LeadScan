// Exporta os filtros OSM das categorias (usado por scripts/build-osm-data.mjs).
// npx tsx scripts/export-categories.mts <saida.json>
import { writeFileSync } from "node:fs";
import { CATEGORIES } from "../lib/domain/categories";

const out = process.argv[2] ?? "categories.json";
writeFileSync(out, JSON.stringify(CATEGORIES.map((c) => ({ slug: c.slug, osm: c.osm }))));
console.log(`${CATEGORIES.length} categorias → ${out}`);
