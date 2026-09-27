"use client";

import { Bookmark, BookmarkCheck, MessageCircle, Star } from "lucide-react";
import { useOptimistic, useTransition, type ComponentProps } from "react";
import { toast } from "sonner";
import { markWhatsAppOpened, setFavorite, setSaved, setStatus } from "@/app/actions/leads";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { STATUS_META } from "@/lib/domain/lead-status";
import type { LeadStatus } from "@/lib/generated/prisma/enums";
import { cn } from "@/lib/utils";
import { leadWhatsAppLink } from "@/lib/whatsapp/link";

type WaLead = { id: string; isDemo: boolean; phone: string | null; whatsapp: string | null };

/**
 * Abre o WhatsApp (link wa.me) e registra o contato. Se o lead ainda estava em
 * "Novo"/"Interessante", ele avança para "Contatado" sozinho — com opção de desfazer.
 */
export function WhatsAppButton({
  lead,
  message,
  variant,
  label = "WhatsApp",
  iconOnly,
  className,
  size = "default",
}: {
  lead: WaLead;
  message?: string;
  variant?: string;
  label?: string;
  iconOnly?: boolean;
  className?: string;
  size?: ComponentProps<typeof Button>["size"];
}) {
  const href = leadWhatsAppLink(lead, message);
  const [, start] = useTransition();

  if (!href) {
    return (
      <Tooltip>
        <TooltipTrigger asChild>
          <span tabIndex={0} className={cn(iconOnly ? "" : "inline-flex", className)}>
            <Button variant="outline" size={size} disabled className="pointer-events-none w-full" aria-label="Sem telefone">
              <MessageCircle />
              {!iconOnly && "Sem telefone"}
            </Button>
          </span>
        </TooltipTrigger>
        <TooltipContent>A fonte não informou telefone para este lead</TooltipContent>
      </Tooltip>
    );
  }

  const onClick = () => {
    if (lead.isDemo) toast.info("Lead DEMO: o número é fictício, então a conversa abre sem destinatário.");
    start(async () => {
      const r = await markWhatsAppOpened({ id: lead.id, variant });
      if (r.ok && r.data.advanced) {
        const previous = r.data.previous;
        toast.success("Lead movido para Contatado", {
          action: { label: "Desfazer", onClick: () => void setStatus({ id: lead.id, status: previous }) },
        });
      }
    });
  };

  return (
    <Button
      asChild
      size={size}
      className={cn("bg-whatsapp text-whatsapp-foreground hover:bg-whatsapp/90", className)}
      aria-label={iconOnly ? `Abrir WhatsApp` : undefined}
    >
      <a href={href} target="_blank" rel="noopener noreferrer" onClick={onClick}>
        <MessageCircle />
        {!iconOnly && label}
      </a>
    </Button>
  );
}

export function SaveButton({ id, saved, iconOnly, className }: { id: string; saved: boolean; iconOnly?: boolean; className?: string }) {
  const [optimistic, setOptimistic] = useOptimistic(saved);
  const [pending, start] = useTransition();
  const toggle = () =>
    start(async () => {
      setOptimistic(!optimistic);
      const r = await setSaved({ id, saved: !optimistic });
      if (!r.ok) toast.error(r.error);
      else if (!optimistic) toast.success("Salvo em Meus leads");
    });
  const Icon = optimistic ? BookmarkCheck : Bookmark;
  const label = optimistic ? "Salvo" : "Salvar";
  return (
    <Button
      variant="outline"
      size={iconOnly ? "icon" : "default"}
      onClick={toggle}
      disabled={pending}
      aria-pressed={optimistic}
      aria-label={iconOnly ? label : undefined}
      title={iconOnly ? label : undefined}
      className={cn(optimistic && "text-foreground [&_svg]:fill-current", className)}
    >
      <Icon />
      {!iconOnly && label}
    </Button>
  );
}

export function FavoriteButton({ id, favorite, className }: { id: string; favorite: boolean; className?: string }) {
  const [optimistic, setOptimistic] = useOptimistic(favorite);
  const [pending, start] = useTransition();
  const label = optimistic ? "Remover dos favoritos" : "Favoritar";
  return (
    <Button
      variant="ghost"
      size="icon"
      disabled={pending}
      aria-pressed={optimistic}
      aria-label={label}
      title={label}
      className={cn(className)}
      onClick={() =>
        start(async () => {
          setOptimistic(!optimistic);
          const r = await setFavorite({ id, favorite: !optimistic });
          if (!r.ok) toast.error(r.error);
        })
      }
    >
      <Star className={cn(optimistic && "fill-lime text-brand-ink")} />
    </Button>
  );
}

export function StatusDot({ status, className }: { status: LeadStatus; className?: string }) {
  return <span className={cn("inline-block size-2 shrink-0 rounded-full", STATUS_META[status].dot, className)} aria-hidden />;
}
