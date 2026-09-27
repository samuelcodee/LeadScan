import "server-only";
import sharp, { type Metadata } from "sharp";
import { UserFacingError } from "@/lib/action";
import { db } from "@/lib/db";
import type { MediaKind } from "@/lib/generated/prisma/client";
import { moderateImage, ModerationUnavailableError } from "@/lib/media/moderation";
import { sniffAv } from "@/lib/media/sniff";

/**
 * Upload de imagens: valida pelo conteúdo (não pela extensão), redimensiona, converte
 * para WebP e REMOVE metadados (EXIF pode conter a localização de quem tirou a foto).
 * Toda imagem passa pela moderação antes de ser salva.
 */
export const MAX_UPLOAD_BYTES = 6 * 1024 * 1024;
const ACCEPTED = new Set(["jpeg", "png", "webp", "gif", "avif", "heif"]);

type ImageKind = Extract<MediaKind, "AVATAR" | "SITE_IMAGE" | "AI_IMAGE" | "CHAT_IMAGE">;

const SIZES: Record<ImageKind, { width: number; height?: number; quality: number }> = {
  AVATAR: { width: 320, height: 320, quality: 82 },
  SITE_IMAGE: { width: 1600, quality: 78 },
  AI_IMAGE: { width: 1600, quality: 80 },
  CHAT_IMAGE: { width: 1600, quality: 80 },
};

export function mediaUrl(id: string) {
  return `/api/media/${id}`;
}

export async function saveImage(opts: { userId: string; kind: ImageKind; input: Buffer; source?: string }) {
  if (opts.input.byteLength > MAX_UPLOAD_BYTES) throw new UserFacingError("Imagem muito grande. O limite é 6 MB.");
  let meta: Metadata;
  try {
    meta = await sharp(opts.input).metadata();
  } catch {
    throw new UserFacingError("Arquivo não reconhecido. Envie JPG, PNG ou WebP.");
  }
  if (!meta.format || !ACCEPTED.has(meta.format)) throw new UserFacingError("Formato não aceito. Envie JPG, PNG ou WebP.");
  if ((meta.width ?? 0) < 64 || (meta.height ?? 0) < 64) throw new UserFacingError("Imagem pequena demais (mínimo 64×64).");

  const size = SIZES[opts.kind];
  // .rotate() aplica a orientação do EXIF antes de descartá-lo
  const base = sharp(opts.input, { animated: false }).rotate();
  const resized = size.height
    ? base.resize(size.width, size.height, { fit: "cover", position: "attention" })
    : base.resize({ width: size.width, withoutEnlargement: true });
  const { data, info } = await resized.webp({ quality: size.quality }).toBuffer({ resolveWithObject: true });

  // Moderação numa cópia pequena (mais rápido e barato)
  const probe = await sharp(opts.input).rotate().resize({ width: 512, height: 512, fit: "inside" }).jpeg({ quality: 80 }).toBuffer();
  let verdict;
  try {
    verdict = await moderateImage(probe);
  } catch (err) {
    if (err instanceof ModerationUnavailableError) throw new UserFacingError(err.message);
    throw err;
  }
  if (verdict.status === "REJECTED") throw new UserFacingError(verdict.note ?? "Imagem recusada pela moderação.");

  return db.media.create({
    data: {
      userId: opts.userId,
      kind: opts.kind,
      mime: "image/webp",
      data: new Uint8Array(data),
      width: info.width,
      height: info.height,
      size: info.size,
      moderation: verdict.status,
      moderationNote: verdict.note,
      source: opts.source ?? "upload",
    },
    select: { id: true, width: true, height: true, moderation: true },
  });
}

/** Lê um File vindo de FormData (server action) com limite de tamanho. */
export async function fileToBuffer(file: unknown) {
  if (!(file instanceof File) || file.size === 0) throw new UserFacingError("Escolha uma imagem.");
  if (file.size > MAX_UPLOAD_BYTES) throw new UserFacingError("Imagem muito grande. O limite é 6 MB.");
  return Buffer.from(await file.arrayBuffer());
}

/* ─── Áudio e vídeo do chat ───────────────────────────────────── */

export const MAX_AUDIO_BYTES = 8 * 1024 * 1024;
export const MAX_VIDEO_BYTES = 16 * 1024 * 1024;

/**
 * Guarda áudio/vídeo do chat como veio (sem recodificar: o servidor fica leve).
 * Vídeo exige um quadro de capa, que passa pela moderação de imagem antes de tudo.
 */
export async function saveChatAv(opts: { userId: string; kind: "CHAT_AUDIO" | "CHAT_VIDEO"; input: Buffer }) {
  const video = opts.kind === "CHAT_VIDEO";
  const max = video ? MAX_VIDEO_BYTES : MAX_AUDIO_BYTES;
  if (opts.input.byteLength > max) throw new UserFacingError(video ? "Vídeo muito grande. O limite é 16 MB." : "Áudio muito grande. O limite é 8 MB.");
  const mime = sniffAv(opts.input, video ? "video" : "audio");
  if (!mime) throw new UserFacingError(video ? "Formato de vídeo não aceito. Envie MP4, MOV ou WebM." : "Formato de áudio não aceito.");
  return db.media.create({
    data: {
      userId: opts.userId,
      kind: opts.kind,
      mime,
      data: new Uint8Array(opts.input),
      width: 0,
      height: 0,
      size: opts.input.byteLength,
      moderation: "UNVERIFIED",
      moderationNote: video ? "capa moderada" : "áudio",
      source: "upload",
    },
    select: { id: true },
  });
}
