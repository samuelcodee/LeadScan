"use client";

import { useEffect, useState } from "react";
import { presenceOf } from "@/lib/chat/presence";
import { cn } from "@/lib/utils";

const DOT = { online: "bg-[#22c55e]", idle: "bg-[#f5b400]", offline: "bg-muted-foreground/50", hidden: "" } as const;

/** "● Online" / "● Inativo há 8 min" / "Offline". Recalcula sozinho a cada 30 s. */
export function PresenceLabel({ lastActiveAt, visible, className }: { lastActiveAt: string | null; visible: boolean; className?: string }) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(t);
  }, []);
  const p = presenceOf(lastActiveAt, visible, now);
  if (p.state === "hidden") return null;
  return (
    <span className={cn("inline-flex items-center gap-1.5 text-xs text-muted-foreground", className)} suppressHydrationWarning>
      <span className={cn("size-2 rounded-full", DOT[p.state])} aria-hidden />
      {p.label}
    </span>
  );
}
