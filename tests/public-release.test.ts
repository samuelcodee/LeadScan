import { afterEach, describe, expect, it, vi } from "vitest";

/** env() guarda o resultado: cada caso importa o módulo do zero com as variáveis do cenário. */
async function load(vars: Record<string, string | undefined>) {
  vi.resetModules();
  for (const [k, v] of Object.entries({ DATABASE_URL: "postgres://x", AUTH_SECRET: "x".repeat(32), ...vars })) vi.stubEnv(k, v);
  const envMod = await import("@/lib/env");
  const messaging = await import("@/lib/messaging");
  return { ...envMod, ...messaging };
}

afterEach(() => vi.unstubAllEnvs());

describe("versão pública", () => {
  it("produção sem AUTH_MODE abre só contas reais (sem demonstração nem pagamento de teste)", async () => {
    const m = await load({ NODE_ENV: "production", AUTH_MODE: "" });
    expect(m.isDemoMode()).toBe(false);
    expect(m.mockPaymentsEnabled()).toBe(false);
  });

  it("desenvolvimento sem AUTH_MODE continua com a demonstração", async () => {
    const m = await load({ NODE_ENV: "development", AUTH_MODE: "" });
    expect(m.isDemoMode()).toBe(true);
  });

  it("AUTH_MODE explícito vale nos dois ambientes", async () => {
    expect((await load({ NODE_ENV: "production", AUTH_MODE: "demo" })).isDemoMode()).toBe(true);
    expect((await load({ NODE_ENV: "development", AUTH_MODE: "public" })).isDemoMode()).toBe(false);
  });

  it("em produção só aparecem canais de código com provedor configurado", async () => {
    const none = await load({ NODE_ENV: "production", RESEND_API_KEY: "", TWILIO_ACCOUNT_SID: "" });
    expect(none.loginChannels()).toEqual({ email: false, sms: false });
    const email = await load({ NODE_ENV: "production", RESEND_API_KEY: "re_x", TWILIO_ACCOUNT_SID: "" });
    expect(email.loginChannels()).toEqual({ email: true, sms: false });
    const dev = await load({ NODE_ENV: "development", RESEND_API_KEY: "" });
    expect(dev.loginChannels()).toEqual({ email: true, sms: true });
  });
});

describe("variáveis coladas no painel", () => {
  it("limpa espaço, quebra de linha e aspas em volta", async () => {
    const m = await load({ NODE_ENV: "production", AUTH_GOOGLE_ID: ' "123-abc.apps.googleusercontent.com"\n', AUTH_GOOGLE_SECRET: "GOCSPX-x \n" });
    expect(m.env().AUTH_GOOGLE_ID).toBe("123-abc.apps.googleusercontent.com");
    expect(m.env().AUTH_GOOGLE_SECRET).toBe("GOCSPX-x");
    expect(m.cleanValue("  ")).toBe("");
    expect(m.cleanValue("a\"b")).toBe("a\"b");
  });
});
