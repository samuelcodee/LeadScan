"use client";

import { CheckCircle2, CircleDashed, Unplug } from "lucide-react";
import { toast } from "sonner";
import { disconnectPaymentAccount } from "@/app/actions/finance";
import { Button } from "@/components/ui/button";

type Provider = { id: "mock" | "mercadopago" | "stripe"; label: string; description: string; configured: boolean };
type Account = { provider: string; status: string; livemode: boolean };

export function AccountsPanel({ providers, accounts }: { providers: Provider[]; accounts: Account[] }) {
  return (
    <ul className="-my-3 divide-y">
      {providers.map((p) => {
        const acc = accounts.find((a) => a.provider === p.id);
        const active = acc?.status === "ACTIVE";
        const pending = acc?.status === "PENDING";
        return (
          <li key={p.id} className="flex flex-wrap items-center gap-3 py-3">
            {active ? <CheckCircle2 className="size-5 shrink-0 text-success" /> : <CircleDashed className="size-5 shrink-0 text-muted-foreground" />}
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium">
                {p.label}
                {active && !acc.livemode && p.id !== "mock" && <span className="ml-2 text-xs font-normal text-demo">modo sandbox</span>}
              </p>
              <p className="text-xs text-muted-foreground">
                {!p.configured && p.id !== "mock" ? "Aguardando o administrador da plataforma configurar as chaves deste provedor." : p.description}
              </p>
            </div>
            {active ? (
              p.id !== "mock" && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={async () => {
                    const r = await disconnectPaymentAccount({ provider: p.id });
                    if (r.ok) toast.success(`${p.label} desconectado`);
                    else toast.error(r.error);
                  }}
                >
                  <Unplug /> Desconectar
                </Button>
              )
            ) : p.configured ? (
              <Button asChild size="sm" variant={p.id === "mock" ? "outline" : "default"}>
                <a href={`/api/payments/connect/${p.id}`}>{pending ? "Continuar cadastro" : p.id === "mock" ? "Ativar teste" : "Conectar"}</a>
              </Button>
            ) : (
              <Button size="sm" variant="outline" disabled>
                Indisponível
              </Button>
            )}
          </li>
        );
      })}
    </ul>
  );
}
