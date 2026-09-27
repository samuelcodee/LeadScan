"use client";

import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef } from "react";
import { toast } from "sonner";
import { subscribeLive } from "@/lib/client/live";
import { useUnreadCount } from "@/lib/client/unread";

const BEAT_MS = 60_000;
/** Sem mexer no app por 4 min = para de avisar "online" (vira "inativo" para os outros). */
const IDLE_AFTER_MS = 4 * 60_000;

/**
 * Sinal de vida do app aberto (base do online / inativo / offline) + aviso de mensagem
 * nova quando você está fora da tela de mensagens. Só pinga com a aba visível e em uso.
 */
export function PresenceHeartbeat({ initialUnread }: { initialUnread: number }) {
  const lastInput = useRef(0);
  const pathname = usePathname();
  const router = useRouter();
  const unread = useUnreadCount(initialUnread);
  const pathRef = useRef(pathname);

  useEffect(() => {
    pathRef.current = pathname;
  }, [pathname]);

  useEffect(() => {
    lastInput.current = Date.now();
    const ping = () => {
      if (document.visibilityState !== "visible" || Date.now() - lastInput.current > IDLE_AFTER_MS) return;
      void fetch("/api/presence", { method: "POST", keepalive: true }).catch(() => {});
    };
    const mark = () => {
      const wasIdle = Date.now() - lastInput.current > IDLE_AFTER_MS;
      lastInput.current = Date.now();
      if (wasIdle) ping();
    };
    const onVisible = () => document.visibilityState === "visible" && mark();
    ping();
    const t = setInterval(ping, BEAT_MS);
    const opts = { passive: true } as const;
    window.addEventListener("pointerdown", mark, opts);
    window.addEventListener("keydown", mark, opts);
    window.addEventListener("scroll", mark, opts);
    window.addEventListener("pointermove", mark, opts);
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      clearInterval(t);
      window.removeEventListener("pointerdown", mark);
      window.removeEventListener("keydown", mark);
      window.removeEventListener("scroll", mark);
      window.removeEventListener("pointermove", mark);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, []);

  // Mensagem nova fora da tela de mensagens: aviso discreto com atalho
  useEffect(
    () =>
      subscribeLive((e) => {
        if (e.type !== "message" || e.mine || !e.conversationId || pathRef.current.startsWith("/mensagens")) return;
        const id = e.conversationId;
        toast("Nova mensagem", { action: { label: "Abrir", onClick: () => router.push(`/mensagens/${id}`) } });
      }),
    [router],
  );

  // (2) no título da aba enquanto houver não lidas. O Next reescreve o título a cada
  // navegação, então um observador reaplica o prefixo quando o <title> muda.
  useEffect(() => {
    const apply = () => {
      const base = document.title.replace(/^\(\d+\+?\) /, "");
      const want = unread > 0 ? `(${unread > 99 ? "99+" : unread}) ${base}` : base;
      if (document.title !== want) document.title = want;
    };
    apply();
    const mo = new MutationObserver(apply);
    mo.observe(document.head, { subtree: true, childList: true, characterData: true });
    return () => mo.disconnect();
  }, [unread]);

  return null;
}
