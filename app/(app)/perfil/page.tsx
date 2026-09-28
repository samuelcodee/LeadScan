import type { Metadata } from "next";
import Link from "next/link";
import { ExternalLink } from "lucide-react";
import { PageHeader } from "@/components/common/page-header";
import { LiveRefresh } from "@/components/live/live-refresh";
import { LevelBadge } from "@/components/profile/identity";
import { Insignia } from "@/components/profile/insignia";
import { AccountFields, AvatarUpload, PrivacyFields, ProfileFields, TitlePicker } from "@/components/profile/profile-editor";
import { Button } from "@/components/ui/button";
import { requireUser } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { badgeKeyFor, getLevel, LEVELS, nextLevelProgress } from "@/lib/gamification/levels";
import { salesStats, userTitles, verifiedTotals } from "@/lib/gamification/service";
import { formatBRL, formatDate, formatInt } from "@/lib/format";
import { cn } from "@/lib/utils";
import { formatPhone } from "@/lib/whatsapp/phone";

export const metadata: Metadata = { title: "Meu perfil" };

function Section({ id, title, description, children }: { id: string; title: string; description?: string; children: React.ReactNode }) {
  return (
    <section id={id} className="grid scroll-mt-20 gap-6 border-t py-8 lg:grid-cols-[240px_minmax(0,1fr)]">
      <div>
        <h2 className="font-semibold">{title}</h2>
        {description && <p className="mt-1 text-sm text-muted-foreground">{description}</p>}
      </div>
      <div className="min-w-0">{children}</div>
    </section>
  );
}

export default async function MyProfilePage() {
  const user = await requireUser();
  const [titles, stats, totals, achievements] = await Promise.all([
    userTitles(user.id, user.level),
    salesStats(user.id),
    verifiedTotals(user.id),
    db.achievement.findMany({ where: { userId: user.id }, select: { key: true, unlockedAt: true } }),
  ]);
  const unlocked = new Map(achievements.map((a) => [a.key, a.unlockedAt]));
  const progress = nextLevelProgress(stats);

  return (
    <div className="mx-auto max-w-5xl px-4 py-6 sm:px-6 sm:py-8">
      <PageHeader
        title="Meu perfil"
        description={
          <>
            Como a comunidade vê você. Cada ajuste é salvo na hora.{" "}
            <LiveRefresh topics={["me"]} label="Vendas e níveis atualizam ao vivo" className="mt-1 flex" />
          </>
        }
        actions={
          <Button asChild variant="outline">
            <Link href={`/u/${user.username}`}>
              <ExternalLink /> Ver perfil público
            </Link>
          </Button>
        }
      />
      <nav className="mt-5 flex gap-4 overflow-x-auto text-sm text-muted-foreground" aria-label="Seções do perfil">
        {[
          ["#perfil", "Perfil"],
          ["#niveis", "Níveis e títulos"],
          ["#privacidade", "Privacidade"],
          ["#conta", "Conta"],
        ].map(([href, label]) => (
          <a key={href} href={href} className="whitespace-nowrap py-1 hover:text-foreground">
            {label}
          </a>
        ))}
      </nav>

      <div className="mt-4">
        <Section id="perfil" title="Perfil" description="Foto, nome, @ e bio aparecem no ranking e no seu perfil.">
          <div className="grid gap-8">
            <AvatarUpload name={user.name} avatarId={user.avatarId} badge={badgeKeyFor(user.displayTitle, user.level)} unverified={user.avatar?.moderation === "UNVERIFIED"} />
            <ProfileFields initial={{ name: user.name, username: user.username ?? "", bio: user.bio ?? "", instagram: user.instagram ? `@${user.instagram}` : "" }} />
          </div>
        </Section>

        <Section id="niveis" title="Níveis e títulos" description="Sobem com vendas pagas pela plataforma. Vendas registradas à mão não contam.">
          <div className="grid gap-6">
            <div className="rounded-lg border p-4">
              <div className="flex flex-wrap items-center gap-2">
                {user.level > 0 ? <LevelBadge level={user.level} withName /> : <span className="text-sm font-medium">Sem nível ainda</span>}
                <span className="text-sm text-muted-foreground">
                  · {formatInt(totals.sales)} vendas verificadas · {formatBRL(totals.revenueCents)}
                </span>
              </div>
              {progress && (
                <div className="mt-4">
                  <p className="text-sm">
                    Próximo: <span className="font-medium">Nível {progress.next.n} · {progress.next.name}</span>
                  </p>
                  <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-muted" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(progress.ratio * 100)}>
                    <div className="h-full rounded-full bg-chart-1" style={{ width: `${Math.max(2, progress.ratio * 100)}%` }} />
                  </div>
                  <ul className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
                    {progress.parts.map((p) => (
                      <li key={p.key} className="tabular">
                        {p.key === "revenue" ? `${formatBRL(p.have)} de ${formatBRL(p.need)}` : `${formatInt(p.have)} de ${formatInt(p.need)}`} {p.label}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>

            <div>
              <p className="mb-2 text-sm font-medium">Título ao lado do seu nome</p>
              <TitlePicker titles={titles.map((t) => ({ key: t.key, label: t.label, detail: t.detail }))} current={user.displayTitle} />
            </div>

            <ol className="grid gap-1.5 sm:grid-cols-2">
              {LEVELS.map((l) => {
                const at = unlocked.get(`level-${l.n}`);
                return (
                  <li key={l.n} className={cn("flex items-start gap-3 rounded-md border px-3 py-2.5", !at && "text-muted-foreground")}>
                    <Insignia badge={`level-${l.n}`} size={34} locked={!at} className="mt-0.5" />
                    <span className="min-w-0 text-sm">
                      <span className="font-medium">{getLevel(l.n)?.name}</span>
                      <span className="block text-xs text-muted-foreground">{l.description}</span>
                      {at && <span className="block text-xs text-success">Conquistado em {formatDate(at, "long")}</span>}
                    </span>
                  </li>
                );
              })}
            </ol>
          </div>
        </Section>

        <Section id="privacidade" title="Privacidade" description="Você decide o que a comunidade vê. Faturamento de ninguém aparece sem consentimento.">
          <PrivacyFields initial={{ profilePublic: user.profilePublic, showAccountAge: user.showAccountAge, rankingOptIn: user.rankingOptIn, presenceVisible: user.presenceVisible, friendsOnlyMessages: user.messagesFrom === "FRIENDS" }} />
        </Section>

        <Section id="conta" title="Conta" description="Formas de entrar e segurança.">
          <AccountFields email={user.email} phone={formatPhone(user.phone)} google={Boolean(user.googleId)} isDemo={user.isDemo} />
        </Section>
      </div>
    </div>
  );
}
