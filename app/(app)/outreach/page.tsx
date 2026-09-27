import type { Metadata } from "next";
import Link from "next/link";
import { MessageSquareText } from "lucide-react";
import { DemoBadge, EmptyState, PageHeader } from "@/components/common/page-header";
import { StatusDot } from "@/components/leads/lead-actions";
import { OutreachPanel, type OutreachMessage } from "@/components/outreach/outreach-panel";
import { Pagination } from "@/components/common/pagination";
import { Button } from "@/components/ui/button";
import { isAIEnabled } from "@/lib/ai";
import { requireUser } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { STATUS_META } from "@/lib/domain/lead-status";
import { formatRelative } from "@/lib/format";
import { proposalUrl } from "@/lib/prototypes/service";

export const metadata: Metadata = { title: "Abordagens" };

/** Mensagens prontas, agrupadas por lead — da mais recente para a mais antiga. */
const PAGE_SIZE = 15;

export default async function OutreachPage(props: PageProps<"/outreach">) {
  const user = await requireUser();
  const sp = await props.searchParams;
  const page = Math.max(1, Number(Array.isArray(sp.page) ? sp.page[0] : sp.page) || 1);
  const where = { userId: user.id, outreaches: { some: {} } };
  const [total, leads] = await Promise.all([
    db.lead.count({ where }),
    db.lead.findMany({
      where,
      orderBy: { updatedAt: "desc" },
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
      select: {
        id: true,
        name: true,
        city: true,
        categoryLabel: true,
        isDemo: true,
        phone: true,
        whatsapp: true,
        status: true,
        outreaches: { select: { id: true, variant: true, content: true, source: true, updatedAt: true } },
        prototypes: { orderBy: { createdAt: "desc" }, take: 1, select: { id: true, shareEnabled: true, shareSlug: true } },
      },
    }),
  ]);
  const ai = await isAIEnabled(user.id);

  return (
    <div className="mx-auto max-w-5xl px-4 py-6 sm:px-6 sm:py-8">
      <PageHeader title="Abordagens" description="Mensagens geradas para cada lead. Edite, copie ou abra direto no WhatsApp." />
      {leads.length === 0 ? (
        <div className="mt-6">
          <EmptyState
            icon={<MessageSquareText />}
            title="Nenhuma abordagem ainda"
            action={
              <Button asChild>
                <Link href="/search">Buscar leads</Link>
              </Button>
            }
          >
            Abra um lead e clique em “Gerar abordagem”. São 3 versões, feitas com os dados reais do negócio.
          </EmptyState>
        </div>
      ) : (
        <ul className="mt-6 grid grid-cols-1 gap-4">
          {await Promise.all(
            leads.map(async (l) => {
              const p = l.prototypes[0];
              const shareUrl = p?.shareEnabled && p.shareSlug ? await proposalUrl(p.shareSlug) : null;
              const updated = l.outreaches.reduce((m, o) => (o.updatedAt > m ? o.updatedAt : m), l.outreaches[0].updatedAt);
              return (
                <li key={l.id} className="grid gap-4 rounded-lg border bg-card p-5 md:grid-cols-[220px_minmax(0,1fr)]">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      {l.isDemo && <DemoBadge />}
                      <Link href={`/leads/${l.id}`} className="truncate font-semibold hover:underline">
                        {l.name}
                      </Link>
                    </div>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {l.categoryLabel} · {l.city}
                    </p>
                    <p className="mt-2 flex items-center gap-1.5 text-xs">
                      <StatusDot status={l.status} /> {STATUS_META[l.status].label}
                    </p>
                    <p className="mt-1 text-xs text-muted-foreground">Atualizada {formatRelative(updated)}</p>
                  </div>
                  <OutreachPanel
                    lead={{ id: l.id, name: l.name, isDemo: l.isDemo, phone: l.phone, whatsapp: l.whatsapp }}
                    messages={l.outreaches as OutreachMessage[]}
                    prototype={p ? { id: p.id, shareUrl } : null}
                    aiEnabled={ai}
                  />
                </li>
              );
            }),
          )}
        </ul>
      )}
      {total > PAGE_SIZE && <Pagination page={page} pageSize={PAGE_SIZE} total={total} baseParams={new URLSearchParams()} path="/outreach" />}
    </div>
  );
}
