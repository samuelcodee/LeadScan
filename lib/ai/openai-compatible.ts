import "server-only";
import { z } from "zod";
import { AIUnavailableError, type AIProvider, type AIRequest, type AIResult } from "@/lib/ai/types";

/**
 * Provedor para qualquer API compatível com Chat Completions (OpenAI, OpenRouter,
 * Groq, Ollama local…). Mantém o projeto independente de um único fornecedor.
 */
export function createOpenAICompatibleProvider(
  apiKey: string,
  model: string,
  baseUrl: string,
  opts: { id?: string; tokenParam?: "max_tokens" | "max_completion_tokens"; jsonMode?: boolean } = {},
): AIProvider {
  const url = `${baseUrl.replace(/\/$/, "")}/chat/completions`;
  const tokenParam = opts.tokenParam ?? "max_tokens";

  return {
    id: opts.id ?? "openai",
    model,
    async generate<T>(req: AIRequest<T>): Promise<AIResult<T>> {
      const schema = z.toJSONSchema(req.schema);
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...(apiKey ? { Authorization: `Bearer ${apiKey}` } : {}) },
        body: JSON.stringify({
          model,
          [tokenParam]: tokenParam === "max_completion_tokens" ? (req.maxTokens ?? 2000) * 3 : (req.maxTokens ?? 2000),
          ...(opts.jsonMode === false ? {} : { response_format: { type: "json_object" } }),
          messages: [
            { role: "system", content: `${req.system}\n\nResponda SOMENTE com JSON válido neste schema:\n${JSON.stringify(schema)}` },
            { role: "user", content: req.prompt },
          ],
        }),
        signal: AbortSignal.timeout(60_000),
      });
      if (res.status === 401 || res.status === 403) throw new AIUnavailableError("A chave foi recusada pelo provedor de IA. Confira em Integrações.");
      if (res.status === 429) throw new AIUnavailableError("Limite ou créditos da sua conta de IA esgotados no momento.");
      if (!res.ok) throw new AIUnavailableError(`Provedor de IA respondeu ${res.status}.`);
      const json = (await res.json()) as {
        model?: string;
        choices?: { message?: { content?: string } }[];
        usage?: { prompt_tokens?: number; completion_tokens?: number };
      };
      const content = json.choices?.[0]?.message?.content ?? "";
      let parsed: unknown;
      try {
        // Alguns modelos embrulham o JSON em ```json … ```: extrai o objeto
        const start = content.indexOf("{");
        const end = content.lastIndexOf("}");
        parsed = JSON.parse(start >= 0 && end > start ? content.slice(start, end + 1) : content);
      } catch {
        throw new AIUnavailableError("A IA não retornou JSON válido.");
      }
      const data = req.schema.safeParse(parsed);
      if (!data.success) throw new AIUnavailableError("A IA retornou um formato inesperado.");
      return {
        data: data.data,
        model: json.model ?? model,
        inputTokens: json.usage?.prompt_tokens ?? 0,
        outputTokens: json.usage?.completion_tokens ?? 0,
      };
    },
  };
}
