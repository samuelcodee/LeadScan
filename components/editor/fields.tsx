"use client";

/* eslint-disable @next/next/no-img-element */
import { ArrowDown, ArrowUp, Check, Link2, Loader2, Plus, Trash2, Upload } from "lucide-react";
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
      <Input id={id} value={value} maxLength={max} placeholder={placeholder} onChange={(e) => onChange(e.target.value)} className="h-9 pointer-coarse:h-11" />
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

/** Escolha entre poucas opções com um toque (no lugar de um menu que abre por cima). */
export function ChoiceField<T extends string>({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: T;
  options: { value: T; label: string }[];
  onChange: (v: T) => void;
}) {
  return (
    <div className="grid gap-1.5">
      <span className="text-xs text-muted-foreground">{label}</span>
      <div role="radiogroup" aria-label={label} className="grid gap-1 rounded-lg bg-muted p-1" style={{ gridTemplateColumns: `repeat(${options.length}, minmax(0, 1fr))` }}>
        {options.map((o) => (
          <button
            key={o.value}
            type="button"
            role="radio"
            aria-checked={value === o.value}
            onClick={() => onChange(o.value)}
            className={cn(
              "min-h-8 rounded-md px-1.5 py-1 text-xs font-medium leading-tight text-muted-foreground transition-colors pointer-coarse:min-h-10",
              value === o.value && "bg-card text-foreground shadow-sm",
            )}
          >
            {o.label}
          </button>
        ))}
      </div>
    </div>
  );
}

/**
 * Troca de imagem: foto atual grande, "Enviar foto" do aparelho, sugestões em grade com um toque
 * e "Colar link" escondido até precisar (no celular o campo de link só atrapalhava).
 */
export function ImageField({
  label,
  value,
  onChange,
  suggestions,
  compact,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  suggestions: string[];
  /** Galeria: várias fotos seguidas, bloco mais baixo. */
  compact?: boolean;
}) {
  const [draft, setDraft] = useState(value);
  const [prev, setPrev] = useState(value);
  const [linkOpen, setLinkOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const file = useRef<HTMLInputElement>(null);
  const id = useId();
  // A imagem mudou por fora (sugestão, IA, outra versão): o rascunho do link acompanha
  if (prev !== value) {
    setPrev(value);
    setDraft(value);
  }
  const commit = (v: string) => {
    if (v && !/^https:\/\//i.test(v) && !INTERNAL_IMAGE_RE.test(v)) return setError("Use um link que comece com https://");
    setError(null);
    onChange(v);
  };
  const upload = async (f: File | undefined) => {
    if (!f) return;
    setUploading(true);
    setError(null);
    try {
      const blob = await shrinkImage(f, 1800);
      const form = new FormData();
      form.set("file", new File([blob], "foto.jpg", { type: blob.type || "image/jpeg" }));
      const r = await uploadSiteImage(form);
      if (!r.ok) return void setError(r.error);
      commit(r.data.url);
    } catch {
      setError("Não deu para ler essa foto. Tente outra (JPG, PNG ou WebP).");
    } finally {
      setUploading(false);
      if (file.current) file.current.value = "";
    }
  };
  return (
    <div className="grid grid-cols-1 gap-2">
      <span className="text-xs text-muted-foreground">{label}</span>
      <div className="flex gap-3">
        <div className={cn("relative shrink-0 overflow-hidden rounded-md border bg-muted", compact ? "h-14 w-20" : "h-20 w-28")}>
          {value && <img src={thumbUrl(value, 320)} alt="" className="size-full object-cover" />}
          {uploading && (
            <span className="absolute inset-0 grid place-items-center bg-background/70">
              <Loader2 className="size-5 animate-spin" aria-hidden />
            </span>
          )}
        </div>
        <div className="flex min-w-0 flex-1 flex-col justify-center gap-1.5">
          <input ref={file} type="file" accept="image/jpeg,image/png,image/webp" className="hidden" onChange={(e) => upload(e.target.files?.[0])} />
          <Button type="button" variant="outline" size="sm" onClick={() => file.current?.click()} disabled={uploading}>
            {uploading ? <Loader2 className="animate-spin" /> : <Upload />} {uploading ? "Enviando…" : "Enviar foto"}
          </Button>
          <Button type="button" variant="ghost" size="sm" onClick={() => setLinkOpen((o) => !o)} aria-expanded={linkOpen} aria-controls={id}>
            <Link2 /> {linkOpen ? "Fechar link" : "Colar link"}
          </Button>
        </div>
      </div>
      {linkOpen && (
        <div className="flex gap-2">
          <Input
            id={id}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                commit(draft.trim());
              }
            }}
            placeholder="https://…"
            className="h-9 pointer-coarse:h-11"
            aria-label={`Link da ${label.toLowerCase()}`}
            aria-invalid={!!error}
            inputMode="url"
            autoComplete="off"
          />
          <Button type="button" variant="outline" className="h-9 pointer-coarse:h-11" onClick={() => commit(draft.trim())} disabled={!draft.trim() || draft.trim() === value}>
            Usar
          </Button>
        </div>
      )}
      {error && <p className="text-xs text-destructive">{error}</p>}
      {suggestions.length > 0 && (
        <div className={cn("grid gap-1.5", compact ? "grid-cols-6" : "grid-cols-4")}>
          {suggestions.map((src) => {
            const on = value === src;
            return (
              <button
                key={src}
                type="button"
                onClick={() => commit(src)}
                aria-pressed={on}
                aria-label={on ? "Foto em uso" : "Usar esta foto"}
                className={cn(
                  "relative aspect-[4/3] overflow-hidden rounded-md bg-muted ring-offset-2 ring-offset-background transition-opacity",
                  on ? "ring-2 ring-foreground" : "opacity-85 hover:opacity-100",
                )}
              >
                <img src={thumbUrl(src, 160)} alt="" className="size-full object-cover" loading="lazy" decoding="async" />
                {on && (
                  <span className="absolute right-1 top-1 grid size-4 place-items-center rounded-full bg-foreground text-background">
                    <Check className="size-3" aria-hidden />
                  </span>
                )}
              </button>
            );
          })}
        </div>
      )}
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
    <div className="grid grid-cols-1 gap-2">
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
