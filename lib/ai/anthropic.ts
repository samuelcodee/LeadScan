import "server-only";
import Anthropic from "@anthropic-ai/sdk";
import { betaZodOutputFormat } from "@anthropic-ai/sdk/helpers/beta/zod";
import { AIUnavailableError, type AIProvider, type AIRequest, type AIResult } from "@/lib/ai/types";

/**
 * Provedor Claude (SDK oficial).
 *  - Saída estruturada validada por zod (`output_config.format`) → nada de parse frágil.
 *  - `effort: "low"`: textos curtos não precisam de raciocínio profundo → menos tokens.
 *  - `fallbacks: "default"`: se o classificador de segurança recusar, a API refaz a
 *    chamada no modelo recomendado, sem código extra aqui.
 */
export function createAnthropicProvider(apiKey: string, model: string): AIProvider {
  const client = new Anthropic({ apiKey, maxRetries: 2, timeout: 60_000 });

  return {
    id: "anthropic",
    model,
    async generate<T>(req: AIRequest<T>): Promise<AIResult<T>> {
      const response = await client.beta.messages.parse({
        model,
        max_tokens: req.maxTokens ?? 2000,
        betas: ["server-side-fallback-2026-07-01"],
        fallbacks: "default",
        system: req.system,
        output_config: { effort: "low", format: betaZodOutputFormat(req.schema) },
        messages: [{ role: "user", content: req.prompt }],
      });

      if (response.stop_reason === "refusal") {
        throw new AIUnavailableError("A IA recusou este pedido. Usamos o texto padrão.");
      }
      if (response.stop_reason === "max_tokens" || !response.parsed_output) {
        throw new AIUnavailableError("A IA não retornou um formato válido. Usamos o texto padrão.");
      }
      return {
        data: response.parsed_output as T,
        model: response.model,
        inputTokens: response.usage.input_tokens,
        outputTokens: response.usage.output_tokens,
      };
    },
  };
}
