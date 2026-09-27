import "server-only";
import { db } from "@/lib/db";

/**
 * Números do menu (Meus leads, Favoritos, Protótipos, mensagens não lidas e convites) numa ida só
 * ao banco. O layout do app roda em toda carga de página: com muita gente usando ao mesmo
 * tempo, 4 consultas viram 1. Cada subconsulta usa índice por userId.
 */
export async function shellCounts(userId: string) {
  const [row] = await db.$queryRaw<{ saved: bigint; favorites: bigint; prototypes: bigint; unread: bigint; invites: bigint }[]>`
    SELECT
      (SELECT COUNT(*) FROM "Lead" WHERE "userId" = ${userId} AND "saved" = true) AS saved,
      (SELECT COUNT(*) FROM "Lead" WHERE "userId" = ${userId} AND "favorite" = true) AS favorites,
      (SELECT COUNT(*) FROM "Prototype" WHERE "userId" = ${userId}) AS prototypes,
      (SELECT COUNT(*) FROM "Message" m
         JOIN "ConversationMember" cm ON cm."conversationId" = m."conversationId" AND cm."userId" = ${userId} AND cm."inbox" = 'ACCEPTED'
        WHERE m."senderId" <> ${userId} AND m."deletedAt" IS NULL AND (cm."lastReadAt" IS NULL OR m."createdAt" > cm."lastReadAt")) AS unread,
      (SELECT COUNT(*) FROM "Friendship" WHERE "addresseeId" = ${userId} AND "status" = 'PENDING') AS invites`;
  return {
    saved: Number(row?.saved ?? 0),
    favorites: Number(row?.favorites ?? 0),
    prototypes: Number(row?.prototypes ?? 0),
    unread: Number(row?.unread ?? 0),
    /** convites de amizade recebidos, esperando resposta */
    invites: Number(row?.invites ?? 0),
  };
}
