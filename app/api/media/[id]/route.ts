import { db } from "@/lib/db";

/**
 * Serve imagens enviadas (avatar, fotos de sites, imagens de IA). IDs são cuid (não
 * adivinháveis) e o conteúdo nunca muda para um mesmo ID → cache longo e imutável.
 * Imagens reprovadas pela moderação nem chegam a ser salvas.
 */
export async function GET(_req: Request, ctx: RouteContext<"/api/media/[id]">) {
  const { id } = await ctx.params;
  if (!/^[a-z0-9]{20,40}$/i.test(id)) return new Response("Não encontrado", { status: 404 });
  const media = await db.media.findUnique({ where: { id }, select: { data: true, mime: true, moderation: true, kind: true } });
  // Mídia de conversa privada e vídeo/áudio de Arquivos nunca saem por aqui (rotas próprias com checagem de quem pede)
  if (!media || media.moderation === "REJECTED" || media.kind.startsWith("CHAT_") || media.kind.startsWith("FILE_")) return new Response("Não encontrado", { status: 404 });
  return new Response(Buffer.from(media.data), {
    headers: {
      "Content-Type": media.mime,
      // s-maxage: a CDN (Vercel) guarda a imagem e o banco não é consultado de novo
      "Cache-Control": "public, max-age=31536000, s-maxage=2592000, immutable",
      "X-Content-Type-Options": "nosniff",
      "Content-Disposition": "inline",
    },
  });
}
