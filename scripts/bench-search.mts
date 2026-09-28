// Mede a busca de ponta a ponta (cria + roda o job) com a fonte OpenStreetMap (base do Brasil).
// Uso (servidor parado — o banco local aceita uma conexão): npx tsx --conditions=react-server --env-file=.env scripts/bench-search.mts
import { db } from "@/lib/db";
import { createSearch, runSearchJob } from "@/lib/leads/search";

// conta temporária: cada rodada mede do zero (sem leads já vistos) e é apagada no fim
const user = await db.user.create({ data: { name: "Bench", email: `bench-${Date.now()}@teste.local`, username: `bench${Date.now()}`, onboardedAt: new Date() }, select: { id: true } });
const cases: { label: string; categories: string[]; cities: { name: string; uf: string }[]; uf?: string; limit: number }[] = [
  { label: "dentistas · Fortaleza · 25", categories: ["dentista"], cities: [{ name: "Fortaleza", uf: "CE" }], limit: 25 },
  { label: "restaurantes · Recife · 100", categories: ["restaurante"], cities: [{ name: "Recife", uf: "PE" }], limit: 100 },
  { label: "barbearias · MG inteiro · 50", categories: ["barbearia"], cities: [], uf: "MG", limit: 50 },
  { label: "academias · Brasil · 250", categories: ["academia"], cities: [], limit: 250 },
  { label: "restaurantes · Brasil · 500", categories: ["restaurante"], cities: [], limit: 500 },
  { label: "pet shops · Acre inteiro · 500 (pouca base)", categories: ["pet-shop"], cities: [], uf: "AC", limit: 500 },
];
for (const c of cases) {
  const t = Date.now();
  const s = await createSearch(user.id, { query: c.label, categories: c.categories, cities: c.cities, uf: c.uf, limit: c.limit, provider: "osm" });
  await runSearchJob(s.id);
  const done = await db.search.findUniqueOrThrow({ where: { id: s.id }, select: { status: true, resultCount: true, total: true, error: true } });
  console.log(`${c.label}: ${done.resultCount} leads em ${((Date.now() - t) / 1000).toFixed(1)} s (${done.status}, ${done.total} cidades)${done.error ? ` — ${done.error.slice(0, 140)}` : ""}`);
}
await db.user.delete({ where: { id: user.id } });
await db.$disconnect();
