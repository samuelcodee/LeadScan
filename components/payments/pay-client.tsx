"use client";

import { Check, Copy, CreditCard, Loader2, QrCode } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useState, useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";

const MOCK: { id: string; label: string; icon: typeof QrCode }[] = [
  { id: "pix", label: "Simular Pix", icon: QrCode },
  { id: "credit_card", label: "Simular cartão de crédito", icon: CreditCard },
  { id: "debit_card", label: "Simular cartão de débito", icon: CreditCard },
];

/** Botões do checkout de TESTE: confirmam na hora, sem dado de cartão nenhum. */
export function MockPayButtons({ slug, methods }: { slug: string; methods: string[] }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [which, setWhich] = useState<string | null>(null);
  return (
    <div className="grid gap-2">
      {MOCK.filter((m) => methods.includes(m.id)).map((m) => (
        <Button
          key={m.id}
          size="lg"
          variant={m.id === "pix" ? "default" : "outline"}
          className="h-12 justify-start"
          disabled={pending}
          onClick={() => {
            setWhich(m.id);
            start(async () => {
              const res = await fetch(`/api/payments/mock/${slug}`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ method: m.id }),
              });
              const json = (await res.json().catch(() => ({}))) as { error?: string };
              if (!res.ok) return void toast.error(json.error ?? "Não deu certo. Tente de novo.");
              router.refresh();
            });
          }}
        >
          {pending && which === m.id ? <Loader2 className="animate-spin" /> : <m.icon />} {m.label}
        </Button>
      ))}
    </div>
  );
}

/** Enquanto a cobrança estiver pendente, confere o status a cada 4 s (o webhook pode chegar a qualquer momento). */
export function StatusPoller({ slug, active }: { slug: string; active: boolean }) {
  const router = useRouter();
  useEffect(() => {
    if (!active) return;
    let last = "PENDING";
    const t = setInterval(async () => {
      const r = await fetch(`/api/public/charge/${slug}`, { cache: "no-store" }).catch(() => null);
      const json = (await r?.json().catch(() => null)) as { status?: string } | null;
      if (json?.status && json.status !== last) {
        last = json.status;
        router.refresh();
      }
    }, 4000);
    return () => clearInterval(t);
  }, [slug, active, router]);
  return null;
}

/** Botão do Pix copia e cola: copia o código inteiro (o cliente cola no app do banco). */
export function CopyPixCode({ code }: { code: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <div className="grid gap-2">
      <textarea
        readOnly
        value={code}
        rows={3}
        onFocus={(e) => e.target.select()}
        className="w-full resize-none rounded-md border bg-muted/40 px-3 py-2 font-mono text-[11px] leading-snug text-muted-foreground"
        aria-label="Código Pix copia e cola"
      />
      <Button
        size="lg"
        className="h-12 w-full text-base"
        onClick={() =>
          navigator.clipboard
            .writeText(code)
            .then(() => {
              setCopied(true);
              toast.success("Código copiado. Cole no app do seu banco, na opção Pix copia e cola.");
              setTimeout(() => setCopied(false), 3000);
            })
            .catch(() => toast.error("Não deu para copiar. Selecione o código acima e copie."))
        }
      >
        {copied ? <Check /> : <Copy />} {copied ? "Copiado" : "Copiar código Pix"}
      </Button>
    </div>
  );
}
