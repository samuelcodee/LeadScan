"use client";

import { Download, ExternalLink, ImagePlus, Loader2, PlugZap, Sparkles, WandSparkles } from "lucide-react";
import Link from "next/link";
import { useTransition } from "react";
import { toast } from "sonner";
import { aiCoverImage, aiRewriteSite } from "@/app/actions/ai";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { HANDOFF_TOOLS } from "@/lib/ai/catalog";
import { claudeCodeBrief, siteBrief, videoBrief } from "@/lib/templates/brief";
import type { SiteSpec } from "@/lib/templates/types";

export type StudioAi = { connected: { id: string; name: string }[]; defaultId: string | null; imageProviders: { id: "gemini" | "openai"; label: string }[]; base: string };

export function AiMenu({ prototypeId, spec, ai, onSpec }: { prototypeId: string; spec: SiteSpec; ai: StudioAi; onSpec: (s: SiteSpec, message: string) => void }) {
  const [pending, start] = useTransition();
  const def = ai.connected.find((c) => c.id === ai.defaultId) ?? ai.connected[0];

  const rewrite = (provider: string) =>
    start(async () => {
      const r = await aiRewriteSite({ id: prototypeId, provider });
      if (!r.ok) return void toast.error(r.error);
      onSpec(r.data.spec, `Textos reescritos com ${ai.connected.find((c) => c.id === provider)?.name ?? "IA"}`);
    });

  const cover = (provider: "gemini" | "openai") =>
    start(async () => {
      toast.message("Gerando a imagem… leva uns 10 a 30 segundos.");
      const r = await aiCoverImage({ id: prototypeId, provider });
      if (!r.ok) return void toast.error(r.error);
      const sections = spec.sections.map((s) => (s.type === "hero" ? { ...s, data: { ...s.data, image: r.data.url } } : s));
      onSpec({ ...spec, sections }, "Nova imagem de capa aplicada");
    });

  const handoff = async (toolId: string) => {
    const tool = HANDOFF_TOOLS.find((t) => t.id === toolId)!;
    const text = tool.kind === "video" ? videoBrief(spec) : siteBrief(spec, { base: ai.base, compact: tool.prefill });
    await navigator.clipboard.writeText(text).catch(() => {});
    window.open(tool.url(text), "_blank", "noopener,noreferrer");
    toast.success(tool.prefill ? `Abrindo ${tool.name} com o briefing. (Também copiado.)` : `Briefing copiado. Cole no ${tool.name}.`);
  };

  const download = () => {
    const blob = new Blob([claudeCodeBrief(spec, { base: ai.base })], { type: "text/markdown;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "briefing-site.md";
    a.click();
    URL.revokeObjectURL(url);
    toast.success("briefing-site.md baixado. No terminal: claude \"Leia briefing-site.md e construa este site\"");
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" disabled={pending} aria-label="Inteligência artificial" className="max-sm:size-10 max-sm:px-0">
          {pending ? <Loader2 className="animate-spin" /> : <Sparkles />} <span className="hidden sm:inline">IA</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-72">
        {ai.connected.length === 0 ? (
          <DropdownMenuItem asChild>
            <Link href="/integracoes">
              <PlugZap /> Conectar Claude, ChatGPT, Gemini…
            </Link>
          </DropdownMenuItem>
        ) : (
          <>
            <DropdownMenuLabel>Com a sua IA</DropdownMenuLabel>
            <DropdownMenuItem onSelect={() => rewrite(def.id)}>
              <WandSparkles /> Reescrever todos os textos ({def.name})
            </DropdownMenuItem>
            {ai.connected
              .filter((c) => c.id !== def.id)
              .map((c) => (
                <DropdownMenuItem key={c.id} onSelect={() => rewrite(c.id)} className="pl-8 text-muted-foreground">
                  …ou com {c.name}
                </DropdownMenuItem>
              ))}
            {ai.imageProviders.map((p) => (
              <DropdownMenuItem key={p.id} onSelect={() => cover(p.id)}>
                <ImagePlus /> Gerar imagem de capa ({p.label})
              </DropdownMenuItem>
            ))}
          </>
        )}
        <DropdownMenuSeparator />
        <DropdownMenuLabel>Levar para…</DropdownMenuLabel>
        {HANDOFF_TOOLS.map((t) => (
          <DropdownMenuItem key={t.id} onSelect={() => handoff(t.id)}>
            <ExternalLink /> {t.name}
            <span className="ml-auto text-[11px] text-muted-foreground">{t.kind === "video" ? "vídeo" : t.prefill ? "" : "copiar"}</span>
          </DropdownMenuItem>
        ))}
        <DropdownMenuItem onSelect={download}>
          <Download /> Baixar briefing para Claude Code
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
