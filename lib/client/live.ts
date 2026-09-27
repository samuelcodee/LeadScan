"use client";

/**
 * UMA conexão ao vivo (SSE) por aba, compartilhada por tudo que escuta: gráficos,
 * ranking, contador de mensagens, chat. Várias EventSource na mesma aba esgotam o
 * limite de conexões do navegador (6 por domínio em HTTP/1.1) e travam a navegação.
 */
export type LiveMessage = {
  /** "resync" = a conexão caiu e voltou: quem mostra contadores/mensagens deve recarregar */
  type: "sale" | "charge" | "profile" | "message" | "deleted" | "edited" | "read" | "typing" | "resync";
  scope: "me" | "community";
  mine?: boolean;
  points?: number;
  conversationId?: string;
  messageId?: string;
};
export type LiveStatus = "connecting" | "live" | "offline";

type Listener = (m: LiveMessage) => void;
type StatusListener = (s: LiveStatus) => void;

const listeners = new Set<Listener>();
const statusListeners = new Set<StatusListener>();
let es: EventSource | null = null;
let status: LiveStatus = "connecting";
let closeTimer: ReturnType<typeof setTimeout> | undefined;
let everOpened = false;

function setStatus(s: LiveStatus) {
  status = s;
  statusListeners.forEach((l) => l(s));
}

function open() {
  if (es || typeof window === "undefined") return;
  es = new EventSource("/api/live?t=me,community");
  setStatus("connecting");
  es.onopen = () => {
    setStatus("live");
    // Reconexão (queda de rede ou renovação do servidor): eventos do intervalo podem ter se perdido
    if (everOpened) listeners.forEach((l) => l({ type: "resync", scope: "me" }));
    everOpened = true;
  };
  es.onerror = () => setStatus(es?.readyState === EventSource.CLOSED ? "offline" : "connecting");
  es.onmessage = (msg) => {
    let data: LiveMessage;
    try {
      data = JSON.parse(msg.data) as LiveMessage;
    } catch {
      return;
    }
    listeners.forEach((l) => l(data));
  };
}

/** Fecha a conexão um pouco depois do último ouvinte sair (troca de página não reconecta). */
function maybeClose() {
  clearTimeout(closeTimer);
  closeTimer = setTimeout(() => {
    if (listeners.size === 0 && statusListeners.size === 0 && es) {
      es.close();
      es = null;
    }
  }, 5000);
}

export function subscribeLive(listener: Listener) {
  listeners.add(listener);
  clearTimeout(closeTimer);
  open();
  return () => {
    listeners.delete(listener);
    maybeClose();
  };
}

export function subscribeLiveStatus(listener: StatusListener) {
  statusListeners.add(listener);
  clearTimeout(closeTimer);
  open();
  listener(status);
  return () => {
    statusListeners.delete(listener);
    maybeClose();
  };
}
