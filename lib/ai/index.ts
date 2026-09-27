import "server-only";
import { createAnthropicProvider } from "@/lib/ai/anthropic";
import { markUsed, userTextProvider } from "@/lib/ai/connections";
import { createOpenAICompatibleProvider } from "@/lib/ai/openai-compatible";
import { AIUnavailableError, type AIProvider, type AIRequest } from "@/lib/ai/types";
import { db } from "@/lib/db";
import { env } from "@/lib/env";
import { hashKey } from "@/lib/hash";
import type { Prisma } from "@/lib/generated/prisma/client";
import { logger } from "@/lib/logger";

const DEFAULT_MODEL = { anthropic: "claude-opus-5", openai: "gpt-4o-mini" } as const;

let platform: AIProvider | null | undefined;

/** IA da instalação (.env) — usada quando o usuário não conectou a própria. */
function platformAI(): AIProvider | null {
  if (platform !== undefined) return platform;
  const e = env();
  if (e.AI_PROVIDER === "none" || !e.AI_API_KEY) return (platform = null);
  const model = e.AI_MODEL || DEFAULT_MODEL[e.AI_PROVIDER];
  platform =
    e.AI_PROVIDER === "anthropic"
      ? createAnthropicProvider(e.AI_API_KEY, model)
      : createOpenAICompatibleProvider(e.AI_API_KEY, model, e.AI_BASE_URL || "https://api.openai.com/v1");
  platform = { ...platform, owner: "platform" };
  return platform;
}

/**
 * IA para um usuário: a conta que ELE conectou (Integrações) tem prioridade;
 * sem conexão, cai na IA da plataforma; sem nenhuma, null (o app segue 100% com templates).
 */
export async function getAI(userId?: string, preferred?: string | null): Promise<AIProvider | null> {
  if (userId) {
    const own = await userTextProvider(userId, preferred);
    if (own) return own;
  }
  return platformAI();
}

export async function isAIEnabled(userId?: string) {
  return (await getAI(userId)) !== null;
}

/**
 * Executa uma tarefa de IA com cache no banco.
 * A chave inclui tarefa + versão do prompt + modelo + contexto: mesma entrada = zero tokens.
 * `force` ignora o cache (botão "variar" explícito do usuário).
 */
export async function cachedGenerate<T>(opts: {
  kind: string;
  promptVersion: number;
  context: unknown;
  request: AIRequest<T>;
  force?: boolean;
  userId?: string;
  provider?: string | null;
}): Promise<{ data: T; cached: boolean }> {
  const ai = await getAI(opts.userId, opts.provider);
  if (!ai) throw new AIUnavailableError();
  const baseKey = hashKey("ai", opts.kind, opts.promptVersion, ai.id, ai.model, opts.context);

  if (!opts.force) {
    const hit = await db.aICache.findUnique({ where: { key: baseKey } });
    if (hit) {
      const parsed = opts.request.schema.safeParse(hit.response);
      if (parsed.success) {
        await db.aICache.update({ where: { key: baseKey }, data: { hits: { increment: 1 } } }).catch(() => {});
        return { data: parsed.data, cached: true };
      }
    }
  }

  const started = Date.now();
  let result;
  try {
    result = await ai.generate(opts.request);
    if (ai.owner === "user" && opts.userId) await markUsed(opts.userId, ai.id);
  } catch (err) {
    if (ai.owner === "user" && opts.userId) await markUsed(opts.userId, ai.id, err instanceof Error ? err.message : String(err));
    throw err;
  }
  logger.info("ai.generate", {
    kind: opts.kind,
    model: result.model,
    inputTokens: result.inputTokens,
    outputTokens: result.outputTokens,
    ms: Date.now() - started,
  });
  const row = {
    kind: opts.kind,
    model: result.model,
    response: result.data as unknown as Prisma.InputJsonValue,
    inputTokens: result.inputTokens,
    outputTokens: result.outputTokens,
  };
  // A versão "variada" substitui a entrada principal: a próxima leitura reaproveita a nova.
  await db.aICache.upsert({ where: { key: baseKey }, create: { key: baseKey, ...row }, update: row });
  return { data: result.data, cached: false };
}

export async function aiUsageSummary() {
  const agg = await db.aICache.aggregate({ _sum: { inputTokens: true, outputTokens: true, hits: true }, _count: true });
  return {
    generations: agg._count,
    inputTokens: agg._sum.inputTokens ?? 0,
    outputTokens: agg._sum.outputTokens ?? 0,
    cacheHits: agg._sum.hits ?? 0,
  };
}
