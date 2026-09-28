"use client";

import { ChevronLeft, ChevronRight, Eye, Layers, Palette } from "lucide-react";
import { useEffect, useRef } from "react";
import { SectionEditor } from "@/components/editor/section-editor";
import { SectionList } from "@/components/editor/section-list";
import { StyleEditor } from "@/components/editor/style-editor";
import { Button } from "@/components/ui/button";
import { SECTION_LABEL, type SectionType } from "@/lib/templates/constants";
import { getTemplate } from "@/lib/templates/registry";
import type { Section, SiteSpec } from "@/lib/templates/types";
import { cn } from "@/lib/utils";

export type EditorView = { kind: "sections" } | { kind: "style" } | { kind: "section"; id: string };

/**
 * Editor em dois níveis, igual no computador e no celular:
 *  1. lista de seções (ou estilo), com "Editar ›" em cada uma;
 *  2. a seção aberta, com barra fixa: "‹ Seções" para sair, ‹ › para ir à anterior/próxima
 *     e "Ver no site" (celular) para conferir sem perder o lugar.
 * Nada de gaveta por cima: o painel é a própria tela, então o teclado do celular não prende ninguém.
 */
export function EditorPanel({
  spec,
  view,
  onView,
  onSpec,
  onAdd,
  adding,
  leadPhotos,
  onShowSite,
}: {
  spec: SiteSpec;
  view: EditorView;
  onView: (v: EditorView) => void;
  onSpec: (next: SiteSpec) => void;
  onAdd: (type: SectionType) => void;
  adding: boolean;
  leadPhotos: string[];
  /** Celular: volta para a prévia já na seção aberta. */
  onShowSite?: (id: string | null) => void;
}) {
  const scroller = useRef<HTMLDivElement>(null);
  const viewKey = view.kind === "section" ? view.id : view.kind;
  // Trocou de tela no painel: começa do topo (sem herdar a rolagem da lista)
  useEffect(() => {
    scroller.current?.scrollTo({ top: 0 });
  }, [viewKey]);

  const sections = spec.sections;
  const index = view.kind === "section" ? sections.findIndex((s) => s.id === view.id) : -1;
  const selected = index >= 0 ? sections[index] : null;
  const updateSection = (s: Section) => onSpec({ ...spec, sections: sections.map((x) => (x.id === s.id ? s : x)) });
  const go = (d: -1 | 1) => {
    const next = sections[index + d];
    if (next) onView({ kind: "section", id: next.id });
  };

  if (view.kind === "section" && selected) {
    return (
      <div className="flex h-full min-h-0 flex-col">
        <div className="flex items-center gap-1 border-b bg-card px-2 py-2">
          <Button variant="ghost" onClick={() => onView({ kind: "sections" })} className="-ml-0.5 px-2" aria-label="Voltar para a lista de seções">
            <ChevronLeft /> Seções
          </Button>
          <div className="min-w-0 flex-1 text-center">
            <p className="truncate text-sm font-semibold">{SECTION_LABEL[selected.type]}</p>
            <p className="text-[11px] text-muted-foreground tabular">
              {index + 1} de {sections.length}
              {!selected.visible && " · oculta no site"}
            </p>
          </div>
          <Button variant="ghost" size="icon" onClick={() => go(-1)} disabled={index === 0} aria-label="Seção anterior">
            <ChevronLeft />
          </Button>
          <Button variant="ghost" size="icon" onClick={() => go(1)} disabled={index === sections.length - 1} aria-label="Próxima seção">
            <ChevronRight />
          </Button>
        </div>
        <div ref={scroller} className="min-h-0 flex-1 overflow-y-auto overscroll-contain p-4">
          <SectionEditor key={selected.id} section={selected} templateId={spec.templateId} onChange={updateSection} leadPhotos={leadPhotos} />
          <div className="mt-6 grid grid-cols-2 gap-2 border-t pt-4">
            <Button variant="outline" onClick={() => onView({ kind: "sections" })}>
              <Layers /> Todas as seções
            </Button>
            {onShowSite ? (
              <Button variant="ink" onClick={() => onShowSite(selected.id)}>
                <Eye /> Ver no site
              </Button>
            ) : (
              <Button variant="ink" onClick={() => (index < sections.length - 1 ? go(1) : onView({ kind: "sections" }))}>
                {index < sections.length - 1 ? (
                  <>
                    Próxima <ChevronRight />
                  </>
                ) : (
                  "Concluir"
                )}
              </Button>
            )}
          </div>
        </div>
      </div>
    );
  }

  const onStyle = view.kind === "style";
  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="border-b bg-card p-2">
        <div className="grid grid-cols-2 gap-1 rounded-lg bg-muted p-1" role="tablist" aria-label="Editar">
          {[
            { id: "sections" as const, label: "Seções", icon: Layers },
            { id: "style" as const, label: "Cores e fontes", icon: Palette },
          ].map((t) => {
            const on = (t.id === "style") === onStyle;
            return (
              <button
                key={t.id}
                type="button"
                role="tab"
                aria-selected={on}
                onClick={() => onView({ kind: t.id })}
                className={cn(
                  "inline-flex h-8 items-center justify-center gap-1.5 rounded-md text-sm font-medium text-muted-foreground transition-colors pointer-coarse:h-10 [&_svg]:size-4",
                  on && "bg-card text-foreground shadow-sm",
                )}
              >
                <t.icon aria-hidden /> {t.label}
              </button>
            );
          })}
        </div>
      </div>
      <div ref={scroller} className="min-h-0 flex-1 overflow-y-auto overscroll-contain p-4">
        {onStyle ? (
          <StyleEditor
            theme={spec.theme}
            templateId={spec.templateId}
            onTheme={(theme) => onSpec({ ...spec, theme })}
            onApplyTemplateLook={(id) => onSpec({ ...spec, templateId: id, theme: getTemplate(id).theme })}
            onApplyStyle={(preset) =>
              onSpec({
                ...spec,
                theme: { ...spec.theme, font: preset.font, radius: preset.radius, surface: preset.surface, style: preset.id },
                sections: sections.map((s) => (s.type === "hero" ? { ...s, data: { ...s.data, layout: preset.heroLayout } } : s)),
              })
            }
          />
        ) : (
          <>
            <p className="mb-3 text-xs text-muted-foreground">Toque numa seção para editar os textos e as fotos. As setas mudam a ordem no site.</p>
            <SectionList
              sections={sections}
              onOpen={(id) => onView({ kind: "section", id })}
              onChange={(next) => onSpec({ ...spec, sections: next })}
              onAdd={onAdd}
              adding={adding}
            />
          </>
        )}
      </div>
    </div>
  );
}
