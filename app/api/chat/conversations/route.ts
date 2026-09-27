import { listConversations } from "@/lib/chat/service";
import { withChatUser } from "@/lib/chat/http";

export async function GET() {
  return withChatUser(null, async (user) => ({ conversations: await listConversations(user.id) }));
}
