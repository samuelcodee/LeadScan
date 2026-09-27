"use client";

import { Landmark, Loader2, MoreHorizontal, Plus, Star, Trash2 } from "lucide-react";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { deleteBankAccountAction, saveBankAccountAction, setDefaultBankAccountAction } from "@/app/actions/finance";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ACCOUNT_TYPES, BANKS, type AccountType } from "@/lib/payments/banks";
import { PIX_KEY_LABEL, type PixKeyType } from "@/lib/payments/pix";

export type BankAccountItem = {
  id: string;
  bankCode: string;
  bankName: string;
  branch: string;
  accountLast4: string;
  accountType: string;
  holderName: string;
  documentHint: string;
  pixKeyType: string | null;
  pixKeyHint: string | null;
  isDefault: boolean;
};

/** Contas bancárias e chaves Pix: a principal recebe as cobranças "Pix direto". */
export function BankAccountsPanel({ accounts }: { accounts: BankAccountItem[] }) {
  const [open, setOpen] = useState(false);
  return (
    <div>
      {accounts.length === 0 ? (
        <div className="rounded-md border border-dashed px-4 py-6 text-center">
          <Landmark className="mx-auto size-5 text-muted-foreground" />
          <p className="mt-2 text-sm font-medium">Nenhuma conta cadastrada</p>
          <p className="mx-auto mt-1 max-w-xs text-xs text-muted-foreground">
            Cadastre sua chave Pix para gerar links de pagamento que caem direto no seu banco, sem taxa.
          </p>
        </div>
      ) : (
        <ul className="-my-3 divide-y">
          {accounts.map((a) => (
            <BankRow key={a.id} a={a} />
          ))}
        </ul>
      )}
      <Button variant="outline" size="sm" className="mt-4" onClick={() => setOpen(true)}>
        <Plus /> Adicionar conta ou chave Pix
      </Button>
      <BankAccountDialog open={open} onOpenChange={setOpen} />
    </div>
  );
}

function BankRow({ a }: { a: BankAccountItem }) {
  const [pending, start] = useTransition();
  const run = (fn: () => Promise<{ ok: boolean; error?: string }>, ok: string) =>
    start(async () => {
      const r = await fn();
      if (!r.ok) return void toast.error(r.error ?? "Não deu certo.");
      toast.success(ok);
    });
  return (
    <li className="flex items-start gap-3 py-3">
      <span className="grid size-9 shrink-0 place-items-center rounded-md bg-muted font-mono text-[11px] font-semibold text-muted-foreground">{a.bankCode}</span>
      <div className="min-w-0 flex-1">
        <p className="flex flex-wrap items-center gap-x-2 text-sm font-medium">
          {a.bankName}
          {a.isDefault && <span className="rounded bg-secondary px-1.5 py-0.5 text-[11px] font-medium">principal</span>}
        </p>
        <p className="truncate text-xs text-muted-foreground">
          {a.holderName} · {a.documentHint}
        </p>
        <p className="truncate text-xs text-muted-foreground">
          {a.accountLast4 ? `Ag. ${a.branch} · ${ACCOUNT_TYPES[a.accountType as AccountType] ?? "Conta"} ••••${a.accountLast4}` : "Só Pix"}
          {a.pixKeyHint && ` · Pix (${PIX_KEY_LABEL[a.pixKeyType as PixKeyType] ?? "chave"}): ${a.pixKeyHint}`}
        </p>
      </div>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon-sm" aria-label={`Opções da conta ${a.bankName}`} disabled={pending}>
            {pending ? <Loader2 className="animate-spin" /> : <MoreHorizontal />}
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          {!a.isDefault && (
            <DropdownMenuItem onSelect={() => run(() => setDefaultBankAccountAction({ id: a.id }), `${a.bankName} agora é a conta principal.`)}>
              <Star /> Tornar principal
            </DropdownMenuItem>
          )}
          <DropdownMenuItem variant="destructive" onSelect={() => run(() => deleteBankAccountAction({ id: a.id }), "Conta removida.")}>
            <Trash2 /> Remover
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </li>
  );
}

const EMPTY = {
  bankCode: "",
  bankName: "",
  branch: "",
  account: "",
  accountType: "corrente" as AccountType,
  holderName: "",
  document: "",
  city: "",
  pixKeyType: "cpf" as PixKeyType,
  pixKey: "",
};

const PIX_PLACEHOLDER: Record<PixKeyType, string> = {
  cpf: "000.000.000-00",
  cnpj: "00.000.000/0001-00",
  email: "voce@email.com",
  telefone: "(85) 99999-8888",
  aleatoria: "123e4567-e89b-12d3-a456-426614174000",
};

function BankAccountDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (o: boolean) => void }) {
  const [f, setF] = useState(EMPTY);
  const [other, setOther] = useState(false);
  const [pending, start] = useTransition();
  const set = <K extends keyof typeof EMPTY>(k: K, v: (typeof EMPTY)[K]) => setF((x) => ({ ...x, [k]: v }));

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    start(async () => {
      const r = await saveBankAccountAction({
        ...f,
        bankName: other ? f.bankName : undefined,
        pixKey: f.pixKey.trim() || null,
        pixKeyType: f.pixKey.trim() ? f.pixKeyType : null,
      });
      if (!r.ok) return void toast.error(r.error);
      toast.success(r.data.pixKeyHint ? "Conta salva. Já dá para cobrar com Pix direto." : "Conta salva.");
      setF(EMPTY);
      setOther(false);
      onOpenChange(false);
    });
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !pending && onOpenChange(o)}>
      <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Conta para receber</DialogTitle>
          <DialogDescription>
            Os números ficam criptografados; na tela só aparecem os finais. A chave Pix vai no código que o cliente paga.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} className="grid gap-4">
          <div className="grid gap-1.5">
            <Label>Banco</Label>
            <Select
              value={other ? "outro" : f.bankCode}
              onValueChange={(v) => {
                setOther(v === "outro");
                set("bankCode", v === "outro" ? "" : v);
              }}
            >
              <SelectTrigger className="h-10 w-full">
                <SelectValue placeholder="Escolha o banco" />
              </SelectTrigger>
              <SelectContent className="max-h-72">
                {BANKS.map((b) => (
                  <SelectItem key={b.code} value={b.code}>
                    {b.code} · {b.name}
                  </SelectItem>
                ))}
                <SelectItem value="outro">Outro banco…</SelectItem>
              </SelectContent>
            </Select>
          </div>
          {other && (
            <div className="grid grid-cols-[6rem_1fr] gap-2">
              <div className="grid gap-1.5">
                <Label htmlFor="bank-code">Código</Label>
                <Input id="bank-code" inputMode="numeric" maxLength={3} value={f.bankCode} onChange={(e) => set("bankCode", e.target.value.replace(/\D/g, ""))} placeholder="000" className="h-10" />
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor="bank-name">Nome do banco</Label>
                <Input id="bank-name" value={f.bankName} onChange={(e) => set("bankName", e.target.value)} className="h-10" />
              </div>
            </div>
          )}

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="grid gap-1.5">
              <Label htmlFor="holder">Titular</Label>
              <Input id="holder" value={f.holderName} onChange={(e) => set("holderName", e.target.value)} placeholder="Como está no banco" className="h-10" autoComplete="name" />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="doc">CPF ou CNPJ do titular</Label>
              <Input id="doc" inputMode="numeric" value={f.document} onChange={(e) => set("document", e.target.value)} className="h-10" />
            </div>
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="city">Cidade do titular</Label>
            <Input id="city" value={f.city} onChange={(e) => set("city", e.target.value)} placeholder="Ex.: Fortaleza" className="h-10" autoComplete="address-level2" />
          </div>

          <fieldset className="grid gap-3 rounded-md border p-3">
            <legend className="px-1 text-sm font-medium">Chave Pix</legend>
            <div className="grid gap-2 sm:grid-cols-[10rem_1fr]">
              <Select value={f.pixKeyType} onValueChange={(v) => set("pixKeyType", v as PixKeyType)}>
                <SelectTrigger className="h-10 w-full" aria-label="Tipo de chave">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {(Object.keys(PIX_KEY_LABEL) as PixKeyType[]).map((k) => (
                    <SelectItem key={k} value={k}>
                      {PIX_KEY_LABEL[k]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Input value={f.pixKey} onChange={(e) => set("pixKey", e.target.value)} placeholder={PIX_PLACEHOLDER[f.pixKeyType]} className="h-10" aria-label="Chave Pix" />
            </div>
            <p className="text-xs text-muted-foreground">Com a chave, seus links de pagamento geram o Pix com o valor certo, direto para esta conta.</p>
          </fieldset>

          <fieldset className="grid gap-3 rounded-md border p-3">
            <legend className="px-1 text-sm font-medium">Agência e conta (opcional)</legend>
            <div className="grid gap-2 sm:grid-cols-[7rem_1fr_11rem]">
              <Input value={f.branch} onChange={(e) => set("branch", e.target.value)} placeholder="Agência" inputMode="numeric" className="h-10" aria-label="Agência" />
              <Input value={f.account} onChange={(e) => set("account", e.target.value)} placeholder="Conta com dígito" className="h-10" aria-label="Conta com dígito" />
              <Select value={f.accountType} onValueChange={(v) => set("accountType", v as AccountType)}>
                <SelectTrigger className="h-10 w-full" aria-label="Tipo de conta">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {(Object.keys(ACCOUNT_TYPES) as AccountType[]).map((k) => (
                    <SelectItem key={k} value={k}>
                      {ACCOUNT_TYPES[k]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </fieldset>

          <DialogFooter>
            <Button type="submit" disabled={pending || !f.bankCode}>
              {pending && <Loader2 className="animate-spin" />} Salvar conta
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
