"use client";

import { ArrowLeft, ArrowRight, Loader2, Mail, Smartphone } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, useTransition } from "react";
import { toast } from "sonner";
import { requestLoginCode, verifyLoginCode } from "@/app/actions/auth";
import { GoogleG } from "@/components/icons";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

type Channel = "EMAIL" | "SMS";

const ERRORS: Record<string, string> = {
  "google-indisponivel": "O login com Google ainda não foi configurado nesta instalação.",
  "google-cancelado": "Login com Google cancelado.",
  "google-expirado": "A tentativa com Google expirou. Tente de novo.",
  "google-estado": "Não conseguimos confirmar o retorno do Google. Tente de novo.",
  "google-falhou": "O Google não respondeu como esperado. Tente de novo ou use e-mail.",
  limite: "Muitas tentativas seguidas. Espere alguns minutos.",
};

type Props = { next: string; googleEnabled: boolean; channels: { email: boolean; sms: boolean }; demoEnabled: boolean; error?: string };

export function LoginForm({ next, googleEnabled, channels, demoEnabled, error }: Props) {
  const router = useRouter();
  const [channel, setChannel] = useState<Channel>(channels.email || !channels.sms ? "EMAIL" : "SMS");
  const tabs = ([["EMAIL", "E-mail", Mail] as const, ["SMS", "Celular", Smartphone] as const]).filter(([id]) => (id === "EMAIL" ? channels.email : channels.sms));
  const [target, setTarget] = useState("");
  const [sent, setSent] = useState<{ target: string; display: string; devCode: string | null } | null>(null);
  const [code, setCode] = useState("");
  const [cooldown, setCooldown] = useState(0);
  const [pending, start] = useTransition();
  const codeRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (error && ERRORS[error]) toast.error(ERRORS[error]);
  }, [error]);

  useEffect(() => {
    if (cooldown <= 0) return;
    const t = setTimeout(() => setCooldown((c) => c - 1), 1000);
    return () => clearTimeout(t);
  }, [cooldown]);

  const send = (e?: React.FormEvent) => {
    e?.preventDefault();
    start(async () => {
      const r = await requestLoginCode({ channel, target });
      if (!r.ok) return void toast.error(r.error);
      setSent(r.data);
      setCode("");
      setCooldown(45);
      setTimeout(() => codeRef.current?.focus(), 50);
    });
  };

  const verify = (value = code) => {
    if (!sent || value.replace(/\D/g, "").length !== 6) return;
    start(async () => {
      const r = await verifyLoginCode({ channel, target: sent.target, code: value, next });
      if (!r.ok) {
        setCode("");
        return void toast.error(r.error);
      }
      router.replace(r.data.redirect);
      router.refresh();
    });
  };

  if (sent) {
    return (
      <div className="grid gap-5">
        <button type="button" onClick={() => setSent(null)} className="flex w-fit items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="size-4" /> Trocar {channel === "EMAIL" ? "e-mail" : "número"}
        </button>
        <div>
          <h2 className="text-lg font-semibold">Digite o código</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Mandamos 6 números para <span className="font-medium text-foreground">{sent.display}</span>. Vale por 10 minutos.
          </p>
        </div>
        {sent.devCode && (
          <p className="rounded-md border border-dashed border-demo/50 bg-demo-soft px-3 py-2 text-xs text-demo">
            Ambiente de desenvolvimento sem envio configurado. Seu código: <span className="font-mono text-sm font-semibold tracking-widest">{sent.devCode}</span>
          </p>
        )}
        <form
          onSubmit={(e) => {
            e.preventDefault();
            verify();
          }}
          className="grid gap-3"
        >
          <Label htmlFor="code" className="sr-only">
            Código de 6 dígitos
          </Label>
          <Input
            id="code"
            ref={codeRef}
            value={code}
            onChange={(e) => {
              const v = e.target.value.replace(/\D/g, "").slice(0, 6);
              setCode(v);
              if (v.length === 6) verify(v);
            }}
            inputMode="numeric"
            autoComplete="one-time-code"
            placeholder="000000"
            className="h-14 text-center font-mono text-2xl tracking-[0.5em]"
            aria-describedby="code-help"
          />
          <Button type="submit" size="lg" className="h-11" disabled={pending || code.length !== 6}>
            {pending ? <Loader2 className="animate-spin" /> : null} Entrar
          </Button>
        </form>
        <p id="code-help" className="text-sm text-muted-foreground">
          Não chegou?{" "}
          {cooldown > 0 ? (
            <span className="tabular">Reenviar em {cooldown}s</span>
          ) : (
            <button type="button" onClick={() => send()} className="font-medium text-foreground underline-offset-4 hover:underline" disabled={pending}>
              Reenviar código
            </button>
          )}
        </p>
      </div>
    );
  }

  if (!googleEnabled && tabs.length === 0) {
    return (
      <p className="rounded-lg border bg-card px-4 py-3 text-sm text-muted-foreground shadow-soft">
        As entradas estão fechadas por alguns minutos enquanto terminamos a configuração. Tente de novo daqui a pouco.
      </p>
    );
  }

  return (
    <div className="grid gap-5">
      {googleEnabled ? (
        <Button asChild variant="outline" size="lg" className="h-11">
          <a href={`/api/auth/google?next=${encodeURIComponent(next)}`}>
            <GoogleG className="size-[18px]" /> Continuar com Google
          </a>
        </Button>
      ) : (
        demoEnabled && (
          <Button variant="outline" size="lg" className="h-11" disabled title="Configure AUTH_GOOGLE_ID e AUTH_GOOGLE_SECRET">
            <GoogleG className="size-[18px] opacity-60" /> Continuar com Google
          </Button>
        )
      )}

      {tabs.length > 0 && (googleEnabled || demoEnabled) && (
        <div className="flex items-center gap-3 text-xs text-muted-foreground">
          <span className="h-px flex-1 bg-border" /> ou receba um código <span className="h-px flex-1 bg-border" />
        </div>
      )}

      {tabs.length > 1 && (
        <div role="tablist" aria-label="Como entrar" className="grid grid-cols-2 rounded-lg bg-muted p-1">
          {tabs.map(([id, label, Icon]) => (
            <button
              key={id}
              type="button"
              role="tab"
              aria-selected={channel === id}
              onClick={() => {
                setChannel(id);
                setTarget("");
              }}
              className={cn(
                "flex h-9 items-center justify-center gap-1.5 rounded-md text-sm font-medium text-muted-foreground transition-colors duration-150",
                channel === id && "bg-background text-foreground shadow-sm",
              )}
            >
              <Icon className="size-4" /> {label}
            </button>
          ))}
        </div>
      )}

      {tabs.length > 0 && (
        <form onSubmit={send} className="grid gap-3">
          <Label htmlFor="target">{channel === "EMAIL" ? "Seu e-mail" : "Seu celular com DDD"}</Label>
          <Input
            id="target"
            value={target}
            onChange={(e) => setTarget(e.target.value)}
            type={channel === "EMAIL" ? "email" : "tel"}
            inputMode={channel === "EMAIL" ? "email" : "tel"}
            autoComplete={channel === "EMAIL" ? "email" : "tel-national"}
            placeholder={channel === "EMAIL" ? "voce@empresa.com.br" : "(85) 99999-8888"}
            className="h-11"
            required
          />
          <Button type="submit" size="lg" className="h-11" disabled={pending || target.trim().length < 5}>
            {pending ? <Loader2 className="animate-spin" /> : <ArrowRight />} Receber código
          </Button>
        </form>
      )}

      {demoEnabled && (
        <>
          <div className="flex items-center gap-3 text-xs text-muted-foreground">
            <span className="h-px flex-1 bg-border" /> só olhando <span className="h-px flex-1 bg-border" />
          </div>
          <Button asChild variant="ghost" size="lg" className="h-auto min-h-11 py-2 text-center whitespace-normal">
            <Link href={`/api/auth/demo?next=${encodeURIComponent(next)}`} prefetch={false}>
              Explorar a demonstração (dados fictícios)
            </Link>
          </Button>
        </>
      )}
    </div>
  );
}
