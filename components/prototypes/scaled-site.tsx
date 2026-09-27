"use client";

import { useEffect, useRef, useState } from "react";
import { SiteRenderer } from "@/components/site/site-renderer";
import type { SiteSpec } from "@/lib/templates/types";
import { cn } from "@/lib/utils";

/**
 * Miniatura de um protótipo: renderiza o site na largura real (1280px) e reduz
 * com transform para caber na caixa. Só as primeiras seções — é uma vitrine, não o site todo.
 * Só monta quando o card chega perto da tela: uma lista com 60 protótipos não desenha
 * 60 sites de uma vez (nem baixa 60 fotos de capa).
 * Dica: no servidor, passe `previewSpec(spec)` (lib/templates/preview.ts) — menos dados e fotos menores.
 */
export function ScaledSite({
  spec,
  width = 1280,
  sections = 2,
  className,
  eager,
}: {
  spec: SiteSpec;
  width?: number;
  sections?: number;
  className?: string;
  /** acima da dobra (vitrine da home): desenha já, sem esperar o observador */
  eager?: boolean;
}) {
  const box = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(0);
  const [near, setNear] = useState(!!eager);

  useEffect(() => {
    const el = box.current;
    if (!el) return;
    const ro = new ResizeObserver(([entry]) => setScale(entry.contentRect.width / width));
    ro.observe(el);
    if (eager) return () => ro.disconnect();
    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          setNear(true);
          io.disconnect();
        }
      },
      { rootMargin: "400px 0px" },
    );
    io.observe(el);
    return () => {
      ro.disconnect();
      io.disconnect();
    };
  }, [width, eager]);

  const trimmed = { ...spec, sections: spec.sections.filter((s) => s.visible).slice(0, sections) };
  return (
    <div ref={box} className={cn("relative aspect-[16/10] overflow-hidden bg-muted", className)} aria-hidden inert>
      {scale > 0 && near && (
        <div className="absolute left-0 top-0 origin-top-left" style={{ width, transform: `scale(${scale})` }}>
          <SiteRenderer spec={trimmed} mode="embedded" />
        </div>
      )}
    </div>
  );
}
