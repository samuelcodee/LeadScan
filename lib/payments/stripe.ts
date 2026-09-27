import "server-only";
import { createHmac } from "node:crypto";
import { env } from "@/lib/env";
import { safeEqualStr } from "@/lib/crypto/secrets";
import type { ChargeForCheckout, CheckoutResult, CheckoutUrls, PaymentUpdate } from "@/lib/payments/types";

/**
 * Stripe Connect (contas Express) + Checkout Sessions, via REST (sem SDK).
 *  - Conexão: cria a conta conectada e manda o usuário para o onboarding hospedado da Stripe.
 *    https://docs.stripe.com/connect/express-accounts
 *  - Cobrança: destination charge — o valor vai para a conta do usuário; a plataforma
 *    pode reter `application_fee_amount` (PLATFORM_FEE_PERCENT).
 *    https://docs.stripe.com/connect/destination-charges
 *  - Pix: STRIPE_PIX=true (depende da sua conta Stripe Brasil ter Pix habilitado).
 *  - Confirmação: webhook com assinatura Stripe-Signature (HMAC-SHA256).
 */
const API = "https://api.stripe.com/v1";

export const stripeConfigured = () => Boolean(env().STRIPE_SECRET_KEY);

/** Form-encoding no formato da Stripe (a[b][c]=v). */
function encode(params: Record<string, unknown>, prefix = "", out = new URLSearchParams()) {
  for (const [k, v] of Object.entries(params)) {
    if (v === undefined || v === null) continue;
    const key = prefix ? `${prefix}[${k}]` : k;
    if (Array.isArray(v)) v.forEach((item, i) => (typeof item === "object" ? encode(item as Record<string, unknown>, `${key}[${i}]`, out) : out.append(`${key}[${i}]`, String(item))));
    else if (typeof v === "object") encode(v as Record<string, unknown>, key, out);
    else out.append(key, String(v));
  }
  return out;
}

async function stripe<T>(method: "GET" | "POST", path: string, params?: Record<string, unknown>, idempotencyKey?: string): Promise<T> {
  const url = method === "GET" && params ? `${API}${path}?${encode(params)}` : `${API}${path}`;
  const res = await fetch(url, {
    method,
    headers: {
      Authorization: `Bearer ${env().STRIPE_SECRET_KEY}`,
      ...(method === "POST" ? { "Content-Type": "application/x-www-form-urlencoded" } : {}),
      ...(idempotencyKey ? { "Idempotency-Key": idempotencyKey } : {}),
    },
    body: method === "POST" && params ? encode(params) : undefined,
    signal: AbortSignal.timeout(20_000),
    cache: "no-store",
  });
  const json = (await res.json()) as T & { error?: { message?: string } };
  if (!res.ok) throw new Error(`Stripe: ${json.error?.message ?? res.status}`);
  return json;
}

export async function stripeCreateAccount(userId: string, email: string | null) {
  return stripe<{ id: string }>("POST", "/accounts", {
    type: "express",
    country: "BR",
    email: email ?? undefined,
    capabilities: { card_payments: { requested: true }, transfers: { requested: true } },
    metadata: { userId },
  });
}

export async function stripeOnboardingLink(accountId: string, returnUrl: string, refreshUrl: string) {
  return stripe<{ url: string }>("POST", "/account_links", { account: accountId, return_url: returnUrl, refresh_url: refreshUrl, type: "account_onboarding" });
}

export async function stripeAccountStatus(accountId: string) {
  const a = await stripe<{ id: string; charges_enabled: boolean; details_submitted: boolean }>("GET", `/accounts/${accountId}`);
  return { chargesEnabled: a.charges_enabled, detailsSubmitted: a.details_submitted };
}

export async function stripeCreateCheckout(destination: string, charge: ChargeForCheckout, urls: CheckoutUrls): Promise<CheckoutResult> {
  const methods = ["card", ...(env().STRIPE_PIX && charge.methods.includes("pix") ? ["pix"] : [])];
  const s = await stripe<{ id: string; url: string; livemode: boolean; expires_at: number }>(
    "POST",
    "/checkout/sessions",
    {
      mode: "payment",
      success_url: urls.success,
      cancel_url: urls.failure,
      client_reference_id: charge.id,
      metadata: { chargeId: charge.id },
      locale: "pt-BR",
      payment_method_types: methods,
      line_items: [{ quantity: 1, price_data: { currency: "brl", unit_amount: charge.amountCents, product_data: { name: charge.description.slice(0, 250) } } }],
      payment_intent_data: {
        transfer_data: { destination },
        metadata: { chargeId: charge.id },
        ...(charge.feeCents > 0 ? { application_fee_amount: charge.feeCents } : {}),
      },
    },
    `cs-${charge.id}-${Math.floor(Date.now() / 3_600_000)}`,
  );
  return { checkoutUrl: s.url, externalId: s.id, isTest: !s.livemode, expiresAt: new Date(s.expires_at * 1000) };
}

/** Verifica Stripe-Signature: t=timestamp,v1=assinatura (tolerância de 5 min). */
export function stripeVerifySignature(rawBody: string, header: string | null) {
  const secret = env().STRIPE_WEBHOOK_SECRET;
  if (!secret || !header) return false;
  const items = header.split(",").map((p) => p.split("=", 2));
  const t = items.find(([k]) => k === "t")?.[1];
  const sigs = items.filter(([k]) => k === "v1").map(([, v]) => v);
  if (!t || !sigs.length) return false;
  if (Math.abs(Date.now() / 1000 - Number(t)) > 300) return false;
  const expected = createHmac("sha256", secret).update(`${t}.${rawBody}`).digest("hex");
  return sigs.some((s) => safeEqualStr(expected, s));
}

type Session = {
  id: string;
  client_reference_id?: string | null;
  metadata?: Record<string, string>;
  payment_status: "paid" | "unpaid" | "no_payment_required";
  payment_intent?: string | null;
  amount_total?: number | null;
  livemode: boolean;
};

/** Descobre o meio usado (Pix, crédito ou débito) consultando o PaymentIntent. */
async function paymentMethodOf(paymentIntentId: string | null | undefined) {
  if (!paymentIntentId) return null;
  try {
    const pi = await stripe<{ latest_charge?: { payment_method_details?: { type?: string; card?: { funding?: string } } } }>(
      "GET",
      `/payment_intents/${paymentIntentId}`,
      { expand: ["latest_charge"] },
    );
    const d = pi.latest_charge?.payment_method_details;
    if (d?.type === "pix") return "pix";
    if (d?.type === "card") return d.card?.funding === "debit" ? "debit_card" : "credit_card";
    return "other";
  } catch {
    return null;
  }
}

export async function mapStripeEvent(event: { type: string; data: { object: unknown } }): Promise<PaymentUpdate | null> {
  const base = { feeCents: null, netCents: null } as const;
  if (event.type.startsWith("checkout.session.")) {
    const s = event.data.object as Session;
    const chargeId = s.client_reference_id ?? s.metadata?.chargeId ?? null;
    const status =
      event.type === "checkout.session.async_payment_failed"
        ? "FAILED"
        : event.type === "checkout.session.expired"
          ? "EXPIRED"
          : s.payment_status === "paid"
            ? "PAID"
            : "PENDING";
    return {
      ...base,
      chargeId,
      externalPaymentId: s.payment_intent ?? null,
      status,
      method: status === "PAID" ? await paymentMethodOf(s.payment_intent) : null,
      amountCents: s.amount_total ?? null,
      paidAt: status === "PAID" ? new Date() : null,
      isTest: !s.livemode,
    };
  }
  if (event.type === "charge.refunded") {
    const c = event.data.object as { payment_intent?: string; refunded?: boolean; livemode: boolean; metadata?: Record<string, string> };
    if (!c.refunded) return null;
    return { ...base, chargeId: c.metadata?.chargeId ?? null, externalPaymentId: c.payment_intent ?? null, status: "REFUNDED", method: null, amountCents: null, paidAt: null, isTest: !c.livemode };
  }
  return null;
}
