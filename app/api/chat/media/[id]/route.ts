import { getCurrentUser } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { serveMedia } from "@/lib/media/serve";

/** Mídia do chat: só quem está na conversa baixa (Range e fatias em lib/media/serve.ts). */
export async function GET(request: Request, ctx: RouteContext<"/api/chat/media/[id]">) {
  const { id } = await ctx.params;
  if (!/^[a-z0-9]{20,40}$/i.test(id)) return new Response("Não encontrado", { status: 404 });
  const user = await getCurrentUser();
  if (!user) return new Response("Não autenticado", { status: 401 });

  const msg = await db.message.findFirst({
    where: { OR: [{ mediaId: id }, { posterId: id }], deletedAt: null, conversation: { members: { some: { userId: user.id } } } },
    select: { id: true },
  });
  if (!msg) return new Response("Não encontrado", { status: 404 });
  const media = await db.media.findUnique({ where: { id }, select: { id: true, mime: true, size: true, source: true } });
  if (!media || media.source === "partial") return new Response("Não encontrado", { status: 404 });
  return serveMedia(request, media);
}
