import type { Metadata } from "next";
import Link from "next/link";
import { Ban, Inbox, Send, UsersRound } from "lucide-react";
import { EmptyState, PageHeader } from "@/components/common/page-header";
import { LiveRefresh } from "@/components/live/live-refresh";
import { CancelInviteButton, FriendRowActions, InviteActions, PeopleSearch, PersonRow, UnblockButton } from "@/components/social/friends";
import { requireUser } from "@/lib/auth/session";
import { formatRelative } from "@/lib/format";
import { friendsOverview } from "@/lib/social/friends";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Amigos" };

const TABS = [
  { id: "amigos", label: "Amigos" },
  { id: "convites", label: "Convites recebidos", short: "Convites" },
  { id: "enviados", label: "Enviados" },
  { id: "bloqueados", label: "Bloqueados" },
] as const;
type Tab = (typeof TABS)[number]["id"];

export default async function FriendsPage(props: PageProps<"/amigos">) {
  const user = await requireUser();
  const { aba } = await props.searchParams;
  const data = await friendsOverview(user.id);
  // Convite esperando resposta abre direto na aba de convites
  const tab: Tab = TABS.some((t) => t.id === aba) ? (aba as Tab) : data.incoming.length ? "convites" : "amigos";
  const count: Record<Tab, number> = { amigos: data.friends.length, convites: data.incoming.length, enviados: data.outgoing.length, bloqueados: data.blocked.length };

  return (
    <div className="mx-auto max-w-3xl px-4 py-6 sm:px-6 sm:py-8">
      <PageHeader title="Amigos" description={<LiveRefresh topics={["me"]} label="Convites chegam aqui na hora" />} />
      <p className="mt-2 max-w-xl text-sm text-muted-foreground">
        Amigos conversam direto. Quem não é seu amigo pode escrever, mas a mensagem chega em Pedidos para você aceitar ou recusar.
      </p>

      <div className="mt-6">
        <PeopleSearch />
      </div>

      <nav className="mt-8 flex overflow-x-auto border-b [scrollbar-width:none] sm:gap-1" aria-label="Listas de amigos">
        {TABS.map((t) => (
          <Link
            key={t.id}
            href={`/amigos?aba=${t.id}`}
            scroll={false}
            aria-current={tab === t.id ? "page" : undefined}
            className={cn(
              "-mb-px inline-flex shrink-0 items-center gap-1.5 border-b-2 px-2 py-2.5 text-sm font-medium transition-colors duration-150 sm:px-3 sm:py-2",
              tab === t.id ? "border-foreground text-foreground" : "border-transparent text-muted-foreground hover:text-foreground",
            )}
          >
            {"short" in t ? (
              <>
                <span className="sm:hidden">{t.short}</span>
                <span className="hidden sm:inline">{t.label}</span>
              </>
            ) : (
              t.label
            )}
            {count[t.id] > 0 &&
              (t.id === "convites" ? (
                <span className="grid h-[18px] min-w-[18px] place-items-center rounded-full bg-lime px-1 text-[10px] font-bold text-ink tabular">{count[t.id]}</span>
              ) : (
                <span className="text-xs text-muted-foreground tabular">{count[t.id]}</span>
              ))}
          </Link>
        ))}
      </nav>

      <div className="mt-4">
        {tab === "amigos" &&
          (data.friends.length === 0 ? (
            <EmptyState icon={<UsersRound />} title="Nenhum amigo ainda">
              Procure alguém da comunidade pelo nome ou @ ali em cima e mande um convite.
            </EmptyState>
          ) : (
            <ul className="divide-y rounded-lg border bg-card shadow-soft">
              {data.friends.map((f) => (
                <PersonRow key={f.peer.id} peer={f.peer} meta={<span>amigos {formatRelative(f.since)}</span>}>
                  <FriendRowActions peer={f.peer} />
                </PersonRow>
              ))}
            </ul>
          ))}

        {tab === "convites" &&
          (data.incoming.length === 0 ? (
            <EmptyState icon={<Inbox />} title="Nenhum convite esperando">
              Quando alguém te convidar, aparece aqui. Quem convidou não fica sabendo se você recusar.
            </EmptyState>
          ) : (
            <ul className="divide-y rounded-lg border bg-card shadow-soft">
              {data.incoming.map((f) => (
                <PersonRow key={f.peer.id} peer={f.peer} meta={<span>convidou {formatRelative(f.at)}</span>}>
                  <InviteActions peer={f.peer} />
                </PersonRow>
              ))}
            </ul>
          ))}

        {tab === "enviados" &&
          (data.outgoing.length === 0 ? (
            <EmptyState icon={<Send />} title="Nenhum convite enviado">
              Os convites que você mandar e ainda não foram aceitos ficam aqui.
            </EmptyState>
          ) : (
            <ul className="divide-y rounded-lg border bg-card shadow-soft">
              {data.outgoing.map((f) => (
                <PersonRow key={f.peer.id} peer={f.peer} meta={<span>enviado {formatRelative(f.at)}</span>}>
                  <CancelInviteButton peer={f.peer} />
                </PersonRow>
              ))}
            </ul>
          ))}

        {tab === "bloqueados" &&
          (data.blocked.length === 0 ? (
            <EmptyState icon={<Ban />} title="Ninguém bloqueado">
              Bloqueou alguém? A pessoa aparece aqui e não consegue te mandar convite nem mensagem.
            </EmptyState>
          ) : (
            <ul className="divide-y rounded-lg border bg-card shadow-soft">
              {data.blocked.map((b) => (
                <PersonRow key={b.peer.id} peer={b.peer} meta={<span>bloqueado {formatRelative(b.at)}</span>}>
                  <UnblockButton peer={b.peer} />
                </PersonRow>
              ))}
            </ul>
          ))}
      </div>
    </div>
  );
}
