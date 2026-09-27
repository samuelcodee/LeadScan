"use client";

import { AtSign, Check, Loader2, X } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState, useTransition } from "react";
import { toast } from "sonner";
import { checkUsername, completeOnboarding } from "@/app/actions/auth";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";

export function OnboardingForm({ initial, next }: { initial: { name: string; username: string; agencyName: string }; next: string }) {
  const router = useRouter();
  const [name, setName] = useState(initial.name === "Novo usuário" ? "" : initial.name);
  const [username, setUsername] = useState(initial.username);
  const [agencyName, setAgencyName] = useState(initial.agencyName);
  const [profilePublic, setProfilePublic] = useState(true);
  const [rankingOptIn, setRankingOptIn] = useState(false);
  const [acceptTerms, setAcceptTerms] = useState(false);
  const [check, setCheck] = useState<{ value: string; available: boolean; reason: string | null } | null>(null);
  const [pending, start] = useTransition();

  useEffect(() => {
    const value = username.trim().toLowerCase();
    if (value.length < 3) return;
    const t = setTimeout(async () => {
      const r = await checkUsername({ username: value });
      if (r.ok) setCheck({ value, ...r.data });
    }, 350);
    return () => clearTimeout(t);
  }, [username]);

  const status = check && check.value === username.trim().toLowerCase() ? check : null;

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!acceptTerms) return void toast.error("Para continuar, aceite os termos e a política de privacidade.");
    start(async () => {
      const r = await completeOnboarding({ name, username, agencyName, profilePublic, rankingOptIn, acceptTerms: true });
      if (!r.ok) return void toast.error(r.error);
      router.replace(next);
      router.refresh();
    });
  };

  return (
    <form onSubmit={submit} className="grid gap-6">
      <div className="grid gap-2">
        <Label htmlFor="name">Como você quer ser chamado</Label>
        <Input id="name" value={name} onChange={(e) => setName(e.target.value)} placeholder="Ex.: Ana Ribeiro" className="h-11" maxLength={60} required autoFocus />
      </div>

      <div className="grid gap-2">
        <Label htmlFor="username">Seu @ na comunidade</Label>
        <div className="relative">
          <AtSign className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
          <Input
            id="username"
            value={username}
            onChange={(e) => setUsername(e.target.value.toLowerCase().replace(/[^a-z0-9._]/g, ""))}
            className="h-11 pl-9 pr-9"
            maxLength={24}
            required
            aria-describedby="username-help"
          />
          <span className="absolute right-3 top-1/2 -translate-y-1/2" aria-hidden>
            {status?.available && <Check className="size-4 text-success" />}
            {status && !status.available && <X className="size-4 text-destructive" />}
          </span>
        </div>
        <p id="username-help" className="text-xs text-muted-foreground" aria-live="polite">
          {status && !status.available
            ? status.reason === "formato"
              ? "Use de 3 a 24 caracteres: letras, números, ponto ou _."
              : status.reason === "reservado"
                ? "Esse @ é reservado."
                : "Esse @ já está em uso."
            : `Seu perfil fica em /u/${username || "seu-arroba"}.`}
        </p>
      </div>

      <div className="grid gap-2">
        <Label htmlFor="agency">
          Agência ou marca <span className="font-normal text-muted-foreground">(opcional)</span>
        </Label>
        <Input id="agency" value={agencyName} onChange={(e) => setAgencyName(e.target.value)} placeholder="Ex.: Ribeiro Sites" className="h-11" maxLength={80} />
      </div>

      <div className="grid gap-3 rounded-lg border p-4">
        <label className="flex items-start justify-between gap-4">
          <span>
            <span className="block text-sm font-medium">Perfil aberto para a comunidade</span>
            <span className="mt-0.5 block text-xs text-muted-foreground">Nome, foto, bio, nível e selos. Dá pra fechar depois em Perfil.</span>
          </span>
          <Switch checked={profilePublic} onCheckedChange={setProfilePublic} aria-label="Perfil aberto para a comunidade" />
        </label>
        <div className="h-px bg-border" />
        <label className="flex items-start justify-between gap-4">
          <span>
            <span className="block text-sm font-medium">Participar do ranking público</span>
            <span className="mt-0.5 block text-xs text-muted-foreground">
              Outros usuários passam a ver seu número de vendas, pontos e faturamento recebido pela plataforma. Desligado por padrão; você pode sair a qualquer momento.
            </span>
          </span>
          <Switch checked={rankingOptIn} onCheckedChange={setRankingOptIn} aria-label="Participar do ranking público" />
        </label>
      </div>

      <label className="flex items-start gap-3 text-sm">
        <Checkbox checked={acceptTerms} onCheckedChange={(v) => setAcceptTerms(v === true)} className="mt-0.5" aria-label="Aceito os termos" />
        <span className="text-muted-foreground">
          Li e aceito os{" "}
          <Link href="/termos" target="_blank" className="font-medium text-foreground underline underline-offset-4">
            Termos de uso
          </Link>{" "}
          e a{" "}
          <Link href="/privacidade" target="_blank" className="font-medium text-foreground underline underline-offset-4">
            Política de privacidade
          </Link>
          .
        </span>
      </label>

      <Button type="submit" size="lg" className="h-11" disabled={pending || name.trim().length < 2 || (status !== null && !status.available)}>
        {pending && <Loader2 className="animate-spin" />} Entrar na plataforma
      </Button>
    </form>
  );
}
