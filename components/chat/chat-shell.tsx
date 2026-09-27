"use client";

import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

/**
 * Duas colunas no desktop (lista + conversa). No celular, uma de cada vez: a lista em
 * /mensagens e a conversa em /mensagens/[id] (sem a barra inferior, como no WhatsApp).
 * `data-fullbleed` avisa o layout do app para não somar o espaço da barra inferior.
 * Alturas: topo 3.5rem + 1px de borda; barra inferior 4rem + 1px de borda.
 */
export function ChatShell({ list, children }: { list: React.ReactNode; children: React.ReactNode }) {
  const pathname = usePathname();
  const inThread = /^\/mensagens\/[^/]+/.test(pathname);
  return (
    <div
      data-fullbleed
      className={cn(
        "flex overflow-hidden lg:h-[calc(100dvh-3.5rem-1px)]",
        inThread ? "h-[calc(100dvh-3.5rem-1px)]" : "h-[calc(100dvh-7.5rem-2px-env(safe-area-inset-bottom))]",
      )}
    >
      <aside className={cn("w-full shrink-0 flex-col border-r bg-card lg:flex lg:w-[340px]", inThread ? "hidden" : "flex")}>{list}</aside>
      <section className={cn("min-w-0 flex-1 flex-col lg:flex", inThread ? "flex" : "hidden")}>{children}</section>
    </div>
  );
}
