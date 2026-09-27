import { UserFacingError } from "@/lib/action";
import { withChatUser } from "@/lib/chat/http";
import { assertQuota } from "@/lib/media/files";
import { finishParts, MAX_FILE_VIDEO_BYTES, MAX_UPLOAD_BYTES, saveChatAv, saveImage } from "@/lib/media/store";

/**
 * Envio para Arquivos (multipart): kind=image|video|audio, file, name?
 * Vídeo/áudio grande já enviado em partes (./part): manda upload=<id> no lugar de file.
 * Foto passa pela moderação e vira imagem que pode ir para os sites.
 */
export async function POST(request: Request) {
  return withChatUser("files", async (user) => {
    const len = Number(request.headers.get("content-length") ?? 0);
    if (len > MAX_FILE_VIDEO_BYTES + 2 * 1024 * 1024) throw new UserFacingError("Arquivo muito grande.");
    const form = await request.formData().catch(() => null);
    if (!form) throw new UserFacingError("Envio inválido.");
    const kind = String(form.get("kind") ?? "");
    const name = typeof form.get("name") === "string" ? String(form.get("name")).slice(0, 120) : null;
    const uploadId = typeof form.get("upload") === "string" ? String(form.get("upload")) : null;
    const file = form.get("file");
    if (!uploadId && (!(file instanceof File) || file.size === 0)) throw new UserFacingError("Escolha um arquivo.");
    const buf = uploadId ? Buffer.alloc(0) : Buffer.from(await (file as File).arrayBuffer());

    if (kind === "image") {
      if (buf.byteLength > MAX_UPLOAD_BYTES) throw new UserFacingError("Imagem muito grande. O limite é 6 MB.");
      await assertQuota(user.id, buf.byteLength);
      const media = await saveImage({ userId: user.id, kind: "SITE_IMAGE", input: buf, name });
      return { id: media.id, url: `/api/media/${media.id}`, unverified: media.moderation === "UNVERIFIED" };
    }
    if (kind === "video" || kind === "audio") {
      const mediaKind = kind === "video" ? "FILE_VIDEO" : "FILE_AUDIO";
      // em partes, a cota foi conferida na primeira parte (pelo tamanho total)
      if (uploadId) return finishParts(user.id, uploadId, mediaKind);
      await assertQuota(user.id, buf.byteLength);
      return saveChatAv({ userId: user.id, kind: mediaKind, input: buf, name });
    }
    throw new UserFacingError("Tipo de arquivo não suportado.");
  });
}
