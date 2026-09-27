"use client";

import { useSyncExternalStore } from "react";
import { subscribeLive } from "@/lib/client/live";

/**
 * Contador de mensagens não lidas, compartilhado por todos os lugares que o mostram
 * (sidebar, barra do topo, menu do celular). Uma busca inicial + recontagem quando
 * chega mensagem ou alguém marca como lida — nada de polling.
 */
let count: number | null = null;
const subs = new Set<() => void>();
let started = false;
let timer: ReturnType<typeof setTimeout> | undefined;

function set(n: number) {
  count = n;
  subs.forEach((s) => s());
}

export async function refreshUnread() {
  try {
    const r = await fetch("/api/chat/unread", { cache: "no-store" });
    if (r.ok) set(((await r.json()) as { count: number }).count);
  } catch {
    // offline: mantém o último número
  }
}

function start(initial: number | null) {
  if (started) return;
  started = true;
  if (initial !== null && count === null) count = initial;
  subscribeLive((e) => {
    if (e.type !== "message" && e.type !== "read" && e.type !== "deleted" && e.type !== "resync") return;
    clearTimeout(timer);
    timer = setTimeout(refreshUnread, 350);
  });
  if (count === null) void refreshUnread();
}

export function useUnreadCount(initial: number | null = null) {
  return useSyncExternalStore(
    (cb) => {
      start(initial);
      subs.add(cb);
      return () => subs.delete(cb);
    },
    () => count ?? initial ?? 0,
    () => initial ?? 0,
  );
}
