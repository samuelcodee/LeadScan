import {
  Columns3,
  FolderOpen,
  LayoutDashboard,
  MessageCircle,
  MessageSquareText,
  MonitorSmartphone,
  PlugZap,
  Search,
  Settings,
  Star,
  Trophy,
  UserRoundPlus,
  Users,
  Wallet,
  type LucideIcon,
} from "lucide-react";

export type NavItem = { href: string; label: string; icon: LucideIcon; hint?: string; group: "prospeccao" | "negocio" | "conta" };

export const NAV: NavItem[] = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard, group: "prospeccao" },
  { href: "/search", label: "Buscar leads", icon: Search, hint: "Encontrar empresas", group: "prospeccao" },
  { href: "/leads", label: "Meus leads", icon: Users, group: "prospeccao" },
  { href: "/favorites", label: "Favoritos", icon: Star, group: "prospeccao" },
  { href: "/pipeline", label: "Prospecções", icon: Columns3, hint: "Pipeline", group: "prospeccao" },
  { href: "/prototypes", label: "Protótipos", icon: MonitorSmartphone, group: "prospeccao" },
  { href: "/outreach", label: "Abordagens", icon: MessageSquareText, group: "prospeccao" },
  { href: "/financeiro", label: "Financeiro", icon: Wallet, hint: "Cobranças e faturamento", group: "negocio" },
  { href: "/comunidade", label: "Comunidade", icon: Trophy, hint: "Ranking e campeões", group: "negocio" },
  { href: "/mensagens", label: "Mensagens", icon: MessageCircle, hint: "Conversas com outros usuários", group: "negocio" },
  { href: "/amigos", label: "Amigos", icon: UserRoundPlus, hint: "Convites, amigos e bloqueados", group: "negocio" },
  { href: "/arquivos", label: "Arquivos", icon: FolderOpen, hint: "Fotos, vídeos e áudios", group: "conta" },
  { href: "/integracoes", label: "Integrações de IA", icon: PlugZap, hint: "Claude, ChatGPT, Gemini…", group: "conta" },
  { href: "/settings", label: "Configurações", icon: Settings, group: "conta" },
];

export const NAV_GROUPS: { id: NavItem["group"]; label: string | null }[] = [
  { id: "prospeccao", label: null },
  { id: "negocio", label: "Negócio" },
  { id: "conta", label: "Ferramentas" },
];

export function isActive(pathname: string, href: string) {
  return pathname === href || pathname.startsWith(`${href}/`);
}
