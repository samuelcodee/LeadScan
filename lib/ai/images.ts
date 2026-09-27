import "server-only";
import { UserFacingError } from "@/lib/action";
import { markUsed, userImageConnection } from "@/lib/ai/connections";
import { saveImage } from "@/lib/media/store";
import { getCategory } from "@/lib/domain/categories";
import { logger } from "@/lib/logger";

/**
 * Imagens de capa geradas por IA com a chave do usuário:
 *  - Nano Banana (Gemini Image): POST models/{model}:generateContent com responseModalities IMAGE
 *    https://ai.google.dev/gemini-api/docs/image-generation
 *  - GPT Image (OpenAI): POST /v1/images/generations → b64_json
 * A imagem passa pela mesma moderação das fotos enviadas e vira um Media (WebP).
 * Regra: é ILUSTRAÇÃO do segmento. Nunca apresentar como foto real do negócio.
 */
export function coverPrompt(input: { category: string; city: string; style?: string; extra?: string }) {
  const cat = getCategory(input.category);
  return [
    `Fotografia editorial para o topo do site de um(a) ${cat.label.toLowerCase()} em ${input.city}, Brasil.`,
    `Ambiente realista e acolhedor, luz natural, composição horizontal 16:9 com espaço livre à esquerda para texto.`,
    input.style ? `Estilo visual: ${input.style}.` : "",
    `Sem texto, sem logotipos, sem marcas d'água, sem rostos em close.`,
    input.extra ?? "",
  ]
    .filter(Boolean)
    .join(" ");
}

async function geminiImage(key: string, model: string, prompt: string) {
  const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-goog-api-key": key },
    body: JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: { responseModalities: ["IMAGE"], imageConfig: { aspectRatio: "16:9" } },
    }),
    signal: AbortSignal.timeout(90_000),
  });
  if (res.status === 401 || res.status === 403) throw new UserFacingError("O Google recusou a chave. Confira em Integrações.");
  if (res.status === 429) throw new UserFacingError("Limite de imagens da sua conta Google atingido. Tente mais tarde.");
  if (!res.ok) throw new UserFacingError(`Nano Banana respondeu ${res.status}.`);
  const json = (await res.json()) as { candidates?: { content?: { parts?: { inlineData?: { data: string; mimeType: string } }[] } }[] };
  const part = json.candidates?.[0]?.content?.parts?.find((p) => p.inlineData?.data);
  if (!part?.inlineData) throw new UserFacingError("A IA não devolveu imagem para esse pedido. Tente outro estilo.");
  return Buffer.from(part.inlineData.data, "base64");
}

async function openaiImage(key: string, model: string, prompt: string) {
  const res = await fetch("https://api.openai.com/v1/images/generations", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` },
    body: JSON.stringify({ model, prompt, size: "1536x1024", n: 1 }),
    signal: AbortSignal.timeout(120_000),
  });
  if (res.status === 401 || res.status === 403) throw new UserFacingError("A OpenAI recusou a chave. Confira em Integrações.");
  if (res.status === 429) throw new UserFacingError("Limite ou créditos da sua conta OpenAI esgotados.");
  if (!res.ok) throw new UserFacingError(`GPT Image respondeu ${res.status}.`);
  const json = (await res.json()) as { data?: { b64_json?: string }[] };
  const b64 = json.data?.[0]?.b64_json;
  if (!b64) throw new UserFacingError("A IA não devolveu imagem.");
  return Buffer.from(b64, "base64");
}

export async function generateCoverImage(userId: string, input: { category: string; city: string; style?: string; provider?: string }) {
  const conn = await userImageConnection(userId, input.provider);
  if (!conn) throw new UserFacingError("Conecte o Gemini (Nano Banana) ou a OpenAI em Integrações para gerar imagens.");
  const prompt = coverPrompt(input);
  try {
    const raw = conn.provider === "gemini" ? await geminiImage(conn.key, conn.model, prompt) : await openaiImage(conn.key, conn.model, prompt);
    const media = await saveImage({ userId, kind: "AI_IMAGE", input: raw, source: conn.provider });
    await markUsed(userId, conn.provider);
    return { id: media.id, url: `/api/media/${media.id}`, provider: conn.provider };
  } catch (err) {
    await markUsed(userId, conn.provider, err instanceof Error ? err.message : String(err));
    if (err instanceof UserFacingError) throw err;
    logger.error("geração de imagem falhou", { err: String(err) });
    throw new UserFacingError("Não conseguimos gerar a imagem agora.");
  }
}
