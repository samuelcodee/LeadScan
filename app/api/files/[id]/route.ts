import { getCurrentUser } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { serveMedia } from "@/lib/media/serve";

/** Vídeo/áudio de Arquivos: só o dono baixa. ?download=1 salva com o nome original. */
export async function GET(request: Request, ctx: RouteContext<"/api/files/[id]">) {
  const { id } = await ctx.params;
  if (!/^[a-z0-9]{20,40}$/i.test(id)) return new Response("Não encontrado", { status: 404 });
  const user = await getCurrentUser();
  if (!user) return new Response("Não autenticado", { status: 401 });
  const media = await db.media.findFirst({
    where: { id, userId: user.id, kind: { in: ["FILE_VIDEO", "FILE_AUDIO"] }, source: { not: "partial" } },
    select: { id: true, mime: true, size: true, name: true },
  });
  if (!media) return new Response("Não encontrado", { status: 404 });
  const download = new URL(request.url).searchParams.has("download");
  return serveMedia(request, media, { download: download ? (media.name ?? `arquivo-${id}`) : null });
}
