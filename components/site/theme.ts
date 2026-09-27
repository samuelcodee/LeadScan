import type { CSSProperties } from "react";
import { contrast, mix, readableOn } from "@/lib/color";
import { FONT_PAIR_CSS } from "@/lib/fonts";
import type { SiteTheme } from "@/lib/templates/types";

/** Deriva todas as variáveis de cor do site a partir de 2 cores + tipo de superfície. */
export function themeVars(theme: SiteTheme): CSSProperties {
  const { primary, accent, surface } = theme;
  const dark = surface === "dark";
  const bg = dark ? mix(primary, "#111214", 0.05) : surface === "tint" ? mix(primary, "#ffffff", 0.045) : "#ffffff";
  const fg = dark ? "#f3f1ec" : "#16181d";
  const card = dark ? mix(primary, "#1b1c1f", 0.07) : surface === "tint" ? "#ffffff" : "#f6f7f8";
  // Primária usada como texto (links, destaques) precisa de contraste com o fundo.
  const primaryText = contrast(primary, bg) >= 3 ? primary : dark ? mix(primary, "#ffffff", 0.55) : mix(primary, "#000000", 0.6);
  const font = FONT_PAIR_CSS[theme.font];
  return {
    "--site-primary": primary,
    "--site-primary-text": primaryText,
    "--site-on-primary": readableOn(primary),
    "--site-accent": accent,
    "--site-on-accent": readableOn(accent),
    "--site-bg": bg,
    "--site-fg": fg,
    "--site-muted": dark ? "#a9aab0" : "#5a5f69",
    "--site-card": card,
    "--site-line": dark ? "rgba(255,255,255,0.1)" : mix(primary, "#e7e8ec", 0.08),
    "--site-tint": dark ? mix(primary, "#111214", 0.14) : mix(primary, "#ffffff", 0.08),
    "--site-font-heading": font.heading,
    "--site-font-body": font.body,
    "--site-radius": theme.radius === "none" ? "0px" : theme.radius === "soft" ? "10px" : "22px",
    "--site-heading-case": font.uppercase ? "uppercase" : "none",
  } as CSSProperties;
}
