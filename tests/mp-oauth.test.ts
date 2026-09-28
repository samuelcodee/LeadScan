import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
const { classifyOAuth } = await import("@/lib/payments/mercadopago");

describe("erros do OAuth do Mercado Pago", () => {
  it("separa a causa para a tela explicar o que ajustar", () => {
    // resposta real do MP com segredo errado
    expect(classifyOAuth(400, { error: "invalid_client", message: "invalid client_id or client_secret" })).toBe("credenciais");
    expect(classifyOAuth(401, {})).toBe("credenciais");
    expect(classifyOAuth(400, { error: "invalid_grant", message: "redirect_uri mismatch" })).toBe("redirect");
    expect(classifyOAuth(400, { error: "invalid_grant", message: "invalid authorization code" })).toBe("codigo");
    expect(classifyOAuth(500, { message: "internal" })).toBe("outro");
  });
});
