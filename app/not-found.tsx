import Link from "next/link";
import { Button } from "@/components/ui/button";

export default function NotFound() {
  return (
    <main className="grid min-h-dvh place-items-center px-4 text-center">
      <div>
        <p className="font-mono text-sm text-muted-foreground">404</p>
        <h1 className="mt-2 text-xl font-semibold">Não encontramos esta página.</h1>
        <p className="mt-1 text-sm text-muted-foreground">Se era um link de proposta, ele pode ter sido desativado.</p>
        <Button asChild className="mt-6" variant="outline">
          <Link href="/dashboard">Ir para o início</Link>
        </Button>
      </div>
    </main>
  );
}
