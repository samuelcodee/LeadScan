"use client";

import { Input } from "@/components/ui/input";

/** Campo de valor em reais que guarda centavos. Digita "1500" → R$ 1.500,00. Aceita vírgula. */
export function MoneyInput({ id, cents, onChange, className }: { id?: string; cents: number; onChange: (cents: number) => void; className?: string }) {
  const display = cents ? (cents / 100).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : "";
  return (
    <div className="relative">
      <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">R$</span>
      <Input
        id={id}
        inputMode="decimal"
        value={display}
        onChange={(e) => {
          const digits = e.target.value.replace(/\D/g, "").slice(0, 10);
          onChange(Number(digits || "0"));
        }}
        placeholder="0,00"
        className={className ?? "h-11 pl-9 text-lg font-semibold tabular"}
      />
    </div>
  );
}
