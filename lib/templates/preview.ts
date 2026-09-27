import type { SiteSpec } from "@/lib/templates/types";

/**
 * Versão "miniatura" do SiteSpec para cards (lista de protótipos, biblioteca, vitrine):
 *  - só as primeiras seções visíveis (o card mostra ~2);
 *  - fotos pedidas menores: o card tem ~400 px, não precisa da foto de 1600 px.
 * Roda no servidor, antes de mandar para o componente cliente — o payload da página cai
 * de dezenas de KB por card para poucos.
 */
export function previewSpec(spec: SiteSpec, sections = 2, width = 640): SiteSpec {
  const trimmed: SiteSpec = { ...spec, sections: spec.sections.filter((s) => s.visible).slice(0, sections) };
  const json = JSON.stringify(trimmed)
    .replace(/(images\.unsplash\.com\/[^"?]+\?[^"]*?\bw=)\d+/g, `$1${width}`)
    .replace(/("\/api\/places-photo\/[A-Za-z0-9._~-]+)(")/g, `$1?w=${width}$2`);
  return JSON.parse(json) as SiteSpec;
}
