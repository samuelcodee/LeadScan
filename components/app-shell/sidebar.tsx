"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Logo } from "@/components/app-shell/logo";
import { UnreadBadge } from "@/components/chat/unread-badge";
import { isActive, NAV, NAV_GROUPS } from "@/components/app-shell/nav";
import { cn } from "@/lib/utils";

/** Menu da sidebar (sempre escura). Item ativo: fundo grafite + barra e ícone lima. */
export function NavLinks({ onNavigate, counts }: { onNavigate?: () => void; counts?: Partial<Record<string, number>> }) {
  const pathname = usePathname();
  return (
    <nav className="grid gap-5" aria-label="Principal">
      {NAV_GROUPS.map((g) => (
        <div key={g.id} className="grid gap-0.5">
          {g.label && <p className="px-3 pb-1.5 text-[11px] font-semibold uppercase tracking-[0.12em] text-[#7b858d]">{g.label}</p>}
          {NAV.filter((i) => i.group === g.id).map((item) => {
            const active = isActive(pathname, item.href);
            const count = counts?.[item.href];
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={onNavigate}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "group relative flex h-9 items-center gap-3 rounded-md px-3 text-sm font-medium text-sidebar-foreground transition-colors duration-150",
                  "hover:bg-sidebar-accent hover:text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-lime",
                  active && "bg-sidebar-accent text-white",
                )}
              >
                {/* indicador lima: pequeno, à esquerda, só no item ativo */}
                {active && <span className="absolute inset-y-2 left-0 w-[3px] rounded-r-full bg-lime" aria-hidden />}
                <item.icon className={cn("size-4 shrink-0 text-[#7b858d] transition-colors group-hover:text-white", active && "text-lime group-hover:text-lime")} aria-hidden />
                <span className="truncate">{item.label}</span>
                {item.href === "/mensagens" ? (
                  <UnreadBadge className="ml-auto" />
                ) : (
                  count !== undefined && count > 0 && <span className="ml-auto font-mono text-xs text-[#7b858d] tabular">{count}</span>
                )}
              </Link>
            );
          })}
        </div>
      ))}
    </nav>
  );
}

export function Sidebar({ footer, counts }: { footer: React.ReactNode; counts?: Partial<Record<string, number>> }) {
  return (
    <aside className="sticky top-0 hidden h-dvh w-60 shrink-0 flex-col border-r border-sidebar-border bg-sidebar text-sidebar-foreground lg:flex">
      <div className="flex h-16 items-center px-4">
        <Link href="/dashboard" aria-label="LeadScan — início" className="text-white">
          <Logo tagline />
        </Link>
      </div>
      <div className="flex-1 overflow-y-auto px-3 py-4">
        <NavLinks counts={counts} />
      </div>
      <div className="border-t border-sidebar-border p-3">{footer}</div>
    </aside>
  );
}
