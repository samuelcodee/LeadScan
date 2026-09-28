"use client";

import { ArrowLeft, Check, ChevronDown, ChevronRight, CircleAlert, CopyPlus, Eye, Globe, Loader2, Monitor, PencilLine, RefreshCw, Smartphone, Sparkles, Tablet, X } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Activity as Offscreen, useCallback, useDeferredValue, useEffect, useRef, useState, useTransition } from "react";
import { toast } from "sonner";
import { duplicatePrototype, newSectionAction, regeneratePrototypeAction, savePrototypeSpec, shareAction } from "@/app/actions/prototypes";
import { DemoBadge } from "@/components/common/page-header";
import { EditorPanel, type EditorView } from "@/components/editor/editor-panel";
import { AiMenu, type StudioAi } from "@/components/prototypes/ai-menu";
import { DevicePreview, type Device } from "@/components/prototypes/device-preview";
import { ShareDialog } from "@/components/prototypes/share-dialog";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { useMediaQuery } from "@/hooks/use-media-query";
import type { TemplateId } from "@/lib/domain/categories";
import { formatDate } from "@/lib/format";
import { getTemplate, TEMPLATE_LIST } from "@/lib/templates/registry";
import { SECTION_LABEL, type SectionType } from "@/lib/templates/constants";
import type { SiteSpec } from "@/lib/templates/types";
import { cn } from "@/lib/utils";

type Version = { id: string; name: string; createdAt: Date };
type SaveState = "saved" | "saving" | "dirty" | "error";

/**
 * Estúdio do protótipo.
 * Computador: editor à esquerda (lista de seções → seção aberta, com "‹ Seções" para sair) e
 * o site à direita; clicar numa parte do site abre a edição dela.
 * Celular/tablet: duas telas com a barra de baixo, "Ver site" e "Editar". Tocar numa parte do
 * site seleciona e mostra "Editar ›"; dentro da seção, "Ver no site" volta para a prévia já nela.
 * O site só redesenha com o valor adiado (useDeferredValue): digitar nunca espera o site inteiro.
 */
export function Studio({
  prototype,
  lead,
  versions,
  initialShareUrl,
  aiEnabled,
  ai,
  leadPhotos,
}: {
  prototype: { id: string; name: string; spec: SiteSpec };
  lead: { id: string; name: string; isDemo: boolean; phone: string | null; whatsapp: string | null };
  versions: Version[];
  initialShareUrl: string | null;
  aiEnabled: boolean;
  ai: StudioAi;
  leadPhotos: string[];
}) {
  const router = useRouter();
  const [spec, setSpec] = useState(prototype.spec);
  const previewSpec = useDeferredValue(spec);
  const wide = useMediaQuery("(min-width: 1024px)");
  const narrow = useMediaQuery("(max-width: 639px)");
  const [picked, setDevice] = useState<Device | null>(null);
  // No celular abre no formato celular (o site de computador reduzido a 390 px fica ilegível)
  const device = picked ?? (narrow ? "mobile" : "desktop");
  const [view, setView] = useState<EditorView>({ kind: "sections" });
  const [mode, setMode] = useState<"site" | "edit">("site");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [focus, setFocus] = useState<{ id: string; n: number } | null>(null);
  const [save, setSave] = useState<SaveState>("saved");
  const [shareUrl, setShareUrl] = useState(initialShareUrl);
  const [busy, startBusy] = useTransition();
  const [adding, startAdding] = useTransition();
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const latest = useRef(spec);

  // Autosave com debounce: edições em sequência viram uma única gravação.
  const commit = useCallback(
    (next: SiteSpec) => {
      latest.current = next;
      setSpec(next);
      setSave("dirty");
      clearTimeout(timer.current);
      timer.current = setTimeout(async () => {
        setSave("saving");
        const r = await savePrototypeSpec({ id: prototype.id, spec: latest.current });
        setSave(r.ok ? "saved" : "error");
        if (!r.ok) toast.error(r.error);
      }, 700);
    },
    [prototype.id],
  );

  useEffect(() => {
    const warn = (e: BeforeUnloadEvent) => {
      if (save === "dirty" || save === "saving") e.preventDefault();
    };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [save]);

  const scrollPreviewTo = (id: string) => setFocus((f) => ({ id, n: (f?.n ?? 0) + 1 }));

  /** Navegação do editor. Abrir uma seção pela lista também leva o site até ela. */
  const changeView = (v: EditorView) => {
    setView(v);
    if (v.kind === "section") {
      setSelectedId(v.id);
      if (wide) scrollPreviewTo(v.id);
    }
  };

  const openSection = (id: string) => {
    changeView({ kind: "section", id });
    setMode("edit");
  };

  const showSite = (id: string | null) => {
    setMode("site");
    if (id) {
      setSelectedId(id);
      scrollPreviewTo(id);
    }
  };

  // Clique no site: no computador abre a edição na hora; no toque só seleciona (e mostra "Editar ›"),
  // para quem está só rolando e conferindo não cair dentro do editor sem querer.
  const onPreviewSelect = useCallback(
    (id: string) => {
      setSelectedId(id);
      if (wide) setView({ kind: "section", id });
    },
    [wide],
  );

  const regenerate = (opts: { templateId?: TemplateId; useAI?: boolean } = {}) =>
    startBusy(async () => {
      const r = await regeneratePrototypeAction({ id: prototype.id, ...opts });
      if (!r.ok) return void toast.error(r.error);
      latest.current = r.data.spec;
      setSpec(r.data.spec);
      setSave("saved");
      setSelectedId(null);
      setView({ kind: "sections" });
      toast.success(opts.useAI ? "Textos reescritos com IA" : opts.templateId ? `Template: ${getTemplate(opts.templateId).label}` : "Nova variação gerada");
    });

  const addSection = (type: SectionType) =>
    startAdding(async () => {
      const r = await newSectionAction({ id: prototype.id, type, spec });
      if (!r.ok) return void toast.error(r.error);
      // Entra antes do rodapé de chamada, se houver
      const ctaIdx = spec.sections.findIndex((s) => s.type === "cta" || s.type === "contact");
      const sections = [...spec.sections];
      sections.splice(ctaIdx >= 0 ? ctaIdx : sections.length, 0, r.data.section);
      commit({ ...spec, sections });
      changeView({ kind: "section", id: r.data.section.id });
    });

  const newVersion = () =>
    startBusy(async () => {
      const r = await duplicatePrototype({ id: prototype.id });
      if (!r.ok) return void toast.error(r.error);
      toast.success("Nova versão criada");
      router.push(`/prototypes/${r.data.id}`);
    });

  const publish = () =>
    startBusy(async () => {
      const r = await shareAction({ id: prototype.id });
      if (!r.ok) return void toast.error(r.error);
      setShareUrl(r.data.url);
      await navigator.clipboard.writeText(r.data.url).catch(() => {});
      toast.success("Publicado. Link copiado.", { action: { label: "Abrir", onClick: () => window.open(r.data.url, "_blank") } });
    });

  const panel = (
    <EditorPanel
      spec={spec}
      view={view}
      onView={changeView}
      onSpec={commit}
      onAdd={addSection}
      adding={adding}
      leadPhotos={leadPhotos}
      onShowSite={wide ? undefined : showSite}
    />
  );
  const selected = selectedId ? spec.sections.find((s) => s.id === selectedId) : null;
  const editing = !wide && mode === "edit";

  return (
    // data-fullbleed: sem o espaço da barra de navegação do app (o estúdio tem a própria)
    <div data-fullbleed className="flex h-dvh flex-col lg:h-[calc(100dvh-3.5rem)]">
      {/* Barra do estúdio: uma linha só, também no celular */}
      <div className="flex items-center gap-1.5 border-b bg-card px-2 py-2 sm:gap-2 sm:px-4">
        <Button asChild variant="ghost" size="icon" aria-label="Voltar ao lead">
          <Link href={`/leads/${lead.id}`}>
            <ArrowLeft />
          </Link>
        </Button>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            {lead.isDemo && <DemoBadge className="hidden sm:inline-flex" />}
            <p className="truncate text-sm font-semibold">{lead.name}</p>
          </div>
          <DropdownMenu>
            <DropdownMenuTrigger className="flex max-w-full items-center gap-1 text-xs text-muted-foreground hover:text-foreground">
              <span className="truncate">{prototype.name}</span> <ChevronDown className="size-3 shrink-0" />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start">
              <DropdownMenuLabel>Versões</DropdownMenuLabel>
              {versions.map((v) => (
                <DropdownMenuItem key={v.id} onSelect={() => router.push(`/prototypes/${v.id}`)}>
                  {v.id === prototype.id && <Check />}
                  <span className={v.id === prototype.id ? "" : "pl-6"}>{v.name}</span>
                  <span className="ml-auto text-xs text-muted-foreground">{formatDate(v.createdAt)}</span>
                </DropdownMenuItem>
              ))}
              <DropdownMenuSeparator />
              <DropdownMenuItem onSelect={newVersion}>
                <CopyPlus /> Salvar como nova versão
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        <SaveBadge state={save} />

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" disabled={busy} className="max-sm:size-10 max-sm:px-0" aria-label="Regenerar">
              <RefreshCw className={busy ? "animate-spin" : ""} /> <span className="hidden sm:inline">Regenerar</span>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-64">
            <DropdownMenuItem onSelect={() => regenerate()}>
              <RefreshCw /> Nova variação (sem custo)
            </DropdownMenuItem>
            {aiEnabled && (
              <DropdownMenuItem onSelect={() => regenerate({ useAI: true })}>
                <Sparkles /> Reescrever textos com IA
              </DropdownMenuItem>
            )}
            <DropdownMenuSeparator />
            <DropdownMenuLabel>Recriar com outro template</DropdownMenuLabel>
            {TEMPLATE_LIST.map((t) => (
              <DropdownMenuItem key={t.id} onSelect={() => regenerate({ templateId: t.id })}>
                <span className="size-3 rounded-full" style={{ background: t.theme.primary }} />
                {t.label}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
        <AiMenu
          prototypeId={prototype.id}
          spec={spec}
          ai={ai}
          onSpec={(next, message) => {
            commit(next);
            toast.success(message);
          }}
        />
        <Button variant="ink" onClick={publish} disabled={busy} className="hidden md:inline-flex">
          <Globe /> {shareUrl ? "Publicado" : "Publicar"}
        </Button>
        <ShareDialog prototypeId={prototype.id} lead={lead} initialUrl={shareUrl} onUrl={setShareUrl} />
      </div>

      <div className="flex min-h-0 flex-1">
        {wide && <aside className="flex w-[360px] shrink-0 flex-col border-r bg-card">{panel}</aside>}
        {editing && <div className="flex min-h-0 min-w-0 flex-1 flex-col bg-card">{panel}</div>}

        {/* No celular, editando: o site sai de cena mas continua montado (volta na hora, no mesmo lugar) */}
        <Offscreen mode={editing ? "hidden" : "visible"}>
          <div className="relative flex min-w-0 flex-1 flex-col bg-muted/60">
            <div className="flex items-center gap-2 px-3 py-2 sm:px-5">
              <p className="min-w-0 flex-1 truncate text-xs text-muted-foreground">
                <span className="pointer-coarse:hidden">Clique numa parte do site para editar</span>
                <span className="hidden pointer-coarse:inline">Toque numa parte do site para editar</span>
              </p>
              <ToggleGroup type="single" variant="outline" size="sm" value={device} onValueChange={(v) => v && setDevice(v as Device)} aria-label="Ver como">
                <ToggleGroupItem value="desktop" aria-label="Computador">
                  <Monitor /> <span className="hidden xl:inline">Computador</span>
                </ToggleGroupItem>
                <ToggleGroupItem value="tablet" aria-label="Tablet">
                  <Tablet /> <span className="hidden xl:inline">Tablet</span>
                </ToggleGroupItem>
                <ToggleGroupItem value="mobile" aria-label="Celular">
                  <Smartphone /> <span className="hidden xl:inline">Celular</span>
                </ToggleGroupItem>
              </ToggleGroup>
            </div>
            <div className={cn("min-h-0 flex-1", narrow && device === "mobile" ? "px-2" : "px-3 pb-3 sm:px-5 sm:pb-5")}>
              <DevicePreview
                spec={previewSpec}
                device={device}
                selectedId={selectedId}
                onSelectSection={onPreviewSelect}
                focus={focus}
                bare={narrow && device === "mobile"}
              />
            </div>

            {/* Toque numa parte do site: botão claro para entrar nela (e um X para desmarcar) */}
            {!wide && selected && (
              <div className="absolute inset-x-3 bottom-3 z-10 flex items-center gap-1.5 rounded-xl border bg-card p-1.5 pl-3 shadow-premium">
                <p className="min-w-0 flex-1 truncate text-sm">
                  <span className="text-muted-foreground">Selecionado: </span>
                  <span className="font-medium">{SECTION_LABEL[selected.type]}</span>
                </p>
                <Button variant="ghost" size="icon" onClick={() => setSelectedId(null)} aria-label="Desmarcar seção">
                  <X />
                </Button>
                <Button onClick={() => openSection(selected.id)}>
                  Editar <ChevronRight />
                </Button>
              </div>
            )}
          </div>
        </Offscreen>
      </div>

      {/* Celular/tablet: trocar entre o site e o editor sem nada por cima da tela */}
      <nav className="grid grid-cols-2 gap-1 border-t bg-card p-1.5 pb-[max(0.375rem,env(safe-area-inset-bottom))] lg:hidden" aria-label="Estúdio">
        <button
          type="button"
          onClick={() => showSite(view.kind === "section" ? view.id : null)}
          aria-pressed={!editing}
          className={cn("flex h-11 items-center justify-center gap-2 rounded-lg text-sm font-medium text-muted-foreground", !editing && "bg-lime text-ink")}
        >
          <Eye className="size-4" aria-hidden /> Ver site
        </button>
        <button
          type="button"
          onClick={() => setMode("edit")}
          aria-pressed={editing}
          className={cn("flex h-11 items-center justify-center gap-2 rounded-lg text-sm font-medium text-muted-foreground", editing && "bg-lime text-ink")}
        >
          <PencilLine className="size-4" aria-hidden /> Editar
        </button>
      </nav>
    </div>
  );
}

function SaveBadge({ state }: { state: SaveState }) {
  const label = { saving: "Salvando…", saved: "Salvo", dirty: "Alterações pendentes", error: "Erro ao salvar" }[state];
  return (
    <span className={cn("flex shrink-0 items-center gap-1 text-xs text-muted-foreground", state === "error" && "text-destructive")} aria-live="polite" title={label}>
      {state === "saving" || state === "dirty" ? (
        <Loader2 className="size-3.5 animate-spin" aria-hidden />
      ) : state === "error" ? (
        <CircleAlert className="size-3.5" aria-hidden />
      ) : (
        <Check className="size-3.5" aria-hidden />
      )}
      <span className="max-md:sr-only">{label}</span>
    </span>
  );
}
