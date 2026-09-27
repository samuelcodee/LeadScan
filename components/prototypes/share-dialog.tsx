"use client";

import { Check, Copy, ExternalLink, Link2Off, Send } from "lucide-react";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { shareAction, unshareAction } from "@/app/actions/prototypes";
import { WhatsAppButton } from "@/components/leads/lead-actions";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { articles } from "@/lib/domain/grammar";

/**
 * "Enviar para cliente": gera o link público da proposta e prepara a mensagem.
 * O link abre uma página própria (/proposta/…) pensada para virar proposta comercial.
 */
export function ShareDialog({
  prototypeId,
  lead,
  initialUrl,
  onUrl,
  trigger,
}: {
  prototypeId: string;
  lead: { id: string; name: string; isDemo: boolean; phone: string | null; whatsapp: string | null };
  initialUrl: string | null;
  onUrl?: (url: string | null) => void;
  trigger?: React.ReactNode;
}) {
  const [url, setUrl] = useState(initialUrl);
  const [copied, setCopied] = useState(false);
  const [pending, start] = useTransition();
  const [message, setMessage] = useState("");

  const makeMessage = (u: string) =>
    `Oi! Como combinado, aqui está a prévia do site que montei para ${articles(lead.name).o}: ${u}\n\nÉ só um rascunho, dá pra mudar tudo. Me conta o que achou?`;

  const ensureLink = () =>
    start(async () => {
      const r = await shareAction({ id: prototypeId });
      if (!r.ok) return void toast.error(r.error);
      setUrl(r.data.url);
      setMessage(makeMessage(r.data.url));
      onUrl?.(r.data.url);
    });

  const disable = () =>
    start(async () => {
      const r = await unshareAction({ id: prototypeId });
      if (!r.ok) return void toast.error(r.error);
      setUrl(null);
      onUrl?.(null);
      toast.success("Link desativado. Quem tiver o endereço não vê mais a proposta.");
    });

  return (
    <Dialog
      onOpenChange={(open) => {
        if (open && url && !message) setMessage(makeMessage(url));
      }}
    >
      <DialogTrigger asChild>
        {trigger ?? (
          <Button>
            <Send /> Enviar<span className="hidden sm:inline"> para cliente</span>
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Enviar para {lead.name}</DialogTitle>
          <DialogDescription>O cliente vê só a apresentação e o protótipo. Nada dos seus dados de CRM aparece.</DialogDescription>
        </DialogHeader>

        {!url ? (
          <div className="rounded-lg border border-dashed p-5 text-center">
            <p className="text-sm">Ainda não existe link público para este protótipo.</p>
            <Button className="mt-4" onClick={ensureLink} disabled={pending}>
              {pending ? "Gerando…" : "Gerar link para cliente"}
            </Button>
          </div>
        ) : (
          <div className="grid gap-4">
            <div className="flex gap-2">
              <Input value={url} readOnly className="font-mono text-xs" onFocus={(e) => e.currentTarget.select()} aria-label="Link da proposta" />
              <Button
                variant="outline"
                size="icon"
                aria-label="Copiar link"
                onClick={async () => {
                  await navigator.clipboard.writeText(url).catch(() => {});
                  setCopied(true);
                  setTimeout(() => setCopied(false), 1500);
                }}
              >
                {copied ? <Check /> : <Copy />}
              </Button>
              <Button asChild variant="outline" size="icon" aria-label="Abrir proposta">
                <a href={url} target="_blank" rel="noopener noreferrer">
                  <ExternalLink />
                </a>
              </Button>
            </div>
            <div className="grid gap-1.5">
              <span className="text-xs font-medium text-muted-foreground">Mensagem</span>
              <Textarea value={message} onChange={(e) => setMessage(e.target.value)} rows={5} className="text-sm" />
            </div>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <Button variant="ghost" size="sm" onClick={disable} disabled={pending} className="text-muted-foreground">
                <Link2Off /> Desativar link
              </Button>
              <WhatsAppButton lead={lead} message={message} variant="PROPOSAL" label="Enviar no WhatsApp" />
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
