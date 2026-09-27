import { ChevronLeft, ChevronRight } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { formatInt } from "@/lib/format";

export function Pagination({ page, pageSize, total, baseParams, path }: { page: number; pageSize: number; total: number; baseParams: URLSearchParams; path: string }) {
  const pages = Math.max(1, Math.ceil(total / pageSize));
  if (pages <= 1) return null;
  const href = (p: number) => {
    const next = new URLSearchParams(baseParams);
    if (p > 1) next.set("page", String(p));
    else next.delete("page");
    return `${path}?${next.toString()}`;
  };
  return (
    <nav className="mt-4 flex items-center justify-between text-sm" aria-label="Paginação">
      <span className="text-muted-foreground tabular">
        {formatInt((page - 1) * pageSize + 1)}–{formatInt(Math.min(page * pageSize, total))} de {formatInt(total)}
      </span>
      <div className="flex gap-2">
        <Button asChild variant="outline" size="sm" aria-disabled={page <= 1} className={page <= 1 ? "pointer-events-none opacity-50" : ""}>
          <Link href={href(page - 1)}>
            <ChevronLeft /> Anterior
          </Link>
        </Button>
        <Button asChild variant="outline" size="sm" aria-disabled={page >= pages} className={page >= pages ? "pointer-events-none opacity-50" : ""}>
          <Link href={href(page + 1)}>
            Próxima <ChevronRight />
          </Link>
        </Button>
      </div>
    </nav>
  );
}
