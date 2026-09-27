"use client";

import { Loader2, MessageCircle } from "lucide-react";
import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { toast } from "sonner";
import { startConversation } from "@/app/actions/chat";
import { Button } from "@/components/ui/button";

/** "Mensagem" no perfil de alguém: abre (ou retoma) a conversa privada. */
export function MessageButton({ username, className }: { username: string; className?: string }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  return (
    <Button
      variant="ink"
      size="sm"
      className={className}
      disabled={pending}
      onClick={() =>
        start(async () => {
          const r = await startConversation({ username });
          if (!r.ok) return void toast.error(r.error);
          router.push(`/mensagens/${r.data.id}`);
        })
      }
    >
      {pending ? <Loader2 className="animate-spin" /> : <MessageCircle />} Mensagem
    </Button>
  );
}
