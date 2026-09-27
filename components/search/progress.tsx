"use client";

import { useRouter } from "next/navigation";
import type { SearchProgress } from "@/components/search/use-search-runner";

/** Barra de progresso de uma busca em lote, com atalho para ver o que já foi achado. */
export function SearchProgressBar({ progress, label }: { progress: SearchProgress; label: string }) {
  const router = useRouter();
  return (
    <div className="mt-3" role="status" aria-live="polite">
      <div className="flex justify-between gap-3 text-xs text-muted-foreground">
        <span className="min-w-0">
          {label}
          {progress.found > 0 && (
            <>
              {" "}
              · <span className="font-medium text-foreground">{progress.found} empresas até agora</span>
            </>
          )}
        </span>
        {progress.total > 0 && (
          <span className="shrink-0 tabular">
            {progress.done}/{progress.total}
          </span>
        )}
      </div>
      <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-muted">
        <div className="h-full bg-chart-1 transition-[width] duration-300" style={{ width: `${(progress.done / Math.max(progress.total, 1)) * 100}%` }} />
      </div>
      {progress.found > 0 && (
        <button type="button" onClick={() => router.push(progress.href)} className="mt-2 text-xs font-medium text-foreground underline underline-offset-4">
          Ver as {progress.found} já encontradas (a busca continua)
        </button>
      )}
    </div>
  );
}
