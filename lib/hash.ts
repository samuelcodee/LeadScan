import { createHash, randomBytes } from "node:crypto";

/** JSON com chaves ordenadas — mesma entrada, mesmo hash (base de todos os caches). */
export function stableStringify(value: unknown): string {
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(",")}]`;
  const entries = Object.entries(value as Record<string, unknown>)
    .filter(([, v]) => v !== undefined)
    .sort(([a], [b]) => a.localeCompare(b));
  return `{${entries.map(([k, v]) => `${JSON.stringify(k)}:${stableStringify(v)}`).join(",")}}`;
}

export function hashKey(...parts: unknown[]) {
  return createHash("sha256").update(stableStringify(parts)).digest("hex").slice(0, 40);
}

/** ID curto e não adivinhável para links públicos. */
export function randomSlug(length = 10) {
  const alphabet = "abcdefghijkmnpqrstuvwxyz23456789";
  const bytes = randomBytes(length);
  return Array.from(bytes, (b) => alphabet[b % alphabet.length]).join("");
}
