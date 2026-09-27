"use client";

import { Search } from "lucide-react";

/** Botão leve da busca global: a paleta (cmdk) só é baixada quando alguém abre. */
export function SearchTrigger({ onOpen }: { onOpen: () => void }) {
  return (
    <button
      type="button"
      onClick={onOpen}
      aria-label="Busca global (Ctrl+K)"
      className="flex h-9 w-full max-w-md items-center gap-2 rounded-md border border-input bg-card px-3 text-sm text-muted-foreground transition-colors duration-150 hover:border-foreground/20"
    >
      <Search className="size-4" aria-hidden />
      <span className="truncate">Buscar leads, protótipos…</span>
      <kbd className="ml-auto hidden rounded border bg-muted px-1.5 font-mono text-[11px] md:inline">Ctrl K</kbd>
    </button>
  );
}
