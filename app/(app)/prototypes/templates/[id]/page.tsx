import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, ChevronLeft, ChevronRight } from "lucide-react";
import { TemplateViewer } from "@/components/prototypes/template-viewer";
import { Button } from "@/components/ui/button";
import { requireUser } from "@/lib/auth/session";
import { TEMPLATE_LIST, TEMPLATES } from "@/lib/templates/registry";
import { sampleSpec, templateUsedBy } from "@/lib/templates/sample";

export async function generateMetadata(props: PageProps<"/prototypes/templates/[id]">): Promise<Metadata> {
  const { id } = await props.params;
  const t = TEMPLATES[id as keyof typeof TEMPLATES];
  return { title: t ? `Template ${t.label}` : "Template" };
}

/**
 * Template aberto em tela grande: o site de exemplo inteiro, com troca de dispositivo e
 * setas para o anterior/próximo. Os dados são fictícios — o protótipo de verdade sai do lead.
 */
export default async function TemplatePage(props: PageProps<"/prototypes/templates/[id]">) {
  await requireUser();
  const { id } = await props.params;
  const index = TEMPLATE_LIST.findIndex((t) => t.id === id);
  if (index < 0) notFound();
  const t = TEMPLATE_LIST[index];
  const prev = TEMPLATE_LIST[(index - 1 + TEMPLATE_LIST.length) % TEMPLATE_LIST.length];
  const next = TEMPLATE_LIST[(index + 1) % TEMPLATE_LIST.length];
  const usedBy = templateUsedBy(t);

  return (
    // sem a barra inferior do celular (ela some em /prototypes/*): a prévia usa a tela toda
    <div data-fullbleed className="flex h-[calc(100dvh-3.5rem-1px)] flex-col">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2 border-b px-4 py-3 sm:px-6">
        <Button asChild variant="ghost" size="sm" className="-ml-2">
          <Link href="/prototypes?tab=templates">
            <ArrowLeft /> Templates
          </Link>
        </Button>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="size-3 shrink-0 rounded-full" style={{ background: t.theme.primary }} aria-hidden />
            <h1 className="truncate font-semibold">{t.label}</h1>
            <span className="hidden shrink-0 text-xs text-muted-foreground tabular sm:inline">
              {index + 1} de {TEMPLATE_LIST.length}
            </span>
          </div>
          <p className="truncate text-xs text-muted-foreground">
            {t.mood}
            {usedBy.length > 0 && ` · Usado em: ${usedBy.join(", ")}`}
          </p>
        </div>
        <div className="flex items-center gap-1">
          <Button asChild variant="outline" size="icon-sm" aria-label={`Anterior: ${prev.label}`} title={prev.label}>
            <Link href={`/prototypes/templates/${prev.id}`}>
              <ChevronLeft />
            </Link>
          </Button>
          <Button asChild variant="outline" size="icon-sm" aria-label={`Próximo: ${next.label}`} title={next.label}>
            <Link href={`/prototypes/templates/${next.id}`}>
              <ChevronRight />
            </Link>
          </Button>
        </div>
      </div>
      <p className="border-b bg-muted/40 px-4 py-2 text-xs text-muted-foreground sm:px-6">
        Empresa fictícia, só para mostrar o visual. Para usar: abra um lead e toque em “Criar protótipo”; no estúdio, troque para este template.
      </p>
      <TemplateViewer spec={sampleSpec(t)} />
    </div>
  );
}
