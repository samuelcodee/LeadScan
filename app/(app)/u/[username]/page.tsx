import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Clock, Lock, Pencil } from "lucide-react";
import { Panel } from "@/components/common/panel";
import { DemoBadge } from "@/components/common/page-header";
import { TimeChart } from "@/components/charts/time-chart";
import { StatTile } from "@/components/dashboard/widgets";
import { Instagram } from "@/components/icons";
import { MessageButton } from "@/components/chat/message-button";
import { accountAge, UserAvatar } from "@/components/profile/identity";
import { Insignia } from "@/components/profile/insignia";
import { PresenceLabel } from "@/components/chat/presence-label";
import { Button } from "@/components/ui/button";
import { requireUser } from "@/lib/auth/session";
import { badgeKeyFor, getLevel } from "@/lib/gamification/levels";
import { formatBRL, formatDate, formatInt } from "@/lib/format";
import { profileView } from "@/lib/profile/queries";

export async function generateMetadata(props: PageProps<"/u/[username]">): Promise<Metadata> {
  const { username } = await props.params;
  return { title: `@${username}` };
}

export default async function PublicProfilePage(props: PageProps<"/u/[username]">) {
  const viewer = await requireUser();
  const { username } = await props.params;
  const view = await profileView(decodeURIComponent(username).toLowerCase(), viewer.id);
  if (!view) notFound();
  const u = view.user;
  const badge = view.closed ? null : badgeKeyFor(u.displayTitle, u.level);

  const header = (
    <div className="flex flex-wrap items-start gap-5">
      <UserAvatar name={u.name} avatarId={view.closed ? null : u.avatarId} size="xl" badge={badge} />
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <h1 className="text-2xl font-semibold tracking-tight">{u.name}</h1>
          {badge && (
            <span className="inline-flex items-center gap-1.5 rounded-full border bg-card py-0.5 pl-0.5 pr-2.5 text-xs font-semibold">
              <Insignia badge={badge} size={22} />
              {view.title}
            </span>
          )}
          {u.isDemo && <DemoBadge />}
        </div>
        <p className="mt-0.5 flex flex-wrap items-center gap-x-2 text-sm text-muted-foreground">
          @{u.username}
          {!view.isOwner && <PresenceLabel lastActiveAt={u.presenceVisible ? (u.lastActiveAt?.toISOString() ?? null) : null} visible={u.presenceVisible} />}
        </p>
        {!view.closed && u.bio && <p className="mt-3 max-w-xl text-sm leading-relaxed">{u.bio}</p>}
        {!view.closed && (
          <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
            {u.instagram && (
              <a href={`https://instagram.com/${u.instagram}`} target="_blank" rel="noopener noreferrer nofollow" className="inline-flex items-center gap-1 hover:text-foreground">
                <Instagram className="size-3.5" /> @{u.instagram}
              </a>
            )}
            {u.showAccountAge && (
              <span className="inline-flex items-center gap-1" title={`Conta criada em ${formatDate(u.createdAt, "long")}`}>
                <Clock className="size-3.5" /> {accountAge(u.createdAt)}
              </span>
            )}
          </div>
        )}
      </div>
      {view.isOwner ? (
        <Button asChild variant="outline" size="sm">
          <Link href="/perfil">
            <Pencil /> Editar perfil
          </Link>
        </Button>
      ) : (
        u.username && <MessageButton username={u.username} />
      )}
    </div>
  );

  if (view.closed) {
    return (
      <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6">
        {header}
        <div className="mt-8 grid place-items-center rounded-lg border border-dashed px-6 py-14 text-center">
          <Lock className="size-5 text-muted-foreground" />
          <p className="mt-2 font-medium">Perfil fechado</p>
          <p className="mt-1 text-sm text-muted-foreground">Esta pessoa preferiu não mostrar a atividade para a comunidade.</p>
        </div>
      </div>
    );
  }

  const { stats, totals, weekly } = view;
  return (
    <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6">
      {header}

      <div className="mt-8 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatTile label="Vendas verificadas" value={formatInt(stats.sales)} context={stats.activeMonths ? `em ${stats.activeMonths} ${stats.activeMonths === 1 ? "mês" : "meses"}` : undefined} />
        <StatTile
          label="Faturamento pela plataforma"
          value={stats.revenueCents === null ? "Privado" : formatBRL(stats.revenueCents)}
          context={stats.revenueCents === null ? "fora do ranking público" : undefined}
        />
        <StatTile label="Posição na semana" value={view.weekRank ? `${view.weekRank.position}º` : "—"} context={view.weekRank ? `${formatInt(view.weekRank.points)} pts` : "sem pontos esta semana"} />
        <StatTile label="Posição no mês" value={view.monthRank ? `${view.monthRank.position}º` : "—"} context={view.monthRank ? `${formatInt(view.monthRank.points)} pts` : undefined} />
      </div>

      <div className="mt-5 grid gap-5 lg:grid-cols-2">
        <Panel title="Leads fechados e recusados no CRM (por semana)">
          <TimeChart
            points={weekly}
            series={[
              { key: "won", label: `Fechados · ${formatInt(totals.won)} no total` },
              { key: "refused", label: `Recusados · ${formatInt(totals.refused)} no total`, tone: "bad" },
            ]}
            format="int"
            height={200}
            heat
            partialLast
            title="Leads fechados e recusados nas últimas 12 semanas"
          />
        </Panel>
        <Panel title={`Abordagens enviadas · ${formatInt(totals.outreach)} no total`}>
          <TimeChart points={weekly} series={[{ key: "outreach", label: "Abordagens" }]} format="int" height={200} heat partialLast title="Abordagens por semana" />
        </Panel>
        <Panel title={`Buscas de leads · ${formatInt(totals.searches)} no total`}>
          <TimeChart points={weekly} series={[{ key: "searches", label: "Buscas" }]} format="int" height={180} heat partialLast title="Buscas de leads por semana" />
        </Panel>
        <Panel title={`Protótipos criados · ${formatInt(totals.prototypes)} no total`}>
          <TimeChart points={weekly} series={[{ key: "prototypes", label: "Protótipos" }]} format="int" height={180} heat partialLast title="Protótipos criados por semana" />
        </Panel>
      </div>

      <Panel title="Conquistas" className="mt-5">
        {view.titles.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nenhuma conquista ainda. A primeira vem com a primeira venda paga pela plataforma.</p>
        ) : (
          <ul className="flex flex-wrap gap-2">
            {view.titles.map((t) => {
              const lvl = t.key.startsWith("level-") ? Number(t.key.slice(6)) : null;
              const at = view.achievements.find((a) => a.key === t.key)?.unlockedAt;
              return (
                <li key={t.key} className="inline-flex items-center gap-2 rounded-full border py-1 pl-1.5 pr-3 text-sm" title={at ? `Conquistado em ${formatDate(at, "long")}` : t.detail}>
                  <Insignia badge={t.key} size={22} />
                  {lvl ? getLevel(lvl)?.name : t.label}
                  {t.count && t.count > 1 && <span className="text-xs text-muted-foreground">×{t.count}</span>}
                </li>
              );
            })}
          </ul>
        )}
      </Panel>
    </div>
  );
}
