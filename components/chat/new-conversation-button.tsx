"use client";

import { PenSquare } from "lucide-react";
import { useState } from "react";
import { NewConversationDialog } from "@/components/chat/conversation-list";
import { Button } from "@/components/ui/button";

export function NewConversationButton({ className }: { className?: string }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button className={className} onClick={() => setOpen(true)}>
        <PenSquare /> Nova conversa
      </Button>
      <NewConversationDialog open={open} onOpenChange={setOpen} />
    </>
  );
}
