"use client";

import { Check, ChevronDown, Globe2, Loader2, MapPin, Search, SlidersHorizontal, X } from "lucide-react";
import { useDeferredValue, useEffect, useEffectEvent, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { SearchProgressBar } from "@/components/search/progress";
import { useSearchRunner } from "@/components/search/use-search-runner";
import { Button } from "@/components/ui/button";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { CATEGORIES, getCategory } from "@/lib/domain/categories";
import { CITIES, STATES, findCity, getState } from "@/lib/domain/geo";
import { parseSearchQuery } from "@/lib/domain/query-parser";
import { LIMIT_OPTIONS, type ProviderId, type SearchFilters } from "@/lib/domain/filters";
import { fold } from "@/lib/format";
import { cn } from "@/lib/utils";

type ProviderOption = { id: ProviderId; label: string; configured: boolean; isDemo: boolean };

/** Uma linha sobre a fonte escolhida. */
function providerHint(active: ProviderOption | undefined, googleReady: boolean) {
  if (!active) return null;
  if (active.isDemo) return "Fonte de demonstração: empresas fictícias, marcadas como DEMO. Troque para uma fonte real para prospectar de verdade.";
  if (active.id === "google") return "Google Maps: nota, avaliações, telefone e fotos. Cada busca continua de onde a anterior parou, até acabarem as empresas da cidade.";
  const base = "OpenStreetMap: grátis, sem limite de uso. Cada busca continua de onde a anterior parou; cidade já consultada volta na hora.";
  return googleReady ? `${base} Google Maps também está ligado (pago por consulta).` : base;
}
type City = { name: string; uf: string };

const EXAMPLES = [
  "Clínicas de estética em Fortaleza sem site com Instagram",
  "100 dentistas em São Paulo com mais de 50 avaliações",
  "Barbearias e academias em Recife - PE",
  "Restaurantes em Salvador com nota acima de 4.5",
];

export function SearchForm({
  providers,
  defaultProvider,
  initialQuery = "",
  compact,
}: {
  providers: ProviderOption[];
  defaultProvider: ProviderId;
  initialQuery?: string;
  compact?: boolean;
}) {
  const [text, setText] = useState(initialQuery);
  const [categories, setCategories] = useState<string[]>([]);
  const [cities, setCities] = useState<City[]>([]);
  const [uf, setUf] = useState<string>("");
  const [limit, setLimit] = useState<number>(50);
  const [provider, setProvider] = useState<ProviderId>(defaultProvider);
  const [filters, setFilters] = useState<Partial<SearchFilters>>({});
  const [advanced, setAdvanced] = useState(!compact);
  const { run, progress, pending } = useSearchRunner();
  const parsedOnce = useRef(false);
  // Municípios do IBGE da UF escolhida (buscados sob demanda; o bundle não carrega os 5.571)
  const [ufList, setUfList] = useState<{ uf: string; cities: string[] }>({ uf: "", cities: [] });

  useEffect(() => {
    if (!uf) return;
    let alive = true;
    fetch(`/api/geo/cidades?uf=${uf}`)
      .then((r) => r.json())
      .then((j: { uf?: string; cities?: string[] }) => alive && j.cities && setUfList({ uf: j.uf ?? uf, cities: j.cities }))
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, [uf]);

  /** Cidade fora da lista curada: descobre a UF e a grafia oficial no IBGE. */
  const resolveRemote = async (name: string, forUf?: string): Promise<City | null> => {
    const qs = new URLSearchParams({ resolve: name, ...(forUf ? { uf: forUf } : {}) });
    const r = (await fetch(`/api/geo/cidades?${qs}`).then((x) => x.json()).catch(() => null)) as {
      match: City | null;
      options: City[];
    } | null;
    if (r?.match) return { name: r.match.name, uf: r.match.uf };
    if (r?.options.length) toast.message(`Existe “${r.options[0].name}” em ${r.options.map((o) => o.uf).join(", ")}. Escolha o estado.`);
    else toast.error(`Não achamos “${name}”${forUf ? ` em ${forUf}` : ""} na lista de municípios do IBGE.`);
    return null;
  };

  // Interpretação da frase: roda no navegador, instantânea e sem custo.
  const applyParse = (value: string) => {
    const p = parseSearchQuery(value);
    if (p.categories.length) setCategories(p.categories);
    if (p.nationwide && !p.uf) {
      setCities([]);
      setUf("");
    }
    // A frase manda na cidade principal; cidades extras adicionadas à mão são mantidas.
    if (p.city) setCities((c) => [p.city!, ...c.slice(1).filter((x) => x.name !== p.city!.name)]);
    if (p.uf) setUf(p.uf);
    if (p.limit) setLimit(p.limit);
    setFilters(p.filters);
    if (p.freeCity && !p.city) {
      void resolveRemote(p.freeCity).then((c) => {
        if (!c) return;
        setCities((x) => [c, ...x.slice(1).filter((y) => y.name !== c.name)]);
        setUf(c.uf);
      });
    }
  };

  // Evento de efeito: sempre usa a versão mais nova de applyParse sem reexecutar os efeitos
  const onParse = useEffectEvent((value: string) => applyParse(value));

  useEffect(() => {
    if (initialQuery && !parsedOnce.current) {
      parsedOnce.current = true;
      onParse(initialQuery);
    }
  }, [initialQuery]);

  useEffect(() => {
    const t = setTimeout(() => text.trim().length > 3 && onParse(text), 250);
    return () => clearTimeout(t);
  }, [text]);

  const cityOptions = useMemo(
    () => (uf && ufList.uf === uf ? ufList.cities.map((name) => ({ name, uf })) : CITIES.filter((c) => !uf || c.uf === uf)),
    [uf, ufList],
  );

  const addCity = async (raw: string) => {
    const name = raw.trim();
    if (name.length < 2) return;
    const known = findCity(name, uf || undefined) ?? (uf ? undefined : findCity(name));
    const city = known ? { name: known.name, uf: known.uf } : await resolveRemote(name, uf || undefined);
    if (!city) return;
    if (!uf) setUf(city.uf);
    setCities((c) => (c.some((x) => x.name === city.name && x.uf === city.uf) ? c : [...c, city].slice(0, 10)));
  };

  const toggleCity = (city: City) =>
    setCities((c) => (c.some((x) => x.name === city.name && x.uf === city.uf) ? c.filter((x) => !(x.name === city.name && x.uf === city.uf)) : [...c, city].slice(0, 10)));

  /** Trocar o estado tira as cidades de outros estados; "Todos" limpa tudo (busca no Brasil inteiro). */
  const changeUf = (next: string) => {
    setUf(next);
    setCities((c) => (next ? c.filter((x) => x.uf === next) : []));
  };

  const submit = (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!categories.length) return void toast.error("Diga o tipo de negócio. Ex.: “dentistas”, “barbearias”.");

    run({ query: text || undefined, categories, cities, uf: uf || undefined, limit, provider }, filters);
  };

  const activeProvider = providers.find((p) => p.id === provider);
  const hint = providerHint(activeProvider, providers.some((p) => p.id === "google" && p.configured));
  const understood = categories.length > 0 || cities.length > 0;
  const regionText = uf ? `${getState(uf)?.name ?? uf} · todas as cidades` : "Todo o Brasil";

  return (
    <form onSubmit={submit} action="/search" method="get" className="rounded-xl border bg-card p-3 shadow-soft sm:p-4">
      {/* action/method: se a pessoa tocar antes do JavaScript carregar, o navegador manda ?q= e a busca abre já preenchida */}
      <Label htmlFor="q" className="sr-only">
        O que você procura?
      </Label>
      <div className="flex flex-col gap-2 sm:flex-row">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
          <Input
            id="q"
            name="q"
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="O que você procura? Ex.: clínicas de estética em Fortaleza sem site"
            className="h-[52px] rounded-[10px] pl-10 text-base"
            autoComplete="off"
            autoFocus={!compact}
          />
        </div>
        <Button type="submit" size="lg" className="h-[52px] rounded-[10px] px-6 text-sm" disabled={pending}>
          {pending ? <Loader2 className="animate-spin" /> : <Search />}
          {pending ? "Buscando…" : "Encontrar leads"}
        </Button>
      </div>

      {progress && <SearchProgressBar progress={progress} label={cities.length ? "Consultando as cidades escolhidas" : `Buscando em ${regionText}`} />}

      {!understood && !text && !compact && (
        <div className="mt-3 flex flex-wrap gap-2">
          {EXAMPLES.map((ex) => (
            <button
              key={ex}
              type="button"
              onClick={() => setText(ex)}
              className="rounded-full border px-3 py-1 text-xs text-muted-foreground transition-colors duration-150 hover:border-foreground/30 hover:text-foreground"
            >
              {ex}
            </button>
          ))}
        </div>
      )}

      {understood && (
        <div className="mt-3 flex flex-wrap items-center gap-1.5 text-xs">
          <span className="mr-1 text-muted-foreground">Entendi:</span>
          {categories.map((c) => (
            <Chip key={c} onRemove={() => setCategories((x) => x.filter((y) => y !== c))}>
              {getCategory(c).plural}
            </Chip>
          ))}
          {cities.map((c) => (
            <Chip key={c.name + c.uf} onRemove={() => setCities((x) => x.filter((y) => y !== c))}>
              <MapPin className="size-3" /> {c.name} - {c.uf}
            </Chip>
          ))}
          {cities.length === 0 && categories.length > 0 && (
            <Chip>
              <Globe2 className="size-3" /> {regionText}
            </Chip>
          )}
          <Chip>{limit} resultados</Chip>
          {filters.website === "without" && <Chip onRemove={() => setFilters((f) => ({ ...f, website: undefined }))}>Sem site</Chip>}
          {filters.website === "with" && <Chip onRemove={() => setFilters((f) => ({ ...f, website: undefined }))}>Com site</Chip>}
          {filters.instagram && filters.instagram !== "any" && (
            <Chip onRemove={() => setFilters((f) => ({ ...f, instagram: undefined }))}>{filters.instagram === "with" ? "Com" : "Sem"} Instagram</Chip>
          )}
          {filters.whatsapp && filters.whatsapp !== "any" && (
            <Chip onRemove={() => setFilters((f) => ({ ...f, whatsapp: undefined }))}>{filters.whatsapp === "with" ? "Com" : "Sem"} WhatsApp</Chip>
          )}
          {!!filters.minReviews && <Chip onRemove={() => setFilters((f) => ({ ...f, minReviews: undefined }))}>{filters.minReviews}+ avaliações</Chip>}
          {!!filters.minRating && <Chip onRemove={() => setFilters((f) => ({ ...f, minRating: undefined }))}>Nota ≥ {filters.minRating}</Chip>}
          {filters.potential === "high" && <Chip onRemove={() => setFilters((f) => ({ ...f, potential: undefined }))}>Alto potencial</Chip>}
        </div>
      )}

      <div className="mt-3 border-t pt-3">
        <button
          type="button"
          onClick={() => setAdvanced((v) => !v)}
          className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground hover:text-foreground"
          aria-expanded={advanced}
        >
          <SlidersHorizontal className="size-3.5" /> Categoria, cidades, quantidade e fonte
          <ChevronDown className={cn("size-3.5 transition-transform duration-150", advanced && "rotate-180")} />
        </button>
        {advanced && (
          <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-[1.4fr_1.4fr_0.7fr_0.8fr_1fr]">
            <Field label="Categorias">
              <CategoryPicker value={categories} onChange={setCategories} />
            </Field>
            <Field label="Cidades">
              <CityPicker uf={uf} value={cities} options={cityOptions} onToggle={toggleCity} onAdd={addCity} onClear={() => setCities([])} />
            </Field>
            <Field label="Estado">
              <Select value={uf || "ALL"} onValueChange={(v) => changeUf(v === "ALL" ? "" : v)}>
                <SelectTrigger className="h-9 w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ALL">Todos (Brasil)</SelectItem>
                  {STATES.map((s) => (
                    <SelectItem key={s.uf} value={s.uf}>
                      {s.uf} · {s.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            <Field label="Quantidade">
              <Select value={String(limit)} onValueChange={(v) => setLimit(Number(v))}>
                <SelectTrigger className="h-9 w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {[...new Set([...LIMIT_OPTIONS, limit])].sort((a, b) => a - b).map((n) => (
                    <SelectItem key={n} value={String(n)}>
                      {n}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            <Field label="Fonte de dados">
              <Select value={provider} onValueChange={(v) => setProvider(v as ProviderId)}>
                <SelectTrigger className="h-9 w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {providers.map((p) => (
                    <SelectItem key={p.id} value={p.id} disabled={!p.configured}>
                      {p.label}
                      {!p.configured && " (não ativado)"}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
          </div>
        )}
        {advanced && hint && <p className="mt-2 text-xs text-muted-foreground">{hint}</p>}
      </div>
    </form>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="grid gap-1.5">
      <span className="text-xs font-medium text-muted-foreground">{label}</span>
      {children}
    </div>
  );
}

function Chip({ children, onRemove }: { children: React.ReactNode; onRemove?: () => void }) {
  return (
    <span className="inline-flex h-6 items-center gap-1 rounded-md bg-secondary px-2 font-medium text-secondary-foreground">
      {children}
      {onRemove && (
        <button type="button" onClick={onRemove} className="-mr-1 grid size-4 place-items-center rounded hover:bg-foreground/10 pointer-coarse:-my-1 pointer-coarse:size-7" aria-label="Remover">
          <X className="size-3" />
        </button>
      )}
    </span>
  );
}

function CategoryPicker({ value, onChange }: { value: string[]; onChange: (v: string[]) => void }) {
  const [open, setOpen] = useState(false);
  const label = value.length === 0 ? "Escolher…" : value.length === 1 ? getCategory(value[0]).plural : `${value.length} categorias`;
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="outline" className="h-9 w-full justify-between font-normal" role="combobox" aria-expanded={open}>
          <span className="truncate">{label}</span>
          <ChevronDown className="opacity-60" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-72 p-0" align="start">
        <Command>
          <CommandInput placeholder="Filtrar categorias…" />
          <CommandList>
            <CommandEmpty>Nenhuma categoria.</CommandEmpty>
            <CommandGroup>
              {CATEGORIES.map((c) => {
                const on = value.includes(c.slug);
                return (
                  <CommandItem
                    key={c.slug}
                    value={`${c.plural} ${c.synonyms.join(" ")}`}
                    onSelect={() => onChange(on ? value.filter((v) => v !== c.slug) : [...value, c.slug].slice(0, 5))}
                  >
                    <span className={cn("grid size-4 place-items-center rounded-[4px] border border-control bg-card dark:bg-transparent", on && "border-control-on bg-control-on text-control-on-foreground dark:bg-control-on")}>
                      {on && <Check className="size-3" />}
                    </span>
                    {c.plural}
                  </CommandItem>
                );
              })}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}

/**
 * Cidades: lista própria (a <datalist> nativa não rolava em alguns navegadores).
 * Com estado escolhido mostra todos os municípios do IBGE daquela UF; sem estado,
 * as principais do país + sugestões do IBGE para o que for digitado.
 * Nenhuma cidade marcada = busca geral no estado (ou no Brasil).
 */
function CityPicker({
  uf,
  value,
  options,
  onToggle,
  onAdd,
  onClear,
}: {
  uf: string;
  value: City[];
  options: City[];
  onToggle: (c: City) => void;
  onAdd: (name: string) => void;
  onClear: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const deferred = useDeferredValue(query);
  const [remote, setRemote] = useState<City[]>([]);

  useEffect(() => {
    const q = deferred.trim();
    if (uf || q.length < 2) return;
    let alive = true;
    const t = setTimeout(() => {
      fetch(`/api/geo/cidades?q=${encodeURIComponent(q)}`)
        .then((r) => r.json())
        .then((j: { cities?: City[] }) => alive && setRemote(j.cities ?? []))
        .catch(() => {});
    }, 180);
    return () => {
      alive = false;
      clearTimeout(t);
    };
  }, [deferred, uf]);

  const list = useMemo(() => {
    const q = fold(deferred.trim());
    const base = q ? options.filter((c) => fold(c.name).includes(q)) : options;
    const extra = !uf && q.length >= 2 ? remote.filter((r) => !base.some((b) => b.name === r.name && b.uf === r.uf)) : [];
    // Começa-com primeiro: "sal" acha Salvador antes de Vila Sales
    const sorted = q ? [...base].sort((a, b) => Number(!fold(a.name).startsWith(q)) - Number(!fold(b.name).startsWith(q))) : base;
    return [...sorted, ...extra].slice(0, 150);
  }, [deferred, options, remote, uf]);

  const isOn = (c: City) => value.some((v) => v.name === c.name && v.uf === c.uf);
  const scope = uf ? `Todas de ${uf}` : "Todo o Brasil";
  const label = value.length === 0 ? scope : value.length === 1 ? `${value[0].name} - ${value[0].uf}` : `${value.length} cidades`;

  return (
    <Popover
      open={open}
      onOpenChange={(o) => {
        setOpen(o);
        if (!o) setQuery("");
      }}
    >
      <PopoverTrigger asChild>
        <Button variant="outline" className="h-9 w-full justify-between font-normal" role="combobox" aria-expanded={open} aria-label="Cidades">
          <span className={cn("truncate", value.length === 0 && "text-muted-foreground")}>{label}</span>
          <ChevronDown className="opacity-60" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[min(20rem,calc(100vw-2rem))] p-0" align="start">
        <Command shouldFilter={false}>
          <CommandInput
            value={query}
            onValueChange={setQuery}
            placeholder={uf ? `Filtrar ${options.length} cidades de ${uf}…` : "Digite uma cidade…"}
            onKeyDown={(e) => {
              if (e.key === "Enter" && list.length === 0 && query.trim().length >= 2) {
                e.preventDefault();
                onAdd(query);
                setQuery("");
              }
            }}
          />
          <CommandList>
            <CommandGroup>
              <CommandItem
                value="__all"
                onSelect={() => {
                  onClear();
                  setOpen(false);
                }}
              >
                <Globe2 className="text-muted-foreground" />
                <span className="flex-1">{uf ? `Todas as cidades de ${uf}` : "Todo o Brasil (busca geral)"}</span>
                {value.length === 0 && <Check className="size-4" />}
              </CommandItem>
            </CommandGroup>
            {list.length === 0 && query.trim().length >= 2 ? (
              <p className="px-3 py-4 text-center text-sm text-muted-foreground">
                Nada na lista. Enter para procurar “{query.trim()}” no IBGE.
              </p>
            ) : (
              <CommandGroup heading={uf ? undefined : query ? "Cidades" : "Principais cidades"}>
                {list.map((c) => {
                  const on = isOn(c);
                  return (
                    <CommandItem key={c.name + c.uf} value={`${c.name}|${c.uf}`} onSelect={() => onToggle(c)}>
                      <span
                        className={cn(
                          "grid size-4 place-items-center rounded-[4px] border border-control bg-card dark:bg-transparent",
                          on && "border-control-on bg-control-on text-control-on-foreground dark:bg-control-on",
                        )}
                      >
                        {on && <Check className="size-3" />}
                      </span>
                      <span className="flex-1 truncate">{c.name}</span>
                      <span className="text-xs text-muted-foreground">{c.uf}</span>
                    </CommandItem>
                  );
                })}
              </CommandGroup>
            )}
          </CommandList>
          {value.length > 0 && (
            <div className="flex items-center justify-between border-t px-3 py-2 text-xs text-muted-foreground">
              <span>
                {value.length} de 10 cidades
              </span>
              <button type="button" onClick={onClear} className="font-medium text-foreground hover:underline">
                Limpar
              </button>
            </div>
          )}
        </Command>
      </PopoverContent>
    </Popover>
  );
}
