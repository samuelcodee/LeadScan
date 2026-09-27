"use client";

import { ArrowLeft, Ban, Check, Loader2, MoreHorizontal, MoreVertical, Mic, Paperclip, Pencil, SendHorizontal, Trash2, User, X } from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useLayoutEffect, useRef, useState, useTransition } from "react";
import { toast } from "sonner";
import { deleteChatMessage, editChatMessage, markConversationRead, sendText, setBlocked } from "@/app/actions/chat";
import { AudioPlayer, ChatImage, chatMediaUrl, fmtDuration, readVideo } from "@/components/chat/media";
import { PresenceLabel } from "@/components/chat/presence-label";
import { DemoBadge } from "@/components/common/page-header";
import { UserAvatar } from "@/components/profile/identity";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { presenceOf } from "@/lib/chat/presence";
import type { ChatMessage, ChatPeer } from "@/lib/chat/service";
import { shrinkImage } from "@/lib/client/image";
import { subscribeLive } from "@/lib/client/live";
import { cn } from "@/lib/utils";

/* eslint-disable @next/next/no-img-element -- prévia local (blob:) antes do envio */

type Conv = { id: string; peer: ChatPeer; peerLastReadAt: string | null; iBlocked: boolean; blockedMe: boolean };
type Msg = ChatMessage & { pending?: boolean; progress?: number; localUrl?: string };
type Page = { conversation: Conv; messages: ChatMessage[]; hasMore: boolean };

const MAX_VIDEO = 16 * 1024 * 1024;
const MAX_AUDIO_MS = 5 * 60_000;

function dayLabel(iso: string, now = new Date()) {
  const d = new Date(iso);
  const key = (x: Date) => x.toDateString();
  if (key(d) === key(now)) return "Hoje";
  const y = new Date(now);
  y.setDate(now.getDate() - 1);
  if (key(d) === key(y)) return "Ontem";
  return d.toLocaleDateString("pt-BR", { day: "numeric", month: "long", ...(d.getFullYear() !== now.getFullYear() ? { year: "numeric" } : {}) });
}

const URL_RE = /(https?:\/\/[^\s<]+[^\s<.,;:!?)"'\]])/g;

/** Texto com quebras de linha e links clicáveis (abrem fora, sem repassar a origem). */
function RichText({ text }: { text: string }) {
  const parts = text.split(URL_RE);
  return (
    <p className="whitespace-pre-wrap break-words text-[14.5px] leading-snug">
      {parts.map((p, i) =>
        i % 2 === 1 ? (
          <a key={i} href={p} target="_blank" rel="noopener noreferrer nofollow" className="underline underline-offset-2">
            {p}
          </a>
        ) : (
          p
        ),
      )}
    </p>
  );
}

const PART = 3.5 * 1024 * 1024;

function postPart(url: string, body: Blob, onProgress: (loaded: number) => void) {
  return new Promise<{ upload: string }>((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("POST", url);
    xhr.setRequestHeader("Content-Type", "application/octet-stream");
    xhr.upload.onprogress = (e) => onProgress(e.loaded);
    xhr.onload = () => {
      let j: { upload?: string; error?: string } | null = null;
      try {
        j = JSON.parse(xhr.responseText);
      } catch {
        // resposta sem JSON
      }
      if (xhr.status < 300 && j?.upload) resolve({ upload: j.upload });
      else reject(new Error(j?.error ?? "Não deu para enviar. Tente de novo."));
    };
    xhr.onerror = () => reject(new Error("Sem conexão. Tente de novo."));
    xhr.send(body);
  });
}

/**
 * Arquivo grande em partes de 3,5 MB (a Vercel recusa corpo acima de 4,5 MB).
 * O progresso vai de 0 a 0,95 nas partes; o resto é o fechamento no servidor.
 */
async function uploadParts(conversationId: string, file: Blob, kind: "video" | "audio", onProgress: (p: number) => void) {
  let upload: string | null = null;
  for (let offset = 0; offset < file.size; offset += PART) {
    const part = file.slice(offset, offset + PART);
    const q = upload ? `upload=${upload}` : `total=${file.size}`;
    const r = await postPart(`/api/chat/${conversationId}/media/part?kind=${kind}&${q}`, part, (loaded) => onProgress(((offset + loaded) / file.size) * 0.95));
    upload = r.upload;
  }
  return upload!;
}

function upload(conversationId: string, form: FormData, onProgress: (p: number) => void) {
  return new Promise<{ message: ChatMessage }>((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("POST", `/api/chat/${conversationId}/media`);
    xhr.upload.onprogress = (e) => e.lengthComputable && onProgress(e.loaded / e.total);
    xhr.onload = () => {
      let j: { message?: ChatMessage; error?: string } | null = null;
      try {
        j = JSON.parse(xhr.responseText);
      } catch {
        // resposta sem JSON
      }
      if (xhr.status < 300 && j?.message) resolve({ message: j.message });
      else reject(new Error(j?.error ?? "Não deu para enviar. Tente de novo."));
    };
    xhr.onerror = () => reject(new Error("Sem conexão. Tente de novo."));
    xhr.send(form);
  });
}

export function ChatThread({ meId, initial }: { meId: string; initial: Page }) {
  const id = initial.conversation.id;
  const [conv, setConv] = useState(initial.conversation);
  const [messages, setMessages] = useState<Msg[]>(initial.messages);
  const [hasMore, setHasMore] = useState(initial.hasMore);
  const [loadingOlder, setLoadingOlder] = useState(false);
  const [typingUntil, setTypingUntil] = useState(0);
  const [now, setNow] = useState(() => Date.now());
  const [lightbox, setLightbox] = useState<string | null>(null);
  const [editing, setEditing] = useState<{ id: string; body: string } | null>(null);
  const scroller = useRef<HTMLDivElement>(null);
  const topSentinel = useRef<HTMLDivElement>(null);
  const prepend = useRef<{ height: number } | null>(null);
  const stick = useRef(true);
  const lastId = useRef<string | null>(initial.messages.at(-1)?.id ?? null);
  const readTimer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const peer = conv.peer;
  const typing = typingUntil > now;

  const markRead = useCallback(() => {
    clearTimeout(readTimer.current);
    readTimer.current = setTimeout(() => {
      if (document.visibilityState === "visible") void markConversationRead({ conversationId: id });
    }, 500);
  }, [id]);

  // Começa no fim da conversa; mantém o fim à vista quando chega mensagem (se você já estava lá)
  useLayoutEffect(() => {
    const el = scroller.current;
    if (!el) return;
    if (prepend.current) {
      el.scrollTop += el.scrollHeight - prepend.current.height;
      prepend.current = null;
      return;
    }
    if (stick.current) el.scrollTop = el.scrollHeight;
  }, [messages]);

  const onScroll = () => {
    const el = scroller.current;
    if (el) stick.current = el.scrollHeight - el.scrollTop - el.clientHeight < 140;
  };

  const append = useCallback((incoming: ChatMessage[]) => {
    if (!incoming.length) return;
    setMessages((cur) => {
      const have = new Set(cur.map((m) => m.id));
      const fresh = incoming.filter((m) => !have.has(m.id));
      return fresh.length ? [...cur, ...fresh] : cur;
    });
    lastId.current = incoming.at(-1)!.id;
  }, []);

  const loadNew = useCallback(async () => {
    const r = await fetch(`/api/chat/${id}${lastId.current ? `?after=${lastId.current}` : ""}`, { cache: "no-store" }).catch(() => null);
    if (!r?.ok) return;
    const j = (await r.json()) as Page;
    setConv(j.conversation);
    if (j.messages.length) {
      append(j.messages);
      if (j.messages.some((m) => m.senderId !== meId)) markRead();
    }
  }, [append, id, markRead, meId]);

  const refreshOne = useCallback(
    async (messageId: string) => {
      const r = await fetch(`/api/chat/${id}?message=${messageId}`, { cache: "no-store" }).catch(() => null);
      if (!r?.ok) return;
      const j = (await r.json()) as { messages: ChatMessage[] };
      const fresh = j.messages[0];
      if (fresh) setMessages((cur) => cur.map((m) => (m.id === fresh.id ? { ...m, ...fresh } : m)));
    },
    [id],
  );

  const loadOlder = useCallback(async () => {
    const first = messages.find((m) => !m.pending);
    if (!first || loadingOlder || !hasMore) return;
    setLoadingOlder(true);
    const r = await fetch(`/api/chat/${id}?before=${first.id}`, { cache: "no-store" }).catch(() => null);
    setLoadingOlder(false);
    if (!r?.ok) return;
    const j = (await r.json()) as Page;
    prepend.current = { height: scroller.current?.scrollHeight ?? 0 };
    setHasMore(j.hasMore);
    setMessages((cur) => [...j.messages.filter((m) => !cur.some((c) => c.id === m.id)), ...cur]);
  }, [hasMore, id, loadingOlder, messages]);

  useEffect(() => {
    const el = topSentinel.current;
    if (!el || !hasMore) return;
    const io = new IntersectionObserver((entries) => entries[0]?.isIntersecting && void loadOlder(), { root: scroller.current, rootMargin: "200px 0px 0px 0px" });
    io.observe(el);
    return () => io.disconnect();
  }, [hasMore, loadOlder]);

  // Ao vivo: mensagem nova, apagada, lida, digitando
  useEffect(() => {
    markRead();
    const off = subscribeLive((e) => {
      if (e.type === "resync") return void loadNew();
      if (e.conversationId !== id) return;
      if (e.type === "message") void loadNew();
      else if (e.type === "deleted") setMessages((cur) => cur.map((m) => (m.id === e.messageId ? { ...m, deleted: true, body: null, mediaId: null, posterId: null } : m)));
      else if (e.type === "edited" && e.messageId) void refreshOne(e.messageId);
      else if (e.type === "read" && !e.mine) setConv((c) => ({ ...c, peerLastReadAt: new Date().toISOString() }));
      else if (e.type === "typing" && !e.mine) {
        setTypingUntil(Date.now() + 4500);
        setTimeout(() => setNow(Date.now()), 4600);
      }
    });
    const onVisible = () => {
      if (document.visibilityState === "visible") {
        markRead();
        void loadNew();
      }
    };
    document.addEventListener("visibilitychange", onVisible);
    const t = setInterval(() => {
      setNow(Date.now());
      void loadNew();
    }, 60_000);
    return () => {
      off();
      clearInterval(t);
      clearTimeout(readTimer.current);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [id, loadNew, markRead, refreshOne]);

  useEffect(() => {
    if (!typing) return;
    const t = setTimeout(() => setNow(Date.now()), Math.max(0, typingUntil - Date.now()) + 50);
    return () => clearTimeout(t);
  }, [typing, typingUntil]);

  /* ─── Envio ─────────────────────────────────────────── */

  const addPending = (m: Partial<Msg> & Pick<Msg, "kind">) => {
    const tmp: Msg = {
      id: `tmp-${Math.random().toString(36).slice(2)}`,
      senderId: meId,
      body: null,
      mediaId: null,
      posterId: null,
      durationMs: null,
      width: null,
      height: null,
      mime: null,
      createdAt: new Date().toISOString(),
      editedAt: null,
      deleted: false,
      pending: true,
      progress: 0,
      ...m,
    };
    stick.current = true;
    setMessages((cur) => [...cur, tmp]);
    return tmp.id;
  };
  const resolvePending = (tmpId: string, real: ChatMessage | null) => {
    setMessages((cur) => {
      const tmp = cur.find((m) => m.id === tmpId);
      if (tmp?.localUrl) URL.revokeObjectURL(tmp.localUrl);
      if (!real) return cur.filter((m) => m.id !== tmpId);
      if (cur.some((m) => m.id === real.id)) return cur.filter((m) => m.id !== tmpId);
      return cur.map((m) => (m.id === tmpId ? real : m));
    });
    if (real) lastId.current = real.id;
  };
  const setProgress = (tmpId: string, p: number) => setMessages((cur) => cur.map((m) => (m.id === tmpId ? { ...m, progress: p } : m)));

  const sendTextMsg = async (body: string) => {
    const tmp = addPending({ kind: "TEXT", body });
    const r = await sendText({ conversationId: id, body });
    if (!r.ok) {
      resolvePending(tmp, null);
      toast.error(r.error);
      return false;
    }
    resolvePending(tmp, r.data);
    return true;
  };

  const sendFile = async (file: File) => {
    const isVideo = file.type.startsWith("video/");
    const isImage = file.type.startsWith("image/");
    if (!isVideo && !isImage) return void toast.error("Envie uma foto ou um vídeo.");
    if (isVideo && file.size > MAX_VIDEO) return void toast.error("Vídeo muito grande. O limite é 16 MB (cerca de 1 minuto em boa qualidade).");
    const localUrl = URL.createObjectURL(file);
    const tmp = addPending({ kind: isVideo ? "VIDEO" : "IMAGE", localUrl });
    try {
      const form = new FormData();
      if (isImage) {
        const blob = await shrinkImage(file, 1600);
        form.set("kind", "image");
        form.set("file", new File([blob], "foto.jpg", { type: blob.type || "image/jpeg" }));
      } else {
        const { poster, durationMs } = await readVideo(file).catch(() => {
          throw new Error("Não conseguimos ler esse vídeo. MP4 funciona melhor.");
        });
        form.set("kind", "video");
        if (file.size > PART) form.set("upload", await uploadParts(id, file, "video", (p) => setProgress(tmp, p)));
        else form.set("file", file);
        form.set("poster", new File([poster], "capa.jpg", { type: "image/jpeg" }));
        form.set("durationMs", String(durationMs));
      }
      const { message } = await upload(id, form, (p) => setProgress(tmp, p));
      resolvePending(tmp, message);
    } catch (err) {
      resolvePending(tmp, null);
      toast.error(err instanceof Error ? err.message : "Não deu para enviar.");
    }
  };

  const sendAudio = async (blob: Blob, durationMs: number) => {
    const localUrl = URL.createObjectURL(blob);
    const tmp = addPending({ kind: "AUDIO", localUrl, durationMs });
    try {
      const form = new FormData();
      const ext = blob.type.includes("mp4") ? "m4a" : blob.type.includes("ogg") ? "ogg" : "webm";
      form.set("kind", "audio");
      if (blob.size > PART) form.set("upload", await uploadParts(id, blob, "audio", (p) => setProgress(tmp, p)));
      else form.set("file", new File([blob], `audio.${ext}`, { type: blob.type || "audio/webm" }));
      form.set("durationMs", String(durationMs));
      const { message } = await upload(id, form, (p) => setProgress(tmp, p));
      resolvePending(tmp, message);
    } catch (err) {
      resolvePending(tmp, null);
      toast.error(err instanceof Error ? err.message : "Não deu para enviar o áudio.");
    }
  };

  const remove = async (messageId: string) => {
    const r = await deleteChatMessage({ messageId });
    if (!r.ok) return void toast.error(r.error);
    if (editing?.id === messageId) setEditing(null);
    setMessages((cur) => cur.map((m) => (m.id === messageId ? { ...m, deleted: true, body: null, mediaId: null, posterId: null } : m)));
  };

  /** Salva a edição com otimismo: a bolha muda na hora; se falhar, volta o texto antigo. */
  const saveEdit = async (messageId: string, body: string) => {
    const before = messages.find((m) => m.id === messageId);
    if (!before || before.body === body) return true;
    setMessages((cur) => cur.map((m) => (m.id === messageId ? { ...m, body, editedAt: new Date().toISOString() } : m)));
    const r = await editChatMessage({ messageId, body });
    if (!r.ok) {
      setMessages((cur) => cur.map((m) => (m.id === messageId ? before : m)));
      toast.error(r.error);
      return false;
    }
    setMessages((cur) => cur.map((m) => (m.id === messageId ? { ...m, ...r.data } : m)));
    return true;
  };

  const editLastMine = () => {
    const last = [...messages].reverse().find((m) => m.senderId === meId && m.kind === "TEXT" && !m.pending && !m.deleted);
    if (last?.body) setEditing({ id: last.id, body: last.body });
  };

  /* ─── Render ────────────────────────────────────────── */

  const presence = presenceOf(peer.lastActiveAt, peer.presenceVisible, now);
  const lastMine = [...messages].reverse().find((m) => m.senderId === meId && !m.pending && !m.deleted);
  const seen = lastMine && conv.peerLastReadAt && new Date(conv.peerLastReadAt) >= new Date(lastMine.createdAt);

  return (
    <div className="flex h-full min-h-0 flex-col bg-background">
      <header className="flex h-14 shrink-0 items-center gap-2 border-b bg-card px-2 sm:px-4">
        <Button asChild variant="ghost" size="icon" className="lg:hidden" aria-label="Voltar para as conversas">
          <Link href="/mensagens">
            <ArrowLeft />
          </Link>
        </Button>
        <Link href={peer.username ? `/u/${peer.username}` : "#"} className="flex min-w-0 flex-1 items-center gap-3">
          <UserAvatar name={peer.name} avatarId={peer.avatarId} size="sm" badge={peer.badge} presence={presence.state} />
          <span className="min-w-0">
            <span className="flex items-center gap-1.5 truncate text-sm font-semibold">
              {peer.name}
              {peer.isDemo && <DemoBadge />}
            </span>
            {typing ? (
              <span className="block text-xs font-medium text-brand-ink">digitando…</span>
            ) : (
              <PresenceLabel lastActiveAt={peer.lastActiveAt} visible={peer.presenceVisible} className="flex" />
            )}
          </span>
        </Link>
        <ThreadMenu peer={peer} blocked={conv.iBlocked} onBlocked={(b) => setConv((c) => ({ ...c, iBlocked: b }))} />
      </header>

      <div ref={scroller} onScroll={onScroll} className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-3 py-4 sm:px-6" role="log" aria-live="polite" aria-label={`Conversa com ${peer.name}`}>
        <div ref={topSentinel} />
        {loadingOlder && (
          <p className="flex justify-center py-2 text-xs text-muted-foreground">
            <Loader2 className="size-4 animate-spin" />
          </p>
        )}
        {messages.length === 0 && (
          <div className="mx-auto mt-10 max-w-xs text-center">
            <UserAvatar name={peer.name} avatarId={peer.avatarId} size="lg" badge={peer.badge} className="mx-auto" />
            <p className="mt-3 font-medium">Comece a conversa com {peer.name.split(" ")[0]}</p>
            <p className="mt-1 text-sm text-muted-foreground">Texto, foto, vídeo ou áudio. Só vocês dois veem.</p>
          </div>
        )}
        <ol className="mx-auto grid max-w-3xl gap-1">
          {messages.map((m, i) => {
            const mine = m.senderId === meId;
            const prev = messages[i - 1];
            const newDay = !prev || new Date(prev.createdAt).toDateString() !== new Date(m.createdAt).toDateString();
            const grouped = prev && !newDay && prev.senderId === m.senderId && new Date(m.createdAt).getTime() - new Date(prev.createdAt).getTime() < 5 * 60_000;
            return (
              <li key={m.id} className="contents">
                {newDay && (
                  <div className="my-3 flex justify-center">
                    <span className="rounded-full bg-muted px-3 py-1 text-[11px] font-medium text-muted-foreground">{dayLabel(m.createdAt)}</span>
                  </div>
                )}
                <div className={cn("group flex items-end gap-1.5", mine ? "justify-end" : "justify-start", !grouped && "mt-2")}>
                  {mine && !m.pending && !m.deleted && (
                    <DropdownMenu>
                      <DropdownMenuTrigger
                        className="grid size-7 place-items-center rounded-full text-muted-foreground opacity-0 transition-opacity hover:bg-muted focus-visible:opacity-100 group-hover:opacity-100 data-[state=open]:opacity-100 [@media(hover:none)]:opacity-60"
                        aria-label="Opções da mensagem"
                      >
                        <MoreHorizontal className="size-4" />
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="min-w-44">
                        {m.kind === "TEXT" && m.body && (
                          <DropdownMenuItem onSelect={() => setEditing({ id: m.id, body: m.body! })}>
                            <Pencil /> Editar
                          </DropdownMenuItem>
                        )}
                        <DropdownMenuItem variant="destructive" onSelect={() => void remove(m.id)}>
                          <Trash2 /> Apagar para todos
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  )}
                  <Bubble m={m} mine={mine} onOpenImage={setLightbox} editing={editing?.id === m.id} />
                </div>
                {m.id === lastMine?.id && (
                  <p className="mt-0.5 text-right text-[11px] text-muted-foreground">{seen ? "Visto" : "Enviado"}</p>
                )}
              </li>
            );
          })}
        </ol>
      </div>

      <Composer
        conversationId={id}
        disabled={conv.iBlocked || conv.blockedMe}
        blockedNote={
          conv.iBlocked ? (
            <UnblockNote peer={peer} onUnblocked={() => setConv((c) => ({ ...c, iBlocked: false }))} />
          ) : conv.blockedMe ? (
            <span>Não é possível enviar mensagens para esta pessoa.</span>
          ) : null
        }
        onText={sendTextMsg}
        onFile={sendFile}
        onAudio={sendAudio}
        editing={editing}
        onCancelEdit={() => setEditing(null)}
        onSaveEdit={async (body) => {
          if (!editing) return true;
          const ok = await saveEdit(editing.id, body);
          if (ok) setEditing(null);
          return ok;
        }}
        onEditLast={editLastMine}
      />

      <Dialog open={!!lightbox} onOpenChange={(o) => !o && setLightbox(null)}>
        <DialogContent className="max-w-[min(96vw,1100px)] border-0 bg-transparent p-0 shadow-none sm:max-w-[min(96vw,1100px)]">
          <DialogTitle className="sr-only">Foto</DialogTitle>
          {lightbox && <img src={lightbox} alt="Foto enviada na conversa" className="max-h-[85dvh] w-full rounded-lg object-contain" />}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function Bubble({ m, mine, onOpenImage, editing }: { m: Msg; mine: boolean; onOpenImage: (src: string) => void; editing?: boolean }) {
  const time = new Date(m.createdAt).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
  const shell = cn(
    "relative max-w-[82%] rounded-2xl px-3 py-2 sm:max-w-[70%]",
    mine ? "rounded-br-md bg-ink text-white dark:bg-[#2a3136]" : "rounded-bl-md border bg-card text-card-foreground",
    m.pending && "opacity-80",
    editing && "ring-2 ring-lime ring-offset-2 ring-offset-background",
  );
  if (m.deleted) {
    return (
      <div className={cn(shell, "bg-transparent text-muted-foreground dark:bg-transparent", mine && "border")}>
        <p className="flex items-center gap-1.5 text-sm italic">
          <Ban className="size-3.5" /> Mensagem apagada
        </p>
      </div>
    );
  }
  const media = m.mediaId ? chatMediaUrl(m.mediaId) : m.localUrl;
  return (
    <div className={cn(shell, (m.kind === "IMAGE" || m.kind === "VIDEO") && "p-1.5")}>
      {m.kind === "IMAGE" && media && <ChatImage src={media} width={m.width} height={m.height} onOpen={() => onOpenImage(media)} />}
      {m.kind === "VIDEO" && media && (
        <video
          src={media}
          poster={m.posterId ? chatMediaUrl(m.posterId) : undefined}
          controls={!m.pending}
          preload="none"
          playsInline
          width={m.width ?? undefined}
          height={m.height ?? undefined}
          className="block h-auto max-h-80 w-[260px] rounded-lg bg-black object-contain"
          style={{ aspectRatio: m.width && m.height ? `${m.width} / ${m.height}` : "16 / 9" }}
        />
      )}
      {m.kind === "AUDIO" && media && <AudioPlayer src={media} durationMs={m.durationMs} mine={mine} />}
      {m.body && (
        <div className={cn((m.kind === "IMAGE" || m.kind === "VIDEO") && "px-1.5 pb-0.5 pt-1.5")}>
          <RichText text={m.body} />
        </div>
      )}
      {m.pending && m.kind !== "TEXT" && (
        <div className="mx-1.5 mt-1.5 h-1 overflow-hidden rounded-full bg-current/20" role="progressbar" aria-valuenow={Math.round((m.progress ?? 0) * 100)} aria-valuemin={0} aria-valuemax={100}>
          <div className="h-full bg-lime transition-[width] duration-200" style={{ width: `${Math.max(4, (m.progress ?? 0) * 100)}%` }} />
        </div>
      )}
      <span className={cn("mt-0.5 block text-right text-[10.5px] tabular", mine ? "text-white/60" : "text-muted-foreground", (m.kind === "IMAGE" || m.kind === "VIDEO") && "px-1.5")}>
        {m.pending ? "enviando…" : m.editedAt ? `editada · ${time}` : time}
      </span>
    </div>
  );
}

function ThreadMenu({ peer, blocked, onBlocked }: { peer: ChatPeer; blocked: boolean; onBlocked: (b: boolean) => void }) {
  const [pending, start] = useTransition();
  const toggle = () =>
    start(async () => {
      const r = await setBlocked({ userId: peer.id, blocked: !blocked });
      if (!r.ok) return void toast.error(r.error);
      onBlocked(!blocked);
      toast.success(blocked ? `${peer.name} desbloqueado` : `${peer.name} bloqueado. Vocês não trocam mais mensagens.`);
    });
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" aria-label="Opções da conversa" disabled={pending}>
          <MoreVertical />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        {peer.username && (
          <DropdownMenuItem asChild>
            <Link href={`/u/${peer.username}`}>
              <User /> Ver perfil
            </Link>
          </DropdownMenuItem>
        )}
        <DropdownMenuItem variant={blocked ? "default" : "destructive"} onSelect={toggle}>
          <Ban /> {blocked ? "Desbloquear" : "Bloquear"}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function UnblockNote({ peer, onUnblocked }: { peer: ChatPeer; onUnblocked: () => void }) {
  const [pending, start] = useTransition();
  return (
    <span>
      Você bloqueou {peer.name.split(" ")[0]}.{" "}
      <button
        type="button"
        disabled={pending}
        className="font-semibold text-foreground underline underline-offset-2"
        onClick={() =>
          start(async () => {
            const r = await setBlocked({ userId: peer.id, blocked: false });
            if (!r.ok) return void toast.error(r.error);
            onUnblocked();
          })
        }
      >
        Desbloquear
      </button>
    </span>
  );
}

/* ─── Campo de mensagem: texto, anexo e gravação de áudio ─── */

function Composer({
  conversationId,
  disabled,
  blockedNote,
  onText,
  onFile,
  onAudio,
  editing,
  onCancelEdit,
  onSaveEdit,
  onEditLast,
}: {
  conversationId: string;
  disabled: boolean;
  blockedNote: React.ReactNode;
  onText: (body: string) => Promise<boolean>;
  onFile: (f: File) => void;
  onAudio: (b: Blob, ms: number) => void;
  editing: { id: string; body: string } | null;
  onCancelEdit: () => void;
  onSaveEdit: (body: string) => Promise<boolean>;
  onEditLast: () => void;
}) {
  const [text, setText] = useState("");
  const draft = useRef("");
  const [rec, setRec] = useState<{ startedAt: number } | null>(null);
  const [tick, setTick] = useState(0);
  const area = useRef<HTMLTextAreaElement>(null);
  const fileInput = useRef<HTMLInputElement>(null);
  const recorder = useRef<MediaRecorder | null>(null);
  const cancelRec = useRef(false);
  const lastTyping = useRef(0);

  // Campo cresce até ~6 linhas
  useLayoutEffect(() => {
    const el = area.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 160)}px`;
  }, [text]);

  useEffect(() => {
    if (!rec) return;
    const t = setInterval(() => {
      setTick(Date.now());
      if (Date.now() - rec.startedAt >= MAX_AUDIO_MS) recorder.current?.stop();
    }, 250);
    return () => clearInterval(t);
  }, [rec]);

  useEffect(() => () => recorder.current?.stream.getTracks().forEach((t) => t.stop()), []);

  // Entrou em edição: guarda o rascunho, coloca o texto da mensagem e foca no fim. Saiu: devolve o rascunho.
  const editingId = editing?.id ?? null;
  const editingBody = editing?.body ?? "";
  useEffect(() => {
    if (editingId) {
      setText((cur) => {
        draft.current = cur;
        return editingBody;
      });
      requestAnimationFrame(() => {
        const el = area.current;
        if (!el) return;
        el.focus();
        el.setSelectionRange(el.value.length, el.value.length);
      });
    } else {
      setText(draft.current);
      draft.current = "";
    }
  }, [editingId, editingBody]);

  if (disabled) {
    return <div className="shrink-0 border-t bg-card px-4 py-4 text-center text-sm text-muted-foreground pb-[max(1rem,env(safe-area-inset-bottom))]">{blockedNote}</div>;
  }

  const submit = async () => {
    const body = text.trim();
    if (!body) return;
    if (editing) {
      await onSaveEdit(body);
      area.current?.focus();
      return;
    }
    setText("");
    const ok = await onText(body);
    if (!ok) setText(body);
    area.current?.focus();
  };

  const ping = () => {
    if (Date.now() - lastTyping.current < 3000) return;
    lastTyping.current = Date.now();
    void fetch(`/api/chat/${conversationId}/typing`, { method: "POST" }).catch(() => {});
  };

  const startRec = async () => {
    if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === "undefined") return void toast.error("Este navegador não grava áudio.");
    let stream: MediaStream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true } });
    } catch {
      return void toast.error("Libere o microfone no navegador para gravar áudio.");
    }
    const mime = ["audio/webm;codecs=opus", "audio/mp4", "audio/ogg;codecs=opus", "audio/webm"].find((t) => MediaRecorder.isTypeSupported(t));
    const r = new MediaRecorder(stream, mime ? { mimeType: mime, audioBitsPerSecond: 48_000 } : undefined);
    const chunks: Blob[] = [];
    const startedAt = Date.now();
    cancelRec.current = false;
    r.ondataavailable = (e) => e.data.size && chunks.push(e.data);
    r.onstop = () => {
      stream.getTracks().forEach((t) => t.stop());
      recorder.current = null;
      setRec(null);
      const ms = Date.now() - startedAt;
      if (cancelRec.current) return;
      if (ms < 800) return void toast.message("Áudio muito curto. Segure um pouco mais.");
      onAudio(new Blob(chunks, { type: r.mimeType || mime || "audio/webm" }), ms);
    };
    recorder.current = r;
    r.start(250);
    setRec({ startedAt });
  };

  const stopRec = (cancel: boolean) => {
    cancelRec.current = cancel;
    recorder.current?.stop();
  };

  const coarse = typeof window !== "undefined" && window.matchMedia("(pointer: coarse)").matches;

  return (
    <div className="shrink-0 border-t bg-card px-2 pt-2 pb-[max(0.5rem,env(safe-area-inset-bottom))] sm:px-4">
      {rec ? (
        <div className="mx-auto flex max-w-3xl items-center gap-2 py-1">
          <Button variant="ghost" size="icon" onClick={() => stopRec(true)} aria-label="Descartar áudio">
            <X />
          </Button>
          <span className="flex flex-1 items-center gap-2 text-sm">
            <span className="size-2.5 animate-pulse rounded-full bg-destructive motion-reduce:animate-none" aria-hidden />
            Gravando <span className="font-medium tabular">{fmtDuration((tick || rec.startedAt) - rec.startedAt)}</span>
            <span className="hidden text-xs text-muted-foreground sm:inline">· até 5 min</span>
          </span>
          <Button size="icon" className="rounded-full" onClick={() => stopRec(false)} aria-label="Enviar áudio">
            <SendHorizontal />
          </Button>
        </div>
      ) : (
        <>
        {editing && (
          <div className="mx-auto mb-2 flex max-w-3xl items-center gap-2 rounded-md border-l-2 border-lime bg-muted/60 py-1.5 pl-3 pr-1 text-sm">
            <Pencil className="size-3.5 shrink-0 text-muted-foreground" aria-hidden />
            <span className="min-w-0 flex-1">
              <span className="block text-xs font-semibold">Editando mensagem</span>
              <span className="block truncate text-xs text-muted-foreground">{editing.body}</span>
            </span>
            <Button type="button" variant="ghost" size="icon-sm" onClick={onCancelEdit} aria-label="Cancelar edição">
              <X />
            </Button>
          </div>
        )}
        <form
          className="mx-auto flex max-w-3xl items-end gap-1.5"
          onSubmit={(e) => {
            e.preventDefault();
            void submit();
          }}
        >
          <input
            ref={fileInput}
            type="file"
            accept="image/*,video/*"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              e.target.value = "";
              if (f) onFile(f);
            }}
          />
          <Button type="button" variant="ghost" size="icon" className={cn("mb-0.5 shrink-0", editing && "invisible")} onClick={() => fileInput.current?.click()} aria-label="Enviar foto ou vídeo">
            <Paperclip />
          </Button>
          <textarea
            ref={area}
            value={text}
            rows={1}
            maxLength={4000}
            onChange={(e) => {
              setText(e.target.value);
              if (e.target.value.trim()) ping();
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey && !coarse && !e.nativeEvent.isComposing) {
                e.preventDefault();
                void submit();
              } else if (e.key === "Escape" && editing) {
                e.preventDefault();
                onCancelEdit();
              } else if (e.key === "ArrowUp" && !text && !editing) {
                // seta para cima com o campo vazio: editar a última mensagem que você mandou
                e.preventDefault();
                onEditLast();
              }
            }}
            placeholder="Mensagem"
            aria-label="Escreva uma mensagem"
            className="max-h-40 min-h-10 flex-1 resize-none rounded-[20px] border border-input bg-background px-4 py-2 text-[15px] leading-snug outline-none transition-colors focus-visible:border-ring"
          />
          {editing ? (
            <Button type="submit" size="icon" className="mb-0.5 shrink-0 rounded-full" aria-label="Salvar edição" disabled={!text.trim()}>
              <Check />
            </Button>
          ) : text.trim() ? (
            <Button type="submit" size="icon" className="mb-0.5 shrink-0 rounded-full" aria-label="Enviar">
              <SendHorizontal />
            </Button>
          ) : (
            <Button type="button" size="icon" className="mb-0.5 shrink-0 rounded-full" onClick={() => void startRec()} aria-label="Gravar áudio">
              <Mic />
            </Button>
          )}
        </form>
        </>
      )}
    </div>
  );
}
