import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ChatThread } from "@/components/chat/thread";
import { requireUser } from "@/lib/auth/session";
import { getConversation, listMessages } from "@/lib/chat/service";

export const metadata: Metadata = { title: "Conversa" };

export default async function ConversationPage(props: PageProps<"/mensagens/[id]">) {
  const user = await requireUser();
  const { id } = await props.params;
  const conversation = await getConversation(user.id, id);
  if (!conversation) notFound();
  const page = await listMessages(user.id, id);
  return <ChatThread key={id} meId={user.id} initial={{ conversation, ...page }} />;
}
