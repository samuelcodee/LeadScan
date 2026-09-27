import "server-only";
import { UserFacingError } from "@/lib/action";
import { db } from "@/lib/db";
import type { MediaKind } from "@/lib/generated/prisma/client";

/**
 * Arquivos do usuário (página Arquivos): fotos, vídeos e áudios guardados na plataforma.
 *  - Fotos: SITE_IMAGE — passam pela moderação e podem ir para os sites (/api/media/[id])
 *  - Vídeos e áudios: FILE_VIDEO / FILE_AUDIO — privados, só o dono baixa (/api/files/[id])
 * Cada conta tem uma cota de espaço; imagens geradas por IA também aparecem aqui.
 */
export const FILE_KINDS: MediaKind[] = ["SITE_IMAGE", "AI_IMAGE", "FILE_VIDEO", "FILE_AUDIO"];
export const STORAGE_QUOTA_BYTES = 300 * 1024 * 1024;

export type FileFilter = "todos" | "fotos" | "videos" | "audios";
const BY_FILTER: Record<FileFilter, MediaKind[]> = {
  todos: FILE_KINDS,
  fotos: ["SITE_IMAGE", "AI_IMAGE"],
  videos: ["FILE_VIDEO"],
  audios: ["FILE_AUDIO"],
};

export async function listFiles(userId: string, filter: FileFilter = "todos", take = 120) {
  return db.media.findMany({
    where: { userId, kind: { in: BY_FILTER[filter] }, source: { not: "partial" } },
    orderBy: { createdAt: "desc" },
    take,
    // nunca o conteúdo (data): a lista só precisa dos dados para desenhar
    select: { id: true, kind: true, mime: true, size: true, width: true, height: true, name: true, source: true, createdAt: true },
  });
}
export type FileItem = Awaited<ReturnType<typeof listFiles>>[number];

export async function storageUsage(userId: string) {
  const rows = await db.media.groupBy({ by: ["kind"], where: { userId, kind: { in: FILE_KINDS } }, _sum: { size: true }, _count: true });
  const used = rows.reduce((s, r) => s + (r._sum.size ?? 0), 0);
  const count = (kinds: MediaKind[]) => rows.filter((r) => kinds.includes(r.kind)).reduce((s, r) => s + r._count, 0);
  return { used, quota: STORAGE_QUOTA_BYTES, photos: count(BY_FILTER.fotos), videos: count(BY_FILTER.videos), audios: count(BY_FILTER.audios) };
}

/** Antes de gravar: cabe na cota? */
export async function assertQuota(userId: string, incoming: number) {
  const { used } = await storageUsage(userId);
  if (used + incoming > STORAGE_QUOTA_BYTES) {
    throw new UserFacingError("Seu espaço de arquivos acabou (300 MB). Apague vídeos ou fotos que não usa mais.");
  }
}

export async function renameFile(userId: string, id: string, name: string) {
  const { count } = await db.media.updateMany({ where: { id, userId, kind: { in: FILE_KINDS } }, data: { name: name.trim().slice(0, 120) || null } });
  if (!count) throw new UserFacingError("Arquivo não encontrado.");
}

export async function deleteFile(userId: string, id: string) {
  const { count } = await db.media.deleteMany({ where: { id, userId, kind: { in: FILE_KINDS } } });
  if (!count) throw new UserFacingError("Arquivo não encontrado.");
}

/** Fotos recentes para escolher no estúdio do protótipo. */
export async function recentPhotoUrls(userId: string, take = 12) {
  const rows = await db.media.findMany({
    where: { userId, kind: { in: ["SITE_IMAGE", "AI_IMAGE"] }, moderation: { not: "REJECTED" } },
    orderBy: { createdAt: "desc" },
    take,
    select: { id: true },
  });
  return rows.map((r) => `/api/media/${r.id}`);
}
