import { Flame, Check, Minus, X } from "lucide-react";
import { TIER_LABEL, type ScoreReason, type ScoreTier } from "@/lib/scoring";
import { cn } from "@/lib/utils";

const TIER_STYLE: Record<ScoreTier, string> = {
  HIGH: "bg-success-soft text-success border-success/20",
  MEDIUM: "bg-warning-soft text-warning border-warning/25",
  LOW: "bg-muted text-muted-foreground border-border",
};

const TIER_SHORT: Record<ScoreTier, string> = { HIGH: "Alta", MEDIUM: "Média", LOW: "Baixa" };

/** "87 · Alta" — o número vem primeiro porque é o que o olho compara numa lista. */
export function ScoreBadge({ score, tier, className }: { score: number; tier: ScoreTier; className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex h-6 shrink-0 items-center gap-1 whitespace-nowrap rounded-md border px-1.5 text-xs font-medium tabular",
        TIER_STYLE[tier],
        className,
      )}
      title={`Potencial de prospecção: ${score}/100 (${TIER_LABEL[tier].toLowerCase()})`}
    >
      {tier === "HIGH" && <Flame className="size-3" aria-hidden />}
      <span className="font-mono font-semibold">{score}</span>
      <span className="opacity-80">· {TIER_SHORT[tier]}</span>
    </span>
  );
}

export function ScoreMeter({ score, tier }: { score: number; tier: ScoreTier }) {
  return (
    <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted" role="presentation">
      <div
        className={cn("h-full rounded-full", tier === "HIGH" ? "bg-chart-1" : tier === "MEDIUM" ? "bg-warning" : "bg-muted-foreground/50")}
        style={{ width: `${score}%` }}
      />
    </div>
  );
}

/** Bloco completo: número grande + "Por quê?" com os motivos. */
export function ScoreBreakdown({ score, tier, reasons, compact }: { score: number; tier: ScoreTier; reasons: ScoreReason[]; compact?: boolean }) {
  const shown = reasons.filter((r) => r.kind !== "neutral" || !compact);
  return (
    <div>
      <div className="flex items-end justify-between gap-3">
        <div>
          <p className="text-xs font-medium text-muted-foreground">Potencial de prospecção</p>
          <p className="mt-1 flex items-baseline gap-1.5">
            <span className="font-mono text-3xl font-semibold tracking-tight tabular">{score}</span>
            <span className="text-sm text-muted-foreground">/100</span>
          </p>
        </div>
        <span
          className={cn(
            "mb-1 inline-flex items-center gap-1 rounded-md border px-2 py-0.5 text-xs font-semibold uppercase tracking-wide",
            TIER_STYLE[tier],
          )}
        >
          {tier === "HIGH" && <Flame className="size-3.5" aria-hidden />}
          {TIER_LABEL[tier]}
        </span>
      </div>
      <div className="mt-3">
        <ScoreMeter score={score} tier={tier} />
      </div>
      <p className="mt-4 text-xs font-medium text-muted-foreground">Por quê?</p>
      <ul className="mt-2 space-y-1.5">
        {shown.map((r) => (
          <li key={r.key} className="flex items-start gap-2 text-sm">
            <span
              className={cn(
                "mt-0.5 grid size-4 shrink-0 place-items-center rounded-full",
                r.kind === "positive" && "bg-success-soft text-success",
                r.kind === "negative" && "bg-destructive/10 text-destructive",
                r.kind === "neutral" && "bg-muted text-muted-foreground",
              )}
              aria-hidden
            >
              {r.kind === "positive" ? <Check className="size-3" /> : r.kind === "negative" ? <X className="size-3" /> : <Minus className="size-3" />}
            </span>
            <span className={cn("leading-snug", r.kind === "neutral" && "text-muted-foreground")}>{r.label}</span>
          </li>
        ))}
      </ul>
      <p className="mt-3 text-[11px] leading-relaxed text-muted-foreground">
        Estimativa baseada em sinais públicos. Serve para priorizar, não é garantia de venda.
      </p>
    </div>
  );
}
