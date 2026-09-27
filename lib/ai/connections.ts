import "server-only";
import Anthropic from "@anthropic-ai/sdk";
import { createAnthropicProvider } from "@/lib/ai/anthropic";
import { AI_PROVIDERS, getAiProvider, type AiProviderDef } from "@/lib/ai/catalog";
import { createOpenAICompatibleProvider } from "@/lib/ai/openai-compatible";
import type { AIProvider } from "@/lib/ai/types";
import { UserFacingError } from "@/lib/action";
import { decryptSecret, encryptSecret, last4 } from "@/lib/crypto/secrets";
import { db } from "@/lib/db";
import { isDemoMode } from "@/lib/env";
import { logger } from "@/lib/logger";

/**
 * Conexões de IA do usuário (BYOK — "traga sua chave").
 * A chave é validada numa chamada gratuita (listar modelos), guardada criptografada
 * e nunca volta para o navegador (só os 4 últimos caracteres).
 */
export const localAiAllowed = () => process.env.AI_ALLOW_LOCAL === "true" || isDemoMode();

export function availableProviders(): AiProviderDef[] {
  return AI_PROVIDERS.filter((p) => !p.selfHostedOnly || localAiAllowed());
}

async function validateKey(def: AiProviderDef, key: string) {
  try {
    if (def.protocol === "anthropic") {
      const client = new Anthropic({ apiKey: key, maxRetries: 0, timeout: 15_000 });
      await client.models.list({ limit: 1 });
      return;
    }
    const url = def.id === "gemini" ? "https://generativelanguage.googleapis.com/v1beta/models?pageSize=1" : `${def.baseUrl.replace(/\/$/, "")}/models`;
    const headers: Record<string, string> = def.id === "gemini" ? { "x-goog-api-key": key } : key ? { Authorization: `Bearer ${key}` } : {};
    const res = await fetch(url, { headers, signal: AbortSignal.timeout(15_000), cache: "no-store" });
    if (res.status === 401 || res.status === 403) throw new UserFacingError(`${def.name} recusou a chave. Confira se copiou inteira.`);
    if (!res.ok) throw new UserFacingError(`${def.name} respondeu ${res.status} ao validar a chave.`);
  } catch (err) {
    if (err instanceof UserFacingError) throw err;
    const status = (err as { status?: number }).status;
    if (status === 401 || status === 403) throw new UserFacingError(`${def.name} recusou a chave. Confira se copiou inteira.`);
    logger.warn("validação de chave de IA falhou", { provider: def.id, err: String(err) });
    throw new UserFacingError(def.id === "ollama" ? "Não achamos o Ollama em localhost:11434. Ele está rodando?" : `Não conseguimos falar com ${def.name} agora.`);
  }
}

export async function connectAi(userId: string, input: { provider: string; apiKey: string; model?: string; imageModel?: string }) {
  const def = getAiProvider(input.provider);
  if (!def || (def.selfHostedOnly && !localAiAllowed())) throw new UserFacingError("IA não disponível nesta instalação.");
  const key = input.apiKey.trim();
  if (def.needsKey !== false && key.length < 12) throw new UserFacingError("Cole a chave de API completa.");
  await validateKey(def, key);
  const model = input.model?.trim() || def.defaultModel;
  const data = {
    keyEnc: key ? encryptSecret(key) : null,
    keyLast4: key ? last4(key) : null,
    model,
    imageModel: def.image ? input.imageModel?.trim() || def.image.defaultModel : null,
    status: "ACTIVE" as const,
    lastError: null,
    lastCheckedAt: new Date(),
  };
  await db.aIConnection.upsert({
    where: { userId_provider: { userId, provider: def.id } },
    create: { userId, provider: def.id, ...data },
    update: data,
  });
  // A primeira IA conectada vira a padrão
  const user = await db.user.findUnique({ where: { id: userId }, select: { aiDefault: true } });
  if (!user?.aiDefault) await db.user.update({ where: { id: userId }, data: { aiDefault: def.id } });
}

export async function listConnections(userId: string) {
  return db.aIConnection.findMany({
    where: { userId, status: { not: "DISCONNECTED" } },
    select: { provider: true, keyLast4: true, model: true, imageModel: true, status: true, lastError: true, lastUsedAt: true },
  });
}

type Conn = { provider: string; keyEnc: string | null; model: string | null; baseUrl: string | null };

function toProvider(c: Conn): AIProvider | null {
  const def = getAiProvider(c.provider);
  if (!def) return null;
  const key = c.keyEnc ? decryptSecret(c.keyEnc) : "";
  const model = c.model || def.defaultModel;
  const p =
    def.protocol === "anthropic"
      ? createAnthropicProvider(key, model)
      : createOpenAICompatibleProvider(key, model, c.baseUrl || def.baseUrl, { id: def.id, tokenParam: def.tokenParam, jsonMode: def.jsonMode });
  return { ...p, owner: "user" };
}

/** IA de TEXTO do usuário: a preferida, senão a primeira ativa. */
export async function userTextProvider(userId: string, preferred?: string | null): Promise<AIProvider | null> {
  const conns = await db.aIConnection.findMany({ where: { userId, status: "ACTIVE" }, select: { provider: true, keyEnc: true, model: true, baseUrl: true } });
  if (!conns.length) return null;
  const pick = conns.find((c) => c.provider === preferred) ?? conns[0];
  return toProvider(pick);
}

export async function userImageConnection(userId: string, provider?: string) {
  const conns = await db.aIConnection.findMany({ where: { userId, status: "ACTIVE", provider: { in: ["gemini", "openai"] } } });
  const c = conns.find((x) => x.provider === provider) ?? conns.find((x) => x.provider === "gemini") ?? conns[0];
  if (!c?.keyEnc) return null;
  const def = getAiProvider(c.provider)!;
  return { provider: c.provider as "gemini" | "openai", key: decryptSecret(c.keyEnc), model: c.imageModel || def.image!.defaultModel };
}

export async function markUsed(userId: string, provider: string, error?: string) {
  await db.aIConnection
    .update({
      where: { userId_provider: { userId, provider } },
      data: error ? { lastError: error.slice(0, 200), lastUsedAt: new Date() } : { lastUsedAt: new Date(), lastError: null },
    })
    .catch(() => {});
}
