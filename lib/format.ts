/** Formatação pt-BR — funções puras, usadas no servidor e no cliente. */

const intFmt = new Intl.NumberFormat("pt-BR");
const brl = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });
const pct = new Intl.NumberFormat("pt-BR", { style: "percent", maximumFractionDigits: 1 });
const dateShort = new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "2-digit", timeZone: "America/Sao_Paulo" });
const dateTime = new Intl.DateTimeFormat("pt-BR", {
  day: "2-digit",
  month: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  timeZone: "America/Sao_Paulo",
});
const dateLong = new Intl.DateTimeFormat("pt-BR", { day: "numeric", month: "long", year: "numeric", timeZone: "America/Sao_Paulo" });

export const formatInt = (n: number) => intFmt.format(n);
/** Valor em centavos → "R$ 1.500" */
export const formatBRL = (cents: number) => brl.format(cents / 100);
export const formatPercent = (ratio: number) => pct.format(Number.isFinite(ratio) ? ratio : 0);
export const formatRating = (r: number) => r.toLocaleString("pt-BR", { minimumFractionDigits: 1, maximumFractionDigits: 1 });

export function formatDate(d: Date | string, style: "short" | "long" | "time" = "short") {
  const date = typeof d === "string" ? new Date(d) : d;
  if (style === "long") return dateLong.format(date);
  if (style === "time") return dateTime.format(date);
  return dateShort.format(date);
}

export function formatRelative(d: Date | string, now: Date = new Date()) {
  const date = typeof d === "string" ? new Date(d) : d;
  const diff = Math.round((now.getTime() - date.getTime()) / 1000);
  if (diff < 60) return "agora";
  if (diff < 3600) return `há ${Math.floor(diff / 60)} min`;
  if (diff < 86400) return `há ${Math.floor(diff / 3600)} h`;
  if (diff < 86400 * 7) return `há ${Math.floor(diff / 86400)} d`;
  return formatDate(date);
}

export function plural(n: number, one: string, many: string) {
  return `${formatInt(n)} ${n === 1 ? one : many}`;
}

/** "Clínica Bella Estética" → "clinica-bella-estetica" */
export function slugify(s: string) {
  return s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48);
}

/** Remove acentos e baixa caixa — base para comparações tolerantes. */
export function fold(s: string) {
  return s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim();
}

export function initials(name: string) {
  const parts = name.replace(/[^\p{L}\s]/gu, "").split(/\s+/).filter(Boolean);
  return ((parts[0]?.[0] ?? "") + (parts[1]?.[0] ?? "")).toUpperCase() || "?";
}
