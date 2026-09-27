import { UserFacingError } from "@/lib/action";
import { assertMember } from "@/lib/chat/service";
import { withChatUser } from "@/lib/chat/http";
import { db } from "@/lib/db";
import { MAX_AUDIO_BYTES, MAX_VIDEO_BYTES } from "@/lib/media/store";
import { sniffAv } from "@/lib/media/sniff";

/**
 * Envio em partes (vídeo/áudio grandes). A Vercel recusa corpo acima de 4,5 MB por
 * requisição, então o navegador manda pedaços de até 3,5 MB:
 *   POST ?kind=video|audio&total=<bytes>              (1ª parte) → { upload }
 *   POST ?kind=…&upload=<id>                           (demais)   → { received }
 * Depois, POST /api/chat/[id]/media com `upload=<id>` fecha o arquivo e cria a mensagem.
 * As partes vão direto para o bytea do Media (data = data || parte), marcado source="partial"
 * até fechar — nada parcial é servido. Sobras abandonadas somem na próxima 1ª parte (1 h).
 */
const MAX_PART = 3.75 * 1024 * 1024;

export async function POST(request: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const sp = new URL(request.url).searchParams;
  return withChatUser("chatChunk", async (user) => {
    await assertMember(user.id, id);
    const kind = sp.get("kind");
    if (kind !== "video" && kind !== "audio") throw new UserFacingError("Tipo de arquivo não suportado.");
    const max = kind === "video" ? MAX_VIDEO_BYTES : MAX_AUDIO_BYTES;
    const part = Buffer.from(await request.arrayBuffer());
    if (!part.byteLength) throw new UserFacingError("Parte vazia.");
    if (part.byteLength > MAX_PART) throw new UserFacingError("Parte grande demais.");

    const uploadId = sp.get("upload");
    if (!uploadId) {
      const total = Number(sp.get("total") ?? 0);
      if (!total || total > max) throw new UserFacingError(kind === "video" ? "Vídeo muito grande. O limite é 16 MB." : "Áudio muito grande. O limite é 8 MB.");
      const mime = sniffAv(part, kind);
      if (!mime) throw new UserFacingError(kind === "video" ? "Formato de vídeo não aceito. Envie MP4, MOV ou WebM." : "Formato de áudio não aceito.");
      // limpeza preguiçosa de envios abandonados
      await db.media.deleteMany({ where: { userId: user.id, source: "partial", createdAt: { lt: new Date(Date.now() - 60 * 60_000) } } });
      const media = await db.media.create({
        data: {
          userId: user.id,
          kind: kind === "video" ? "CHAT_VIDEO" : "CHAT_AUDIO",
          mime,
          data: new Uint8Array(part),
          width: 0,
          height: 0,
          size: part.byteLength,
          moderation: "UNVERIFIED",
          moderationNote: kind === "video" ? "capa moderada" : "áudio",
          source: "partial",
        },
        select: { id: true },
      });
      return { upload: media.id, received: part.byteLength };
    }

    if (!/^[a-z0-9]{20,40}$/i.test(uploadId)) throw new UserFacingError("Envio inválido.");
    const rows = await db.$queryRaw<{ size: number }[]>`
      UPDATE "Media" SET "data" = "data" || ${new Uint8Array(part)}, "size" = "size" + ${part.byteLength}::int
      WHERE "id" = ${uploadId} AND "userId" = ${user.id} AND "source" = 'partial' AND "size" + ${part.byteLength}::int <= ${max}::int
      RETURNING "size"`;
    if (!rows.length) throw new UserFacingError("Envio expirado ou grande demais. Tente de novo.");
    return { upload: uploadId, received: Number(rows[0].size) };
  });
}
