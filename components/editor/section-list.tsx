"use client";

import { ArrowDown, ArrowUp, Eye, EyeOff, GripVertical, Plus, Trash2 } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { SECTION_LABEL, SECTION_TYPES, type SectionType } from "@/lib/templates/constants";
import type { Section } from "@/lib/templates/types";
import { cn } from "@/lib/utils";

/**
 * Lista de seções: arrastar para reordenar (desktop), setas (teclado/toque),
 * mostrar/ocultar, remover e adicionar.
 */
export function SectionList({
  sections,
  selectedId,
  onSelect,
  onChange,
  onAdd,
  adding,
}: {
  sections: Section[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  onChange: (sections: Section[]) => void;
  onAdd: (type: SectionType) => void;
  adding: boolean;
}) {
  const [dragId, setDragId] = useState<string | null>(null);
  const [overId, setOverId] = useState<string | null>(null);

  const move = (from: number, to: number) => {
    if (to < 0 || to >= sections.length) return;
    const next = [...sections];
    const [item] = next.splice(from, 1);
    next.splice(to, 0, item);
    onChange(next);
  };

  return (
    <div className="grid gap-1">
      {sections.map((s, i) => (
        <div
          key={s.id}
          draggable
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
            "group flex items-center gap-1 rounded-md border bg-background pl-1 pr-1 transition-colors duration-150",
            selectedId === s.id ? "border-foreground/50" : "border-transparent hover:bg-muted/60",
            overId === s.id && dragId !== s.id && "border-dashed border-foreground/60",
            dragId === s.id && "opacity-50",
          )}
        >
          <GripVertical className="size-4 shrink-0 cursor-grab text-muted-foreground" aria-hidden />
          <button
            type="button"
            onClick={() => onSelect(s.id)}
            className={cn("min-w-0 flex-1 truncate py-2 text-left text-sm", !s.visible && "text-muted-foreground line-through")}
          >
            {SECTION_LABEL[s.type]}
          </button>
          <div className="flex items-center opacity-100 transition-opacity duration-150 sm:opacity-0 sm:group-hover:opacity-100 sm:group-focus-within:opacity-100">
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
            >
              {s.visible ? <Eye /> : <EyeOff />}
            </Button>
            {s.type !== "hero" && (
              <Button variant="ghost" size="icon-xs" onClick={() => onChange(sections.filter((x) => x.id !== s.id))} aria-label="Remover seção">
                <Trash2 />
              </Button>
            )}
          </div>
        </div>
      ))}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" size="sm" className="mt-2" disabled={adding}>
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
