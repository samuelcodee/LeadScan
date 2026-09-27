"use server";

import { refresh } from "next/cache";
import { z } from "zod";
import { action, idSchema, UserFacingError } from "@/lib/action";
import { db } from "@/lib/db";
import { LeadStatus } from "@/lib/generated/prisma/enums";
import { logEvent } from "@/lib/leads/events";
import { quickFind } from "@/lib/leads/queries";

async function owned(userId: string, id: string) {
  const lead = await db.lead.findFirst({ where: { id, userId }, select: { id: true, status: true, saved: true } });
  if (!lead) throw new UserFacingError("Lead não encontrado.");
  return lead;
}

export const quickFindLeads = action({ name: "quickFindLeads", schema: z.object({ q: z.string().max(80) }) }, async ({ q }, user) =>
  quickFind(user.id, q),
);

export const setSaved = action(
  { name: "setSaved", schema: z.object({ id: idSchema, saved: z.boolean() }) },
  async ({ id, saved }, user) => {
    await owned(user.id, id);
    await db.lead.update({ where: { id }, data: { saved } });
    await logEvent(user.id, id, saved ? "SAVED" : "UNSAVED");
    refresh();
    return { saved };
  },
);

export const saveMany = action(
  { name: "saveMany", schema: z.object({ ids: z.array(idSchema).min(1).max(500) }) },
  async ({ ids }, user) => {
    const { count } = await db.lead.updateMany({ where: { userId: user.id, id: { in: ids }, saved: false }, data: { saved: true } });
    refresh();
    return { count };
  },
);

export const setFavorite = action(
  { name: "setFavorite", schema: z.object({ id: idSchema, favorite: z.boolean() }) },
  async ({ id, favorite }, user) => {
    await owned(user.id, id);
    // Favoritar também salva: favorito fora da lista não faz sentido
    await db.lead.update({ where: { id }, data: { favorite, ...(favorite ? { saved: true } : {}) } });
    refresh();
    return { favorite };
  },
);

/**
 * Tirar o lead das listas (Meus leads e Favoritos) sem apagar: o registro continua servindo
 * para a busca nunca trazer a mesma empresa de novo. Devolve o estado anterior (Desfazer).
 */
export const setLeadLists = action(
  { name: "setLeadLists", schema: z.object({ id: idSchema, saved: z.boolean(), favorite: z.boolean() }) },
  async ({ id, saved, favorite }, user) => {
    const lead = await db.lead.findFirst({ where: { id, userId: user.id }, select: { saved: true, favorite: true } });
    if (!lead) throw new UserFacingError("Lead não encontrado.");
    await db.lead.update({ where: { id }, data: { saved: saved || favorite, favorite } });
    if (lead.saved !== (saved || favorite)) await logEvent(user.id, id, saved || favorite ? "SAVED" : "UNSAVED");
    refresh();
    return { previous: { saved: lead.saved, favorite: lead.favorite } };
  },
);

export const setStatus = action(
  { name: "setStatus", schema: z.object({ id: idSchema, status: z.enum(LeadStatus) }) },
  async ({ id, status }, user) => {
    const lead = await owned(user.id, id);
    if (lead.status === status) return { status };
    const contactStages: LeadStatus[] = ["CONTACTED", "REPLIED", "NEGOTIATION", "PROPOSAL", "WON"];
    await db.lead.update({
      where: { id },
      data: { status, saved: true, ...(contactStages.includes(status) && lead.status === "NEW" ? { lastContactAt: new Date() } : {}) },
    });
    await logEvent(user.id, id, "STATUS_CHANGED", { from: lead.status, to: status });
    refresh();
    return { status, previous: lead.status };
  },
);

export const updateNotes = action(
  { name: "updateNotes", schema: z.object({ id: idSchema, notes: z.string().max(4000) }) },
  async ({ id, notes }, user) => {
    await owned(user.id, id);
    await db.lead.update({ where: { id }, data: { notes: notes.trim() || null } });
    await logEvent(user.id, id, "NOTE_UPDATED");
    return { ok: true };
  },
);

export const updateDealValue = action(
  { name: "updateDealValue", schema: z.object({ id: idSchema, reais: z.number().int().min(0).max(10_000_000).nullable() }) },
  async ({ id, reais }, user) => {
    await owned(user.id, id);
    await db.lead.update({ where: { id }, data: { dealValue: reais === null ? null : reais * 100 } });
    refresh();
    return { ok: true };
  },
);

/**
 * Registra que o WhatsApp foi aberto. Se o lead ainda é "Novo"/"Interessante",
 * avança para "Contatado" (menos cliques: o usuário não precisa mover o card).
 */
export const markWhatsAppOpened = action(
  { name: "markWhatsAppOpened", schema: z.object({ id: idSchema, variant: z.string().max(20).optional() }) },
  async ({ id, variant }, user) => {
    const lead = await owned(user.id, id);
    const advance = lead.status === "NEW" || lead.status === "INTERESTING";
    await db.lead.update({
      where: { id },
      data: { saved: true, lastContactAt: new Date(), ...(advance ? { status: "CONTACTED" } : {}) },
    });
    await logEvent(user.id, id, "WHATSAPP_OPENED", variant ? { variant } : undefined);
    if (advance) await logEvent(user.id, id, "STATUS_CHANGED", { from: lead.status, to: "CONTACTED", auto: true });
    refresh();
    return { advanced: advance, previous: lead.status };
  },
);

/** LGPD: exclui o lead (e tudo ligado a ele) da conta do usuário. */
export const deleteLead = action({ name: "deleteLead", schema: z.object({ id: idSchema }) }, async ({ id }, user) => {
  await owned(user.id, id);
  await db.lead.delete({ where: { id } });
  refresh();
  return { ok: true };
});
