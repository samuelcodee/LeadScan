// Atualiza lib/domain/data/municipios.json a partir da API pública do IBGE.
// Uso: node scripts/update-municipios.mjs
import fs from "node:fs";

const res = await fetch("https://servicodados.ibge.gov.br/api/v1/localidades/municipios?view=nivelado");
if (!res.ok) throw new Error(`IBGE respondeu ${res.status}`);
const list = await res.json();
const byUf = {};
for (const m of list) (byUf[m["UF-sigla"]] ??= []).push(m["municipio-nome"]);
for (const uf of Object.keys(byUf)) byUf[uf].sort((a, b) => a.localeCompare(b, "pt-BR"));
const ordered = Object.fromEntries(Object.keys(byUf).sort().map((k) => [k, byUf[k]]));
fs.writeFileSync(new URL("../lib/domain/data/municipios.json", import.meta.url), JSON.stringify(ordered));
console.log(`${list.length} municípios em ${Object.keys(ordered).length} UFs.`);
