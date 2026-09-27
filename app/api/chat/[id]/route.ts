import type { NextRequest } from "next/server";
import { UserFacingError } from "@/lib/action";
import { getConversation, getMessage, listMessages } from "@/lib/chat/service";
import { withChatUser } from "@/lib/chat/http";

/** Mensagens da conversa: ?before=<id> (mais antigas), ?after=<id> (novas desde a última) ou ?message=<id> (uma só, depois de editada). */
export async function GET(request: NextRequest, ctx: RouteContext<"/api/chat/[id]">) {
  const { id } = await ctx.params;
  const sp = request.nextUrl.searchParams;
  return withChatUser(null, async (user) => {
    const one = sp.get("message");
    if (one) {
      const m = await getMessage(user.id, id, one);
      return { messages: m ? [m] : [] };
    }
    const conversation = await getConversation(user.id, id);
    if (!conversation) throw new UserFacingError("Conversa não encontrada.");
    const page = await listMessages(user.id, id, { before: sp.get("before") ?? undefined, after: sp.get("after") ?? undefined });
    return { conversation, ...page };
  });
}
