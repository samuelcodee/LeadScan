"use client";

import { Check, Copy, ExternalLink, Link2, Loader2, MessageCircle, QrCode, Receipt } from "lucide-react";
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
import { buildWhatsAppLink } from "@/lib/whatsapp/link";
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
  const [result, setResult] = useState<{ url: string; isTest: boolean; pix: boolean; pixCode: string | null; auto: boolean; qr: string | null } | null>(null);
  // Mercado Pago: "QR do Pix agora" (padrão, mais rápido) ou link do checkout com Pix e cartão
  const [mpMode, setMpMode] = useState<"qr" | "link">("qr");
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

  const instantPix = provider === "mercadopago" && mpMode === "qr";

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const allowed = instantPix ? (["pix"] as Method[]) : methods.filter((m) => current?.methods.includes(m));
    startSaving(async () => {
      const r = await createChargeAction({
        provider: provider as "mock" | "mercadopago" | "stripe" | "pix",
        amountCents: amount,
        description,
        methods: allowed,
        leadId: lead === "none" ? null : lead,
        prototypeId: prototypeId ?? selectedLead?.prototypeId ?? null,
        instantPix,
      });
      if (!r.ok) return void toast.error(r.error);
      // QR desenhado no navegador a partir do copia e cola (a lib só baixa quando precisa)
      const qr = r.data.pixCode
        ? await import("qrcode").then((m) => m.toString(r.data.pixCode!, { type: "svg", margin: 1, errorCorrectionLevel: "M", color: { dark: "#0A0D0F", light: "#FFFFFF" } })).catch(() => null)
        : null;
      setResult({ url: r.data.url, isTest: r.data.isTest, pix: r.data.pix, pixCode: r.data.pixCode, auto: r.data.auto, qr });
      await navigator.clipboard.writeText(r.data.pixCode ?? r.data.url).catch(() => {});
      toast.success(r.data.pixCode ? "Pix gerado. Código copia e cola copiado." : "Link de pagamento criado e copiado.");
    });
  };

  const waText = result
    ? result.pixCode
      ? `Oi! Segue o Pix do site (${formatBRL(amount)}). Pelo link você vê o QR code: ${result.url}\n\nOu cole este código no app do banco (Pix copia e cola):\n${result.pixCode}`
      : `Oi! Segue o link para o pagamento do site (${formatBRL(amount)}). ${result.pix ? "É só abrir e pagar com o Pix (QR code ou copia e cola)" : "Dá pra pagar com Pix ou cartão"}: ${result.url}`
    : "";
  // Com lead que tem WhatsApp, a mensagem já abre na conversa dele; sem, abre para escolher o contato
  const clientWa = selectedLead?.whatsapp ?? null;

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
                ? result.pix
                  ? "Mande para o cliente. O Pix cai direto na sua conta; quando cair, marque como recebido em Cobranças."
                  : "Mande para o cliente. Quando ele pagar, a venda entra no seu financeiro e no ranking na hora."
                : "O cliente paga pelo link: Pix direto na sua conta, ou Pix e cartão pelo provedor conectado."}
            </DialogDescription>
          </DialogHeader>

          {loading || !data ? (
            <div className="grid h-40 place-items-center">
              <Loader2 className="size-5 animate-spin text-muted-foreground" />
            </div>
          ) : result ? (
            <div className="grid gap-3">
              {result.isTest && <p className="rounded-md bg-demo-soft px-3 py-2 text-xs text-demo">Cobrança de teste: nenhum dinheiro real é movimentado.</p>}
              {result.qr && (
                <div
                  className="mx-auto w-48 rounded-lg border bg-white p-2 [&>svg]:h-auto [&>svg]:w-full"
                  role="img"
                  aria-label="QR code do Pix"
                  dangerouslySetInnerHTML={{ __html: result.qr }}
                />
              )}
              {result.pixCode && (
                <div className="flex gap-2">
                  <Input readOnly value={result.pixCode} className="h-10 font-mono text-xs" onFocus={(e) => e.target.select()} aria-label="Pix copia e cola" />
                  <Button
                    variant="outline"
                    size="icon"
                    className="size-10"
                    aria-label="Copiar Pix copia e cola"
                    onClick={() => navigator.clipboard.writeText(result.pixCode!).then(() => toast.success("Código Pix copiado"))}
                  >
                    <Copy />
                  </Button>
                </div>
              )}
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
                <a href={buildWhatsAppLink(clientWa, waText)} target="_blank" rel="noopener noreferrer">
                  <MessageCircle /> {clientWa && selectedLead ? `Enviar para ${selectedLead.name.split(" ")[0]} no WhatsApp` : "Enviar pelo WhatsApp"}
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
              <p className="text-muted-foreground">
                Você ainda não tem onde receber. Cadastre sua chave Pix (grátis, cai direto no seu banco) ou conecte Mercado Pago/Stripe para aceitar cartão.
              </p>
              <Button asChild>
                <Link href="/financeiro#bancos" onClick={() => setOpen(false)}>
                  Cadastrar chave Pix
                </Link>
              </Button>
              <Button asChild variant="outline">
                <Link href="/financeiro#contas" onClick={() => setOpen(false)}>
                  Conectar Mercado Pago ou Stripe
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
                {/* o botão fica apagado abaixo do mínimo: diz o porquê em vez de parecer quebrado */}
                {amount < 500 && <p className="text-xs text-destructive">O valor mínimo de uma cobrança é R$ 5,00.</p>}
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
              <fieldset className={cn("grid gap-1.5", instantPix && "hidden")}>
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
              {provider === "mercadopago" && (
                <div className="grid gap-1.5">
                  <Label>Como o cliente paga</Label>
                  <div className="grid grid-cols-2 gap-2">
                    {[
                      { id: "qr" as const, icon: QrCode, title: "QR do Pix agora", hint: "Código na hora, aqui" },
                      { id: "link" as const, icon: Link2, title: "Link de pagamento", hint: "Pix ou cartão" },
                    ].map((o) => (
                      <button
                        key={o.id}
                        type="button"
                        onClick={() => setMpMode(o.id)}
                        aria-pressed={mpMode === o.id}
                        className={cn(
                          "flex items-start gap-2 rounded-md border px-3 py-2 text-left text-sm transition-colors duration-150",
                          mpMode === o.id ? "border-foreground ring-1 ring-foreground" : "hover:border-foreground/30",
                        )}
                      >
                        <o.icon className="mt-0.5 size-4 shrink-0" aria-hidden />
                        <span>
                          <span className="block font-medium">{o.title}</span>
                          <span className="block text-xs text-muted-foreground">{o.hint}</span>
                        </span>
                      </button>
                    ))}
                  </div>
                </div>
              )}
              {provider === "mock" && <p className="text-xs text-demo">Pagamentos de teste: o cliente vê botões de simulação, sem dinheiro de verdade.</p>}
              {current?.hint && <p className="text-xs text-muted-foreground">{current.hint}</p>}
              <DialogFooter>
                <Button type="submit" className="h-10 w-full sm:w-auto" disabled={saving || amount < 500 || !provider}>
                  {saving && <Loader2 className="animate-spin" />} {instantPix ? `Gerar Pix de ${formatBRL(amount)}` : `Gerar link de ${formatBRL(amount)}`}
                </Button>
              </DialogFooter>
            </form>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
