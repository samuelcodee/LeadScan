"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { setRankingOptIn } from "@/app/actions/finance";
import { DemoBadge } from "@/components/common/page-header";
import { LevelBadge, UserAvatar } from "@/components/profile/identity";
import { badgeKeyFor } from "@/lib/gamification/levels";
import { Button } from "@/components/ui/button";
import { formatBRL, formatInt } from "@/lib/format";
import { cn } from "@/lib/utils";

export type RankRow = {
  userId: string;
  position: number;
  points: number;
  revenueCents: number;
  sales: number;
  name: string;
  username: string | null;
  avatarId: string | null;
  level: number;
  displayTitle?: string | null;
  isDemo: boolean;
};

/** Contagem regressiva até o fim do período (domingo 23:59:59 / último dia do mês). */
export function Countdown({ end, label }: { end: string; label: string }) {
  const [now, setNow] = useState<number | null>(null);
  useEffect(() => {
    // Hora só no cliente (evita divergência de hidratação); primeira leitura no próximo tick
    const first = setTimeout(() => setNow(Date.now()), 0);
    const t = setInterval(() => setNow(Date.now()), 30_000);
    return () => {
      clearTimeout(first);
      clearInterval(t);
    };
  }, []);
  if (now === null) return <span className="text-xs text-muted-foreground">{label}</span>;
  const ms = Math.max(0, new Date(end).getTime() - now);
  const d = Math.floor(ms / 86400000);
  const h = Math.floor((ms % 86400000) / 3600000);
  const m = Math.floor((ms % 3600000) / 60000);
  return (
    <span className="text-xs text-muted-foreground tabular">
      {label} · encerra em {d > 0 && `${d}d `}
      {h}h {String(m).padStart(2, "0")}min
    </span>
  );
}

const MEDAL = ["bg-brand text-brand-foreground", "bg-foreground text-background", "border border-foreground/30 text-foreground"];

export function Podium({ rows, meId }: { rows: RankRow[]; meId: string }) {
  if (!rows.length) return null;
  // 2º · 1º · 3º em telas largas: o campeão fica no centro e mais alto
  const order = [rows[1], rows[0], rows[2]].filter(Boolean);
  return (
    <ol className="grid gap-3 sm:grid-cols-3 sm:items-end">
      {order.map((r) => (
        <li
          key={r.userId}
          className={cn(
            "flex items-center gap-3 rounded-lg border bg-card p-4 sm:flex-col sm:text-center",
            r.position === 1 && "sm:order-none sm:pb-7 sm:pt-6",
            r.position === 2 && "sm:order-first",
            r.userId === meId && "ring-2 ring-brand-ink",
          )}
        >
          <span className={cn("grid size-7 shrink-0 place-items-center rounded-full text-xs font-bold", MEDAL[r.position - 1])}>{r.position}º</span>
          <UserAvatar name={r.name} avatarId={r.avatarId} size={r.position === 1 ? "lg" : "md"} badge={badgeKeyFor(r.displayTitle, r.level)} />
          <div className="min-w-0 flex-1 sm:flex-none">
            <Link href={`/u/${r.username}`} className="flex items-center gap-1.5 truncate font-semibold hover:underline sm:justify-center">
              <span className="truncate">{r.name}</span>
              <LevelBadge level={r.level} />
            </Link>
            <p className="mt-0.5 text-sm tabular">
              <span className="font-semibold">{formatInt(r.points)} pts</span>
              <span className="text-muted-foreground">
                {" "}
                · {formatInt(r.sales)} {r.sales === 1 ? "venda" : "vendas"}
              </span>
            </p>
            <p className="text-xs text-muted-foreground tabular">{formatBRL(r.revenueCents)}</p>
            {r.isDemo && <DemoBadge className="mt-1" />}
          </div>
        </li>
      ))}
    </ol>
  );
}

export function RankTable({ rows, meId, startAt = 4 }: { rows: RankRow[]; meId: string; startAt?: number }) {
  const rest = rows.filter((r) => r.position >= startAt);
  if (!rest.length) return null;
  return (
    <div className="relative -mx-5 overflow-x-auto">
      <table className="w-full min-w-[520px] text-sm">
        <thead>
          <tr className="border-b text-left text-xs text-muted-foreground">
            <th className="w-14 px-5 py-2 font-medium">#</th>
            <th className="py-2 font-medium">Usuário</th>
            <th className="px-3 py-2 text-right font-medium">Vendas</th>
            <th className="px-3 py-2 text-right font-medium">Faturamento</th>
            <th className="px-5 py-2 text-right font-medium">Pontos</th>
          </tr>
        </thead>
        <tbody className="divide-y">
          {rest.map((r) => (
            <tr key={r.userId} className={cn(r.userId === meId && "bg-brand-soft/60")}>
              <td className="px-5 py-2 font-mono text-xs text-muted-foreground tabular">{r.position}</td>
              <td className="py-2">
                <Link href={`/u/${r.username}`} className="flex min-w-0 items-center gap-2.5 hover:underline">
                  <UserAvatar name={r.name} avatarId={r.avatarId} size="xs" badge={badgeKeyFor(r.displayTitle, r.level)} />
                  <span className="truncate font-medium">{r.name}</span>
                  <LevelBadge level={r.level} />
                  {r.isDemo && <DemoBadge />}
                  {r.userId === meId && <span className="text-xs font-medium text-brand-ink">você</span>}
                </Link>
              </td>
              <td className="px-3 py-2 text-right tabular">{formatInt(r.sales)}</td>
              <td className="px-3 py-2 text-right tabular">{formatBRL(r.revenueCents)}</td>
              <td className="px-5 py-2 text-right font-semibold tabular">{formatInt(r.points)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function OptInBanner() {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-dashed p-4">
      <div className="max-w-xl text-sm">
        <p className="font-medium">Você está fora do ranking</p>
        <p className="mt-0.5 text-muted-foreground">
          Para aparecer, a comunidade passa a ver suas vendas, pontos e faturamento recebido pela plataforma. Dá pra sair quando quiser em Perfil → Privacidade.
        </p>
      </div>
      <Button
        onClick={async () => {
          const r = await setRankingOptIn({ value: true });
          if (r.ok) toast.success("Pronto, você está no ranking.");
          else toast.error(r.error);
        }}
      >
        Participar do ranking
      </Button>
    </div>
  );
}
