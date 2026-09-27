import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

/** Bloco padrão das telas internas: título + ação opcional + conteúdo. */
export function Panel({ title, action, children, className, id }: { title: ReactNode; action?: ReactNode; children: ReactNode; className?: string; id?: string }) {
  return (
    <section id={id} className={cn("scroll-mt-20 rounded-lg border bg-card shadow-soft", className)}>
      <div className="flex min-h-12 flex-wrap items-center justify-between gap-2 border-b px-5 py-2.5">
        <h2 className="text-sm font-semibold">{title}</h2>
        {action}
      </div>
      <div className="p-5">{children}</div>
    </section>
  );
}
