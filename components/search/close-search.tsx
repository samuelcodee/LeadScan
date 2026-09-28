"use client";

import { Loader2, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { toast } from "sonner";
import { closeSearch } from "@/app/actions/search";
import { Button } from "@/components/ui/button";

/**
 * Único jeito de a busca sair da tela: trocar de aba não fecha (Buscar leads volta nela).
 * Fechada, continua em Buscas recentes e reabre com um toque.
 */
export function CloseSearchButton({ id }: { id: string }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  return (
    <Button
      variant="outline"
      size="sm"
      disabled={pending}
      onClick={() =>
        start(async () => {
          const r = await closeSearch({ id });
          if (!r.ok) return void toast.error(r.error);
          toast.success("Busca fechada. Ela continua em Buscas recentes.");
          router.push("/search");
        })
      }
    >
      {pending ? <Loader2 className="animate-spin" /> : <X />}
      Fechar busca
    </Button>
  );
}
