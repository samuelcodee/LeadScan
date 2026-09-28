"use client";

import { ArrowDown, ArrowUp, ChevronRight, Eye, EyeOff, GripVertical, Plus, Trash2 } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { useMediaQuery } from "@/hooks/use-media-query";
import { SECTION_LABEL, SECTION_TYPES, type SectionType } from "@/lib/templates/constants";
import type { Section } from "@/lib/templates/types";
import { cn } from "@/lib/utils";

/**
 * Lista de seções: tocar no nome abre a seção; setas mudam a ordem; olho mostra/oculta;
 * lixeira remove. Arrastar para reordenar só com mouse (no toque disputava com a rolagem).
 */
export function SectionList({
  sections,
  onOpen,
  onChange,
  onAdd,
  adding,
}: {
  sections: Section[];
  onOpen: (id: string) => void;
  onChange: (sections: Section[]) => void;
  onAdd: (type: SectionType) => void;
  adding: boolean;
}) {
  const [dragId, setDragId] = useState<string | null>(null);
  const [overId, setOverId] = useState<string | null>(null);
  const canDrag = useMediaQuery("(pointer: fine)");

  const move = (from: number, to: number) => {
    if (to < 0 || to >= sections.length) return;
    const next = [...sections];
    const [item] = next.splice(from, 1);
    next.splice(to, 0, item);
    onChange(next);
  };

  return (
    <div className="grid grid-cols-1 gap-1.5">
      {sections.map((s, i) => (
        <div
          key={s.id}
          draggable={canDrag}
          onDragStart={(e) => {
            setDragId(s.id);
            e.dataTransfer.effectAllowed = "move";
          }}
          onDragOver={(e) => {
            e.preventDefault();
            setOverId(s.id);
          }}
          onDragLeave={() => setOverId((o) => (o === s.id ? null : o))}
          onDrop={(e) => {
            e.preventDefault();
            const from = sections.findIndex((x) => x.id === dragId);
            if (from >= 0) move(from, i);
            setDragId(null);
            setOverId(null);
          }}
          onDragEnd={() => {
            setDragId(null);
            setOverId(null);
          }}
          className={cn(
            "flex items-center gap-0.5 rounded-md border bg-background pr-1 transition-colors duration-150",
            overId === s.id && dragId !== s.id && "border-dashed border-foreground/60",
            dragId === s.id && "opacity-50",
          )}
        >
          {canDrag && <GripVertical className="ml-1 size-4 shrink-0 cursor-grab text-muted-foreground" aria-hidden />}
          <button
            type="button"
            onClick={() => onOpen(s.id)}
            className="flex min-w-0 flex-1 items-center gap-1 rounded-md py-2.5 pl-2.5 text-left text-sm hover:bg-muted/60 pointer-coarse:py-3"
            aria-label={`Editar ${SECTION_LABEL[s.type]}`}
          >
            <span className={cn("min-w-0 flex-1 truncate font-medium", !s.visible && "text-muted-foreground line-through")}>{SECTION_LABEL[s.type]}</span>
            <span className="flex shrink-0 items-center text-xs text-muted-foreground">
              Editar <ChevronRight className="size-4" aria-hidden />
            </span>
          </button>
          <span className="mx-0.5 h-6 w-px shrink-0 bg-border" aria-hidden />
          <Button variant="ghost" size="icon-xs" onClick={() => move(i, i - 1)} disabled={i === 0} aria-label="Subir seção">
            <ArrowUp />
          </Button>
          <Button variant="ghost" size="icon-xs" onClick={() => move(i, i + 1)} disabled={i === sections.length - 1} aria-label="Descer seção">
            <ArrowDown />
          </Button>
          <Button
            variant="ghost"
            size="icon-xs"
            onClick={() => onChange(sections.map((x) => (x.id === s.id ? ({ ...x, visible: !x.visible } as Section) : x)))}
            aria-label={s.visible ? "Ocultar seção" : "Mostrar seção"}
            title={s.visible ? "Ocultar no site" : "Mostrar no site"}
          >
            {s.visible ? <Eye /> : <EyeOff />}
          </Button>
          {s.type !== "hero" ? (
            <Button variant="ghost" size="icon-xs" onClick={() => onChange(sections.filter((x) => x.id !== s.id))} aria-label="Remover seção">
              <Trash2 />
            </Button>
          ) : (
            <span className="size-6 shrink-0 pointer-coarse:size-8" aria-hidden />
          )}
        </div>
      ))}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" className="mt-2" disabled={adding}>
            <Plus /> {adding ? "Adicionando…" : "Adicionar seção"}
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="w-56">
          <DropdownMenuLabel>Nova seção</DropdownMenuLabel>
          {SECTION_TYPES.filter((t) => t !== "hero").map((t) => (
            <DropdownMenuItem key={t} onSelect={() => onAdd(t)}>
              {SECTION_LABEL[t]}
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}
