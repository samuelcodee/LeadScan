import { ArrowDownLeft, ArrowUpRight, ChevronDown, Receipt } from "lucide-react";
import { DemoBadge } from "@/components/common/page-header";
import type { Movement } from "@/lib/finance/queries";
import { formatBRL, formatDate } from "@/lib/format";
import { cn } from "@/lib/utils";

const KIND: Record<Movement["kind"], string> = { in: "Recebido", manual: "Por fora", fee: "Tarifa", refund: "Estorno" };

/** Extrato: entradas, tarifas e estornos, mais novos primeiro. */
export function Statement({ rows, totals }: { rows: Movement[]; totals: { in: number; fees: number; refunds: number; net: number } }) {
  if (!rows.length) {
    return (
      <div className="grid place-items-center py-8 text-center">
        <Receipt className="size-5 text-muted-foreground" />
        <p className="mt-2 text-sm text-muted-foreground">Nada ainda. Cada pagamento recebido, tarifa ou estorno aparece aqui.</p>
      </div>
    );
  }
  return (
    <div className="grid grid-cols-1 gap-4">
      <dl className="grid grid-cols-2 gap-3 text-sm sm:grid-cols-4">
        {[
          ["Entradas", totals.in, ""],
          // saídas aparecem negativas (sem "−0" quando não houve nenhuma)
          ["Tarifas", totals.fees ? -totals.fees : 0, totals.fees ? "text-destructive" : ""],
          ["Estornos", totals.refunds ? -totals.refunds : 0, totals.refunds ? "text-destructive" : ""],
          ["Líquido", totals.net, "font-semibold"],
        ].map(([label, v, cls]) => (
          <div key={label as string} className="rounded-md bg-muted/60 px-3 py-2">
            <dt className="text-xs text-muted-foreground">{label as string}</dt>
            <dd className={cn("tabular", cls as string)}>{formatBRL(v as number)}</dd>
          </div>
        ))}
      </dl>
      <MovementList rows={rows.slice(0, FIRST)} />
      {rows.length > FIRST && (
        // <details>: o resto já veio do servidor, abrir não custa nova requisição nem JavaScript
        <details className="group">
          <summary className="flex cursor-pointer list-none items-center justify-center gap-1.5 rounded-md border py-2 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground group-open:mb-3 pointer-coarse:py-2.5 [&::-webkit-details-marker]:hidden">
            <span className="group-open:hidden">Ver mais {rows.length - FIRST} lançamentos</span>
            <span className="hidden group-open:inline">Mostrar menos</span>
            <ChevronDown className="size-4 transition-transform group-open:rotate-180" aria-hidden />
          </summary>
          <MovementList rows={rows.slice(FIRST)} />
        </details>
      )}
      <p className="text-xs text-muted-foreground">
        O dinheiro fica na sua conta do provedor ou do banco: saques e transferências são feitos por lá. Os totais somam os lançamentos desta lista, sem os de teste.
      </p>
    </div>
  );
}

/** Primeiros lançamentos à vista; o resto abre em "Ver mais" (página mais curta, sobretudo no celular). */
const FIRST = 10;

function MovementList({ rows }: { rows: Movement[] }) {
  return (
    <ul className="-my-2 divide-y">
      {rows.map((m) => {
        const out = m.cents < 0;
        return (
          <li key={m.id} className="flex items-center gap-3 py-2.5">
            <span className={cn("grid size-8 shrink-0 place-items-center rounded-full", out ? "bg-destructive/10 text-destructive" : "bg-success-soft text-success")} aria-hidden>
              {out ? <ArrowUpRight className="size-4" /> : <ArrowDownLeft className="size-4" />}
            </span>
            <div className="min-w-0 flex-1">
              <p className="flex min-w-0 items-start gap-1.5 text-sm font-medium">
                {m.isTest && <DemoBadge className="mt-px shrink-0" />}
                {/* celular: até 2 linhas (o nome do cliente aparece); computador: 1 linha */}
                <span className="line-clamp-2 sm:line-clamp-1">{m.description}</span>
              </p>
              <p className="truncate text-xs text-muted-foreground">
                {KIND[m.kind]}
                {m.where !== KIND[m.kind] && ` · ${m.where}`} · {formatDate(m.at, "time")}
              </p>
            </div>
            <span className={cn("shrink-0 font-semibold whitespace-nowrap tabular", out ? "text-destructive" : "text-success")}>
              {out ? "−" : "+"}
              {formatBRL(Math.abs(m.cents))}
            </span>
          </li>
        );
      })}
    </ul>
  );
}
