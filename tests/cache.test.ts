import { beforeEach, describe, expect, it, vi } from "vitest";

// Banco falso: só o ProviderCache
const rows = new Map<string, { key: string; payload: unknown; expiresAt: Date }>();
vi.mock("@/lib/db", () => ({
  db: {
    providerCache: {
      findUnique: async ({ where }: { where: { key: string } }) => rows.get(where.key) ?? null,
      upsert: async ({ where, create }: { where: { key: string }; create: { key: string; payload: unknown; expiresAt: Date } }) => rows.set(where.key, create),
      deleteMany: async () => ({ count: 0 }),
    },
  },
}));

const { cachedProviderCall } = await import("@/lib/providers/cache");
const DAY = 24 * 60 * 60 * 1000;

beforeEach(() => rows.clear());

describe("cache das fontes", () => {
  it("dentro da validade não consulta a fonte de novo", async () => {
    const fn = vi.fn(async () => ["a"]);
    await cachedProviderCall("k", "osm", DAY, fn);
    expect(await cachedProviderCall("k", "osm", DAY, fn)).toEqual(["a"]);
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it("fonte fora do ar: usa a resposta vencida em vez de falhar", async () => {
    rows.set("k", { key: "k", payload: ["antiga"], expiresAt: new Date(Date.now() - DAY) });
    const down = vi.fn(async () => {
      throw new Error("504");
    });
    expect(await cachedProviderCall("k", "osm", DAY, down)).toEqual(["antiga"]);
  });

  it("sem nada guardado, o erro chega a quem chamou", async () => {
    await expect(cachedProviderCall("novo", "osm", DAY, async () => Promise.reject(new Error("504")))).rejects.toThrow("504");
  });
});
