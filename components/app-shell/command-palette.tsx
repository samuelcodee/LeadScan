"use client";

import { Sparkles } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, useTransition } from "react";
import { quickFindLeads } from "@/app/actions/leads";
import { NAV } from "@/components/app-shell/nav";
import { ScoreBadge } from "@/components/leads/score";
import { Command, CommandDialog, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import type { ScoreTier } from "@/lib/scoring";

type Hit = { id: string; name: string; city: string; state: string; categoryLabel: string; score: number; scoreTier: ScoreTier };

/**
 * Busca global (⌘K / Ctrl+K): leads salvos, navegação e "buscar novos leads" com o texto digitado.
 * Carregada sob demanda pela barra do topo (o atalho de teclado mora lá).
 */
export function CommandPalette({ open, onOpenChange }: { open: boolean; onOpenChange: (v: boolean) => void }) {
  const router = useRouter();
  const [q, setQ] = useState("");
  const [hits, setHits] = useState<Hit[]>([]);
  const [, start] = useTransition();
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);

  // Debounce de 200ms: não consulta o banco a cada tecla
  useEffect(() => {
    clearTimeout(timer.current);
    if (q.trim().length < 2) {
      timer.current = setTimeout(() => setHits([]), 0);
      return;
    }
    timer.current = setTimeout(() => {
      start(async () => {
        const r = await quickFindLeads({ q });
        if (r.ok) setHits(r.data as Hit[]);
      });
    }, 200);
    return () => clearTimeout(timer.current);
  }, [q]);

  const go = (href: string) => {
    onOpenChange(false);
    setQ("");
    router.push(href);
  };

  return (
    <CommandDialog open={open} onOpenChange={onOpenChange} title="Busca global" description="Busque leads ou navegue pelo app">
      {/* o CommandDialog do shadcn novo não traz o <Command> (contexto do cmdk) — sem ele o campo quebra */}
      <Command>
      <CommandInput value={q} onValueChange={setQ} placeholder="Buscar leads, páginas… ou descreva uma nova busca" />
      <CommandList>
        <CommandEmpty>Nada encontrado.</CommandEmpty>
        {q.trim().length > 2 && (
          <CommandGroup heading="Prospectar">
            <CommandItem value={`nova-busca ${q}`} onSelect={() => go(`/search?q=${encodeURIComponent(q)}`)}>
              <Sparkles className="text-brand-ink" />
              Buscar novos leads: <span className="font-medium">“{q}”</span>
            </CommandItem>
          </CommandGroup>
        )}
        {hits.length > 0 && (
          <CommandGroup heading="Seus leads">
            {hits.map((h) => (
              <CommandItem key={h.id} value={`lead ${h.id} ${h.name}`} onSelect={() => go(`/leads/${h.id}`)}>
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium">{h.name}</p>
                  <p className="truncate text-xs text-muted-foreground">
                    {h.categoryLabel} · {h.city} - {h.state}
                  </p>
                </div>
                <ScoreBadge score={h.score} tier={h.scoreTier} />
              </CommandItem>
            ))}
          </CommandGroup>
        )}
        <CommandGroup heading="Ir para">
          {NAV.map((n) => (
            <CommandItem key={n.href} value={`nav ${n.label}`} onSelect={() => go(n.href)}>
              <n.icon />
              {n.label}
            </CommandItem>
          ))}
        </CommandGroup>
      </CommandList>
      </Command>
    </CommandDialog>
  );
}
