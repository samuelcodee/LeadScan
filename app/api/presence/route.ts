import { touchPresence } from "@/lib/chat/service";
import { withChatUser } from "@/lib/chat/http";

/** Heartbeat do app aberto (a cada ~60 s com a aba visível e em uso). */
export async function POST() {
  return withChatUser("presence", async (user) => {
    await touchPresence(user.id, user.lastActiveAt);
    return { ok: true };
  });
}
