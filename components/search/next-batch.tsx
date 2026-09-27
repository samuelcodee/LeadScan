"use client";

import { ArrowRight, CheckCircle2, Loader2 } from "lucide-react";
import { SearchProgressBar } from "@/components/search/progress";
import { useSearchRunner, type SearchInput } from "@/components/search/use-search-runner";
import { Button } from "@/components/ui/button";

export type SweepLine = { label: string; city: string; found: number; exhausted: boolean };

/**
 * Faixa abaixo do título dos resultados: quanto já foi varrido de cada cidade e o botão que
 * busca a próxima leva (mesma busca: a varredura continua de onde parou, sem repetir ninguém).
 */
export function NextBatch({ input, sweeps, regional }: { input: SearchInput; sweeps: SweepLine[]; regional: boolean }) {
  const { run, progress, pending } = useSearchRunner();
  const allDone = !regional && sweeps.length > 0 && sweeps.every((s) => s.exhausted);

  return (
    <div className="mb-3 rounded-lg border bg-card px-3 py-2.5">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
        <ul className="flex min-w-0 flex-1 flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
          {regional ? (
            <li>Busca geral: cada nova busca segue por outras cidades, sem repetir empresa.</li>
          ) : (
            sweeps.map((s) => (
              <li key={s.label + s.city} className="inline-flex items-center gap-1.5">
                {s.exhausted && <CheckCircle2 className="size-3.5 text-success" aria-hidden />}
                <span>
                  {s.label} em {s.city}: <span className="font-medium text-foreground tabular">{s.found}</span> empresas já vistas
                  {s.exhausted ? " · varredura completa" : " · ainda há mais"}
                </span>
              </li>
            ))
          )}
        </ul>
        <Button size="sm" variant={allDone ? "outline" : "default"} disabled={pending || allDone} onClick={() => run(input)}>
          {pending ? <Loader2 className="animate-spin" /> : allDone ? <CheckCircle2 /> : <ArrowRight />}
          {allDone ? "Cidade toda varrida" : `Próximas ${input.limit}`}
        </Button>
      </div>
      {progress && <SearchProgressBar progress={progress} label="Buscando a próxima leva" />}
    </div>
  );
}
