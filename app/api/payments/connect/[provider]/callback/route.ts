import { NextResponse, type NextRequest } from "next/server";
import { getCurrentUser } from "@/lib/auth/session";
import { safeEqual, unsignValue } from "@/lib/auth/token";
import { db } from "@/lib/db";
import { logger } from "@/lib/logger";
import { mpExchangeCode } from "@/lib/payments/mercadopago";
import { saveAccount } from "@/lib/payments/service";
import { stripeAccountStatus } from "@/lib/payments/stripe";
import { appUrl } from "@/lib/prototypes/service";

const STATE_COOKIE = "ls_pay_state";

/** Retorno do provedor depois que o usuário autorizou (ou terminou o cadastro). */
export async function GET(request: NextRequest, ctx: RouteContext<"/api/payments/connect/[provider]/callback">) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.redirect(new URL("/login?next=/financeiro", request.url));
  const { provider } = await ctx.params;
  const back = (q: string) => {
    const res = NextResponse.redirect(new URL(`/financeiro?${q}`, request.url));
    res.cookies.delete({ name: STATE_COOKIE, path: "/api/payments/connect" });
    return res;
  };

  try {
    if (provider === "mercadopago") {
      const code = request.nextUrl.searchParams.get("code");
      const state = request.nextUrl.searchParams.get("state") ?? "";
      const saved = await unsignValue(request.cookies.get(STATE_COOKIE)?.value);
      const [uid, nonce] = saved?.split(":") ?? [];
      if (!code || !nonce || uid !== user.id || !safeEqual(state, nonce)) return back("erro=mercadopago-estado");
      const t = await mpExchangeCode(code, `${await appUrl()}/api/payments/connect/mercadopago/callback`);
      // A mesma conta MP não pode receber por dois usuários da plataforma
      const owner = await db.paymentAccount.findFirst({ where: { provider: "mercadopago", externalId: String(t.user_id), NOT: { userId: user.id } } });
      if (owner) return back("erro=mercadopago-em-uso");
      await saveAccount(user.id, "mercadopago", {
        status: "ACTIVE",
        externalId: String(t.user_id),
        accessToken: t.access_token,
        refreshToken: t.refresh_token,
        publicKey: t.public_key,
        livemode: t.live_mode ?? true,
        expiresInSec: t.expires_in,
      });
      return back("conectado=mercadopago");
    }

    if (provider === "stripe") {
      const account = await db.paymentAccount.findUnique({ where: { userId_provider: { userId: user.id, provider: "stripe" } } });
      if (!account?.externalId) return back("erro=stripe-estado");
      const s = await stripeAccountStatus(account.externalId);
      await db.paymentAccount.update({ where: { id: account.id }, data: { status: s.chargesEnabled ? "ACTIVE" : "PENDING" } });
      return back(s.chargesEnabled ? "conectado=stripe" : "pendente=stripe");
    }
  } catch (err) {
    logger.error("callback de pagamento falhou", { provider, err: String(err) });
    return back(`erro=${provider}-falhou`);
  }
  return back("erro=provedor-desconhecido");
}
