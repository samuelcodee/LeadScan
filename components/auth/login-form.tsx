"use client";

import { ArrowLeft, ArrowRight, Eye, EyeOff, Loader2, Mail, Smartphone } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, useTransition } from "react";
import { toast } from "sonner";
import { requestLoginCode, signInPassword, signUpPassword, verifyLoginCode } from "@/app/actions/auth";
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
  "google-falhou": "O Google não respondeu como esperado. Tente de novo em instantes.",
  "google-config": "Login com Google recusado: a chave secreta (AUTH_GOOGLE_SECRET) ou o ID do cliente não confere. Confira na hospedagem.",
  "google-redirect": "Login com Google recusado: o endereço de retorno não está cadastrado no Google Cloud.",
  "google-conta": "O Google confirmou você, mas não conseguimos abrir sua conta. Tente de novo em instantes.",
  limite: "Muitas tentativas seguidas. Espere alguns minutos.",
};

type Props = {
  next: string;
  googleEnabled: boolean;
  /** canais com código (provedor configurado ou dev) */
  channels: { email: boolean; sms: boolean };
  demoEnabled: boolean;
  /** abre em "Criar conta" (link "Criar conta" da página inicial) */
  signup?: boolean;
  error?: string;
};

function Divider({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-3 text-xs text-muted-foreground">
      <span className="h-px flex-1 bg-border" /> {children} <span className="h-px flex-1 bg-border" />
    </div>
  );
}

/**
 * Entrar ou criar conta: Google, e-mail ou celular + senha (funciona sem provedor de envio)
 * e, quando há provedor, código por e-mail/SMS (também serve de "esqueci a senha").
 */
export function LoginForm({ next, googleEnabled, channels, demoEnabled, signup, error }: Props) {
  const [view, setView] = useState<"password" | "code">("password");

  useEffect(() => {
    if (error && ERRORS[error]) toast.error(ERRORS[error]);
  }, [error]);

  const codeAvailable = channels.email || channels.sms;

  return (
    <div className="grid gap-5">
      {googleEnabled && (
        <Button asChild variant="outline" size="lg" className="h-11">
          <a href={`/api/auth/google?next=${encodeURIComponent(next)}`}>
            <GoogleG className="size-[18px]" /> Continuar com Google
          </a>
        </Button>
      )}

      {googleEnabled && <Divider>ou com e-mail ou celular</Divider>}

      {view === "password" ? (
        <PasswordForm next={next} initialMode={signup ? "signup" : "signin"} googleEnabled={googleEnabled} onUseCode={codeAvailable ? () => setView("code") : undefined} />
      ) : (
        <CodeForm next={next} channels={channels} onBack={() => setView("password")} />
      )}

      {demoEnabled && (
        <>
          <Divider>só olhando</Divider>
          <Button asChild variant="ghost" size="lg" className="h-auto min-h-11 whitespace-normal py-2 text-center">
            <Link href={`/api/auth/demo?next=${encodeURIComponent(next)}`} prefetch={false}>
              Explorar a demonstração (dados fictícios)
            </Link>
          </Button>
        </>
      )}
    </div>
  );
}

/* ─── E-mail ou celular + senha ─────────────────────────────────────────── */

function PasswordForm({
  next,
  initialMode,
  googleEnabled,
  onUseCode,
}: {
  next: string;
  initialMode: "signin" | "signup";
  googleEnabled: boolean;
  onUseCode?: () => void;
}) {
  const router = useRouter();
  const [mode, setMode] = useState(initialMode);
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [show, setShow] = useState(false);
  const [forgot, setForgot] = useState(false);
  const [pending, start] = useTransition();
  const signingUp = mode === "signup";
  const looksEmail = identifier.includes("@");

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    start(async () => {
      const r = signingUp ? await signUpPassword({ identifier, password, next }) : await signInPassword({ identifier, password, next });
      if (!r.ok) return void toast.error(r.error);
      if (signingUp) toast.success("Conta criada. Falta só escolher seu nome e @.");
      router.replace(r.data.redirect);
      router.refresh();
    });
  };

  return (
    <div className="grid gap-4">
      <div role="tablist" aria-label="Entrar ou criar conta" className="grid grid-cols-2 rounded-lg bg-muted p-1">
        {(
          [
            ["signin", "Entrar"],
            ["signup", "Criar conta"],
          ] as const
        ).map(([id, label]) => (
          <button
            key={id}
            type="button"
            role="tab"
            aria-selected={mode === id}
            onClick={() => {
              setMode(id);
              setForgot(false);
            }}
            className={cn(
              "flex h-9 items-center justify-center rounded-md text-sm font-medium text-muted-foreground transition-colors duration-150",
              mode === id && "bg-background text-foreground shadow-sm",
            )}
          >
            {label}
          </button>
        ))}
      </div>

      <form onSubmit={submit} className="grid gap-3">
        <div className="grid gap-1.5">
          <Label htmlFor="identifier">E-mail ou celular</Label>
          <div className="relative">
            <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground [&_svg]:size-4" aria-hidden>
              {looksEmail || !identifier ? <Mail /> : <Smartphone />}
            </span>
            <Input
              id="identifier"
              value={identifier}
              onChange={(e) => setIdentifier(e.target.value)}
              type="text"
              inputMode={looksEmail ? "email" : "text"}
              autoComplete="username"
              autoCapitalize="none"
              spellCheck={false}
              placeholder="voce@email.com ou celular com DDD"
              className="h-11 pl-9"
              required
            />
          </div>
        </div>
        <div className="grid gap-1.5">
          <div className="flex items-center justify-between">
            <Label htmlFor="password">{signingUp ? "Crie uma senha" : "Senha"}</Label>
            {!signingUp && (
              <button type="button" onClick={() => setForgot((f) => !f)} className="text-xs text-muted-foreground underline-offset-4 hover:text-foreground hover:underline">
                Esqueci a senha
              </button>
            )}
          </div>
          <div className="relative">
            <Input
              id="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              type={show ? "text" : "password"}
              autoComplete={signingUp ? "new-password" : "current-password"}
              minLength={signingUp ? 8 : 1}
              maxLength={128}
              className="h-11 pr-11"
              aria-describedby={signingUp ? "password-help" : undefined}
              required
            />
            <button
              type="button"
              onClick={() => setShow((s) => !s)}
              className="absolute right-1 top-1/2 grid size-9 -translate-y-1/2 place-items-center rounded-md text-muted-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              aria-label={show ? "Esconder senha" : "Mostrar senha"}
              aria-pressed={show}
            >
              {show ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
            </button>
          </div>
          {signingUp && (
            <p id="password-help" className="text-xs text-muted-foreground">
              Pelo menos 8 caracteres. Uma frase curta é mais segura que uma palavra com símbolos.
            </p>
          )}
        </div>

        {forgot && !signingUp && (
          <div className="rounded-md border bg-muted/50 px-3 py-2.5 text-sm text-muted-foreground">
            {onUseCode ? (
              <>
                Receba um código para entrar sem senha.{" "}
                <button type="button" onClick={onUseCode} className="font-medium text-foreground underline underline-offset-4">
                  Entrar com código
                </button>
              </>
            ) : googleEnabled ? (
              "Se o seu e-mail for do Google (Gmail), toque em “Continuar com Google” com esse mesmo e-mail: você entra na mesma conta."
            ) : (
              "A recuperação por e-mail ainda não está ligada. Fale com o suporte do LeadScan."
            )}
          </div>
        )}

        <Button type="submit" size="lg" className="h-11" disabled={pending || identifier.trim().length < 5 || password.length < (signingUp ? 8 : 1)}>
          {pending ? <Loader2 className="animate-spin" /> : <ArrowRight />} {signingUp ? "Criar conta" : "Entrar"}
        </Button>
      </form>

      {onUseCode && !forgot && (
        <button type="button" onClick={onUseCode} className="w-fit text-sm text-muted-foreground underline-offset-4 hover:text-foreground hover:underline">
          Prefiro receber um código
        </button>
      )}
    </div>
  );
}

/* ─── Código por e-mail ou SMS ──────────────────────────────────────────── */

function CodeForm({ next, channels, onBack }: { next: string; channels: { email: boolean; sms: boolean }; onBack: () => void }) {
  const router = useRouter();
  const tabs = ([["EMAIL", "E-mail", Mail] as const, ["SMS", "Celular", Smartphone] as const]).filter(([id]) => (id === "EMAIL" ? channels.email : channels.sms));
  const [channel, setChannel] = useState<Channel>(channels.email || !channels.sms ? "EMAIL" : "SMS");
  const [target, setTarget] = useState("");
  const [sent, setSent] = useState<{ target: string; display: string; devCode: string | null } | null>(null);
  const [code, setCode] = useState("");
  const [cooldown, setCooldown] = useState(0);
  const [pending, start] = useTransition();
  const codeRef = useRef<HTMLInputElement>(null);

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

  return (
    <div className="grid gap-4">
      <button type="button" onClick={onBack} className="flex w-fit items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="size-4" /> Voltar para senha
      </button>
      {tabs.length > 1 && (
        <div role="tablist" aria-label="Receber código por" className="grid grid-cols-2 rounded-lg bg-muted p-1">
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
    </div>
  );
}
