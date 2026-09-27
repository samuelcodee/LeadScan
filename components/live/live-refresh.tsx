"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { subscribeLive, subscribeLiveStatus, type LiveStatus } from "@/lib/client/live";
import { cn } from "@/lib/utils";

/** Só estes eventos mudam números da página; mensagens de chat têm canal próprio na tela. */
const DATA_EVENTS = new Set(["sale", "charge", "profile", "friend"]);

/**
 * Liga a página ao canal ao vivo (SSE compartilhado da aba). Quando chega um evento,
 * os dados do servidor são recarregados (router.refresh) — gráficos, ranking e totais
 * mudam sem F5. Vários eventos em sequência viram um único refresh.
 */
export function LiveRefresh({ topics, className, label = "Ao vivo" }: { topics: ("me" | "community")[]; className?: string; label?: string }) {
  const router = useRouter();
  const [state, setState] = useState<LiveStatus>("connecting");
  const [updatedAt, setUpdatedAt] = useState<Date | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);
  // aba em segundo plano não recarrega: marca e atualiza quando voltar
  const stale = useRef(false);
  const key = topics.join(",");

  useEffect(() => subscribeLiveStatus(setState), []);

  useEffect(() => {
    const onVisible = () => {
      if (document.visibilityState !== "visible" || !stale.current) return;
      stale.current = false;
      router.refresh();
      setUpdatedAt(new Date());
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => document.removeEventListener("visibilitychange", onVisible);
  }, [router]);

  useEffect(() => {
    const wanted = new Set(key.split(","));
    const off = subscribeLive((e) => {
      if (!DATA_EVENTS.has(e.type) || !wanted.has(e.scope)) return;
      if (e.type === "sale" && e.mine && e.scope === "me" && (e.points ?? 0) > 0) toast.success(`Pagamento confirmado. +${e.points} pontos no ranking.`);
      clearTimeout(timer.current);
      // Evento da comunidade chega em todas as abas ao mesmo tempo: um atraso aleatório espalha
      // os refreshes (o primeiro reabastece o cache e os outros já leem dele)
      const delay = e.scope === "community" && !e.mine ? 600 + Math.random() * 2400 : 600;
      timer.current = setTimeout(() => {
        if (document.visibilityState !== "visible") return void (stale.current = true);
        router.refresh();
        setUpdatedAt(new Date());
      }, delay);
    });
    return () => {
      clearTimeout(timer.current);
      off();
    };
  }, [key, router]);

  return (
    <span className={cn("inline-flex items-center gap-1.5 text-xs text-muted-foreground", className)} aria-live="polite">
      <span className="relative flex size-2">
        {state === "live" && <span className="absolute inline-flex size-full animate-ping rounded-full bg-success opacity-60 motion-reduce:hidden" />}
        <span className={cn("relative inline-flex size-2 rounded-full", state === "live" ? "bg-success" : state === "connecting" ? "bg-warning" : "bg-muted-foreground")} />
      </span>
      {state === "live" ? label : state === "connecting" ? "Conectando…" : "Sem conexão"}
      {updatedAt && state === "live" && (
        <span className="hidden tabular sm:inline">· atualizado {updatedAt.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit", second: "2-digit" })}</span>
      )}
    </span>
  );
}
