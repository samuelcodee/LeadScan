import type { TemplateId } from "@/lib/domain/categories";
import type { FontPairId, HeroLayout, SiteTheme } from "@/lib/templates/types";

/**
 * Estilos prontos: mudam tipografia, cantos, fundo e o layout do topo de uma vez.
 * As cores ficam por conta da paleta (do segmento ou da marca do cliente).
 */
export type StylePreset = {
  id: string;
  label: string;
  description: string;
  font: FontPairId;
  radius: SiteTheme["radius"];
  surface: SiteTheme["surface"];
  heroLayout: HeroLayout;
};

export const STYLE_PRESETS: StylePreset[] = [
  { id: "classico", label: "Clássico", description: "Serifa elegante, fundo claro, foto ao lado.", font: "cormorant", radius: "soft", surface: "light", heroLayout: "split" },
  { id: "moderno", label: "Moderno", description: "Geométrica, cantos redondos, título grande.", font: "sora", radius: "round", surface: "light", heroLayout: "stacked" },
  { id: "minimal", label: "Minimalista", description: "Neutra, cantos retos, muito respiro.", font: "manrope", radius: "none", surface: "light", heroLayout: "stacked" },
  { id: "aconchegante", label: "Aconchegante", description: "Arredondada e suave, fundo tingido.", font: "nunito", radius: "round", surface: "tint", heroLayout: "split" },
  { id: "editorial", label: "Editorial", description: "Serifa de revista e foto de fundo.", font: "playfair", radius: "none", surface: "light", heroLayout: "overlay" },
  { id: "vibrante", label: "Vibrante", description: "Tipografia com personalidade e cor forte.", font: "bricolage", radius: "round", surface: "tint", heroLayout: "overlay" },
  { id: "ousado", label: "Ousado", description: "Condensada em caixa alta, fundo escuro.", font: "anton", radius: "none", surface: "dark", heroLayout: "overlay" },
  { id: "noturno", label: "Noturno", description: "Escuro e sofisticado, títulos clássicos.", font: "marcellus", radius: "soft", surface: "dark", heroLayout: "overlay" },
];

export type Palette = { name: string; primary: string; accent: string };

/**
 * Paletas alternativas por segmento (a 1ª é a do template). Clientes do mesmo segmento
 * ganham paletas diferentes automaticamente (escolha determinística pelo id do lead).
 * Todas passam contraste com texto branco no botão principal (readableOn decide).
 */
export const PALETTES: Record<TemplateId, Palette[]> = {
  estetica: [
    { name: "Bordô e sálvia", primary: "#6B2346", accent: "#9DB4A0" },
    { name: "Nude e ouro", primary: "#8A5A44", accent: "#D8B26E" },
    { name: "Lavanda", primary: "#5B4B8A", accent: "#E7C6D8" },
    { name: "Verde spa", primary: "#2F5E4E", accent: "#E9D3B5" },
  ],
  dentista: [
    { name: "Petróleo e sol", primary: "#0E5E63", accent: "#F2B94B" },
    { name: "Azul clínico", primary: "#1D4E89", accent: "#7FD1C7" },
    { name: "Verde menta", primary: "#23705B", accent: "#F6C667" },
    { name: "Grafite e ciano", primary: "#2B3A42", accent: "#3FC1C9" },
  ],
  clinic: [
    { name: "Azul confiança", primary: "#1F5A8C", accent: "#8CC5B3" },
    { name: "Verde cuidado", primary: "#26705F", accent: "#F0B67F" },
    { name: "Marinho", primary: "#1C3557", accent: "#E4A853" },
    { name: "Turquesa", primary: "#0F6E78", accent: "#FFD166" },
  ],
  restaurant: [
    { name: "Tomate e manjericão", primary: "#A3261B", accent: "#6B8F3A" },
    { name: "Carvão e brasa", primary: "#232323", accent: "#E4572E" },
    { name: "Verde oliva", primary: "#4B5A2A", accent: "#E0A526" },
    { name: "Azul petróleo", primary: "#1F4E5F", accent: "#F2A541" },
  ],
  barbearia: [
    { name: "Preto e cobre", primary: "#1B1B1B", accent: "#C47F3C" },
    { name: "Verde garrafa", primary: "#1F3B2D", accent: "#D9A441" },
    { name: "Azul navy", primary: "#1A2A44", accent: "#C9A46A" },
    { name: "Vinho", primary: "#4A1C24", accent: "#D6B37A" },
  ],
  academia: [
    { name: "Preto e laranja", primary: "#141414", accent: "#FF6B1A" },
    { name: "Azul elétrico", primary: "#1636A8", accent: "#F5D547" },
    { name: "Verde energia", primary: "#0F5132", accent: "#B8F34A" },
    { name: "Vermelho", primary: "#8E1B1B", accent: "#F1F1F1" },
  ],
  advocacia: [
    { name: "Marinho e dourado", primary: "#1A2B45", accent: "#B89253" },
    { name: "Vinho sóbrio", primary: "#5A1E2B", accent: "#C8B28A" },
    { name: "Grafite", primary: "#2E3135", accent: "#A88B5C" },
    { name: "Verde inglês", primary: "#1E3D33", accent: "#C2A25F" },
  ],
  contabilidade: [
    { name: "Azul corporativo", primary: "#1E3F66", accent: "#4FB286" },
    { name: "Grafite e verde", primary: "#2B2F33", accent: "#43A047" },
    { name: "Petróleo", primary: "#0F4C5C", accent: "#F2A65A" },
    { name: "Índigo", primary: "#2D3A8C", accent: "#6EC6CA" },
  ],
  "auto-center": [
    { name: "Grafite e amarelo", primary: "#22272B", accent: "#F4C20D" },
    { name: "Azul oficina", primary: "#123C69", accent: "#EE6C4D" },
    { name: "Vermelho corrida", primary: "#9B1D20", accent: "#1F1F1F" },
    { name: "Verde militar", primary: "#34432C", accent: "#F2A007" },
  ],
  "real-estate": [
    { name: "Azul e areia", primary: "#1D3557", accent: "#E9C46A" },
    { name: "Verde e terra", primary: "#2F4F3E", accent: "#C98B57" },
    { name: "Grafite e cobre", primary: "#2E2E2E", accent: "#B87333" },
    { name: "Marinho e céu", primary: "#14213D", accent: "#8ECAE6" },
  ],
  hotel: [
    { name: "Mar e areia", primary: "#0B5563", accent: "#E8C39E" },
    { name: "Verde mata", primary: "#2D4A3E", accent: "#F2B880" },
    { name: "Terracota suave", primary: "#8C4A3A", accent: "#9CC5C0" },
    { name: "Azul noite", primary: "#1B2A41", accent: "#E0B973" },
  ],
  pet: [
    { name: "Laranja e azul", primary: "#1F5C99", accent: "#FF9F1C" },
    { name: "Verde patinha", primary: "#2E7D4F", accent: "#FFD166" },
    { name: "Roxo brincalhão", primary: "#5B3F9A", accent: "#FFB4A2" },
    { name: "Café com leite", primary: "#6B4226", accent: "#9ED2C6" },
  ],
  "local-business": [
    { name: "Azul neutro", primary: "#1F3B57", accent: "#F2A541" },
    { name: "Verde sóbrio", primary: "#2E5E4E", accent: "#E9C46A" },
    { name: "Grafite", primary: "#2F3437", accent: "#4EA8DE" },
    { name: "Vinho", primary: "#5C1F2E", accent: "#E8B86D" },
  ],
  cafe: [
    { name: "Torra e mostarda", primary: "#4A2F22", accent: "#C9A227" },
    { name: "Verde café", primary: "#2F4A3A", accent: "#E6B36A" },
    { name: "Cacau e creme", primary: "#5A3825", accent: "#E9D8B4" },
    { name: "Azul azulejo", primary: "#1E4E79", accent: "#F2C14E" },
  ],
  beleza: [
    { name: "Amora e blush", primary: "#8C2F5B", accent: "#F2C6B4" },
    { name: "Nude chocolate", primary: "#6E4B3A", accent: "#E8C9B0" },
    { name: "Preto e rosé", primary: "#1E1A1D", accent: "#E7A6B8" },
    { name: "Verde oliva", primary: "#4D5B3A", accent: "#EBC7A8" },
  ],
  studio: [
    { name: "Sálvia e areia", primary: "#2F5D50", accent: "#E9C46A" },
    { name: "Terra e argila", primary: "#7A4B3A", accent: "#D9C5A0" },
    { name: "Azul sereno", primary: "#2C4F6B", accent: "#F2C6A0" },
    { name: "Grafite zen", primary: "#33393D", accent: "#A8C3A0" },
  ],
  educacao: [
    { name: "Azul e amarelo", primary: "#1F4E9A", accent: "#F4B400" },
    { name: "Verde escola", primary: "#1E7145", accent: "#FFC857" },
    { name: "Laranja criativo", primary: "#C0451F", accent: "#2EC4B6" },
    { name: "Roxo estudo", primary: "#4B3F9E", accent: "#F9C74F" },
  ],
  construcao: [
    { name: "Grafite e obra", primary: "#1E2A32", accent: "#F28C28" },
    { name: "Concreto e amarelo", primary: "#3A3F44", accent: "#F2C12E" },
    { name: "Azul engenharia", primary: "#16325C", accent: "#F2994A" },
    { name: "Madeira", primary: "#4E3629", accent: "#D9A066" },
  ],
  "servicos-casa": [
    { name: "Azul e amarelo", primary: "#0B5CAD", accent: "#FFC23D" },
    { name: "Verde confiança", primary: "#12664F", accent: "#F4D35E" },
    { name: "Laranja alerta", primary: "#B8430F", accent: "#1F2937" },
    { name: "Marinho", primary: "#1B2F4E", accent: "#4CC9F0" },
  ],
  eventos: [
    { name: "Vinho e dourado", primary: "#7A1F3D", accent: "#D4AF37" },
    { name: "Verde esmeralda", primary: "#115E4F", accent: "#E7C873" },
    { name: "Azul noite", primary: "#1C2541", accent: "#F2D0A4" },
    { name: "Rosa festa", primary: "#A0306A", accent: "#F7D08A" },
  ],
  moda: [
    { name: "Tinta e caramelo", primary: "#151515", accent: "#C8A27A" },
    { name: "Off-white e preto", primary: "#2B2B2B", accent: "#E9E3D9" },
    { name: "Verde musgo", primary: "#3C4A36", accent: "#D9B99B" },
    { name: "Bordô", primary: "#5E1A2A", accent: "#EBC9A0" },
  ],
  saude: [
    { name: "Verde-azulado e pêssego", primary: "#2E7D7A", accent: "#F3A683" },
    { name: "Azul calmo", primary: "#2F5D8A", accent: "#A8DADC" },
    { name: "Lavanda", primary: "#5E548E", accent: "#F4C095" },
    { name: "Folha", primary: "#3C6E47", accent: "#EAD2AC" },
  ],
};

export function palettesFor(templateId: string): Palette[] {
  return PALETTES[templateId as TemplateId] ?? PALETTES["local-business"];
}
