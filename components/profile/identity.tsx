import { Insignia } from "@/components/profile/insignia";
import { getLevel } from "@/lib/gamification/levels";
import { initials } from "@/lib/format";
import { cn } from "@/lib/utils";

/* eslint-disable @next/next/no-img-element -- avatar vem de /api/media (já otimizado em WebP 320px) */

const SIZES = { xs: "size-6 text-[10px]", sm: "size-8 text-xs", md: "size-10 text-sm", lg: "size-16 text-lg", xl: "size-24 text-2xl" } as const;

/** Tamanho do selo no canto da foto, por tamanho de avatar */
const BADGE_PX = { xs: 12, sm: 15, md: 17, lg: 24, xl: 32 } as const;

/**
 * Foto (ou iniciais) + selo do nível/título no canto. `badge` = chave de badgeKeyFor();
 * `presence` = bolinha de online/inativo no canto oposto.
 */
export function UserAvatar({
  name,
  avatarId,
  size = "sm",
  className,
  badge,
  presence,
}: {
  name: string;
  avatarId: string | null;
  size?: keyof typeof SIZES;
  className?: string;
  badge?: string | null;
  presence?: "online" | "idle" | "offline" | "hidden" | null;
}) {
  if (!badge && !presence) return <AvatarImage name={name} avatarId={avatarId} size={size} className={className} />;
  return (
    <span className="relative inline-flex shrink-0">
      <AvatarImage name={name} avatarId={avatarId} size={size} className={className} />
      {badge && (
        <span className="absolute -bottom-1 -right-1 grid place-items-center rounded-full bg-card p-px">
          <Insignia badge={badge} size={BADGE_PX[size]} />
        </span>
      )}
      {presence && presence !== "hidden" && presence !== "offline" && (
        <span
          className={cn(
            "absolute left-0 top-0 rounded-full ring-2 ring-card",
            size === "xs" || size === "sm" ? "size-2.5" : "size-3",
            presence === "online" ? "bg-[#22c55e]" : "bg-[#f5b400]",
          )}
          aria-hidden
        />
      )}
    </span>
  );
}

function AvatarImage({ name, avatarId, size = "sm", className }: { name: string; avatarId: string | null; size?: keyof typeof SIZES; className?: string }) {
  return avatarId ? (
    <img src={`/api/media/${avatarId}`} alt="" width={96} height={96} className={cn("shrink-0 rounded-full object-cover", SIZES[size], className)} loading="lazy" />
  ) : (
    <span className={cn("grid shrink-0 place-items-center rounded-full bg-ink font-semibold text-white dark:bg-graphite", SIZES[size], className)} aria-hidden>
      {initials(name)}
    </span>
  );
}

/**
 * Selo de nível — minimalista: "N4" num chip. Progressão sóbria (neutro →
 * lima da marca → preto), sem arco-íris; 9 e 10 ganham contorno lima.
 */
const TONE: Record<string, string> = {
  base: "bg-secondary text-secondary-foreground",
  mid: "bg-brand-soft text-brand-ink",
  high: "bg-lime text-ink",
  elite: "bg-ink text-white ring-1 ring-white/20",
  legend: "bg-ink text-lime ring-1 ring-lime",
};

export function LevelBadge({ level, withName, className }: { level: number; withName?: boolean; className?: string }) {
  const def = getLevel(level);
  if (!def) return null;
  return (
    <span
      className={cn("inline-flex h-5 shrink-0 items-center gap-1 rounded-full px-1.5 text-[10px] font-bold leading-none tracking-wide", TONE[def.tone], className)}
      title={`Nível ${def.n} · ${def.name} — ${def.description}`}
    >
      N{def.n}
      {withName && <span className="font-semibold tracking-normal">{def.name}</span>}
      <span className="sr-only">
        Nível {def.n}, {def.name}
      </span>
    </span>
  );
}

/** Nome + selo + título numa linha (listas, ranking, menu). */
export function UserLine({
  name,
  username,
  level,
  title,
  className,
}: {
  name: string;
  username?: string | null;
  level: number;
  title?: string | null;
  className?: string;
}) {
  return (
    <span className={cn("flex min-w-0 items-center gap-1.5", className)}>
      <span className="truncate font-medium">{name}</span>
      <LevelBadge level={level} />
      {title && <span className="hidden truncate text-xs text-muted-foreground sm:inline">{title}</span>}
      {!title && username && <span className="hidden truncate text-xs text-muted-foreground sm:inline">@{username}</span>}
    </span>
  );
}

/** "3 meses na plataforma" — tempo de conta de forma discreta. */
export function accountAge(createdAt: Date, now = new Date()) {
  const days = Math.floor((now.getTime() - createdAt.getTime()) / 86400000);
  if (days < 1) return "Chegou hoje";
  if (days < 30) return `${days} ${days === 1 ? "dia" : "dias"} na plataforma`;
  const months = Math.floor(days / 30.44);
  if (months < 12) return `${months} ${months === 1 ? "mês" : "meses"} na plataforma`;
  const years = Math.floor(months / 12);
  const rest = months % 12;
  return `${years} ${years === 1 ? "ano" : "anos"}${rest ? ` e ${rest} ${rest === 1 ? "mês" : "meses"}` : ""} na plataforma`;
}
