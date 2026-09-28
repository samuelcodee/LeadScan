"use server";

import { getProvider } from "@/lib/providers";
import type { ProviderId } from "@/lib/domain/filters";
import { z } from "zod";
import { action, idSchema } from "@/lib/action";
import { db } from "@/lib/db";
import { resolveMunicipality } from "@/lib/domain/municipalities";
import { searchRequestSchema } from "@/lib/domain/search";
import { enqueueSearch, resumeIfStale } from "@/lib/leads/queue";
import { createSearch, runSearchJob } from "@/lib/leads/search";

/**
 * Inicia uma busca. Uma combinação (1 categoria × 1 cidade) roda na hora;
 * lotes vão para a fila e o cliente acompanha o progresso.
 */
export const startSearch = action({ name: "startSearch", schema: searchRequestSchema, limit: "search" }, async (input, user) => {
  // Grafia oficial do IBGE (acentos certos): as fontes de mapa casam o nome exato do município
  const req = { ...input, cities: input.cities.map((c) => ({ name: resolveMunicipality(c.name, c.uf).match?.name ?? c.name, uf: c.uf })) };
  const search = await createSearch(user.id, req);
  // Uma cidade, ou fonte local (base do Brasil, milissegundos por cidade): roda aqui mesmo e a
  // tela abre direto nos resultados, sem fila nem espera de acompanhamento
  if (search.total === 1 || getProvider(search.provider as ProviderId).regionCities) {
    await runSearchJob(search.id);
    const done = await db.search.findUniqueOrThrow({ where: { id: search.id }, select: { status: true, error: true } });
    return { searchId: search.id, status: done.status, error: done.error };
  }
  enqueueSearch(search.id);
  return { searchId: search.id, status: "QUEUED" as const, error: null };
});

export const getSearchStatus = action(
  { name: "getSearchStatus", schema: z.object({ id: idSchema }), limit: "searchStatus" },
  async ({ id }, user) => {
    const s = await db.search.findFirst({
      where: { id, userId: user.id },
      select: { id: true, status: true, progress: true, total: true, resultCount: true, error: true, updatedAt: true },
    });
    if (!s) return null;
    await resumeIfStale(s);
    return s;
  },
);
