import { Clock, Globe, MapPin, MessageCircle, Phone, Star } from "lucide-react";
import { Facebook, Instagram } from "@/components/icons";
import type { ReactNode } from "react";
import { formatInt, formatRating } from "@/lib/format";
import { leadLinks } from "@/lib/leads/links";
import { classifyWebsite, WEBSITE_KIND_LABEL } from "@/lib/scoring/website";
import { cn } from "@/lib/utils";
import { WHATSAPP_AVAILABILITY_LABEL, formatPhone, whatsappAvailability } from "@/lib/whatsapp/phone";

export type PresenceLead = {
  isDemo: boolean;
  provider: string;
  website: string | null;
  instagram: string | null;
  facebook: string | null;
  phone: string | null;
  whatsapp: string | null;
  rating: number | null;
  reviewCount: number | null;
  mapsUrl: string | null;
  address: string | null;
  openingHours: string[];
};

const NOT_FOUND = "Não encontrado";

/** O ícone também é link (um clique abre o perfil/conversa); sem destino fica só o desenho. */
function Row({ icon, label, children, muted, href }: { icon: ReactNode; label: string; children: ReactNode; muted?: boolean; href?: string | null }) {
  return (
    <div className="grid grid-cols-[1.25rem_5.5rem_1fr] items-start gap-2 py-2 text-sm">
      {href ? (
        <a
          href={href}
          target={href.startsWith("tel:") ? undefined : "_blank"}
          rel="noopener noreferrer nofollow"
          aria-label={`Abrir ${label}`}
          title={`Abrir ${label}`}
          className="-m-1 mt-[-0.125rem] grid size-7 place-items-center rounded-md text-foreground transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring [&_svg]:size-4"
        >
          {icon}
        </a>
      ) : (
        <span className="mt-0.5 text-muted-foreground [&_svg]:size-4" aria-hidden>
          {icon}
        </span>
      )}
      <span className="text-muted-foreground">{label}</span>
      <span className={cn("min-w-0 break-words", muted && "text-muted-foreground")}>{children}</span>
    </div>
  );
}

/** Link externo (perfil, site, Google). Nos leads DEMO também abre — é só leitura; telefone e WhatsApp têm regra própria em leadLinks(). */
function Out({ href, children }: { href: string | null; children: ReactNode }) {
  if (!href) return <>{children}</>;
  return (
    <a href={href} target={href.startsWith("tel:") ? undefined : "_blank"} rel="noopener noreferrer nofollow" className="underline decoration-border underline-offset-4 hover:decoration-foreground">
      {children}
    </a>
  );
}

export function PresenceList({ lead, className }: { lead: PresenceLead; className?: string }) {
  const site = classifyWebsite(lead.website);
  const links = leadLinks(lead);
  const siteUrl = links.site.href;
  const wa = whatsappAvailability(lead);
  const waNumber = formatPhone(lead.whatsapp ?? lead.phone);
  const reviewsKnown = lead.reviewCount !== null;

  return (
    <div className={cn("divide-y divide-border/70", className)}>
      <Row icon={<Globe />} label="Site" muted={site.kind === "none"} href={siteUrl}>
        {site.kind === "none" ? (
          NOT_FOUND
        ) : site.kind === "own" ? (
          <>
            <Out href={siteUrl}>
              {site.host}
            </Out>
            {!site.https && <span className="ml-1.5 text-xs text-warning">sem HTTPS</span>}
          </>
        ) : (
          <>
            <span className={cn(site.kind === "discontinued" && "text-destructive")}>{WEBSITE_KIND_LABEL[site.kind]}</span>
            <span className="text-muted-foreground"> · </span>
            <Out href={siteUrl}>
              <span className="text-muted-foreground">{site.host}</span>
            </Out>
          </>
        )}
      </Row>
      <Row icon={<Instagram />} label="Instagram" muted={!lead.instagram} href={links.instagram.href}>
        {lead.instagram ? (
          <Out href={links.instagram.href}>
            @{lead.instagram}
          </Out>
        ) : (
          NOT_FOUND
        )}
      </Row>
      <Row icon={<MessageCircle />} label="WhatsApp" muted={wa === "none"} href={links.whatsapp.href}>
        <Out href={links.whatsapp.href}>
          <span className={cn(wa === "confirmed" && "text-success")}>{WHATSAPP_AVAILABILITY_LABEL[wa]}</span>
        </Out>
        {wa !== "none" && waNumber && <span className="text-muted-foreground"> · {waNumber}</span>}
      </Row>
      <Row icon={<Phone />} label="Telefone" muted={!lead.phone} href={links.phone.href}>
        {lead.phone ? <Out href={links.phone.href}>{formatPhone(lead.phone) ?? lead.phone}</Out> : NOT_FOUND}
      </Row>
      <Row icon={<Star />} label="Google" muted={!reviewsKnown} href={links.maps.href}>
        {reviewsKnown ? (
          <Out href={links.maps.href}>
            {lead.rating !== null ? `★ ${formatRating(lead.rating)} · ` : ""}
            {formatInt(lead.reviewCount!)} avaliações
          </Out>
        ) : lead.provider === "osm" ? (
          "Fonte sem avaliações"
        ) : (
          NOT_FOUND
        )}
      </Row>
      {lead.facebook && (
        <Row icon={<Facebook />} label="Facebook" href={links.facebook.href}>
          <Out href={links.facebook.href}>
            {lead.facebook.replace(/^https?:\/\/(www\.)?/, "")}
          </Out>
        </Row>
      )}
      <Row icon={<MapPin />} label="Endereço" muted={!lead.address}>
        {lead.address ?? NOT_FOUND}
      </Row>
      <Row icon={<Clock />} label="Horário" muted={lead.openingHours.length === 0}>
        {lead.openingHours.length ? (
          <span className="block space-y-0.5">
            {lead.openingHours.map((h) => (
              <span key={h} className="block">
                {h}
              </span>
            ))}
          </span>
        ) : (
          NOT_FOUND
        )}
      </Row>
    </div>
  );
}
