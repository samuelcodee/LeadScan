import type { Metadata } from "next";
import { MessageCircle } from "lucide-react";
import { NewConversationButton } from "@/components/chat/new-conversation-button";

export const metadata: Metadata = { title: "Mensagens" };

/** No desktop, o lado direito vazio até escolher uma conversa (no celular a lista ocupa a tela). */
export default function MessagesPage() {
  return (
    <div className="grid flex-1 place-items-center p-8 text-center">
      <div className="max-w-sm">
        <span className="mx-auto grid size-14 place-items-center rounded-2xl bg-ink text-lime">
          <MessageCircle className="size-6" />
        </span>
        <h2 className="mt-4 text-lg font-semibold">Suas conversas</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Escolha uma conversa à esquerda ou comece outra. Dá para mandar texto, foto, vídeo e áudio.
        </p>
        <NewConversationButton className="mt-5" />
      </div>
    </div>
  );
}
