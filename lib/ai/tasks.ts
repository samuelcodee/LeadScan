import "server-only";
import { z } from "zod";
import { cachedGenerate } from "@/lib/ai";
import { getCategory } from "@/lib/domain/categories";
import { classifyWebsite, WEBSITE_KIND_LABEL } from "@/lib/scoring/website";
import type { SiteSpec } from "@/lib/templates/types";

/**
 * Tarefas de IA — só onde texto sob medida agrega valor. Regras de economia:
 *  - contexto mínimo (sem telefone, endereço, notas ou qualquer dado pessoal)
 *  - saída JSON validada
 *  - cache por hash do contexto (mesma entrada nunca é paga duas vezes)
 *  - fallback determinístico sempre disponível (o chamador decide)
 */
type LeadSignals = {
  name: string;
  category: string;
  city: string;
  neighborhood?: string | null;
  instagram?: string | null;
  website?: string | null;
  rating?: number | null;
  reviewCount?: number | null;
  services?: string[];
};

function minimalContext(l: LeadSignals) {
  const cat = getCategory(l.category);
  return {
    negocio: l.name,
    segmento: cat.label,
    objetivo_do_site: cat.goal,
    cidade: l.city,
    bairro: l.neighborhood ?? null,
    site: WEBSITE_KIND_LABEL[classifyWebsite(l.website).kind],
    instagram: Boolean(l.instagram),
    nota_google: l.rating ?? null,
    avaliacoes: l.reviewCount ?? null,
    servicos: (l.services ?? []).slice(0, 5),
  };
}

const STYLE_RULES = `Escreva em português do Brasil falado, como uma pessoa real.
- Varie o tamanho das frases. Nada de três adjetivos em sequência.
- Proibido: "transforme", "eleve", "revolucionário", "inovador", "premium", "não é apenas".
- Use SOMENTE os fatos fornecidos. Nunca invente números, prêmios, anos de mercado ou elogios específicos.
- Sem emojis. Sem travessões longos.`;

// ─── generateOutreach ──────────────────────────────────────────
const outreachSchema = z.object({
  short: z.string().max(400),
  professional: z.string().max(900),
  conversational: z.string().max(600),
});

export async function generateOutreachAI(
  lead: LeadSignals,
  opts: { senderName?: string | null; hasPrototype: boolean; force?: boolean; userId?: string },
) {
  const context = { ...minimalContext(lead), remetente: opts.senderName ?? null, prototipo_pronto: opts.hasPrototype };
  const { data, cached } = await cachedGenerate({
    kind: "outreach",
    promptVersion: 1,
    context,
    force: opts.force,
    userId: opts.userId,
    request: {
      system: `Você escreve a PRIMEIRA mensagem de WhatsApp de um freelancer que cria sites para negócios locais.
Objetivo: iniciar conversa, não vender na primeira mensagem. Nada que pareça spam ou disparo em massa.
${STYLE_RULES}
- Cite uma observação concreta dos dados (ex.: nota e avaliações, ausência de site, uso de rede social como site).
- Se prototipo_pronto for true, ofereça mostrar a prévia PERGUNTANDO se pode enviar (não envie link).
- short: até 3 frases. professional: apresenta o remetente e o valor para o negócio, até 6 frases. conversational: tom leve, termina com pergunta.`,
      prompt: JSON.stringify(context),
      schema: outreachSchema,
      maxTokens: 1500,
    },
  });
  return { SHORT: data.short, PROFESSIONAL: data.professional, CONVERSATIONAL: data.conversational, cached };
}

// ─── generateCopy / personalizeTemplate ───────────────────────
const copySchema = z.object({
  heroTitle: z.string().max(90),
  heroSubtitle: z.string().max(220),
  about: z.string().max(600),
  services: z.array(z.object({ title: z.string().max(60), description: z.string().max(160) })).max(6),
  ctaTitle: z.string().max(90),
});

export async function generateCopyAI(lead: LeadSignals, opts: { force?: boolean; userId?: string; provider?: string | null } = {}) {
  const context = minimalContext(lead);
  const { data } = await cachedGenerate({
    kind: "site-copy",
    promptVersion: 1,
    context,
    force: opts.force,
    userId: opts.userId,
    provider: opts.provider,
    request: {
      system: `Você escreve os textos de um site de uma página para um negócio local brasileiro.
${STYLE_RULES}
- Foque no que o visitante consegue fazer (ver serviços, entender como funciona, chamar no WhatsApp).
- Título do topo: curto e específico ao segmento e ao bairro/cidade.
- Serviços: use a lista fornecida; descrição de 1 frase útil, sem prometer resultado.`,
      prompt: JSON.stringify(context),
      schema: copySchema,
      maxTokens: 1800,
    },
  });
  return data;
}

/** Aplica os textos da IA sobre um SiteSpec gerado por template (estrutura e visual intactos). */
export function personalizeTemplate(spec: SiteSpec, copy: z.infer<typeof copySchema>): SiteSpec {
  return {
    ...spec,
    sections: spec.sections.map((s) => {
      if (s.type === "hero") return { ...s, data: { ...s.data, title: copy.heroTitle, subtitle: copy.heroSubtitle } };
      if (s.type === "about") return { ...s, data: { ...s.data, body: copy.about } };
      if (s.type === "services" && copy.services.length) return { ...s, data: { ...s.data, items: copy.services } };
      if (s.type === "cta") return { ...s, data: { ...s.data, title: copy.ctaTitle } };
      return s;
    }),
    seo: { ...spec.seo, description: copy.heroSubtitle },
  };
}

// ─── analyzeLead ──────────────────────────────────────────────
const analysisSchema = z.object({
  angle: z.string().max(300),
  objections: z.array(z.object({ objection: z.string().max(120), answer: z.string().max(240) })).max(3),
  nextStep: z.string().max(200),
});

/** Estratégia de venda para um lead (sob demanda — o score em si é calculado por código). */
export async function analyzeLeadAI(lead: LeadSignals, userId?: string) {
  const context = minimalContext(lead);
  const { data } = await cachedGenerate({
    kind: "lead-analysis",
    promptVersion: 1,
    context,
    userId,
    request: {
      system: `Você é um consultor de vendas para freelancers que vendem sites a negócios locais no Brasil.
Dado o perfil público de um negócio, diga: o melhor ângulo de abordagem, até 3 objeções prováveis com respostas curtas, e o próximo passo.
${STYLE_RULES}`,
      prompt: JSON.stringify(context),
      schema: analysisSchema,
      maxTokens: 1500,
    },
  });
  return data;
}
