import "server-only";
import { CITIES, getState } from "@/lib/domain/geo";
import { citiesOfState } from "@/lib/domain/municipalities";

type Place = { name: string; uf: string };

/** PRNG com seed (mulberry32): a mesma busca sempre percorre as mesmas cidades. */
function rng(seed: string) {
  let a = 2166136261;
  for (let i = 0; i < seed.length; i++) a = Math.imul(a ^ seed.charCodeAt(i), 16777619);
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function shuffle<T>(list: T[], r: () => number) {
  const a = [...list];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(r() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/**
 * Cidades de uma busca geral (sem cidade escolhida).
 *  - com UF: primeiro as maiores do estado (onde há mais empresas), depois as demais
 *  - sem UF: capitais e polos do país inteiro, depois cidades médias sorteadas por estado
 * A ordem muda a cada busca (seed = id da busca), então buscas repetidas cobrem lugares novos.
 */
export function regionCities(uf: string | undefined, seed: string, max: number): Place[] {
  const r = rng(seed);
  if (uf && getState(uf)) {
    const major = CITIES.filter((c) => c.uf === uf).map((c) => ({ name: c.name, uf }));
    const majorSet = new Set(major.map((m) => m.name));
    const rest = citiesOfState(uf)
      .filter((n) => !majorSet.has(n))
      .map((name) => ({ name, uf }));
    return [...shuffle(major, r), ...shuffle(rest, r)].slice(0, max);
  }
  const major = shuffle(
    CITIES.map((c) => ({ name: c.name, uf: c.uf })),
    r,
  );
  const majorSet = new Set(major.map((m) => `${m.name}|${m.uf}`));
  const others: Place[] = [];
  const states = shuffle(
    [...new Set(CITIES.map((c) => c.uf))],
    r,
  );
  for (const s of states) {
    const pool = citiesOfState(s).filter((n) => !majorSet.has(`${n}|${s}`));
    for (const name of shuffle(pool, r).slice(0, 2)) others.push({ name, uf: s });
  }
  // Duas grandes para cada média: volume sem perder a cara de "Brasil inteiro"
  const out: Place[] = [];
  let i = 0;
  let j = 0;
  while (out.length < max && (i < major.length || j < others.length)) {
    if (i < major.length) out.push(major[i++]);
    if (i < major.length && out.length < max) out.push(major[i++]);
    if (j < others.length && out.length < max) out.push(others[j++]);
  }
  return out;
}

export function regionLabel(uf?: string) {
  const s = uf ? getState(uf) : undefined;
  return s ? `${s.name} (todas as cidades)` : "Todo o Brasil";
}
