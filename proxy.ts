import { NextResponse, type NextRequest } from "next/server";
import { SESSION_COOKIE, verifySession } from "@/lib/auth/token";

/**
 * Checagem otimista de sessão (a autorização de verdade acontece no servidor,
 * em requireUser()/action(), em cada página e mutação).
 */
const PUBLIC_PREFIXES = [
  "/login",
  "/termos",
  "/privacidade",
  "/proposta",
  "/pagar",
  "/demo",
  "/api/auth",
  "/api/public",
  "/api/health",
  "/api/webhooks",
  "/api/media",
  "/api/places-photo",
  "/api/payments/mock",
];

function isPublic(pathname: string) {
  return pathname === "/" || PUBLIC_PREFIXES.some((p) => pathname === p || pathname.startsWith(`${p}/`));
}

export async function proxy(request: NextRequest) {
  const { pathname, search } = request.nextUrl;
  if (isPublic(pathname)) return NextResponse.next();
  const session = await verifySession(request.cookies.get(SESSION_COOKIE)?.value);
  if (session) return NextResponse.next();
  if (pathname.startsWith("/api/")) return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  return NextResponse.redirect(new URL(`/login?next=${encodeURIComponent(pathname + search)}`, request.url));
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|icon.svg|robots.txt).*)"],
};
