import type { Metadata } from "next";
import Link from "next/link";
import { Crown, Trophy } from "lucide-react";
import { Panel } from "@/components/common/panel";
import { EmptyState, PageHeader } from "@/components/common/page-header";
import { TimeChart } from "@/components/charts/time-chart";
import { Countdown, OptInBanner, Podium, RankTable } from "@/components/community/ranking";
import { StatTile } from "@/components/dashboard/widgets";
import { LiveRefresh } from "@/components/live/live-refresh";
import { LevelBadge, UserAvatar } from "@/components/profile/identity";
import { badgeKeyFor } from "@/lib/gamification/levels";
import { requireUser } from "@/lib/auth/session";
import { env } from "@/lib/env";
import { POINTS_PER_SALE, VALUE_POINTS_CAP } from "@/lib/gamification/points";
import { formatBRL, formatInt } from "@/lib/format";
import { cachedClosedPodiums, cachedLeaderboard, cachedPlatformDailyRevenue, cachedPlatformTotals } from "@/lib/ranking/cached";
import { lastDays, monthPeriod, weekPeriod } from "@/lib/time/periods";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Comunidade" };

const TABS = [
  ["ranking", "Ranking"],
  ["campeoes", "Campeões"],
  ["faturamento", "Faturamento"],
] as const;

const PERIODS = [
  ["semana", "Semana"],
  ["mes", "Mês"],
  ["geral", "Geral"],
] as const;

const MONTHS = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];

export default async function CommunityPage(props: PageProps<"/comunidade">) {
  const user = await requireUser();
  const sp = await props.searchParams;
  const tab = TABS.some(([id]) => id === sp.aba) ? (sp.aba as string) : "ranking";
  const periodId = PERIODS.some(([id]) => id === sp.periodo) ? (sp.periodo as string) : "semana";

  return (
    <div className="mx-auto max-w-6xl px-4 py-6 sm:px-6 sm:py-8">
      <PageHeader
        title="Comunidade"
        description={<LiveRefresh topics={["community"]} label="Ao vivo: cada pagamento confirmado atualiza o placar" />}
      />
      <nav className="mt-5 flex gap-1 border-b" aria-label="Seções da comunidade">
        {TABS.map(([id, label]) => (
          <Link
            key={id}
            href={`/comunidade?aba=${id}`}
            aria-current={tab === id ? "page" : undefined}
            className={cn("-mb-px border-b-2 border-transparent px-3 py-2 text-sm font-medium text-muted-foreground hover:text-foreground", tab === id && "border-foreground text-foreground")}
          >
            {label}
          </Link>
        ))}
      </nav>
      <div className="mt-6">
        {tab === "ranking" && <RankingTab meId={user.id} optedIn={user.rankingOptIn} periodId={periodId} />}
        {tab === "campeoes" && <ChampionsTab meId={user.id} />}
        {tab === "faturamento" && <RevenueTab meId={user.id} optedIn={user.rankingOptIn} />}
      </div>
    </div>
  );
}

async function RankingTab({ meId, optedIn, periodId }: { meId: string; optedIn: boolean; periodId: string }) {
  const period = periodId === "semana" ? weekPeriod() : periodId === "mes" ? monthPeriod() : null;
  const rows = await cachedLeaderboard(period, 100);
  const me = rows.find((r) => r.userId === meId);
  const minSale = formatBRL(env().RANKING_MIN_SALE_CENTS);

  return (
    <div className="grid grid-cols-1 gap-5">
      {!optedIn && <OptInBanner />}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <nav className="flex rounded-md bg-muted p-0.5 text-sm" aria-label="Período do ranking">
          {PERIODS.map(([id, label]) => (
            <Link
              key={id}
              href={`/comunidade?aba=ranking&periodo=${id}`}
              scroll={false}
              aria-current={periodId === id ? "page" : undefined}
              className={cn("rounded px-3 py-1.5 font-medium text-muted-foreground", periodId === id && "bg-background text-foreground shadow-sm")}
            >
              {label}
            </Link>
          ))}
        </nav>
        {period ? (
          <Countdown end={period.end.toISOString()} label={periodId === "semana" ? `Semana ${period.label} (seg 00:00 → dom 23:59)` : `Mês de ${period.label}`} />
        ) : (
          <span className="text-xs text-muted-foreground">Pontos acumulados desde o início</span>
        )}
      </div>

      {me && (
        <p className="text-sm">
          Você está em <span className="font-semibold">{me.position}º</span> com <span className="font-semibold tabular">{formatInt(me.points)} pontos</span>.
        </p>
      )}

      {rows.length === 0 ? (
        <EmptyState icon={<Trophy />} title="Ninguém pontuou neste período ainda">
          O primeiro pagamento confirmado pela plataforma já coloca alguém no topo.
        </EmptyState>
      ) : (
        <>
          <Podium rows={rows.slice(0, 3)} meId={meId} />
          {rows.length > 3 && (
            <Panel title={`Top ${Math.min(100, rows.length)}`}>
              <RankTable rows={rows} meId={meId} />
            </Panel>
          )}
        </>
      )}

      <p className="text-xs leading-relaxed text-muted-foreground">
        Como pontuar: {POINTS_PER_SALE} pontos por venda paga pela plataforma + 1 ponto a cada R$ 10 (até {formatInt(VALUE_POINTS_CAP)} por venda). Vendas abaixo de {minSale},
        estornadas ou registradas à mão não contam. Desempate: faturamento e, depois, quem chegou primeiro. Só aparece quem escolheu participar.
      </p>
    </div>
  );
}

async function ChampionsTab({ meId }: { meId: string }) {
  const [weeks, months, currentMonth] = await Promise.all([cachedClosedPodiums("week", { limitPeriods: 12 }), cachedClosedPodiums("month", { limitPeriods: 6 }), cachedLeaderboard(monthPeriod(), 3)]);
  const monthLabel = (key: string) => `${MONTHS[Number(key.slice(5, 7)) - 1]} de ${key.slice(0, 4)}`;
  const weekLabel = (key: string) => {
    const p = weekPeriod(new Date(`${key}T12:00:00-03:00`));
    return p.label;
  };

  return (
    <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
      <Panel title="Top 3 do mês (parcial)" action={<Countdown end={monthPeriod().end.toISOString()} label={monthPeriod().label} />}>
        {currentMonth.length === 0 ? (
          <p className="text-sm text-muted-foreground">Ainda sem pontos este mês.</p>
        ) : (
          <Podium rows={currentMonth} meId={meId} />
        )}
      </Panel>

      <Panel title="Pódios dos meses anteriores">
        {months.length === 0 ? (
          <p className="text-sm text-muted-foreground">O primeiro mês fechado aparece aqui.</p>
        ) : (
          <ul className="-my-2 divide-y">
            {months.map((m) => (
              <li key={m.key} className="py-3">
                <p className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">{monthLabel(m.key)}</p>
                <ol className="grid gap-1.5">
                  {m.winners.map((w) => (
                    <li key={w.userId} className="flex items-center gap-2 text-sm">
                      <span className="w-5 text-xs font-bold text-muted-foreground">{w.position}º</span>
                      <UserAvatar name={w.name} avatarId={w.avatarId} size="xs" badge={badgeKeyFor(w.displayTitle, w.level)} />
                      <Link href={`/u/${w.username}`} className="truncate font-medium hover:underline">
                        {w.name}
                      </Link>
                      <LevelBadge level={w.level} />
                      <span className="ml-auto text-xs text-muted-foreground tabular">{formatInt(w.points)} pts</span>
                    </li>
                  ))}
                </ol>
              </li>
            ))}
          </ul>
        )}
      </Panel>

      <Panel title="Campeões da semana" className="lg:col-span-2">
        {weeks.length === 0 ? (
          <p className="text-sm text-muted-foreground">A primeira semana fechada (segunda a domingo) aparece aqui na segunda-feira seguinte, às 00:00.</p>
        ) : (
          <ol className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {weeks.map((w) => {
              const champ = w.winners[0];
              return (
                <li key={w.key} className={cn("rounded-lg border p-4", champ.userId === meId && "ring-2 ring-brand-ink")}>
                  <p className="text-xs text-muted-foreground">Semana {weekLabel(w.key)}</p>
                  <div className="mt-2 flex items-center gap-2.5">
                    <UserAvatar name={champ.name} avatarId={champ.avatarId} size="md" badge={badgeKeyFor(champ.displayTitle, champ.level)} />
                    <div className="min-w-0">
                      <Link href={`/u/${champ.username}`} className="flex items-center gap-1.5 font-semibold hover:underline">
                        <Crown className="size-3.5 shrink-0 text-brand-ink" aria-label="Campeão" />
                        <span className="truncate">{champ.name}</span>
                      </Link>
                      <p className="text-xs text-muted-foreground tabular">
                        {formatInt(champ.points)} pts · {formatBRL(champ.revenueCents)}
                      </p>
                    </div>
                  </div>
                  {w.winners.length > 1 && (
                    <p className="mt-2 truncate text-xs text-muted-foreground">
                      {w.winners
                        .slice(1)
                        .map((x) => `${x.position}º ${x.name}`)
                        .join(" · ")}
                    </p>
                  )}
                </li>
              );
            })}
          </ol>
        )}
      </Panel>
    </div>
  );
}

async function RevenueTab({ meId, optedIn }: { meId: string; optedIn: boolean }) {
  const [totals, daily, allTime, month] = await Promise.all([cachedPlatformTotals(), cachedPlatformDailyRevenue(30), cachedLeaderboard(null, 100), cachedLeaderboard(monthPeriod(), 100)]);
  const byDay = new Map(daily.map((d) => [d.day, d]));
  const points = lastDays(30).map((k) => ({ label: `${k.slice(8, 10)}/${k.slice(5, 7)}`, values: { revenue: byDay.get(k)?.revenueCents ?? 0 } }));
  const monthBy = new Map(month.map((m) => [m.userId, m]));

  return (
    <div className="grid grid-cols-1 gap-5">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatTile label="Faturado na plataforma" value={formatBRL(totals.totalCents)} context={`${formatInt(totals.totalSales)} vendas pagas`} />
        <StatTile label={`Em ${totals.month.label}`} value={formatBRL(totals.monthCents)} context={`${formatInt(totals.activeSellersMonth)} contas vendendo`} />
        <StatTile label="Nesta semana" value={formatBRL(totals.weekCents)} context={`${formatInt(totals.weekSales)} vendas`} />
        <StatTile label="Ticket médio" value={formatBRL(totals.totalSales ? Math.round(totals.totalCents / totals.totalSales) : 0)} />
      </div>

      <Panel title="Faturamento da plataforma por dia (30 dias)">
        <TimeChart points={points} series={[{ key: "revenue", label: "Faturamento" }]} kind="area" format="brl" height={220} title="Faturamento diário da plataforma" />
      </Panel>

      {!optedIn && <OptInBanner />}

      <Panel title="Faturamento por conta">
        {allTime.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nenhuma conta com vendas e consentimento para exibir faturamento ainda.</p>
        ) : (
          <div className="relative -mx-5 overflow-x-auto">
            <table className="w-full min-w-[560px] text-sm">
              <thead>
                <tr className="border-b text-left text-xs text-muted-foreground">
                  <th className="px-5 py-2 font-medium">Conta</th>
                  <th className="px-3 py-2 text-right font-medium">No mês</th>
                  <th className="px-3 py-2 text-right font-medium">Total</th>
                  <th className="px-5 py-2 text-right font-medium">Vendas</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {[...allTime].sort((a, b) => b.revenueCents - a.revenueCents).map((r) => (
                  <tr key={r.userId} className={cn(r.userId === meId && "bg-brand-soft/60")}>
                    <td className="px-5 py-2">
                      <Link href={`/u/${r.username}`} className="flex min-w-0 items-center gap-2.5 hover:underline">
                        <UserAvatar name={r.name} avatarId={r.avatarId} size="xs" badge={badgeKeyFor(r.displayTitle, r.level)} />
                        <span className="truncate font-medium">{r.name}</span>
                        <LevelBadge level={r.level} />
                      </Link>
                    </td>
                    <td className="px-3 py-2 text-right tabular">{formatBRL(monthBy.get(r.userId)?.revenueCents ?? 0)}</td>
                    <td className="px-3 py-2 text-right font-semibold tabular">{formatBRL(r.revenueCents)}</td>
                    <td className="px-5 py-2 text-right tabular">{formatInt(r.sales)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <p className="mt-4 text-xs text-muted-foreground">
          Só aparecem contas que autorizaram mostrar o faturamento. Os totais do topo somam todas as vendas pagas pela plataforma, sem identificar ninguém.
        </p>
      </Panel>
    </div>
  );
}
