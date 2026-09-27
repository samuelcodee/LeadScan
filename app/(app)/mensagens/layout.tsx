import { ChatShell } from "@/components/chat/chat-shell";
import { ConversationList } from "@/components/chat/conversation-list";
import { requireUser } from "@/lib/auth/session";
import { listConversations, requestCount } from "@/lib/chat/service";

export default async function MessagesLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser();
  const [conversations, requests] = await Promise.all([listConversations(user.id), requestCount(user.id)]);
  // Só pedidos esperando: a lista já abre neles (senão a pessoa vê "nenhuma conversa" e desiste)
  const box = conversations.length === 0 && requests > 0 ? "requests" : "inbox";
  const initial = box === "requests" ? await listConversations(user.id, "requests") : conversations;
  return <ChatShell list={<ConversationList initial={initial} initialRequests={requests} initialBox={box} />}>{children}</ChatShell>;
}
