import "server-only";
import { appHmac, safeEqualStr } from "@/lib/crypto/secrets";

/**
 * Fotos reais do Google Places servidas por um proxy ASSINADO:
 *  - a chave do Maps nunca vai para o navegador
 *  - só referências que o servidor gerou (HMAC) passam — ninguém usa o proxy
 *    para gastar a cota com fotos arbitrárias
 * URL final: /api/places-photo/<base64url(ref)>.<assinatura>
 */
import type { PhotoRef } from "@/lib/providers/types";
export type { PhotoRef };

export function photoToken(ref: string) {
  const b64 = Buffer.from(ref).toString("base64url");
  return `${b64}.${appHmac(`photo:${ref}`)}`;
}

export function photoUrl(ref: string) {
  return `/api/places-photo/${photoToken(ref)}`;
}

export function refFromToken(token: string): string | null {
  const [b64, sig] = token.split(".");
  if (!b64 || !sig) return null;
  const ref = Buffer.from(b64, "base64url").toString("utf8");
  if (!/^places\/[A-Za-z0-9_-]+\/photos\/[A-Za-z0-9_-]+$/.test(ref)) return null;
  return safeEqualStr(sig, appHmac(`photo:${ref}`)) ? ref : null;
}

/** Lê o JSON salvo em Lead.photos de forma tolerante. */
export function parsePhotos(json: unknown): PhotoRef[] {
  if (!Array.isArray(json)) return [];
  return json.filter((p): p is PhotoRef => typeof p === "object" && p !== null && typeof (p as PhotoRef).ref === "string").slice(0, 10);
}
