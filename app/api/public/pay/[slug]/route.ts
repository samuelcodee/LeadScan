import { NextResponse, type NextRequest } from "next/server";
import { db } from "@/lib/db";
import { logger } from "@/lib/logger";
import { ensureCheckout } from "@/lib/payments/service";
import { rateLimit } from "@/lib/rate-limit";

/** Botão "Pagar" da página pública: garante um checkout válido e redireciona para o provedor. */
export async function GET(request: NextRequest, ctx: RouteContext<"/api/public/pay/[slug]">) {
  const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "local";
  if (!rateLimit("payment", ip).ok) return new NextResponse("Muitas tentativas. Aguarde um pouco.", { status: 429 });
  const { slug } = await ctx.params;
  const charge = await db.charge.findUnique({ where: { slug }, include: { account: true } });
  if (!charge) return NextResponse.redirect(new URL("/", request.url));
  // Teste e Pix direto não têm checkout de provedor: tudo acontece na própria página
  if (charge.status !== "PENDING" || charge.provider === "mock" || charge.provider === "pix") return NextResponse.redirect(new URL(`/pagar/${slug}`, request.url));
  try {
    const ready = await ensureCheckout(charge);
    if (!ready.checkoutUrl) throw new Error("sem checkout");
    return NextResponse.redirect(ready.checkoutUrl, { status: 303 });
  } catch (err) {
    logger.error("checkout público falhou", { err: String(err) });
    return NextResponse.redirect(new URL(`/pagar/${slug}?status=indisponivel`, request.url));
  }
}
