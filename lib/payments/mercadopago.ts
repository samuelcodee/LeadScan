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
  if (!res.ok) {
    const raw = await res.text().catch(() => "");
    let err: { error?: string; message?: string } = {};
    try {
      err = JSON.parse(raw);
    } catch {}
    throw new MpOAuthError(classifyOAuth(res.status, err), `${res.status} ${err.error ?? ""} ${err.message ?? raw.slice(0, 200)}`.trim());
  }
  return (await res.json()) as TokenResponse;
}

/**
 * Falha do OAuth com a causa separada, para a tela dizer o que ajustar (e o log guardar a resposta):
 *  - credenciais: Client ID/Secret errados ou de teste
 *  - redirect: a Redirect URL da aplicação no MP não bate com NEXT_PUBLIC_APP_URL
 *  - codigo: autorização expirou ou já foi usada (é só tentar de novo)
 */
export type MpOAuthCause = "credenciais" | "redirect" | "codigo" | "outro";
export class MpOAuthError extends Error {
  constructor(
    readonly cause: MpOAuthCause,
    readonly detail: string,
  ) {
    super(`Mercado Pago OAuth: ${detail}`);
  }
}

export function classifyOAuth(status: number, err: { error?: string; message?: string }): MpOAuthCause {
  const text = `${err.error ?? ""} ${err.message ?? ""}`.toLowerCase();
  if (text.includes("redirect")) return "redirect";
  if (status === 401 || text.includes("invalid_client") || text.includes("client_id") || text.includes("client_secret") || text.includes("credential")) return "credenciais";
  if (text.includes("invalid_grant") || text.includes("code")) return "codigo";
  return "outro";
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
 * Pix na hora: cria o pagamento Pix direto na API (POST /v1/payments) com o token do vendedor.
 * Volta o "copia e cola" (o QR é desenhado a partir dele), sem passar pela página do MP.
 * A confirmação é a mesma do checkout: webhook "payment" + external_reference = id da cobrança.
 * O MP exige e-mail do pagador; sem o do cliente, usamos um endereço técnico da cobrança
 * (o pagador real é quem ler o QR no app do banco).
 * https://www.mercadopago.com.br/developers/pt/reference/payments/_payments/post
 */
export async function mpCreatePix(
  account: AccountSecrets,
  charge: ChargeForCheckout,
  opts: { base: string; payerEmail: string; hours?: number },
): Promise<{ paymentId: string; qrCode: string; expiresAt: Date }> {
  if (!account.accessToken) throw new Error("Conta Mercado Pago sem token.");
  const expiresAt = new Date(Date.now() + (opts.hours ?? 72) * 60 * 60 * 1000);
  const res = await fetch(`${API}/v1/payments`, {
    method: "POST",
    headers: { Authorization: `Bearer ${account.accessToken}`, "Content-Type": "application/json", "X-Idempotency-Key": `pix-${charge.id}` },
    body: JSON.stringify({
      transaction_amount: charge.amountCents / 100,
      description: charge.description.slice(0, 250),
      payment_method_id: "pix",
      payer: { email: opts.payerEmail },
      external_reference: charge.id,
      notification_url: `${opts.base}/api/webhooks/mercadopago`,
      date_of_expiration: expiresAt.toISOString().replace("Z", "+00:00"),
      ...(charge.feeCents > 0 ? { application_fee: charge.feeCents / 100 } : {}),
      metadata: { charge_id: charge.id },
    }),
    signal: AbortSignal.timeout(15_000),
  });
  if (res.status === 401) throw new Error("MP_UNAUTHORIZED");
  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    // Conta sem chave Pix no Mercado Pago é o caso mais comum: o MP recusa o meio "pix"
    if (/pix|bank_transfer|payment_method|collector/i.test(detail)) throw new MpPixUnavailableError(detail.slice(0, 300));
    throw new Error(`Mercado Pago respondeu ${res.status} ao criar o Pix: ${detail.slice(0, 300)}`);
  }
  const p = (await res.json()) as { id: number; point_of_interaction?: { transaction_data?: { qr_code?: string } } };
  const qrCode = p.point_of_interaction?.transaction_data?.qr_code;
  if (!qrCode) throw new Error("Mercado Pago não devolveu o código Pix.");
  return { paymentId: String(p.id), qrCode, expiresAt };
}

export class MpPixUnavailableError extends Error {}

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
