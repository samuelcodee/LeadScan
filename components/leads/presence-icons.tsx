"use client";

import { Globe, MapPin, MessageCircle } from "lucide-react";
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

type Item = { key: string; href: string | null; tone: "on" | "search" | "off"; icon: React.ReactNode; label: string; what: string };

/**
 * Ícones de presença clicáveis: site, Instagram, WhatsApp, Maps (e Facebook quando há).
 *  - aceso: o lead tem, um clique abre direto;
 *  - apagado mas clicável: a fonte não trouxe — o clique pesquisa no Google pelo nome + cidade;
 *  - riscado: não há o que abrir (ex.: sem telefone para WhatsApp).
 * Área de toque de 32 px e z-10 para ficar acima do link que cobre a linha/card.
 */
export function PresenceIcons({ lead, className, withFacebook }: { lead: LinkLead; className?: string; withFacebook?: boolean }) {
  const links = leadLinks(lead);
  const items: Item[] = [
    {
      key: "site",
      href: links.site.href,
      tone: links.site.found ? (links.site.own ? "on" : "search") : "search",
      icon: <Globe />,
      label: links.site.found ? `Abrir ${links.site.label}` : "Sem site encontrado — pesquisar no Google",
      what: "o site",
    },
    {
      key: "ig",
      href: links.instagram.href,
      tone: links.instagram.found ? "on" : "search",
      icon: <Instagram />,
      label: links.instagram.found ? `Abrir Instagram ${links.instagram.label}` : "Procurar o Instagram no Google",
      what: "o Instagram",
    },
    {
      key: "wa",
      href: links.whatsapp.href,
      tone: links.whatsapp.href ? (links.whatsapp.on ? "on" : "search") : "off",
      icon: <MessageCircle />,
      label: links.whatsapp.href ? (links.whatsapp.on ? "Abrir conversa no WhatsApp" : "Tentar WhatsApp (número fixo)") : "Sem telefone para WhatsApp",
      what: "o número",
    },
    { key: "maps", href: links.maps.href, tone: links.maps.href ? "on" : "off", icon: <MapPin />, label: "Ver no Google Maps", what: "o endereço" },
  ];
  if (withFacebook && links.facebook.href) items.push({ key: "fb", href: links.facebook.href, tone: "on", icon: <Facebook />, label: "Abrir Facebook", what: "o Facebook" });

  return (
    <span className={cn("relative z-10 flex items-center", className)}>
      {items.map((i) =>
        i.href ? (
          <a
            key={i.key}
            href={i.href}
            target="_blank"
            rel="noopener noreferrer nofollow"
            onClick={(e) => {
              e.stopPropagation();
              warnDemoLink(lead.isDemo, i.what);
            }}
            aria-label={i.label}
            title={i.label}
            className={cn(
              "grid size-8 place-items-center rounded-md transition-colors pointer-coarse:size-9 hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring [&_svg]:size-4",
              i.tone === "on" ? "text-foreground" : "text-muted-foreground/70",
              i.key === "wa" && i.tone === "on" && "hover:text-success",
            )}
          >
            {i.icon}
          </a>
        ) : (
          <span key={i.key} title={i.label} className="grid size-8 place-items-center pointer-coarse:size-9 text-muted-foreground/30 [&_svg]:size-4">
            {i.icon}
            <span className="sr-only">{i.label}</span>
          </span>
        ),
      )}
    </span>
  );
}
