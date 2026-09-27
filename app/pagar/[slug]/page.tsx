import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { CheckCircle2, Clock3, Lock, XCircle } from "lucide-react";
import { MockPayButtons, StatusPoller } from "@/components/payments/pay-client";
import { Button } from "@/components/ui/button";
import { db } from "@/lib/db";
import { formatBRL, formatDate } from "@/lib/format";
import { METHOD_LABEL } from "@/lib/payments/types";

export const metadata: Metadata = { title: "Pagamento", robots: { index: false, follow: false } };

/**
 * Página que o CLIENTE FINAL abre para pagar. Pública, sem login e sem dados de CRM:
 * mostra só quem cobra, o que está sendo cobrado e o valor. Cartão e Pix são
 * digitados na página do provedor (Mercado Pago / Stripe), nunca aqui.
 */
export default async function PayPage(props: PageProps<"/pagar/[slug]">) {
  const { slug } = await props.params;
  const { status: hint } = await props.searchParams;
  const charge = await db.charge.findUnique({
    where: { slug },
    select: {
      slug: true,
      description: true,
      amountCents: true,
      methods: true,
      status: true,
      provider: true,
      isTest: true,
      paidAt: true,
      paidMethod: true,
      user: { select: { name: true, agencyName: true } },
    },
  });
  if (!charge) notFound();
  const seller = charge.user.agencyName ?? charge.user.name;
  const paid = charge.status === "PAID";
  const closed = ["FAILED", "EXPIRED", "CANCELED", "REFUNDED"].includes(charge.status);

  return (
    <main className="min-h-dvh bg-muted/50 px-4 py-10 sm:py-16">
      <StatusPoller slug={charge.slug} active={charge.status === "PENDING"} />
      <div className="mx-auto w-full max-w-md">
        {charge.isTest && (
          <p className="mb-4 rounded-md bg-demo-soft px-3 py-2 text-center text-xs font-medium text-demo">Ambiente de teste: nenhum dinheiro real é movimentado.</p>
        )}
        <div className="overflow-hidden rounded-xl border bg-card shadow-sm">
          <div className="border-b px-6 py-5">
            <p className="text-xs text-muted-foreground">Cobrança de</p>
            <p className="text-base font-semibold">{seller}</p>
          </div>
          <div className="px-6 py-6">
            <p className="text-sm text-muted-foreground">{charge.description}</p>
            <p className="mt-2 text-4xl font-semibold tracking-tight tabular">{formatBRL(charge.amountCents)}</p>
            <p className="mt-2 text-xs text-muted-foreground">Aceita: {charge.methods.map((m) => METHOD_LABEL[m] ?? m).join(" · ")}</p>

            <div className="mt-6">
              {paid ? (
                <div className="flex items-start gap-3 rounded-lg bg-success-soft p-4 text-success">
                  <CheckCircle2 className="mt-0.5 size-5 shrink-0" />
                  <div className="text-sm">
                    <p className="font-semibold">Pagamento confirmado</p>
                    <p className="mt-0.5 text-success/80">
                      {charge.paidMethod ? `${METHOD_LABEL[charge.paidMethod] ?? "Pagamento"} · ` : ""}
                      {charge.paidAt ? formatDate(charge.paidAt, "time") : ""}. {seller} já foi avisado.
                    </p>
                  </div>
                </div>
              ) : closed ? (
                <div className="flex items-start gap-3 rounded-lg bg-muted p-4 text-sm">
                  <XCircle className="mt-0.5 size-5 shrink-0 text-muted-foreground" />
                  <p>
                    Esta cobrança não está mais disponível ({charge.status === "CANCELED" ? "cancelada" : charge.status === "REFUNDED" ? "estornada" : charge.status === "EXPIRED" ? "expirada" : "pagamento recusado"}).
                    Fale com {seller} para receber um link novo.
                  </p>
                </div>
              ) : charge.provider === "mock" ? (
                <MockPayButtons slug={charge.slug} methods={charge.methods} />
              ) : (
                <>
                  {hint === "pendente" && (
                    <p className="mb-3 flex items-center gap-2 rounded-md bg-warning-soft px-3 py-2 text-sm text-warning">
                      <Clock3 className="size-4" /> Pagamento em processamento. Esta página atualiza sozinha.
                    </p>
                  )}
                  {(hint === "falhou" || hint === "indisponivel") && (
                    <p className="mb-3 rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
                      {hint === "falhou" ? "O pagamento não foi aprovado. Tente outro meio." : "O provedor não respondeu agora. Tente em instantes."}
                    </p>
                  )}
                  <Button asChild size="lg" className="h-12 w-full text-base">
                    <a href={`/api/public/pay/${charge.slug}`}>Pagar {formatBRL(charge.amountCents)}</a>
                  </Button>
                </>
              )}
            </div>
          </div>
          <div className="flex items-center gap-2 border-t bg-muted/40 px-6 py-3 text-xs text-muted-foreground">
            <Lock className="size-3.5" />
            {charge.provider === "mock"
              ? "Simulação: nenhum dado de cartão é pedido."
              : `Pagamento processado por ${charge.provider === "mercadopago" ? "Mercado Pago" : "Stripe"}. Seus dados de cartão não passam por aqui.`}
          </div>
        </div>
      </div>
    </main>
  );
}
