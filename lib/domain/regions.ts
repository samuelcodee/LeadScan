import "server-only";
import { CITIES, getState } from "@/lib/domain/geo";
import { citiesOfState } from "@/lib/domain/municipalities";

type Place = { name: string; uf: string };

/** PRNG com seed (mulberry32): a mesma busca sempre percorre as mesmas cidades. */
export function rng(seed: string) {
  let a = 2166136261;
  for (let i = 0; i < seed.length; i++) a = Math.imul(a ^ seed.charCodeAt(i), 16777619);
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function shuffle<T>(list: T[], r: () => number) {
  const a = [...list];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(r() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/**
 * Todas as cidades de uma busca geral (sem cidade escolhida), na ordem em que são percorridas.
 *  - com UF: primeiro as maiores do estado (onde há mais empresas), depois todas as demais
 *  - sem UF: capitais e polos do país, intercaladas com as outras 5 mil cidades (um estado
 *    de cada vez, para a busca ter cara de "Brasil inteiro" desde o começo)
 * A ordem depende da seed: a busca geral usa uma por pessoa e região e anda por essa lista
 * a cada busca (SearchSweep com city "*"), pulando o que já foi varrido até o fim.
 */
export function regionOrder(uf: string | undefined, seed: string): Place[] {
  const r = rng(seed);
  if (uf && getState(uf)) {
    const major = CITIES.filter((c) => c.uf === uf).map((c) => ({ name: c.name, uf }));
    const majorSet = new Set(major.map((m) => m.name));
    const rest = citiesOfState(uf)
      .filter((n) => !majorSet.has(n))
      .map((name) => ({ name, uf }));
    return [...shuffle(major, r), ...shuffle(rest, r)];
  }
  const major = shuffle(
    CITIES.map((c) => ({ name: c.name, uf: c.uf })),
    r,
  );
  const majorSet = new Set(major.map((m) => `${m.name}|${m.uf}`));
  const states = shuffle(
    [...new Set(CITIES.map((c) => c.uf))],
    r,
  );
  // Um estado de cada vez: SP, depois BA, depois AM… (cada fila embaralhada)
  const queues = states.map((s) => shuffle(citiesOfState(s).filter((n) => !majorSet.has(`${n}|${s}`)), r).map((name) => ({ name, uf: s })));
  const others: Place[] = [];
  for (let round = 0; queues.some((q) => round < q.length); round++) for (const q of queues) if (round < q.length) others.push(q[round]);
  // Duas grandes para cada média: volume sem perder a cara de "Brasil inteiro"
  const out: Place[] = [];
  let i = 0;
  let j = 0;
  while (i < major.length || j < others.length) {
    if (i < major.length) out.push(major[i++]);
    if (i < major.length) out.push(major[i++]);
    if (j < others.length) out.push(others[j++]);
  }
  return out;
}

/** As primeiras `max` cidades da ordem (compatível com quem só precisa de algumas). */
export function regionCities(uf: string | undefined, seed: string, max: number): Place[] {
  return regionOrder(uf, seed).slice(0, max);
}

export function regionLabel(uf?: string) {
  const s = uf ? getState(uf) : undefined;
  return s ? `${s.name} (todas as cidades)` : "Todo o Brasil";
}

/** Intercala listas (um item de cada por vez): a primeira leva de consultas já sai variada. */
export function interleave<T>(lists: T[][]): T[] {
  const out: T[] = [];
  for (let i = 0; lists.some((l) => i < l.length); i++) for (const l of lists) if (i < l.length) out.push(l[i]);
  return out;
}
