import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
const { mpCreatePix, MpPixUnavailableError } = await import("@/lib/payments/mercadopago");

const charge = { id: "ch1", slug: "abc", description: "Criação do site", amountCents: 50000, methods: ["pix" as const], feeCents: 0 };
const account = { id: "a1", externalId: "123", accessToken: "TOKEN", livemode: true };

afterEach(() => vi.unstubAllGlobals());

describe("Pix na hora pelo Mercado Pago", () => {
  it("cria o pagamento Pix com a referência da cobrança e devolve o copia e cola", async () => {
    const fetchMock = vi.fn(async () => new Response(JSON.stringify({ id: 999, point_of_interaction: { transaction_data: { qr_code: "000201PIX" } } }), { status: 201 }));
    vi.stubGlobal("fetch", fetchMock);
    const r = await mpCreatePix(account, charge, { base: "https://app.test", payerEmail: "pix-abc@app.test" });
    expect(r.paymentId).toBe("999");
    expect(r.qrCode).toBe("000201PIX");
    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toContain("/v1/payments");
    const body = JSON.parse(String(init.body));
    expect(body).toMatchObject({ transaction_amount: 500, payment_method_id: "pix", external_reference: "ch1", notification_url: "https://app.test/api/webhooks/mercadopago" });
    expect((init.headers as Record<string, string>)["X-Idempotency-Key"]).toBe("pix-ch1");
  });

  it("conta sem Pix no Mercado Pago vira erro próprio (a tela explica o que fazer)", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response('{"message":"Collector user without key enabled for QR render","error":"bad_request"}', { status: 400 })));
    await expect(mpCreatePix(account, charge, { base: "https://app.test", payerEmail: "x@app.test" })).rejects.toBeInstanceOf(MpPixUnavailableError);
  });
});
