import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, Eye, Search } from "lucide-react";
import { DemoBadge } from "@/components/common/page-header";
import { Funnel, StatTile } from "@/components/dashboard/widgets";
import { StatusDot, WhatsAppButton } from "@/components/leads/lead-actions";
import { ScoreBadge } from "@/components/leads/score";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { requireUser } from "@/lib/auth/session";
import { formatBRL, formatInt, formatPercent, formatRelative } from "@/lib/format";
import { EVENT_LABEL } from "@/lib/leads/events";
import { getDashboardMetrics, recentActivity, topUncontacted, viewedProposals } from "@/lib/leads/metrics";

export const metadata: Metadata = { title: "Dashboard" };

const firstName = (name: string) => name.trim().split(/\s+/)[0] || name;

function Panel({ title, action, children }: { title: string; action?: React.ReactNode; children: React.ReactNode }) {
  return (
    <section className="rounded-lg border bg-card shadow-soft">
      <div className="flex items-center justify-between gap-2 border-b px-5 py-3">
        <h2 className="text-sm font-semibold">{title}</h2>
        {action}
      </div>
      <div className="p-5">{children}</div>
    </section>
  );
}

export default async function DashboardPage() {
  const user = await requireUser();
  const [m, activity, todo, viewed] = await Promise.all([
    getDashboardMetrics(user.id, user.defaultTicket),
    recentActivity(user.id, 10),
    topUncontacted(user.id, 5),
    viewedProposals(user.id, 4),
  ]);

  return (
    <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 sm:py-8">
      <div className="mb-5">
        <h1 className="text-2xl font-bold tracking-tight sm:text-[28px]">{user.isDemo ? "Olá!" : `Olá, ${firstName(user.name)}!`}</h1>
        <p className="mt-1 text-sm text-muted-foreground">Encontre empresas que podem precisar do seu site.</p>
      </div>
      {/* Área premium escura: valor do pipeline + busca direto do painel */}
      <section className="grid gap-6 rounded-xl bg-ink p-5 text-white shadow-premium ring-1 ring-transparent dark:bg-ink-2 dark:ring-white/10 sm:p-7 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)] lg:items-end">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.1em] text-white/60">Valor potencial do pipeline</p>
          <p className="mt-2 text-5xl font-bold tracking-tight">{formatBRL(m.pipelineValue)}</p>
          <p className="mt-2 text-sm text-white/60">
            {formatInt(m.openDeals)} oportunidades abertas · {formatBRL(m.wonValue)} já fechados
          </p>
        </div>
        <form action="/search" className="grid gap-2">
          <label htmlFor="dash-q" className="text-sm font-medium text-white">
            O que você procura?
          </label>
          <div className="flex gap-2">
            <div className="relative flex-1">
              <Search className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
              <Input id="dash-q" name="q" placeholder="Ex.: clínicas de estética em Fortaleza" className="h-[52px] rounded-[10px] border-transparent bg-white pl-10 text-ink placeholder:text-[#7b858d] dark:bg-white" autoComplete="off" />
            </div>
            <Button type="submit" size="lg" className="h-[52px] rounded-[10px] px-5">
              Encontrar leads
            </Button>
          </div>
        </form>
      </section>

      <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        <StatTile label="Leads encontrados" value={formatInt(m.found)} context={`${formatInt(m.foundWeek)} nos últimos 7 dias`} />
        <StatTile label="Leads salvos" value={formatInt(m.saved)} />
        <StatTile label="Alto potencial" value={formatInt(m.qualified)} context={m.found ? `${formatPercent(m.qualified / m.found)} dos encontrados` : undefined} />
        <StatTile label="Contatados" value={formatInt(m.contacted)} context={`${formatInt(m.contactedWeek)} nos últimos 7 dias`} />
        <StatTile label="Responderam" value={formatInt(m.replied)} />
        <StatTile label="Protótipos criados" value={formatInt(m.prototypes)} context={`${formatInt(m.proposalViews)} visualizações de propostas`} />
        <StatTile label="Propostas enviadas" value={formatInt(m.proposals)} />
        <StatTile label="Em negociação" value={formatInt(m.negotiating)} />
        <StatTile label="Taxa de resposta" value={formatPercent(m.responseRate)} context="respostas ÷ contatados" />
        <StatTile label="Clientes fechados" value={formatInt(m.won)} context={`conversão ${formatPercent(m.conversionRate)} dos contatados`} />
      </div>

      <div className="mt-5 grid grid-cols-1 gap-5 lg:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)]">
        <Panel title="Funil de prospecção">
          <Funnel steps={m.funnel} />
        </Panel>

        <Panel
          title="Para abordar hoje"
          action={
            <Link href="/search" className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground">
              Buscar mais <ArrowRight className="size-3" />
            </Link>
          }
        >
          {todo.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nenhum lead novo esperando contato. Hora de uma nova busca.</p>
          ) : (
            <ul className="-my-2 divide-y">
              {todo.map((l) => (
                <li key={l.id} className="flex items-center gap-3 py-2.5">
                  <div className="min-w-0 flex-1">
                    <Link href={`/leads/${l.id}`} className="flex items-center gap-2 truncate text-sm font-medium hover:underline">
                      {l.isDemo && <DemoBadge />}
                      <span className="truncate">{l.name}</span>
                    </Link>
                    <p className="truncate text-xs text-muted-foreground">
                      {l.categoryLabel} · {l.city}
                      {l._count.prototypes > 0 && " · protótipo pronto"}
                    </p>
                  </div>
                  <ScoreBadge score={l.score} tier={l.scoreTier} />
                  <WhatsAppButton lead={{ id: l.id, isDemo: l.isDemo, phone: l.phone, whatsapp: l.whatsapp }} iconOnly size="icon-sm" />
                </li>
              ))}
            </ul>
          )}
        </Panel>
      </div>

      <div className="mt-5 grid grid-cols-1 gap-5 lg:grid-cols-2">
        <Panel title="Atividade recente">
          {activity.length === 0 ? (
            <p className="text-sm text-muted-foreground">Ainda sem atividade.</p>
          ) : (
            <ol className="-my-1 grid grid-cols-1 gap-2.5">
              {activity.map((e) => (
                <li key={e.id} className="flex items-baseline gap-3 text-sm">
                  <span className="w-16 shrink-0 text-xs text-muted-foreground">{formatRelative(e.createdAt)}</span>
                  <span className="min-w-0 truncate">
                    {EVENT_LABEL[e.type]} ·{" "}
                    <Link href={`/leads/${e.lead.id}`} className="font-medium hover:underline">
                      {e.lead.name}
                    </Link>
                  </span>
                </li>
              ))}
            </ol>
          )}
        </Panel>

        <Panel title="Propostas visualizadas pelos clientes">
          {viewed.length === 0 ? (
            <p className="text-sm text-muted-foreground">Quando um cliente abrir o link da proposta, ele aparece aqui.</p>
          ) : (
            <ul className="-my-2 divide-y">
              {viewed.map((p) => (
                <li key={p.id} className="flex items-center gap-3 py-2.5 text-sm">
                  <StatusDot status={p.lead.status} />
                  <div className="min-w-0 flex-1">
                    <Link href={`/leads/${p.lead.id}`} className="truncate font-medium hover:underline">
                      {p.lead.name}
                    </Link>
                    <p className="text-xs text-muted-foreground">
                      {p.name} · visto {p.lastViewedAt ? formatRelative(p.lastViewedAt) : "—"}
                    </p>
                  </div>
                  <span className="inline-flex items-center gap-1 text-xs text-muted-foreground tabular">
                    <Eye className="size-3.5" /> {formatInt(p.views)}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Panel>
      </div>
    </div>
  );
}
