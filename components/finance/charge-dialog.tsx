"use client";

import { Check, Copy, ExternalLink, Loader2, MessageCircle, Receipt } from "lucide-react";
import Link from "next/link";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { chargeDialogData, createChargeAction } from "@/app/actions/finance";
import { MoneyInput } from "@/components/finance/money-input";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { formatBRL } from "@/lib/format";
import { cn } from "@/lib/utils";

type Data = Extract<Awaited<ReturnType<typeof chargeDialogData>>, { ok: true }>["data"];
type Method = "pix" | "credit_card" | "debit_card";
const METHODS: { id: Method; label: string }[] = [
  { id: "pix", label: "Pix" },
  { id: "credit_card", label: "Crédito" },
  { id: "debit_card", label: "Débito" },
];

export function ChargeDialog({
  leadId,
  prototypeId,
  label = "Cobrar",
  variant = "default",
  size = "default",
  className,
}: {
  leadId?: string;
  prototypeId?: string;
  label?: string;
  variant?: "default" | "outline" | "secondary" | "ghost";
  size?: "default" | "sm" | "lg";
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const [data, setData] = useState<Data | null>(null);
  const [lead, setLead] = useState<string>(leadId ?? "none");
  const [provider, setProvider] = useState<string>("");
  const [amount, setAmount] = useState(0);
  const [description, setDescription] = useState("");
  const [methods, setMethods] = useState<Method[]>(["pix", "credit_card", "debit_card"]);
  const [result, setResult] = useState<{ url: string; isTest: boolean } | null>(null);
  const [loading, startLoading] = useTransition();
  const [saving, startSaving] = useTransition();

  const describe = (name?: string) => (name ? `Criação do site — ${name}` : "Criação de site");

  const openDialog = () => {
    setOpen(true);
    setResult(null);
    startLoading(async () => {
      const r = await chargeDialogData({});
      if (!r.ok) return void toast.error(r.error);
      setData(r.data);
      const first = r.data.providers.find((p) => p.id !== "mock") ?? r.data.providers[0];
      setProvider(first?.id ?? "");
      const l = r.data.leads.find((x) => x.id === (leadId ?? lead));
      setAmount(l?.dealValue ?? r.data.defaultTicket);
      setDescription(describe(l?.name));
    });
  };

  const current = data?.providers.find((p) => p.id === provider);
  const selectedLead = data?.leads.find((l) => l.id === lead);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const allowed = methods.filter((m) => current?.methods.includes(m));
    startSaving(async () => {
      const r = await createChargeAction({
        provider: provider as "mock" | "mercadopago" | "stripe",
        amountCents: amount,
        description,
        methods: allowed,
        leadId: lead === "none" ? null : lead,
        prototypeId: prototypeId ?? selectedLead?.prototypeId ?? null,
      });
      if (!r.ok) return void toast.error(r.error);
      setResult({ url: r.data.url, isTest: r.data.isTest });
      await navigator.clipboard.writeText(r.data.url).catch(() => {});
      toast.success("Link de pagamento criado e copiado.");
    });
  };

  const waText = result ? `Oi! Segue o link para o pagamento do site (${formatBRL(amount)}). Dá pra pagar com Pix ou cartão: ${result.url}` : "";

  return (
    <>
      <Button variant={variant} size={size} className={className} onClick={openDialog}>
        <Receipt /> {label}
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{result ? "Link pronto" : "Nova cobrança"}</DialogTitle>
            <DialogDescription>
              {result
                ? "Mande para o cliente. Quando ele pagar, a venda entra no seu financeiro e no ranking na hora."
                : "O cliente paga numa página segura do provedor. Você não precisa lidar com dados de cartão."}
            </DialogDescription>
          </DialogHeader>

          {loading || !data ? (
            <div className="grid h-40 place-items-center">
              <Loader2 className="size-5 animate-spin text-muted-foreground" />
            </div>
          ) : result ? (
            <div className="grid gap-3">
              {result.isTest && <p className="rounded-md bg-demo-soft px-3 py-2 text-xs text-demo">Cobrança de teste: nenhum dinheiro real é movimentado.</p>}
              <div className="flex gap-2">
                <Input readOnly value={result.url} className="h-10 font-mono text-xs" onFocus={(e) => e.target.select()} aria-label="Link de pagamento" />
                <Button
                  variant="outline"
                  size="icon"
                  className="size-10"
                  aria-label="Copiar link"
                  onClick={() => navigator.clipboard.writeText(result.url).then(() => toast.success("Copiado"))}
                >
                  <Copy />
                </Button>
              </div>
              <Button asChild className="h-10 bg-whatsapp text-whatsapp-foreground hover:bg-whatsapp/90">
                <a href={`https://wa.me/?text=${encodeURIComponent(waText)}`} target="_blank" rel="noopener noreferrer">
                  <MessageCircle /> Enviar pelo WhatsApp
                </a>
              </Button>
              <Button asChild variant="outline" className="h-10">
                <a href={result.url} target="_blank" rel="noopener noreferrer">
                  <ExternalLink /> Abrir página de pagamento
                </a>
              </Button>
            </div>
          ) : data.providers.length === 0 ? (
            <div className="grid gap-3 text-sm">
              <p className="text-muted-foreground">Você ainda não conectou uma conta para receber. Leva 2 minutos com Mercado Pago ou Stripe.</p>
              <Button asChild>
                <Link href="/financeiro#contas" onClick={() => setOpen(false)}>
                  Conectar conta de recebimento
                </Link>
              </Button>
            </div>
          ) : (
            <form onSubmit={submit} className="grid gap-4">
              <div className="grid gap-1.5">
                <Label>Cliente</Label>
                <Select
                  value={lead}
                  onValueChange={(v) => {
                    setLead(v);
                    const l = data.leads.find((x) => x.id === v);
                    if (l?.dealValue) setAmount(l.dealValue);
                    setDescription(describe(l?.name));
                  }}
                >
                  <SelectTrigger className="h-10 w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Sem lead vinculado</SelectItem>
                    {data.leads.map((l) => (
                      <SelectItem key={l.id} value={l.id}>
                        {l.name} · {l.city}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor="charge-desc">Descrição</Label>
                <Input id="charge-desc" value={description} onChange={(e) => setDescription(e.target.value)} maxLength={200} className="h-10" />
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor="charge-amount">Valor</Label>
                <MoneyInput id="charge-amount" cents={amount} onChange={setAmount} />
              </div>
              {data.providers.length > 1 && (
                <div className="grid gap-1.5">
                  <Label>Receber por</Label>
                  <div className="grid grid-cols-2 gap-2">
                    {data.providers.map((p) => (
                      <button
                        key={p.id}
                        type="button"
                        onClick={() => setProvider(p.id)}
                        className={cn("rounded-md border px-3 py-2 text-left text-sm transition-colors duration-150", provider === p.id ? "border-foreground ring-1 ring-foreground" : "hover:border-foreground/30")}
                        aria-pressed={provider === p.id}
                      >
                        {p.label}
                      </button>
                    ))}
                  </div>
                </div>
              )}
              <fieldset className="grid gap-1.5">
                <legend className="mb-1.5 text-sm font-medium">Formas de pagamento</legend>
                <div className="flex flex-wrap gap-2">
                  {METHODS.filter((m) => current?.methods.includes(m.id)).map((m) => {
                    const on = methods.includes(m.id);
                    return (
                      <button
                        key={m.id}
                        type="button"
                        aria-pressed={on}
                        onClick={() => setMethods((x) => (on ? x.filter((y) => y !== m.id) : [...x, m.id]))}
                        className={cn(
                          "inline-flex h-9 items-center gap-1.5 rounded-full border px-3.5 text-sm transition-colors duration-150",
                          on ? "border-foreground bg-foreground text-background" : "text-muted-foreground hover:border-foreground/30",
                        )}
                      >
                        {on && <Check className="size-3.5" />} {m.label}
                      </button>
                    );
                  })}
                </div>
              </fieldset>
              {provider === "mock" && <p className="text-xs text-demo">Pagamentos de teste: o cliente vê botões de simulação, sem dinheiro de verdade.</p>}
              <DialogFooter>
                <Button type="submit" className="h-10 w-full sm:w-auto" disabled={saving || amount < 500 || !provider}>
                  {saving && <Loader2 className="animate-spin" />} Gerar link de {formatBRL(amount)}
                </Button>
              </DialogFooter>
            </form>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
