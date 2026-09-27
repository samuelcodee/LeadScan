import "server-only";

/**
 * Rate limit por janela deslizante, em memória (por processo).
 * Suficiente para uma instância; em produção com várias instâncias,
 * troque a implementação de `store` por Redis/Upstash mantendo a mesma API.
 */
type Bucket = { hits: number[] };
const store = new Map<string, Bucket>();

export const LIMITS = {
  search: { max: 20, windowMs: 60_000 },
  /** progresso da busca em lote (a tela pergunta a cada 1,5–4 s) */
  searchStatus: { max: 90, windowMs: 60_000 },
  ai: { max: 30, windowMs: 60 * 60_000 },
  mutation: { max: 120, windowMs: 60_000 },
  publicView: { max: 60, windowMs: 60_000 },
  /** fotos do Google: uma página de protótipos pode pedir dezenas de uma vez */
  photo: { max: 400, windowMs: 60_000 },
  auth: { max: 12, windowMs: 10 * 60_000 },
  /** tentativas de senha por conta (contra adivinhação de senha de alguém específico) */
  password: { max: 8, windowMs: 15 * 60_000 },
  upload: { max: 20, windowMs: 10 * 60_000 },
  payment: { max: 30, windowMs: 10 * 60_000 },
  webhook: { max: 600, windowMs: 60_000 },
  chat: { max: 60, windowMs: 60_000 },
  chatMedia: { max: 40, windowMs: 10 * 60_000 },
  /** partes de vídeo/áudio grande (um vídeo de 16 MB = 5 partes) */
  chatChunk: { max: 160, windowMs: 10 * 60_000 },
  presence: { max: 20, windowMs: 60_000 },
  /** convites de amizade (o serviço ainda limita por dia) */
  friend: { max: 30, windowMs: 10 * 60_000 },
  /** arquivos (fotos, vídeos e áudios) e partes de envio grande */
  files: { max: 200, windowMs: 10 * 60_000 },
} as const;

export type LimitName = keyof typeof LIMITS;

export function rateLimit(name: LimitName, identity: string) {
  const { max, windowMs } = LIMITS[name];
  const key = `${name}:${identity}`;
  const now = Date.now();
  const bucket = store.get(key) ?? { hits: [] };
  bucket.hits = bucket.hits.filter((t) => now - t < windowMs);
  if (bucket.hits.length >= max) {
    const retryInMs = windowMs - (now - bucket.hits[0]);
    store.set(key, bucket);
    return { ok: false as const, retryInSeconds: Math.ceil(retryInMs / 1000) };
  }
  bucket.hits.push(now);
  store.set(key, bucket);
  // Limpeza preguiçosa para o Map não crescer sem limite.
  if (store.size > 5000) {
    for (const [k, b] of store) if (b.hits.every((t) => now - t > 60 * 60_000)) store.delete(k);
  }
  return { ok: true as const, remaining: max - bucket.hits.length };
}

export class RateLimitError extends Error {
  constructor(public retryInSeconds: number) {
    super(`Muitas requisições. Tente novamente em ${retryInSeconds}s.`);
  }
}

export function assertRateLimit(name: LimitName, identity: string) {
  const r = rateLimit(name, identity);
  if (!r.ok) throw new RateLimitError(r.retryInSeconds);
}
