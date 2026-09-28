"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useRef, useState, useTransition } from "react";
import { toast } from "sonner";
import { setStatus } from "@/app/actions/leads";
import { DemoBadge } from "@/components/common/page-header";
import { StatusDot, WhatsAppButton } from "@/components/leads/lead-actions";
import { useMediaQuery } from "@/hooks/use-media-query";
import { ScoreBadge } from "@/components/leads/score";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger } from "@/components/ui/select";
import { CLOSED_LOST, PIPELINE_COLUMNS, STATUS_META, STATUS_ORDER } from "@/lib/domain/lead-status";
import { formatBRL, formatRelative } from "@/lib/format";
import type { LeadStatus } from "@/lib/generated/prisma/enums";
import type { ScoreTier } from "@/lib/scoring";
import { cn } from "@/lib/utils";

export type BoardLead = {
  id: string;
  name: string;
  categoryLabel: string;
  city: string;
  state: string;
  score: number;
  scoreTier: ScoreTier;
  status: LeadStatus;
  isDemo: boolean;
  phone: string | null;
  whatsapp: string | null;
  dealValue: number | null;
  lastContactAt: Date | null;
};

const ALL_COLUMNS = [...PIPELINE_COLUMNS, "CLOSED" as const];
type ColumnKey = (typeof ALL_COLUMNS)[number];

/**
 * Rolagem do quadro com o mouse:
 *  - clicar e segurar no fundo (fora dos cards) e arrastar para o lado move as colunas, com inércia;
 *  - arrastando um card perto da borda, o quadro rola sozinho (dá para levar até a última coluna);
 *  - os atalhos das etapas no topo pulam direto para a coluna e mostram onde você está.
 * No toque, a rolagem nativa com encaixe (snap) continua valendo.
 */
const noSelect = (e: Event) => e.preventDefault();

function useBoardScroll() {
  const scroller = useRef<HTMLDivElement>(null);
  const pan = useRef<{ x: number; left: number; moved: boolean; id: number; lastX: number; lastT: number; v: number } | null>(null);
  const inertia = useRef(0);
  const suppressClickUntil = useRef(0);
  const dragX = useRef<number | null>(null);
  const edgeRaf = useRef(0);

  const onPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (e.pointerType !== "mouse" || e.button !== 0) return;
    if ((e.target as HTMLElement).closest("article, a, button, input, textarea, select, [role=combobox], [data-no-pan]")) return;
    const el = scroller.current;
    if (!el) return;
    cancelAnimationFrame(inertia.current);
    e.preventDefault(); // sem seleção de texto enquanto arrasta
    pan.current = { x: e.clientX, left: el.scrollLeft, moved: false, id: e.pointerId, lastX: e.clientX, lastT: e.timeStamp, v: 0 };
  };

  const onPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    const p = pan.current;
    const el = scroller.current;
    if (!p || !el) return;
    const dx = e.clientX - p.x;
    if (!p.moved) {
      if (Math.abs(dx) < 4) return;
      p.moved = true;
      el.setPointerCapture(p.id);
      el.dataset.panning = "";
      window.getSelection()?.removeAllRanges();
      document.addEventListener("selectstart", noSelect);
    }
    el.scrollLeft = p.left - dx;
    const dt = e.timeStamp - p.lastT;
    if (dt > 0) p.v = 0.8 * ((e.clientX - p.lastX) / dt) + 0.2 * p.v;
    p.lastX = e.clientX;
    p.lastT = e.timeStamp;
  };

  const endPan = () => {
    const p = pan.current;
    const el = scroller.current;
    pan.current = null;
    if (!p?.moved || !el) return;
    delete el.dataset.panning;
    document.removeEventListener("selectstart", noSelect);
    suppressClickUntil.current = Date.now() + 80;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    let v = Math.max(-45, Math.min(45, -p.v * 16)); // px por quadro, com teto
    const step = () => {
      if (Math.abs(v) < 0.4) return;
      el.scrollLeft += v;
      v *= 0.92;
      inertia.current = requestAnimationFrame(step);
    };
    inertia.current = requestAnimationFrame(step);
  };

  const onClickCapture = (e: React.MouseEvent) => {
    if (Date.now() < suppressClickUntil.current) {
      e.preventDefault();
      e.stopPropagation();
    }
  };

  // Arrastando um card: rola sozinho quando o cursor chega a 80px da borda
  const startEdgeScroll = useCallback(() => {
    const track = (e: DragEvent) => (dragX.current = e.clientX);
    document.addEventListener("dragover", track);
    const tick = () => {
      const el = scroller.current;
      const x = dragX.current;
      if (el && x !== null) {
        const r = el.getBoundingClientRect();
        const zone = 80;
        if (x < r.left + zone) el.scrollLeft -= Math.ceil(((r.left + zone - x) / zone) * 18);
        else if (x > r.right - zone) el.scrollLeft += Math.ceil(((x - (r.right - zone)) / zone) * 18);
      }
      edgeRaf.current = requestAnimationFrame(tick);
    };
    edgeRaf.current = requestAnimationFrame(tick);
    return () => {
      document.removeEventListener("dragover", track);
      cancelAnimationFrame(edgeRaf.current);
      dragX.current = null;
    };
  }, []);

  useEffect(() => () => cancelAnimationFrame(inertia.current), []);

  return { scroller, startEdgeScroll, handlers: { onPointerDown, onPointerMove, onPointerUp: endPan, onPointerCancel: endPan, onClickCapture } };
}

export function PipelineBoard({ leads: initial, defaultTicket }: { leads: BoardLead[]; defaultTicket: number }) {
  const [leads, setLeads] = useState(initial);
  const [dragId, setDragId] = useState<string | null>(null);
  const [over, setOver] = useState<LeadStatus | null>(null);
  const [, start] = useTransition();
  const { scroller, startEdgeScroll, handlers } = useBoardScroll();
  const stopEdge = useRef<(() => void) | null>(null);
  const [visible, setVisible] = useState<Set<ColumnKey>>(() => new Set());
  // Arrastar card só com mouse. No toque, um card "arrastável" disputa o gesto com a rolagem
  // (segurar o dedo começa um arrasto em vez de rolar); lá o seletor de etapa move o card.
  const canDrag = useMediaQuery("(pointer: fine)");

  // Quais colunas estão à vista (os atalhos do topo acendem)
  useEffect(() => {
    const root = scroller.current;
    if (!root) return;
    const io = new IntersectionObserver(
      (entries) =>
        setVisible((cur) => {
          const next = new Set(cur);
          for (const e of entries) {
            const key = (e.target as HTMLElement).dataset.column as ColumnKey;
            if (e.isIntersecting) next.add(key);
            else next.delete(key);
          }
          return next;
        }),
      { root, threshold: 0.6 },
    );
    root.querySelectorAll("[data-column]").forEach((c) => io.observe(c));
    return () => io.disconnect();
  }, [scroller]);

  const goTo = (key: ColumnKey) => {
    const el = scroller.current;
    const col = el?.querySelector<HTMLElement>(`[data-column="${key}"]`);
    if (!el || !col) return;
    el.scrollTo({ left: col.offsetLeft - el.offsetLeft - 4, behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth" });
  };
  const nudge = (dir: 1 | -1) => {
    const el = scroller.current;
    if (!el) return;
    el.scrollBy({ left: dir * Math.min(el.clientWidth * 0.8, 300 * 2), behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth" });
  };

  const move = (id: string, status: LeadStatus) => {
    const lead = leads.find((l) => l.id === id);
    if (!lead || lead.status === status) return;
    const previous = lead.status;
    setLeads((ls) => ls.map((l) => (l.id === id ? { ...l, status } : l)));
    start(async () => {
      const r = await setStatus({ id, status });
      if (!r.ok) {
        setLeads((ls) => ls.map((l) => (l.id === id ? { ...l, status: previous } : l)));
        return void toast.error(r.error);
      }
      toast.success(`${lead.name} → ${STATUS_META[status].label}`, {
        action: { label: "Desfazer", onClick: () => move(id, previous) },
      });
    });
  };

  const dropProps = (status: LeadStatus) => ({
    onDragOver: (e: React.DragEvent) => {
      e.preventDefault();
      setOver(status);
    },
    onDragLeave: () => setOver((o) => (o === status ? null : o)),
    onDrop: (e: React.DragEvent) => {
      e.preventDefault();
      if (dragId) move(dragId, status);
      setDragId(null);
      setOver(null);
    },
  });

  const card = (l: BoardLead) => (
    <article
      key={l.id}
      draggable={canDrag}
      onDragStart={(e) => {
        setDragId(l.id);
        e.dataTransfer.effectAllowed = "move";
        stopEdge.current?.();
        stopEdge.current = startEdgeScroll();
      }}
      onDragEnd={() => {
        setDragId(null);
        setOver(null);
        stopEdge.current?.();
        stopEdge.current = null;
      }}
      className={cn(
        "group relative rounded-md border bg-card p-3 transition-[opacity,border-color] duration-150 hover:border-foreground/25",
        canDrag && "cursor-grab active:cursor-grabbing",
        dragId === l.id && "opacity-40",
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <Link href={`/leads/${l.id}`} className="min-w-0 text-sm font-medium leading-snug after:absolute after:inset-0">
          {l.name}
        </Link>
        <ScoreBadge score={l.score} tier={l.scoreTier} className="relative" />
      </div>
      <p className="mt-1 truncate text-xs text-muted-foreground">
        {l.categoryLabel} · {l.city}
      </p>
      <div className="relative z-10 mt-3 flex items-center gap-2">
        {l.isDemo && <DemoBadge />}
        <span className="text-xs text-muted-foreground">{l.lastContactAt ? formatRelative(l.lastContactAt) : "sem contato"}</span>
        <div className="ml-auto flex items-center gap-1">
          {/* No toque não há arrastar: o seletor move o card */}
          <Select value={l.status} onValueChange={(v) => move(l.id, v as LeadStatus)}>
            <SelectTrigger size="sm" className="size-7 justify-center border-transparent px-0 shadow-none pointer-coarse:size-9 [&>svg:last-child]:hidden md:hidden" aria-label="Mover para etapa">
              <StatusDot status={l.status} />
            </SelectTrigger>
            <SelectContent align="end">
              {STATUS_ORDER.map((s) => (
                <SelectItem key={s} value={s}>
                  <StatusDot status={s} /> {STATUS_META[s].label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <WhatsAppButton lead={l} iconOnly size="icon-xs" />
        </div>
      </div>
    </article>
  );

  const columnValue = (status: LeadStatus) =>
    leads.filter((l) => l.status === status).reduce((s, l) => s + (l.dealValue ?? defaultTicket), 0);

  const countOf = (key: ColumnKey) => (key === "CLOSED" ? leads.filter((l) => CLOSED_LOST.includes(l.status)).length : leads.filter((l) => l.status === key).length);

  return (
    <div>
      {/* atalhos das etapas: pular direto para uma coluna */}
      <div className="mb-3 flex items-center gap-2">
        <nav aria-label="Ir para a etapa" className="flex min-w-0 flex-1 gap-1.5 overflow-x-auto pb-1 [scrollbar-width:none]">
          {ALL_COLUMNS.map((key) => (
            <button
              key={key}
              type="button"
              onClick={() => goTo(key)}
              aria-current={visible.has(key) ? "true" : undefined}
              className={cn(
                "inline-flex shrink-0 items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium text-muted-foreground transition-colors hover:text-foreground pointer-coarse:py-2",
                visible.has(key) && "border-foreground/30 bg-card text-foreground shadow-soft",
              )}
            >
              {key === "CLOSED" ? <span className="inline-block size-2 rounded-full border border-muted-foreground" aria-hidden /> : <StatusDot status={key} />}
              {key === "CLOSED" ? "Não interessados e perdidos" : STATUS_META[key].column}
              <span className="tabular opacity-70">{countOf(key)}</span>
            </button>
          ))}
        </nav>
        <div className="hidden shrink-0 items-center gap-1 md:flex">
          <Button variant="outline" size="icon-sm" onClick={() => nudge(-1)} aria-label="Ver colunas à esquerda">
            <ChevronLeft />
          </Button>
          <Button variant="outline" size="icon-sm" onClick={() => nudge(1)} aria-label="Ver colunas à direita">
            <ChevronRight />
          </Button>
        </div>
      </div>
      <p className="mb-2 hidden text-xs text-muted-foreground md:block">Dica: clique e segure no fundo do quadro e arraste para o lado.</p>

    <div
      ref={scroller}
      {...handlers}
      className="flex snap-x snap-proximity gap-3 overflow-x-auto overscroll-x-contain pb-4 pointer-fine:cursor-grab data-[panning]:cursor-grabbing data-[panning]:select-none md:snap-none"
    >
      {PIPELINE_COLUMNS.map((status) => {
        const items = leads.filter((l) => l.status === status).sort((a, b) => b.score - a.score);
        return (
          <section
            key={status}
            data-column={status}
            {...dropProps(status)}
            className={cn(
              "flex w-[82vw] max-w-72 shrink-0 snap-start flex-col rounded-lg bg-muted/60 transition-colors duration-150 sm:w-72",
              over === status && "bg-brand-soft ring-1 ring-brand/40",
            )}
            aria-label={STATUS_META[status].column}
          >
            <header className="flex items-center gap-2 px-3 py-2.5">
              <StatusDot status={status} />
              <h2 className="text-sm font-semibold">{STATUS_META[status].column}</h2>
              <span className="text-xs text-muted-foreground tabular">{items.length}</span>
              {items.length > 0 && status !== "NEW" && (
                <span className="ml-auto text-[11px] text-muted-foreground tabular" title="Valor estimado">
                  {formatBRL(columnValue(status))}
                </span>
              )}
            </header>
            <div className="grid content-start gap-2 px-2 pb-2">
              {items.map(card)}
              {items.length === 0 && <p className="rounded-md border border-dashed px-3 py-6 text-center text-xs text-muted-foreground">Arraste um lead para cá</p>}
            </div>
          </section>
        );
      })}
      <section data-column="CLOSED" className="flex w-[82vw] max-w-64 shrink-0 snap-start flex-col gap-3 sm:w-64">
        {CLOSED_LOST.map((status) => {
          const items = leads.filter((l) => l.status === status);
          return (
            <div
              key={status}
              {...dropProps(status)}
              className={cn("rounded-lg border border-dashed transition-colors duration-150", over === status && "border-brand-ink bg-brand-soft")}
            >
              <header className="flex items-center gap-2 px-3 py-2.5">
                <StatusDot status={status} />
                <h2 className="text-sm font-medium text-muted-foreground">{STATUS_META[status].column}</h2>
                <span className="text-xs text-muted-foreground tabular">{items.length}</span>
              </header>
              {items.length > 0 && <div className="grid gap-2 px-2 pb-2 opacity-70">{items.slice(0, 5).map(card)}</div>}
            </div>
          );
        })}
      </section>
    </div>
    </div>
  );
}
