import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Eye } from "lucide-react";
import { DemoBadge } from "@/components/common/page-header";
import { ChargeDialog } from "@/components/finance/charge-dialog";
import { FavoriteButton, SaveButton, WhatsAppButton } from "@/components/leads/lead-actions";
import { CreatePrototypeButton, DealValueInput, DeleteLeadButton, NotesEditor, PrototypeActions } from "@/components/leads/lead-crm-client";
import { PresenceList } from "@/components/leads/presence";
import { ScoreBreakdown } from "@/components/leads/score";
import { StatusSelect } from "@/components/leads/status-select";
import { OutreachPanel, type OutreachMessage } from "@/components/outreach/outreach-panel";
import { ScaledSite } from "@/components/prototypes/scaled-site";
import { isAIEnabled } from "@/lib/ai";
import { requireUser } from "@/lib/auth/session";
import { formatDate, formatInt } from "@/lib/format";
import { EVENT_LABEL } from "@/lib/leads/events";
import { getLeadDetail } from "@/lib/leads/queries";
import { parseSpec, proposalUrl } from "@/lib/prototypes/service";
import { getProvider } from "@/lib/providers";
import { STATUS_META } from "@/lib/domain/lead-status";
import type { LeadStatus } from "@/lib/generated/prisma/enums";
import { previewSpec } from "@/lib/templates/preview";

export async function generateMetadata(props: PageProps<"/leads/[id]">): Promise<Metadata> {
  const user = await requireUser();
  const { id } = await props.params;
  const lead = await getLeadDetail(user.id, id);
  return { title: lead?.name ?? "Lead" };
}

function Card({ title, children, aside }: { title: string; children: React.ReactNode; aside?: React.ReactNode }) {
  return (
    <section className="rounded-lg border bg-card">
      <div className="flex items-center justify-between gap-2 border-b px-5 py-3">
        <h2 className="text-sm font-semibold">{title}</h2>
        {aside}
      </div>
      <div className="p-5">{children}</div>
    </section>
  );
}

export default async function LeadPage(props: PageProps<"/leads/[id]">) {
  const user = await requireUser();
  const { id } = await props.params;
  const lead = await getLeadDetail(user.id, id);
  if (!lead) notFound();

  const prototypes = await Promise.all(
    lead.prototypes.map(async (p) => ({ ...p, spec: parseSpec(p.spec), shareUrl: p.shareEnabled && p.shareSlug ? await proposalUrl(p.shareSlug) : null })),
  );
  const latest = prototypes[0] ?? null;
  const waLead = { id: lead.id, name: lead.name, isDemo: lead.isDemo, phone: lead.phone, whatsapp: lead.whatsapp };
  const source = getProvider(lead.provider as "mock" | "osm" | "google");

  // Histórico agrupado por dia
  const byDay = new Map<string, typeof lead.events>();
  for (const e of lead.events) {
    const k = formatDate(e.createdAt, "long");
    byDay.set(k, [...(byDay.get(k) ?? []), e]);
  }

  return (
    <div className="mx-auto max-w-6xl px-4 py-6 sm:px-6 sm:py-8">
      <Link href="/leads" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="size-4" /> Meus leads
      </Link>

      <div className="mt-4 flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            {lead.isDemo && <DemoBadge />}
            {lead.categoryLabel} · {[lead.neighborhood, `${lead.city} - ${lead.state}`].filter(Boolean).join(", ")}
          </div>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight sm:text-3xl">{lead.name}</h1>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <FavoriteButton id={lead.id} favorite={lead.favorite} />
          <SaveButton id={lead.id} saved={lead.saved} />
          <StatusSelect id={lead.id} status={lead.status} />
          <ChargeDialog leadId={lead.id} prototypeId={latest?.id} variant="outline" />
          <WhatsAppButton lead={waLead} />
        </div>
      </div>

      <div className="mt-6 grid gap-5 lg:grid-cols-[minmax(0,1fr)_360px]">
        <div className="grid content-start gap-5">
          <Card title="Abordagem">
            <OutreachPanel
              lead={waLead}
              messages={lead.outreaches.map((o) => ({ id: o.id, variant: o.variant, content: o.content, source: o.source })) as OutreachMessage[]}
              prototype={latest ? { id: latest.id, shareUrl: latest.shareUrl } : null}
              aiEnabled={await isAIEnabled(user.id)}
            />
          </Card>

          <Card title="Protótipos" aside={prototypes.length > 0 && <CreatePrototypeButton leadId={lead.id} label="Nova versão" variant="outline" />}>
            {prototypes.length === 0 ? (
              <div className="grid place-items-center py-6 text-center">
                <p className="text-sm text-muted-foreground">Ainda não tem protótipo. Leva poucos segundos e não gasta IA.</p>
                <div className="mt-4">
                  <CreatePrototypeButton leadId={lead.id} />
                </div>
              </div>
            ) : (
              <ul className="grid gap-4 sm:grid-cols-2">
                {prototypes.map((p) => (
                  <li key={p.id} className="overflow-hidden rounded-md border">
                    <div className="relative">
                      <ScaledSite spec={previewSpec(p.spec)} />
                      <Link href={`/prototypes/${p.id}`} className="absolute inset-0" aria-label={`Abrir ${p.name}`} />
                    </div>
                    <div className="flex flex-wrap items-center justify-between gap-2 border-t p-3">
                      <div className="min-w-0">
                        <p className="text-sm font-medium">{p.name}</p>
                        <p className="flex items-center gap-2 text-xs text-muted-foreground">
                          Criado em {formatDate(p.createdAt)}
                          {p.shareEnabled && (
                            <span className="inline-flex items-center gap-1">
                              · <Eye className="size-3" /> {formatInt(p.views)}
                            </span>
                          )}
                        </p>
                      </div>
                      <PrototypeActions prototypeId={p.id} shareUrl={p.shareUrl} lead={waLead} />
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </Card>

          <Card title="Histórico">
            {lead.events.length === 0 ? (
              <p className="text-sm text-muted-foreground">Sem eventos ainda.</p>
            ) : (
              <ol className="grid gap-5">
                {[...byDay.entries()].map(([day, events]) => (
                  <li key={day}>
                    <p className="text-xs font-semibold text-muted-foreground">{day}</p>
                    <ul className="mt-2 grid gap-2 border-l pl-4">
                      {events.map((e) => {
                        const meta = (e.meta ?? {}) as { to?: LeadStatus; auto?: boolean; source?: string };
                        return (
                          <li key={e.id} className="relative text-sm">
                            <span className="absolute -left-[21px] top-1.5 size-2 rounded-full bg-border ring-4 ring-card" aria-hidden />
                            <span className="text-muted-foreground tabular">{formatDate(e.createdAt, "time").split(" ")[1]}</span>{" "}
                            {EVENT_LABEL[e.type]}
                            {e.type === "STATUS_CHANGED" && meta.to && (
                              <span className="text-muted-foreground">
                                {" "}
                                → {STATUS_META[meta.to].label}
                                {meta.auto && " (automático)"}
                              </span>
                            )}
                            {e.type === "OUTREACH_GENERATED" && meta.source === "AI" && <span className="text-muted-foreground"> · com IA</span>}
                          </li>
                        );
                      })}
                    </ul>
                  </li>
                ))}
              </ol>
            )}
          </Card>
        </div>

        <div className="grid content-start gap-5">
          <Card title="Oportunidade">
            <ScoreBreakdown score={lead.score} tier={lead.scoreTier} reasons={lead.scoreReasons} />
          </Card>
          <Card title="Informações">
            <PresenceList lead={lead} className="-my-2" />
            {lead.description && <p className="mt-3 border-t pt-3 text-sm text-muted-foreground">{lead.description}</p>}
          </Card>
          <Card title="Negócio">
            <div className="grid gap-4">
              <div className="grid gap-1.5">
                <span className="text-xs font-medium text-muted-foreground">Valor estimado</span>
                <DealValueInput id={lead.id} initialReais={lead.dealValue === null ? null : lead.dealValue / 100} placeholderReais={user.defaultTicket / 100} />
              </div>
              <div className="grid gap-1.5">
                <span className="text-xs font-medium text-muted-foreground">Observações</span>
                <NotesEditor id={lead.id} initial={lead.notes ?? ""} />
              </div>
            </div>
          </Card>
          <div className="px-1 text-xs text-muted-foreground">
            <p>
              Fonte: {source.label} · encontrado em {formatDate(lead.createdAt)} · dados de {formatDate(lead.fetchedAt)}
            </p>
            <div className="mt-2 -ml-2">
              <DeleteLeadButton id={lead.id} name={lead.name} />
            </div>
          </div>
        </div>
      </div>

    </div>
  );
}
