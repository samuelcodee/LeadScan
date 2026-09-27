"use client";

import { Globe, MapPin, MessageCircle, Star } from "lucide-react";
import { Instagram } from "@/components/icons";
import { warnDemoLink } from "@/components/leads/presence-icons";
import { DemoBadge } from "@/components/common/page-header";
import { SaveButton, StatusDot, WhatsAppButton } from "@/components/leads/lead-actions";
import { ScoreBadge } from "@/components/leads/score";
import { Button } from "@/components/ui/button";
import { STATUS_META } from "@/lib/domain/lead-status";
import { formatInt, formatRating } from "@/lib/format";
import type { LeadListItem } from "@/lib/leads/queries";
import { leadLinks } from "@/lib/leads/links";
import { classifyWebsite, WEBSITE_KIND_LABEL } from "@/lib/scoring/website";
import { cn } from "@/lib/utils";
import { whatsappAvailability } from "@/lib/whatsapp/phone";

function Signal({
  icon,
  children,
  tone = "default",
  href,
  label,
  onOpen,
}: {
  icon: React.ReactNode;
  children: React.ReactNode;
  tone?: "default" | "good" | "muted" | "opportunity";
  href?: string | null;
  label?: string;
  onOpen?: () => void;
}) {
  const cls = cn(
    "inline-flex items-center gap-1 text-xs [&_svg]:size-3.5",
    tone === "muted" && "text-muted-foreground",
    tone === "good" && "text-success",
    tone === "opportunity" && "font-medium text-brand-ink",
  );
  // Com destino, o sinal vira link (acima do botão que cobre o card)
  if (href)
    return (
      <a
        href={href}
        target="_blank"
        rel="noopener noreferrer nofollow"
        onClick={onOpen}
        aria-label={label}
        title={label}
        className={cn(cls, "relative z-10 -m-1 rounded p-1 underline-offset-2 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring")}
      >
        {icon}
        {children}
      </a>
    );
  return (
    <span className={cls}>
      {icon}
      {children}
    </span>
  );
}

/**
 * Card de resultado. O corpo inteiro seleciona o lead (abre o painel de trabalho);
 * as ações rápidas ficam na base, alcançáveis com o polegar no celular.
 */
export function LeadCard({
  lead,
  selected,
  onSelect,
  onCreatePrototype,
  creating,
}: {
  lead: LeadListItem;
  selected?: boolean;
  onSelect: () => void;
  onCreatePrototype: () => void;
  creating?: boolean;
}) {
  const site = classifyWebsite(lead.website);
  const noOwnSite = site.kind !== "own" && site.kind !== "free-builder";
  const wa = whatsappAvailability(lead);
  const where = [lead.neighborhood, `${lead.city} - ${lead.state}`].filter(Boolean).join(", ");
  const links = leadLinks(lead);

  return (
    <article
      className={cn(
        "group rounded-lg border bg-card shadow-soft transition-[border-color,box-shadow,transform] duration-200",
        // selecionado: contorno preto + fio lima na borda esquerda; hover: leve elevação
        selected ? "border-foreground/50 shadow-premium [box-shadow:inset_3px_0_0_var(--color-lime),var(--shadow-premium)]" : "hover:border-foreground/20 hover:shadow-premium motion-safe:hover:-translate-y-px",
      )}
    >
      <div className="relative p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h3 className="font-semibold leading-tight">
              {/* o ::after cobre o topo do card: clicar em qualquer lugar seleciona o lead */}
              <button type="button" onClick={onSelect} className="block w-full truncate text-left outline-none after:absolute after:inset-0 after:rounded-t-lg focus-visible:after:ring-2 focus-visible:after:ring-ring">
                {lead.name}
              </button>
            </h3>
            <p className="mt-1 truncate text-xs text-muted-foreground">
              {lead.categoryLabel} · {where}
            </p>
          </div>
          <ScoreBadge score={lead.score} tier={lead.scoreTier} />
        </div>
        <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1.5">
          {lead.reviewCount !== null ? (
            <Signal icon={<Star className="fill-current text-amber-500" />} href={links.maps.href} label="Ver avaliações no Google">
              {lead.rating !== null && <span className="font-medium">{formatRating(lead.rating)}</span>}
              <span className="text-muted-foreground">({formatInt(lead.reviewCount)})</span>
            </Signal>
          ) : (
            <Signal icon={<Star />} tone="muted" href={links.maps.href} label="Ver no Google Maps">
              sem avaliações
            </Signal>
          )}
          <Signal icon={<Globe />} tone={noOwnSite ? "opportunity" : "muted"} href={links.site.href} label={links.site.found ? `Abrir ${links.site.label}` : "Sem site encontrado — pesquisar no Google"} onOpen={() => warnDemoLink(lead.isDemo, "o site")}>
            {site.kind === "none" ? "Sem site" : WEBSITE_KIND_LABEL[site.kind]}
          </Signal>
          <Signal icon={<Instagram />} tone={lead.instagram ? "default" : "muted"} href={links.instagram.href} label={links.instagram.found ? `Abrir Instagram ${links.instagram.label}` : "Procurar o Instagram no Google"} onOpen={() => warnDemoLink(lead.isDemo, "o Instagram")}>
            {lead.instagram ? `@${lead.instagram}` : "Procurar Instagram"}
          </Signal>
          <Signal icon={<MessageCircle />} tone={wa === "confirmed" ? "good" : wa === "none" ? "muted" : "default"} href={links.whatsapp.href} label="Abrir conversa no WhatsApp" onOpen={() => warnDemoLink(lead.isDemo, "o número")}>
            {wa === "confirmed" ? "WhatsApp" : wa === "likely" ? "Celular" : wa === "unknown" ? "Fixo" : "Sem telefone"}
          </Signal>
          <Signal icon={<MapPin />} href={links.maps.href} label="Ver no Google Maps" onOpen={() => warnDemoLink(lead.isDemo, "o endereço")}>
            Mapa
          </Signal>
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-2 border-t px-3 py-2.5">
        {lead.isDemo && <DemoBadge />}
        {lead.status !== "NEW" && (
          <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <StatusDot status={lead.status} />
            {STATUS_META[lead.status].label}
          </span>
        )}
        <div className="ml-auto flex items-center gap-1.5">
          <Button variant="ghost" size="sm" onClick={onSelect} className="hidden sm:inline-flex">
            Ver detalhes
          </Button>
          <Button variant="outline" size="sm" onClick={onCreatePrototype} disabled={creating}>
            {creating ? "Criando…" : lead._count.prototypes ? "Novo protótipo" : "Criar protótipo"}
          </Button>
          <WhatsAppButton lead={lead} iconOnly size="icon-sm" />
          <SaveButton id={lead.id} saved={lead.saved} iconOnly className="size-7" />
        </div>
      </div>
    </article>
  );
}
