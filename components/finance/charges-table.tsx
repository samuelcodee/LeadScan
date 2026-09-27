"use client";

import { Ban, Copy, ExternalLink, MoreHorizontal } from "lucide-react";
import Link from "next/link";
import { toast } from "sonner";
import { cancelChargeAction } from "@/app/actions/finance";
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
const PROVIDER: Record<string, string> = { mock: "Teste", mercadopago: "Mercado Pago", stripe: "Stripe" };

export function ChargesTable({ rows, baseUrl }: { rows: ChargeRow[]; baseUrl: string }) {
  if (!rows.length) return <p className="py-6 text-center text-sm text-muted-foreground">Nenhuma cobrança ainda. Crie a primeira pelo botão “Cobrar”.</p>;
  return (
    <div className="relative -mx-5 overflow-x-auto">
      <table className="w-full min-w-[640px] text-sm">
        <thead>
          <tr className="border-b text-left text-xs text-muted-foreground">
            <th className="px-5 py-2 font-medium">Cliente / descrição</th>
            <th className="px-3 py-2 font-medium">Status</th>
            <th className="px-3 py-2 text-right font-medium">Valor</th>
            <th className="px-3 py-2 font-medium">Meio</th>
            <th className="px-3 py-2 font-medium">Data</th>
            <th className="w-12 px-5 py-2">
              <span className="sr-only">Ações</span>
            </th>
          </tr>
        </thead>
        <tbody className="divide-y">
          {rows.map((c) => {
            const st = STATUS[c.status] ?? STATUS.PENDING;
            const url = `${baseUrl}/pagar/${c.slug}`;
            return (
              <tr key={c.id} className="align-middle">
                <td className="max-w-[260px] px-5 py-2.5">
                  <div className="flex items-center gap-1.5">
                    {(c.isTest || c.lead?.isDemo) && <DemoBadge />}
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
                  </p>
                </td>
                <td className="px-3 py-2.5">
                  <span className={cn("inline-flex h-6 items-center rounded-full px-2.5 text-xs font-medium", st.className)}>{st.label}</span>
                </td>
                <td className="px-3 py-2.5 text-right">
                  <span className="font-semibold tabular">{formatBRL(c.amountCents)}</span>
                  {c.netCents !== null && c.status === "PAID" && <p className="text-xs text-muted-foreground tabular">líq. {formatBRL(c.netCents)}</p>}
                </td>
                <td className="px-3 py-2.5 text-muted-foreground">{c.paidMethod ? METHOD[c.paidMethod] : "—"}</td>
                <td className="px-3 py-2.5 text-muted-foreground tabular">{formatDate(c.paidAt ?? c.createdAt, "time")}</td>
                <td className="px-5 py-2.5 text-right">
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
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
