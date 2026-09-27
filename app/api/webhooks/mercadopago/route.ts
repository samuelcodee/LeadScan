import { NextResponse, type NextRequest } from "next/server";
import { db } from "@/lib/db";
import { logger } from "@/lib/logger";
import { mpFetchPayment, mpVerifySignature } from "@/lib/payments/mercadopago";
import { accountSecretsForWebhook, applyPaymentUpdate } from "@/lib/payments/service";
import { rateLimit } from "@/lib/rate-limit";

/**
 * Webhook do Mercado Pago. Nunca confiamos no corpo: validamos a assinatura e
 * consultamos o pagamento na API com o token do vendedor dono da cobrança.
 */
export async function POST(request: NextRequest) {
  if (!rateLimit("webhook", "mercadopago").ok) return new NextResponse(null, { status: 429 });
  const url = request.nextUrl;
  let body: { type?: string; action?: string; data?: { id?: string | number }; user_id?: number | string } = {};
  try {
    body = await request.json();
  } catch {
    // alguns eventos chegam só com query string
  }
  const type = body.type ?? url.searchParams.get("type") ?? url.searchParams.get("topic");
  const dataId = url.searchParams.get("data.id") ?? (body.data?.id !== undefined ? String(body.data.id) : null);
  const requestId = request.headers.get("x-request-id");

  if (!mpVerifySignature({ signature: request.headers.get("x-signature"), requestId, dataId })) {
    logger.warn("mercadopago: assinatura inválida");
    return new NextResponse(null, { status: 401 });
  }
  if (type !== "payment" || !dataId || body.user_id === undefined) return NextResponse.json({ ignored: true });

  const eventId = `${dataId}:${requestId ?? body.action ?? "sem-id"}`;
  try {
    await db.webhookEvent.create({ data: { provider: "mercadopago", eventId } });
  } catch {
    return NextResponse.json({ duplicate: true }); // já processado
  }

  try {
    const account = await accountSecretsForWebhook("mercadopago", String(body.user_id));
    if (!account?.accessToken) throw new Error("conta do vendedor não encontrada");
    const update = await mpFetchPayment(account.accessToken, dataId);
    const result = await applyPaymentUpdate(update, { chargeId: update.chargeId, externalPaymentId: update.externalPaymentId });
    await db.webhookEvent.update({ where: { provider_eventId: { provider: "mercadopago", eventId } }, data: { processedAt: new Date() } });
    return NextResponse.json({ ok: true, applied: result.applied });
  } catch (err) {
    logger.error("mercadopago: webhook falhou", { err: String(err) });
    await db.webhookEvent.update({ where: { provider_eventId: { provider: "mercadopago", eventId } }, data: { error: String(err).slice(0, 300) } });
    // 500 → o Mercado Pago tenta de novo; removemos a trava para aceitar a nova tentativa
    await db.webhookEvent.delete({ where: { provider_eventId: { provider: "mercadopago", eventId } } }).catch(() => {});
    return new NextResponse(null, { status: 500 });
  }
}
