// Mede a busca de ponta a ponta (cria + roda o job) com a fonte OpenStreetMap (base do Brasil):
// tempo, quantos leads, em quantas cidades/estados/categorias e quantos voltaram como "Já apareceu".
// Uso (servidor parado — o banco local aceita uma conexão): npx tsx --conditions=react-server --env-file=.env scripts/bench-search.mts
import { db } from "@/lib/db";
import { createSearch, runSearchJob } from "@/lib/leads/search";

// conta temporária: cada rodada mede do zero (sem leads já vistos) e é apagada no fim
const user = await db.user.create({ data: { name: "Bench", email: `bench-${Date.now()}@teste.local`, username: `bench${Date.now()}`, onboardedAt: new Date() }, select: { id: true } });
const cases: { label: string; categories: string[]; cities: { name: string; uf: string }[]; uf?: string; limit: number }[] = [
  { label: "dentistas · Fortaleza · 25", categories: ["dentista"], cities: [{ name: "Fortaleza", uf: "CE" }], limit: 25 },
  { label: "salões · Alvorada RS · 50 (1ª)", categories: ["salao-beleza"], cities: [{ name: "Alvorada", uf: "RS" }], limit: 50 },
  { label: "salões · Alvorada RS · 50 (2ª: repete)", categories: ["salao-beleza"], cities: [{ name: "Alvorada", uf: "RS" }], limit: 50 },
  { label: "restaurantes · Recife · 100", categories: ["restaurante"], cities: [{ name: "Recife", uf: "PE" }], limit: 100 },
  { label: "barbearias · MG inteiro · 50", categories: ["barbearia"], cities: [], uf: "MG", limit: 50 },
  { label: "academias · Brasil · 100", categories: ["academia"], cities: [], limit: 100 },
  { label: "dentistas+pet shops · Brasil · 250", categories: ["dentista", "pet-shop"], cities: [], limit: 250 },
  { label: "restaurantes · Brasil · 500", categories: ["restaurante"], cities: [], limit: 500 },
  { label: "vários · Brasil · 50", categories: [], cities: [], limit: 50 },
  { label: "vários · Brasil · 500", categories: [], cities: [], limit: 500 },
  { label: "vários · CE · 100", categories: [], cities: [], uf: "CE", limit: 100 },
  { label: "vários · Alvorada RS · 100", categories: [], cities: [{ name: "Alvorada", uf: "RS" }], limit: 100 },
  { label: "pet shops · Acre inteiro · 500 (pouca base)", categories: ["pet-shop"], cities: [], uf: "AC", limit: 500 },
];
for (const c of cases) {
  const t = Date.now();
  const s = await createSearch(user.id, { query: c.label, categories: c.categories, cities: c.cities, uf: c.uf, limit: c.limit, provider: "osm" });
  await runSearchJob(s.id);
  const ms = Date.now() - t;
  const done = await db.search.findUniqueOrThrow({ where: { id: s.id }, select: { status: true, resultCount: true, total: true, error: true, leadIds: true, createdAt: true } });
  const leads = await db.lead.findMany({ where: { id: { in: done.leadIds } }, select: { city: true, state: true, category: true, createdAt: true } });
  const cities = new Set(leads.map((l) => `${l.city}|${l.state}`)).size;
  const states = new Set(leads.map((l) => l.state)).size;
  const cats = new Set(leads.map((l) => l.category)).size;
  const repeats = leads.filter((l) => l.createdAt < done.createdAt).length;
  console.log(
    `${c.label}: ${done.resultCount} leads em ${(ms / 1000).toFixed(1)} s · ${cities} cidades, ${states} UF, ${cats} categorias${repeats ? `, ${repeats} repetidos` : ""} (${done.status})${done.error ? `\n    ↳ ${done.error.slice(0, 220)}` : ""}`,
  );
}
await db.user.delete({ where: { id: user.id } });
await db.$disconnect();
