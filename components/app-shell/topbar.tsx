"use client";

import { Menu, MessageCircle, Moon, Plus, Sun } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useTheme } from "next-themes";
import dynamic from "next/dynamic";
import { useEffect, useState } from "react";
import { SearchTrigger } from "@/components/app-shell/search-trigger";
import { Logo } from "@/components/app-shell/logo";
import { NavLinks } from "@/components/app-shell/sidebar";
import { UnreadBadge } from "@/components/chat/unread-badge";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";

export function ThemeToggle() {
  const { resolvedTheme, setTheme } = useTheme();
  // Rótulo fixo: o tema só é conhecido no cliente (evita divergência de hidratação)
  return (
    <Button variant="ghost" size="icon" onClick={() => setTheme(resolvedTheme === "dark" ? "light" : "dark")} aria-label="Alternar tema claro/escuro">
      <Sun className="hidden dark:block" />
      <Moon className="dark:hidden" />
    </Button>
  );
}

// Paleta de comandos fora do pacote inicial: baixa na primeira vez que é aberta
const CommandPalette = dynamic(() => import("@/components/app-shell/command-palette").then((m) => m.CommandPalette), { ssr: false });

export function Topbar({ isDemo, footer }: { isDemo: boolean; footer: React.ReactNode }) {
  const [menu, setMenu] = useState(false);
  const [palette, setPalette] = useState(false);
  const [paletteUsed, setPaletteUsed] = useState(false);
  const pathname = usePathname();

  const openPalette = (v: boolean) => {
    if (v) setPaletteUsed(true);
    setPalette(v);
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setPaletteUsed(true);
        setPalette((o) => !o);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  return (
    <header className="sticky top-0 z-40 border-b bg-card">
      <div className="flex h-14 items-center gap-2 px-3 sm:px-5">
        <Button variant="ghost" size="icon" className="lg:hidden" onClick={() => setMenu(true)} aria-label="Abrir menu">
          <Menu />
        </Button>
        <Link href="/dashboard" className="mr-1 lg:hidden" aria-label="Início">
          <Logo boxed className="[&>span:last-child]:hidden sm:[&>span:last-child]:flex" />
        </Link>
        <div className="min-w-0 flex-1">
          <SearchTrigger onOpen={() => openPalette(true)} />
        </div>
        {isDemo && (
          <span className="hidden rounded-sm bg-demo-soft px-2 py-1 text-[11px] font-semibold tracking-wide text-demo md:inline" title="Dados fictícios de demonstração">
            MODO DEMO
          </span>
        )}
        <Button asChild variant="ghost" size="icon" className="relative" aria-label="Mensagens">
          <Link href="/mensagens">
            <MessageCircle />
            <UnreadBadge className="absolute -right-0.5 -top-0.5" />
          </Link>
        </Button>
        <ThemeToggle />
        {!pathname.startsWith("/search") && (
          <Button asChild size="lg" className="hidden md:inline-flex">
            <Link href="/search">
              <Plus /> Buscar leads
            </Link>
          </Button>
        )}
      </div>

      <Sheet open={menu} onOpenChange={setMenu}>
        <SheetContent side="left" className="w-72 border-sidebar-border bg-sidebar p-0 text-sidebar-foreground">
          <SheetHeader className="h-16 justify-center border-b border-sidebar-border px-4">
            <SheetTitle className="text-white">
              <Logo tagline />
            </SheetTitle>
          </SheetHeader>
          <div className="flex h-[calc(100%-4rem)] flex-col">
            <div className="flex-1 overflow-y-auto p-3">
              <NavLinks onNavigate={() => setMenu(false)} />
            </div>
            <div className="border-t border-sidebar-border p-3">{footer}</div>
          </div>
        </SheetContent>
      </Sheet>
      {paletteUsed && <CommandPalette open={palette} onOpenChange={openPalette} />}
    </header>
  );
}
