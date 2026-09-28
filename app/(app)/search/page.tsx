import type { Metadata } from "next";
import Link from "next/link";
import { cookies } from "next/headers";
import { notFound, redirect } from "next/navigation";
import { after } from "next/server";
import { Clock } from "lucide-react";
import { CloseSearchButton } from "@/components/search/close-search";
import { NextBatch } from "@/components/search/next-batch";
import { ResultsView } from "@/components/search/results-view";
import { SearchForm } from "@/components/search/search-form";
import type { SearchInput } from "@/components/search/use-search-runner";
import { isAIEnabled } from "@/lib/ai";
import { requireUser } from "@/lib/auth/session";
import { DEFAULT_FILTERS, filtersFromParams, searchRequestSchema } from "@/lib/domain/search";
import { SEARCH_VIEW_COOKIE } from "@/lib/domain/filters";
import { formatInt, formatRelative } from "@/lib/format";
import { getSearchResults, markSearchOpened, openSearchId, recentSearches } from "@/lib/leads/queries";
import { sweepStatus } from "@/lib/leads/search";
import { defaultProviderId, listProviders } from "@/lib/providers";

export const metadata: Metadata = { title: "Buscar leads" };
// Buscas em lote rodam pela server action desta página (e pelo after() da fila)
export const maxDuration = 300;

const VIEW_KEYS = ["lead", ...Object.keys(DEFAULT_FILTERS)];

/** Endereço da busca aberta com a vista guardada no cookie (filtros e lead selecionado), se for dela. */
function openSearchHref(id: string, saved: string | undefined) {
  const qs = new URLSearchParams({ s: id });
  try {
    const view = new URLSearchParams(decodeURIComponent(saved ?? ""));
    if (view.get("s") === id) {
      for (const k of VIEW_KEYS) {
        const v = view.get(k);
        if (v) qs.set(k, v.slice(0, 64));
      }
    }
  } catch {
    // cookie estranho: abre a busca sem filtros
  }
  return `/search?${qs}`;
}

export default async function SearchPage(props: PageProps<"/search">) {
  const user = await requireUser();
  const sp = await props.searchParams;
  const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);
  const searchId = one(sp.s);
  const providers = listProviders().map((p) => ({ id: p.id, label: p.label, configured: p.configured, isDemo: p.isDemo }));
  const form = (query?: string, initial?: SearchInput) => (
    <SearchForm
      providers={providers}
      defaultProvider={defaultProviderId()}
      initialQuery={query ?? one(sp.q) ?? ""}
      initial={initial}
      compact={!!searchId}
    />
  );

  if (!searchId) {
    // A busca aberta não some ao trocar de aba: "Buscar leads" volta nela (com filtros e lead
    // selecionado) até a pessoa tocar em "Fechar busca". ?nova=1 ou ?q= abrem o formulário.
    if (!one(sp.q) && !one(sp.nova)) {
      const open = await openSearchId(user.id);
      if (open) redirect(openSearchHref(open, (await cookies()).get(SEARCH_VIEW_COOKIE)?.value));
    }
    const recent = await recentSearches(user.id);
    return (
      <div className="mx-auto max-w-4xl px-4 py-10 sm:px-6 sm:py-16">
        <h1 className="max-w-2xl text-2xl font-semibold tracking-tight text-balance sm:text-[2rem] sm:leading-tight">
          Encontre empresas que podem precisar do seu site.
        </h1>
        <p className="mt-2 max-w-xl text-sm text-muted-foreground sm:text-base">
          Escreva do seu jeito. A gente entende categoria, cidade, quantidade e filtros, e ordena pelo potencial de venda.
        </p>
        <div className="mt-8">{form()}</div>
        {recent.length > 0 && (
          <div className="mt-10">
            <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Buscas recentes</h2>
            <ul className="mt-3 divide-y rounded-lg border bg-card">
              {recent.map((r) => (
                <li key={r.id}>
                  <Link href={`/search?s=${r.id}`} className="flex items-center gap-3 px-4 py-3 text-sm transition-colors duration-150 hover:bg-muted/50">
                    <Clock className="size-4 shrink-0 text-muted-foreground" aria-hidden />
                    <span className="min-w-0 flex-1 truncate">{r.query}</span>
                    <span className="shrink-0 text-xs text-muted-foreground tabular">
                      {formatInt(r.resultCount)} leads · {formatRelative(r.createdAt)}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    );
  }

  const result = await getSearchResults(user.id, searchId);
  if (!result) notFound();
  // Esta vira a busca aberta (depois da resposta: não atrasa a tela)
  const userId = user.id;
  after(() => markSearchOpened(userId, result.search.id));
  const providerLabel = providers.find((p) => p.id === result.search.provider)?.label ?? result.search.provider;
  // Mesma busca de novo = próxima leva da varredura (buscas antigas com parâmetros diferentes ficam sem o botão)
  const again = searchRequestSchema.safeParse(result.search.params);
  // Varredura e IA em paralelo (antes eram consultas uma atrás da outra)
  const [sweeps, aiEnabled] = await Promise.all([again.success ? sweepStatus(user.id, result.search) : [], isAIEnabled(user.id)]);
  const nextBatch =
    again.success && result.search.status !== "RUNNING" && result.search.status !== "QUEUED" ? (
      <NextBatch
        input={{ ...again.data, provider: again.data.provider ?? defaultProviderId() }}
        regional={again.data.cities.length === 0}
        sweeps={sweeps.map((s) => ({ label: s.label, city: s.city, found: s.found, exhausted: s.exhausted }))}
      />
    ) : null;

  return (
    <div>
      <div className="border-b px-4 py-4 sm:px-6">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-x-3 gap-y-2">
          <h1 className="min-w-0 text-lg font-semibold tracking-tight">{result.search.query}</h1>
          <div className="flex items-center gap-3">
            <p className="text-xs text-muted-foreground">
              {formatInt(result.search.resultCount)} encontrados · fonte {providerLabel} · {formatRelative(result.search.createdAt)}
            </p>
            <CloseSearchButton id={result.search.id} />
          </div>
        </div>
        {result.search.error && <p className="mb-3 rounded-md bg-warning-soft px-3 py-2 text-sm text-warning">{result.search.error}</p>}
        {nextBatch}
        {form(result.search.query ?? undefined, again.success ? { ...again.data, provider: again.data.provider ?? defaultProviderId() } : undefined)}
      </div>
      <ResultsView key={result.search.id} leads={result.leads} since={result.search.createdAt} initialFilters={filtersFromParams(sp)} initialSelected={one(sp.lead) ?? null} aiEnabled={aiEnabled} />
      {/* celular: a próxima leva também no fim da lista (sem rolar 50 cards de volta ao topo) */}
      {nextBatch && result.leads.length > 0 && <div className="px-4 pb-6 lg:hidden">{nextBatch}</div>}
    </div>
  );
}
