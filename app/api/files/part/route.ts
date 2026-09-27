import { UserFacingError } from "@/lib/action";
import { withChatUser } from "@/lib/chat/http";
import { assertQuota } from "@/lib/media/files";
import { appendPart } from "@/lib/media/store";

/**
 * Vídeo/áudio grande para Arquivos, em partes de até 3,5 MB (a Vercel recusa corpo maior):
 *   POST ?kind=video|audio&total=<bytes>&name=<nome>   (1ª parte) → { upload }
 *   POST ?kind=…&upload=<id>                            (demais)   → { received }
 * Depois, POST /api/files com upload=<id> fecha o arquivo.
 */
export async function POST(request: Request) {
  const sp = new URL(request.url).searchParams;
  return withChatUser("files", async (user) => {
    const kind = sp.get("kind");
    if (kind !== "video" && kind !== "audio") throw new UserFacingError("Tipo de arquivo não suportado.");
    const uploadId = sp.get("upload");
    const total = Number(sp.get("total") ?? 0);
    if (!uploadId) await assertQuota(user.id, total);
    return appendPart({
      userId: user.id,
      kind: kind === "video" ? "FILE_VIDEO" : "FILE_AUDIO",
      part: Buffer.from(await request.arrayBuffer()),
      uploadId,
      total,
      name: sp.get("name"),
    });
  });
}
