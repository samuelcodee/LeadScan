"use client";

import { useEffect, useId, useMemo, useRef, useState } from "react";
import { cn } from "@/lib/utils";

/**
 * Gráfico de série temporal sem biblioteca (SVG + HTML).
 *  - kind "area": linha 2px + área suave (faturamento). kind "bar": barras finas com ponta 4px.
 *  - Várias séries em "bar" viram barras agrupadas (máx. 3; cores fixas por série, nunca por posição).
 *  - Hover/toque: guia vertical + tooltip com todas as séries do ponto. Setas ←/→ navegam pelo teclado.
 *  - Tabela sr-only com os mesmos números.
 *  - Calor (quanto pior, mais quente — âmbar → laranja → vermelho):
 *      tone "bad"  = série ruim por natureza (ex.: recusados): quanto maior a barra, mais quente;
 *      heat        = nas séries boas, semana abaixo da média esquenta; semana zerada vira um toco vermelho.
 *    A cor nunca fala sozinha: legenda, frase-resumo embaixo e tooltip dizem o mesmo em texto.
 *    partialLast = a última barra é a semana atual (incompleta) e fica fora do cálculo.
 */
export type SeriesDef = { key: string; label: string; color: string; tone?: "good" | "bad" };
export type Point = { label: string; values: Record<string, number> };

const COLORS = ["var(--chart-1)", "var(--chart-3)", "var(--chart-2)"];
const HEAT = ["", "var(--heat-1)", "var(--heat-2)", "var(--heat-3)"] as const;
const HEAT_SWATCH = "linear-gradient(90deg, var(--heat-1), var(--heat-2), var(--heat-3))";
type Level = 0 | 1 | 2 | 3;

function niceMax(v: number) {
  if (v <= 0) return 1;
  const exp = 10 ** Math.floor(Math.log10(v));
  const f = v / exp;
  const nice = f <= 1 ? 1 : f <= 2 ? 2 : f <= 2.5 ? 2.5 : f <= 5 ? 5 : 10;
  return nice * exp;
}

export function TimeChart({
  points,
  series,
  kind = "bar",
  format,
  height = 200,
  title,
  className,
  heat,
  partialLast,
}: {
  points: Point[];
  series: { key: string; label: string; tone?: "good" | "bad" }[];
  kind?: "bar" | "area";
  format: "brl" | "int";
  height?: number;
  title: string;
  className?: string;
  heat?: boolean;
  partialLast?: boolean;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(0);
  const [active, setActive] = useState<number | null>(null);
  const gradId = useId();
  const defs: SeriesDef[] = series.map((s, i) => ({ ...s, color: COLORS[i % COLORS.length] }));
  const heatOn = kind === "bar" && (!!heat || defs.some((s) => s.tone === "bad"));

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) => setWidth(Math.round(e.contentRect.width)));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const fmt = useMemo(() => {
    const brl = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });
    const brlCompact = new Intl.NumberFormat("pt-BR", { notation: "compact", maximumFractionDigits: 1 });
    const int = new Intl.NumberFormat("pt-BR");
    return {
      full: (v: number) => (format === "brl" ? brl.format(v / 100) : int.format(v)),
      axis: (v: number) => (format === "brl" ? `R$ ${brlCompact.format(v / 100)}` : brlCompact.format(v)),
    };
  }, [format]);

  const padL = 52;
  const padR = 8;
  const padT = 10;
  const padB = 24;
  const innerW = Math.max(0, width - padL - padR);
  const innerH = height - padT - padB;
  const max = niceMax(Math.max(0, ...points.flatMap((p) => defs.map((s) => p.values[s.key] ?? 0))));
  const n = points.length;
  const step = n > 0 ? innerW / n : 0;
  const y = (v: number) => padT + innerH - (v / max) * innerH;
  const xCenter = (i: number) => padL + step * i + step / 2;
  const empty = points.every((p) => defs.every((s) => !p.values[s.key]));
  // Sem dados: só a linha de base (três "R$ 0" no eixo não dizem nada)
  // Contagens: sem marca fracionada no eixo (ex.: "2,5 vendas")
  const ticks = empty ? [0] : format === "int" && max % 2 !== 0 ? [0, max] : [0, 0.5, 1].map((t) => t * max);
  const labelEvery = Math.max(1, Math.ceil(n / Math.max(1, Math.floor(innerW / 56))));

  // Média (séries boas) e pico (séries ruins) de cada série, sem a semana em andamento
  const stats = defs.map((s) => {
    const vals = points.map((p) => p.values[s.key] ?? 0);
    const full = partialLast ? vals.slice(0, -1) : vals;
    // pico inclui a semana atual: recusa é ruim mesmo com a semana pela metade
    return { mean: full.reduce((a, b) => a + b, 0) / Math.max(1, full.length), peak: Math.max(0, ...vals) };
  });
  const level = (si: number, i: number, v: number): Level => {
    if (!heatOn) return 0;
    if (defs[si].tone === "bad") {
      if (v <= 0 || stats[si].peak <= 0) return 0;
      const r = v / stats[si].peak;
      return r > 0.67 ? 3 : r > 0.34 ? 2 : 1;
    }
    // semana em andamento não é comparada com a média (ainda não acabou)
    if (!heat || (partialLast && i === n - 1) || stats[si].mean <= 0) return 0;
    // zerar só pesa em série que costuma ter pelo menos 1 por semana
    if (v <= 0) return stats[si].mean >= 1 ? 3 : 0;
    const r = v / stats[si].mean;
    return r >= 1 ? 0 : r >= 0.66 ? 1 : r >= 0.33 ? 2 : 3;
  };
  const hotGood = heat && defs.some((s, si) => s.tone !== "bad" && points.some((p, i) => level(si, i, p.values[s.key] ?? 0) > 0));
  const barColor = (si: number, i: number, v: number) => {
    const l = level(si, i, v);
    return l ? HEAT[l] : defs[si].color;
  };
  const statusText = (si: number, i: number, v: number) => {
    if (!heatOn) return null;
    if (defs[si].tone === "bad") return v > 0 && v === stats[si].peak ? "a pior do período" : null;
    if (partialLast && i === n - 1) return "semana em andamento";
    if (!heat || stats[si].mean <= 0) return null;
    if (v === 0) return stats[si].mean >= 1 ? "nada nesta semana" : null;
    return ["na média ou acima", "um pouco abaixo da média", "bem abaixo da média", "muito abaixo da média"][level(si, i, v)];
  };
  const shortLabel = (s: SeriesDef) => s.label.split(" · ")[0];
  // Frase-resumo: a mesma informação da cor, em texto
  const closed = points.map((_, i) => i).filter((i) => !(partialLast && i === n - 1));
  const summary = heatOn
    ? defs
        .map((s, si) => {
          const val = (i: number) => points[i].values[s.key] ?? 0;
          if (s.tone === "bad") {
            if (stats[si].peak <= 0) return null;
            const worst = points.findIndex((p) => (p.values[s.key] ?? 0) === stats[si].peak);
            return `${shortLabel(s)}: pior semana ${points[worst].label}${partialLast && worst === n - 1 ? " (a atual)" : ""} com ${fmt.full(val(worst))}`;
          }
          if (!heat || stats[si].mean <= 0) return null;
          const below = closed.filter((i) => level(si, i, val(i)) > 0);
          if (!below.length) return stats[si].mean >= 1 ? `${shortLabel(s)}: nenhuma semana abaixo da média` : null;
          const worst = below.reduce((w, i) => (val(i) < val(w) ? i : w));
          const mean = new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 1 }).format(stats[si].mean);
          return `${shortLabel(s)}: ${below.length} de ${closed.length} semanas abaixo da média (${mean}); a mais fraca foi ${points[worst].label}`;
        })
        .filter(Boolean)
        .join(" · ")
    : "";

  const onMove = (clientX: number) => {
    const rect = ref.current?.getBoundingClientRect();
    if (!rect || !step) return;
    const i = Math.floor((clientX - rect.left - padL) / step);
    setActive(i >= 0 && i < n ? i : null);
  };

  const groupW = Math.min(step * 0.64, defs.length * 22);
  const barW = Math.max(3, (groupW - (defs.length - 1) * 2) / defs.length);

  return (
    <figure className={cn("relative", className)}>
      {(defs.length > 1 || heatOn) && (
        <figcaption className="mb-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
          {defs.map((s) => {
            const hot = s.tone === "bad" && heatOn;
            return (
              <span key={s.key} className="inline-flex items-center gap-1.5">
                <span className={cn("h-2.5 rounded-[3px]", hot ? "w-5" : "w-2.5")} style={{ background: hot ? HEAT_SWATCH : s.color }} aria-hidden />
                {s.label}
                {hot && <span className="opacity-80">(quanto mais, mais quente)</span>}
              </span>
            );
          })}
          {hotGood && kind === "bar" && (
            <span className="inline-flex items-center gap-1.5">
              <span className="h-2.5 w-5 rounded-[3px]" style={{ background: HEAT_SWATCH }} aria-hidden />
              Abaixo da média (quanto mais quente, pior)
            </span>
          )}
        </figcaption>
      )}
      <div
        ref={ref}
        className="relative outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
        style={{ height }}
        tabIndex={0}
        role="img"
        aria-label={`${title}. Use as setas para ver cada ponto.`}
        onMouseMove={(e) => onMove(e.clientX)}
        onMouseLeave={() => setActive(null)}
        onTouchStart={(e) => onMove(e.touches[0].clientX)}
        onTouchMove={(e) => onMove(e.touches[0].clientX)}
        onKeyDown={(e) => {
          if (e.key === "ArrowRight") setActive((a) => Math.min(n - 1, (a ?? -1) + 1));
          else if (e.key === "ArrowLeft") setActive((a) => Math.max(0, (a ?? n) - 1));
          else if (e.key === "Escape") setActive(null);
          else return;
          e.preventDefault();
        }}
        onBlur={() => setActive(null)}
      >
        {width > 0 && (
          <svg width={width} height={height} className="block overflow-visible" aria-hidden>
            <defs>
              <linearGradient id={gradId} x1="0" x2="0" y1="0" y2="1">
                <stop offset="0%" stopColor={defs[0]?.color} stopOpacity={0.22} />
                <stop offset="100%" stopColor={defs[0]?.color} stopOpacity={0} />
              </linearGradient>
            </defs>
            {ticks.map((t) => (
              <g key={t}>
                <line x1={padL} x2={width - padR} y1={y(t)} y2={y(t)} className="stroke-border" strokeDasharray={t === 0 ? undefined : "2 4"} />
                <text x={padL - 8} y={y(t)} dy="0.32em" textAnchor="end" className="fill-muted-foreground text-[11px] tabular">
                  {fmt.axis(t)}
                </text>
              </g>
            ))}
            {points.map((p, i) =>
              i % labelEvery === 0 ? (
                <text key={p.label + i} x={xCenter(i)} y={height - 6} textAnchor="middle" className="fill-muted-foreground text-[11px]">
                  {p.label}
                </text>
              ) : null,
            )}

            {active !== null && <rect x={padL + step * active} y={padT} width={step} height={innerH} className="fill-muted" opacity={kind === "bar" ? 0.7 : 0} />}

            {kind === "bar" &&
              points.map((p, i) =>
                defs.map((s, si) => {
                  const v = p.values[s.key] ?? 0;
                  const x = xCenter(i) - groupW / 2 + si * (barW + 2);
                  if (v <= 0) {
                    // semana zerada numa série boa com calor: toco vermelho na base
                    if (level(si, i, v) !== 3) return null;
                    return <rect key={s.key + i} x={x} y={padT + innerH - 3} width={barW} height={3} rx={1.5} fill={HEAT[3]} opacity={active === null || active === i ? 1 : 0.55} />;
                  }
                  const h = Math.max(2, innerH - (y(v) - padT));
                  const r = Math.min(4, barW / 2, h);
                  // ponta arredondada, base reta
                  const top = padT + innerH - h;
                  return (
                    <path
                      key={s.key + i}
                      d={`M${x},${padT + innerH} V${top + r} Q${x},${top} ${x + r},${top} H${x + barW - r} Q${x + barW},${top} ${x + barW},${top + r} V${padT + innerH} Z`}
                      fill={barColor(si, i, v)}
                      opacity={(active === null || active === i ? 1 : 0.55) * (partialLast && i === n - 1 ? 0.6 : 1)}
                    />
                  );
                }),
              )}

            {kind === "area" && n > 0 && (
              <>
                <path
                  d={`M${xCenter(0)},${padT + innerH} ${points.map((p, i) => `L${xCenter(i)},${y(p.values[defs[0].key] ?? 0)}`).join(" ")} L${xCenter(n - 1)},${padT + innerH} Z`}
                  fill={`url(#${gradId})`}
                />
                <path
                  d={points.map((p, i) => `${i ? "L" : "M"}${xCenter(i)},${y(p.values[defs[0].key] ?? 0)}`).join(" ")}
                  fill="none"
                  stroke={defs[0].color}
                  strokeWidth={2}
                  strokeLinejoin="round"
                  strokeLinecap="round"
                />
                {active !== null && (
                  <>
                    <line x1={xCenter(active)} x2={xCenter(active)} y1={padT} y2={padT + innerH} className="stroke-foreground/30" />
                    <circle cx={xCenter(active)} cy={y(points[active].values[defs[0].key] ?? 0)} r={4.5} fill={defs[0].color} className="stroke-card" strokeWidth={2} />
                  </>
                )}
              </>
            )}
          </svg>
        )}

        {empty && width > 0 && (
          <p className="absolute inset-x-0 top-1/2 -translate-y-1/2 text-center text-sm text-muted-foreground">Ainda sem dados neste período.</p>
        )}

        {active !== null && width > 0 && (
          <div
            role="status"
            className="pointer-events-none absolute top-0 z-10 min-w-36 -translate-x-1/2 rounded-md border bg-popover px-3 py-2 text-xs text-popover-foreground shadow-md"
            style={{ left: Math.min(Math.max(xCenter(active), 80), width - 80) }}
          >
            <p className="font-medium">{points[active].label}</p>
            {defs.map((s, si) => {
              const v = points[active].values[s.key] ?? 0;
              const note = statusText(si, active, v);
              return (
                <div key={s.key} className="mt-1">
                  <p className="flex items-center justify-between gap-4">
                    <span className="inline-flex items-center gap-1.5 text-muted-foreground">
                      {(defs.length > 1 || heatOn) && <span className="size-2 rounded-[2px]" style={{ background: kind === "bar" ? barColor(si, active, v) : s.color }} />}
                      {shortLabel(s)}
                    </span>
                    <span className="font-semibold tabular">{fmt.full(v)}</span>
                  </p>
                  {note && <p className="text-[11px] text-muted-foreground">{note}</p>}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {summary && <p className="mt-2 text-xs leading-relaxed text-muted-foreground">{summary}.</p>}

      {/* table ignora width:1px do sr-only e empurraria a página: o div é que fica oculto */}
      <div className="sr-only">
      <table>
        <caption>{title}</caption>
        <thead>
          <tr>
            <th>Período</th>
            {defs.map((s) => (
              <th key={s.key}>{s.label}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {points.map((p, i) => (
            <tr key={p.label + i}>
              <td>{p.label}</td>
              {defs.map((s) => (
                <td key={s.key}>{fmt.full(p.values[s.key] ?? 0)}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
      </div>
    </figure>
  );
}
