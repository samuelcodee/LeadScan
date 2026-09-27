/**
 * Pix "copia e cola" (BR Code estático) — padrão EMV do Banco Central, gerado por código,
 * sem provedor e sem taxa: o dinheiro cai direto na conta dona da chave.
 * Manual: "Manual de Padrões para Iniciação do Pix" (BCB), seção do BR Code.
 *
 * Pix estático não avisa ninguém quando é pago: quem cobra confere no banco e marca como
 * recebido (a venda entra como registrada à mão — não conta para ranking nem nível).
 */

export type PixKeyType = "cpf" | "cnpj" | "email" | "telefone" | "aleatoria";

export const PIX_KEY_LABEL: Record<PixKeyType, string> = {
  cpf: "CPF",
  cnpj: "CNPJ",
  email: "E-mail",
  telefone: "Celular",
  aleatoria: "Chave aleatória",
};

const digits = (s: string) => s.replace(/\D/g, "");

function checkDigit(nums: number[], weights: number[]) {
  const sum = nums.reduce((acc, n, i) => acc + n * weights[i], 0);
  const r = sum % 11;
  return r < 2 ? 0 : 11 - r;
}

export function isValidCpf(raw: string) {
  const d = digits(raw);
  if (d.length !== 11 || /^(\d)\1+$/.test(d)) return false;
  const n = d.split("").map(Number);
  const d1 = checkDigit(n.slice(0, 9), [10, 9, 8, 7, 6, 5, 4, 3, 2]);
  const d2 = checkDigit(n.slice(0, 10), [11, 10, 9, 8, 7, 6, 5, 4, 3, 2]);
  return d1 === n[9] && d2 === n[10];
}

export function isValidCnpj(raw: string) {
  const d = digits(raw);
  if (d.length !== 14 || /^(\d)\1+$/.test(d)) return false;
  const n = d.split("").map(Number);
  const d1 = checkDigit(n.slice(0, 12), [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]);
  const d2 = checkDigit(n.slice(0, 13), [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]);
  return d1 === n[12] && d2 === n[13];
}

/** CPF ou CNPJ válido → só dígitos; senão null. */
export function normalizeDocument(raw: string) {
  const d = digits(raw);
  if (d.length === 11) return isValidCpf(d) ? d : null;
  if (d.length === 14) return isValidCnpj(d) ? d : null;
  return null;
}

/**
 * Chave no formato que o Pix espera: CPF/CNPJ só dígitos, e-mail minúsculo,
 * celular como +55DDNÚMERO, aleatória (EVP) como UUID minúsculo. Inválida → null.
 */
export function normalizePixKey(type: PixKeyType, raw: string): string | null {
  const v = raw.trim();
  switch (type) {
    case "cpf":
      return isValidCpf(v) ? digits(v) : null;
    case "cnpj":
      return isValidCnpj(v) ? digits(v) : null;
    case "email": {
      const e = v.toLowerCase();
      return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(e) && e.length <= 77 ? e : null;
    }
    case "telefone": {
      let d = digits(v);
      if (d.length === 13 && d.startsWith("55")) d = d.slice(2);
      // DDD + 9 dígitos (celular) ou 8 (fixo)
      return /^[1-9]{2}\d{8,9}$/.test(d) ? `+55${d}` : null;
    }
    case "aleatoria": {
      const u = v.toLowerCase();
      return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/.test(u) ? u : null;
    }
  }
}

/** Para mostrar sem expor a chave inteira: "•••.456.789-••", "an•••@gmail.com". */
export function maskPixKey(type: PixKeyType, key: string) {
  if (type === "email") {
    const [user, domain] = key.split("@");
    return `${user.slice(0, 2)}•••@${domain}`;
  }
  if (type === "aleatoria") return `${key.slice(0, 4)}••••-••••${key.slice(-4)}`;
  if (type === "telefone") return `(${key.slice(3, 5)}) •••••-${key.slice(-4)}`;
  return `•••${key.slice(-4)}`;
}

/** Texto aceito no BR Code: sem acento e só caracteres simples. */
function plain(s: string, max: number) {
  return s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^A-Za-z0-9 .,\-/]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, max);
}

const field = (id: string, value: string) => `${id}${String(value.length).padStart(2, "0")}${value}`;

/** CRC16/CCITT-FALSE (polinômio 0x1021, início 0xFFFF), como pede o BR Code. */
export function crc16(payload: string) {
  let crc = 0xffff;
  for (const byte of new TextEncoder().encode(payload)) {
    crc ^= byte << 8;
    for (let i = 0; i < 8; i++) crc = crc & 0x8000 ? ((crc << 1) ^ 0x1021) & 0xffff : (crc << 1) & 0xffff;
  }
  return crc.toString(16).toUpperCase().padStart(4, "0");
}

export type PixCodeInput = {
  /** Chave já normalizada (normalizePixKey) */
  key: string;
  /** Nome de quem recebe (até 25 caracteres) */
  name: string;
  /** Cidade de quem recebe (até 15 caracteres) */
  city: string;
  /** Valor em centavos; sem valor = quem paga digita */
  amountCents?: number | null;
  /** Identificador da cobrança (até 25, letras e números); sem ele vai "***" */
  txid?: string | null;
  /** Texto curto que alguns bancos mostram para quem paga */
  description?: string | null;
};

export function buildPixCode(p: PixCodeInput) {
  const gui = field("00", "br.gov.bcb.pix") + field("01", p.key);
  // A conta do campo 26 não pode passar de 99 caracteres: a descrição usa o que sobrar
  const room = 99 - gui.length - 4;
  const desc = p.description ? plain(p.description, Math.max(0, room)) : "";
  const account = gui + (desc ? field("02", desc) : "");
  const txid = (p.txid ?? "").replace(/[^A-Za-z0-9]/g, "").slice(0, 25) || "***";
  const amount = p.amountCents ? (p.amountCents / 100).toFixed(2) : null;
  const body =
    field("00", "01") +
    field("26", account) +
    field("52", "0000") +
    field("53", "986") +
    (amount ? field("54", amount) : "") +
    field("58", "BR") +
    field("59", plain(p.name, 25) || "RECEBEDOR") +
    field("60", plain(p.city, 15) || "BRASIL") +
    field("62", field("05", txid)) +
    "6304";
  return body + crc16(body);
}
