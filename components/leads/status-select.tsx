"use client";

import { useOptimistic, useTransition } from "react";
import { toast } from "sonner";
import { setStatus } from "@/app/actions/leads";
import { StatusDot } from "@/components/leads/lead-actions";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { STATUS_META, STATUS_ORDER } from "@/lib/domain/lead-status";
import type { LeadStatus } from "@/lib/generated/prisma/enums";
import { cn } from "@/lib/utils";

export function StatusSelect({ id, status, className }: { id: string; status: LeadStatus; className?: string }) {
  const [optimistic, setOptimistic] = useOptimistic(status);
  const [, start] = useTransition();
  return (
    <Select
      value={optimistic}
      onValueChange={(v) =>
        start(async () => {
          setOptimistic(v as LeadStatus);
          const r = await setStatus({ id, status: v as LeadStatus });
          if (!r.ok) toast.error(r.error);
          else toast.success(`Etapa: ${STATUS_META[v as LeadStatus].label}`);
        })
      }
    >
      <SelectTrigger className={cn("h-8 w-44", className)} aria-label="Etapa do lead">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {STATUS_ORDER.map((s) => (
          <SelectItem key={s} value={s}>
            <StatusDot status={s} />
            {STATUS_META[s].label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
