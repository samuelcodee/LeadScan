import type { Metadata } from "next";
import Link from "next/link";
import { List } from "lucide-react";
import { PageHeader } from "@/components/common/page-header";
import { PipelineBoard } from "@/components/pipeline/board";
import { Button } from "@/components/ui/button";
import { requireUser } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { OPEN_STAGES } from "@/lib/domain/lead-status";
import { formatBRL } from "@/lib/format";

export const metadata: Metadata = { title: "Prospecções" };

export default async function PipelinePage() {
  const user = await requireUser();
  const leads = await db.lead.findMany({
    where: { userId: user.id, saved: true },
    orderBy: { score: "desc" },
    take: 400,
    select: {
      id: true,
      name: true,
      categoryLabel: true,
      city: true,
      state: true,
      score: true,
      scoreTier: true,
      status: true,
      isDemo: true,
      phone: true,
      whatsapp: true,
      dealValue: true,
      lastContactAt: true,
    },
  });
  const open = leads.filter((l) => OPEN_STAGES.includes(l.status));
  const value = open.reduce((s, l) => s + (l.dealValue ?? user.defaultTicket), 0);

  return (
    <div className="px-4 py-6 sm:px-6 sm:py-8">
      <PageHeader
        title="Prospecções"
        description={
          <>
            {open.length} em andamento · <span className="font-medium text-foreground">{formatBRL(value)}</span> em potencial. Arraste os cards para mudar de etapa.
          </>
        }
        actions={
          <Button asChild variant="outline">
            <Link href="/leads">
              <List /> Ver em lista
            </Link>
          </Button>
        }
      />
      <div className="mt-6">
        <PipelineBoard leads={leads} defaultTicket={user.defaultTicket} />
      </div>
    </div>
  );
}
