import "server-only";
import { UserFacingError } from "@/lib/action";
import { decryptSecret, encryptSecret } from "@/lib/crypto/secrets";
import { db } from "@/lib/db";
import { bankName, maskDocument, type AccountType } from "@/lib/payments/banks";
import { maskPixKey, normalizeDocument, normalizePixKey, type PixKeyType } from "@/lib/payments/pix";

/**
 * Contas bancárias do usuário. Conta, CPF/CNPJ e chave Pix ficam criptografados no banco
 * (AES-256-GCM); a tela só recebe os finais. A chave Pix da conta principal recebe as
 * cobranças "Pix direto" — sem provedor e sem taxa.
 */
const MAX_ACCOUNTS = 5;

export type BankAccountInput = {
  bankCode: string;
  bankName?: string;
  branch?: string;
  account?: string;
  accountType: AccountType;
  holderName: string;
  document: string;
  city: string;
  pixKeyType?: PixKeyType | null;
  pixKey?: string | null;
};

const PUBLIC = {
  id: true,
  bankCode: true,
  bankName: true,
  branch: true,
  accountLast4: true,
  accountType: true,
  holderName: true,
  city: true,
  documentHint: true,
  pixKeyType: true,
  pixKeyHint: true,
  isDefault: true,
  createdAt: true,
} as const;

export async function listBankAccounts(userId: string) {
  return db.bankAccount.findMany({ where: { userId }, orderBy: [{ isDefault: "desc" }, { createdAt: "asc" }], select: PUBLIC });
}
export type BankAccountView = Awaited<ReturnType<typeof listBankAccounts>>[number];

export async function saveBankAccount(userId: string, input: BankAccountInput) {
  const name = bankName(input.bankCode) ?? input.bankName?.trim();
  if (!/^\d{3}$/.test(input.bankCode) || !name) throw new UserFacingError("Escolha o banco (ou digite o código de 3 dígitos e o nome).");
  const document = normalizeDocument(input.document);
  if (!document) throw new UserFacingError("CPF ou CNPJ do titular inválido.");
  const branch = (input.branch ?? "").replace(/[^\dXx-]/g, "").slice(0, 8);
  const account = (input.account ?? "").replace(/[^\dXx-]/g, "").slice(0, 20);
  if ((branch && !account) || (!branch && account)) throw new UserFacingError("Preencha agência e conta juntas (ou deixe as duas em branco e use só o Pix).");
  let pixKey: string | null = null;
  if (input.pixKeyType && input.pixKey?.trim()) {
    pixKey = normalizePixKey(input.pixKeyType, input.pixKey);
    if (!pixKey) throw new UserFacingError("Chave Pix inválida para o tipo escolhido.");
  }
  if (!account && !pixKey) throw new UserFacingError("Informe agência e conta, ou uma chave Pix.");
  const city = input.city.trim();
  if (city.length < 2) throw new UserFacingError("Informe a cidade do titular (vai no código Pix).");

  const count = await db.bankAccount.count({ where: { userId } });
  if (count >= MAX_ACCOUNTS) throw new UserFacingError(`Limite de ${MAX_ACCOUNTS} contas. Remova uma para adicionar outra.`);

  return db.bankAccount.create({
    data: {
      userId,
      bankCode: input.bankCode,
      bankName: name.slice(0, 60),
      branch,
      accountEnc: encryptSecret(account),
      accountLast4: account.replace(/\D/g, "").slice(-4),
      accountType: input.accountType,
      holderName: input.holderName.trim().slice(0, 80),
      city: city.slice(0, 40),
      documentEnc: encryptSecret(document),
      documentHint: maskDocument(document),
      pixKeyType: pixKey ? input.pixKeyType : null,
      pixKeyEnc: pixKey ? encryptSecret(pixKey) : null,
      pixKeyHint: pixKey && input.pixKeyType ? maskPixKey(input.pixKeyType, pixKey) : null,
      // A primeira conta vira a principal
      isDefault: count === 0,
    },
    select: PUBLIC,
  });
}

export async function setDefaultBankAccount(userId: string, id: string) {
  const acc = await db.bankAccount.findFirst({ where: { id, userId }, select: { id: true } });
  if (!acc) throw new UserFacingError("Conta não encontrada.");
  await db.$transaction([
    db.bankAccount.updateMany({ where: { userId, isDefault: true }, data: { isDefault: false } }),
    db.bankAccount.update({ where: { id }, data: { isDefault: true } }),
  ]);
}

export async function deleteBankAccount(userId: string, id: string) {
  const acc = await db.bankAccount.findFirst({ where: { id, userId }, select: { isDefault: true } });
  if (!acc) throw new UserFacingError("Conta não encontrada.");
  // Cobranças Pix já criadas continuam com o código delas (a chave está no próprio código)
  await db.bankAccount.delete({ where: { id } });
  if (acc.isDefault) {
    const next = await db.bankAccount.findFirst({ where: { userId }, orderBy: { createdAt: "asc" }, select: { id: true } });
    if (next) await db.bankAccount.update({ where: { id: next.id }, data: { isDefault: true } });
  }
}

/** Conta com chave Pix para cobrar (a escolhida ou a principal). A chave sai decifrada só aqui. */
export async function pixAccountFor(userId: string, id?: string | null) {
  const acc = await db.bankAccount.findFirst({
    where: { userId, pixKeyEnc: { not: null }, ...(id ? { id } : {}) },
    orderBy: [{ isDefault: "desc" }, { createdAt: "asc" }],
  });
  if (!acc?.pixKeyEnc) return null;
  return { id: acc.id, bankName: acc.bankName, holderName: acc.holderName, city: acc.city, key: decryptSecret(acc.pixKeyEnc) };
}
