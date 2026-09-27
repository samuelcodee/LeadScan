import type { Metadata } from "next";
import Link from "next/link";
import { Panel } from "@/components/common/panel";
import { PageHeader } from "@/components/common/page-header";
import { TimeChart } from "@/components/charts/time-chart";
import { StatTile } from "@/components/dashboard/widgets";
import { AccountsPanel } from "@/components/finance/accounts-panel";
import { BankAccountsPanel } from "@/components/finance/bank-accounts";
import { ChargeDialog } from "@/components/finance/charge-dialog";
import { ChargesTable } from "@/components/finance/charges-table";
import { ManualSaleDialog } from "@/components/finance/manual-sale-dialog";
import { Statement } from "@/components/finance/statement";
import { LiveRefresh } from "@/components/live/live-refresh";
import { requireUser } from "@/lib/auth/session";
import { listBankAccounts } from "@/lib/finance/banks";
import { financeSummary, listCharges, listManualSales, movements, revenueSeries, type RevenueRange } from "@/lib/finance/queries";
import { formatBRL, formatDate, formatInt, formatPercent } from "@/lib/format";
import { listAccounts, listPaymentProviders } from "@/lib/payments/service";
import { METHOD_LABEL } from "@/lib/payments/types";
import { appUrl } from "@/lib/prototypes/service";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Financeiro" };

const NOTICES: Record<string, string> = {
  "conectado=mock": "Pagamentos de teste ativados.",
  "conectado=mercadopago": "Mercado Pago conectado. Já dá pra cobrar com Pix e cartão.",
  "conectado=stripe": "Stripe conectada.",
  "pendente=stripe": "A Stripe ainda está analisando seu cadastro. Você recebe um aviso quando liberar.",
};

export default async function FinancePage(props: PageProps<"/financeiro">) {
  const user = await requireUser();
  const sp = await props.searchParams;
  const range: RevenueRange = sp.periodo === "12m" ? "12m" : "30d";
  const [s, series, charges, manual, accounts, base, banks, statement] = await Promise.all([
    financeSummary(user.id),
    revenueSeries(user.id, range),
    listCharges(user.id),
    listManualSales(user.id),
    listAccounts(user.id),
    appUrl(),
    listBankAccounts(user.id),
    movements(user.id),
  ]);
  const providers = listPaymentProviders();
  const notice = Object.entries(NOTICES).find(([k]) => {
    const [key, val] = k.split("=");
    return sp[key] === val;
  })?.[1];
  const error = typeof sp.erro === "string" ? sp.erro : null;
  const monthDelta = s.prevMonthCents ? (s.monthCents - s.prevMonthCents) / s.prevMonthCents : null;
  const hasManual = series.some((p) => p.values.manual > 0);

  return (
    <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 sm:py-8">
      <PageHeader
        title="Financeiro"
        description={<LiveRefresh topics={["me"]} label="Ao vivo: pagamentos entram aqui assim que o cliente paga" />}
        actions={
          <>
            <ManualSaleDialog />
            <ChargeDialog label="Nova cobrança" />
          </>
        }
      />

      {notice && <p className="mt-4 rounded-md border border-success/30 bg-success-soft px-4 py-2.5 text-sm text-success">{notice}</p>}
      {error && (
        <p className="mt-4 rounded-md border border-destructive/30 bg-destructive/10 px-4 py-2.5 text-sm text-destructive">
          Não foi possível concluir a conexão ({error.replace(/-/g, " ")}). Tente de novo.
        </p>
      )}

      <section className="mt-6 grid gap-5 rounded-xl border bg-card p-5 sm:p-7 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,2fr)]">
        <div>
          <p className="text-xs font-medium text-muted-foreground">Faturado em {s.month.label}</p>
          <p className="mt-1 text-5xl font-semibold tracking-tight tabular">{formatBRL(s.monthCents)}</p>
          <p className="mt-2 text-sm text-muted-foreground">
            {formatInt(s.monthSales)} {s.monthSales === 1 ? "venda" : "vendas"}
            {monthDelta !== null && (
              <>
                {" · "}
                <span className={monthDelta >= 0 ? "text-success" : "text-destructive"}>
                  {monthDelta >= 0 ? "+" : ""}
                  {formatPercent(monthDelta)}
                </span>{" "}
                vs. mês passado
              </>
            )}
          </p>
          <dl className="mt-6 grid grid-cols-2 gap-x-4 gap-y-3 text-sm">
            <div>
              <dt className="text-xs text-muted-foreground">Esta semana</dt>
              <dd className="font-semibold tabular">{formatBRL(s.weekCents)}</dd>
            </div>
            <div>
              <dt className="text-xs text-muted-foreground">A receber</dt>
              <dd className="font-semibold tabular">
                {formatBRL(s.pendingCents)} <span className="text-xs font-normal text-muted-foreground">({s.pendingCount})</span>
              </dd>
            </div>
            <div>
              <dt className="text-xs text-muted-foreground">Ticket médio</dt>
              <dd className="font-semibold tabular">{formatBRL(s.avgTicketCents)}</dd>
            </div>
            <div>
              <dt className="text-xs text-muted-foreground">Tarifas pagas</dt>
              <dd className="font-semibold tabular">{formatBRL(s.feesCents)}</dd>
            </div>
          </dl>
        </div>
        <div className="min-w-0">
          <div className="mb-3 flex items-center justify-between gap-2">
            <p className="text-sm font-medium">Faturamento {range === "30d" ? "por dia" : "por mês"}</p>
            <nav className="flex rounded-md bg-muted p-0.5 text-xs" aria-label="Período do gráfico">
              {(
                [
                  ["30d", "30 dias"],
                  ["12m", "12 meses"],
                ] as const
              ).map(([id, label]) => (
                <Link
                  key={id}
                  href={`/financeiro?periodo=${id}`}
                  scroll={false}
                  aria-current={range === id ? "page" : undefined}
                  className={cn("rounded px-2.5 py-1 font-medium text-muted-foreground", range === id && "bg-background text-foreground shadow-sm")}
                >
                  {label}
                </Link>
              ))}
            </nav>
          </div>
          <TimeChart
            points={series}
            series={hasManual ? [{ key: "platform", label: "Pela plataforma" }, { key: "manual", label: "Por fora" }] : [{ key: "total", label: "Faturamento" }]}
            kind={hasManual ? "bar" : "area"}
            format="brl"
            height={220}
            title={`Faturamento ${range === "30d" ? "dos últimos 30 dias" : "dos últimos 12 meses"}`}
          />
        </div>
      </section>

      <div className="mt-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatTile label="Total recebido" value={formatBRL(s.totalCents)} context={`${formatInt(s.totalSales)} vendas no total`} />
        <StatTile label="Pela plataforma" value={formatBRL(s.platformCents)} context={`${formatInt(s.platformSales)} vendas verificadas`} />
        <StatTile label="Por fora e Pix direto" value={formatBRL(s.totalCents - s.platformCents)} context="não conta para ranking" />
        <StatTile
          label="Meio mais usado"
          value={s.byMethod[0] ? (METHOD_LABEL[s.byMethod[0].method] ?? "Registro manual") : "—"}
          context={s.byMethod[0] && s.totalCents ? `${formatPercent(s.byMethod[0].cents / s.totalCents)} do valor` : undefined}
        />
      </div>

      <div className="mt-5 grid grid-cols-1 gap-5 lg:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
        <Panel title="Cobranças" action={<ChargeDialog label="Cobrar" size="sm" variant="outline" />}>
          <ChargesTable rows={charges} baseUrl={base} />
        </Panel>

        <div className="grid grid-cols-1 content-start gap-5">
          <Panel title="Contas bancárias e Pix" id="bancos">
            <BankAccountsPanel accounts={banks} />
          </Panel>

          <Panel title="Mercado Pago e Stripe" id="contas">
            <AccountsPanel providers={providers} accounts={accounts} />
            <p className="mt-4 text-xs text-muted-foreground">
              Para aceitar cartão e ter a confirmação automática. O dinheiro vai direto para a sua conta no provedor; a plataforma não vê dados de cartão e não segura seu saldo.
            </p>
          </Panel>

          <Panel title="Vendas registradas por fora">
            {manual.length === 0 ? (
              <p className="text-sm text-muted-foreground">Nada por aqui. Use “Registrar venda por fora” para vendas pagas em dinheiro ou transferência.</p>
            ) : (
              <ul className="-my-2 divide-y text-sm">
                {manual.map((m) => (
                  <li key={m.id} className="flex items-center gap-3 py-2">
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-medium">{m.lead?.name ?? m.note ?? "Venda"}</p>
                      <p className="truncate text-xs text-muted-foreground">
                        {formatDate(m.closedAt)}
                        {m.lead && m.note ? ` · ${m.note}` : ""}
                      </p>
                    </div>
                    <span className="font-semibold tabular">{formatBRL(m.amountCents)}</span>
                  </li>
                ))}
              </ul>
            )}
          </Panel>
        </div>
      </div>

      <Panel title="Extrato" className="mt-5" id="extrato">
        <Statement rows={statement.rows} totals={statement.totals} />
      </Panel>
    </div>
  );
}
