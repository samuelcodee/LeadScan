import { NextResponse, type NextRequest } from "next/server";
import { loginWithGoogle } from "@/lib/auth/accounts";
import { googleExchange } from "@/lib/auth/google";
import { safeNext, setSessionCookie } from "@/lib/auth/session";
import { safeEqual, unsignValue } from "@/lib/auth/token";
import { logger } from "@/lib/logger";
import { appUrl } from "@/lib/prototypes/service";

const STATE_COOKIE = "ls_oauth";

export async function GET(request: NextRequest) {
  const fail = (code: string) => {
    const res = NextResponse.redirect(new URL(`/login?erro=${code}`, request.url));
    res.cookies.delete({ name: STATE_COOKIE, path: "/api/auth/google" });
    return res;
  };

  const params = request.nextUrl.searchParams;
  if (params.get("error")) return fail("google-cancelado");
  const raw = await unsignValue(request.cookies.get(STATE_COOKIE)?.value);
  if (!raw) return fail("google-expirado");
  const saved = JSON.parse(raw) as { state: string; verifier: string; next: string };
  const state = params.get("state") ?? "";
  const code = params.get("code");
  if (!code || !safeEqual(state, saved.state)) return fail("google-estado");

  try {
    const profile = await googleExchange({ code, verifier: saved.verifier, redirectUri: `${await appUrl()}/api/auth/google/callback` });
    const user = await loginWithGoogle(profile);
    await setSessionCookie(user);
    const next = safeNext(saved.next);
    const res = NextResponse.redirect(new URL(user.onboardedAt ? next : `/onboarding?next=${encodeURIComponent(next)}`, request.url));
    res.cookies.delete({ name: STATE_COOKIE, path: "/api/auth/google" });
    return res;
  } catch (err) {
    logger.error("login google falhou", { err });
    return fail("google-falhou");
  }
}
