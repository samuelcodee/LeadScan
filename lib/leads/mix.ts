import "server-only";
import { CATEGORIES } from "@/lib/domain/categories";
import { interleave, regionOrder, rng, shuffle } from "@/lib/domain/regions";
import type { SearchRequest } from "@/lib/domain/search";
import type { DataProvider } from "@/lib/providers/types";

type City = { name: string; uf: string };
export type MixTask = { category: string; city: City };

/** Quantas combinações categoria × cidade uma busca "vários negócios" mira (≈4 empresas de cada). */
export function mixTarget(limit: number) {
  return Math.min(60, Math.max(5, Math.ceil(limit / 4)));
}

/** Sorteio com peso, sem reposição: o mais comum tende a sair antes, mas o raro também aparece. */
function weightedOrder<T>(items: T[], weight: (t: T) => number, r: () => number) {
  return items
    .map((it) => ({ it, k: Math.pow(r(), 1 / Math.max(weight(it), 1e-6)) }))
    .sort((a, b) => b.k - a.k)
    .map((x) => x.it);
}

/**
 * Busca sem categoria: mistura tipos de negócio e cidades. Com a base do Brasil, sorteia só
 * combinações que existem (categoria × estado com empresas → cidades com empresas), com peso
 * para as mais comuns. `blocked` = "categoria|cidade|UF" já varridas até o fim. A seed é a da
 * busca: retomar a mesma busca refaz o mesmo plano; uma busca nova sorteia outro.
 */
export async function planMix(req: SearchRequest, provider: DataProvider, seed: string, blocked: Set<string>, maxCities: number): Promise<MixTask[]> {
  const r = rng(seed);
  const target = mixTarget(req.limit);
  const inScope = req.cities.length ? new Set(req.cities.map((c) => `${c.name}|${c.uf}`)) : null;
  const free = (category: string, c: City) => !blocked.has(`${category}|${c.name}|${c.uf}`);
  const known = new Set(CATEGORIES.map((c) => c.slug));

  const counts = provider.categoryCounts && provider.regionCities ? await provider.categoryCounts().catch(() => null) : null;
  if (counts) {
    const ufs = inScope ? [...new Set(req.cities.map((c) => c.uf))] : req.uf ? [req.uf] : Object.keys(counts);
    const pairs = ufs.flatMap((uf) =>
      Object.entries(counts[uf] ?? {})
        .filter(([category, n]) => n > 0 && known.has(category))
        .map(([category, n]) => ({ uf, category, n })),
    );
    if (!pairs.length) return [];
    // Categorias diferentes primeiro (peso √total); cada uma num estado sorteado (peso √n)
    const byCat = new Map<string, typeof pairs>();
    for (const p of pairs) {
      const list = byCat.get(p.category);
      if (list) list.push(p);
      else byCat.set(p.category, [p]);
    }
    const catOrder = weightedOrder([...byCat.keys()], (c) => Math.sqrt(byCat.get(c)!.reduce((s, p) => s + p.n, 0)), r);
    const statesOf = new Map(catOrder.map((c) => [c, weightedOrder(byCat.get(c)!, (p) => Math.sqrt(p.n), r)]));
    // Cidade escolhida: mais categorias (nem todas existem nela); região: uma rodada de pares
    const want = Math.min(pairs.length, inScope ? 45 : Math.min(24, target));
    const picked: typeof pairs = [];
    const taken = new Set<string>();
    const usedUf = new Map<string, number>();
    for (let round = 0; picked.length < want; round++) {
      const before = picked.length;
      for (const c of catOrder) {
        if (picked.length >= want) break;
        // Estado ainda pouco usado primeiro: a mistura cobre o país, não só SP/MG/RJ
        const options = statesOf.get(c)!.filter((p) => !taken.has(`${p.uf}|${c}`));
        if (!options.length) continue;
        const least = Math.min(...options.map((p) => usedUf.get(p.uf) ?? 0));
        const p = options.find((o) => (usedUf.get(o.uf) ?? 0) === least)!;
        picked.push(p);
        taken.add(`${p.uf}|${c}`);
        usedUf.set(p.uf, (usedUf.get(p.uf) ?? 0) + 1);
      }
      if (picked.length === before) break;
    }
    // Cidades com empresas de cada par (um arquivo da base por par, em paralelo)
    // Sobra de cidades: as de categoria rara têm 1 ou 2 empresas, e a rodada segue até completar
    const perPair = Math.ceil((target * 3) / picked.length) + 2;
    const lists = await Promise.all(
      picked.map(async (p) => {
        const cities = await provider.regionCities!(p.uf, [p.category]).catch(() => null);
        if (!cities) return [];
        const open = [...cities]
          .map(([key, n]) => {
            const [name, uf] = key.split("|");
            return { city: { name, uf }, n };
          })
          .filter((x) => (!inScope || inScope.has(`${x.city.name}|${x.city.uf}`)) && free(p.category, x.city));
        return weightedOrder(open, (x) => Math.sqrt(x.n), r)
          .slice(0, inScope ? open.length : perPair)
          .map((x) => ({ category: p.category, city: x.city }));
      }),
    );
    return interleave(lists);
  }

  // Fontes sem índice (demonstração, Google): categorias sorteadas, uma diferente por cidade
  const cats = shuffle(
    CATEGORIES.map((c) => c.slug),
    r,
  );
  if (inScope) {
    const per = Math.max(1, Math.floor(maxCities / req.cities.length));
    return interleave(
      req.cities.map((city, i) =>
        Array.from({ length: per }, (_, k) => ({ category: cats[(i * per + k) % cats.length], city })).filter((t) => free(t.category, t.city)),
      ),
    );
  }
  return regionOrder(req.uf, seed)
    .map((city, i) => ({ category: cats[i % cats.length], city }))
    .filter((t) => free(t.category, t.city))
    .slice(0, maxCities);
}
