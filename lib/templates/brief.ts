import type { FontPairId, SiteSpec } from "@/lib/templates/types";

// Descrição das fontes para outra IA (sem importar next/font: este módulo roda em qualquer lugar)
const FONT_TEXT: Record<FontPairId, string> = {
  marcellus: "serifa clássica elegante (ex.: Marcellus)",
  bricolage: "sans com personalidade (ex.: Bricolage Grotesque)",
  anton: "condensada forte em caixa alta (ex.: Anton)",
  playfair: "serifa editorial (ex.: Playfair Display)",
  cormorant: "serifa refinada (ex.: Cormorant Garamond)",
  manrope: "sans limpa e neutra (ex.: Manrope)",
  nunito: "arredondada amigável (ex.: Nunito)",
  sora: "geométrica (ex.: Sora)",
};

/**
 * Briefing do site em texto — o mesmo SiteSpec do estúdio, escrito para outra IA
 * construir o site (Lovable, Bolt, v0, Claude, ChatGPT, Cursor, Claude Code…).
 * Só fatos do negócio que já estão no protótipo; nada inventado.
 */
export function siteBrief(spec: SiteSpec, opts: { base: string; compact?: boolean }) {
  const b = spec.business;
  const abs = (u: string) => (u.startsWith("/") ? `${opts.base}${u}` : u);
  const lines: string[] = [];
  lines.push(`Crie um site de uma página (landing page), responsivo e rápido, para "${b.name}", ${b.categoryLabel.toLowerCase()} em ${b.city} - ${b.state}.`);
  lines.push(`Idioma: português do Brasil. Tom humano e direto, sem clichês de marketing. Não invente números, prêmios, depoimentos reais ou anos de mercado.`);
  lines.push("");
  lines.push(`## Identidade visual`);
  lines.push(`- Cor principal ${spec.theme.primary}, cor de destaque ${spec.theme.accent}, fundo ${spec.theme.surface === "dark" ? "escuro" : spec.theme.surface === "tint" ? "levemente tingido pela cor principal" : "claro"}.`);
  lines.push(`- Tipografia: ${FONT_TEXT[spec.theme.font]} nos títulos; texto corrido legível. Cantos ${spec.theme.radius === "none" ? "retos" : spec.theme.radius === "soft" ? "levemente arredondados" : "bem arredondados"}.`);
  lines.push("");
  lines.push(`## Dados reais do negócio`);
  if (b.address) lines.push(`- Endereço: ${b.address}`);
  if (b.neighborhood) lines.push(`- Bairro: ${b.neighborhood}`);
  if (b.whatsapp || b.phone) lines.push(`- WhatsApp/telefone: ${b.whatsapp ?? b.phone} (botão principal abre conversa no WhatsApp via wa.me)`);
  if (b.instagram) lines.push(`- Instagram: @${b.instagram}`);
  if (b.rating && b.reviewCount) lines.push(`- Nota no Google: ${b.rating} (${b.reviewCount} avaliações)`);
  if (b.hours.length) lines.push(`- Horários: ${b.hours.join("; ")}`);
  lines.push("");
  lines.push(`## Seções, nesta ordem`);
  for (const s of spec.sections.filter((x) => x.visible)) {
    const d = s.data as Record<string, unknown>;
    switch (s.type) {
      case "hero":
        lines.push(`1. Topo — título: "${d.title}". Subtítulo: "${d.subtitle}". Botão: "${d.ctaLabel}".${d.image ? ` Imagem de fundo: ${abs(String(d.image))}` : ""}`);
        break;
      case "services":
        lines.push(`- ${d.title}: ${(d.items as { title: string; description: string }[]).map((i) => `${i.title} (${i.description})`).join("; ")}`);
        break;
      case "about":
        lines.push(`- ${d.title}: "${d.body}"${d.image ? ` Imagem: ${abs(String(d.image))}` : ""}`);
        break;
      case "benefits":
        lines.push(`- ${d.title}: ${(d.items as { title: string; description: string }[]).map((i) => `${i.title} — ${i.description}`).join("; ")}`);
        break;
      case "gallery":
        if (!opts.compact) lines.push(`- ${d.title} (galeria): ${(d.images as string[]).map(abs).join(" , ")}`);
        else lines.push(`- ${d.title} (galeria de fotos do espaço)`);
        break;
      case "testimonials":
        lines.push(`- Depoimentos: use como EXEMPLO ilustrativo e sinalize isso discretamente, até o cliente enviar os reais.`);
        break;
      case "faq":
        lines.push(`- Perguntas frequentes: ${(d.items as { question: string; answer: string }[]).map((i) => `"${i.question}" → "${i.answer}"`).join(" | ")}`);
        break;
      case "location":
        lines.push(`- Localização: link para o Google Maps (sem iframe).`);
        break;
      case "contact":
      case "cta":
        lines.push(`- Chamada final: "${d.title}" com botão "${d.ctaLabel}" para o WhatsApp.`);
        break;
    }
  }
  lines.push("");
  lines.push(`## Requisitos`);
  lines.push(`- Mobile primeiro, botão flutuante do WhatsApp, contraste AA, imagens com alt descritivo, carregamento rápido.`);
  lines.push(`- SEO: título "${spec.seo.title}" e descrição "${spec.seo.description}".`);
  return lines.join("\n");
}

/** Roteiro curto para vídeo de topo (Google Flow / Veo). */
export function videoBrief(spec: SiteSpec) {
  const b = spec.business;
  return `Vídeo de 8 segundos, horizontal 16:9, sem texto e sem logotipos, para o topo do site de um(a) ${b.categoryLabel.toLowerCase()} em ${b.city}, Brasil. Câmera lenta e estável, luz natural, clima acolhedor, cores puxando para ${spec.theme.primary}. Mostrar o ambiente e as mãos trabalhando, sem rostos em close. Loop suave no final.`;
}

/** Arquivo para rodar no Claude Code (ou qualquer agente de código) numa pasta vazia. */
export function claudeCodeBrief(spec: SiteSpec, opts: { base: string }) {
  return `# Briefing — site de ${spec.business.name}

${siteBrief(spec, opts)}

## Como construir
- Stack sugerida: Next.js (App Router) + Tailwind, ou HTML/CSS estático se preferir simplicidade.
- Gere o projeto completo nesta pasta, rode e confira no celular e no desktop.
- Não use bibliotecas pesadas; nada de iframe do Google Maps (use link).

## Dados estruturados (SiteSpec do LeadScan)
\`\`\`json
${JSON.stringify(spec, null, 2)}
\`\`\`
`;
}
