"use server";

import { refresh } from "next/cache";
import { z } from "zod";
import { action, UserFacingError } from "@/lib/action";
import { db } from "@/lib/db";
import { resetDemoData } from "@/lib/demo/seed";
import { fold } from "@/lib/format";
import { normalizeBrazilPhone } from "@/lib/whatsapp/phone";

export const updateProfile = action(
  {
    name: "updateProfile",
    schema: z.object({
      name: z.string().trim().min(2, "Informe seu nome.").max(80),
      agencyName: z.string().trim().max(80).optional(),
      whatsapp: z.string().trim().max(30).optional(),
      defaultTicketReais: z.coerce.number().int().min(0).max(1_000_000),
    }),
  },
  async (input, user) => {
    let whatsapp: string | null = null;
    if (input.whatsapp) {
      const p = normalizeBrazilPhone(input.whatsapp);
      if (!p) throw new UserFacingError("WhatsApp inválido. Use DDD + número, ex.: (85) 99999-0000.");
      whatsapp = p.e164;
    }
    await db.user.update({
      where: { id: user.id },
      data: { name: input.name, agencyName: input.agencyName || null, whatsapp, defaultTicket: input.defaultTicketReais * 100 },
    });
    refresh();
    return { ok: true };
  },
);

/** LGPD: registra um pedido de remoção (vale para buscas futuras de toda a plataforma). */
export const addSuppression = action(
  {
    name: "addSuppression",
    schema: z.object({
      name: z.string().trim().max(120).optional(),
      city: z.string().trim().max(60).optional(),
      phone: z.string().trim().max(30).optional(),
    }),
  },
  async ({ name, city, phone }, user) => {
    const rows: { kind: string; value: string }[] = [];
    if (name && city) rows.push({ kind: "name_city", value: `${fold(name)}|${fold(city)}` });
    const p = normalizeBrazilPhone(phone);
    if (p) rows.push({ kind: "phone", value: p.e164 });
    if (!rows.length) throw new UserFacingError("Informe nome + cidade ou um telefone válido.");
    await db.suppression.createMany({ data: rows.map((r) => ({ ...r, reason: "Pedido registrado manualmente" })), skipDuplicates: true });

    // Remove também da conta de quem registrou
    const or = [
      ...(name && city ? [{ name: { equals: name, mode: "insensitive" as const }, city: { equals: city, mode: "insensitive" as const } }] : []),
      ...(p ? [{ phone: p.e164 }] : []),
    ];
    const { count } = await db.lead.deleteMany({ where: { userId: user.id, OR: or } });
    refresh();
    return { removed: count };
  },
);

export const deleteAllMyData = action(
  { name: "deleteAllMyData", schema: z.object({ confirm: z.literal("EXCLUIR") }) },
  async (_input, user) => {
    await db.$transaction([
      db.leadEvent.deleteMany({ where: { userId: user.id } }),
      db.outreach.deleteMany({ where: { userId: user.id } }),
      db.prototype.deleteMany({ where: { userId: user.id } }),
      db.lead.deleteMany({ where: { userId: user.id } }),
      db.search.deleteMany({ where: { userId: user.id } }),
    ]);
    refresh();
    return { ok: true };
  },
);

export const resetDemo = action({ name: "resetDemo", schema: z.object({}), limit: "search" }, async (_i, user) => {
  if (!user.isDemo) throw new UserFacingError("Disponível só na conta de demonstração.");
  await resetDemoData(user.id);
  refresh();
  return { ok: true };
});
