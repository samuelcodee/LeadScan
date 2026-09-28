"use client";

import { Download, RotateCcw, ShieldX, Trash2, UserX } from "lucide-react";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { deleteAccount } from "@/app/actions/profile";
import { addSuppression, deleteAllMyData, resetDemo, updateProfile } from "@/app/actions/settings";
import { Button } from "@/components/ui/button";
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

function Field({ id, label, hint, children }: { id: string; label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div className="grid gap-1.5">
      <Label htmlFor={id}>{label}</Label>
      {children}
      {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
    </div>
  );
}

export function ProfileForm({ initial }: { initial: { name: string; agencyName: string; whatsapp: string; defaultTicketReais: number } }) {
  const [form, setForm] = useState(initial);
  const [pending, start] = useTransition();
  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) => setForm((f) => ({ ...f, [k]: e.target.value }));
  return (
    <form
      className="grid gap-4 sm:grid-cols-2"
      onSubmit={(e) => {
        e.preventDefault();
        start(async () => {
          const r = await updateProfile({ ...form, defaultTicketReais: Number(form.defaultTicketReais) });
          if (!r.ok) toast.error(r.error);
          else toast.success("Perfil salvo");
        });
      }}
    >
      <Field id="name" label="Seu nome" hint="Aparece nas mensagens: “Meu nome é…”">
        <Input id="name" value={form.name} onChange={set("name")} autoComplete="name" />
      </Field>
      <Field id="agency" label="Agência ou marca" hint="Opcional. Aparece na página da proposta.">
        <Input id="agency" value={form.agencyName} onChange={set("agencyName")} />
      </Field>
      <Field id="wa" label="Seu WhatsApp" hint="Para onde vai o botão “Quero conversar” da proposta.">
        <Input id="wa" value={form.whatsapp} onChange={set("whatsapp")} placeholder="(85) 99999-0000" inputMode="tel" autoComplete="tel" />
      </Field>
      <Field id="ticket" label="Ticket médio (R$)" hint="Usado para estimar o valor do pipeline.">
        <Input id="ticket" value={String(form.defaultTicketReais)} onChange={set("defaultTicketReais")} inputMode="numeric" />
      </Field>
      <div className="sm:col-span-2">
        <Button type="submit" disabled={pending}>
          {pending ? "Salvando…" : "Salvar perfil"}
        </Button>
      </div>
    </form>
  );
}

export function SuppressionForm() {
  const [form, setForm] = useState({ name: "", city: "", phone: "" });
  const [pending, start] = useTransition();
  return (
    <form
      className="grid gap-3 sm:grid-cols-[1fr_1fr_1fr_auto] sm:items-end"
      onSubmit={(e) => {
        e.preventDefault();
        start(async () => {
          const r = await addSuppression(form);
          if (!r.ok) return void toast.error(r.error);
          toast.success(r.data.removed ? `Registrado. ${r.data.removed} lead(s) removido(s) da sua conta.` : "Registrado. A empresa não aparecerá em novas buscas.");
          setForm({ name: "", city: "", phone: "" });
        });
      }}
    >
      <Field id="s-name" label="Nome da empresa">
        <Input id="s-name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
      </Field>
      <Field id="s-city" label="Cidade">
        <Input id="s-city" value={form.city} onChange={(e) => setForm({ ...form, city: e.target.value })} />
      </Field>
      <Field id="s-phone" label="ou Telefone">
        <Input id="s-phone" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} inputMode="tel" />
      </Field>
      <Button type="submit" variant="outline" disabled={pending}>
        <ShieldX /> Registrar remoção
      </Button>
    </form>
  );
}

export function DataActions({ isDemo }: { isDemo: boolean }) {
  const [confirm, setConfirm] = useState("");
  const [pending, start] = useTransition();
  return (
    <div className="flex flex-wrap gap-2">
      <Button asChild variant="outline">
        <a href="/api/export" download>
          <Download /> Exportar meus dados (JSON)
        </a>
      </Button>
      {isDemo && (
        <Button
          variant="outline"
          disabled={pending}
          onClick={() =>
            start(async () => {
              const r = await resetDemo({});
              if (!r.ok) toast.error(r.error);
              else toast.success("Demonstração restaurada");
            })
          }
        >
          <RotateCcw /> {pending ? "Restaurando…" : "Restaurar dados de demonstração"}
        </Button>
      )}
      <Dialog>
        <DialogTrigger asChild>
          <Button variant="ghost" className="text-destructive hover:text-destructive">
            <Trash2 /> Excluir todos os meus dados
          </Button>
        </DialogTrigger>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Excluir todos os dados?</DialogTitle>
            <DialogDescription>Leads, buscas, abordagens, protótipos e histórico. Links públicos param de funcionar. Não dá para desfazer.</DialogDescription>
          </DialogHeader>
          <div className="grid gap-1.5">
            <Label htmlFor="confirm">
              Digite <strong>EXCLUIR</strong> para confirmar
            </Label>
            <Input id="confirm" value={confirm} onChange={(e) => setConfirm(e.target.value)} autoComplete="off" />
          </div>
          <DialogFooter>
            <DialogClose asChild>
              <Button variant="outline">Cancelar</Button>
            </DialogClose>
            <Button
              variant="destructive"
              disabled={confirm !== "EXCLUIR" || pending}
              onClick={() =>
                start(async () => {
                  const r = await deleteAllMyData({ confirm: "EXCLUIR" });
                  if (!r.ok) toast.error(r.error);
                  else toast.success("Dados excluídos");
                })
              }
            >
              Excluir definitivamente
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      {!isDemo && <DeleteAccountDialog />}
    </div>
  );
}

/**
 * Excluir a conta (LGPD): apaga perfil, leads, protótipos, mensagens, arquivos, cobranças e vendas,
 * encerra a sessão e sai da plataforma (recarga completa: nada da conta fica na tela).
 */
export function DeleteAccountDialog() {
  const [confirm, setConfirm] = useState("");
  const [pending, start] = useTransition();
  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button variant="destructive">
          <UserX /> Excluir minha conta
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Excluir sua conta?</DialogTitle>
          <DialogDescription>
            Some tudo: perfil, leads, protótipos, mensagens, arquivos, cobranças, vendas e posição no ranking. Você sai da plataforma na hora. Não dá para desfazer.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-1.5">
          <Label htmlFor="confirm-account">
            Digite <strong>EXCLUIR</strong> para confirmar
          </Label>
          <Input id="confirm-account" value={confirm} onChange={(e) => setConfirm(e.target.value)} autoComplete="off" />
        </div>
        <DialogFooter>
          <DialogClose asChild>
            <Button variant="outline">Cancelar</Button>
          </DialogClose>
          <Button
            variant="destructive"
            disabled={confirm !== "EXCLUIR" || pending}
            onClick={() =>
              start(async () => {
                const r = await deleteAccount({ confirm: "EXCLUIR" });
                if (!r.ok) return void toast.error(r.error);
                window.location.replace(r.data.redirect);
              })
            }
          >
            {pending ? "Excluindo…" : "Excluir conta"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
