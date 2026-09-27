"use client";

import { Ban, CheckCircle2, Copy, ExternalLink, MoreHorizontal } from "lucide-react";
import Link from "next/link";
import { toast } from "sonner";
import { cancelChargeAction, confirmPixChargeAction } from "@/app/actions/finance";
import { DemoBadge } from "@/components/common/page-header";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { formatBRL, formatDate } from "@/lib/format";
import { cn } from "@/lib/utils";

export type ChargeRow = {
  id: string;
  slug: string;
  description: string;
  amountCents: number;
  status: string;
  provider: string;
  paidMethod: string | null;
  netCents: number | null;
  isTest: boolean;
  paidAt: Date | null;
  createdAt: Date;
  lead: { id: string; name: string; isDemo: boolean } | null;
  bankAccount?: { bankName: string } | null;
};

const STATUS: Record<string, { label: string; className: string }> = {
  PENDING: { label: "Aguardando", className: "bg-warning-soft text-warning" },
  PAID: { label: "Pago", className: "bg-success-soft text-success" },
  FAILED: { label: "Recusado", className: "bg-destructive/10 text-destructive" },
  EXPIRED: { label: "Expirado", className: "bg-muted text-muted-foreground" },
  CANCELED: { label: "Cancelado", className: "bg-muted text-muted-foreground" },
  REFUNDED: { label: "Estornado", className: "bg-muted text-muted-foreground" },
};

const METHOD: Record<string, string> = { pix: "Pix", credit_card: "Crédito", debit_card: "Débito", other: "Outro" };
const PROVIDER: Record<string, string> = { mock: "Teste", mercadopago: "Mercado Pago", stripe: "Stripe", pix: "Pix direto" };

async function confirmPix(c: ChargeRow) {
  const r = await confirmPixChargeAction({ id: c.id });
  if (r.ok) toast.success("Recebimento confirmado. A venda entrou no seu financeiro.");
  else toast.error(r.error);
}

export function ChargesTable({ rows, baseUrl }: { rows: ChargeRow[]; baseUrl: string }) {
  if (!rows.length) return <p className="py-6 text-center text-sm text-muted-foreground">Nenhuma cobrança ainda. Crie a primeira pelo botão “Cobrar”.</p>;
  // Lista (não tabela): no celular valor, status e ações ficam sempre à vista; no computador,
  // cada coisa na sua coluna sem quebrar valor e data em várias linhas.
  return (
    <ul className="-mx-5 -my-2 divide-y">
      {rows.map((c) => {
        const st = STATUS[c.status] ?? STATUS.PENDING;
        const url = `${baseUrl}/pagar/${c.slug}`;
        const when = formatDate(c.paidAt ?? c.createdAt, "time");
        const method = c.paidMethod ? METHOD[c.paidMethod] : null;
        const chip = <span className={cn("inline-flex h-6 shrink-0 items-center rounded-full px-2.5 text-xs font-medium", st.className)}>{st.label}</span>;
        return (
          <li key={c.id} className="flex items-start gap-3 px-5 py-3 text-sm">
            <div className="min-w-0 flex-1">
              <div className="flex min-w-0 items-center gap-1.5">
                {(c.isTest || c.lead?.isDemo) && <DemoBadge className="shrink-0" />}
                {c.lead ? (
                  <Link href={`/leads/${c.lead.id}`} className="truncate font-medium hover:underline">
                    {c.lead.name}
                  </Link>
                ) : (
                  <span className="truncate font-medium">Sem lead</span>
                )}
              </div>
              <p className="truncate text-xs text-muted-foreground">
                {c.description} · {PROVIDER[c.provider] ?? c.provider}
                {c.provider === "pix" && c.bankAccount ? ` (${c.bankAccount.bankName})` : ""}
              </p>
              {/* celular: status, meio e data numa linha só embaixo */}
              <div className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground sm:hidden">
                {chip}
                {method && <span>{method}</span>}
                <span className="tabular">{when}</span>
              </div>
              {c.provider === "pix" && c.status === "PENDING" && (
                <Button size="sm" variant="outline" className="mt-2" onClick={() => void confirmPix(c)}>
                  <CheckCircle2 /> Já caiu na conta? Marcar como recebido
                </Button>
              )}
            </div>
            <div className="hidden w-24 shrink-0 pt-0.5 sm:block">{chip}</div>
            {/* largura fixa no computador: a coluna de status fica alinhada de cima a baixo */}
            <div className="shrink-0 text-right sm:w-36">
              <p className="font-semibold whitespace-nowrap tabular">{formatBRL(c.amountCents)}</p>
              {c.netCents !== null && c.status === "PAID" && c.netCents !== c.amountCents && (
                <p className="text-xs whitespace-nowrap text-muted-foreground tabular">líq. {formatBRL(c.netCents)}</p>
              )}
              <p className="hidden text-xs whitespace-nowrap text-muted-foreground sm:block">
                {method ? `${method} · ` : ""}
                <span className="tabular">{when}</span>
              </p>
            </div>
            <div className="-mr-2 -mt-1 shrink-0">
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="icon-sm" aria-label={`Ações da cobrança ${c.description}`}>
                    <MoreHorizontal />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onSelect={() => navigator.clipboard.writeText(url).then(() => toast.success("Link copiado"))}>
                    <Copy /> Copiar link
                  </DropdownMenuItem>
                  <DropdownMenuItem asChild>
                    <a href={url} target="_blank" rel="noopener noreferrer">
                      <ExternalLink /> Abrir página de pagamento
                    </a>
                  </DropdownMenuItem>
                  {c.provider === "pix" && c.status === "PENDING" && (
                    <DropdownMenuItem onSelect={() => void confirmPix(c)}>
                      <CheckCircle2 /> Marcar como recebido
                    </DropdownMenuItem>
                  )}
                  {c.status === "PENDING" && (
                    <DropdownMenuItem
                      variant="destructive"
                      onSelect={async () => {
                        const r = await cancelChargeAction({ id: c.id });
                        if (r.ok) toast.success("Cobrança cancelada");
                        else toast.error(r.error);
                      }}
                    >
                      <Ban /> Cancelar cobrança
                    </DropdownMenuItem>
                  )}
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </li>
        );
      })}
    </ul>
  );
}
