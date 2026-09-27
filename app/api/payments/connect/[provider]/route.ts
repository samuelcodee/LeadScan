import { randomBytes } from "node:crypto";
import { NextResponse, type NextRequest } from "next/server";
import { getCurrentUser } from "@/lib/auth/session";
import { signValue } from "@/lib/auth/token";
import { logger } from "@/lib/logger";
import { mercadoPagoConfigured, mpAuthorizeUrl } from "@/lib/payments/mercadopago";
import { saveAccount } from "@/lib/payments/service";
import { stripeConfigured, stripeCreateAccount, stripeOnboardingLink } from "@/lib/payments/stripe";
import { appUrl } from "@/lib/prototypes/service";
import { db } from "@/lib/db";
import { mockPaymentsEnabled } from "@/lib/env";

const STATE_COOKIE = "ls_pay_state";

/** Começa a conexão da conta de recebimento (OAuth do Mercado Pago / onboarding da Stripe). */
export async function GET(request: NextRequest, ctx: RouteContext<"/api/payments/connect/[provider]">) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.redirect(new URL("/login?next=/financeiro", request.url));
  const { provider } = await ctx.params;
  const back = (q: string) => NextResponse.redirect(new URL(`/financeiro?${q}`, request.url));
  const base = await appUrl();

  try {
    if (provider === "mock") {
      if (!mockPaymentsEnabled()) return back("erro=mock-desligado");
      await saveAccount(user.id, "mock", { status: "ACTIVE", externalId: `mock_${user.id}` });
      return back("conectado=mock");
    }

    if (provider === "mercadopago") {
      if (!mercadoPagoConfigured()) return back("erro=mercadopago-indisponivel");
      const nonce = randomBytes(16).toString("base64url");
      const res = NextResponse.redirect(mpAuthorizeUrl(nonce, `${base}/api/payments/connect/mercadopago/callback`));
      res.cookies.set(STATE_COOKIE, await signValue(`${user.id}:${nonce}`), {
        httpOnly: true,
        sameSite: "lax",
        secure: process.env.NODE_ENV === "production",
        path: "/api/payments/connect",
        maxAge: 900,
      });
      return res;
    }

    if (provider === "stripe") {
      if (!stripeConfigured()) return back("erro=stripe-indisponivel");
      const existing = await db.paymentAccount.findUnique({ where: { userId_provider: { userId: user.id, provider: "stripe" } } });
      const accountId = existing?.externalId ?? (await stripeCreateAccount(user.id, user.email)).id;
      if (!existing?.externalId) await saveAccount(user.id, "stripe", { status: "PENDING", externalId: accountId, livemode: !process.env.STRIPE_SECRET_KEY?.startsWith("sk_test") });
      const link = await stripeOnboardingLink(accountId, `${base}/api/payments/connect/stripe/callback`, `${base}/api/payments/connect/stripe`);
      return NextResponse.redirect(link.url);
    }
  } catch (err) {
    logger.error("conexão de pagamento falhou", { provider, err: String(err) });
    return back(`erro=${provider}-falhou`);
  }
  return back("erro=provedor-desconhecido");
}
