"use client";

import { Columns3, LayoutDashboard, Menu, MonitorSmartphone, Users } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { Logo } from "@/components/app-shell/logo";
import { isActive } from "@/components/app-shell/nav";
import { NavLinks } from "@/components/app-shell/sidebar";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { cn } from "@/lib/utils";

const ITEMS = [
  { href: "/dashboard", label: "Início", icon: LayoutDashboard },
  { href: "/leads", label: "Leads", icon: Users },
  { href: "/pipeline", label: "Propostas", icon: Columns3 },
  { href: "/prototypes", label: "Protótipos", icon: MonitorSmartphone },
];

/**
 * Navegação inferior no celular (os atalhos mais usados + "Menu" com tudo).
 * Some no estúdio do protótipo e dentro de uma conversa, que precisam da tela inteira.
 */
export function BottomNav({ footer }: { footer: React.ReactNode }) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  // Estúdio do protótipo e conversa aberta precisam da tela inteira
  if (/^\/(prototypes|mensagens)\/[^/]+/.test(pathname)) return null;

  return (
    <>
      <nav
        className="fixed inset-x-0 bottom-0 z-40 border-t bg-card/95 pb-[env(safe-area-inset-bottom)] backdrop-blur-sm lg:hidden"
        aria-label="Navegação rápida"
      >
        <ul className="mx-auto grid h-16 max-w-md grid-cols-5">
          {ITEMS.map((item) => {
            const active = isActive(pathname, item.href);
            return (
              <li key={item.href}>
                <Link
                  href={item.href}
                  aria-current={active ? "page" : undefined}
                  className="flex h-full flex-col items-center justify-center gap-1 text-[11px] font-medium text-muted-foreground"
                >
                  <span className={cn("grid h-7 w-11 place-items-center rounded-full transition-colors duration-150", active && "bg-lime text-ink")}>
                    <item.icon className="size-[18px]" aria-hidden />
                  </span>
                  <span className={cn(active && "font-semibold text-foreground")}>{item.label}</span>
                </Link>
              </li>
            );
          })}
          <li>
            <button type="button" onClick={() => setOpen(true)} className="flex h-full w-full flex-col items-center justify-center gap-1 text-[11px] font-medium text-muted-foreground">
              <span className="grid h-7 w-11 place-items-center rounded-full">
                <Menu className="size-[18px]" aria-hidden />
              </span>
              Menu
            </button>
          </li>
        </ul>
      </nav>

      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent side="left" className="w-72 border-sidebar-border bg-sidebar p-0 text-sidebar-foreground">
          <SheetHeader className="h-16 justify-center border-b border-sidebar-border px-4">
            <SheetTitle className="text-white">
              <Logo tagline />
            </SheetTitle>
          </SheetHeader>
          <div className="flex h-[calc(100%-4rem)] flex-col">
            <div className="flex-1 overflow-y-auto p-3">
              <NavLinks onNavigate={() => setOpen(false)} />
            </div>
            <div className="border-t border-sidebar-border p-3">{footer}</div>
          </div>
        </SheetContent>
      </Sheet>
    </>
  );
}
