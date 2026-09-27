import "server-only";
import { env, isDemoMode } from "@/lib/env";
import { logger } from "@/lib/logger";

/**
 * Moderação de imagens: bloqueia nudez explícita, conteúdo sexual (+18) e violência
 * gráfica em fotos de perfil e fotos que vão para sites públicos.
 *
 *  - openai: endpoint de moderação (omni-moderation-latest) — gratuito, aceita imagem.
 *  - sightengine: modelos nudity-2.1 + gore-2.0.
 *  - none: só permitido no modo demonstração (a imagem fica marcada como "não verificada").
 *
 * Falha do moderador = imagem recusada (nunca publicamos algo sem checar).
 */
export type ModerationResult = { status: "APPROVED" | "UNVERIFIED" | "REJECTED"; note?: string };

export class ModerationUnavailableError extends Error {}

const REASON = "A foto parece ter conteúdo adulto ou violento e não pode ser usada. Escolha outra.";

async function openaiModeration(jpeg: Buffer): Promise<ModerationResult> {
  const res = await fetch("https://api.openai.com/v1/moderations", {
    method: "POST",
    headers: { Authorization: `Bearer ${env().MODERATION_API_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: "omni-moderation-latest",
      input: [{ type: "image_url", image_url: { url: `data:image/jpeg;base64,${jpeg.toString("base64")}` } }],
    }),
    signal: AbortSignal.timeout(20_000),
  });
  if (!res.ok) throw new ModerationUnavailableError(`moderação respondeu ${res.status}`);
  const json = (await res.json()) as {
    results?: { flagged: boolean; categories: Record<string, boolean>; category_scores: Record<string, number> }[];
  };
  const r = json.results?.[0];
  if (!r) throw new ModerationUnavailableError("moderação sem resultado");
  const s = r.category_scores;
  const blocked =
    r.categories["sexual"] || r.categories["sexual/minors"] || r.categories["violence/graphic"] || (s["sexual"] ?? 0) > 0.35 || (s["sexual/minors"] ?? 0) > 0.05;
  return blocked ? { status: "REJECTED", note: "openai: sexual/violência" } : { status: "APPROVED" };
}

async function sightengineModeration(jpeg: Buffer): Promise<ModerationResult> {
  const e = env();
  const form = new FormData();
  form.set("media", new Blob([new Uint8Array(jpeg)], { type: "image/jpeg" }), "image.jpg");
  form.set("models", "nudity-2.1,gore-2.0");
  form.set("api_user", e.SIGHTENGINE_USER);
  form.set("api_secret", e.SIGHTENGINE_SECRET);
  const res = await fetch("https://api.sightengine.com/1.0/check.json", { method: "POST", body: form, signal: AbortSignal.timeout(20_000) });
  if (!res.ok) throw new ModerationUnavailableError(`sightengine respondeu ${res.status}`);
  const json = (await res.json()) as { status?: string; nudity?: Record<string, number>; gore?: { prob?: number } };
  if (json.status !== "success") throw new ModerationUnavailableError("sightengine falhou");
  const n = json.nudity ?? {};
  const blocked = (n.sexual_activity ?? 0) > 0.4 || (n.sexual_display ?? 0) > 0.4 || (n.erotica ?? 0) > 0.5 || (json.gore?.prob ?? 0) > 0.6;
  return blocked ? { status: "REJECTED", note: "sightengine: nudez/gore" } : { status: "APPROVED" };
}

export async function moderateImage(jpeg: Buffer): Promise<ModerationResult> {
  const provider = env().MODERATION_PROVIDER;
  if (provider === "none") {
    if (isDemoMode()) return { status: "UNVERIFIED", note: "sem moderador (modo demo)" };
    throw new ModerationUnavailableError("Envio de fotos indisponível: a moderação de imagens não foi configurada nesta instalação.");
  }
  try {
    const r = provider === "openai" ? await openaiModeration(jpeg) : await sightengineModeration(jpeg);
    return r.status === "REJECTED" ? { ...r, note: REASON } : r;
  } catch (err) {
    logger.warn("moderação indisponível", { err: String(err) });
    throw new ModerationUnavailableError("Não conseguimos verificar a foto agora. Tente de novo em instantes.");
  }
}
