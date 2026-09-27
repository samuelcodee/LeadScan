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

export async function saveImage(opts: { userId: string; kind: ImageKind; input: Buffer; source?: string; name?: string | null }) {
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
      name: opts.name?.slice(0, 120) ?? null,
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
type AvKind = "CHAT_AUDIO" | "CHAT_VIDEO" | "FILE_AUDIO" | "FILE_VIDEO";
const isVideo = (k: AvKind) => k === "CHAT_VIDEO" || k === "FILE_VIDEO";

/** Arquivos (página Arquivos) aceitam mais que o chat: vídeo de apresentação, áudio longo. */
export const MAX_FILE_VIDEO_BYTES = 40 * 1024 * 1024;
export const MAX_FILE_AUDIO_BYTES = 20 * 1024 * 1024;

export function avLimit(kind: AvKind) {
  if (kind === "FILE_VIDEO") return MAX_FILE_VIDEO_BYTES;
  if (kind === "FILE_AUDIO") return MAX_FILE_AUDIO_BYTES;
  return kind === "CHAT_VIDEO" ? MAX_VIDEO_BYTES : MAX_AUDIO_BYTES;
}

function tooBig(kind: AvKind) {
  const mb = Math.round(avLimit(kind) / 1024 / 1024);
  return new UserFacingError(isVideo(kind) ? `Vídeo muito grande. O limite é ${mb} MB.` : `Áudio muito grande. O limite é ${mb} MB.`);
}

export async function saveChatAv(opts: { userId: string; kind: AvKind; input: Buffer; name?: string | null }) {
  const video = isVideo(opts.kind);
  const max = avLimit(opts.kind);
  if (opts.input.byteLength > max) throw tooBig(opts.kind);
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
      name: opts.name?.slice(0, 120) ?? null,
    },
    select: { id: true },
  });
}

/* ─── Envio em partes (vídeo/áudio grandes) ────────────────────── */

/**
 * A Vercel recusa corpo acima de 4,5 MB por requisição, então o navegador manda pedaços de
 * até 3,5 MB. As partes vão direto para o bytea do Media (data = data || parte), marcado
 * source="partial" até fechar — nada parcial é servido. Sobras abandonadas somem na próxima
 * 1ª parte (1 h).
 */
export const MAX_PART = 3.75 * 1024 * 1024;

export async function appendPart(opts: { userId: string; kind: AvKind; part: Buffer; uploadId: string | null; total?: number; name?: string | null }) {
  const max = avLimit(opts.kind);
  if (!opts.part.byteLength) throw new UserFacingError("Parte vazia.");
  if (opts.part.byteLength > MAX_PART) throw new UserFacingError("Parte grande demais.");
  if (!opts.uploadId) {
    if (!opts.total || opts.total > max) throw tooBig(opts.kind);
    const mime = sniffAv(opts.part, isVideo(opts.kind) ? "video" : "audio");
    if (!mime) throw new UserFacingError(isVideo(opts.kind) ? "Formato de vídeo não aceito. Envie MP4, MOV ou WebM." : "Formato de áudio não aceito.");
    await db.media.deleteMany({ where: { userId: opts.userId, source: "partial", createdAt: { lt: new Date(Date.now() - 60 * 60_000) } } });
    const media = await db.media.create({
      data: {
        userId: opts.userId,
        kind: opts.kind,
        mime,
        data: new Uint8Array(opts.part),
        width: 0,
        height: 0,
        size: opts.part.byteLength,
        moderation: "UNVERIFIED",
        moderationNote: isVideo(opts.kind) ? "capa moderada" : "áudio",
        source: "partial",
        name: opts.name?.slice(0, 120) ?? null,
      },
      select: { id: true },
    });
    return { upload: media.id, received: opts.part.byteLength };
  }
  if (!/^[a-z0-9]{20,40}$/i.test(opts.uploadId)) throw new UserFacingError("Envio inválido.");
  const rows = await db.$queryRaw<{ size: number }[]>`
    UPDATE "Media" SET "data" = "data" || ${new Uint8Array(opts.part)}, "size" = "size" + ${opts.part.byteLength}::int
    WHERE "id" = ${opts.uploadId} AND "userId" = ${opts.userId} AND "source" = 'partial' AND "kind" = ${opts.kind}::"MediaKind" AND "size" + ${opts.part.byteLength}::int <= ${max}::int
    RETURNING "size"`;
  if (!rows.length) throw new UserFacingError("Envio expirado ou grande demais. Tente de novo.");
  return { upload: opts.uploadId, received: Number(rows[0].size) };
}

/** Fecha o envio em partes: vira mídia normal (só então pode ser servida). */
export async function finishParts(userId: string, uploadId: string, kind: AvKind) {
  const { count } = await db.media.updateMany({ where: { id: uploadId, userId, source: "partial", kind }, data: { source: "upload" } });
  if (!count) throw new UserFacingError("Envio expirado. Tente de novo.");
  return { id: uploadId };
}
