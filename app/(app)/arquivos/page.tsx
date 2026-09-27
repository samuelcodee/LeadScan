import type { Metadata } from "next";
import Link from "next/link";
import { FolderOpen } from "lucide-react";
import { EmptyState, PageHeader } from "@/components/common/page-header";
import { FileGrid, StorageMeter, UploadButton } from "@/components/files/file-library";
import { requireUser } from "@/lib/auth/session";
import { listFiles, storageUsage, type FileFilter } from "@/lib/media/files";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Arquivos" };

const TABS: { id: FileFilter; label: string }[] = [
  { id: "todos", label: "Tudo" },
  { id: "fotos", label: "Fotos" },
  { id: "videos", label: "Vídeos" },
  { id: "audios", label: "Áudios" },
];

/**
 * Fotos, vídeos e áudios guardados na plataforma. Fotos passam pela moderação e aparecem
 * como sugestão no estúdio dos protótipos; vídeos e áudios ficam privados (só você abre).
 */
export default async function FilesPage(props: PageProps<"/arquivos">) {
  const user = await requireUser();
  const { tipo } = await props.searchParams;
  const filter: FileFilter = TABS.some((t) => t.id === tipo) ? (tipo as FileFilter) : "todos";
  const [files, usage] = await Promise.all([listFiles(user.id, filter), storageUsage(user.id)]);
  const count: Record<FileFilter, number> = { todos: usage.photos + usage.videos + usage.audios, fotos: usage.photos, videos: usage.videos, audios: usage.audios };

  return (
    <div className="mx-auto max-w-6xl px-4 py-6 sm:px-6 sm:py-8">
      <PageHeader
        title="Arquivos"
        description="Fotos dos clientes, vídeos e áudios num lugar só. As fotos aparecem como sugestão no estúdio dos protótipos."
        actions={<UploadButton />}
      />
      <div className="mt-6 flex flex-wrap items-end justify-between gap-4 border-b">
        <nav className="flex gap-1 overflow-x-auto [scrollbar-width:none]" aria-label="Tipos de arquivo">
          {TABS.map((t) => (
            <Link
              key={t.id}
              href={t.id === "todos" ? "/arquivos" : `/arquivos?tipo=${t.id}`}
              scroll={false}
              aria-current={filter === t.id ? "page" : undefined}
              className={cn(
                "-mb-px inline-flex shrink-0 items-center gap-1.5 border-b-2 px-3 py-2 text-sm font-medium transition-colors duration-150",
                filter === t.id ? "border-foreground text-foreground" : "border-transparent text-muted-foreground hover:text-foreground",
              )}
            >
              {t.label}
              <span className="text-xs text-muted-foreground tabular">{count[t.id]}</span>
            </Link>
          ))}
        </nav>
        <div className="pb-2">
          <StorageMeter used={usage.used} quota={usage.quota} />
        </div>
      </div>

      <div className="mt-6">
        {files.length === 0 ? (
          <EmptyState icon={<FolderOpen />} title={filter === "todos" ? "Nenhum arquivo ainda" : "Nada deste tipo ainda"}>
            Envie fotos (até 6 MB), vídeos (até 40 MB) e áudios (até 20 MB). Fotos passam pela moderação; vídeos e áudios só você abre.
          </EmptyState>
        ) : (
          <FileGrid files={files.map((f) => ({ ...f, createdAt: f.createdAt.toISOString() }))} />
        )}
      </div>
    </div>
  );
}
