import {
  Anton,
  Bricolage_Grotesque,
  Cormorant_Garamond,
  JetBrains_Mono,
  Manrope,
  Marcellus,
  Montserrat,
  Nunito,
  Playfair_Display,
  Inter,
  Sora,
} from "next/font/google";
import type { FontPairId } from "@/lib/templates/types";

// Interface do app
export const inter = Inter({ subsets: ["latin"], variable: "--font-inter", display: "swap" });
// Só o logotipo (LeadScan): geométrica como na marca original
export const brand = Montserrat({ subsets: ["latin"], variable: "--font-montserrat", display: "swap" });
export const jetbrains = JetBrains_Mono({ subsets: ["latin"], variable: "--font-jetbrains", display: "swap", preload: false });

// Fontes dos sites gerados — sem preload: o navegador só baixa a que o protótipo usa.
// (next/font exige objetos literais: nada de spread aqui)
const marcellus = Marcellus({ subsets: ["latin"], display: "swap", preload: false, weight: "400", variable: "--font-marcellus" });
const bricolage = Bricolage_Grotesque({ subsets: ["latin"], display: "swap", preload: false, variable: "--font-bricolage" });
const anton = Anton({ subsets: ["latin"], display: "swap", preload: false, weight: "400", variable: "--font-anton" });
const playfair = Playfair_Display({ subsets: ["latin"], display: "swap", preload: false, variable: "--font-playfair" });
const cormorant = Cormorant_Garamond({ subsets: ["latin"], display: "swap", preload: false, weight: ["500", "600", "700"], variable: "--font-cormorant" });
const manrope = Manrope({ subsets: ["latin"], display: "swap", preload: false, variable: "--font-manrope" });
const nunito = Nunito({ subsets: ["latin"], display: "swap", preload: false, variable: "--font-nunito" });
const sora = Sora({ subsets: ["latin"], display: "swap", preload: false, variable: "--font-sora" });

export const siteFontVariables = [marcellus, bricolage, anton, playfair, cormorant, manrope, nunito, sora]
  .map((f) => f.variable)
  .join(" ");

export const FONT_PAIR_CSS: Record<FontPairId, { heading: string; body: string; label: string; uppercase?: boolean }> = {
  marcellus: { heading: "var(--font-marcellus)", body: "var(--font-manrope)", label: "Clássica elegante" },
  bricolage: { heading: "var(--font-bricolage)", body: "var(--font-manrope)", label: "Moderna com personalidade" },
  anton: { heading: "var(--font-anton)", body: "var(--font-manrope)", label: "Condensada forte", uppercase: true },
  playfair: { heading: "var(--font-playfair)", body: "var(--font-manrope)", label: "Serifa editorial" },
  cormorant: { heading: "var(--font-cormorant)", body: "var(--font-manrope)", label: "Serifa institucional" },
  manrope: { heading: "var(--font-manrope)", body: "var(--font-manrope)", label: "Limpa e neutra" },
  nunito: { heading: "var(--font-nunito)", body: "var(--font-nunito)", label: "Arredondada amigável" },
  sora: { heading: "var(--font-sora)", body: "var(--font-manrope)", label: "Geométrica" },
};
