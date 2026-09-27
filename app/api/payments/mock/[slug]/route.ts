import { NextResponse, type NextRequest } from "next/server";
import { db } from "@/lib/db";
import { mockPaymentsEnabled } from "@/lib/env";
import { applyPaymentUpdate } from "@/lib/payments/service";
import { rateLimit } from "@/lib/rate-limit";

/**
 * Checkout SIMULADO (provedor "mock"): confirma o pagamento na hora, sem dinheiro de
 * verdade e sem nenhum dado de cartão. Só existe com PAYMENTS_MOCK ligado (modo demo).
 * Tarifas simuladas para o financeiro ficar realista: Pix 0,99% · débito 1,99% · crédito 4,98%.
 */
const FEES: Record<string, number> = { pix: 0.0099, debit_card: 0.0199, credit_card: 0.0498 };

export async function POST(request: NextRequest, ctx: RouteContext<"/api/payments/mock/[slug]">) {
  if (!mockPaymentsEnabled()) return NextResponse.json({ error: "Pagamentos de teste desligados." }, { status: 404 });
  const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "local";
  if (!rateLimit("payment", ip).ok) return NextResponse.json({ error: "Muitas tentativas. Aguarde um pouco." }, { status: 429 });

  const { slug } = await ctx.params;
  const { method } = (await request.json().catch(() => ({}))) as { method?: string };
  const charge = await db.charge.findUnique({ where: { slug } });
  if (!charge || charge.provider !== "mock") return NextResponse.json({ error: "Cobrança não encontrada." }, { status: 404 });
  if (!method || !charge.methods.includes(method)) return NextResponse.json({ error: "Meio de pagamento indisponível." }, { status: 400 });
  if (charge.status !== "PENDING") return NextResponse.json({ status: charge.status });

  const feeCents = Math.round(charge.amountCents * (FEES[method] ?? 0.03));
  const result = await applyPaymentUpdate(
    {
      chargeId: charge.id,
      externalPaymentId: `mock_pay_${charge.slug}`,
      status: "PAID",
      method,
      amountCents: charge.amountCents,
      feeCents,
      netCents: charge.amountCents - feeCents,
      paidAt: new Date(),
      isTest: true,
    },
    { chargeId: charge.id },
  );
  return NextResponse.json({ status: "PAID", applied: result.applied });
}
