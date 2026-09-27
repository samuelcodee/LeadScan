"use client";

import { Search } from "lucide-react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState, useTransition } from "react";
import { StatusDot } from "@/components/leads/lead-actions";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { STATUS_META, STATUS_ORDER } from "@/lib/domain/lead-status";
import { cn } from "@/lib/utils";

/** Busca (debounce 300ms), etapa e ordenação — tudo na URL, filtrado no servidor. */
export function LeadsToolbar({ showStatus = true }: { showStatus?: boolean }) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const [q, setQ] = useState(params.get("q") ?? "");
  const [pending, start] = useTransition();

  const push = (patch: Record<string, string | null>) => {
    const next = new URLSearchParams(params.toString());
    for (const [k, v] of Object.entries(patch)) {
      if (v) next.set(k, v);
      else next.delete(k);
    }
    next.delete("page");
    start(() => router.replace(`${pathname}?${next.toString()}`, { scroll: false }));
  };

  useEffect(() => {
    if ((params.get("q") ?? "") === q) return;
    const t = setTimeout(() => push({ q: q.trim() || null }), 300);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q]);

  return (
    <div className={cn("flex flex-wrap items-center gap-2", pending && "opacity-70")}>
      <div className="relative min-w-56 flex-1 sm:max-w-sm">
        <Search className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
        <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Nome, cidade ou categoria" className="h-9 pl-8" aria-label="Buscar nos seus leads" />
      </div>
      {showStatus && (
        <Select value={params.get("status") ?? "ALL"} onValueChange={(v) => push({ status: v === "ALL" ? null : v })}>
          <SelectTrigger className="h-9 w-48" aria-label="Filtrar por etapa">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">Todas as etapas</SelectItem>
            {STATUS_ORDER.map((s) => (
              <SelectItem key={s} value={s}>
                <StatusDot status={s} /> {STATUS_META[s].label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      )}
      <Select value={params.get("sort") ?? "score"} onValueChange={(v) => push({ sort: v === "score" ? null : v })}>
        <SelectTrigger className="h-9 w-48" aria-label="Ordenar">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="score">Maior potencial</SelectItem>
          <SelectItem value="recent">Atualizados recentemente</SelectItem>
          <SelectItem value="name">Nome (A–Z)</SelectItem>
        </SelectContent>
      </Select>
    </div>
  );
}
