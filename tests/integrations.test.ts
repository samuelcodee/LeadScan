import { createHmac } from "node:crypto";
import { beforeAll, describe, expect, it } from "vitest";

// Variáveis antes de carregar os módulos (env() é lido uma vez e fica em cache)
beforeAll(() => {
  process.env.DATABASE_URL = "postgres://teste";
  process.env.AUTH_SECRET = "segredo-de-teste-com-mais-de-32-caracteres";
  process.env.MP_WEBHOOK_SECRET = "mp-secret";
  process.env.STRIPE_WEBHOOK_SECRET = "whsec_teste";
});

describe("webhooks de pagamento", () => {
  it("Mercado Pago: aceita a assinatura do manifesto e recusa adulteração", async () => {
    const { mpVerifySignature } = await import("@/lib/payments/mercadopago");
    const ts = "1704908010";
    const manifest = `id:123456;request-id:req-1;ts:${ts};`;
    const v1 = createHmac("sha256", "mp-secret").update(manifest).digest("hex");
    expect(mpVerifySignature({ signature: `ts=${ts},v1=${v1}`, requestId: "req-1", dataId: "123456" })).toBe(true);
    expect(mpVerifySignature({ signature: `ts=${ts},v1=${v1}`, requestId: "req-1", dataId: "999" })).toBe(false);
    expect(mpVerifySignature({ signature: null, requestId: "req-1", dataId: "123456" })).toBe(false);
  });

  it("Mercado Pago: status e meio de pagamento normalizados", async () => {
    const { mapMpPayment } = await import("@/lib/payments/mercadopago");
    const u = mapMpPayment({ id: 1, status: "approved", external_reference: "ch_1", payment_method_id: "pix", payment_type_id: "bank_transfer", transaction_amount: 1500, fee_details: [{ amount: 14.85 }], live_mode: true });
    expect(u).toMatchObject({ chargeId: "ch_1", status: "PAID", method: "pix", amountCents: 150000, feeCents: 1485, isTest: false });
    expect(mapMpPayment({ id: 2, status: "refunded", payment_type_id: "credit_card" }).status).toBe("REFUNDED");
  });

  it("Stripe: assinatura t/v1 com tolerância de 5 minutos", async () => {
    const { stripeVerifySignature } = await import("@/lib/payments/stripe");
    const body = JSON.stringify({ id: "evt_1" });
    const t = Math.floor(Date.now() / 1000);
    const sig = createHmac("sha256", "whsec_teste").update(`${t}.${body}`).digest("hex");
    expect(stripeVerifySignature(body, `t=${t},v1=${sig}`)).toBe(true);
    expect(stripeVerifySignature(body + " ", `t=${t},v1=${sig}`)).toBe(false);
    const old = t - 3600;
    const oldSig = createHmac("sha256", "whsec_teste").update(`${old}.${body}`).digest("hex");
    expect(stripeVerifySignature(body, `t=${old},v1=${oldSig}`)).toBe(false);
  });
});

describe("segredos", () => {
  it("criptografa e descriptografa chaves de API; texto cifrado não contém a chave", async () => {
    const { decryptSecret, encryptSecret, last4 } = await import("@/lib/crypto/secrets");
    const key = "sk-ant-api03-exemplo-de-chave-1234";
    const sealed = encryptSecret(key);
    expect(sealed).not.toContain("exemplo");
    expect(decryptSecret(sealed)).toBe(key);
    expect(encryptSecret(key)).not.toBe(sealed); // IV aleatório
    expect(last4(key)).toBe("1234");
    // Adultera um bit de verdade do texto cifrado. (Trocar o último caractere base64 não serve:
    // com 34 bytes, 4 bits dele são enchimento ignorado e às vezes nada muda — teste instável.)
    const parts = sealed.split(".");
    const data = Buffer.from(parts[3], "base64url");
    data[0] ^= 1;
    const tampered = [...parts.slice(0, 3), data.toString("base64url")].join(".");
    expect(() => decryptSecret(tampered)).toThrow();
  });

  it("proxy de fotos só aceita referência assinada", async () => {
    const { photoToken, refFromToken } = await import("@/lib/providers/photos");
    const ref = "places/ChIJabc/photos/AUc7tXYZ";
    expect(refFromToken(photoToken(ref))).toBe(ref);
    const [b64] = photoToken(ref).split(".");
    expect(refFromToken(`${b64}.assinatura-falsa-aaaaaaaaaaaaaaaaaaaaaaaaaaaa`)).toBeNull();
    expect(refFromToken(`${Buffer.from("../../etc/passwd").toString("base64url")}.x`)).toBeNull();
  });
});

describe("IAs e briefing", () => {
  it("links das ferramentas levam o pedido codificado", async () => {
    const { HANDOFF_TOOLS, AI_PROVIDERS } = await import("@/lib/ai/catalog");
    const lovable = HANDOFF_TOOLS.find((t) => t.id === "lovable")!;
    expect(lovable.url("site & café")).toBe("https://lovable.dev/?autosubmit=true#prompt=site%20%26%20caf%C3%A9");
    expect(HANDOFF_TOOLS.find((t) => t.id === "chatgpt")!.url("oi")).toBe("https://chatgpt.com/?q=oi");
    expect(AI_PROVIDERS.map((p) => p.id)).toEqual(expect.arrayContaining(["anthropic", "openai", "gemini", "openrouter", "groq", "deepseek", "mistral", "xai"]));
    // pedidos gigantes são cortados para caber na URL
    expect(lovable.url("x".repeat(20000)).length).toBeLessThan(7000);
  });

  it("briefing usa só dados do protótipo e avisa sobre depoimentos ilustrativos", async () => {
    const { buildSiteSpec } = await import("@/lib/templates/build");
    const { generateMockBusiness } = await import("@/lib/providers/mock");
    const { siteBrief, claudeCodeBrief } = await import("@/lib/templates/brief");
    const b = generateMockBusiness({ category: "dentista", city: "Recife", uf: "PE" }, 1);
    const spec = buildSiteSpec({ id: "x", ...b, category: "dentista", isDemo: true, photos: [] });
    const brief = siteBrief(spec, { base: "https://app.exemplo.com" });
    expect(brief).toContain(spec.business.name);
    expect(brief).toContain("Recife");
    expect(brief).toMatch(/EXEMPLO ilustrativo/);
    expect(brief).not.toMatch(/\{(name|city|bairro)\}/);
    expect(claudeCodeBrief(spec, { base: "https://app.exemplo.com" })).toContain('"templateId"');
  });
});
