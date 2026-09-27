import type { ChargeStatus } from "@/lib/generated/prisma/client";

/**
 * Contrato dos provedores de pagamento. O usuário conecta a PRÓPRIA conta
 * (OAuth / onboarding do provedor) e o dinheiro cai direto nela. A plataforma:
 *  - nunca vê nem guarda dados de cartão (checkout hospedado pelo provedor)
 *  - só confia em status confirmado por webhook assinado ou consulta à API
 *
 * Novo provedor (Asaas, Pagar.me, PagSeguro…): implemente este contrato em
 * lib/payments/<nome>.ts e registre em lib/payments/index.ts.
 */
export type PaymentProviderId = "mock" | "mercadopago" | "stripe";
export type PayMethod = "pix" | "credit_card" | "debit_card";

export const METHOD_LABEL: Record<string, string> = {
  pix: "Pix",
  credit_card: "Cartão de crédito",
  debit_card: "Cartão de débito",
  other: "Outro",
};

export type AccountSecrets = {
  id: string;
  externalId: string | null;
  accessToken: string | null;
  livemode: boolean;
};

export type ChargeForCheckout = {
  id: string;
  slug: string;
  description: string;
  amountCents: number;
  methods: PayMethod[];
  feeCents: number;
};

export type CheckoutUrls = { base: string; success: string; pending: string; failure: string };

export type CheckoutResult = { checkoutUrl: string; externalId: string; isTest: boolean; expiresAt?: Date };

/** Atualização normalizada vinda do provedor (webhook ou consulta). */
export type PaymentUpdate = {
  /** Nosso Charge.id (external_reference / client_reference_id). */
  chargeId: string | null;
  externalPaymentId: string | null;
  status: ChargeStatus;
  method: string | null;
  amountCents: number | null;
  feeCents: number | null;
  netCents: number | null;
  paidAt: Date | null;
  isTest: boolean;
};

export type ProviderInfo = {
  id: PaymentProviderId;
  label: string;
  description: string;
  methods: PayMethod[];
  configured: boolean;
};
