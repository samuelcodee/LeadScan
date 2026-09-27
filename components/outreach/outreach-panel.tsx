"use client";

import { Check, Copy, RefreshCw, Sparkles, Wand2 } from "lucide-react";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { generateOutreachAction, markOutreachCopied, updateOutreach } from "@/app/actions/outreach";
import { shareAction } from "@/app/actions/prototypes";
import { WhatsAppButton } from "@/components/leads/lead-actions";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { VARIANT_LABEL, type OutreachVariant } from "@/lib/outreach/generate";
import { cn } from "@/lib/utils";

export type OutreachMessage = { id: string; variant: OutreachVariant; content: string; source: "TEMPLATE" | "AI" | "MANUAL" };

const ORDER: OutreachVariant[] = ["SHORT", "PROFESSIONAL", "CONVERSATIONAL"];
const SOURCE_LABEL = { TEMPLATE: "Modelo", AI: "IA", MANUAL: "Editada" } as const;

export function OutreachPanel({
  lead,
  messages: initial,
  prototype,
  aiEnabled,
  onMessages,
  onShareUrl,
}: {
  lead: { id: string; name: string; isDemo: boolean; phone: string | null; whatsapp: string | null };
  messages: OutreachMessage[];
  prototype: { id: string; shareUrl: string | null } | null;
  aiEnabled: boolean;
  onMessages?: (m: OutreachMessage[]) => void;
  onShareUrl?: (url: string) => void;
}) {
  const [messages, setMessages] = useState(initial);
  const [variant, setVariant] = useState<OutreachVariant>("SHORT");
  const [useAI, setUseAI] = useState(false);
  const [includeLink, setIncludeLink] = useState(false);
  const [copied, setCopied] = useState(false);
  const [pending, start] = useTransition();
  const [sharing, startShare] = useTransition();

  // Props novas (ex.: revalidação do servidor) substituem o estado local — sem efeito extra
  const [prevInitial, setPrevInitial] = useState(initial);
  if (prevInitial !== initial) {
    setPrevInitial(initial);
    setMessages(initial);
  }

  const current = messages.find((m) => m.variant === variant);
  const [draft, setDraft] = useState(current?.content ?? "");
  const sourceKey = `${variant}:${current?.content ?? ""}`;
  const [prevSource, setPrevSource] = useState(sourceKey);
  if (prevSource !== sourceKey) {
    setPrevSource(sourceKey);
    setDraft(current?.content ?? "");
  }

  const finalText = includeLink && prototype?.shareUrl ? `${draft.trim()}\n\n${prototype.shareUrl}` : draft.trim();

  const generate = (force: boolean) =>
    start(async () => {
      const r = await generateOutreachAction({ leadId: lead.id, useAI, force });
      if (!r.ok) return void toast.error(r.error);
      const list = r.data.messages as OutreachMessage[];
      setMessages(list);
      onMessages?.(list);
      if (force) toast.success("Nova variação gerada");
    });

  const persistDraft = () => {
    if (!current || draft.trim() === current.content || !draft.trim()) return;
    const next = messages.map((m) => (m.id === current.id ? { ...m, content: draft.trim(), source: "MANUAL" as const } : m));
    setMessages(next);
    onMessages?.(next);
    void updateOutreach({ id: current.id, content: draft.trim() });
  };

  const copy = async () => {
    persistDraft();
    try {
      await navigator.clipboard.writeText(finalText);
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
      toast.success("Mensagem copiada");
      void markOutreachCopied({ leadId: lead.id, variant });
    } catch {
      toast.error("Não deu pra copiar. Selecione o texto e use Ctrl+C.");
    }
  };

  const toggleLink = (checked: boolean) => {
    if (!checked) return setIncludeLink(false);
    if (prototype?.shareUrl) return setIncludeLink(true);
    if (!prototype) return;
    startShare(async () => {
      const r = await shareAction({ id: prototype.id });
      if (!r.ok) return void toast.error(r.error);
      onShareUrl?.(r.data.url);
      setIncludeLink(true);
      toast.success("Link da proposta gerado");
    });
  };

  if (messages.length === 0) {
    return (
      <div className="rounded-lg border border-dashed p-4">
        <p className="text-sm font-medium">Nenhuma abordagem ainda</p>
        <p className="mt-1 text-sm text-muted-foreground">
          Gera 3 versões (curta, profissional e conversacional) usando só o que sabemos sobre {lead.name}.
        </p>
        <div className="mt-4 flex flex-wrap items-center gap-3">
          <Button onClick={() => generate(false)} disabled={pending}>
            <Wand2 />
            {pending ? "Gerando…" : "Gerar abordagem"}
          </Button>
          {aiEnabled && <AiSwitch checked={useAI} onChange={setUseAI} />}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <Tabs value={variant} onValueChange={(v) => { persistDraft(); setVariant(v as OutreachVariant); }}>
          <TabsList>
            {ORDER.map((v) => (
              <TabsTrigger key={v} value={v} className="px-2.5 text-xs">
                {VARIANT_LABEL[v]}
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>
        <div className="flex items-center gap-1">
          {current && <span className="mr-1 text-[11px] font-medium text-muted-foreground">{SOURCE_LABEL[current.source]}</span>}
          <Button variant="ghost" size="icon-sm" onClick={() => generate(true)} disabled={pending} aria-label="Gerar outra variação" title="Gerar outra variação">
            <RefreshCw className={cn(pending && "animate-spin")} />
          </Button>
        </div>
      </div>

      <Textarea
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={persistDraft}
        rows={variant === "PROFESSIONAL" ? 8 : 5}
        className="resize-y text-sm leading-relaxed"
        aria-label={`Mensagem ${VARIANT_LABEL[variant].toLowerCase()}`}
      />
      <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
        <label className={cn("flex items-center gap-2", !prototype && "opacity-50")}>
          <Checkbox checked={includeLink} onCheckedChange={(c) => toggleLink(c === true)} disabled={!prototype || sharing} />
          {sharing ? "Gerando link…" : "Incluir link da prévia"}
        </label>
        <span className="tabular">{finalText.length} caracteres</span>
      </div>
      {!includeLink && prototype && (
        <p className="text-xs text-muted-foreground">Dica: pergunte antes e mande o link quando responderem. Soa menos como disparo.</p>
      )}

      <div className="grid grid-cols-2 gap-2">
        <Button variant="outline" onClick={copy}>
          {copied ? <Check /> : <Copy />}
          {copied ? "Copiada" : "Copiar"}
        </Button>
        <WhatsAppButton lead={lead} message={finalText} variant={variant} label="Abrir WhatsApp" />
      </div>
      {aiEnabled && (
        <div className="flex items-center justify-between rounded-md bg-muted/60 px-3 py-2">
          <AiSwitch checked={useAI} onChange={setUseAI} />
          <Button variant="ghost" size="sm" onClick={() => generate(true)} disabled={pending || !useAI}>
            Reescrever
          </Button>
        </div>
      )}
    </div>
  );
}

function AiSwitch({ checked, onChange }: { checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <Label className="flex cursor-pointer items-center gap-2 text-xs font-normal text-muted-foreground">
      <Switch checked={checked} onCheckedChange={onChange} size="sm" />
      <Sparkles className="size-3.5 text-brand-ink" />
      Personalizar com IA
    </Label>
  );
}
