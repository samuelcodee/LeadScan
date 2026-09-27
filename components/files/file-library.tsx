"use client";

import { Copy, Download, FileAudio, FileVideo, ImageIcon, Loader2, MoreHorizontal, Pencil, Trash2, Upload } from "lucide-react";
import { useRouter } from "next/navigation";
import { useRef, useState, useTransition } from "react";
import { toast } from "sonner";
import { deleteFileAction, renameFileAction } from "@/app/actions/files";
import { Button } from "@/components/ui/button";
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { shrinkImage } from "@/lib/client/image";
import { PART_BYTES, postForm, uploadInParts } from "@/lib/client/upload";
import { cn } from "@/lib/utils";

/* eslint-disable @next/next/no-img-element -- imagens do próprio app (/api/media), já otimizadas no envio */

export type LibraryFile = {
  id: string;
  kind: string;
  mime: string;
  size: number;
  width: number;
  height: number;
  name: string | null;
  source: string;
  createdAt: string;
};

const MAX_VIDEO = 40 * 1024 * 1024;
const MAX_AUDIO = 20 * 1024 * 1024;

export function formatBytes(n: number) {
  if (n < 1024 * 1024) return `${Math.max(1, Math.round(n / 1024))} KB`;
  return `${(n / 1024 / 1024).toFixed(n < 10 * 1024 * 1024 ? 1 : 0).replace(".", ",")} MB`;
}

const isPhoto = (f: LibraryFile) => f.kind === "SITE_IMAGE" || f.kind === "AI_IMAGE";
const urlOf = (f: LibraryFile) => (isPhoto(f) ? `/api/media/${f.id}` : `/api/files/${f.id}`);
const labelOf = (f: LibraryFile) => f.name || (isPhoto(f) ? (f.source === "upload" ? "Foto" : "Imagem gerada por IA") : f.kind === "FILE_VIDEO" ? "Vídeo" : "Áudio");

type Uploading = { key: string; name: string; progress: number };

/** Botão "Enviar arquivos": fotos, vídeos e áudios, vários de uma vez, com progresso. */
export function UploadButton() {
  const router = useRouter();
  const input = useRef<HTMLInputElement>(null);
  const [queue, setQueue] = useState<Uploading[]>([]);

  const setProgress = (key: string, progress: number) => setQueue((q) => q.map((u) => (u.key === key ? { ...u, progress } : u)));

  const sendOne = async (file: File) => {
    const key = `${file.name}-${file.size}-${Math.random()}`;
    const kind = file.type.startsWith("image/") ? "image" : file.type.startsWith("video/") ? "video" : file.type.startsWith("audio/") ? "audio" : null;
    if (!kind) return void toast.error(`${file.name}: envie foto, vídeo ou áudio.`);
    if (kind === "video" && file.size > MAX_VIDEO) return void toast.error(`${file.name}: vídeo acima de 40 MB.`);
    if (kind === "audio" && file.size > MAX_AUDIO) return void toast.error(`${file.name}: áudio acima de 20 MB.`);
    setQueue((q) => [...q, { key, name: file.name, progress: 0 }]);
    try {
      const form = new FormData();
      form.set("kind", kind);
      form.set("name", file.name);
      if (kind === "image") {
        const blob = await shrinkImage(file, 1600);
        form.set("file", new File([blob], file.name, { type: blob.type || "image/jpeg" }));
      } else if (file.size > PART_BYTES) {
        form.set("upload", await uploadInParts(`/api/files/part?kind=${kind}&name=${encodeURIComponent(file.name)}`, file, (p) => setProgress(key, p)));
      } else {
        form.set("file", file);
      }
      await postForm("/api/files", form, (p) => setProgress(key, kind === "image" || file.size <= PART_BYTES ? p : 0.95 + p * 0.05));
      toast.success(`${file.name} enviado.`);
    } catch (err) {
      toast.error(`${file.name}: ${err instanceof Error ? err.message : "não deu para enviar."}`);
    } finally {
      setQueue((q) => q.filter((u) => u.key !== key));
    }
  };

  const onPick = async (files: FileList | null) => {
    if (!files?.length) return;
    // um por vez: não disputa a banda nem estoura o limite de envios
    for (const f of Array.from(files).slice(0, 20)) await sendOne(f);
    router.refresh();
  };

  return (
    <div className="grid justify-items-end gap-2">
      <input ref={input} type="file" accept="image/*,video/*,audio/*" multiple hidden onChange={(e) => void onPick(e.target.files).finally(() => (e.target.value = ""))} />
      <Button onClick={() => input.current?.click()} disabled={queue.length > 0}>
        {queue.length ? <Loader2 className="animate-spin" /> : <Upload />} Enviar arquivos
      </Button>
      {queue.map((u) => (
        <div key={u.key} className="w-64 max-w-full" role="status" aria-live="polite">
          <p className="truncate text-xs text-muted-foreground">
            Enviando {u.name} · {Math.round(u.progress * 100)}%
          </p>
          <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-muted">
            <div className="h-full bg-chart-1 transition-[width] duration-200" style={{ width: `${u.progress * 100}%` }} />
          </div>
        </div>
      ))}
    </div>
  );
}

export function FileGrid({ files }: { files: LibraryFile[] }) {
  const [viewing, setViewing] = useState<LibraryFile | null>(null);
  return (
    <>
      <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
        {files.map((f) => (
          <FileCard key={f.id} f={f} onOpen={() => setViewing(f)} />
        ))}
      </ul>
      <Dialog open={!!viewing} onOpenChange={(o) => !o && setViewing(null)}>
        <DialogContent className="sm:max-w-3xl">
          <DialogTitle className="truncate pr-6">{viewing ? labelOf(viewing) : ""}</DialogTitle>
          {viewing && isPhoto(viewing) && <img src={urlOf(viewing)} alt={labelOf(viewing)} className="max-h-[75dvh] w-full rounded-md object-contain" />}
          {viewing?.kind === "FILE_VIDEO" && <video src={urlOf(viewing)} controls autoPlay playsInline className="max-h-[75dvh] w-full rounded-md bg-black" />}
          {viewing?.kind === "FILE_AUDIO" && <audio src={urlOf(viewing)} controls autoPlay className="w-full" />}
        </DialogContent>
      </Dialog>
    </>
  );
}

function FileCard({ f, onOpen }: { f: LibraryFile; onOpen: () => void }) {
  const [renaming, setRenaming] = useState(false);
  const [confirm, setConfirm] = useState(false);
  const [name, setName] = useState(f.name ?? "");
  const [pending, start] = useTransition();
  const photo = isPhoto(f);

  const copyLink = () =>
    navigator.clipboard
      .writeText(new URL(urlOf(f), window.location.origin).toString())
      .then(() => toast.success(photo ? "Link da foto copiado. Dá para usar nos sites." : "Link copiado (só abre para você, logado)."));

  return (
    <li className="group relative overflow-hidden rounded-lg border bg-card shadow-soft">
      <button type="button" onClick={onOpen} className="block w-full text-left" aria-label={`Abrir ${labelOf(f)}`}>
        <div className="grid aspect-[4/3] place-items-center overflow-hidden bg-muted">
          {photo ? (
            <img src={urlOf(f)} alt="" loading="lazy" className="size-full object-cover transition-transform duration-200 group-hover:scale-[1.02]" />
          ) : f.kind === "FILE_VIDEO" ? (
            // #t=0.1 faz o navegador mostrar um quadro do vídeo como capa
            <video src={`${urlOf(f)}#t=0.1`} preload="metadata" muted playsInline className="pointer-events-none size-full object-cover" />
          ) : (
            <FileAudio className="size-10 text-muted-foreground" aria-hidden />
          )}
        </div>
      </button>
      <div className="flex items-start gap-1 p-3">
        <span className="mt-0.5 shrink-0 text-muted-foreground" aria-hidden>
          {photo ? <ImageIcon className="size-4" /> : f.kind === "FILE_VIDEO" ? <FileVideo className="size-4" /> : <FileAudio className="size-4" />}
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium" title={labelOf(f)}>
            {labelOf(f)}
          </p>
          <p className="text-xs text-muted-foreground tabular">
            {formatBytes(f.size)}
            {photo && f.width ? ` · ${f.width}×${f.height}` : ""}
          </p>
        </div>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon-sm" className="-mr-1.5 -mt-1" aria-label={`Opções de ${labelOf(f)}`} disabled={pending}>
              {pending ? <Loader2 className="animate-spin" /> : <MoreHorizontal />}
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onSelect={() => void copyLink()}>
              <Copy /> Copiar link
            </DropdownMenuItem>
            <DropdownMenuItem asChild>
              <a href={photo ? urlOf(f) : `${urlOf(f)}?download=1`} download={f.name ?? true}>
                <Download /> Baixar
              </a>
            </DropdownMenuItem>
            <DropdownMenuItem onSelect={() => setRenaming(true)}>
              <Pencil /> Renomear
            </DropdownMenuItem>
            <DropdownMenuItem variant="destructive" onSelect={() => setConfirm(true)}>
              <Trash2 /> Apagar
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <Dialog open={renaming} onOpenChange={(o) => !pending && setRenaming(o)}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Renomear</DialogTitle>
          </DialogHeader>
          <form
            className="grid gap-4"
            onSubmit={(e) => {
              e.preventDefault();
              start(async () => {
                const r = await renameFileAction({ id: f.id, name });
                if (!r.ok) return void toast.error(r.error);
                setRenaming(false);
              });
            }}
          >
            <Input value={name} onChange={(e) => setName(e.target.value)} maxLength={120} autoFocus aria-label="Nome do arquivo" />
            <DialogFooter>
              <Button type="submit" disabled={pending}>
                Salvar
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={confirm} onOpenChange={(o) => !pending && setConfirm(o)}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Apagar {labelOf(f)}?</DialogTitle>
            <DialogDescription>
              {photo ? "Se esta foto estiver em algum protótipo, ela some de lá também. " : ""}Não dá para desfazer.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <DialogClose asChild>
              <Button variant="outline" disabled={pending}>
                Cancelar
              </Button>
            </DialogClose>
            <Button
              variant="destructive"
              disabled={pending}
              onClick={() =>
                start(async () => {
                  const r = await deleteFileAction({ id: f.id });
                  if (!r.ok) return void toast.error(r.error);
                  setConfirm(false);
                  toast.success("Arquivo apagado.");
                })
              }
            >
              <Trash2 /> Apagar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </li>
  );
}

export function StorageMeter({ used, quota }: { used: number; quota: number }) {
  const pct = Math.min(1, used / quota);
  return (
    <div className="w-60 max-w-full">
      <p className="flex justify-between gap-3 text-xs text-muted-foreground">
        <span>Espaço usado</span>
        <span className="tabular">
          {formatBytes(used)} de {formatBytes(quota)}
        </span>
      </p>
      <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-muted" role="progressbar" aria-valuenow={Math.round(pct * 100)} aria-valuemin={0} aria-valuemax={100} aria-label="Espaço usado">
        <div className={cn("h-full", pct > 0.9 ? "bg-destructive" : "bg-chart-1")} style={{ width: `${pct * 100}%` }} />
      </div>
    </div>
  );
}
