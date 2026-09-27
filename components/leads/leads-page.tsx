import { Columns3, Search, Star, Users } from "lucide-react";
import Link from "next/link";
import { EmptyState, PageHeader } from "@/components/common/page-header";
import { Pagination } from "@/components/common/pagination";
import { LeadsTable } from "@/components/leads/leads-table";
import { LeadsToolbar } from "@/components/leads/leads-toolbar";
import { Button } from "@/components/ui/button";
import { requireUser } from "@/lib/auth/session";
import { STATUS_ORDER } from "@/lib/domain/lead-status";
import { formatInt } from "@/lib/format";
import type { LeadStatus } from "@/lib/generated/prisma/enums";
import { listLeads } from "@/lib/leads/queries";

type SP = Record<string, string | string[] | undefined>;

/** Página compartilhada por "Meus leads" e "Favoritos". */
export async function LeadsPage({ searchParams, favorites }: { searchParams: SP; favorites?: boolean }) {
  const user = await requireUser();
  const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);
  const rawStatus = one(searchParams.status) as LeadStatus | undefined;
  const status = rawStatus && STATUS_ORDER.includes(rawStatus) ? rawStatus : undefined;
  const sort = (["score", "recent", "name"] as const).find((s) => s === one(searchParams.sort)) ?? "score";
  const page = Math.max(1, Number(one(searchParams.page)) || 1);
  const q = one(searchParams.q)?.slice(0, 80);
  const data = await listLeads(user.id, { saved: favorites ? undefined : true, favorite: favorites, status, q, sort, page, pageSize: 25 });
  const base = new URLSearchParams(
    Object.entries({ q, status, sort: sort === "score" ? undefined : sort }).filter((e): e is [string, string] => Boolean(e[1])),
  );

  return (
    <div className="mx-auto max-w-6xl px-4 py-6 sm:px-6 sm:py-8">
      <PageHeader
        title={favorites ? "Favoritos" : "Meus leads"}
        description={
          favorites ? "Os leads que você marcou com estrela." : `${formatInt(data.total)} leads salvos. Clique em um para ver histórico, abordagem e protótipos.`
        }
        actions={
          !favorites && (
            <Button asChild variant="outline">
              <Link href="/pipeline">
                <Columns3 /> Ver em pipeline
              </Link>
            </Button>
          )
        }
      />
      <div className="mt-6">
        <LeadsToolbar />
      </div>
      <div className="mt-4">
        {data.leads.length ? (
          <>
            <LeadsTable leads={data.leads} />
            <Pagination page={data.page} pageSize={data.pageSize} total={data.total} baseParams={base} path={favorites ? "/favorites" : "/leads"} />
          </>
        ) : q || status ? (
          <EmptyState icon={<Search />} title="Nada com esses filtros">
            Tente outro termo ou limpe o filtro de etapa.
          </EmptyState>
        ) : (
          <EmptyState
            icon={favorites ? <Star /> : <Users />}
            title={favorites ? "Nenhum favorito ainda" : "Nenhum lead salvo ainda"}
            action={
              <Button asChild>
                <Link href="/search">Buscar leads</Link>
              </Button>
            }
          >
            {favorites ? "Marque a estrela de um lead para ele aparecer aqui." : "Salve leads da busca para acompanhar no CRM."}
          </EmptyState>
        )}
      </div>
    </div>
  );
}
