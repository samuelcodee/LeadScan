import type { z } from "zod";

/**
 * Contrato de qualquer provedor de IA. O app nunca chama um SDK diretamente —
 * só esta interface — então trocar de modelo/provedor é trocar uma linha em lib/ai/index.ts.
 */
export type AIRequest<T> = {
  /** Instruções estáveis (primeiro, para aproveitar cache de prompt do provedor). */
  system: string;
  /** Contexto mínimo e específico da tarefa. */
  prompt: string;
  schema: z.ZodType<T>;
  maxTokens?: number;
};

export type AIResult<T> = {
  data: T;
  model: string;
  inputTokens: number;
  outputTokens: number;
};

export interface AIProvider {
  /** Id do catálogo (anthropic, openai, gemini, groq…) */
  id: string;
  model: string;
  /** "user" = chave do próprio usuário; "platform" = chave da instalação (.env) */
  owner?: "user" | "platform";
  generate<T>(req: AIRequest<T>): Promise<AIResult<T>>;
}

export class AIUnavailableError extends Error {
  constructor(message = "IA não configurada.") {
    super(message);
  }
}
