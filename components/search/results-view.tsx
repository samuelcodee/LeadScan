"use client";

import { BookmarkPlus, Filter, SearchX } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { useMemo, useState, useTransition } from "react";
import { toast } from "sonner";
import { saveMany } from "@/app/actions/leads";
import { createPrototypeAction } from "@/app/actions/prototypes";
import { EmptyState } from "@/components/common/page-header";
import { LeadCard } from "@/components/leads/lead-card";
import { LeadWorkbench } from "@/components/leads/lead-workbench";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { activeFilterCount, DEFAULT_FILTERS, filtersToParams, matchesFilters, type SearchFilters } from "@/lib/domain/filters";
import { formatInt } from "@/lib/format";
import type { LeadListItem } from "@/lib/leads/queries";
import { useMediaQuery } from "@/hooks/use-media-query";
import { cn } from "@/lib/utils";

type Sort = "score" | "reviews" | "name";
const PAGE = 30;

export function ResultsView({
  leads: initialLeads,
  initialFilters,
  initialSelected,
  aiEnabled,
  since,
}: {
  leads: LeadListItem[];
  initialFilters: SearchFilters;
  /** Lead vindo da URL (?lead=). Sem ele, telas largas pré-selecionam o melhor lead. */
  initialSelected: string | null;
  aiEnabled: boolean;
  /** Início da busca: lead criado antes disso já tinha aparecido em outra busca */
  since?: Date;
}) {
  const router = useRouter();
  const params = useSearchParams();
  const [leads, setLeads] = useState(initialLeads);
  const [filters, setFilters] = useState(initialFilters);
  const [sort, setSort] = useState<Sort>("score");
  const [shown, setShown] = useState(PAGE);
  const [pickedId, setSelectedId] = useState<string | null>(initialSelected);
  const [creatingId, setCreatingId] = useState<string | null>(null);
  const [savingAll, startSaveAll] = useTransition();
  const [filtersOpen, setFiltersOpen] = useState(false);
  const wide = useMediaQuery("(min-width: 1280px)");
  // No desktop o painel já abre no lead de maior potencial; no celular, só quando o usuário toca.
  const selectedId = pickedId ?? (wide ? initialLeads[0]?.id ?? null : null);
  const isRepeat = (l: LeadListItem) => !!since && new Date(l.createdAt).getTime() < new Date(since).getTime();
  const repeats = since ? leads.filter(isRepeat).length : 0;

  // Mantém a lista em dia quando o servidor revalida (salvar, status etc.)
  const [prevInitial, setPrevInitial] = useState(initialLeads);
  if (prevInitial !== initialLeads) {
    setPrevInitial(initialLeads);
    setLeads(initialLeads);
  }

  /** Estado na URL sem ir ao servidor (history nativo, sincronizado pelo Next). */
  const syncUrl = (f: SearchFilters, lead: string | null) => {
    const p = filtersToParams(f, new URLSearchParams(params.toString()));
    if (lead) p.set("lead", lead);
    else p.delete("lead");
    window.history.replaceState(null, "", `?${p.toString()}`);
  };

  const setFilter = <K extends keyof SearchFilters>(k: K, v: SearchFilters[K]) => {
    const next = { ...filters, [k]: v };
    setFilters(next);
    setShown(PAGE);
    syncUrl(next, selectedId);
  };

  const select = (id: string | null) => {
    setSelectedId(id);
    syncUrl(filters, id);
  };

  const filtered = useMemo(() => {
    const list = leads.filter((l) => matchesFilters(l, filters));
    if (sort === "reviews") list.sort((a, b) => (b.reviewCount ?? -1) - (a.reviewCount ?? -1));
    else if (sort === "name") list.sort((a, b) => a.name.localeCompare(b.name, "pt-BR"));
    else list.sort((a, b) => b.score - a.score);
    return list;
  }, [leads, filters, sort]);

  // Contagem por opção: o usuário vê o efeito do filtro antes de clicar
  const counts = useMemo(() => {
    const c = (patch: Partial<SearchFilters>) => leads.filter((l) => matchesFilters(l, { ...filters, ...patch })).length;
    return {
      noSite: c({ website: "without" }),
      withIg: c({ instagram: "with" }),
      withWa: c({ whatsapp: "with" }),
      high: c({ potential: "high" }),
    };
  }, [leads, filters]);

  const selected = leads.find((l) => l.id === selectedId) ?? null;

  const createPrototype = (lead: LeadListItem) => {
    setCreatingId(lead.id);
    createPrototypeAction({ leadId: lead.id }).then((r) => {
      setCreatingId(null);
      if (!r.ok) return void toast.error(r.error);
      setLeads((ls) => ls.map((l) => (l.id === lead.id ? { ...l, saved: true, _count: { ...l._count, prototypes: l._count.prototypes + 1 } } : l)));
      select(lead.id);
      toast.success(`${r.data.name} de ${lead.name} criado`, {
        action: { label: "Abrir estúdio", onClick: () => router.push(`/prototypes/${r.data.id}`) },
      });
    });
  };

  const saveAllFiltered = () =>
    startSaveAll(async () => {
      const ids = filtered.filter((l) => !l.saved).map((l) => l.id);
      if (!ids.length) return void toast.info("Todos os leads filtrados já estão salvos.");
      const r = await saveMany({ ids });
      if (!r.ok) return void toast.error(r.error);
      setLeads((ls) => ls.map((l) => (ids.includes(l.id) ? { ...l, saved: true } : l)));
      toast.success(`${formatInt(r.data.count)} leads salvos em Meus leads`);
    });

  const nActive = activeFilterCount(filters);

  return (
    <div className="xl:grid xl:grid-cols-[minmax(0,1fr)_440px]">
      <div className="min-w-0 px-4 py-5 sm:px-6">
        {/* No celular os filtros ficam recolhidos para a lista aparecer logo */}
        <Button variant="outline" className="mb-3 w-full md:hidden" onClick={() => setFiltersOpen((v) => !v)} aria-expanded={filtersOpen}>
          <Filter /> Filtros{nActive > 0 ? ` (${nActive})` : ""}
        </Button>
        {/* Filtros combináveis — aplicados por código, sem nova busca */}
        <div className={cn("flex-wrap items-center gap-x-4 gap-y-3 rounded-lg border bg-card p-3 md:flex", filtersOpen ? "flex" : "hidden")}>
          <FilterGroup label="Site">
            <ToggleGroup type="single" size="sm" variant="outline" value={filters.website} onValueChange={(v) => v && setFilter("website", v as SearchFilters["website"])}>
              <ToggleGroupItem value="any">Todos</ToggleGroupItem>
              <ToggleGroupItem value="without">Sem site · {counts.noSite}</ToggleGroupItem>
              <ToggleGroupItem value="with">Com site</ToggleGroupItem>
            </ToggleGroup>
          </FilterGroup>
          <FilterGroup label="Instagram">
            <ToggleGroup type="single" size="sm" variant="outline" value={filters.instagram} onValueChange={(v) => v && setFilter("instagram", v as SearchFilters["instagram"])}>
              <ToggleGroupItem value="any">Todos</ToggleGroupItem>
              <ToggleGroupItem value="with">Com · {counts.withIg}</ToggleGroupItem>
              <ToggleGroupItem value="without">Sem</ToggleGroupItem>
            </ToggleGroup>
          </FilterGroup>
          <FilterGroup label="WhatsApp">
            <ToggleGroup type="single" size="sm" variant="outline" value={filters.whatsapp} onValueChange={(v) => v && setFilter("whatsapp", v as SearchFilters["whatsapp"])}>
              <ToggleGroupItem value="any">Todos</ToggleGroupItem>
              <ToggleGroupItem value="with">Com · {counts.withWa}</ToggleGroupItem>
              <ToggleGroupItem value="without">Sem</ToggleGroupItem>
            </ToggleGroup>
          </FilterGroup>
          <FilterGroup label="Avaliações">
            <Select value={String(filters.minReviews)} onValueChange={(v) => setFilter("minReviews", Number(v))}>
              <SelectTrigger size="sm" className="w-28" aria-label="Avaliações mínimas">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {[0, 10, 50, 100, 300].map((n) => (
                  <SelectItem key={n} value={String(n)}>
                    {n === 0 ? "Qualquer" : `${n}+`}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </FilterGroup>
          <FilterGroup label="Nota">
            <Select value={String(filters.minRating)} onValueChange={(v) => setFilter("minRating", Number(v))}>
              <SelectTrigger size="sm" className="w-28" aria-label="Nota mínima">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {[0, 3.5, 4, 4.5].map((n) => (
                  <SelectItem key={n} value={String(n)}>
                    {n === 0 ? "Qualquer" : `≥ ${n.toLocaleString("pt-BR")}`}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </FilterGroup>
          <FilterGroup label="Potencial">
            <ToggleGroup type="single" size="sm" variant="outline" value={filters.potential} onValueChange={(v) => v && setFilter("potential", v as SearchFilters["potential"])}>
              <ToggleGroupItem value="any">Todos</ToggleGroupItem>
              <ToggleGroupItem value="medium-up">Médio+</ToggleGroupItem>
              <ToggleGroupItem value="high">Alto · {counts.high}</ToggleGroupItem>
            </ToggleGroup>
          </FilterGroup>
          {nActive > 0 && (
            <Button variant="link" size="sm" className="px-0" onClick={() => { setFilters(DEFAULT_FILTERS); syncUrl(DEFAULT_FILTERS, selectedId); }}>
              Limpar filtros ({nActive})
            </Button>
          )}
        </div>

        <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
          <p className="text-sm text-muted-foreground" aria-live="polite">
            <span className="font-semibold text-foreground tabular">{formatInt(filtered.length)}</span> de {formatInt(leads.length)} leads
            {nActive > 0 && " com os filtros"}
            {repeats > 0 && ` · ${formatInt(repeats)} já ${repeats === 1 ? "apareceu" : "apareceram"}`} · ordenados por {sort === "score" ? "potencial" : sort === "reviews" ? "avaliações" : "nome"}
          </p>
          <div className="flex items-center gap-2">
            <Select value={sort} onValueChange={(v) => setSort(v as Sort)}>
              <SelectTrigger size="sm" className="w-40" aria-label="Ordenar">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="score">Maior potencial</SelectItem>
                <SelectItem value="reviews">Mais avaliações</SelectItem>
                <SelectItem value="name">Nome (A–Z)</SelectItem>
              </SelectContent>
            </Select>
            <Button variant="outline" size="sm" onClick={saveAllFiltered} disabled={savingAll || filtered.length === 0}>
              <BookmarkPlus /> Salvar {filtered.length > 0 ? formatInt(filtered.length) : ""}
            </Button>
          </div>
        </div>

        {filtered.length === 0 ? (
          <div className="mt-6">
            <EmptyState icon={<SearchX />} title="Nenhum lead com esses filtros" action={<Button variant="outline" onClick={() => { setFilters(DEFAULT_FILTERS); syncUrl(DEFAULT_FILTERS, selectedId); }}><Filter /> Limpar filtros</Button>}>
              Tente afrouxar um critério. Avaliações mínimas costumam cortar muita coisa.
            </EmptyState>
          </div>
        ) : (
          <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-1 2xl:grid-cols-2">
            {filtered.slice(0, shown).map((l) => (
              <LeadCard
                key={l.id}
                lead={l}
                selected={l.id === selectedId}
                onSelect={() => select(l.id)}
                onCreatePrototype={() => createPrototype(l)}
                creating={creatingId === l.id}
                repeat={isRepeat(l)}
              />
            ))}
          </div>
        )}
        {shown < filtered.length && (
          <div className="mt-5 flex justify-center">
            <Button variant="outline" onClick={() => setShown((n) => n + PAGE)}>
              Mostrar mais {Math.min(PAGE, filtered.length - shown)}
            </Button>
          </div>
        )}
      </div>

      {wide ? (
        <aside className="sticky top-14 hidden h-[calc(100dvh-3.5rem)] border-l xl:block">
          {selected ? (
            <LeadWorkbench key={selected.id} lead={selected} aiEnabled={aiEnabled} />
          ) : (
            <div className="grid h-full place-items-center p-8 text-center">
              <div>
                <p className="font-medium">Selecione um lead</p>
                <p className="mt-1 text-sm text-muted-foreground">O painel mostra o porquê do score, o protótipo e a mensagem pronta pro WhatsApp.</p>
              </div>
            </div>
          )}
        </aside>
      ) : (
        <Sheet open={!!selected} onOpenChange={(o) => !o && select(null)}>
          <SheetContent side="right" className="w-full gap-0 p-0 sm:max-w-md [&>button]:hidden">
            <SheetTitle className="sr-only">{selected?.name ?? "Lead"}</SheetTitle>
            {selected && <LeadWorkbench key={selected.id} lead={selected} aiEnabled={aiEnabled} onClose={() => select(null)} />}
          </SheetContent>
        </Sheet>
      )}
    </div>
  );
}

function FilterGroup({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-2">
      <span className="text-xs font-medium text-muted-foreground">{label}</span>
      {children}
    </div>
  );
}
