"use client";

import { Globe, MessageCircle } from "lucide-react";
import { toast } from "sonner";
import { Facebook, Instagram } from "@/components/icons";
import { leadLinks, type LinkLead } from "@/lib/leads/links";
import { cn } from "@/lib/utils";

let demoWarned = false;
/** Lead DEMO: avisa uma vez por sessão que o perfil é inventado (o link abre mesmo assim). */
export function warnDemoLink(isDemo: boolean, what: string) {
  if (!isDemo || demoWarned) return;
  demoWarned = true;
  toast.info(`Lead DEMO: ${what} é fictício e pode não existir.`);
}

type Item = { key: string; href: string | null; on: boolean; icon: React.ReactNode; label: string; what: string };

/**
 * Ícones de presença clicáveis: site, Instagram, WhatsApp (e Facebook quando há).
 * Aceso = o lead tem; apagado = não encontrado. Com destino, um clique abre em nova aba.
 * Área de toque de 28 px (o ícone tem 16) e z-10 para ficar acima do link que cobre a linha.
 */
export function PresenceIcons({ lead, className, withFacebook }: { lead: LinkLead; className?: string; withFacebook?: boolean }) {
  const links = leadLinks(lead);
  const items: Item[] = [
    { key: "site", href: links.site.href, on: links.site.own, icon: <Globe />, label: links.site.href ? `Abrir ${links.site.label}` : "Sem site", what: "o site" },
    { key: "ig", href: links.instagram.href, on: !!links.instagram.href, icon: <Instagram />, label: links.instagram.href ? `Abrir Instagram ${links.instagram.label}` : "Sem Instagram", what: "o Instagram" },
    {
      key: "wa",
      href: links.whatsapp.href,
      on: links.whatsapp.on,
      icon: <MessageCircle />,
      label: links.whatsapp.href ? "Abrir conversa no WhatsApp" : "Sem WhatsApp",
      what: "o número",
    },
  ];
  if (withFacebook && links.facebook.href) items.push({ key: "fb", href: links.facebook.href, on: true, icon: <Facebook />, label: "Abrir Facebook", what: "o Facebook" });

  return (
    <span className={cn("relative z-10 flex items-center gap-0.5", className)}>
      {items.map((i) =>
        i.href ? (
          <a
            key={i.key}
            href={i.href}
            target="_blank"
            rel="noopener noreferrer nofollow"
            onClick={() => warnDemoLink(lead.isDemo, i.what)}
            aria-label={i.label}
            title={i.label}
            className={cn(
              "grid size-7 place-items-center rounded-md transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring [&_svg]:size-4",
              i.on ? "text-foreground" : "text-muted-foreground",
              i.key === "wa" && i.on && "hover:text-success",
            )}
          >
            {i.icon}
          </a>
        ) : (
          <span key={i.key} title={i.label} className="grid size-7 place-items-center text-muted-foreground/35 [&_svg]:size-4">
            {i.icon}
            <span className="sr-only">{i.label}</span>
          </span>
        ),
      )}
    </span>
  );
}
