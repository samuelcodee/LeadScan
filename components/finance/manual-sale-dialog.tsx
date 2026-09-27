"use client";

import { HandCoins, Loader2 } from "lucide-react";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { chargeDialogData, recordManualSaleAction } from "@/app/actions/finance";
import { MoneyInput } from "@/components/finance/money-input";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

type Lead = { id: string; name: string; city: string; dealValue: number | null };

/** Venda recebida por fora (dinheiro, TED, outro app). Não entra no ranking. */
export function ManualSaleDialog() {
  const [open, setOpen] = useState(false);
  const [leads, setLeads] = useState<Lead[]>([]);
  const [lead, setLead] = useState("none");
  const [amount, setAmount] = useState(0);
  const [note, setNote] = useState("");
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [pending, start] = useTransition();

  const openDialog = () => {
    setOpen(true);
    start(async () => {
      const r = await chargeDialogData({});
      if (r.ok) {
        setLeads(r.data.leads);
        setAmount((a) => a || r.data.defaultTicket);
      }
    });
  };

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    start(async () => {
      const r = await recordManualSaleAction({
        amountCents: amount,
        leadId: lead === "none" ? null : lead,
        note: note || undefined,
        closedAt: new Date(`${date}T12:00:00-03:00`),
      });
      if (!r.ok) return void toast.error(r.error);
      toast.success("Venda registrada");
      setOpen(false);
      setNote("");
    });
  };

  return (
    <>
      <Button variant="outline" onClick={openDialog}>
        <HandCoins /> Registrar venda por fora
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Venda recebida por fora</DialogTitle>
            <DialogDescription>
              Entra no seu faturamento e nos gráficos. Não conta para ranking nem nível: lá só vale pagamento confirmado pela plataforma.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={submit} className="grid gap-4">
            <div className="grid gap-1.5">
              <Label>Cliente</Label>
              <Select
                value={lead}
                onValueChange={(v) => {
                  setLead(v);
                  const l = leads.find((x) => x.id === v);
                  if (l?.dealValue) setAmount(l.dealValue);
                }}
              >
                <SelectTrigger className="h-10 w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Sem lead vinculado</SelectItem>
                  {leads.map((l) => (
                    <SelectItem key={l.id} value={l.id}>
                      {l.name} · {l.city}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-[1fr_auto] gap-3">
              <div className="grid gap-1.5">
                <Label htmlFor="ms-amount">Valor</Label>
                <MoneyInput id="ms-amount" cents={amount} onChange={setAmount} />
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor="ms-date">Data</Label>
                <Input id="ms-date" type="date" value={date} max={new Date().toISOString().slice(0, 10)} onChange={(e) => setDate(e.target.value)} className="h-11" />
              </div>
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="ms-note">
                Observação <span className="font-normal text-muted-foreground">(opcional)</span>
              </Label>
              <Input id="ms-note" value={note} onChange={(e) => setNote(e.target.value)} maxLength={200} placeholder="Ex.: 50% de entrada via TED" className="h-10" />
            </div>
            <DialogFooter>
              <Button type="submit" disabled={pending || amount < 500}>
                {pending && <Loader2 className="animate-spin" />} Registrar venda
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
