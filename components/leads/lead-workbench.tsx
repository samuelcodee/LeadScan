"use client";

import { ArrowUpRight, ExternalLink, LayoutTemplate, Link2, Sparkles, X } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState, useTransition } from "react";
import { toast } from "sonner";
import { createPrototypeAction, shareAction } from "@/app/actions/prototypes";
import { loadWorkbench, type Workbench } from "@/app/actions/workbench";
import { DemoBadge } from "@/components/common/page-header";
import { FavoriteButton, SaveButton, WhatsAppButton } from "@/components/leads/lead-actions";
import { PresenceList } from "@/components/leads/presence";
import { ScoreBreakdown } from "@/components/leads/score";
import { StatusSelect } from "@/components/leads/status-select";
import { OutreachPanel, type OutreachMessage } from "@/components/outreach/outreach-panel";
import { ScaledSite } from "@/components/prototypes/scaled-site";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import type { LeadListItem } from "@/lib/leads/queries";
import type { SiteSpec } from "@/lib/templates/types";

// Cache em memória por lead: voltar a um lead já aberto é instantâneo.
const cache = new Map<string, Workbench>();

function Block({ title, children, aside }: { title: string; children: React.ReactNode; aside?: React.ReactNode }) {
  return (
    <section className="border-t px-5 py-5">
      <div className="mb-3 flex items-center justify-between gap-2">
        <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{title}</h3>
        {aside}
      </div>
      {children}
    </section>
  );
}

/**
 * Painel de trabalho de um lead: entender a oportunidade → montar o site →
 * preparar a mensagem → abrir o WhatsApp. Tudo sem sair da busca.
 */
export function LeadWorkbench({ lead, aiEnabled, onClose }: { lead: LeadListItem; aiEnabled: boolean; onClose?: () => void }) {
  const router = useRouter();
  const [data, setData] = useState<Workbench | null>(cache.get(lead.id) ?? null);
  const [creating, startCreate] = useTransition();
  const [sharing, startShare] = useTransition();
  const [useAI, setUseAI] = useState(false);

  const update = useCallback(
    (patch: Partial<Workbench>) =>
      setData((d) => {
        const next = { ...(d ?? { outreaches: [], prototype: null }), ...patch } as Workbench;
        cache.set(lead.id, next);
        return next;
      }),
    [lead.id],
  );

  useEffect(() => {
    // O painel é montado com key={lead.id}: trocar de lead cria um componente novo
    let alive = true;
    loadWorkbench({ id: lead.id }).then((r) => {
      if (!alive) return;
      if (r.ok) {
        cache.set(lead.id, r.data);
        setData(r.data);
      } else toast.error(r.error);
    });
    return () => {
      alive = false;
    };
  }, [lead.id]);

  const createPrototype = () =>
    startCreate(async () => {
      const r = await createPrototypeAction({ leadId: lead.id, useAI });
      if (!r.ok) return void toast.error(r.error);
      update({ prototype: { id: r.data.id, name: r.data.name, spec: r.data.spec as SiteSpec, shareUrl: null, updatedAt: new Date() } });
      toast.success(`${r.data.name} criado`, { action: { label: "Abrir estúdio", onClick: () => router.push(`/prototypes/${r.data.id}`) } });
    });

  const share = () =>
    startShare(async () => {
      if (!data?.prototype) return;
      const r = await shareAction({ id: data.prototype.id });
      if (!r.ok) return void toast.error(r.error);
      update({ prototype: { ...data.prototype, shareUrl: r.data.url } });
      await navigator.clipboard.writeText(r.data.url).catch(() => {});
      toast.success("Link da proposta copiado");
    });

  const proto = data?.prototype ?? null;
  const location = [lead.neighborhood, `${lead.city} - ${lead.state}`].filter(Boolean).join(", ");

  return (
    <div className="flex h-full flex-col bg-card">
      <div className="flex items-start gap-3 px-5 pb-4 pt-5">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            {lead.isDemo && <DemoBadge />}
            <p className="truncate text-xs text-muted-foreground">
              {lead.categoryLabel} · {location}
            </p>
          </div>
          <h2 className="mt-1 text-lg font-semibold leading-tight tracking-tight">{lead.name}</h2>
        </div>
        <FavoriteButton id={lead.id} favorite={lead.favorite} />
        <Button asChild variant="ghost" size="icon" aria-label="Abrir página do lead" title="Abrir página do lead">
          <Link href={`/leads/${lead.id}`}>
            <ArrowUpRight />
          </Link>
        </Button>
        {onClose && (
          <Button variant="ghost" size="icon" onClick={onClose} aria-label="Fechar painel">
            <X />
          </Button>
        )}
      </div>

      <div className="grid grid-cols-3 gap-2 px-5 pb-5">
        <Button variant="outline" onClick={createPrototype} disabled={creating} className="h-auto flex-col gap-1 py-2.5 text-xs">
          <LayoutTemplate />
          {creating ? "Criando…" : proto ? "Novo protótipo" : "Criar protótipo"}
        </Button>
        <Button
          variant="outline"
          className="h-auto flex-col gap-1 py-2.5 text-xs"
          onClick={() => document.getElementById(`abordagem-${lead.id}`)?.scrollIntoView({ behavior: "smooth", block: "start" })}
        >
          <Sparkles />
          Abordagem
        </Button>
        <WhatsAppButton lead={lead} className="h-auto flex-col gap-1 py-2.5 text-xs" label="WhatsApp" />
      </div>

      <div className="flex-1 overflow-y-auto">
        <Block title="Oportunidade">
          <ScoreBreakdown score={lead.score} tier={lead.scoreTier} reasons={lead.scoreReasons} compact />
        </Block>

        <Block
          title="Protótipo"
          aside={
            aiEnabled && !proto ? (
              <Label className="flex items-center gap-2 text-xs font-normal text-muted-foreground">
                <Switch checked={useAI} onCheckedChange={setUseAI} size="sm" /> Textos com IA
              </Label>
            ) : null
          }
        >
          {!data ? (
            <Skeleton className="aspect-[16/10] w-full" />
          ) : proto ? (
            <div>
              {/* link sobreposto: o site renderizado já tem <a> e link dentro de link é HTML inválido */}
              <div className="relative overflow-hidden rounded-md border transition-colors duration-150 hover:border-foreground/30">
                <ScaledSite spec={proto.spec} />
                <Link href={`/prototypes/${proto.id}`} className="absolute inset-0" aria-label={`Abrir ${proto.name} no estúdio`} />
              </div>
              <div className="mt-3 flex flex-wrap items-center gap-2">
                <Button asChild size="sm">
                  <Link href={`/prototypes/${proto.id}`}>
                    Abrir estúdio <ExternalLink />
                  </Link>
                </Button>
                <Button variant="outline" size="sm" onClick={share} disabled={sharing}>
                  <Link2 />
                  {proto.shareUrl ? "Copiar link" : sharing ? "Gerando…" : "Gerar link para cliente"}
                </Button>
                <span className="ml-auto text-xs text-muted-foreground">{proto.name}</span>
              </div>
            </div>
          ) : (
            <button
              type="button"
              onClick={createPrototype}
              disabled={creating}
              className="grid w-full place-items-center rounded-md border border-dashed px-4 py-8 text-center transition-colors duration-150 hover:border-foreground/30 hover:bg-muted/40"
            >
              <LayoutTemplate className="mb-2 size-5 text-muted-foreground" />
              <span className="text-sm font-medium">{creating ? "Montando o site…" : "Criar protótipo do site"}</span>
              <span className="mt-1 text-xs text-muted-foreground">Template de {lead.categoryLabel.toLowerCase()} com os dados reais</span>
            </button>
          )}
        </Block>

        <div id={`abordagem-${lead.id}`} className="scroll-mt-4">
          <Block title="Abordagem">
            {!data ? (
              <Skeleton className="h-40 w-full" />
            ) : (
              <OutreachPanel
                lead={lead}
                messages={data.outreaches as OutreachMessage[]}
                prototype={proto ? { id: proto.id, shareUrl: proto.shareUrl } : null}
                aiEnabled={aiEnabled}
                onMessages={(m) => update({ outreaches: m.map((x) => ({ ...x, updatedAt: new Date() })) })}
                onShareUrl={(url) => proto && update({ prototype: { ...proto, shareUrl: url } })}
              />
            )}
          </Block>
        </div>

        <Block title="Presença digital">
          <PresenceList lead={lead} />
        </Block>

        <Block title="Etapa">
          <div className="flex flex-wrap items-center gap-2">
            <StatusSelect id={lead.id} status={lead.status} />
            <SaveButton id={lead.id} saved={lead.saved} />
          </div>
        </Block>
      </div>
    </div>
  );
}
