import { randomBytes } from "node:crypto";
import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
const { keyFromSetting } = await import("@/lib/crypto/secrets");

describe("ENCRYPTION_KEY em qualquer formato colado", () => {
  const raw = randomBytes(32);
  it("base64 de 32 bytes vale como está (compatível com o que já foi gravado)", () => {
    expect(keyFromSetting(raw.toString("base64"), "x").key.equals(raw)).toBe(true);
    expect(keyFromSetting(raw.toString("base64url"), "x").key.equals(raw)).toBe(true);
  });
  it("hex de 64 caracteres vira os 32 bytes", () => {
    const k = keyFromSetting(raw.toString("hex"), "x");
    expect(k.source).toBe("hex");
    expect(k.key.equals(raw)).toBe(true);
  });
  it("outro texto forte vira chave derivada de 32 bytes; vazio usa o AUTH_SECRET", () => {
    const d = keyFromSetting("uma frase secreta qualquer 123", "x");
    expect(d.source).toBe("derivada");
    expect(d.key.length).toBe(32);
    const a = keyFromSetting("", "auth-secret-bem-longo");
    expect(a.source).toBe("auth");
    expect(a.key.length).toBe(32);
  });
});
