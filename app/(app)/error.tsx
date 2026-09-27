"use client";

import { RotateCcw } from "lucide-react";
import { useEffect } from "react";
import { Button } from "@/components/ui/button";

export default function AppError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);
  return (
    <div className="grid min-h-[60dvh] place-items-center px-4 text-center">
      <div className="max-w-sm">
        <p className="font-medium">Algo não carregou direito.</p>
        <p className="mt-1 text-sm text-muted-foreground">
          Pode ser a conexão com o banco. Tente de novo; se continuar, confira se o banco local está rodando (<code className="font-mono">npm run db:start</code>).
        </p>
        {error.digest && <p className="mt-2 font-mono text-xs text-muted-foreground">ref: {error.digest}</p>}
        <Button className="mt-5" onClick={reset}>
          <RotateCcw /> Tentar de novo
        </Button>
      </div>
    </div>
  );
}
