import { describe, expect, it } from "vitest";
import { presenceOf } from "@/lib/chat/presence";
import { parseSearchQuery } from "@/lib/domain/query-parser";
import { regionCities } from "@/lib/domain/regions";
import { DEFAULT_FILTERS, filtersToParams } from "@/lib/domain/filters";
import { filtersFromParams } from "@/lib/domain/search";
import { badgeKeyFor } from "@/lib/gamification/levels";
import { leadDedupeKey } from "@/lib/leads/dedupe";
import { sniffAv } from "@/lib/media/sniff";

describe("presença (online / inativo / offline)", () => {
  const now = Date.parse("2026-09-27T12:00:00Z");
  const ago = (min: number) => new Date(now - min * 60_000);

  it("online nos primeiros 2 minutos", () => {
    expect(presenceOf(ago(1), true, now)).toEqual({ state: "online", label: "Online" });
  });
  it("inativo mostra há quantos minutos", () => {
    expect(presenceOf(ago(12), true, now)).toEqual({ state: "idle", label: "Inativo há 12 min" });
  });
  it("offline depois de 30 minutos ou sem sinal", () => {
    expect(presenceOf(ago(45), true, now).state).toBe("offline");
    expect(presenceOf(null, true, now).state).toBe("offline");
  });
  it("status oculto não revela nada", () => {
    expect(presenceOf(ago(1), false, now)).toEqual({ state: "hidden", label: null });
  });
});

describe("chave de mesma empresa", () => {
  it("ignora acento, caixa e pontuação", () => {
    expect(leadDedupeKey("Clínica Bella Estética!", "Fortaleza", "ce")).toBe(leadDedupeKey("clinica bella  estetica", "FORTALEZA", "CE"));
  });
  it("mesma empresa em outra cidade é outra chave", () => {
    expect(leadDedupeKey("Box Movimento", "Fortaleza", "CE")).not.toBe(leadDedupeKey("Box Movimento", "Sobral", "CE"));
  });
});

describe("busca geral: cidades percorridas", () => {
  it("com UF, só cidades daquele estado, maiores primeiro", () => {
    const list = regionCities("CE", "busca-1", 12);
    expect(list).toHaveLength(12);
    expect(list.every((c) => c.uf === "CE")).toBe(true);
    expect(["Fortaleza", "Caucaia", "Maracanaú", "Juazeiro do Norte", "Sobral"]).toContain(list[0].name);
  });
  it("sem UF, mistura estados do Brasil inteiro", () => {
    const list = regionCities(undefined, "busca-2", 30);
    expect(new Set(list.map((c) => c.uf)).size).toBeGreaterThan(8);
  });
  it("buscas diferentes percorrem em ordens diferentes, a mesma busca repete a ordem", () => {
    expect(regionCities("SP", "a", 5)).toEqual(regionCities("SP", "a", 5));
    expect(regionCities(undefined, "a", 10)).not.toEqual(regionCities(undefined, "b", 10));
  });
});

describe("parser: busca no Brasil inteiro", () => {
  it("'no Brasil' vira busca geral sem cidade", () => {
    const r = parseSearchQuery("dentistas no Brasil");
    expect(r.categories).toEqual(["dentista"]);
    expect(r.nationwide).toBe(true);
    expect(r.city).toBeUndefined();
    expect(r.freeCity).toBeUndefined();
  });
  it("estado sem cidade fica só com a UF", () => {
    const r = parseSearchQuery("academias no Ceará");
    expect(r.uf).toBe("CE");
    expect(r.city).toBeUndefined();
  });
});

describe("filtros (módulo do navegador, sem zod)", () => {
  it("ida e volta pela URL", () => {
    const f = { ...DEFAULT_FILTERS, website: "without" as const, minReviews: 50 };
    const params = filtersToParams(f);
    expect(filtersFromParams(Object.fromEntries(params))).toEqual(f);
  });
});

describe("tipo real de áudio e vídeo", () => {
  const withHead = (bytes: number[], ascii = "") => Buffer.concat([Buffer.from(bytes), Buffer.from(ascii, "latin1"), Buffer.alloc(16)]);
  it("reconhece WebM, MP4, OGG, MP3 e WAV", () => {
    expect(sniffAv(withHead([0x1a, 0x45, 0xdf, 0xa3]), "audio")).toBe("audio/webm");
    expect(sniffAv(withHead([0, 0, 0, 0x20], "ftypisom"), "video")).toBe("video/mp4");
    expect(sniffAv(withHead([0, 0, 0, 0x14], "ftypqt  "), "video")).toBe("video/quicktime");
    expect(sniffAv(withHead([], "OggS"), "audio")).toBe("audio/ogg");
    expect(sniffAv(withHead([], "ID3"), "audio")).toBe("audio/mpeg");
    expect(sniffAv(withHead([], "RIFF\u0000\u0000\u0000\u0000WAVE"), "audio")).toBe("audio/wav");
  });
  it("recusa o que não é mídia (ex.: HTML ou executável renomeado)", () => {
    expect(sniffAv(withHead([], "<!doctype html>"), "video")).toBeNull();
    expect(sniffAv(withHead([0x4d, 0x5a]), "audio")).toBeNull();
    expect(sniffAv(withHead([], "OggS"), "video")).toBeNull();
  });
});

describe("selo ao lado da foto", () => {
  it("usa o título escolhido quando ainda vale", () => {
    expect(badgeKeyFor("month-champion", 3)).toBe("month-champion");
    expect(badgeKeyFor("level-2", 5)).toBe("level-2");
  });
  it("cai para o nível atual se o título não vale mais", () => {
    expect(badgeKeyFor("level-9", 4)).toBe("level-4");
  });
  it("sem venda, sem selo", () => {
    expect(badgeKeyFor(null, 0)).toBeNull();
  });
});
