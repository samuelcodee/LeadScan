import type { NextRequest } from "next/server";
import { listConversations, requestCount } from "@/lib/chat/service";
import { withChatUser } from "@/lib/chat/http";

/** Conversas (?box=requests = pedidos de mensagem) + quantos pedidos esperam resposta. */
export async function GET(request: NextRequest) {
  const box = request.nextUrl.searchParams.get("box") === "requests" ? "requests" : "inbox";
  return withChatUser(null, async (user) => {
    const [conversations, requests] = await Promise.all([listConversations(user.id, box), requestCount(user.id)]);
    return { conversations, requests };
  });
}
