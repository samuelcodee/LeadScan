import { env, googlePhotosEnabled } from "@/lib/env";
import { refFromToken } from "@/lib/providers/photos";
import { rateLimit } from "@/lib/rate-limit";

/**
 * Proxy das fotos do Google Places (Place Photos API, New).
 * https://developers.google.com/maps/documentation/places/web-service/place-photos
 * Aceita só referências assinadas pelo servidor. ?w=400|640|800|1600 (miniaturas pedem menos).
 * Cache longo na CDN (s-maxage): a mesma foto não volta a custar uma chamada ao Google.
 */
const WIDTHS = [400, 640, 800, 1600];
export async function GET(request: Request, ctx: RouteContext<"/api/places-photo/[token]">) {
  const { token } = await ctx.params;
  const ref = refFromToken(token);
  // cada foto baixada do Google é cobrada: com o Google desligado, nada sai daqui
  const key = googlePhotosEnabled() ? env().MAPS_API_KEY : "";
  if (!ref || !key) return new Response("Não encontrado", { status: 404 });
  const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "local";
  if (!rateLimit("photo", ip).ok) return new Response("Muitas requisições", { status: 429 });
  const asked = Number(new URL(request.url).searchParams.get("w")) || 1600;
  const width = WIDTHS.find((w) => w >= asked) ?? 1600;

  const upstream = await fetch(`https://places.googleapis.com/v1/${ref}/media?maxWidthPx=${width}`, {
    headers: { "X-Goog-Api-Key": key },
    redirect: "follow",
    signal: AbortSignal.timeout(15_000),
  }).catch(() => null);
  if (!upstream?.ok || !upstream.body) return new Response("Foto indisponível", { status: 404 });
  const type = upstream.headers.get("content-type") ?? "image/jpeg";
  if (!type.startsWith("image/")) return new Response("Foto indisponível", { status: 404 });
  return new Response(upstream.body, {
    headers: { "Content-Type": type, "Cache-Control": "public, max-age=86400, s-maxage=2592000, stale-while-revalidate=86400", "X-Content-Type-Options": "nosniff" },
  });
}
