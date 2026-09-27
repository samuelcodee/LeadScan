"use server";

import { z } from "zod";
import { action, idSchema, UserFacingError } from "@/lib/action";
import { getLeadWorkbench } from "@/lib/leads/queries";
import { parseSpec, proposalUrl } from "@/lib/prototypes/service";

/** Dados sob demanda do painel lateral (abordagens + último protótipo) de um lead. */
export const loadWorkbench = action({ name: "loadWorkbench", schema: z.object({ id: idSchema }) }, async ({ id }, user) => {
  const w = await getLeadWorkbench(user.id, id);
  if (!w) throw new UserFacingError("Lead não encontrado.");
  const p = w.prototypes[0];
  return {
    outreaches: w.outreaches,
    prototype: p
      ? {
          id: p.id,
          name: p.name,
          spec: parseSpec(p.spec),
          shareUrl: p.shareEnabled && p.shareSlug ? await proposalUrl(p.shareSlug) : null,
          updatedAt: p.updatedAt,
        }
      : null,
  };
});

export type Workbench = Extract<Awaited<ReturnType<typeof loadWorkbench>>, { ok: true }>["data"];
