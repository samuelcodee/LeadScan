import { ChatShell } from "@/components/chat/chat-shell";
import { ConversationList } from "@/components/chat/conversation-list";
import { requireUser } from "@/lib/auth/session";
import { listConversations, requestCount } from "@/lib/chat/service";

export default async function MessagesLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser();
  const [conversations, requests] = await Promise.all([listConversations(user.id), requestCount(user.id)]);
  return <ChatShell list={<ConversationList initial={conversations} initialRequests={requests} />}>{children}</ChatShell>;
}
