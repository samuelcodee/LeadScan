"use client";

import { useUnreadCount } from "@/lib/client/unread";
import { cn } from "@/lib/utils";

/** Bolinha lima com o número de mensagens não lidas (some quando zera). */
export function UnreadBadge({ className }: { className?: string }) {
  const n = useUnreadCount();
  if (n <= 0) return null;
  return (
    <span className={cn("grid h-[18px] min-w-[18px] place-items-center rounded-full bg-lime px-1 text-[10px] font-bold leading-none text-ink tabular", className)}>
      {n > 99 ? "99+" : n}
      <span className="sr-only"> mensagens não lidas</span>
    </span>
  );
}
