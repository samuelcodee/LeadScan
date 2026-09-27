"use client";

import { Monitor, Smartphone } from "lucide-react";
import { useEffect, useState } from "react";
import { DevicePreview, type Device } from "@/components/prototypes/device-preview";
import { Button } from "@/components/ui/button";
import type { SiteSpec } from "@/lib/templates/types";

export function track(slug: string, event: "view" | "cta" | "opt-out") {
  return fetch(`/api/public/proposal/${slug}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ event }),
    keepalive: true,
  });
}

/** Registra a visualização uma vez por sessão do navegador. */
export function ViewTracker({ slug }: { slug: string }) {
  useEffect(() => {
    const key = `viewed:${slug}`;
    try {
      if (sessionStorage.getItem(key)) return;
      sessionStorage.setItem(key, "1");
    } catch {
      // storage bloqueado: registra mesmo assim
    }
    void track(slug, "view");
  }, [slug]);
  return null;
}

export function CtaLink({ slug, href, children, className }: { slug: string; href: string; children: React.ReactNode; className?: string }) {
  return (
    <a href={href} target="_blank" rel="noopener noreferrer" onClick={() => void track(slug, "cta")} className={className}>
      {children}
    </a>
  );
}

export function ProposalPreview({ spec }: { spec: SiteSpec }) {
  const [device, setDevice] = useState<Device>("desktop");
  return (
    <div>
      <div className="mb-3 flex justify-center gap-1.5">
        <Button variant={device === "desktop" ? "default" : "outline"} size="sm" onClick={() => setDevice("desktop")}>
          <Monitor /> Computador
        </Button>
        <Button variant={device === "mobile" ? "default" : "outline"} size="sm" onClick={() => setDevice("mobile")}>
          <Smartphone /> Celular
        </Button>
      </div>
      <div className="h-[78dvh] min-h-[560px] rounded-xl bg-muted/70 p-3 sm:p-5">
        <DevicePreview spec={spec} device={device} />
      </div>
    </div>
  );
}

export function OptOut({ slug }: { slug: string }) {
  const [state, setState] = useState<"idle" | "confirm" | "done">("idle");
  if (state === "done") return <p className="text-xs text-muted-foreground">Pronto. Seus dados foram removidos e você não será mais contatado por aqui.</p>;
  if (state === "confirm")
    return (
      <p className="text-xs text-muted-foreground">
        Confirmar remoção?{" "}
        <button type="button" className="font-medium text-foreground underline" onClick={() => track(slug, "opt-out").then(() => setState("done"))}>
          Sim, remover
        </button>{" "}
        ·{" "}
        <button type="button" className="underline" onClick={() => setState("idle")}>
          Cancelar
        </button>
      </p>
    );
  return (
    <button type="button" onClick={() => setState("confirm")} className="text-xs text-muted-foreground underline underline-offset-4 hover:text-foreground">
      Não quero receber contato. Remover os dados da minha empresa.
    </button>
  );
}
