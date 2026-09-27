import { db } from "@/lib/db";
import { withChatUser } from "@/lib/chat/http";
import { publish } from "@/lib/realtime";

/** "Digitando…": só um aviso ao vivo, nada é gravado. */
export async function POST(_req: Request, ctx: RouteContext<"/api/chat/[id]/typing">) {
  const { id } = await ctx.params;
  return withChatUser("chat", async (user) => {
    const members = await db.conversationMember.findMany({ where: { conversationId: id }, select: { userId: true } });
    if (!members.some((m) => m.userId === user.id)) return { ok: false };
    for (const m of members) if (m.userId !== user.id) await publish({ type: "typing", userId: m.userId, conversationId: id, byUserId: user.id });
    return { ok: true };
  });
}
