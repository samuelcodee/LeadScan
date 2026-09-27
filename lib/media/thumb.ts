/**
 * Miniatura de uma imagem (serve no navegador e no servidor): pede ao próprio app ou ao
 * Unsplash uma versão na largura certa, em vez de baixar a foto de 1600 px para mostrar 60.
 */
export const THUMB_WIDTHS = [160, 320, 480, 800] as const;

export function thumbUrl(src: string, width: (typeof THUMB_WIDTHS)[number]) {
  if (src.startsWith("https://images.unsplash.com")) return /[?&]w=\d+/.test(src) ? src.replace(/([?&]w=)\d+/, `$1${width}`) : `${src}${src.includes("?") ? "&" : "?"}w=${width}`;
  if (/^\/api\/media\/[a-z0-9]+$/i.test(src)) return `${src}?w=${width}`;
  return src;
}
