import { getLevel } from "@/lib/gamification/levels";
import { cn } from "@/lib/utils";

/**
 * Insígnias dos níveis e títulos — SVG minimalista na paleta da marca.
 * A forma sobe de complexidade com o nível (círculo → escudo → hexágono → octógono →
 * estrela) e o lima vai tomando conta: 1–6 escuras com detalhe lima, 7–8 lima,
 * 9 preta com aro lima, 10 toda lima com coroa. Cada nível tem um símbolo próprio,
 * então dá para distinguir sem depender só da cor.
 */
const LIME = "#EFFF00";
const INK = "#0A0D0F";
const GRAPHITE = "#252B30";
const WHITE = "#FFFFFF";

function polygon(n: number, r: number, rotate = -90, cx = 12, cy = 12) {
  return Array.from({ length: n }, (_, i) => {
    const a = ((rotate + (360 / n) * i) * Math.PI) / 180;
    return `${(cx + r * Math.cos(a)).toFixed(2)},${(cy + r * Math.sin(a)).toFixed(2)}`;
  }).join(" ");
}

function star(points: number, outer: number, inner: number, cx = 12, cy = 12) {
  return Array.from({ length: points * 2 }, (_, i) => {
    const r = i % 2 === 0 ? outer : inner;
    const a = ((-90 + (180 / points) * i) * Math.PI) / 180;
    return `${(cx + r * Math.cos(a)).toFixed(2)},${(cy + r * Math.sin(a)).toFixed(2)}`;
  }).join(" ");
}

const SHIELD = "M12 1.6 20.6 4.7V11.4C20.6 16.8 17 20.6 12 22.4 7 20.6 3.4 16.8 3.4 11.4V4.7Z";
const HEX = polygon(6, 10.6);
const OCT = polygon(8, 10.8, -67.5);
const BURST = star(12, 11.4, 9.4);
const STAR5 = star(5, 5.6, 2.4, 12, 12.4);

type Def = { label: string; body: React.ReactNode };

const S = { fill: "none", strokeLinecap: "round", strokeLinejoin: "round" } as const;
/** Aro claro quase invisível: separa as formas grafite do fundo preto da sidebar */
const RING = { stroke: WHITE, strokeOpacity: 0.16, strokeWidth: 1 } as const;

const DEFS: Record<string, Def> = {
  "level-1": {
    label: "Primeira Venda",
    body: (
      <>
        <circle cx="12" cy="12" r="10.8" fill={GRAPHITE} {...RING} />
        <path d="M12 6.6 13.3 10.7 17.4 12 13.3 13.3 12 17.4 10.7 13.3 6.6 12 10.7 10.7Z" fill={LIME} />
      </>
    ),
  },
  "level-2": {
    label: "Em Ritmo",
    body: (
      <>
        <circle cx="12" cy="12" r="10.8" fill={GRAPHITE} {...RING} />
        <path d="M8 12.4 12 8.4 16 12.4" stroke={LIME} strokeWidth="2.2" {...S} />
        <path d="M8 16.4 12 12.4 16 16.4" stroke={WHITE} strokeWidth="2.2" {...S} />
      </>
    ),
  },
  "level-3": {
    label: "Profissional",
    body: (
      <>
        <path d={SHIELD} fill={GRAPHITE} {...RING} />
        <path d="M7.8 12 10.8 15 16.4 9.2" stroke={LIME} strokeWidth="2.3" {...S} />
      </>
    ),
  },
  "level-4": {
    label: "Especialista",
    body: (
      <>
        <path d={SHIELD} fill={GRAPHITE} {...RING} />
        <circle cx="12" cy="11.8" r="4.4" stroke={WHITE} strokeWidth="1.6" fill="none" />
        <circle cx="12" cy="11.8" r="1.5" fill={LIME} />
        <path d="M12 5.6V7.2M12 16.4V18M5.8 11.8H7.4M16.6 11.8H18.2" stroke={LIME} strokeWidth="1.6" {...S} />
      </>
    ),
  },
  "level-5": {
    label: "Referência",
    body: (
      <>
        <polygon points={HEX} fill={INK} stroke={LIME} strokeWidth="1.4" strokeLinejoin="round" />
        <polygon points={STAR5} fill={WHITE} strokeLinejoin="round" />
      </>
    ),
  },
  "level-6": {
    label: "Estúdio",
    body: (
      <>
        <polygon points={HEX} fill={INK} stroke={LIME} strokeWidth="1.4" strokeLinejoin="round" />
        <path d="M12 6.8 17 9.4 12 12 7 9.4Z" fill={LIME} />
        <path d="M7 12.6 12 15.2 17 12.6M7 15.6 12 18.2 17 15.6" stroke={WHITE} strokeWidth="1.5" {...S} />
      </>
    ),
  },
  "level-7": {
    label: "Agência",
    body: (
      <>
        <polygon points={HEX} fill={LIME} stroke={LIME} strokeWidth="1.4" strokeLinejoin="round" />
        <rect x="7.3" y="7.3" width="4" height="4" rx="1" fill={INK} />
        <rect x="12.7" y="7.3" width="4" height="4" rx="1" fill={INK} />
        <rect x="7.3" y="12.7" width="4" height="4" rx="1" fill={INK} />
        <rect x="12.7" y="12.7" width="4" height="4" rx="2" fill={INK} />
      </>
    ),
  },
  "level-8": {
    label: "Autoridade",
    body: (
      <>
        <polygon points={OCT} fill={LIME} stroke={INK} strokeOpacity=".12" strokeWidth="1" strokeLinejoin="round" />
        <path d="M13.2 5.8 8.4 12.9H12L10.8 18.2 15.6 11.1H12Z" fill={INK} strokeLinejoin="round" />
      </>
    ),
  },
  "level-9": {
    label: "Elite",
    body: (
      <>
        <polygon points={BURST} fill={INK} stroke={LIME} strokeWidth="1.2" strokeLinejoin="round" />
        <path d="M8.4 10.2 10 7.8H14L15.6 10.2 12 16.4Z" fill="none" stroke={LIME} strokeWidth="1.5" strokeLinejoin="round" />
        <path d="M8.4 10.2H15.6M10.9 10.2 12 16.4 13.1 10.2" stroke={LIME} strokeWidth="1.1" {...S} />
      </>
    ),
  },
  "level-10": {
    label: "Lenda",
    body: (
      <>
        <polygon points={BURST} fill={LIME} stroke={INK} strokeOpacity=".15" strokeWidth="1" strokeLinejoin="round" />
        <path d="M7.2 15.6 6.6 9.2 9.6 11.4 12 7.4 14.4 11.4 17.4 9.2 16.8 15.6Z" fill={INK} strokeLinejoin="round" />
        <rect x="7.2" y="16.4" width="9.6" height="1.6" rx=".8" fill={INK} />
      </>
    ),
  },
  "week-champion": {
    label: "Campeão da semana",
    body: (
      <>
        <circle cx="12" cy="12" r="10.8" fill={INK} stroke={LIME} strokeWidth="1.2" />
        <path d="M8.6 7.2H15.4V10.2C15.4 12.2 13.9 13.6 12 13.6S8.6 12.2 8.6 10.2Z" fill={LIME} />
        <path d="M8.6 8.4H6.9C6.9 10.2 7.8 11.2 9 11.4M15.4 8.4H17.1C17.1 10.2 16.2 11.2 15 11.4" stroke={LIME} strokeWidth="1.2" {...S} />
        <path d="M12 13.6V16M9.4 17.2H14.6" stroke={WHITE} strokeWidth="1.6" {...S} />
      </>
    ),
  },
  "month-champion": {
    label: "Campeão do mês",
    body: (
      <>
        <circle cx="12" cy="12" r="10.8" fill={LIME} />
        <path d="M8.6 7.2H15.4V10.2C15.4 12.2 13.9 13.6 12 13.6S8.6 12.2 8.6 10.2Z" fill={INK} />
        <path d="M8.6 8.4H6.9C6.9 10.2 7.8 11.2 9 11.4M15.4 8.4H17.1C17.1 10.2 16.2 11.2 15 11.4" stroke={INK} strokeWidth="1.2" {...S} />
        <path d="M12 13.6V16M9.4 17.2H14.6" stroke={INK} strokeWidth="1.6" {...S} />
        <path d="M12 8.2 12.5 9.6 13.9 9.6 12.8 10.5 13.2 11.8 12 11 10.8 11.8 11.2 10.5 10.1 9.6 11.5 9.6Z" fill={LIME} />
      </>
    ),
  },
  "month-podium": {
    label: "Pódio do mês",
    body: (
      <>
        <circle cx="12" cy="12" r="10.8" fill={GRAPHITE} {...RING} />
        <rect x="6.4" y="12.4" width="3.6" height="5" rx=".8" fill={WHITE} />
        <rect x="10.2" y="8.2" width="3.6" height="9.2" rx=".8" fill={LIME} />
        <rect x="14" y="10.6" width="3.6" height="6.8" rx=".8" fill={WHITE} opacity=".7" />
      </>
    ),
  },
};

export function insigniaLabel(badge: string) {
  return DEFS[badge]?.label ?? null;
}

/** Selo desenhado. `locked` = ainda não conquistado (cinza e translúcido). */
export function Insignia({ badge, size = 20, className, locked, title }: { badge: string; size?: number; className?: string; locked?: boolean; title?: string }) {
  const def = DEFS[badge];
  if (!def) return null;
  const n = badge.startsWith("level-") ? Number(badge.slice(6)) : null;
  const text = title ?? (n ? `Nível ${n} · ${getLevel(n)?.name ?? def.label}` : def.label);
  return (
    <svg
      viewBox="0 0 24 24"
      width={size}
      height={size}
      role="img"
      aria-label={text}
      className={cn("shrink-0", locked && "opacity-35 grayscale", className)}
    >
      <title>{text}</title>
      {def.body}
    </svg>
  );
}
