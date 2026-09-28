import type { Metadata } from "next";
import Link from "next/link";
import { Eye, Globe, LayoutTemplate, Star } from "lucide-react";
import { DemoBadge, EmptyState, PageHeader } from "@/components/common/page-header";
import { PrototypeCardActions } from "@/components/prototypes/prototype-card-actions";
import { ScaledSite } from "@/components/prototypes/scaled-site";
import { Button } from "@/components/ui/button";
import { requireUser } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { formatInt, formatRelative } from "@/lib/format";
import { parseSpec } from "@/lib/prototypes/service";
import { previewSpec } from "@/lib/templates/preview";
import { TEMPLATE_LIST } from "@/lib/templates/registry";
import { sampleSpec, templateUsedBy } from "@/lib/templates/sample";

export const metadata: Metadata = { title: "Protótipos" };

export default async function PrototypesPage(props: PageProps<"/prototypes">) {
  const user = await requireUser();
  const { tab } = await props.searchParams;
  const showTemplates = tab === "templates";
  const onlyFavorites = tab === "favoritos";

  const [prototypes, favoriteCount] = await Promise.all([
    showTemplates
      ? []
      : db.prototype.findMany({
          where: { userId: user.id, ...(onlyFavorites ? { favorite: true } : {}) },
          // favoritos primeiro, depois os editados por último
          orderBy: [{ favorite: "desc" }, { updatedAt: "desc" }],
          take: 60,
          select: {
            id: true,
            name: true,
            spec: true,
            favorite: true,
            shareEnabled: true,
            views: true,
            updatedAt: true,
            lead: { select: { id: true, name: true, city: true, isDemo: true } },
          },
        }),
    db.prototype.count({ where: { userId: user.id, favorite: true } }),
  ]);

  return (
    <div className="mx-auto max-w-6xl px-4 py-6 sm:px-6 sm:py-8">
      <PageHeader
        title="Protótipos"
        description={
          showTemplates
            ? "Cada categoria usa um template pronto. O conteúdo é preenchido com os dados do lead, sem gastar IA. Clique num template para ver o site inteiro."
            : "Sites montados para os seus leads."
        }
      />
      <nav className="mt-6 flex overflow-x-auto border-b [scrollbar-width:none] sm:gap-1" aria-label="Seções de protótipos">
        {[
          { href: "/prototypes", label: "Seus protótipos", active: !showTemplates && !onlyFavorites },
          { href: "/prototypes?tab=favoritos", label: `Favoritos (${favoriteCount})`, active: onlyFavorites },
          { href: "/prototypes?tab=templates", label: `Templates (${TEMPLATE_LIST.length})`, wide: `Biblioteca de templates (${TEMPLATE_LIST.length})`, active: showTemplates },
        ].map((t) => (
          <Link
            key={t.href}
            href={t.href}
            aria-current={t.active ? "page" : undefined}
            className={`-mb-px shrink-0 border-b-2 px-2 py-2.5 text-sm font-medium transition-colors duration-150 sm:px-3 sm:py-2 ${t.active ? "border-foreground text-foreground" : "border-transparent text-muted-foreground hover:text-foreground"}`}
          >
            {"wide" in t && t.wide ? (
              <>
                <span className="sm:hidden">{t.label}</span>
                <span className="hidden sm:inline">{t.wide}</span>
              </>
            ) : (
              t.label
            )}
          </Link>
        ))}
      </nav>

      {showTemplates ? (
        // celular: 2 por linha (22 templates num só por linha viravam uma rolagem enorme)
        <ul className="mt-6 grid grid-cols-2 gap-3 sm:gap-5 lg:grid-cols-3">
          {TEMPLATE_LIST.map((t) => {
            // Amostra com dados de exemplo — só para visualizar o template
            const spec = sampleSpec(t);
            const usedBy = templateUsedBy(t);
            return (
              <li
                key={t.id}
                className="group relative cv-auto overflow-hidden rounded-lg border bg-card shadow-soft transition-[border-color,box-shadow,transform] duration-200 [--cv-h:300px] hover:border-foreground/25 hover:shadow-premium motion-safe:hover:-translate-y-px"
              >
                <div className="relative">
                  <ScaledSite spec={previewSpec(spec)} />
                  <span className="absolute inset-x-0 bottom-3 mx-auto flex w-fit items-center gap-1.5 rounded-full bg-ink/85 px-3 py-1 text-xs font-medium text-white opacity-0 transition-opacity duration-150 group-hover:opacity-100 group-focus-within:opacity-100">
                    <Eye className="size-3.5" /> Visualizar
                  </span>
                </div>
                <div className="border-t p-3 sm:p-4">
                  <div className="flex min-w-0 items-center gap-2">
                    <span className="size-3 shrink-0 rounded-full" style={{ background: t.theme.primary }} aria-hidden />
                    <h3 className="min-w-0 truncate text-sm font-semibold sm:text-base">
                      <Link href={`/prototypes/templates/${t.id}`} className="after:absolute after:inset-0">
                        {t.label}
                      </Link>
                    </h3>
                    <code className="ml-auto hidden shrink-0 text-[11px] text-muted-foreground lg:inline">template-{t.id}</code>
                  </div>
                  <p className="mt-1.5 hidden text-sm text-muted-foreground sm:block">{t.mood}</p>
                  {usedBy.length > 0 && <p className="mt-1 line-clamp-2 text-xs text-muted-foreground sm:mt-2">Usado em: {usedBy.join(", ")}</p>}
                </div>
              </li>
            );
          })}
        </ul>
      ) : prototypes.length === 0 && onlyFavorites ? (
        <div className="mt-6">
          <EmptyState icon={<Star />} title="Nenhum protótipo favorito">
            Marque a estrela de um protótipo para ele aparecer aqui e no topo da lista.
          </EmptyState>
        </div>
      ) : prototypes.length === 0 ? (
        <div className="mt-6">
          <EmptyState
            icon={<LayoutTemplate />}
            title="Nenhum protótipo ainda"
            action={
              <Button asChild>
                <Link href="/search">Buscar leads</Link>
              </Button>
            }
          >
            Na busca, abra um lead e clique em “Criar protótipo”. Fica pronto em segundos.
          </EmptyState>
        </div>
      ) : (
        <ul className="mt-6 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {prototypes.map((p) => (
            <li key={p.id} className="group relative cv-auto overflow-hidden rounded-lg border bg-card shadow-soft transition-[border-color,box-shadow,transform] duration-200 [--cv-h:300px] hover:border-foreground/25 hover:shadow-premium motion-safe:hover:-translate-y-px">
              <ScaledSite spec={previewSpec(parseSpec(p.spec))} />
              <div className="border-t p-4">
                <div className="flex items-center gap-2">
                  {p.lead.isDemo && <DemoBadge />}
                  <Link href={`/prototypes/${p.id}`} className="min-w-0 truncate font-semibold after:absolute after:inset-0">
                    {p.lead.name}
                  </Link>
                  <div className="-mr-2 ml-auto">
                    <PrototypeCardActions prototype={{ id: p.id, label: `${p.name} de ${p.lead.name}`, favorite: p.favorite, published: p.shareEnabled }} />
                  </div>
                </div>
                <p className="mt-1 flex flex-wrap items-center gap-x-2 text-xs text-muted-foreground">
                  <span>{p.name}</span>·<span>{p.lead.city}</span>·<span>editado {formatRelative(p.updatedAt)}</span>
                  {p.shareEnabled && (
                    <span className="inline-flex items-center gap-1 text-success">
                      · <Globe className="size-3" /> publicado · <Eye className="size-3" /> {formatInt(p.views)}
                    </span>
                  )}
                </p>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
