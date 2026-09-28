"use client";

import { AreaField, ChoiceField, ImageField, ListEditor, TextField } from "@/components/editor/fields";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { TEMPLATE_LIST } from "@/lib/templates/registry";
import { HERO_LAYOUTS } from "@/lib/templates/constants";
import type { Section } from "@/lib/templates/types";

const HERO_LAYOUT_LABEL = { split: "Foto ao lado", overlay: "Foto de fundo", stacked: "Foto abaixo" } as const;

/** Todas as fotos da biblioteca (template atual primeiro) para troca rápida. */
function imagePool(templateId: string) {
  const current = TEMPLATE_LIST.find((t) => t.id === templateId);
  const all = TEMPLATE_LIST.flatMap((t) => [...t.images.hero, ...t.images.about, ...t.images.gallery]);
  const own = current ? [...current.images.hero, ...current.images.about, ...current.images.gallery] : [];
  const norm = (u: string) => u.split("?")[0];
  const seen = new Set<string>();
  return [...own, ...all].filter((u) => (seen.has(norm(u)) ? false : (seen.add(norm(u)), true))).slice(0, 12);
}

export function SectionEditor({
  section,
  templateId,
  onChange,
  leadPhotos = [],
}: {
  section: Section;
  templateId: string;
  onChange: (s: Section) => void;
  /** Fotos reais do negócio (Google) — aparecem primeiro nas sugestões. */
  leadPhotos?: string[];
}) {
  // Atualiza só o `data`, preservando o tipo (discriminated union)
  const set = <S extends Section>(s: S, patch: Partial<S["data"]>) => onChange({ ...s, data: { ...s.data, ...patch } } as Section);
  const pool = [...leadPhotos, ...imagePool(templateId)].slice(0, 16);

  switch (section.type) {
    case "hero": {
      const s = section;
      return (
        <div className="grid grid-cols-1 gap-4">
          <TextField label="Chamada acima do título" value={s.data.eyebrow} max={80} onChange={(v) => set(s, { eyebrow: v })} />
          <AreaField label="Título" value={s.data.title} max={120} rows={2} onChange={(v) => set(s, { title: v })} />
          <AreaField label="Subtítulo" value={s.data.subtitle} max={280} onChange={(v) => set(s, { subtitle: v })} />
          <div className="grid grid-cols-2 gap-3">
            <TextField label="Botão principal" value={s.data.ctaLabel} max={40} onChange={(v) => set(s, { ctaLabel: v })} />
            <TextField label="Link secundário" value={s.data.secondaryLabel} max={40} onChange={(v) => set(s, { secondaryLabel: v })} />
          </div>
          <ImageField label="Imagem" value={s.data.image} suggestions={pool} onChange={(v) => set(s, { image: v })} />
          <ChoiceField
            label="Posição da foto"
            value={s.data.layout}
            options={HERO_LAYOUTS.map((l) => ({ value: l, label: HERO_LAYOUT_LABEL[l] }))}
            onChange={(v) => set(s, { layout: v })}
          />
        </div>
      );
    }
    case "about": {
      const s = section;
      return (
        <div className="grid grid-cols-1 gap-4">
          <TextField label="Título" value={s.data.title} max={100} onChange={(v) => set(s, { title: v })} />
          <AreaField label="Texto" value={s.data.body} max={900} rows={6} onChange={(v) => set(s, { body: v })} />
          <ImageField label="Imagem" value={s.data.image} suggestions={pool} onChange={(v) => set(s, { image: v })} />
          <div className="grid gap-1.5">
            <Label className="text-xs text-muted-foreground">Destaques</Label>
            <ListEditor
              items={s.data.highlights}
              max={4}
              addLabel="Adicionar destaque"
              create={() => "Novo destaque"}
              onChange={(items) => set(s, { highlights: items })}
              render={(item, setItem) => <TextField label="Destaque" value={item} max={60} onChange={setItem} />}
            />
          </div>
        </div>
      );
    }
    case "services":
    case "benefits": {
      const s = section;
      return (
        <div className="grid grid-cols-1 gap-4">
          <TextField label="Título" value={s.data.title} max={100} onChange={(v) => set(s, { title: v })} />
          {s.type === "services" && <AreaField label="Subtítulo" value={s.data.subtitle} max={240} rows={2} onChange={(v) => set(s, { subtitle: v })} />}
          <ListEditor
            items={s.data.items}
            max={s.type === "services" ? 9 : 6}
            addLabel="Adicionar item"
            create={() => ({ title: "Novo item", description: "" })}
            onChange={(items) => set(s, { items })}
            render={(item, setItem) => (
              <>
                <TextField label="Nome" value={item.title} max={80} onChange={(v) => setItem({ ...item, title: v })} />
                <AreaField label="Descrição" value={item.description} max={280} rows={2} onChange={(v) => setItem({ ...item, description: v })} />
              </>
            )}
          />
        </div>
      );
    }
    case "gallery": {
      const s = section;
      return (
        <div className="grid grid-cols-1 gap-4">
          <TextField label="Título" value={s.data.title} max={100} onChange={(v) => set(s, { title: v })} />
          <ListEditor
            items={s.data.images}
            max={8}
            addLabel="Adicionar foto"
            create={() => pool[s.data.images.length % pool.length]}
            onChange={(images) => set(s, { images })}
            render={(item, setItem, i) => <ImageField compact label={`Foto ${i + 1}`} value={item} suggestions={pool.slice(0, 6)} onChange={setItem} />}
          />
        </div>
      );
    }
    case "testimonials": {
      const s = section;
      return (
        <div className="grid grid-cols-1 gap-4">
          <TextField label="Título" value={s.data.title} max={100} onChange={(v) => set(s, { title: v })} />
          <Label className="flex items-center justify-between gap-3 rounded-md border p-3 text-sm font-normal">
            <span>
              Marcar como ilustrativos
              <span className="block text-xs text-muted-foreground">Mostra um aviso no site. Desligue só com depoimentos reais.</span>
            </span>
            <Switch checked={s.data.illustrative} onCheckedChange={(v) => set(s, { illustrative: v })} />
          </Label>
          <ListEditor
            items={s.data.items}
            max={6}
            addLabel="Adicionar depoimento"
            create={() => ({ name: "Nome", text: "" })}
            onChange={(items) => set(s, { items })}
            render={(item, setItem) => (
              <>
                <TextField label="Nome" value={item.name} max={40} onChange={(v) => setItem({ ...item, name: v })} />
                <AreaField label="Depoimento" value={item.text} max={300} rows={3} onChange={(v) => setItem({ ...item, text: v })} />
              </>
            )}
          />
        </div>
      );
    }
    case "faq": {
      const s = section;
      return (
        <div className="grid grid-cols-1 gap-4">
          <TextField label="Título" value={s.data.title} max={100} onChange={(v) => set(s, { title: v })} />
          <ListEditor
            items={s.data.items}
            max={8}
            addLabel="Adicionar pergunta"
            create={() => ({ question: "Nova pergunta?", answer: "" })}
            onChange={(items) => set(s, { items })}
            render={(item, setItem) => (
              <>
                <TextField label="Pergunta" value={item.question} max={140} onChange={(v) => setItem({ ...item, question: v })} />
                <AreaField label="Resposta" value={item.answer} max={500} rows={3} onChange={(v) => setItem({ ...item, answer: v })} />
              </>
            )}
          />
        </div>
      );
    }
    case "location": {
      const s = section;
      return (
        <div className="grid grid-cols-1 gap-4">
          <TextField label="Título" value={s.data.title} max={100} onChange={(v) => set(s, { title: v })} />
          <AreaField label="Observação" value={s.data.note} max={240} rows={2} onChange={(v) => set(s, { note: v })} />
          <p className="text-xs text-muted-foreground">Endereço, horários e telefone vêm dos dados do lead.</p>
        </div>
      );
    }
    case "contact":
    case "cta": {
      const s = section;
      return (
        <div className="grid grid-cols-1 gap-4">
          <AreaField label="Título" value={s.data.title} max={120} rows={2} onChange={(v) => set(s, { title: v })} />
          <AreaField label="Subtítulo" value={s.data.subtitle} max={240} rows={2} onChange={(v) => set(s, { subtitle: v })} />
          <TextField label="Texto do botão" value={s.data.ctaLabel} max={40} onChange={(v) => set(s, { ctaLabel: v })} />
        </div>
      );
    }
  }
}
