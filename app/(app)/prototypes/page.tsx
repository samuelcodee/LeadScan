import type { Metadata } from "next";
import Link from "next/link";
import { Eye, Globe, LayoutTemplate, Star } from "lucide-react";
import { DemoBadge, EmptyState, PageHeader } from "@/components/common/page-header";
import { PrototypeCardActions } from "@/components/prototypes/prototype-card-actions";
import { ScaledSite } from "@/components/prototypes/scaled-site";
import { Button } from "@/components/ui/button";
import { requireUser } from "@/lib/auth/session";
import { CATEGORIES } from "@/lib/domain/categories";
import { db } from "@/lib/db";
import { formatInt, formatRelative } from "@/lib/format";
import { parseSpec } from "@/lib/prototypes/service";
import { buildSiteSpec } from "@/lib/templates/build";
import { previewSpec } from "@/lib/templates/preview";
import { TEMPLATE_LIST } from "@/lib/templates/registry";

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
        description={showTemplates ? "Cada categoria usa um template pronto. O conteúdo é preenchido com os dados do lead, sem gastar IA." : "Sites montados para os seus leads."}
      />
      <nav className="mt-6 flex gap-1 overflow-x-auto border-b [scrollbar-width:none]" aria-label="Seções de protótipos">
        {[
          { href: "/prototypes", label: "Seus protótipos", active: !showTemplates && !onlyFavorites },
          { href: "/prototypes?tab=favoritos", label: `Favoritos (${favoriteCount})`, active: onlyFavorites },
          { href: "/prototypes?tab=templates", label: `Biblioteca de templates (${TEMPLATE_LIST.length})`, active: showTemplates },
        ].map((t) => (
          <Link
            key={t.href}
            href={t.href}
            aria-current={t.active ? "page" : undefined}
            className={`-mb-px shrink-0 border-b-2 px-3 py-2 text-sm font-medium transition-colors duration-150 ${t.active ? "border-foreground text-foreground" : "border-transparent text-muted-foreground hover:text-foreground"}`}
          >
            {t.label}
          </Link>
        ))}
      </nav>

      {showTemplates ? (
        <ul className="mt-6 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {TEMPLATE_LIST.map((t) => {
            const cat = CATEGORIES.find((c) => c.template === t.id);
            // Amostra com dados de exemplo — só para visualizar o template
            const spec = buildSiteSpec({
              id: `sample-${t.id}`,
              name: `${t.label.split(" ")[0]} Exemplo`,
              category: cat?.slug ?? "servicos",
              city: "Fortaleza",
              state: "CE",
              neighborhood: "Aldeota",
              address: null,
              phone: null,
              whatsapp: null,
              instagram: null,
              facebook: null,
              openingHours: [],
              rating: 4.8,
              reviewCount: 214,
              mapsUrl: null,
              services: [],
              isDemo: true,
            });
            const usedBy = CATEGORIES.filter((c) => c.template === t.id).map((c) => c.plural);
            return (
              <li key={t.id} className="overflow-hidden rounded-lg border bg-card">
                <ScaledSite spec={previewSpec(spec)} />
                <div className="border-t p-4">
                  <div className="flex items-center gap-2">
                    <span className="size-3 rounded-full" style={{ background: t.theme.primary }} aria-hidden />
                    <h3 className="font-semibold">{t.label}</h3>
                    <code className="ml-auto text-[11px] text-muted-foreground">template-{t.id}</code>
                  </div>
                  <p className="mt-1.5 text-sm text-muted-foreground">{t.mood}</p>
                  {usedBy.length > 0 && <p className="mt-2 text-xs text-muted-foreground">Usado em: {usedBy.join(", ")}</p>}
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
            <li key={p.id} className="group relative overflow-hidden rounded-lg border bg-card shadow-soft transition-[border-color,box-shadow,transform] duration-200 hover:border-foreground/25 hover:shadow-premium motion-safe:hover:-translate-y-px">
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
