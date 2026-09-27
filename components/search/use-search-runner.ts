"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { getSearchStatus, startSearch } from "@/app/actions/search";
import { DEFAULT_FILTERS, filtersToParams, type ProviderId, type SearchFilters } from "@/lib/domain/filters";

export type SearchInput = {
  query?: string;
  categories: string[];
  cities: { name: string; uf: string }[];
  uf?: string;
  limit: number;
  provider: ProviderId;
};

export type SearchProgress = { done: number; total: number; found: number; href: string };

/**
 * Começa uma busca e acompanha o progresso até abrir os resultados. Usado pelo formulário
 * e pelo botão "Próximos" da tela de resultados (mesma busca, próxima leva da varredura).
 */
export function useSearchRunner() {
  const router = useRouter();
  const [progress, setProgress] = useState<SearchProgress | null>(null);
  const [pending, start] = useTransition();

  const run = (input: SearchInput, filters: Partial<SearchFilters> = {}) =>
    start(async () => {
      const r = await startSearch(input);
      if (!r.ok) return void toast.error(r.error);
      const params = filtersToParams({ ...DEFAULT_FILTERS, ...filters });
      params.set("s", r.data.searchId);
      if (r.data.status === "FAILED") return void toast.error(r.data.error ?? "A busca falhou.");
      if (r.data.status === "DONE") {
        if (r.data.error) toast.warning(r.data.error);
        return router.push(`/search?${params}`);
      }
      // Lote: acompanha o progresso. Pergunta devagar (1,5 s → 4 s): com muita gente buscando,
      // polling a cada segundo vira carga à toa. Uma falha isolada não derruba o acompanhamento.
      const href = `/search?${params}`;
      setProgress({ done: 0, total: 0, found: 0, href });
      for (let round = 0, misses = 0; ; round++) {
        await new Promise((res) => setTimeout(res, Math.min(4000, 1500 + round * 250)));
        const st = await getSearchStatus({ id: r.data.searchId }).catch(() => null);
        if (!st?.ok || !st.data) {
          if (++misses >= 4) break;
          continue;
        }
        misses = 0;
        setProgress({ done: st.data.progress, total: st.data.total, found: st.data.resultCount, href });
        if (st.data.status === "DONE" || st.data.status === "FAILED") {
          if (st.data.error) toast.warning(st.data.error);
          break;
        }
      }
      setProgress(null);
      router.push(href);
    });

  return { run, progress, pending };
}
