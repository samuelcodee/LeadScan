import { NextResponse, type NextRequest } from "next/server";
import { safeNext, setSessionCookie } from "@/lib/auth/session";
import { seedCommunityDemo, seedDemoFinance } from "@/lib/demo/community";
import { ensureDemoUser, seedDemoData } from "@/lib/demo/seed";
import { isDemoMode } from "@/lib/env";
import { logger } from "@/lib/logger";

/** Entrada no modo demonstração: cria o usuário demo, popula os dados (1ª vez) e abre a sessão. */
export async function GET(request: NextRequest) {
  if (!isDemoMode()) return NextResponse.redirect(new URL("/login", request.url));
  const user = await ensureDemoUser();
  try {
    await seedDemoData(user.id);
    await seedCommunityDemo();
    await seedDemoFinance(user.id);
  } catch (err) {
    logger.error("falha ao popular demo", { err });
  }
  await setSessionCookie(user);
  return NextResponse.redirect(new URL(safeNext(request.nextUrl.searchParams.get("next")), request.url));
}
