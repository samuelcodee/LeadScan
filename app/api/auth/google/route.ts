import { NextResponse, type NextRequest } from "next/server";
import { googleAuthUrl, googleEnabled, newPkce } from "@/lib/auth/google";
import { safeNext } from "@/lib/auth/session";
import { signValue } from "@/lib/auth/token";
import { appUrl } from "@/lib/prototypes/service";
import { rateLimit } from "@/lib/rate-limit";

const GOOGLE_STATE_COOKIE = "ls_oauth";

/** Início do "Continuar com Google": guarda state + PKCE num cookie assinado de 10 min. */
export async function GET(request: NextRequest) {
  if (!googleEnabled()) return NextResponse.redirect(new URL("/login?erro=google-indisponivel", request.url));
  const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "local";
  if (!rateLimit("auth", ip).ok) return NextResponse.redirect(new URL("/login?erro=limite", request.url));

  const { verifier, challenge, state } = newPkce();
  const next = safeNext(request.nextUrl.searchParams.get("next"));
  const redirectUri = `${await appUrl()}/api/auth/google/callback`;
  const res = NextResponse.redirect(googleAuthUrl({ redirectUri, state, challenge }));
  res.cookies.set(GOOGLE_STATE_COOKIE, await signValue(JSON.stringify({ state, verifier, next })), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/api/auth/google",
    maxAge: 600,
  });
  return res;
}
