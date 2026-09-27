import { describe, expect, it } from "vitest";
import { buildPixCode, crc16, isValidCnpj, isValidCpf, maskPixKey, normalizeDocument, normalizePixKey } from "@/lib/payments/pix";
import { maskDocument } from "@/lib/payments/banks";

describe("Pix copia e cola (BR Code)", () => {
  // Exemplo do Manual de Padrões para Iniciação do Pix (Banco Central)
  const BCB = "00020126580014br.gov.bcb.pix0136123e4567-e12b-12d1-a456-4266554400005204000053039865802BR5913Fulano de Tal6008BRASILIA62070503***63041D3D";

  it("reproduz o exemplo oficial, CRC incluído", () => {
    expect(crc16(BCB.slice(0, -4))).toBe("1D3D");
    expect(buildPixCode({ key: "123e4567-e12b-12d1-a456-426655440000", name: "Fulano de Tal", city: "BRASILIA" })).toBe(BCB);
  });

  it("valor, cobrança e texto sem acento", () => {
    const code = buildPixCode({ key: "+5585999998888", name: "João Ávila Sites", city: "Fortaleza", amountCents: 150000, txid: "k3j9-x2m1", description: "Site" });
    expect(code).toContain("54071500.00");
    expect(code).toContain("5916Joao Avila Sites");
    expect(code).toContain("0508k3j9x2m1");
    expect(crc16(code.slice(0, -4))).toBe(code.slice(-4));
  });

  it("nome e cidade longos são cortados no limite do padrão", () => {
    const code = buildPixCode({ key: "a@b.co", name: "Agência de Sites e Marketing Digital do Nordeste", city: "São José dos Campos" });
    expect(code).toContain("5925Agencia de Sites e Market");
    expect(code).toContain("6015Sao Jose dos Ca");
  });

  it("descrição nunca estoura o campo 26 (máx. 99)", () => {
    const code = buildPixCode({ key: "123e4567-e12b-12d1-a456-426655440000", name: "X", city: "Y", description: "x".repeat(200) });
    const len = Number(code.slice(code.indexOf("26") + 2, code.indexOf("26") + 4));
    expect(len).toBeLessThanOrEqual(99);
  });
});

describe("chaves e documentos", () => {
  it("CPF e CNPJ com dígito verificador", () => {
    expect(isValidCpf("529.982.247-25")).toBe(true);
    expect(isValidCpf("529.982.247-24")).toBe(false);
    expect(isValidCpf("111.111.111-11")).toBe(false);
    expect(isValidCnpj("11.222.333/0001-81")).toBe(true);
    expect(isValidCnpj("11.222.333/0001-80")).toBe(false);
    expect(normalizeDocument("529.982.247-25")).toBe("52998224725");
    expect(normalizeDocument("123")).toBeNull();
  });

  it("chave no formato que o Pix espera", () => {
    expect(normalizePixKey("telefone", "(85) 99999-8888")).toBe("+5585999998888");
    expect(normalizePixKey("telefone", "+55 85 99999-8888")).toBe("+5585999998888");
    expect(normalizePixKey("telefone", "9999")).toBeNull();
    expect(normalizePixKey("email", " Ana@Email.com ")).toBe("ana@email.com");
    expect(normalizePixKey("email", "ana@")).toBeNull();
    expect(normalizePixKey("cpf", "529.982.247-25")).toBe("52998224725");
    expect(normalizePixKey("aleatoria", "123E4567-E12B-12D1-A456-426655440000")).toBe("123e4567-e12b-12d1-a456-426655440000");
    expect(normalizePixKey("aleatoria", "não é uuid")).toBeNull();
  });

  it("na tela só aparecem os finais", () => {
    expect(maskPixKey("telefone", "+5585999998888")).toBe("(85) •••••-8888");
    expect(maskPixKey("email", "ana@email.com")).toBe("an•••@email.com");
    expect(maskPixKey("cpf", "52998224725")).not.toContain("529982");
    expect(maskDocument("52998224725")).toBe("•••.•••.247-••");
    expect(maskDocument("11222333000181")).toBe("••.•••.333/0001-••");
  });
});
