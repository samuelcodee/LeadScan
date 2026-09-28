"use client";

import { Camera, Check, Loader2, LogOut, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useRef, useState, useTransition } from "react";
import { toast } from "sonner";
import { confirmLinkCode, requestLinkCode, signOutEverywhere } from "@/app/actions/auth";
import { deleteAccount, removeAvatar, setDisplayTitle, updatePrivacy, updateProfile, uploadAvatar } from "@/app/actions/profile";
import { Instagram } from "@/components/icons";
import { UserAvatar } from "@/components/profile/identity";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { shrinkImage } from "@/lib/client/image";
import { cn } from "@/lib/utils";

export function AvatarUpload({ name, avatarId, unverified, badge }: { name: string; avatarId: string | null; unverified: boolean; badge?: string | null }) {
  const input = useRef<HTMLInputElement>(null);
  const [pending, start] = useTransition();
  const onFile = (file: File | undefined) => {
    if (!file) return;
    start(async () => {
      const blob = await shrinkImage(file, 1024);
      const form = new FormData();
      form.set("file", new File([blob], "avatar.jpg", { type: blob.type || "image/jpeg" }));
      const r = await uploadAvatar(form);
      if (!r.ok) return void toast.error(r.error);
      toast.success(r.data.unverified ? "Foto atualizada (sem moderação no modo demo)." : "Foto atualizada.");
    });
  };
  return (
    <div className="flex items-center gap-4">
      <div className="relative">
        <UserAvatar name={name} avatarId={avatarId} size="xl" badge={badge} />
        {pending && (
          <span className="absolute inset-0 grid place-items-center rounded-full bg-background/70">
            <Loader2 className="size-5 animate-spin" />
          </span>
        )}
      </div>
      <div className="grid gap-2">
        <input ref={input} type="file" accept="image/jpeg,image/png,image/webp" className="hidden" onChange={(e) => onFile(e.target.files?.[0])} />
        <div className="flex flex-wrap gap-2">
          <Button type="button" variant="outline" size="sm" onClick={() => input.current?.click()} disabled={pending}>
            <Camera /> {avatarId ? "Trocar foto" : "Enviar foto"}
          </Button>
          {avatarId && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              disabled={pending}
              onClick={() =>
                start(async () => {
                  const r = await removeAvatar({});
                  if (!r.ok) toast.error(r.error);
                })
              }
            >
              Remover
            </Button>
          )}
        </div>
        <p className="text-xs text-muted-foreground">
          JPG, PNG ou WebP até 6 MB. Toda foto passa por verificação automática: nudez e conteúdo +18 são recusados.
          {unverified && " (Modo demo: sem verificador configurado.)"}
        </p>
      </div>
    </div>
  );
}

export function ProfileFields({ initial }: { initial: { name: string; username: string; bio: string; instagram: string } }) {
  const router = useRouter();
  const [v, setV] = useState(initial);
  const [pending, start] = useTransition();
  const set = (k: keyof typeof v) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => setV((x) => ({ ...x, [k]: e.target.value }));
  return (
    <form
      className="grid gap-4"
      onSubmit={(e) => {
        e.preventDefault();
        start(async () => {
          const r = await updateProfile(v);
          if (!r.ok) return void toast.error(r.error);
          toast.success("Perfil salvo");
          router.refresh();
        });
      }}
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="grid gap-1.5">
          <Label htmlFor="p-name">Nome</Label>
          <Input id="p-name" value={v.name} onChange={set("name")} maxLength={60} className="h-10" required />
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="p-user">@ usuário</Label>
          <Input id="p-user" value={v.username} onChange={(e) => setV((x) => ({ ...x, username: e.target.value.toLowerCase().replace(/[^a-z0-9._]/g, "") }))} maxLength={24} className="h-10" required />
        </div>
      </div>
      <div className="grid gap-1.5">
        <div className="flex justify-between">
          <Label htmlFor="p-bio">Bio</Label>
          <span className="text-xs text-muted-foreground tabular">{v.bio.length}/280</span>
        </div>
        <Textarea id="p-bio" value={v.bio} onChange={set("bio")} maxLength={280} rows={3} placeholder="Ex.: Faço sites para clínicas e restaurantes em Recife. Entrega em 7 dias." />
      </div>
      <div className="grid gap-1.5">
        <Label htmlFor="p-ig">Instagram</Label>
        <div className="relative">
          <Instagram className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
          <Input id="p-ig" value={v.instagram} onChange={set("instagram")} placeholder="@seuestudio" className="h-10 pl-9" maxLength={60} />
        </div>
      </div>
      <div>
        <Button type="submit" disabled={pending}>
          {pending && <Loader2 className="animate-spin" />} Salvar perfil
        </Button>
      </div>
    </form>
  );
}

export function TitlePicker({ titles, current }: { titles: { key: string; label: string; detail: string }[]; current: string | null }) {
  const [selected, setSelected] = useState(current);
  const [pending, start] = useTransition();
  if (!titles.length) return <p className="text-sm text-muted-foreground">Seu primeiro título chega com a primeira venda paga pela plataforma.</p>;
  const pick = (key: string | null) =>
    start(async () => {
      const r = await setDisplayTitle({ key });
      if (!r.ok) return void toast.error(r.error);
      setSelected(key);
      toast.success("Título atualizado");
    });
  return (
    <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="Título exibido ao lado do seu nome">
      <button
        type="button"
        role="radio"
        aria-checked={selected === null}
        disabled={pending}
        onClick={() => pick(null)}
        className={cn("rounded-full border px-3 py-1.5 text-sm", selected === null ? "border-foreground bg-foreground text-background" : "hover:border-foreground/30")}
      >
        Nível atual (automático)
      </button>
      {titles.map((t) => (
        <button
          key={t.key}
          type="button"
          role="radio"
          aria-checked={selected === t.key}
          disabled={pending}
          onClick={() => pick(t.key)}
          title={t.detail}
          className={cn("rounded-full border px-3 py-1.5 text-sm", selected === t.key ? "border-foreground bg-foreground text-background" : "hover:border-foreground/30")}
        >
          {selected === t.key && <Check className="-ml-0.5 mr-1 inline size-3.5" />}
          {t.label}
        </button>
      ))}
    </div>
  );
}

export function PrivacyFields({
  initial,
}: {
  initial: { profilePublic: boolean; showAccountAge: boolean; rankingOptIn: boolean; presenceVisible: boolean; friendsOnlyMessages: boolean };
}) {
  const [v, setV] = useState(initial);
  const [pending, start] = useTransition();
  const toggle = (k: keyof typeof v) => (value: boolean) => {
    const next = { ...v, [k]: value };
    setV(next);
    start(async () => {
      const r = await updatePrivacy(next);
      if (!r.ok) {
        setV(v);
        return void toast.error(r.error);
      }
      toast.success("Privacidade atualizada");
    });
  };
  const rows: { k: keyof typeof v; title: string; body: string }[] = [
    { k: "profilePublic", title: "Perfil aberto", body: "Outros usuários veem seu nome, foto, bio, nível, selos e gráficos de atividade. Fechado: só você vê." },
    { k: "showAccountAge", title: "Mostrar tempo de conta", body: "Exibe discretamente há quanto tempo você está na plataforma." },
    { k: "rankingOptIn", title: "Participar do ranking e do painel de faturamento", body: "Mostra para a comunidade suas vendas, pontos e o faturamento recebido pela plataforma." },
    { k: "presenceVisible", title: "Mostrar quando estou online", body: "Nas mensagens e no seu perfil aparece se você está online, inativo (há quantos minutos) ou offline. Desligado: ninguém vê seu status." },
    {
      k: "friendsOnlyMessages",
      title: "Só amigos podem me mandar mensagem",
      body: "Desligado: quem não é seu amigo pode escrever, e a conversa chega em Pedidos para você aceitar ou recusar. Ligado: só amigos conseguem começar conversa.",
    },
  ];
  return (
    <div className="divide-y rounded-lg border">
      {rows.map((r) => (
        <label key={r.k} className="flex items-start justify-between gap-4 p-4">
          <span>
            <span className="block text-sm font-medium">{r.title}</span>
            <span className="mt-0.5 block text-xs text-muted-foreground">{r.body}</span>
          </span>
          <Switch checked={v[r.k]} onCheckedChange={toggle(r.k)} disabled={pending} aria-label={r.title} />
        </label>
      ))}
    </div>
  );
}

function LinkContact({ channel, label, current }: { channel: "EMAIL" | "SMS"; label: string; current: string | null }) {
  const router = useRouter();
  const [target, setTarget] = useState("");
  const [sent, setSent] = useState<{ target: string; devCode: string | null } | null>(null);
  const [code, setCode] = useState("");
  const [pending, start] = useTransition();
  return (
    <div className="grid gap-2 p-4">
      <div className="flex items-center justify-between gap-2">
        <p className="text-sm font-medium">{label}</p>
        <p className="truncate text-sm text-muted-foreground">{current ?? "Não vinculado"}</p>
      </div>
      {!sent ? (
        <form
          className="flex gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            start(async () => {
              const r = await requestLinkCode({ channel, target });
              if (!r.ok) return void toast.error(r.error);
              setSent(r.data);
            });
          }}
        >
          <Input value={target} onChange={(e) => setTarget(e.target.value)} placeholder={channel === "EMAIL" ? "novo@email.com" : "(85) 99999-8888"} className="h-9" aria-label={channel === "EMAIL" ? "Novo e-mail" : "Celular com DDD"} type={channel === "EMAIL" ? "email" : "tel"} inputMode={channel === "EMAIL" ? "email" : "tel"} />
          <Button type="submit" variant="outline" size="sm" className="h-9" disabled={pending || target.length < 5}>
            {current ? "Trocar" : "Vincular"}
          </Button>
        </form>
      ) : (
        <form
          className="grid gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            start(async () => {
              const r = await confirmLinkCode({ channel, target: sent.target, code });
              if (!r.ok) return void toast.error(r.error);
              toast.success(`${label} vinculado`);
              setSent(null);
              setTarget("");
              setCode("");
              router.refresh();
            });
          }}
        >
          {sent.devCode && <p className="text-xs text-demo">Dev: código {sent.devCode}</p>}
          <div className="flex gap-2">
            <Input value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))} inputMode="numeric" placeholder="Código de 6 dígitos" className="h-9 font-mono" />
            <Button type="submit" size="sm" className="h-9" disabled={pending || code.length !== 6}>
              Confirmar
            </Button>
          </div>
        </form>
      )}
    </div>
  );
}

export function AccountFields({ email, phone, google, isDemo }: { email: string | null; phone: string | null; google: boolean; isDemo: boolean }) {
  const router = useRouter();
  const [confirm, setConfirm] = useState("");
  const [pending, start] = useTransition();
  return (
    <div className="grid gap-6">
      <div className="divide-y rounded-lg border">
        <LinkContact channel="EMAIL" label="E-mail" current={email} />
        <LinkContact channel="SMS" label="Celular" current={phone} />
        <div className="flex items-center justify-between gap-2 p-4">
          <p className="text-sm font-medium">Google</p>
          <p className="text-sm text-muted-foreground">{google ? "Conectado" : "Entre uma vez com “Continuar com Google” para vincular"}</p>
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border p-4">
        <div>
          <p className="text-sm font-medium">Sair de todos os aparelhos</p>
          <p className="text-xs text-muted-foreground">Encerra todas as sessões abertas, inclusive esta.</p>
        </div>
        <Button
          variant="outline"
          disabled={pending}
          onClick={() =>
            start(async () => {
              const r = await signOutEverywhere({});
              if (!r.ok) return void toast.error(r.error);
              router.replace(r.data.redirect);
            })
          }
        >
          <LogOut /> Sair de tudo
        </Button>
      </div>

      {!isDemo && (
        <div className="grid gap-3 rounded-lg border border-destructive/30 p-4">
          <div>
            <p className="text-sm font-medium text-destructive">Excluir minha conta</p>
            <p className="text-xs text-muted-foreground">Apaga perfil, leads, protótipos, cobranças e vendas. Não dá para desfazer. Digite EXCLUIR para confirmar.</p>
          </div>
          <div className="flex gap-2">
            <Input value={confirm} onChange={(e) => setConfirm(e.target.value)} placeholder="EXCLUIR" className="h-9 max-w-40" aria-label="Confirmação" />
            <Button
              variant="destructive"
              size="sm"
              className="h-9"
              disabled={pending || confirm !== "EXCLUIR"}
              onClick={() =>
                start(async () => {
                  const r = await deleteAccount({ confirm: "EXCLUIR" });
                  if (!r.ok) return void toast.error(r.error);
                  // recarga completa: nada da conta apagada fica na tela (conexão ao vivo, cache do app)
                  window.location.replace(r.data.redirect);
                })
              }
            >
              <Trash2 /> Excluir conta
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
