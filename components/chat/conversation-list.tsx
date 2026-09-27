"use client";

import { ImageIcon, Loader2, Mic, PenSquare, Search, Video } from "lucide-react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useRef, useState, useTransition } from "react";
import { toast } from "sonner";
import { startConversation } from "@/app/actions/chat";
import { DemoBadge } from "@/components/common/page-header";
import { UserAvatar } from "@/components/profile/identity";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { presenceOf } from "@/lib/chat/presence";
import type { ChatPeer, ConversationItem } from "@/lib/chat/service";
import { subscribeLive } from "@/lib/client/live";
import { cn } from "@/lib/utils";

/** 14:32 · ontem · seg · 12/09 */
export function chatTime(iso: string, now = new Date()) {
  const d = new Date(iso);
  const day = (x: Date) => new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime();
  const diff = Math.round((day(now) - day(d)) / 86400000);
  if (diff === 0) return d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
  if (diff === 1) return "ontem";
  if (diff < 7) return d.toLocaleDateString("pt-BR", { weekday: "short" }).replace(".", "");
  return d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" });
}

function Preview({ c }: { c: ConversationItem }) {
  const l = c.last;
  if (!l) return <span>Conversa nova</span>;
  const who = l.mine ? "Você: " : "";
  if (l.deleted) return <span className="italic">{who}mensagem apagada</span>;
  const Icon = l.kind === "IMAGE" ? ImageIcon : l.kind === "AUDIO" ? Mic : l.kind === "VIDEO" ? Video : null;
  const label = l.kind === "IMAGE" ? "Foto" : l.kind === "AUDIO" ? "Áudio" : l.kind === "VIDEO" ? "Vídeo" : null;
  return (
    <span className="flex min-w-0 items-center gap-1">
      {who}
      {Icon && <Icon className="size-3.5 shrink-0" aria-hidden />}
      <span className="truncate">{l.body || label}</span>
    </span>
  );
}

export function ConversationList({ initial }: { initial: ConversationItem[] }) {
  const [items, setItems] = useState(initial);
  const [filter, setFilter] = useState("");
  const [newOpen, setNewOpen] = useState(false);
  const [now, setNow] = useState(() => Date.now());
  const params = useParams<{ id?: string }>();
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);

  useEffect(() => {
    const load = () =>
      fetch("/api/chat/conversations", { cache: "no-store" })
        .then((r) => (r.ok ? r.json() : null))
        .then((j: { conversations: ConversationItem[] } | null) => j && setItems(j.conversations))
        .catch(() => {});
    const off = subscribeLive((e) => {
      if (e.type !== "message" && e.type !== "read" && e.type !== "deleted" && e.type !== "edited" && e.type !== "resync") return;
      clearTimeout(timer.current);
      timer.current = setTimeout(load, 300);
    });
    // Presença (online/inativo) muda com o tempo: recarrega a cada minuto
    const t = setInterval(() => {
      setNow(Date.now());
      void load();
    }, 60_000);
    return () => {
      off();
      clearInterval(t);
      clearTimeout(timer.current);
    };
  }, []);

  const q = filter.trim().toLowerCase();
  const shown = q ? items.filter((c) => c.peer.name.toLowerCase().includes(q) || c.peer.username?.includes(q)) : items;

  return (
    <>
      <div className="flex h-14 shrink-0 items-center justify-between gap-2 border-b px-4">
        <h1 className="text-base font-semibold">Mensagens</h1>
        <Button variant="ghost" size="icon" onClick={() => setNewOpen(true)} aria-label="Nova conversa" title="Nova conversa">
          <PenSquare />
        </Button>
      </div>
      {items.length > 4 && (
        <div className="border-b p-2">
          <div className="relative">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
            <Input value={filter} onChange={(e) => setFilter(e.target.value)} placeholder="Procurar conversa" className="h-9 pl-8" aria-label="Procurar conversa" />
          </div>
        </div>
      )}
      <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
        {items.length === 0 ? (
          <div className="grid place-items-center px-6 py-14 text-center">
            <p className="font-medium">Nenhuma conversa ainda</p>
            <p className="mt-1 max-w-xs text-sm text-muted-foreground">Fale com alguém da comunidade: troque dicas, feche parceria, mande um áudio.</p>
            <Button className="mt-4" onClick={() => setNewOpen(true)}>
              <PenSquare /> Começar conversa
            </Button>
          </div>
        ) : (
          <ul>
            {shown.map((c) => {
              const p = presenceOf(c.peer.lastActiveAt, c.peer.presenceVisible, now);
              const active = params.id === c.id;
              return (
                <li key={c.id}>
                  <Link
                    href={`/mensagens/${c.id}`}
                    aria-current={active ? "page" : undefined}
                    className={cn(
                      "flex items-center gap-3 px-4 py-3 transition-colors duration-150 hover:bg-muted/60",
                      active && "bg-muted shadow-[inset_3px_0_0_var(--color-lime)]",
                    )}
                  >
                    <UserAvatar name={c.peer.name} avatarId={c.peer.avatarId} size="md" badge={c.peer.badge} presence={p.state} />
                    <span className="min-w-0 flex-1">
                      <span className="flex items-baseline justify-between gap-2">
                        <span className={cn("truncate text-sm", c.unread ? "font-semibold" : "font-medium")}>{c.peer.name}</span>
                        <span className={cn("shrink-0 text-[11px] tabular", c.unread ? "font-semibold text-foreground" : "text-muted-foreground")}>{chatTime(c.lastMessageAt)}</span>
                      </span>
                      <span className="mt-0.5 flex items-center justify-between gap-2">
                        <span className={cn("min-w-0 truncate text-xs", c.unread ? "text-foreground" : "text-muted-foreground")}>
                          <Preview c={c} />
                        </span>
                        {c.unread > 0 && (
                          <span className="grid h-[18px] min-w-[18px] shrink-0 place-items-center rounded-full bg-lime px-1 text-[10px] font-bold text-ink tabular">{c.unread}</span>
                        )}
                      </span>
                    </span>
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </div>
      <NewConversationDialog open={newOpen} onOpenChange={setNewOpen} />
    </>
  );
}

/** Procura alguém da comunidade por nome ou @ e abre a conversa. */
export function NewConversationDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (o: boolean) => void }) {
  const router = useRouter();
  const [q, setQ] = useState("");
  const [people, setPeople] = useState<ChatPeer[]>([]);
  const [loading, setLoading] = useState(false);
  const [pending, start] = useTransition();
  const [picked, setPicked] = useState<string | null>(null);

  useEffect(() => {
    const term = q.trim();
    if (term.length < 2) return;
    let alive = true;
    const t = setTimeout(() => {
      setLoading(true);
      fetch(`/api/chat/users?q=${encodeURIComponent(term)}`)
        .then((r) => (r.ok ? r.json() : { people: [] }))
        .then((j: { people: ChatPeer[] }) => alive && setPeople(j.people))
        .catch(() => {})
        .finally(() => alive && setLoading(false));
    }, 220);
    return () => {
      alive = false;
      clearTimeout(t);
    };
  }, [q]);

  const open_ = (username: string | null) => {
    if (!username) return;
    setPicked(username);
    start(async () => {
      const r = await startConversation({ username });
      setPicked(null);
      if (!r.ok) return void toast.error(r.error);
      onOpenChange(false);
      setQ("");
      router.push(`/mensagens/${r.data.id}`);
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Nova conversa</DialogTitle>
          <DialogDescription>Procure pelo nome ou pelo @ de quem está na comunidade.</DialogDescription>
        </DialogHeader>
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
          <Input autoFocus value={q} onChange={(e) => setQ(e.target.value)} placeholder="Ex.: Ana ou @ana.sites" className="h-10 pl-9" aria-label="Nome ou @" />
          {loading && <Loader2 className="absolute right-3 top-1/2 size-4 -translate-y-1/2 animate-spin text-muted-foreground" />}
        </div>
        <ul className="-mx-2 max-h-72 overflow-y-auto">
          {q.trim().length >= 2 && !loading && people.length === 0 && <li className="px-2 py-6 text-center text-sm text-muted-foreground">Ninguém com esse nome ou @.</li>}
          {q.trim().length >= 2 &&
            people.map((p) => (
              <li key={p.id}>
                <button
                  type="button"
                  disabled={pending}
                  onClick={() => open_(p.username)}
                  className="flex w-full items-center gap-3 rounded-md px-2 py-2 text-left transition-colors duration-150 hover:bg-muted disabled:opacity-60"
                >
                  <UserAvatar name={p.name} avatarId={p.avatarId} size="sm" badge={p.badge} />
                  <span className="min-w-0 flex-1">
                    <span className="flex items-center gap-1.5 truncate text-sm font-medium">
                      {p.name} {p.isDemo && <DemoBadge />}
                    </span>
                    <span className="block truncate text-xs text-muted-foreground">@{p.username}</span>
                  </span>
                  {pending && picked === p.username && <Loader2 className="size-4 animate-spin text-muted-foreground" />}
                </button>
              </li>
            ))}
        </ul>
      </DialogContent>
    </Dialog>
  );
}
