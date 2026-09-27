import { useId } from "react";
import { cn } from "@/lib/utils";

/**
 * Marca LeadScan (redesenho vetorial da logo oficial): a pessoa com a cabeça-rede em lima,
 * a seta de crescimento em zigue-zague prateada e o alvo lima onde a seta chega.
 * Prata = degradê branco → cinza (lembra o metal escovado da logo) e só funciona em
 * superfície escura; em fundo claro use `boxed` (quadrado preto).
 * Ids do degradê/recorte via useId: o mesmo SVG aparece várias vezes na página e um id
 * repetido dentro de um bloco oculto (display:none) apagaria a pintura dos outros.
 */
function MarkPaths({ uid }: { uid: string }) {
  const metal = `lsm-${uid}`;
  const cells = `lsc-${uid}`;
  return (
    <>
      <defs>
        <linearGradient id={metal} x1="6" y1="8" x2="36" y2="40" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="#FFFFFF" />
          <stop offset=".5" stopColor="#D3D8DC" />
          <stop offset="1" stopColor="#9AA3AA" />
        </linearGradient>
        <clipPath id={cells}>
          <path d="M14.22 13.2 17.29 11.68 20.21 9.69A3.55 3.55 0 0 0 14.22 13.2Z" />
        </clipPath>
      </defs>
      {/* corpo: o recorte em "V" embaixo é o encaixe da seta */}
      <path d="M10 24.6 14.65 20.5 19.96 24.9 24.6 20.25V19.8C24.6 17.9 23 16.7 20.9 16.7H14.3C11.9 16.7 10 18.2 10 20.4Z" fill={`url(#${metal})`} />
      <path d="M1 36.25 14.65 24.55 20.1 28.9 32.4 16.6" stroke={`url(#${metal})`} strokeWidth="3.75" />
      <path d="M38.75 9.25 27.75 12.5 36.75 20.75Z" fill={`url(#${metal})`} />
      <path d="M35.35 9.21A3.25 3.25 0 1 1 39.61 13.05" stroke="#EFFF00" strokeWidth="1.5" />
      {/* cabeça: disco lima com a metade de cima vazada em rede */}
      <path fillRule="evenodd" fill="#EFFF00" d="M17.6 7.85a4.25 4.25 0 1 1 0 8.5a4.25 4.25 0 1 1 0-8.5ZM14.22 13.2 17.29 11.68 20.21 9.69A3.55 3.55 0 0 0 14.22 13.2Z" />
      <path clipPath={`url(#${cells})`} d="M17.4 7.9 14.3 13.3M14 9.9 17.4 11.8M17.4 7.9 18.35 11" stroke="#EFFF00" strokeWidth=".42" />
      <path d="M17.2 12.3 16.72 15.45" stroke="#0A0D0F" strokeWidth=".32" strokeLinecap="round" />
    </>
  );
}

export function LogoMark({ className, boxed }: { className?: string; boxed?: boolean }) {
  const uid = useId().replace(/[^a-zA-Z0-9_-]/g, "");
  if (boxed) {
    return (
      <svg viewBox="0 0 44 44" fill="none" aria-hidden="true" className={cn("size-8 shrink-0", className)}>
        <rect width="44" height="44" rx="10" fill="#0A0D0F" />
        <g transform="translate(4.4 4.4) scale(.8)">
          <MarkPaths uid={uid} />
        </g>
      </svg>
    );
  }
  // Solta: a marca é mais larga que alta — o viewBox recorta a sobra
  return (
    <svg viewBox="0 5 43 34" fill="none" aria-hidden="true" className={cn("h-8 w-[2.53rem] shrink-0", className)}>
      <MarkPaths uid={uid} />
    </svg>
  );
}

/** `boxed` = ícone em quadrado preto (fundos claros); "Scan" acompanha o tema. Solta = superfície escura. */
export function Logo({ className, boxed, tagline }: { className?: string; boxed?: boolean; tagline?: boolean }) {
  return (
    <span className={cn("flex items-center gap-2.5", className)}>
      <LogoMark boxed={boxed} />
      <span className="flex flex-col font-brand leading-none">
        <span className="text-[17px] font-bold tracking-[-0.01em]">
          Lead<span className={boxed ? "text-brand-ink" : "text-lime"}>Scan</span>
        </span>
        {tagline && <span className="mt-1 whitespace-nowrap text-[7px] font-medium tracking-[0.12em] opacity-75">CONECTANDO NEGÓCIOS COM DADOS</span>}
      </span>
    </span>
  );
}
