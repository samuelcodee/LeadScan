import { UserFacingError } from "@/lib/action";
import { assertMember } from "@/lib/chat/service";
import { withChatUser } from "@/lib/chat/http";
import { appendPart } from "@/lib/media/store";

/**
 * Envio em partes (vídeo/áudio grandes do chat):
 *   POST ?kind=video|audio&total=<bytes>              (1ª parte) → { upload }
 *   POST ?kind=…&upload=<id>                           (demais)   → { received }
 * Depois, POST /api/chat/[id]/media com `upload=<id>` fecha o arquivo e cria a mensagem.
 * Regras das partes em lib/media/store.ts (appendPart).
 */
export async function POST(request: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const sp = new URL(request.url).searchParams;
  return withChatUser("chatChunk", async (user) => {
    await assertMember(user.id, id);
    const kind = sp.get("kind");
    if (kind !== "video" && kind !== "audio") throw new UserFacingError("Tipo de arquivo não suportado.");
    return appendPart({
      userId: user.id,
      kind: kind === "video" ? "CHAT_VIDEO" : "CHAT_AUDIO",
      part: Buffer.from(await request.arrayBuffer()),
      uploadId: sp.get("upload"),
      total: Number(sp.get("total") ?? 0),
    });
  });
}
