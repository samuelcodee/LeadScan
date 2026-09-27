import "server-only";
import { createHmac } from "node:crypto";
import { env } from "@/lib/env";
import type { ChargeStatus } from "@/lib/generated/prisma/client";
import { safeEqualStr } from "@/lib/crypto/secrets";
import type { AccountSecrets, ChargeForCheckout, CheckoutResult, CheckoutUrls, PaymentUpdate } from "@/lib/payments/types";

/**
 * Mercado Pago — modelo marketplace.
 *  - Conexão: OAuth (o usuário autoriza a plataforma a criar cobranças na conta DELE).
 *    https://www.mercadopago.com.br/developers/pt/docs/security/oauth
 *  - Cobrança: Checkout Pro (preferência) → Pix, cartão de crédito e débito na página do MP.
 *    https://www.mercadopago.com.br/developers/pt/reference/preferences/_checkout_preferences/post
 *  - Confirmação: webhook assinado (x-signature) + consulta GET /v1/payments/{id}.
 *  - Comissão opcional da plataforma: `marketplace_fee` (PLATFORM_FEE_PERCENT).
 */
const API = "https://api.mercadopago.com";

export const mercadoPagoConfigured = () => Boolean(env().MP_CLIENT_ID && env().MP_CLIENT_SECRET);

export function mpAuthorizeUrl(state: string, redirectUri: string) {
  const p = new URLSearchParams({ client_id: env().MP_CLIENT_ID, response_type: "code", platform_id: "mp", state, redirect_uri: redirectUri });
  return `https://auth.mercadopago.com/authorization?${p}`;
}

type TokenResponse = {
  access_token: string;
  refresh_token?: string;
  public_key?: string;
  user_id: number;
  expires_in?: number;
  live_mode?: boolean;
};

async function tokenRequest(body: Record<string, string>) {
  const res = await fetch(`${API}/oauth/token`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify({ client_id: env().MP_CLIENT_ID, client_secret: env().MP_CLIENT_SECRET, ...body }),
    signal: AbortSignal.timeout(15_000),
  });
  if (!res.ok) throw new Error(`Mercado Pago OAuth respondeu ${res.status}`);
  return (await res.json()) as TokenResponse;
}

export function mpExchangeCode(code: string, redirectUri: string) {
  return tokenRequest({ grant_type: "authorization_code", code, redirect_uri: redirectUri });
}

export function mpRefresh(refreshToken: string) {
  return tokenRequest({ grant_type: "refresh_token", refresh_token: refreshToken });
}

export async function mpCreateCheckout(account: AccountSecrets, charge: ChargeForCheckout, urls: CheckoutUrls): Promise<CheckoutResult> {
  if (!account.accessToken) throw new Error("Conta Mercado Pago sem token.");
  const excluded = [
    { id: "ticket" }, // boleto: compensação lenta, fora do fluxo "pagou → fechou"
    { id: "atm" },
    ...(charge.methods.includes("pix") ? [] : [{ id: "bank_transfer" }]),
    ...(charge.methods.includes("credit_card") ? [] : [{ id: "credit_card" }]),
    ...(charge.methods.includes("debit_card") ? [] : [{ id: "debit_card" }]),
  ];
  const res = await fetch(`${API}/checkout/preferences`, {
    method: "POST",
    headers: { Authorization: `Bearer ${account.accessToken}`, "Content-Type": "application/json", "X-Idempotency-Key": `pref-${charge.id}` },
    body: JSON.stringify({
      items: [{ id: charge.id, title: charge.description.slice(0, 250), quantity: 1, currency_id: "BRL", unit_price: charge.amountCents / 100 }],
      external_reference: charge.id,
      notification_url: `${urls.base}/api/webhooks/mercadopago`,
      back_urls: { success: urls.success, pending: urls.pending, failure: urls.failure },
      auto_return: "approved",
      payment_methods: { excluded_payment_types: excluded, installments: 12 },
      ...(charge.feeCents > 0 ? { marketplace_fee: charge.feeCents / 100 } : {}),
      metadata: { charge_id: charge.id },
    }),
    signal: AbortSignal.timeout(15_000),
  });
  if (res.status === 401) throw new Error("MP_UNAUTHORIZED");
  if (!res.ok) throw new Error(`Mercado Pago respondeu ${res.status} ao criar a cobrança.`);
  const pref = (await res.json()) as { id: string; init_point: string; sandbox_init_point?: string };
  const useSandbox = !account.livemode && pref.sandbox_init_point;
  return { checkoutUrl: useSandbox ? pref.sandbox_init_point! : pref.init_point, externalId: pref.id, isTest: !account.livemode };
}

/**
 * Valida a assinatura do webhook. Manifesto documentado pelo MP:
 *   id:[data.id];request-id:[x-request-id];ts:[ts];   (partes ausentes são omitidas)
 * https://www.mercadopago.com.br/developers/pt/docs/your-integrations/notifications/webhooks
 */
export function mpVerifySignature(opts: { signature: string | null; requestId: string | null; dataId: string | null }) {
  const secret = env().MP_WEBHOOK_SECRET;
  if (!secret) return env().NODE_ENV !== "production"; // sem segredo: só aceitamos fora de produção
  if (!opts.signature) return false;
  const parts = Object.fromEntries(opts.signature.split(",").map((p) => p.trim().split("=", 2) as [string, string]));
  if (!parts.ts || !parts.v1) return false;
  const id = opts.dataId && /^[a-z0-9]+$/i.test(opts.dataId) ? opts.dataId.toLowerCase() : opts.dataId;
  let manifest = "";
  if (id) manifest += `id:${id};`;
  if (opts.requestId) manifest += `request-id:${opts.requestId};`;
  manifest += `ts:${parts.ts};`;
  const expected = createHmac("sha256", secret).update(manifest).digest("hex");
  return safeEqualStr(expected, parts.v1);
}

const STATUS: Record<string, ChargeStatus> = {
  approved: "PAID",
  authorized: "PENDING",
  pending: "PENDING",
  in_process: "PENDING",
  in_mediation: "PENDING",
  rejected: "FAILED",
  cancelled: "CANCELED",
  refunded: "REFUNDED",
  charged_back: "REFUNDED",
};

type MpPayment = {
  id: number;
  status: string;
  external_reference?: string | null;
  payment_type_id?: string;
  payment_method_id?: string;
  transaction_amount?: number;
  fee_details?: { amount: number }[];
  transaction_details?: { net_received_amount?: number };
  date_approved?: string | null;
  live_mode?: boolean;
};

export function mapMpPayment(p: MpPayment): PaymentUpdate {
  const method =
    p.payment_method_id === "pix" || p.payment_type_id === "bank_transfer"
      ? "pix"
      : p.payment_type_id === "credit_card"
        ? "credit_card"
        : p.payment_type_id === "debit_card" || p.payment_type_id === "prepaid_card"
          ? "debit_card"
          : "other";
  const cents = (v?: number) => (typeof v === "number" ? Math.round(v * 100) : null);
  return {
    chargeId: p.external_reference ?? null,
    externalPaymentId: String(p.id),
    status: STATUS[p.status] ?? "PENDING",
    method,
    amountCents: cents(p.transaction_amount),
    feeCents: p.fee_details ? Math.round(p.fee_details.reduce((a, f) => a + f.amount, 0) * 100) : null,
    netCents: cents(p.transaction_details?.net_received_amount),
    paidAt: p.date_approved ? new Date(p.date_approved) : null,
    isTest: p.live_mode === false,
  };
}

export async function mpFetchPayment(accessToken: string, paymentId: string) {
  const res = await fetch(`${API}/v1/payments/${encodeURIComponent(paymentId)}`, {
    headers: { Authorization: `Bearer ${accessToken}` },
    signal: AbortSignal.timeout(15_000),
    cache: "no-store",
  });
  if (res.status === 401) throw new Error("MP_UNAUTHORIZED");
  if (!res.ok) throw new Error(`Mercado Pago respondeu ${res.status} ao consultar pagamento.`);
  return mapMpPayment((await res.json()) as MpPayment);
}
