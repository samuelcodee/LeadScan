"use client";

import { Loader2, Star, Trash2 } from "lucide-react";
import { useOptimistic, useState, useTransition } from "react";
import { toast } from "sonner";
import { deletePrototypeAction, setPrototypeFavorite } from "@/app/actions/prototypes";
import { Button } from "@/components/ui/button";
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

/**
 * Estrela e lixeira do card de protótipo. Ficam acima do link que cobre o card (z-10).
 * Excluir pede confirmação: o link público para de funcionar e não dá para desfazer.
 */
export function PrototypeCardActions({ prototype }: { prototype: { id: string; label: string; favorite: boolean; published: boolean } }) {
  const [fav, setFav] = useOptimistic(prototype.favorite);
  const [pending, start] = useTransition();
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [deleting, startDelete] = useTransition();

  const toggleFav = () =>
    start(async () => {
      setFav(!fav);
      const r = await setPrototypeFavorite({ id: prototype.id, favorite: !fav });
      if (!r.ok) toast.error(r.error);
    });

  const remove = () =>
    startDelete(async () => {
      const r = await deletePrototypeAction({ id: prototype.id });
      if (!r.ok) return void toast.error(r.error);
      setConfirmOpen(false);
      toast.success("Protótipo excluído");
    });

  const favLabel = fav ? "Tirar dos favoritos" : "Favoritar protótipo";
  return (
    <div className="relative z-10 flex items-center gap-0.5">
      <Button variant="ghost" size="icon-sm" onClick={toggleFav} disabled={pending} aria-pressed={fav} aria-label={favLabel} title={favLabel}>
        <Star className={cn(fav && "fill-lime text-brand-ink")} />
      </Button>
      <Button
        variant="ghost"
        size="icon-sm"
        onClick={() => setConfirmOpen(true)}
        aria-label="Excluir protótipo"
        title="Excluir protótipo"
        className="text-muted-foreground hover:text-destructive"
      >
        <Trash2 />
      </Button>
      <Dialog open={confirmOpen} onOpenChange={(o) => !deleting && setConfirmOpen(o)}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Excluir {prototype.label}?</DialogTitle>
            <DialogDescription>
              {prototype.published ? "O link público para de funcionar na hora. " : ""}O lead continua salvo; só este protótipo sai. Não dá para desfazer.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <DialogClose asChild>
              <Button variant="outline" disabled={deleting}>
                Cancelar
              </Button>
            </DialogClose>
            <Button variant="destructive" onClick={remove} disabled={deleting}>
              {deleting ? <Loader2 className="animate-spin" /> : <Trash2 />} Excluir
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
