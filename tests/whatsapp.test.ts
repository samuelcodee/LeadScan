import { describe, expect, it } from "vitest";
import { normalizeBrazilPhone, whatsappAvailability } from "@/lib/whatsapp/phone";
import { buildWhatsAppLink, leadWhatsAppLink } from "@/lib/whatsapp/link";

describe("normalizeBrazilPhone", () => {
  it.each([
    ["(85) 99999-8888", "5585999998888", true],
    ["+55 85 99999-8888", "5585999998888", true],
    ["085 3234-5678", "558532345678", false],
    ["11 3456-7890", "551134567890", false],
    ["0xx21 98765-4321", "5521987654321", true],
    // celular antigo, sem o 9 (comum em cadastros velhos)
    ["(85) 8765-4321", "5585987654321", true],
  ])("%s", (raw, e164, mobile) => {
    const p = normalizeBrazilPhone(raw);
    expect(p?.e164).toBe(e164);
    expect(p?.isMobile).toBe(mobile);
  });

  it.each(["123", "(20) 99999-8888", "(85) 89999-8888", "", null])("rejeita %s", (raw) => {
    expect(normalizeBrazilPhone(raw)).toBeNull();
  });

  it("formata no padrão nacional", () => {
    expect(normalizeBrazilPhone("5585999998888")?.national).toBe("(85) 99999-8888");
  });
});

describe("WhatsApp", () => {
  it("não inventa WhatsApp: fixo é 'unknown', celular é 'likely'", () => {
    expect(whatsappAvailability({ phone: "558532345678" })).toBe("unknown");
    expect(whatsappAvailability({ phone: "5585999998888" })).toBe("likely");
    expect(whatsappAvailability({ whatsapp: "5585999998888" })).toBe("confirmed");
    expect(whatsappAvailability({})).toBe("none");
  });

  it("gera link wa.me com mensagem codificada", () => {
    expect(buildWhatsAppLink("5585999998888", "Olá, tudo bem?")).toBe(
      "https://wa.me/5585999998888?text=Ol%C3%A1%2C%20tudo%20bem%3F",
    );
  });

  it("lead DEMO nunca abre conversa com número (pode ser de alguém real)", () => {
    expect(leadWhatsAppLink({ phone: "5585999998888", isDemo: true }, "oi")).toBe("https://wa.me/?text=oi");
  });
});
