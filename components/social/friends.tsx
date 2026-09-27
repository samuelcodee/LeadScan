"use client";

import { Ban, Check, Loader2, MoreHorizontal, Search, UserCheck, UserMinus, UserPlus, UserRoundX, X } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState, useTransition } from "react";
import { toast } from "sonner";
import { addFriend, answerFriendRequest, findPeopleToAdd, setUserBlocked, unfriend } from "@/app/actions/friends";
import { MessageButton } from "@/components/chat/message-button";
import { PresenceLabel } from "@/components/chat/presence-label";
import { DemoBadge } from "@/components/common/page-header";
import { UserAvatar } from "@/components/profile/identity";
import { Button } from "@/components/ui/button";
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import type { ChatPeer } from "@/lib/chat/service";

export type RelationKind = "self" | "blocked" | "friends" | "outgoing" | "incoming" | "none";
type Person = Pick<ChatPeer, "id" | "name" | "username">;

const first = (name: string) => name.split(" ")[0];

/** Executa uma ação de amizade e devolve a nova relação (e recarrega a página em volta). */
function useFriendAction() {
  const router = useRouter();
  const [pending, start] = useTransition();
  const run = (fn: () => Promise<{ ok: true; data: object } | { ok: false; error: string }>, done?: (k?: RelationKind) => void, ok?: string) =>
    start(async () => {
      const r = await fn();
      if (!r.ok) return void toast.error(r.error);
      if (ok) toast.success(ok);
      done?.("relation" in r.data ? (r.data.relation as { kind: RelationKind }).kind : undefined);
      router.refresh();
    });
  return { run, pending };
}

/**
 * Botão de amizade do perfil e da busca de pessoas: Adicionar → Convite enviado (cancelar)
 * → Amigos (desfazer). Convite recebido vira Aceitar / Recusar.
 */
export function FriendButton({ person, relation: initial, size = "sm" }: { person: Person; relation: RelationKind; size?: "sm" | "default" }) {
  const [relation, setRelation] = useState(initial);
  const { run, pending } = useFriendAction();
  const set = (k?: RelationKind) => k && setRelation(k);
  const icon = (I: typeof UserPlus) => (pending ? <Loader2 className="animate-spin" /> : <I />);

  if (relation === "self" || relation === "blocked") return null;
  if (relation === "incoming") {
    return (
      <div className="flex gap-1.5">
        <Button size={size} onClick={() => run(() => answerFriendRequest({ userId: person.id, accept: true }), set, `Agora você e ${first(person.name)} são amigos.`)} disabled={pending}>
          {icon(Check)} Aceitar convite
        </Button>
        <Button size={size} variant="outline" onClick={() => run(() => answerFriendRequest({ userId: person.id, accept: false }), set)} disabled={pending} aria-label="Recusar convite">
          <X /> Recusar
        </Button>
      </div>
    );
  }
  if (relation === "outgoing") {
    return (
      <Button size={size} variant="outline" onClick={() => run(() => unfriend({ userId: person.id }), set, "Convite cancelado.")} disabled={pending} title="Cancelar convite">
        {icon(UserCheck)} Convite enviado
      </Button>
    );
  }
  if (relation === "friends") return <UnfriendButton person={person} size={size} onDone={() => setRelation("none")} />;
  return (
    <Button size={size} onClick={() => run(() => addFriend({ userId: person.id }), set, `Convite enviado para ${first(person.name)}.`)} disabled={pending}>
      {icon(UserPlus)} Adicionar amigo
    </Button>
  );
}

function UnfriendButton({ person, size, onDone }: { person: Person; size: "sm" | "default"; onDone: () => void }) {
  const [open, setOpen] = useState(false);
  const { run, pending } = useFriendAction();
  return (
    <>
      <Button size={size} variant="outline" onClick={() => setOpen(true)}>
        <UserCheck /> Amigos
      </Button>
      <Dialog open={open} onOpenChange={(o) => !pending && setOpen(o)}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Desfazer amizade com {first(person.name)}?</DialogTitle>
            <DialogDescription>A conversa de vocês continua. Para voltar a ser amigos, é preciso um convite novo.</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <DialogClose asChild>
              <Button variant="outline" disabled={pending}>
                Cancelar
              </Button>
            </DialogClose>
            <Button
              variant="destructive"
              disabled={pending}
              onClick={() =>
                run(() => unfriend({ userId: person.id }), () => {
                  setOpen(false);
                  onDone();
                })
              }
            >
              {pending ? <Loader2 className="animate-spin" /> : <UserMinus />} Desfazer amizade
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

/** Menu "…" do perfil: bloquear ou desbloquear (com confirmação para bloquear). */
export function BlockMenu({ person, blocked }: { person: Person; blocked: boolean }) {
  const [confirm, setConfirm] = useState(false);
  const { run, pending } = useFriendAction();
  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon-sm" aria-label="Mais opções" disabled={pending}>
            <MoreHorizontal />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          {blocked ? (
            <DropdownMenuItem onSelect={() => run(() => setUserBlocked({ userId: person.id, blocked: false }), undefined, `${first(person.name)} desbloqueado.`)}>
              <UserRoundX /> Desbloquear
            </DropdownMenuItem>
          ) : (
            <DropdownMenuItem variant="destructive" onSelect={() => setConfirm(true)}>
              <Ban /> Bloquear
            </DropdownMenuItem>
          )}
        </DropdownMenuContent>
      </DropdownMenu>
      <BlockDialog person={person} open={confirm} onOpenChange={setConfirm} />
    </>
  );
}

export function BlockDialog({ person, open, onOpenChange }: { person: Person; open: boolean; onOpenChange: (o: boolean) => void }) {
  const { run, pending } = useFriendAction();
  return (
    <Dialog open={open} onOpenChange={(o) => !pending && onOpenChange(o)}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>Bloquear {first(person.name)}?</DialogTitle>
          <DialogDescription>
            Vocês deixam de ser amigos, convites somem e ninguém manda mensagem para ninguém. {first(person.name)} não é avisado. Dá para desbloquear depois.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <DialogClose asChild>
            <Button variant="outline" disabled={pending}>
              Cancelar
            </Button>
          </DialogClose>
          <Button
            variant="destructive"
            disabled={pending}
            onClick={() => run(() => setUserBlocked({ userId: person.id, blocked: true }), () => onOpenChange(false), `${first(person.name)} bloqueado.`)}
          >
            {pending ? <Loader2 className="animate-spin" /> : <Ban />} Bloquear
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/** Linha de pessoa das listas da página Amigos. */
export function PersonRow({ peer, meta, children }: { peer: ChatPeer; meta?: React.ReactNode; children?: React.ReactNode }) {
  // Celular: nome em cima, botões na linha de baixo (alinhados ao texto) — nada espremido.
  // A partir de sm: tudo numa linha.
  return (
    <li className="flex flex-wrap items-center gap-x-3 gap-y-2 px-4 py-3">
      <Link href={peer.username ? `/u/${peer.username}` : "#"} className="flex min-w-0 basis-full items-center gap-3 sm:basis-0 sm:flex-1">
        <UserAvatar name={peer.name} avatarId={peer.avatarId} size="md" badge={peer.badge} />
        <span className="min-w-0 flex-1">
          <span className="flex min-w-0 items-center gap-1.5 text-sm font-medium">
            <span className="truncate">{peer.name}</span>
            {peer.isDemo && <DemoBadge className="shrink-0" />}
          </span>
          <span className="flex min-w-0 items-center gap-x-2 text-xs text-muted-foreground">
            {peer.username && <span className="truncate">@{peer.username}</span>}
            {meta && <span className="shrink-0">{meta}</span>}
          </span>
        </span>
      </Link>
      {children && <div className="ml-[3.25rem] flex flex-wrap items-center gap-1.5 sm:ml-0">{children}</div>}
    </li>
  );
}

/** Ações da linha de um amigo: mensagem + menu (desfazer amizade, bloquear). */
export function FriendRowActions({ peer }: { peer: ChatPeer }) {
  const [confirmBlock, setConfirmBlock] = useState(false);
  const { run, pending } = useFriendAction();
  return (
    <>
      <PresenceLabel lastActiveAt={peer.lastActiveAt} visible={peer.presenceVisible} className="hidden sm:flex" />
      {peer.username && <MessageButton username={peer.username} />}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon-sm" aria-label={`Opções de ${peer.name}`} disabled={pending}>
            <MoreHorizontal />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem onSelect={() => run(() => unfriend({ userId: peer.id }), undefined, `Você e ${first(peer.name)} não são mais amigos.`)}>
            <UserMinus /> Desfazer amizade
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem variant="destructive" onSelect={() => setConfirmBlock(true)}>
            <Ban /> Bloquear
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      <BlockDialog person={peer} open={confirmBlock} onOpenChange={setConfirmBlock} />
    </>
  );
}

/** Convite recebido: aceitar, recusar ou bloquear. */
export function InviteActions({ peer }: { peer: ChatPeer }) {
  const [confirmBlock, setConfirmBlock] = useState(false);
  const { run, pending } = useFriendAction();
  return (
    <>
      <Button size="sm" onClick={() => run(() => answerFriendRequest({ userId: peer.id, accept: true }), undefined, `Agora você e ${first(peer.name)} são amigos.`)} disabled={pending}>
        {pending ? <Loader2 className="animate-spin" /> : <Check />} Aceitar
      </Button>
      <Button size="sm" variant="outline" onClick={() => run(() => answerFriendRequest({ userId: peer.id, accept: false }), undefined, "Convite recusado.")} disabled={pending}>
        <X /> Recusar
      </Button>
      <Button size="icon-sm" variant="ghost" className="text-muted-foreground hover:text-destructive" onClick={() => setConfirmBlock(true)} aria-label={`Bloquear ${peer.name}`} title="Bloquear">
        <Ban />
      </Button>
      <BlockDialog person={peer} open={confirmBlock} onOpenChange={setConfirmBlock} />
    </>
  );
}

export function CancelInviteButton({ peer }: { peer: ChatPeer }) {
  const { run, pending } = useFriendAction();
  return (
    <Button size="sm" variant="outline" onClick={() => run(() => unfriend({ userId: peer.id }), undefined, "Convite cancelado.")} disabled={pending}>
      {pending ? <Loader2 className="animate-spin" /> : <X />} Cancelar convite
    </Button>
  );
}

export function UnblockButton({ peer }: { peer: ChatPeer }) {
  const { run, pending } = useFriendAction();
  return (
    <Button size="sm" variant="outline" onClick={() => run(() => setUserBlocked({ userId: peer.id, blocked: false }), undefined, `${first(peer.name)} desbloqueado.`)} disabled={pending}>
      {pending ? <Loader2 className="animate-spin" /> : <UserRoundX />} Desbloquear
    </Button>
  );
}

/** Procurar gente da comunidade pelo nome ou @ e convidar. */
export function PeopleSearch() {
  const [q, setQ] = useState("");
  const [results, setResults] = useState<{ peer: ChatPeer; relation: RelationKind }[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const term = q.trim();
    if (term.length < 2) return;
    let alive = true;
    const t = setTimeout(async () => {
      setLoading(true);
      const r = await findPeopleToAdd({ q: term });
      if (!alive) return;
      setLoading(false);
      if (r.ok) setResults(r.data);
    }, 250);
    return () => {
      alive = false;
      clearTimeout(t);
    };
  }, [q]);

  const show = q.trim().length >= 2;
  return (
    <div className="rounded-lg border bg-card shadow-soft">
      <div className="relative p-3">
        <Search className="pointer-events-none absolute left-6 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
        <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Adicionar amigos: nome ou @" className="h-10 pl-9" aria-label="Procurar pessoas pelo nome ou @" />
        {loading && <Loader2 className="absolute right-6 top-1/2 size-4 -translate-y-1/2 animate-spin text-muted-foreground" />}
      </div>
      {show && (
        <ul className="divide-y border-t">
          {!loading && results.length === 0 && <li className="px-4 py-6 text-center text-sm text-muted-foreground">Ninguém com esse nome ou @.</li>}
          {results.map((r) => (
            <PersonRow key={r.peer.id} peer={r.peer}>
              <FriendButton person={r.peer} relation={r.relation} />
            </PersonRow>
          ))}
        </ul>
      )}
    </div>
  );
}
