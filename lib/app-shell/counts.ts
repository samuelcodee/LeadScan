import "server-only";
import { db } from "@/lib/db";

/**
 * Números do menu (Meus leads, Favoritos, Protótipos e mensagens não lidas) numa ida só
 * ao banco. O layout do app roda em toda carga de página: com muita gente usando ao mesmo
 * tempo, 4 consultas viram 1. Cada subconsulta usa índice por userId.
 */
export async function shellCounts(userId: string) {
  const [row] = await db.$queryRaw<{ saved: bigint; favorites: bigint; prototypes: bigint; unread: bigint }[]>`
    SELECT
      (SELECT COUNT(*) FROM "Lead" WHERE "userId" = ${userId} AND "saved" = true) AS saved,
      (SELECT COUNT(*) FROM "Lead" WHERE "userId" = ${userId} AND "favorite" = true) AS favorites,
      (SELECT COUNT(*) FROM "Prototype" WHERE "userId" = ${userId}) AS prototypes,
      (SELECT COUNT(*) FROM "Message" m
         JOIN "ConversationMember" cm ON cm."conversationId" = m."conversationId" AND cm."userId" = ${userId}
        WHERE m."senderId" <> ${userId} AND m."deletedAt" IS NULL AND (cm."lastReadAt" IS NULL OR m."createdAt" > cm."lastReadAt")) AS unread`;
  return {
    saved: Number(row?.saved ?? 0),
    favorites: Number(row?.favorites ?? 0),
    prototypes: Number(row?.prototypes ?? 0),
    unread: Number(row?.unread ?? 0),
  };
}
