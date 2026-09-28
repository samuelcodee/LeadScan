"use client";

import { memo, useEffect, useRef, useState } from "react";
import { SiteRenderer } from "@/components/site/site-renderer";
import { slugify } from "@/lib/format";
import type { SiteSpec } from "@/lib/templates/types";
import { cn } from "@/lib/utils";

export type Device = "desktop" | "tablet" | "mobile";
export const DEVICE_WIDTH: Record<Device, number> = { desktop: 1280, tablet: 768, mobile: 390 };

/**
 * Quadro de preview. O site é renderizado na largura real do dispositivo e reduzido
 * para caber (transform), então as container queries do site respondem como num
 * aparelho de verdade. O próprio quadro é a área de rolagem.
 * memo: no estúdio o site só redesenha quando o spec (adiado) muda, não a cada tecla.
 */
export const DevicePreview = memo(function DevicePreview({
  spec,
  device,
  selectedId,
  onSelectSection,
  focus,
  className,
  bare,
}: {
  spec: SiteSpec;
  device: Device;
  selectedId?: string | null;
  onSelectSection?: (id: string) => void;
  /** Rola o quadro até esta seção (n muda a cada pedido, para repetir a mesma seção). */
  focus?: { id: string; n: number } | null;
  className?: string;
  /** Sem moldura e sem margem: o site ocupa o quadro todo (ex.: formato celular visto num celular). */
  bare?: boolean;
}) {
  const stage = useRef<HTMLDivElement>(null);
  const scroller = useRef<HTMLDivElement>(null);
  const [box, setBox] = useState({ w: 0, h: 0 });

  useEffect(() => {
    const el = stage.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) => setBox({ w: e.contentRect.width, h: e.contentRect.height }));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const width = DEVICE_WIDTH[device];
  const chrome = device === "desktop" && !bare ? 36 : 0;
  const pad = device === "desktop" || bare ? 0 : 20;
  const scale = box.w ? Math.min(1, (box.w - pad * 2) / width) : 0;
  const ready = scale > 0;

  // Seção pedida pelo editor: leva o quadro até ela (abaixo do cabeçalho fixo do site)
  useEffect(() => {
    const el = scroller.current;
    if (!focus || !ready || !el) return;
    const target = el.querySelector<HTMLElement>(`[data-section-id="${CSS.escape(focus.id)}"]`);
    if (!target) return;
    const smooth = !window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    el.scrollTo({ top: Math.max(0, target.offsetTop - 64), behavior: smooth ? "smooth" : "auto" });
  }, [focus, ready]);

  // Altura do "aparelho": mobile tem proporção de celular; tablet/desktop ocupam a altura disponível
  const frameH = bare
    ? Math.max(320, box.h / (scale || 1))
    : device === "mobile"
      ? Math.min(844, (box.h - pad * 2) / scale || 844)
      : Math.max(480, (box.h - pad * 2 - chrome * scale) / (scale || 1));
  const domain = `www.${slugify(spec.business.name).replace(/-/g, "") || "seusite"}.com.br`;

  return (
    <div ref={stage} className={cn("relative h-full w-full overflow-hidden", className)}>
      {ready && (
        <div className="absolute left-1/2 top-0 origin-top" style={{ width, transform: `translateX(-50%) scale(${scale})`, marginTop: pad }}>
          <div
            className={cn(
              "overflow-hidden bg-white shadow-[0_1px_2px_rgba(0,0,0,0.06),0_12px_40px_-12px_rgba(0,0,0,0.25)]",
              !bare && device === "mobile" && "rounded-[44px] border-[10px] border-neutral-900",
              !bare && device === "tablet" && "rounded-[28px] border-[12px] border-neutral-900",
              !bare && device === "desktop" && "rounded-lg border border-black/10",
              bare && "shadow-none",
            )}
          >
            {device === "desktop" && !bare && (
              <div className="flex h-9 items-center gap-3 border-b border-black/10 bg-neutral-100 px-3" aria-hidden>
                <div className="flex gap-1.5">
                  <span className="size-2.5 rounded-full bg-neutral-300" />
                  <span className="size-2.5 rounded-full bg-neutral-300" />
                  <span className="size-2.5 rounded-full bg-neutral-300" />
                </div>
                <div className="mx-auto w-80 truncate rounded bg-white px-3 py-0.5 text-center text-[11px] text-neutral-500">{domain}</div>
              </div>
            )}
            <div
              ref={scroller}
              className="overflow-y-auto overscroll-contain"
              style={{ height: frameH }}
              onClick={(e) => {
                const target = (e.target as HTMLElement).closest("[data-section-id]");
                if (target && onSelectSection) onSelectSection(target.getAttribute("data-section-id")!);
              }}
            >
              <SiteRenderer spec={spec} mode="embedded" selectedId={selectedId} editable={!!onSelectSection} />
            </div>
          </div>
        </div>
      )}
    </div>
  );
});
