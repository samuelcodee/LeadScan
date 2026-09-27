"use client";

import { Star, Trash2 } from "lucide-react";
import { useOptimistic, useTransition } from "react";
import { toast } from "sonner";
import { setLeadLists } from "@/app/actions/leads";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/**
 * Ações da linha em Meus leads / Favoritos: estrela (favoritar ou desfavoritar) e remover
 * da lista. Nada é apagado — o lead some das listas e a busca continua sem repeti-lo.
 * As duas têm "Desfazer" no aviso.
 */
export function LeadRowActions({ lead, className }: { lead: { id: string; name: string; saved: boolean; favorite: boolean }; className?: string }) {
  const [fav, setFav] = useOptimistic(lead.favorite);
  const [pending, start] = useTransition();

  const apply = (next: { saved: boolean; favorite: boolean }, message: string) =>
    start(async () => {
      setFav(next.favorite);
      const r = await setLeadLists({ id: lead.id, ...next });
      if (!r.ok) return void toast.error(r.error);
      const previous = r.data.previous;
      toast.success(message, { action: { label: "Desfazer", onClick: () => void setLeadLists({ id: lead.id, ...previous }) } });
    });

  const favLabel = fav ? "Tirar dos favoritos" : "Favoritar";
  return (
    <span className={cn("relative z-10 flex items-center gap-0.5", className)}>
      <Button
        variant="ghost"
        size="icon-sm"
        disabled={pending}
        aria-pressed={fav}
        aria-label={favLabel}
        title={favLabel}
        onClick={() => apply({ saved: true, favorite: !fav }, fav ? `${lead.name} saiu dos favoritos` : `${lead.name} nos favoritos`)}
      >
        <Star className={cn(fav && "fill-lime text-brand-ink")} />
      </Button>
      <Button
        variant="ghost"
        size="icon-sm"
        disabled={pending}
        aria-label={`Remover ${lead.name} da lista`}
        title="Remover da lista"
        className="text-muted-foreground hover:text-destructive"
        onClick={() => apply({ saved: false, favorite: false }, `${lead.name} removido da lista`)}
      >
        <Trash2 />
      </Button>
    </span>
  );
}
