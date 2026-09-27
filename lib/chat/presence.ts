/**
 * Status de presença, calculado a partir do último sinal do app aberto (heartbeat).
 * Puro: roda no servidor e no navegador (o cliente recalcula a cada 30 s sem ir ao banco).
 *
 *  online  → sinal há menos de 2 min (app aberto e em uso)
 *  idle    → entre 2 e 30 min ("Inativo há 12 min")
 *  offline → mais de 30 min ou nunca
 *  hidden  → a pessoa escolheu não mostrar o status
 */
export const ONLINE_MS = 2 * 60_000;
export const IDLE_MS = 30 * 60_000;

export type PresenceState = "online" | "idle" | "offline" | "hidden";

export function presenceOf(lastActiveAt: Date | string | null | undefined, visible: boolean, now = Date.now()): { state: PresenceState; label: string | null } {
  if (!visible) return { state: "hidden", label: null };
  if (!lastActiveAt) return { state: "offline", label: "Offline" };
  const ago = now - new Date(lastActiveAt).getTime();
  if (ago < ONLINE_MS) return { state: "online", label: "Online" };
  if (ago < IDLE_MS) return { state: "idle", label: `Inativo há ${Math.max(2, Math.round(ago / 60_000))} min` };
  return { state: "offline", label: "Offline" };
}
