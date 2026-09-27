import "server-only";
import { UserFacingError } from "@/lib/action";
import { decryptSecret, encryptSecret } from "@/lib/crypto/secrets";
import { db } from "@/lib/db";
import { env, mockPaymentsEnabled } from "@/lib/env";
import { pointsForSale } from "@/lib/gamification/points";
import { recomputeLevel } from "@/lib/gamification/service";
import type { Charge, PaymentAccount } from "@/lib/generated/prisma/client";
import { randomSlug } from "@/lib/hash";
import { logEvent } from "@/lib/leads/events";
import { logger } from "@/lib/logger";
import { mercadoPagoConfigured, mpCreateCheckout, mpRefresh } from "@/lib/payments/mercadopago";
import { stripeConfigured, stripeCreateCheckout } from "@/lib/payments/stripe";
import { pixAccountFor } from "@/lib/finance/banks";
import { buildPixCode } from "@/lib/payments/pix";
import type { AccountSecrets, ChargeProvider, CheckoutUrls, PayMethod, PaymentProviderId, PaymentUpdate, ProviderInfo } from "@/lib/payments/types";
import { appUrl } from "@/lib/prototypes/service";
import { publish } from "@/lib/realtime";

// ─── Provedores disponíveis ──────────────────────────────────────

export function listPaymentProviders(): ProviderInfo[] {
  return [
    {
      id: "mercadopago",
      label: "Mercado Pago",
      description: "Pix, crédito (até 12x) e débito. O dinheiro cai na sua conta Mercado Pago.",
      methods: ["pix", "credit_card", "debit_card"],
      configured: mercadoPagoConfigured(),
    },
    {
      id: "stripe",
      label: "Stripe",
      description: env().STRIPE_PIX ? "Cartão e Pix. Repasse para a sua conta Stripe." : "Cartão de crédito e débito. Repasse para a sua conta Stripe.",
      methods: env().STRIPE_PIX ? ["pix", "credit_card", "debit_card"] : ["credit_card", "debit_card"],
      configured: stripeConfigured(),
    },
    {
      id: "mock",
      label: "Pagamentos de teste",
      description: "Simula Pix e cartão sem mexer em dinheiro. Para conhecer o fluxo e demonstrar.",
      methods: ["pix", "credit_card", "debit_card"],
      configured: mockPaymentsEnabled(),
    },
  ];
}

export async function listAccounts(userId: string) {
  return db.paymentAccount.findMany({
    where: { userId, status: { not: "DISCONNECTED" } },
    select: { id: true, provider: true, status: true, livemode: true, externalId: true, createdAt: true },
    orderBy: { createdAt: "asc" },
  });
}

export async function saveAccount(
  userId: string,
  provider: PaymentProviderId,
  data: { status: "PENDING" | "ACTIVE" | "ERROR"; externalId?: string | null; accessToken?: string | null; refreshToken?: string | null; publicKey?: string | null; livemode?: boolean; expiresInSec?: number },
) {
  const fields = {
    status: data.status,
    externalId: data.externalId ?? undefined,
    accessEnc: data.accessToken ? encryptSecret(data.accessToken) : undefined,
    refreshEnc: data.refreshToken ? encryptSecret(data.refreshToken) : undefined,
    publicKey: data.publicKey ?? undefined,
    livemode: data.livemode ?? false,
    tokenExpiresAt: data.expiresInSec ? new Date(Date.now() + data.expiresInSec * 1000) : undefined,
  };
  return db.paymentAccount.upsert({
    where: { userId_provider: { userId, provider } },
    create: { userId, provider, ...fields },
    update: fields,
  });
}

function secretsOf(a: PaymentAccount): AccountSecrets {
  return { id: a.id, externalId: a.externalId, accessToken: a.accessEnc ? decryptSecret(a.accessEnc) : null, livemode: a.livemode };
}

/** Token do Mercado Pago válido (renova com o refresh_token se estiver perto de expirar). */
async function mpSecrets(a: PaymentAccount): Promise<AccountSecrets> {
  const soon = a.tokenExpiresAt && a.tokenExpiresAt.getTime() - Date.now() < 3 * 24 * 60 * 60 * 1000;
  if (soon && a.refreshEnc) {
    try {
      const t = await mpRefresh(decryptSecret(a.refreshEnc));
      const updated = await saveAccount(a.userId, "mercadopago", {
        status: "ACTIVE",
        externalId: String(t.user_id),
        accessToken: t.access_token,
        refreshToken: t.refresh_token,
        publicKey: t.public_key,
        livemode: t.live_mode ?? a.livemode,
        expiresInSec: t.expires_in,
      });
      return secretsOf(updated);
    } catch (err) {
      logger.warn("mercadopago: refresh falhou", { err: String(err) });
    }
  }
  return secretsOf(a);
}

export async function accountSecretsForWebhook(provider: PaymentProviderId, externalId: string) {
  const a = await db.paymentAccount.findFirst({ where: { provider, externalId } });
  if (!a) return null;
  return provider === "mercadopago" ? mpSecrets(a) : secretsOf(a);
}

// ─── Cobranças ───────────────────────────────────────────────────

const fee = (amountCents: number) => Math.round((amountCents * env().PLATFORM_FEE_PERCENT) / 100);

async function checkoutUrls(slug: string): Promise<CheckoutUrls> {
  const base = await appUrl();
  return { base, success: `${base}/pagar/${slug}?status=sucesso`, pending: `${base}/pagar/${slug}?status=pendente`, failure: `${base}/pagar/${slug}?status=falhou` };
}

/** Gera (ou renova) a URL do checkout hospedado do provedor para uma cobrança. */
export async function ensureCheckout(charge: Charge & { account: PaymentAccount | null }) {
  // Pix direto não tem checkout: o código fica na própria página de pagamento
  if (charge.status !== "PENDING" || charge.provider === "pix") return charge;
  const fresh = charge.checkoutUrl && (!charge.expiresAt || charge.expiresAt.getTime() - Date.now() > 10 * 60 * 1000);
  if (fresh) return charge;

  const urls = await checkoutUrls(charge.slug);
  const payload = {
    id: charge.id,
    slug: charge.slug,
    description: charge.description,
    amountCents: charge.amountCents,
    methods: charge.methods as PayMethod[],
    feeCents: fee(charge.amountCents),
  };
  let result;
  if (charge.provider === "mock") {
    result = { checkoutUrl: `${urls.base}/pagar/${charge.slug}`, externalId: `mock_${charge.slug}`, isTest: true };
  } else if (!charge.account || charge.account.status !== "ACTIVE") {
    throw new UserFacingError("A conta de recebimento dessa cobrança não está mais conectada.");
  } else if (charge.provider === "mercadopago") {
    result = await mpCreateCheckout(await mpSecrets(charge.account), payload, urls);
  } else {
    if (!charge.account.externalId) throw new UserFacingError("Conta Stripe incompleta. Termine o cadastro na Stripe.");
    result = await stripeCreateCheckout(charge.account.externalId, payload, urls);
  }
  return db.charge.update({
    where: { id: charge.id },
    data: { checkoutUrl: result.checkoutUrl, externalId: result.externalId, isTest: result.isTest, expiresAt: "expiresAt" in result ? (result.expiresAt ?? null) : null },
    include: { account: true },
  });
}

type ChargeInput = {
  provider: ChargeProvider;
  amountCents: number;
  description: string;
  methods: PayMethod[];
  leadId?: string | null;
  prototypeId?: string | null;
  /** Pix direto: qual conta (padrão: a principal com chave Pix) */
  bankAccountId?: string | null;
};

async function assertOwnLinks(userId: string, input: ChargeInput) {
  if (input.leadId) {
    const lead = await db.lead.findFirst({ where: { id: input.leadId, userId }, select: { id: true } });
    if (!lead) throw new UserFacingError("Lead não encontrado.");
  }
  if (input.prototypeId) {
    const proto = await db.prototype.findFirst({ where: { id: input.prototypeId, userId }, select: { id: true } });
    if (!proto) throw new UserFacingError("Protótipo não encontrado.");
  }
}

/**
 * Pix direto: o código "copia e cola" sai da chave Pix do próprio usuário, com o valor já
 * preenchido. Sem provedor e sem taxa. Como o Pix estático não avisa quando é pago, quem
 * cobra marca como recebido (confirmPixCharge).
 */
async function createPixCharge(userId: string, input: ChargeInput) {
  const acc = await pixAccountFor(userId, input.bankAccountId);
  if (!acc) throw new UserFacingError("Cadastre uma conta com chave Pix em Financeiro → Contas bancárias.");
  await assertOwnLinks(userId, input);
  const slug = randomSlug(14);
  const charge = await db.charge.create({
    data: {
      userId,
      leadId: input.leadId ?? null,
      prototypeId: input.prototypeId ?? null,
      bankAccountId: acc.id,
      provider: "pix",
      slug,
      description: input.description,
      amountCents: input.amountCents,
      methods: ["pix"],
      pixCode: buildPixCode({ key: acc.key, name: acc.holderName, city: acc.city, amountCents: input.amountCents, txid: slug, description: input.description }),
      checkoutUrl: `${await appUrl()}/pagar/${slug}`,
      isTest: false,
    },
    include: { account: true },
  });
  if (charge.leadId) await logEvent(userId, charge.leadId, "PAYMENT_LINK_CREATED", { chargeId: charge.id, amountCents: charge.amountCents, provider: "pix" });
  await publish({ type: "charge", userId, chargeId: charge.id, status: "PENDING" });
  return charge;
}

/** Quem cobrou confirma que o Pix caiu na conta. Vira venda registrada à mão (sem ranking/nível). */
export async function confirmPixCharge(userId: string, chargeId: string, paidAt?: Date) {
  const charge = await db.charge.findFirst({ where: { id: chargeId, userId }, select: { id: true, provider: true, status: true } });
  if (!charge) throw new UserFacingError("Cobrança não encontrada.");
  if (charge.provider !== "pix") throw new UserFacingError("Só cobranças por Pix direto são confirmadas à mão. As outras o provedor confirma sozinho.");
  if (charge.status !== "PENDING") throw new UserFacingError("Essa cobrança não está mais em aberto.");
  return applyPaymentUpdate(
    { chargeId: charge.id, externalPaymentId: null, status: "PAID", method: "pix", amountCents: null, feeCents: 0, netCents: null, paidAt: paidAt ?? new Date(), isTest: false },
    { chargeId: charge.id },
  );
}

export async function createCharge(userId: string, input: ChargeInput) {
  if (input.provider === "pix") return createPixCharge(userId, input);
  const provider: PaymentProviderId = input.provider;
  if (provider === "mock" && !mockPaymentsEnabled()) throw new UserFacingError("Pagamentos de teste estão desligados nesta instalação.");
  const account =
    provider === "mock"
      ? await saveAccount(userId, "mock", { status: "ACTIVE", externalId: `mock_${userId}` })
      : await db.paymentAccount.findUnique({ where: { userId_provider: { userId, provider } } });
  if (!account || account.status !== "ACTIVE") throw new UserFacingError("Conecte sua conta de recebimento antes de criar a cobrança.");
  await assertOwnLinks(userId, input);

  const charge = await db.charge.create({
    data: {
      userId,
      leadId: input.leadId ?? null,
      prototypeId: input.prototypeId ?? null,
      accountId: account.id,
      provider: input.provider,
      slug: randomSlug(14),
      description: input.description,
      amountCents: input.amountCents,
      methods: input.methods,
      isTest: input.provider === "mock" || !account.livemode,
    },
    include: { account: true },
  });

  try {
    const ready = await ensureCheckout(charge);
    if (charge.leadId) await logEvent(userId, charge.leadId, "PAYMENT_LINK_CREATED", { chargeId: charge.id, amountCents: charge.amountCents });
    await publish({ type: "charge", userId, chargeId: charge.id, status: "PENDING" });
    return ready;
  } catch (err) {
    // Sem checkout, a cobrança não serve pra nada: remove para não poluir o financeiro
    await db.charge.delete({ where: { id: charge.id } });
    if (err instanceof UserFacingError) throw err;
    logger.error("falha ao criar checkout", { err: String(err), provider: input.provider });
    throw new UserFacingError("O provedor de pagamento não respondeu. Tente de novo em instantes.");
  }
}

/**
 * Aplica uma atualização confirmada pelo provedor. Idempotente: repetir o mesmo
 * webhook não duplica venda, pontos nem nível.
 */
export async function applyPaymentUpdate(update: PaymentUpdate, where: { chargeId?: string | null; externalPaymentId?: string | null }) {
  const charge = where.chargeId
    ? await db.charge.findUnique({ where: { id: where.chargeId } })
    : where.externalPaymentId
      ? await db.charge.findFirst({ where: { externalPaymentId: where.externalPaymentId } })
      : null;
  if (!charge) return { applied: false, reason: "charge não encontrada" };

  if (update.status === "PAID") {
    if (charge.status === "PAID") return { applied: false, reason: "já paga" };
    if (update.amountCents !== null && update.amountCents < charge.amountCents) {
      logger.warn("pagamento com valor menor que a cobrança", { chargeId: charge.id, got: update.amountCents, expected: charge.amountCents });
      return { applied: false, reason: "valor divergente" };
    }
    const paidAt = update.paidAt ?? new Date();
    // Pix direto: quem confirma é o próprio vendedor (nenhum provedor viu o dinheiro) → venda
    // registrada à mão: entra no financeiro, mas não vale ponto, ranking nem nível
    const selfDeclared = charge.provider === "pix";
    const points = selfDeclared ? 0 : pointsForSale(charge.amountCents, env().RANKING_MIN_SALE_CENTS);
    const sale = await db.$transaction(async (tx) => {
      // Update condicional: só um processo consegue passar a cobrança para PAID
      const moved = await tx.charge.updateMany({
        where: { id: charge.id, status: { not: "PAID" } },
        data: {
          status: "PAID",
          paidAt,
          paidMethod: update.method,
          feeCents: update.feeCents,
          netCents: update.netCents ?? (update.feeCents !== null ? charge.amountCents - update.feeCents : null),
          externalPaymentId: update.externalPaymentId ?? charge.externalPaymentId,
          isTest: charge.isTest || update.isTest,
        },
      });
      if (moved.count === 0) return null;
      const created = await tx.sale.create({
        data: {
          userId: charge.userId,
          leadId: charge.leadId,
          chargeId: charge.id,
          source: selfDeclared ? "MANUAL" : "PLATFORM",
          verified: !selfDeclared,
          isTest: charge.isTest || update.isTest,
          amountCents: charge.amountCents,
          method: update.method,
          points,
          closedAt: paidAt,
        },
      });
      if (charge.leadId) {
        const lead = await tx.lead.findUnique({ where: { id: charge.leadId }, select: { status: true } });
        if (lead && lead.status !== "WON") {
          await tx.lead.update({ where: { id: charge.leadId }, data: { status: "WON", dealValue: charge.amountCents } });
          await tx.leadEvent.create({ data: { userId: charge.userId, leadId: charge.leadId, type: "STATUS_CHANGED", meta: { from: lead.status, to: "WON", auto: true } } });
        }
        await tx.leadEvent.create({
          data: { userId: charge.userId, leadId: charge.leadId, type: "PAYMENT_RECEIVED", meta: { chargeId: charge.id, amountCents: charge.amountCents, method: update.method } },
        });
      }
      return created;
    });
    if (!sale) return { applied: false, reason: "concorrência" };
    if (selfDeclared) {
      await publish({ type: "sale", userId: charge.userId, amountCents: sale.amountCents, points: 0, verified: false });
      await publish({ type: "charge", userId: charge.userId, chargeId: charge.id, status: "PAID" });
      return { applied: true, sale };
    }
    const { level, gained } = await recomputeLevel(charge.userId);
    await publish({ type: "sale", userId: charge.userId, amountCents: sale.amountCents, points: sale.points, verified: true });
    await publish({ type: "charge", userId: charge.userId, chargeId: charge.id, status: "PAID" });
    logger.info("pagamento confirmado", { chargeId: charge.id, points, level, gained });
    return { applied: true, sale, level, gained };
  }

  if (update.status === "REFUNDED") {
    if (charge.status === "REFUNDED") return { applied: false, reason: "já estornada" };
    await db.$transaction([
      db.charge.update({ where: { id: charge.id }, data: { status: "REFUNDED" } }),
      db.sale.updateMany({ where: { chargeId: charge.id, refundedAt: null }, data: { refundedAt: new Date() } }),
    ]);
    await recomputeLevel(charge.userId);
    await publish({ type: "sale", userId: charge.userId, amountCents: -charge.amountCents, points: 0, verified: true });
    return { applied: true };
  }

  // PENDING/FAILED/EXPIRED/CANCELED: só muda cobranças ainda em aberto
  if (charge.status === "PENDING" && update.status !== "PENDING") {
    await db.charge.update({ where: { id: charge.id }, data: { status: update.status } });
    await publish({ type: "charge", userId: charge.userId, chargeId: charge.id, status: update.status });
    return { applied: true };
  }
  if (update.externalPaymentId && !charge.externalPaymentId) {
    await db.charge.update({ where: { id: charge.id }, data: { externalPaymentId: update.externalPaymentId } });
  }
  return { applied: false, reason: "sem mudança" };
}

/** Venda fechada por fora (dinheiro, transferência). Entra no financeiro; não conta para ranking/nível. */
export async function recordManualSale(userId: string, input: { amountCents: number; leadId?: string | null; note?: string; closedAt?: Date }) {
  if (input.leadId) {
    const lead = await db.lead.findFirst({ where: { id: input.leadId, userId }, select: { id: true, status: true } });
    if (!lead) throw new UserFacingError("Lead não encontrado.");
    if (lead.status !== "WON") {
      await db.lead.update({ where: { id: lead.id }, data: { status: "WON", dealValue: input.amountCents } });
      await logEvent(userId, lead.id, "STATUS_CHANGED", { from: lead.status, to: "WON" });
    }
  }
  const sale = await db.sale.create({
    data: { userId, leadId: input.leadId ?? null, source: "MANUAL", verified: false, amountCents: input.amountCents, note: input.note, closedAt: input.closedAt ?? new Date(), points: 0 },
  });
  if (input.leadId) await logEvent(userId, input.leadId, "SALE_RECORDED", { saleId: sale.id, amountCents: input.amountCents });
  await publish({ type: "sale", userId, amountCents: sale.amountCents, points: 0, verified: false });
  return sale;
}
