/**
 * Bancos mais usados (código COMPE de 3 dígitos). Banco fora da lista: "Outro" com código e
 * nome digitados. Fonte: lista de participantes do STR/Pix do Banco Central.
 */
export const BANKS: { code: string; name: string }[] = [
  { code: "001", name: "Banco do Brasil" },
  { code: "104", name: "Caixa Econômica Federal" },
  { code: "237", name: "Bradesco" },
  { code: "341", name: "Itaú Unibanco" },
  { code: "033", name: "Santander" },
  { code: "260", name: "Nubank" },
  { code: "077", name: "Banco Inter" },
  { code: "336", name: "C6 Bank" },
  { code: "290", name: "PagBank (PagSeguro)" },
  { code: "323", name: "Mercado Pago" },
  { code: "380", name: "PicPay" },
  { code: "403", name: "Cora" },
  { code: "197", name: "Stone" },
  { code: "364", name: "Efí (Gerencianet)" },
  { code: "212", name: "Banco Original" },
  { code: "208", name: "BTG Pactual" },
  { code: "102", name: "XP Investimentos" },
  { code: "655", name: "Banco BV" },
  { code: "623", name: "Banco Pan" },
  { code: "422", name: "Banco Safra" },
  { code: "318", name: "Banco BMG" },
  { code: "756", name: "Sicoob" },
  { code: "748", name: "Sicredi" },
  { code: "133", name: "Cresol" },
  { code: "136", name: "Unicred" },
  { code: "085", name: "Ailos" },
  { code: "041", name: "Banrisul" },
  { code: "004", name: "Banco do Nordeste" },
  { code: "070", name: "BRB" },
  { code: "037", name: "Banpará" },
  { code: "047", name: "Banese" },
  { code: "021", name: "Banestes" },
  { code: "389", name: "Banco Mercantil do Brasil" },
];

export const ACCOUNT_TYPES = {
  corrente: "Conta corrente",
  poupanca: "Poupança",
  pagamento: "Conta de pagamento",
} as const;
export type AccountType = keyof typeof ACCOUNT_TYPES;

export function bankName(code: string) {
  return BANKS.find((b) => b.code === code)?.name ?? null;
}

/** "12.345.678/0001-90" → "••.•••.678/0001-••"; CPF → "•••.•••.789-••". Nunca o número inteiro. */
export function maskDocument(doc: string) {
  if (doc.length === 14) return `••.•••.${doc.slice(5, 8)}/${doc.slice(8, 12)}-••`;
  return `•••.•••.${doc.slice(6, 9)}-••`;
}
