import { NextResponse } from "next/server";
import { db } from "@/lib/db";

/** Status público de uma cobrança (só o status: a página de pagamento acompanha a confirmação). */
export async function GET(_req: Request, ctx: RouteContext<"/api/public/charge/[slug]">) {
  const { slug } = await ctx.params;
  const charge = await db.charge.findUnique({ where: { slug }, select: { status: true } });
  if (!charge) return NextResponse.json({ error: "Não encontrada" }, { status: 404 });
  return NextResponse.json({ status: charge.status }, { headers: { "Cache-Control": "no-store" } });
}
