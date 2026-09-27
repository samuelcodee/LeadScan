import "server-only";
import data from "@/lib/domain/data/municipios.json";
import { CITIES } from "@/lib/domain/geo";
import { fold } from "@/lib/format";

/**
 * Todos os 5.571 municípios do Brasil (lista oficial do IBGE, API de localidades),
 * agrupados por UF. Fica só no servidor: o navegador pede a lista de uma UF por vez
 * (/api/geo/cidades?uf=CE), então o bundle não cresce.
 * Atualizar: node scripts/update-municipios.mjs (baixa de servicodados.ibge.gov.br).
 */
const BY_UF = data as Record<string, string[]>;

type Entry = { name: string; uf: string; key: string };
const INDEX: Entry[] = Object.entries(BY_UF).flatMap(([uf, names]) => names.map((name) => ({ name, uf, key: fold(name) })));
const BY_KEY = new Map<string, Entry[]>();
for (const e of INDEX) BY_KEY.set(e.key, [...(BY_KEY.get(e.key) ?? []), e]);

// Em nomes repetidos entre estados (ex.: "Bom Jesus"), prefere a cidade maior da lista curada
const MAJOR = new Set(CITIES.map((c) => `${fold(c.name)}|${c.uf}`));

export function citiesOfState(uf: string) {
  return BY_UF[uf.toUpperCase()] ?? [];
}

export function municipalityCount() {
  return INDEX.length;
}

/**
 * Nome digitado → município oficial com UF.
 *  - com UF: só aceita se existir naquela UF
 *  - sem UF: único no Brasil → resolve; repetido → devolve as opções (a tela pergunta)
 */
export function resolveMunicipality(raw: string, uf?: string | null) {
  const key = fold(raw.trim().replace(/\s+/g, " "));
  if (key.length < 2) return { match: null, options: [] as Entry[] };
  const hits = BY_KEY.get(key) ?? [];
  if (uf) {
    const m = hits.find((h) => h.uf === uf.toUpperCase()) ?? null;
    return { match: m, options: m ? [m] : [] };
  }
  if (hits.length === 1) return { match: hits[0], options: hits };
  const major = hits.find((h) => MAJOR.has(`${h.key}|${h.uf}`));
  if (major) return { match: major, options: hits };
  return { match: null, options: hits };
}

/** Sugestões por prefixo (autocomplete sem UF escolhida). */
export function suggestMunicipalities(prefix: string, limit = 12) {
  const p = fold(prefix.trim());
  if (p.length < 2) return [];
  const starts = INDEX.filter((e) => e.key.startsWith(p));
  const contains = starts.length < limit ? INDEX.filter((e) => !e.key.startsWith(p) && e.key.includes(p)) : [];
  return [...starts, ...contains].slice(0, limit).map(({ name, uf }) => ({ name, uf }));
}
