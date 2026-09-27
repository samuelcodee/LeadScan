"use client";

import { ChevronsUpDown, LogOut, Settings, Trophy, User, UserPen, Wallet } from "lucide-react";
import Link from "next/link";
import { LevelBadge, UserAvatar } from "@/components/profile/identity";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";

export type MenuUser = { name: string; username: string | null; avatarId: string | null; level: number; title: string | null; badge: string | null };

/** Aba do perfil: abrir o perfil, editar, financeiro, configurações e sair. */
export function UserMenu({ user }: { user: MenuUser }) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger className="flex w-full items-center gap-2.5 rounded-md p-1.5 text-left outline-none transition-colors duration-150 hover:bg-sidebar-accent focus-visible:ring-2 focus-visible:ring-lime">
        <UserAvatar name={user.name} avatarId={user.avatarId} size="sm" badge={user.badge} className="bg-graphite text-white" />
        <span className="min-w-0 flex-1">
          <span className="flex items-center gap-1.5">
            <span className="truncate text-sm font-medium text-white">{user.name}</span>
            <LevelBadge level={user.level} />
          </span>
          <span className="block truncate text-xs text-[#9aa3aa]">{user.title ?? (user.username ? `@${user.username}` : "Sem nível ainda")}</span>
        </span>
        <ChevronsUpDown className="size-4 shrink-0 text-[#7b858d]" aria-hidden />
        <span className="sr-only">Abrir menu da conta</span>
      </DropdownMenuTrigger>
      <DropdownMenuContent side="top" align="start" className="w-56">
        <DropdownMenuLabel className="font-normal">
          <span className="block truncate text-sm font-medium">{user.name}</span>
          {user.username && <span className="block truncate text-xs text-muted-foreground">@{user.username}</span>}
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        {user.username && (
          <DropdownMenuItem asChild>
            <Link href={`/u/${user.username}`}>
              <User /> Ver meu perfil
            </Link>
          </DropdownMenuItem>
        )}
        <DropdownMenuItem asChild>
          <Link href="/perfil">
            <UserPen /> Editar perfil
          </Link>
        </DropdownMenuItem>
        <DropdownMenuItem asChild>
          <Link href="/financeiro">
            <Wallet /> Financeiro
          </Link>
        </DropdownMenuItem>
        <DropdownMenuItem asChild>
          <Link href="/comunidade">
            <Trophy /> Ranking
          </Link>
        </DropdownMenuItem>
        <DropdownMenuItem asChild>
          <Link href="/settings">
            <Settings /> Configurações
          </Link>
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <form action="/api/auth/logout" method="post">
          <DropdownMenuItem asChild>
            <button type="submit" className="w-full">
              <LogOut /> Sair
            </button>
          </DropdownMenuItem>
        </form>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
