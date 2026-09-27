import { NextResponse, type NextRequest } from "next/server";
import { db } from "@/lib/db";
import { logger } from "@/lib/logger";
import { applyPaymentUpdate } from "@/lib/payments/service";
import { mapStripeEvent, stripeVerifySignature } from "@/lib/payments/stripe";

/** Webhook da Stripe (assinatura obrigatória, idempotente por event.id). */
export async function POST(request: NextRequest) {
  const raw = await request.text();
  if (!stripeVerifySignature(raw, request.headers.get("stripe-signature"))) return new NextResponse(null, { status: 401 });
  const event = JSON.parse(raw) as { id: string; type: string; account?: string; data: { object: Record<string, unknown> } };

  try {
    await db.webhookEvent.create({ data: { provider: "stripe", eventId: event.id } });
  } catch {
    return NextResponse.json({ duplicate: true });
  }

  try {
    if (event.type === "account.updated") {
      const acct = event.data.object as { id: string; charges_enabled?: boolean };
      await db.paymentAccount.updateMany({ where: { provider: "stripe", externalId: acct.id }, data: { status: acct.charges_enabled ? "ACTIVE" : "PENDING" } });
    } else {
      const update = await mapStripeEvent(event);
      if (update) await applyPaymentUpdate(update, { chargeId: update.chargeId, externalPaymentId: update.externalPaymentId });
    }
    await db.webhookEvent.update({ where: { provider_eventId: { provider: "stripe", eventId: event.id } }, data: { processedAt: new Date() } });
    return NextResponse.json({ ok: true });
  } catch (err) {
    logger.error("stripe: webhook falhou", { err: String(err), type: event.type });
    await db.webhookEvent.delete({ where: { provider_eventId: { provider: "stripe", eventId: event.id } } }).catch(() => {});
    return new NextResponse(null, { status: 500 });
  }
}
