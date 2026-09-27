import { unreadTotal } from "@/lib/chat/service";
import { withChatUser } from "@/lib/chat/http";

export async function GET() {
  return withChatUser(null, async (user) => ({ count: await unreadTotal(user.id) }));
}
