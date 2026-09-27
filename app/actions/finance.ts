"use server";

import { refresh } from "next/cache";
import { z } from "zod";
import { action, idSchema, UserFacingError } from "@/lib/action";
import { db } from "@/lib/db";
import { mockPaymentsEnabled } from "@/lib/env";
import { chargeableLeads } from "@/lib/finance/queries";
import { createCharge, listAccounts, listPaymentProviders, recordManualSale } from "@/lib/payments/service";
import { appUrl } from "@/lib/prototypes/service";
import { publish } from "@/lib/realtime";

const cents = z.coerce
  .number()
  .int()
  .min(500, "O valor mínimo é R$ 5,00.")
  .max(100_000_000, "Valor acima do limite (R$ 1 milhão por cobrança).");

/** Dados para o diálogo "Cobrar": contas conectadas + leads. */
export const chargeDialogData = action({ schema: z.object({}), name: "chargeDialogData" }, async (_i, user) => {
  const [accounts, leads] = await Promise.all([listAccounts(user.id), chargeableLeads(user.id)]);
  const providers = listPaymentProviders();
  const usable = providers.filter((p) => (p.id === "mock" ? mockPaymentsEnabled() : accounts.some((a) => a.provider === p.id && a.status === "ACTIVE")));
  return {
    providers: usable.map((p) => ({ id: p.id, label: p.label, methods: p.methods })),
    leads: leads.map((l) => ({ id: l.id, name: l.name, city: l.city, dealValue: l.dealValue, isDemo: l.isDemo, prototypeId: l.prototypes[0]?.id ?? null })),
    defaultTicket: user.defaultTicket,
  };
});

export const createChargeAction = action(
  {
    schema: z.object({
      provider: z.enum(["mock", "mercadopago", "stripe"]),
      amountCents: cents,
      description: z.string().trim().min(3, "Descreva o que está sendo cobrado.").max(200),
      methods: z.array(z.enum(["pix", "credit_card", "debit_card"])).min(1, "Escolha ao menos uma forma de pagamento."),
      leadId: idSchema.nullable().optional(),
      prototypeId: idSchema.nullable().optional(),
    }),
    limit: "payment",
    name: "createCharge",
  },
  async (input, user) => {
    const charge = await createCharge(user.id, input);
    refresh();
    return { id: charge.id, url: `${await appUrl()}/pagar/${charge.slug}`, isTest: charge.isTest };
  },
);

export const cancelChargeAction = action({ schema: z.object({ id: idSchema }), name: "cancelCharge" }, async ({ id }, user) => {
  const r = await db.charge.updateMany({ where: { id, userId: user.id, status: "PENDING" }, data: { status: "CANCELED" } });
  if (!r.count) throw new UserFacingError("Só dá pra cancelar cobranças em aberto.");
  await publish({ type: "charge", userId: user.id, chargeId: id, status: "CANCELED" });
  refresh();
  return { ok: true };
});

export const recordManualSaleAction = action(
  {
    schema: z.object({
      amountCents: cents,
      leadId: idSchema.nullable().optional(),
      note: z.string().trim().max(200).optional(),
      closedAt: z.coerce.date().max(new Date(Date.now() + 60_000), "A data não pode estar no futuro.").optional(),
    }),
    name: "recordManualSale",
  },
  async (input, user) => {
    await recordManualSale(user.id, input);
    refresh();
    return { ok: true };
  },
);

export const deleteManualSaleAction = action({ schema: z.object({ id: idSchema }), name: "deleteManualSale" }, async ({ id }, user) => {
  const r = await db.sale.deleteMany({ where: { id, userId: user.id, source: "MANUAL" } });
  if (!r.count) throw new UserFacingError("Venda não encontrada.");
  refresh();
  return { ok: true };
});

export const disconnectPaymentAccount = action({ schema: z.object({ provider: z.enum(["mock", "mercadopago", "stripe"]) }), name: "disconnectPayment" }, async ({ provider }, user) => {
  await db.paymentAccount.updateMany({
    where: { userId: user.id, provider },
    data: { status: "DISCONNECTED", accessEnc: null, refreshEnc: null },
  });
  refresh();
  return { ok: true };
});

export const setRankingOptIn = action({ schema: z.object({ value: z.boolean() }), name: "setRankingOptIn" }, async ({ value }, user) => {
  await db.user.update({ where: { id: user.id }, data: { rankingOptIn: value, rankingOptInAt: value ? new Date() : null } });
  await publish({ type: "profile", userId: user.id });
  refresh();
  return { ok: true };
});
