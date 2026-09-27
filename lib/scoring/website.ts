export type WebsiteKind = "none" | "social" | "link-in-bio" | "discontinued" | "free-builder" | "own";

const SOCIAL = /(^|\.)(instagram\.com|facebook\.com|fb\.com|fb\.me|tiktok\.com|wa\.me|whatsapp\.com|twitter\.com|x\.com|youtube\.com|linkedin\.com)$/;
const LINK_IN_BIO = /(^|\.)(linktr\.ee|linktree\.com|beacons\.ai|bio\.link|linkin\.bio|taplink\.cc|taplink\.at|lnk\.bio|campsite\.bio|linkbio\.co|msha\.ke)$/;
// Sites gratuitos de Perfil da Empresa no Google (business.site) foram desligados em 2024.
const DISCONTINUED = /(^|\.)business\.site$/;
const FREE_BUILDER =
  /(^|\.)(wixsite\.com|blogspot\.com|blogspot\.com\.br|wordpress\.com|webnode\.(com|page|com\.br)|site123\.me|weebly\.com|carrd\.co|godaddysites\.com|negocio\.site|ueniweb\.com|yolasite\.com|jimdosite\.com|webflow\.io|netlify\.app|vercel\.app|sites\.google\.com)$/;

export function parseUrl(raw: string | null | undefined): URL | null {
  if (!raw) return null;
  const v = raw.trim();
  if (!v) return null;
  try {
    const url = new URL(/^https?:\/\//i.test(v) ? v : `https://${v}`);
    return url.hostname.includes(".") ? url : null;
  } catch {
    return null;
  }
}

export function classifyWebsite(raw: string | null | undefined): { kind: WebsiteKind; host: string | null; https: boolean } {
  const url = parseUrl(raw);
  if (!url) return { kind: "none", host: null, https: false };
  const host = url.hostname.replace(/^www\./, "").toLowerCase();
  const https = !/^http:\/\//i.test(raw!.trim());
  const path = url.pathname.toLowerCase();
  if (host === "google.com" && path.startsWith("/site")) return { kind: "free-builder", host, https };
  if (SOCIAL.test(host)) return { kind: "social", host, https };
  if (LINK_IN_BIO.test(host)) return { kind: "link-in-bio", host, https };
  if (DISCONTINUED.test(host)) return { kind: "discontinued", host, https };
  if (FREE_BUILDER.test(host)) return { kind: "free-builder", host, https };
  return { kind: "own", host, https };
}

/** Tem site próprio "de verdade"? (rede social / link de bio não contam) */
export function hasOwnWebsite(raw: string | null | undefined) {
  const k = classifyWebsite(raw).kind;
  return k === "own" || k === "free-builder";
}

export const WEBSITE_KIND_LABEL: Record<WebsiteKind, string> = {
  none: "Não encontrado",
  social: "Só rede social",
  "link-in-bio": "Só link de bio",
  discontinued: "Site desativado",
  "free-builder": "Construtor gratuito",
  own: "Site próprio",
};
