"use client";

import { LayoutTemplate, Loader2, MoreHorizontal, Send, Trash2 } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { deleteLead, updateDealValue, updateNotes } from "@/app/actions/leads";
import { createPrototypeAction, deletePrototypeAction } from "@/app/actions/prototypes";
import { ShareDialog } from "@/components/prototypes/share-dialog";
import { Button } from "@/components/ui/button";
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

export function CreatePrototypeButton({ leadId, label = "Criar protótipo", variant = "default" }: { leadId: string; label?: string; variant?: "default" | "outline" }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  return (
    <Button
      variant={variant}
      disabled={pending}
      onClick={() =>
        start(async () => {
          const r = await createPrototypeAction({ leadId });
          if (!r.ok) return void toast.error(r.error);
          toast.success(`${r.data.name} criado`);
          router.push(`/prototypes/${r.data.id}`);
        })
      }
    >
      {pending ? <Loader2 className="animate-spin" /> : <LayoutTemplate />}
      {pending ? "Montando…" : label}
    </Button>
  );
}

export function NotesEditor({ id, initial }: { id: string; initial: string }) {
  const [value, setValue] = useState(initial);
  const [saved, setSaved] = useState(initial);
  const [pending, start] = useTransition();
  const save = () => {
    if (value === saved) return;
    start(async () => {
      const r = await updateNotes({ id, notes: value });
      if (!r.ok) return void toast.error(r.error);
      setSaved(value);
    });
  };
  return (
    <div className="grid gap-1.5">
      <Textarea
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onBlur={save}
        rows={4}
        placeholder="Ex.: falei com a Ana, pediu retorno depois do dia 10."
        className="text-sm"
        aria-label="Observações"
      />
      <p className="text-right text-[11px] text-muted-foreground" aria-live="polite">
        {pending ? "Salvando…" : value !== saved ? "Salva ao sair do campo" : saved ? "Salvo" : ""}
      </p>
    </div>
  );
}

export function DealValueInput({ id, initialReais, placeholderReais }: { id: string; initialReais: number | null; placeholderReais: number }) {
  const [value, setValue] = useState(initialReais === null ? "" : String(initialReais));
  const [, start] = useTransition();
  const save = () =>
    start(async () => {
      const n = value.trim() === "" ? null : Math.round(Number(value.replace(/\D/g, "")));
      if (n !== null && !Number.isFinite(n)) return;
      const r = await updateDealValue({ id, reais: n });
      if (!r.ok) toast.error(r.error);
    });
  return (
    <div className="relative">
      <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">R$</span>
      <Input
        inputMode="numeric"
        value={value}
        onChange={(e) => setValue(e.target.value.replace(/[^\d]/g, ""))}
        onBlur={save}
        placeholder={`${placeholderReais.toLocaleString("pt-BR")} (ticket padrão)`}
        className="h-9 pl-9 tabular"
        aria-label="Valor estimado do negócio em reais"
      />
    </div>
  );
}

export function PrototypeActions({
  prototypeId,
  shareUrl,
  lead,
}: {
  prototypeId: string;
  shareUrl: string | null;
  lead: { id: string; name: string; isDemo: boolean; phone: string | null; whatsapp: string | null };
}) {
  const [pending, start] = useTransition();
  return (
    <div className="flex items-center gap-1.5">
      <Button asChild size="sm" variant="outline">
        <Link href={`/prototypes/${prototypeId}`}>Abrir</Link>
      </Button>
      <ShareDialog
        prototypeId={prototypeId}
        lead={lead}
        initialUrl={shareUrl}
        trigger={
          <Button size="sm" variant="outline">
            <Send /> Enviar
          </Button>
        }
      />
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button size="icon-sm" variant="ghost" aria-label="Mais ações">
            <MoreHorizontal />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem asChild>
            <Link href={`/prototypes/${prototypeId}`}>Editar</Link>
          </DropdownMenuItem>
          <DropdownMenuItem
            variant="destructive"
            disabled={pending}
            onSelect={() =>
              start(async () => {
                if (!confirm("Excluir este protótipo? O link público deixa de funcionar.")) return;
                const r = await deletePrototypeAction({ id: prototypeId });
                if (!r.ok) toast.error(r.error);
                else toast.success("Protótipo excluído");
              })
            }
          >
            <Trash2 /> Excluir
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}

/** LGPD: exclusão definitiva do lead e de tudo ligado a ele. */
export function DeleteLeadButton({ id, name }: { id: string; name: string }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button variant="ghost" size="sm" className="text-muted-foreground hover:text-destructive">
          <Trash2 /> Excluir dados deste lead
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Excluir {name}?</DialogTitle>
          <DialogDescription>Apaga o lead, histórico, abordagens e protótipos (os links públicos param de funcionar). Não dá para desfazer.</DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <DialogClose asChild>
            <Button variant="outline">Cancelar</Button>
          </DialogClose>
          <Button
            variant="destructive"
            disabled={pending}
            onClick={() =>
              start(async () => {
                const r = await deleteLead({ id });
                if (!r.ok) return void toast.error(r.error);
                toast.success("Lead excluído");
                router.push("/leads");
              })
            }
          >
            Excluir definitivamente
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
