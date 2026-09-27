import { describe, expect, it, vi } from "vitest";
import { leadLinks } from "@/lib/leads/links";
import { pickPhone } from "@/lib/whatsapp/phone";

vi.mock("server-only", () => ({}));

const base = { isDemo: false, website: null, instagram: null, facebook: null, phone: null, whatsapp: null, mapsUrl: null };

describe("telefone com vários números no mesmo campo", () => {
  it("prefere o celular", () => {
    expect(pickPhone("(85) 3232-3232 / (85) 99999-8888")?.e164).toBe("5585999998888");
    expect(pickPhone("+55 85 3232-3232; +55 85 98888-7777")?.isMobile).toBe(true);
  });
  it("aceita um fixo sozinho e recusa lixo", () => {
    expect(pickPhone("(85) 3232-3232")?.isMobile).toBe(false);
    expect(pickPhone("sem telefone")).toBeNull();
  });
});

describe("links sempre levam a algum lugar", () => {
  const lead = { ...base, name: "Clínica Sorriso", city: "Fortaleza", state: "CE", address: "Rua A, 10", phone: "(85) 8765-4321" };

  it("Maps: busca no Google Maps pelo nome, endereço e cidade", () => {
    const href = leadLinks(lead).maps.href!;
    expect(href.startsWith("https://www.google.com/maps/search/?api=1&query=")).toBe(true);
    expect(decodeURIComponent(href)).toContain("Clínica Sorriso, Rua A, 10, Fortaleza - CE");
  });

  it("Maps: link do OpenStreetMap vira Google Maps; link do Google fica", () => {
    expect(leadLinks({ ...lead, mapsUrl: "https://www.openstreetmap.org/node/1" }).maps.href).toContain("google.com/maps/search");
    expect(leadLinks({ ...lead, mapsUrl: "https://maps.google.com/?cid=123" }).maps.href).toBe("https://maps.google.com/?cid=123");
  });

  it("sem Instagram/site: abre a pesquisa no Google (e diz que não foi encontrado)", () => {
    const l = leadLinks(lead);
    expect(l.instagram.found).toBe(false);
    expect(l.instagram.href).toContain("google.com/search");
    expect(decodeURIComponent(l.instagram.href!)).toContain("Clínica Sorriso Fortaleza - CE instagram");
    expect(l.site.found).toBe(false);
    expect(l.site.href).toContain("google.com/search");
  });

  it("celular antigo (8 dígitos) abre o WhatsApp com o 9 na frente", () => {
    expect(leadLinks(lead).whatsapp.href).toBe("https://wa.me/5585987654321");
  });
});

describe("senha", () => {
  it("guarda com scrypt e confere", async () => {
    const { hashPassword, verifyPassword, passwordProblem } = await import("@/lib/auth/password");
    const h = await hashPassword("uma frase comprida");
    expect(h.startsWith("scrypt$16384$8$1$")).toBe(true);
    expect(h).not.toContain("uma frase");
    expect(await verifyPassword("uma frase comprida", h)).toBe(true);
    expect(await verifyPassword("uma frase comprid", h)).toBe(false);
    expect(await hashPassword("uma frase comprida")).not.toBe(h); // sal aleatório
    expect(passwordProblem("curta")).toMatch(/8 caracteres/);
    expect(passwordProblem("12345678")).toMatch(/fácil/);
    expect(passwordProblem("voce@empresa.com", "voce@empresa.com")).toMatch(/igual/);
    expect(passwordProblem("banana verde azul")).toBeNull();
  });
});
