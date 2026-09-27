// Atualiza a lista oficial de municípios a partir da API pública do IBGE:
//  - lib/domain/data/municipios.json       { UF: [nomes] }       (autocompletar de cidades)
//  - lib/domain/data/municipios-ibge.json  { "UF|Nome": código }  (busca rápida no OpenStreetMap)
// Uso: node scripts/update-municipios.mjs
import fs from "node:fs";

const res = await fetch("https://servicodados.ibge.gov.br/api/v1/localidades/municipios?view=nivelado");
if (!res.ok) throw new Error(`IBGE respondeu ${res.status}`);
const list = await res.json();
const byUf = {};
const codes = {};
for (const m of list) {
  (byUf[m["UF-sigla"]] ??= []).push(m["municipio-nome"]);
  codes[`${m["UF-sigla"]}|${m["municipio-nome"]}`] = Number(m["municipio-id"]);
}
for (const uf of Object.keys(byUf)) byUf[uf].sort((a, b) => a.localeCompare(b, "pt-BR"));
const ordered = Object.fromEntries(Object.keys(byUf).sort().map((k) => [k, byUf[k]]));
fs.writeFileSync(new URL("../lib/domain/data/municipios.json", import.meta.url), JSON.stringify(ordered));
fs.writeFileSync(new URL("../lib/domain/data/municipios-ibge.json", import.meta.url), JSON.stringify(codes));
console.log(`${list.length} municípios em ${Object.keys(ordered).length} UFs (com código IBGE).`);
