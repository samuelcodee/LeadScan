import { BottomNav } from "@/components/app-shell/bottom-nav";
import { PresenceHeartbeat } from "@/components/chat/presence-heartbeat";
import { Sidebar } from "@/components/app-shell/sidebar";
import { UserMenu } from "@/components/app-shell/user-menu";
import { Topbar } from "@/components/app-shell/topbar";
import { requireUser } from "@/lib/auth/session";
import { shellCounts } from "@/lib/app-shell/counts";
import { badgeKeyFor } from "@/lib/gamification/levels";
import { resolveDisplayTitle } from "@/lib/gamification/service";
import { rescoreOutdated } from "@/lib/leads/ingest";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser();
  await rescoreOutdated(user.id);
  const { saved, favorites, prototypes, unread } = await shellCounts(user.id);

  const footer = (
    <UserMenu
      user={{ name: user.name, username: user.username, avatarId: user.avatarId, level: user.level, title: user.level > 0 ? resolveDisplayTitle(user.displayTitle, user.level) : null,
        badge: badgeKeyFor(user.displayTitle, user.level),
      }}
    />
  );

  return (
    <div className="flex min-h-dvh">
      <Sidebar footer={footer} counts={{ "/leads": saved, "/favorites": favorites, "/prototypes": prototypes }} />
      <div className="flex min-w-0 flex-1 flex-col">
        <Topbar isDemo={user.isDemo} footer={footer} />
        {/* espaço para a navegação inferior no celular */}
        <main className="flex-1 pb-20 lg:pb-0 has-[[data-fullbleed]]:pb-0">{children}</main>
      </div>
      <BottomNav footer={footer} />
      <PresenceHeartbeat initialUnread={unread} />
    </div>
  );
}
