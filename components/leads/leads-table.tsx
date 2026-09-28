import Link from "next/link";
import { DemoBadge } from "@/components/common/page-header";
import { StatusDot, WhatsAppButton } from "@/components/leads/lead-actions";
import { LeadRowActions } from "@/components/leads/lead-row-actions";
import { PresenceIcons } from "@/components/leads/presence-icons";
import { ScoreBadge } from "@/components/leads/score";
import { STATUS_META } from "@/lib/domain/lead-status";
import { formatRelative } from "@/lib/format";
import type { LeadListItem } from "@/lib/leads/queries";

/** Tabela no desktop, lista empilhada no celular. A linha inteira abre o CRM do lead. */
export function LeadsTable({ leads }: { leads: LeadListItem[] }) {
  return (
    <div className="overflow-hidden rounded-lg border bg-card shadow-soft">
      <table className="w-full text-sm">
        <thead className="hidden border-b bg-muted/40 text-left text-xs text-muted-foreground md:table-header-group">
          <tr>
            <th className="px-4 py-2.5 font-medium">Empresa</th>
            <th className="px-3 py-2.5 font-medium">Potencial</th>
            <th className="px-3 py-2.5 font-medium">Etapa</th>
            <th className="px-3 py-2.5 font-medium">Presença</th>
            <th className="px-3 py-2.5 font-medium">Último contato</th>
            <th className="px-3 py-2.5 font-medium">
              <span className="sr-only">Ações</span>
            </th>
          </tr>
        </thead>
        <tbody className="divide-y">
          {leads.map((l) => (
            <tr key={l.id} className="relative flex flex-wrap items-center gap-x-3 gap-y-2 px-4 py-3 hover:bg-muted/40 max-md:cv-auto max-md:[--cv-h:128px] md:table-row md:p-0">
              <td className="min-w-0 flex-1 basis-full md:px-4 md:py-3">
                {/* ::after cobre a linha toda: clique em qualquer lugar abre o lead */}
                <Link href={`/leads/${l.id}`} className="font-medium after:absolute after:inset-0 focus-visible:outline-none">
                  {l.name}
                </Link>
                <p className="mt-0.5 flex items-center gap-1.5 truncate text-xs text-muted-foreground">
                  {l.isDemo && <DemoBadge className="h-4" />}
                  {l.categoryLabel} · {l.city} - {l.state}
                </p>
              </td>
              <td className="md:px-3 md:py-3">
                <ScoreBadge score={l.score} tier={l.scoreTier} />
              </td>
              <td className="md:px-3 md:py-3">
                <span className="flex items-center gap-1.5 whitespace-nowrap text-xs">
                  <StatusDot status={l.status} />
                  {STATUS_META[l.status].label}
                </span>
              </td>
              <td className="md:px-2 md:py-2">
                <PresenceIcons lead={{ isDemo: l.isDemo, website: l.website, instagram: l.instagram, phone: l.phone, whatsapp: l.whatsapp, mapsUrl: l.mapsUrl, name: l.name, city: l.city, state: l.state, address: l.address }} className="-ml-2" />
              </td>
              <td className="hidden whitespace-nowrap text-xs text-muted-foreground md:table-cell md:px-3 md:py-3">
                {l.lastContactAt ? formatRelative(l.lastContactAt) : "—"}
              </td>
              <td className="relative z-10 ml-auto md:px-3 md:py-2">
                <span className="flex items-center justify-end gap-1">
                  <LeadRowActions lead={{ id: l.id, name: l.name, saved: l.saved, favorite: l.favorite }} />
                  <WhatsAppButton lead={{ id: l.id, isDemo: l.isDemo, phone: l.phone, whatsapp: l.whatsapp }} iconOnly size="icon-sm" />
                </span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
