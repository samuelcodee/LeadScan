"use client";

/* eslint-disable @next/next/no-img-element */
import { ArrowDown, ArrowUp, Loader2, Plus, Trash2, Upload } from "lucide-react";
import { useId, useRef, useState } from "react";
import { uploadSiteImage } from "@/app/actions/media";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { shrinkImage } from "@/lib/client/image";
import { INTERNAL_IMAGE_RE } from "@/lib/templates/constants";
import { thumbUrl } from "@/lib/media/thumb";
import { cn } from "@/lib/utils";

export function TextField({
  label,
  value,
  onChange,
  max,
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  max?: number;
  placeholder?: string;
}) {
  const id = useId();
  return (
    <div className="grid gap-1.5">
      <Label htmlFor={id} className="text-xs text-muted-foreground">
        {label}
      </Label>
      <Input id={id} value={value} maxLength={max} placeholder={placeholder} onChange={(e) => onChange(e.target.value)} className="h-9" />
    </div>
  );
}

export function AreaField({ label, value, onChange, max, rows = 3 }: { label: string; value: string; onChange: (v: string) => void; max?: number; rows?: number }) {
  const id = useId();
  return (
    <div className="grid gap-1.5">
      <div className="flex items-center justify-between">
        <Label htmlFor={id} className="text-xs text-muted-foreground">
          {label}
        </Label>
        {max && <span className="text-[11px] text-muted-foreground tabular">{value.length}/{max}</span>}
      </div>
      <Textarea id={id} value={value} maxLength={max} rows={rows} onChange={(e) => onChange(e.target.value)} className="resize-y text-sm" />
    </div>
  );
}

/** Troca de imagem: enviar foto do cliente, colar um link https ou escolher uma sugestão. */
export function ImageField({ label, value, onChange, suggestions }: { label: string; value: string; onChange: (v: string) => void; suggestions: string[] }) {
  const [draft, setDraft] = useState(value);
  const [error, setError] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const file = useRef<HTMLInputElement>(null);
  const id = useId();
  const commit = (v: string) => {
    if (v && !/^https:\/\//i.test(v) && !INTERNAL_IMAGE_RE.test(v)) return setError("Use um link que comece com https://");
    setError(null);
    onChange(v);
  };
  const upload = async (f: File | undefined) => {
    if (!f) return;
    setUploading(true);
    try {
      const blob = await shrinkImage(f, 1800);
      const form = new FormData();
      form.set("file", new File([blob], "foto.jpg", { type: blob.type || "image/jpeg" }));
      const r = await uploadSiteImage(form);
      if (!r.ok) return void setError(r.error);
      setDraft(r.data.url);
      commit(r.data.url);
    } finally {
      setUploading(false);
      if (file.current) file.current.value = "";
    }
  };
  return (
    <div className="grid gap-2">
      <Label htmlFor={id} className="text-xs text-muted-foreground">
        {label}
      </Label>
      <div className="flex gap-2">
        {value ? (
          <img src={thumbUrl(value, 160)} alt="" className="size-9 shrink-0 rounded-md object-cover" />
        ) : (
          <span className="size-9 shrink-0 rounded-md bg-muted" />
        )}
        <Input
          id={id}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={() => draft !== value && commit(draft.trim())}
          onKeyDown={(e) => e.key === "Enter" && commit(draft.trim())}
          placeholder="https://…"
          className="h-9"
          aria-invalid={!!error}
        />
        <input ref={file} type="file" accept="image/jpeg,image/png,image/webp" className="hidden" onChange={(e) => upload(e.target.files?.[0])} />
        <Button
          type="button"
          variant="outline"
          size="icon"
          className="size-9 shrink-0"
          onClick={() => file.current?.click()}
          disabled={uploading}
          aria-label="Enviar foto do cliente"
          title="Enviar foto do cliente"
        >
          {uploading ? <Loader2 className="animate-spin" /> : <Upload />}
        </Button>
      </div>
      {error && <p className="text-xs text-destructive">{error}</p>}
      <div className="flex flex-wrap gap-1.5">
        {suggestions.map((src) => (
          <button
            key={src}
            type="button"
            onClick={() => {
              setDraft(src);
              commit(src);
            }}
            className={cn("overflow-hidden rounded-md ring-offset-2 ring-offset-background", value === src ? "ring-2 ring-foreground" : "opacity-80 hover:opacity-100")}
            aria-label="Usar esta foto"
          >
            <img src={thumbUrl(src, 160)} alt="" className="h-10 w-14 object-cover" loading="lazy" />
          </button>
        ))}
      </div>
    </div>
  );
}

/** Editor de listas (serviços, depoimentos, FAQ…): adicionar, remover e reordenar. */
export function ListEditor<T>({
  items,
  onChange,
  render,
  create,
  max,
  addLabel,
}: {
  items: T[];
  onChange: (items: T[]) => void;
  render: (item: T, set: (next: T) => void, index: number) => React.ReactNode;
  create: () => T;
  max: number;
  addLabel: string;
}) {
  const move = (i: number, d: -1 | 1) => {
    const next = [...items];
    [next[i], next[i + d]] = [next[i + d], next[i]];
    onChange(next);
  };
  return (
    <div className="grid gap-2">
      {items.map((item, i) => (
        <div key={i} className="rounded-md border bg-background p-2.5">
          <div className="grid gap-2">{render(item, (next) => onChange(items.map((x, j) => (j === i ? next : x))), i)}</div>
          <div className="mt-2 flex justify-end gap-1">
            <Button variant="ghost" size="icon-xs" disabled={i === 0} onClick={() => move(i, -1)} aria-label="Subir">
              <ArrowUp />
            </Button>
            <Button variant="ghost" size="icon-xs" disabled={i === items.length - 1} onClick={() => move(i, 1)} aria-label="Descer">
              <ArrowDown />
            </Button>
            <Button variant="ghost" size="icon-xs" onClick={() => onChange(items.filter((_, j) => j !== i))} aria-label="Remover">
              <Trash2 />
            </Button>
          </div>
        </div>
      ))}
      {items.length < max && (
        <Button variant="outline" size="sm" onClick={() => onChange([...items, create()])}>
          <Plus /> {addLabel}
        </Button>
      )}
    </div>
  );
}
