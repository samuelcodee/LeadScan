"use client";

import { ArrowLeft, Check, ChevronDown, CopyPlus, Globe, Loader2, Monitor, PanelLeft, RefreshCw, Smartphone, Sparkles, Tablet } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState, useTransition } from "react";
import { toast } from "sonner";
import { duplicatePrototype, newSectionAction, regeneratePrototypeAction, savePrototypeSpec, shareAction } from "@/app/actions/prototypes";
import { DemoBadge } from "@/components/common/page-header";
import { SectionEditor } from "@/components/editor/section-editor";
import { SectionList } from "@/components/editor/section-list";
import { StyleEditor } from "@/components/editor/style-editor";
import { AiMenu, type StudioAi } from "@/components/prototypes/ai-menu";
import { DevicePreview, type Device } from "@/components/prototypes/device-preview";
import { ShareDialog } from "@/components/prototypes/share-dialog";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import type { TemplateId } from "@/lib/domain/categories";
import { formatDate } from "@/lib/format";
import { getTemplate, TEMPLATE_LIST } from "@/lib/templates/registry";
import { SECTION_LABEL, type SectionType } from "@/lib/templates/constants";
import type { Section, SiteSpec } from "@/lib/templates/types";
import { useMediaQuery } from "@/hooks/use-media-query";

type Version = { id: string; name: string; createdAt: Date };
type SaveState = "saved" | "saving" | "dirty" | "error";

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
  const [device, setDevice] = useState<Device>("desktop");
  const [selectedId, setSelectedId] = useState<string | null>(spec.sections[0]?.id ?? null);
  const [tab, setTab] = useState<"content" | "style">("content");
  const [save, setSave] = useState<SaveState>("saved");
  const [shareUrl, setShareUrl] = useState(initialShareUrl);
  const [editorOpen, setEditorOpen] = useState(false);
  const [busy, startBusy] = useTransition();
  const [adding, startAdding] = useTransition();
  const wide = useMediaQuery("(min-width: 1024px)");
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

  const selected = spec.sections.find((s) => s.id === selectedId) ?? null;
  const updateSection = (s: Section) => commit({ ...spec, sections: spec.sections.map((x) => (x.id === s.id ? s : x)) });

  const selectSection = (id: string) => {
    setSelectedId(id);
    setTab("content");
    if (!wide) setEditorOpen(true);
  };

  const regenerate = (opts: { templateId?: TemplateId; useAI?: boolean } = {}) =>
    startBusy(async () => {
      const r = await regeneratePrototypeAction({ id: prototype.id, ...opts });
      if (!r.ok) return void toast.error(r.error);
      latest.current = r.data.spec;
      setSpec(r.data.spec);
      setSave("saved");
      setSelectedId(r.data.spec.sections[0]?.id ?? null);
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
      setSelectedId(r.data.section.id);
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

  const editor = (
    <Tabs value={tab} onValueChange={(v) => setTab(v as typeof tab)} className="flex h-full flex-col gap-0">
      <div className="border-b px-4 py-3">
        <TabsList className="w-full">
          <TabsTrigger value="content">Conteúdo</TabsTrigger>
          <TabsTrigger value="style">Estilo</TabsTrigger>
        </TabsList>
      </div>
      <TabsContent value="content" className="min-h-0 flex-1 overflow-y-auto">
        <div className="border-b p-4">
          <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Seções</p>
          <SectionList sections={spec.sections} selectedId={selectedId} onSelect={setSelectedId} onChange={(sections) => commit({ ...spec, sections })} onAdd={addSection} adding={adding} />
        </div>
        {selected && (
          <div className="p-4">
            <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Editar · {SECTION_LABEL[selected.type]}</p>
            <SectionEditor key={selected.id} section={selected} templateId={spec.templateId} onChange={updateSection} leadPhotos={leadPhotos} />
          </div>
        )}
      </TabsContent>
      <TabsContent value="style" className="min-h-0 flex-1 overflow-y-auto p-4">
        <StyleEditor
          theme={spec.theme}
          templateId={spec.templateId}
          onTheme={(theme) => commit({ ...spec, theme })}
          onApplyTemplateLook={(id) => commit({ ...spec, templateId: id, theme: getTemplate(id).theme })}
          onApplyStyle={(preset) =>
            commit({
              ...spec,
              theme: { ...spec.theme, font: preset.font, radius: preset.radius, surface: preset.surface, style: preset.id },
              sections: spec.sections.map((s) => (s.type === "hero" ? { ...s, data: { ...s.data, layout: preset.heroLayout } } : s)),
            })
          }
        />
      </TabsContent>
    </Tabs>
  );

  return (
    <div className="flex h-[calc(100dvh-3.5rem)] flex-col">
      {/* Barra do estúdio */}
      <div className="flex flex-wrap items-center gap-2 border-b bg-card px-3 py-2 sm:px-4">
        <Button asChild variant="ghost" size="icon" aria-label="Voltar ao lead">
          <Link href={`/leads/${lead.id}`}>
            <ArrowLeft />
          </Link>
        </Button>
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            {lead.isDemo && <DemoBadge />}
            <p className="truncate text-sm font-semibold">{lead.name}</p>
          </div>
          <DropdownMenu>
            <DropdownMenuTrigger className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground">
              {prototype.name} <ChevronDown className="size-3" />
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

        <span className="ml-1 hidden items-center gap-1 text-xs text-muted-foreground md:flex" aria-live="polite">
          {save === "saving" && (
            <>
              <Loader2 className="size-3 animate-spin" /> Salvando…
            </>
          )}
          {save === "saved" && (
            <>
              <Check className="size-3" /> Salvo
            </>
          )}
          {save === "dirty" && "Alterações pendentes"}
          {save === "error" && <span className="text-destructive">Erro ao salvar</span>}
        </span>

        <ToggleGroup type="single" variant="outline" size="sm" value={device} onValueChange={(v) => v && setDevice(v as Device)} className="mx-auto" aria-label="Dispositivo">
          <ToggleGroupItem value="desktop" aria-label="Desktop">
            <Monitor /> <span className="hidden xl:inline">Desktop</span>
          </ToggleGroupItem>
          <ToggleGroupItem value="tablet" aria-label="Tablet">
            <Tablet /> <span className="hidden xl:inline">Tablet</span>
          </ToggleGroupItem>
          <ToggleGroupItem value="mobile" aria-label="Mobile">
            <Smartphone /> <span className="hidden xl:inline">Mobile</span>
          </ToggleGroupItem>
        </ToggleGroup>

        <div className="flex flex-wrap items-center gap-2">
          <Button variant="outline" className="lg:hidden" onClick={() => setEditorOpen(true)}>
            <PanelLeft /> Editar
          </Button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" disabled={busy}>
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
          <Button variant="ink" onClick={publish} disabled={busy} className="hidden sm:inline-flex">
            <Globe /> {shareUrl ? "Publicado" : "Publicar"}
          </Button>
          <ShareDialog prototypeId={prototype.id} lead={lead} initialUrl={shareUrl} onUrl={setShareUrl} />
        </div>
      </div>

      <div className="flex min-h-0 flex-1">
        {wide && <aside className="w-[340px] shrink-0 border-r bg-card">{editor}</aside>}
        <div className="min-w-0 flex-1 bg-muted/60 p-3 sm:p-5">
          <DevicePreview spec={spec} device={device} selectedId={selectedId} onSelectSection={selectSection} />
        </div>
      </div>

      {!wide && (
        <Sheet open={editorOpen} onOpenChange={setEditorOpen}>
          <SheetContent side="bottom" className="h-[80dvh] gap-0 p-0">
            <SheetTitle className="sr-only">Editor do protótipo</SheetTitle>
            {editor}
          </SheetContent>
        </Sheet>
      )}
    </div>
  );
}
