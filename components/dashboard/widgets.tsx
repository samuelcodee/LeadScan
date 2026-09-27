import { cn } from "@/lib/utils";
import { formatInt, formatPercent } from "@/lib/format";

/** Stat tile: rótulo · valor (algarismos proporcionais) · contexto opcional em tinta neutra. */
export function StatTile({ label, value, context, className }: { label: string; value: string; context?: string; className?: string }) {
  return (
    <div className={cn("rounded-lg border bg-card px-5 py-4 shadow-soft transition-shadow duration-200 hover:shadow-premium", className)}>
      <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">{label}</p>
      <p className="mt-2 text-[26px] font-bold leading-none tracking-tight">{value}</p>
      {context && <p className="mt-2 truncate text-xs text-muted-foreground">{context}</p>}
    </div>
  );
}

type Step = { key: string; label: string; value: number };

/** Passagem da etapa anterior → nível de calor (0 = ok; 3 = perda muito alta). */
function lossLevel(pass: number | null): 0 | 1 | 2 | 3 {
  if (pass === null) return 0;
  return pass >= 0.4 ? 0 : pass >= 0.25 ? 1 : pass >= 0.1 ? 2 : 3;
}
const HEAT_BG = ["bg-chart-1", "bg-heat-1", "bg-heat-2", "bg-heat-3"] as const;
const LOSS_LABEL = ["", "perda moderada", "perda alta", "perda muito alta"];
/** Encontrados → Alto potencial é classificação, não desempenho: essa passagem não esquenta. */
const NOT_JUDGED = new Set(["found", "qualified"]);

/**
 * Funil horizontal — uma série (magnitude), sem legenda de série.
 * Barras ≤ 24px, ponta arredondada 4px e base reta, valor na ponta em tinta de texto.
 * Etapa com muita perda em relação à anterior esquenta (âmbar → vermelho), com o
 * percentual e o texto da perda ao lado — a cor nunca é o único sinal.
 * Hover/foco mostra a taxa de passagem; a tabela sr-only dá a leitura completa.
 */
export function Funnel({ steps }: { steps: Step[] }) {
  const max = Math.max(1, ...steps.map((s) => s.value));
  const anyHot = steps.some((s, i) => i > 0 && !NOT_JUDGED.has(s.key) && steps[i - 1].value > 0 && lossLevel(s.value / steps[i - 1].value) > 0);
  return (
    <figure>
      <ol className="grid gap-3" aria-hidden>
        {steps.map((s, i) => {
          const prev = i > 0 ? steps[i - 1].value : null;
          const pass = prev ? s.value / prev : null;
          const loss = NOT_JUDGED.has(s.key) ? 0 : lossLevel(pass);
          const width = Math.max(s.value > 0 ? 1.5 : 0, (s.value / max) * 100);
          const tip = `${s.label}: ${formatInt(s.value)}${pass !== null ? ` · ${formatPercent(pass)} da etapa anterior` : ""}${loss ? ` · ${LOSS_LABEL[loss]}` : ""}`;
          return (
            <li key={s.key} className="group relative grid grid-cols-[7.5rem_minmax(0,1fr)] items-center gap-3 sm:grid-cols-[9rem_minmax(0,1fr)]">
              <span className="truncate text-sm text-muted-foreground">{s.label}</span>
              {/* alvo de hover maior que a barra: a linha inteira */}
              {/* lista é aria-hidden (leitores de tela usam a tabela abaixo), então nada focável aqui */}
              <div className="relative flex h-6 min-w-0 items-center">
                {/* a barra usa a largura que sobra depois do número (nunca empurra a tela no celular) */}
                <div className={cn("h-5 shrink-0 rounded-r-[4px] transition-opacity duration-150 group-hover:opacity-85", HEAT_BG[loss])} style={{ width: `calc((100% - 5.5rem) * ${width / 100})` }} />
                <span className="ml-2 shrink-0 text-sm font-semibold tabular">{formatInt(s.value)}</span>
                {pass !== null && (
                  <span className="ml-2 hidden shrink-0 text-xs text-muted-foreground sm:inline">
                    {formatPercent(pass)}
                    {loss > 0 && <span className="ml-1">· {LOSS_LABEL[loss]}</span>}
                  </span>
                )}
                <span
                  role="tooltip"
                  className="pointer-events-none absolute -top-9 left-0 z-10 hidden whitespace-nowrap rounded-md border bg-popover px-2.5 py-1.5 text-xs text-popover-foreground shadow-md group-hover:block"
                >
                  {tip}
                </span>
              </div>
            </li>
          );
        })}
      </ol>
      {anyHot && (
        <figcaption className="mt-4 flex items-center gap-2 text-xs text-muted-foreground">
          <span className="h-2.5 w-5 shrink-0 rounded-[3px]" style={{ background: "linear-gradient(90deg, var(--heat-1), var(--heat-2), var(--heat-3))" }} aria-hidden />
          Barra quente = etapa que perdeu muita gente da anterior (quanto mais quente, maior a perda)
        </figcaption>
      )}
      {/* table ignora width:1px do sr-only e empurraria a página: o div é que fica oculto */}
      <div className="sr-only">
      <table>
        <caption>Funil de prospecção</caption>
        <thead>
          <tr>
            <th>Etapa</th>
            <th>Leads</th>
            <th>Passagem da etapa anterior</th>
          </tr>
        </thead>
        <tbody>
          {steps.map((s, i) => (
            <tr key={s.key}>
              <td>{s.label}</td>
              <td>{s.value}</td>
              <td>{i > 0 && steps[i - 1].value ? formatPercent(s.value / steps[i - 1].value) : "—"}</td>
            </tr>
          ))}
        </tbody>
      </table>
      </div>
    </figure>
  );
}
