"use client";

import { Check, ExternalLink, KeyRound, Loader2, Star, Unplug } from "lucide-react";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { connectAiAction, disconnectAiAction, setDefaultAiAction } from "@/app/actions/ai";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { AiProviderDef } from "@/lib/ai/catalog";
import { cn } from "@/lib/utils";

type Conn = { provider: string; keyLast4: string | null; model: string | null; imageModel: string | null; status: string; lastError: string | null; lastUsedAt: Date | null };

function ConnectDialog({ def, conn, open, onOpenChange }: { def: AiProviderDef; conn?: Conn; open: boolean; onOpenChange: (v: boolean) => void }) {
  const [key, setKey] = useState("");
  const [model, setModel] = useState(conn?.model ?? def.defaultModel);
  const [imageModel, setImageModel] = useState(conn?.imageModel ?? def.image?.defaultModel ?? "");
  const [pending, start] = useTransition();
  const needsKey = def.needsKey !== false;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Conectar {def.name}</DialogTitle>
          <DialogDescription>
            A chave fica criptografada no servidor e nunca volta para o navegador. O uso é cobrado pela {def.vendor} direto na sua conta.
          </DialogDescription>
        </DialogHeader>
        <form
          className="grid gap-4"
          onSubmit={(e) => {
            e.preventDefault();
            start(async () => {
              const r = await connectAiAction({ provider: def.id, apiKey: key, model, imageModel: imageModel || undefined });
              if (!r.ok) return void toast.error(r.error);
              toast.success(`${def.name} conectado`);
              setKey("");
              onOpenChange(false);
            });
          }}
        >
          {needsKey && (
            <div className="grid gap-1.5">
              <div className="flex items-center justify-between">
                <Label htmlFor={`key-${def.id}`}>Chave de API</Label>
                <a href={def.keyUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground">
                  Criar chave <ExternalLink className="size-3" />
                </a>
              </div>
              <Input
                id={`key-${def.id}`}
                type="password"
                autoComplete="off"
                spellCheck={false}
                value={key}
                onChange={(e) => setKey(e.target.value)}
                placeholder={conn?.keyLast4 ? `Atual: ••••${conn.keyLast4} (cole outra para trocar)` : def.keyPlaceholder}
                className="h-10 font-mono text-sm"
                required
              />
            </div>
          )}
          <div className="grid gap-1.5">
            <Label htmlFor={`model-${def.id}`}>Modelo de texto</Label>
            <Input id={`model-${def.id}`} list={`models-${def.id}`} value={model} onChange={(e) => setModel(e.target.value)} className="h-10 font-mono text-sm" />
            <datalist id={`models-${def.id}`}>
              {def.models.map((m) => (
                <option key={m} value={m} />
              ))}
            </datalist>
            <p className="text-xs text-muted-foreground">Sugestões na lista; dá pra digitar qualquer modelo que sua conta tenha.</p>
          </div>
          {def.image && (
            <div className="grid gap-1.5">
              <Label htmlFor={`img-${def.id}`}>Modelo de imagem ({def.image.label})</Label>
              <Input id={`img-${def.id}`} list={`imgs-${def.id}`} value={imageModel} onChange={(e) => setImageModel(e.target.value)} className="h-10 font-mono text-sm" />
              <datalist id={`imgs-${def.id}`}>
                {def.image.models.map((m) => (
                  <option key={m} value={m} />
                ))}
              </datalist>
            </div>
          )}
          <DialogFooter>
            <Button type="submit" disabled={pending || (needsKey && key.trim().length < 12)}>
              {pending ? <Loader2 className="animate-spin" /> : <KeyRound />} Validar e conectar
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export function AiProviderCards({ providers, connections, defaultId }: { providers: AiProviderDef[]; connections: Conn[]; defaultId: string | null }) {
  const [open, setOpen] = useState<string | null>(null);
  return (
    <ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
      {providers.map((def) => {
        const conn = connections.find((c) => c.provider === def.id);
        const isDefault = conn && defaultId === def.id;
        return (
          <li key={def.id} className={cn("flex flex-col rounded-lg border bg-card p-4", isDefault && "ring-1 ring-foreground")}>
            <div className="flex items-start justify-between gap-2">
              <div>
                <p className="font-semibold">{def.name}</p>
                <p className="text-xs text-muted-foreground">{def.vendor}</p>
              </div>
              {conn ? (
                <span className="inline-flex items-center gap-1 rounded-full bg-success-soft px-2 py-0.5 text-xs font-medium text-success">
                  <Check className="size-3" /> Conectado
                </span>
              ) : (
                <span className="rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">Não conectado</span>
              )}
            </div>
            <p className="mt-2 flex-1 text-sm text-muted-foreground">{def.description}</p>
            {conn && (
              <p className="mt-3 truncate font-mono text-xs text-muted-foreground">
                {conn.keyLast4 ? `••••${conn.keyLast4} · ` : ""}
                {conn.model}
                {conn.imageModel ? ` · ${conn.imageModel}` : ""}
              </p>
            )}
            {conn?.lastError && <p className="mt-1 line-clamp-2 text-xs text-destructive">Último erro: {conn.lastError}</p>}
            <div className="mt-4 flex flex-wrap gap-2">
              <Button size="sm" variant={conn ? "outline" : "default"} onClick={() => setOpen(def.id)}>
                {conn ? "Trocar chave/modelo" : "Conectar"}
              </Button>
              {conn && !isDefault && (
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={async () => {
                    const r = await setDefaultAiAction({ provider: def.id });
                    if (r.ok) toast.success(`${def.name} agora é a IA padrão`);
                    else toast.error(r.error);
                  }}
                >
                  <Star /> Tornar padrão
                </Button>
              )}
              {isDefault && <span className="inline-flex items-center gap-1 px-2 text-xs font-medium">Padrão</span>}
              {conn && (
                <Button
                  size="sm"
                  variant="ghost"
                  className="ml-auto text-muted-foreground"
                  aria-label={`Desconectar ${def.name}`}
                  onClick={async () => {
                    const r = await disconnectAiAction({ provider: def.id });
                    if (r.ok) toast.success(`${def.name} desconectado e chave apagada`);
                    else toast.error(r.error);
                  }}
                >
                  <Unplug />
                </Button>
              )}
            </div>
            <ConnectDialog def={def} conn={conn} open={open === def.id} onOpenChange={(v) => setOpen(v ? def.id : null)} />
          </li>
        );
      })}
    </ul>
  );
}
