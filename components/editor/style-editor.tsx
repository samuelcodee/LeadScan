"use client";

import { useState } from "react";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { FONT_PAIR_CSS } from "@/lib/fonts";
import { TEMPLATE_LIST } from "@/lib/templates/registry";
import { palettesFor, STYLE_PRESETS, type StylePreset } from "@/lib/templates/styles";
import { FONT_PAIRS, type FontPairId } from "@/lib/templates/constants";
import type { SiteTheme } from "@/lib/templates/types";
import { cn } from "@/lib/utils";

/** Campo hex com rascunho local: dá pra digitar livremente, só aplica quando o valor é válido. */
function HexInput({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  const [draft, setDraft] = useState(value);
  const [prev, setPrev] = useState(value);
  if (prev !== value) {
    setPrev(value);
    setDraft(value);
  }
  return (
    <input
      value={draft}
      onChange={(e) => {
        const v = e.target.value.startsWith("#") ? e.target.value : `#${e.target.value}`;
        setDraft(v);
        if (/^#[0-9a-fA-F]{6}$/.test(v)) onChange(v.toLowerCase());
      }}
      className="h-9 w-24 rounded-md border border-input bg-transparent px-2 font-mono text-xs uppercase"
      aria-label={`${label} em hexadecimal`}
      maxLength={7}
      spellCheck={false}
    />
  );
}

function ColorField({ label, value, onChange, presets }: { label: string; value: string; onChange: (v: string) => void; presets: string[] }) {
  return (
    <div className="grid gap-2">
      <Label className="text-xs text-muted-foreground">{label}</Label>
      <div className="flex items-center gap-2">
        <label className="relative size-9 shrink-0 cursor-pointer overflow-hidden rounded-md border" style={{ background: value }}>
          <input type="color" value={value} onChange={(e) => onChange(e.target.value)} className="absolute inset-0 cursor-pointer opacity-0" aria-label={label} />
        </label>
        <HexInput label={label} value={value} onChange={onChange} />
        <div className="flex flex-wrap gap-1">
          {presets.map((c) => (
            <button
              key={c}
              type="button"
              onClick={() => onChange(c)}
              className={cn("size-6 rounded-full border", value.toLowerCase() === c.toLowerCase() && "ring-2 ring-foreground ring-offset-2 ring-offset-background")}
              style={{ background: c }}
              aria-label={`Usar ${c}`}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

export function StyleEditor({
  theme,
  templateId,
  onTheme,
  onApplyTemplateLook,
  onApplyStyle,
}: {
  theme: SiteTheme;
  templateId: string;
  onTheme: (t: SiteTheme) => void;
  onApplyTemplateLook: (templateId: string) => void;
  onApplyStyle: (preset: StylePreset) => void;
}) {
  const palettes = palettesFor(templateId);
  const primaries = [...new Set(TEMPLATE_LIST.map((t) => t.theme.primary))].slice(0, 7);
  const accents = [...new Set(TEMPLATE_LIST.map((t) => t.theme.accent))].slice(0, 7);
  return (
    <div className="grid gap-6">
      <div className="grid gap-2">
        <Label className="text-xs text-muted-foreground">Estilo pronto</Label>
        <div className="grid grid-cols-2 gap-2">
          {STYLE_PRESETS.map((p) => (
            <button
              key={p.id}
              type="button"
              onClick={() => onApplyStyle(p)}
              title={p.description}
              aria-pressed={theme.style === p.id}
              className={cn(
                "rounded-md border px-3 py-2 text-left transition-colors duration-150 hover:border-foreground/30",
                theme.style === p.id && "border-foreground ring-1 ring-foreground",
              )}
            >
              <span
                className="block truncate text-base leading-tight"
                style={{ fontFamily: FONT_PAIR_CSS[p.font].heading, textTransform: FONT_PAIR_CSS[p.font].uppercase ? "uppercase" : undefined }}
              >
                {p.label}
              </span>
              <span className="mt-0.5 block truncate text-[11px] text-muted-foreground">{p.description}</span>
            </button>
          ))}
        </div>
      </div>

      <div className="grid gap-2">
        <Label className="text-xs text-muted-foreground">Paletas para este segmento</Label>
        <div className="grid grid-cols-2 gap-2">
          {palettes.map((p) => {
            const on = theme.primary.toLowerCase() === p.primary.toLowerCase() && theme.accent.toLowerCase() === p.accent.toLowerCase();
            return (
              <button
                key={p.name}
                type="button"
                onClick={() => onTheme({ ...theme, primary: p.primary, accent: p.accent })}
                aria-pressed={on}
                className={cn("flex items-center gap-2 rounded-md border px-2.5 py-2 text-left text-xs hover:border-foreground/30", on && "border-foreground ring-1 ring-foreground")}
              >
                <span className="flex shrink-0">
                  <span className="size-4 rounded-full ring-2 ring-background" style={{ background: p.primary }} />
                  <span className="-ml-1.5 size-4 rounded-full ring-2 ring-background" style={{ background: p.accent }} />
                </span>
                <span className="truncate">{p.name}</span>
              </button>
            );
          })}
        </div>
      </div>
      <div className="grid gap-1.5">
        <Label className="text-xs text-muted-foreground">Visual do template</Label>
        <Select value={templateId} onValueChange={onApplyTemplateLook}>
          <SelectTrigger className="h-9 w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {TEMPLATE_LIST.map((t) => (
              <SelectItem key={t.id} value={t.id}>
                <span className="flex items-center gap-2">
                  <span className="size-3 rounded-full" style={{ background: t.theme.primary }} />
                  {t.label}
                </span>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <p className="text-xs text-muted-foreground">{TEMPLATE_LIST.find((t) => t.id === templateId)?.mood} Troca só cores e fontes; seus textos ficam.</p>
      </div>

      <ColorField label="Cor principal" value={theme.primary} onChange={(primary) => onTheme({ ...theme, primary })} presets={primaries} />
      <ColorField label="Cor de destaque" value={theme.accent} onChange={(accent) => onTheme({ ...theme, accent })} presets={accents} />

      <div className="grid gap-1.5">
        <Label className="text-xs text-muted-foreground">Fundo</Label>
        <ToggleGroup type="single" variant="outline" size="sm" value={theme.surface} onValueChange={(v) => v && onTheme({ ...theme, surface: v as SiteTheme["surface"] })} className="w-full">
          <ToggleGroupItem value="light" className="flex-1">Claro</ToggleGroupItem>
          <ToggleGroupItem value="tint" className="flex-1">Suave</ToggleGroupItem>
          <ToggleGroupItem value="dark" className="flex-1">Escuro</ToggleGroupItem>
        </ToggleGroup>
      </div>

      <div className="grid gap-1.5">
        <Label className="text-xs text-muted-foreground">Tipografia</Label>
        <div className="grid grid-cols-2 gap-2">
          {FONT_PAIRS.map((f: FontPairId) => (
            <button
              key={f}
              type="button"
              onClick={() => onTheme({ ...theme, font: f })}
              className={cn(
                "rounded-md border px-3 py-2 text-left transition-colors duration-150 hover:border-foreground/30",
                theme.font === f && "border-foreground ring-1 ring-foreground",
              )}
            >
              <span className="block truncate text-lg leading-tight" style={{ fontFamily: FONT_PAIR_CSS[f].heading, textTransform: FONT_PAIR_CSS[f].uppercase ? "uppercase" : undefined }}>
                Aa Bb
              </span>
              <span className="block truncate text-[11px] text-muted-foreground">{FONT_PAIR_CSS[f].label}</span>
            </button>
          ))}
        </div>
      </div>

      <div className="grid gap-1.5">
        <Label className="text-xs text-muted-foreground">Cantos</Label>
        <ToggleGroup type="single" variant="outline" size="sm" value={theme.radius} onValueChange={(v) => v && onTheme({ ...theme, radius: v as SiteTheme["radius"] })} className="w-full">
          <ToggleGroupItem value="none" className="flex-1">Retos</ToggleGroupItem>
          <ToggleGroupItem value="soft" className="flex-1">Suaves</ToggleGroupItem>
          <ToggleGroupItem value="round" className="flex-1">Redondos</ToggleGroupItem>
        </ToggleGroup>
      </div>
    </div>
  );
}
