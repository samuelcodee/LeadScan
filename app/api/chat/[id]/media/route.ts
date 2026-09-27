import { UserFacingError } from "@/lib/action";
import { assertMember, sendMessage } from "@/lib/chat/service";
import { withChatUser } from "@/lib/chat/http";
import { db } from "@/lib/db";
import { MAX_UPLOAD_BYTES, MAX_VIDEO_BYTES, saveChatAv, saveImage } from "@/lib/media/store";

/**
 * Foto, áudio ou vídeo no chat (multipart):
 *   kind=image|audio|video, file, durationMs?, body? (legenda), poster (JPEG, obrigatório no vídeo)
 *   Arquivo grande já enviado em partes (./part): manda upload=<id> no lugar de file.
 * Foto e capa do vídeo passam pela moderação antes de qualquer coisa ser gravada.
 */
export async function POST(request: Request, ctx: RouteContext<"/api/chat/[id]/media">) {
  const { id } = await ctx.params;
  return withChatUser("chatMedia", async (user) => {
    await assertMember(user.id, id);
    const len = Number(request.headers.get("content-length") ?? 0);
    if (len > MAX_VIDEO_BYTES + 2 * 1024 * 1024) throw new UserFacingError("Arquivo muito grande. O limite é 16 MB.");
    const form = await request.formData().catch(() => null);
    if (!form) throw new UserFacingError("Envio inválido.");
    const kind = String(form.get("kind") ?? "");
    const uploadId = typeof form.get("upload") === "string" ? String(form.get("upload")) : null;
    const file = form.get("file");
    if (!uploadId && (!(file instanceof File) || file.size === 0)) throw new UserFacingError("Escolha um arquivo.");
    const buf = uploadId ? Buffer.alloc(0) : Buffer.from(await (file as File).arrayBuffer());
    // Fecha o envio em partes: vira mídia normal (só então pode ser servida)
    const finish = async (mediaKind: "CHAT_AUDIO" | "CHAT_VIDEO") => {
      const { count } = await db.media.updateMany({ where: { id: uploadId!, userId: user.id, source: "partial", kind: mediaKind }, data: { source: "upload" } });
      if (!count) throw new UserFacingError("Envio expirado. Tente de novo.");
      return { id: uploadId! };
    };
    const caption = typeof form.get("body") === "string" ? String(form.get("body")).slice(0, 1000) : null;
    const durationMs = Math.max(0, Math.min(15 * 60_000, Number(form.get("durationMs") ?? 0))) || null;

    if (kind === "image") {
      if (buf.byteLength > MAX_UPLOAD_BYTES) throw new UserFacingError("Imagem muito grande. O limite é 6 MB.");
      const media = await saveImage({ userId: user.id, kind: "CHAT_IMAGE", input: buf });
      return { message: await sendMessage(user.id, id, { kind: "IMAGE", mediaId: media.id, body: caption }) };
    }
    if (kind === "audio") {
      const media = uploadId ? await finish("CHAT_AUDIO") : await saveChatAv({ userId: user.id, kind: "CHAT_AUDIO", input: buf });
      return { message: await sendMessage(user.id, id, { kind: "AUDIO", mediaId: media.id, durationMs }) };
    }
    if (kind === "video") {
      const poster = form.get("poster");
      if (!(poster instanceof File) || poster.size === 0) throw new UserFacingError("Não conseguimos ler o vídeo. Tente outro arquivo (MP4 funciona melhor).");
      // Capa primeiro: se a moderação recusar o quadro, o vídeo nem é gravado
      const cover = await saveImage({ userId: user.id, kind: "CHAT_IMAGE", input: Buffer.from(await poster.arrayBuffer()) });
      try {
        const media = uploadId ? await finish("CHAT_VIDEO") : await saveChatAv({ userId: user.id, kind: "CHAT_VIDEO", input: buf });
        return { message: await sendMessage(user.id, id, { kind: "VIDEO", mediaId: media.id, posterId: cover.id, durationMs, body: caption }) };
      } catch (err) {
        await db.media.delete({ where: { id: cover.id } }).catch(() => {});
        throw err;
      }
    }
    throw new UserFacingError("Tipo de arquivo não suportado.");
  });
}
