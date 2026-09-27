import { getCategory } from "@/lib/domain/categories";
import { articles } from "@/lib/domain/grammar";
import { formatInt, formatRating } from "@/lib/format";
import { classifyWebsite } from "@/lib/scoring/website";

/**
 * MOTOR DE VENDA — gerador de abordagem determinístico (zero tokens).
 * Monta 3 variantes a partir dos sinais reais do lead. Só usa fatos que temos:
 * nada de elogio inventado, nada de número que a fonte não deu.
 * A variação por lead (seed) evita mensagens idênticas em série — o que além de
 * soar robótico é o que faz o WhatsApp marcar como spam.
 */
export type OutreachVariant = "SHORT" | "PROFESSIONAL" | "CONVERSATIONAL";

export const VARIANT_LABEL: Record<OutreachVariant, string> = {
  SHORT: "Curta",
  PROFESSIONAL: "Profissional",
  CONVERSATIONAL: "Conversacional",
};

export type OutreachContext = {
  seed: string;
  name: string;
  category: string;
  city: string;
  instagram?: string | null;
  website?: string | null;
  rating?: number | null;
  reviewCount?: number | null;
  services?: string[];
  senderName?: string | null;
  agencyName?: string | null;
  hasPrototype: boolean;
  prototypeUrl?: string | null;
  includeLink?: boolean;
};

function hash(s: string) {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return h >>> 0;
}

function choose<T>(seed: string, salt: string, options: T[]) {
  return options[hash(seed + salt) % options.length];
}

type Hook = { key: string; short: string; long: string; question?: string };

/** Escolhe a observação mais forte e verificável sobre o lead. */
function pickHook(ctx: OutreachContext): Hook {
  const a = articles(ctx.name);
  const site = classifyWebsite(ctx.website);
  const reviews = ctx.reviewCount ?? 0;
  const rating = ctx.rating ?? 0;
  const ig = ctx.instagram ? `@${ctx.instagram}` : null;

  if (site.kind === "discontinued") {
    return {
      key: "discontinued",
      short: `O link de site ${a.de} (${site.host}) está fora do ar. O Google desligou esse tipo de site em 2024.`,
      long: `Reparei que o link de site ${a.de} leva pra um endereço ${site.host}, e esses sites foram desligados pelo próprio Google em 2024. Quem clica cai numa página de erro.`,
      question: `Vocês sabiam que o link de site ${a.de} está fora do ar?`,
    };
  }
  if (reviews >= 100 && rating >= 4.5 && site.kind !== "own") {
    return {
      key: "reputation",
      short: `Vi as ${formatInt(reviews)} avaliações ${a.de} no Google, nota ${formatRating(rating)}. Não achei um site de vocês.`,
      long: `Encontrei ${a.o} pesquisando em ${ctx.city} e duas coisas chamaram atenção: a nota ${formatRating(rating)} com ${formatInt(reviews)} avaliações no Google e o fato de ainda não existir um site próprio.`,
      question: `${formatInt(reviews)} avaliações com nota ${formatRating(rating)} é muita coisa. Vocês têm site? Procurei e não achei.`,
    };
  }
  if (site.kind === "social") {
    return {
      key: "social-as-site",
      short: `Vi que o link de site ${a.de} leva direto pro ${site.host?.includes("facebook") ? "Facebook" : "Instagram"}.`,
      long: `Reparei que o link de site ${a.de} leva direto pra rede social. Funciona, mas quem chega por ali não encontra serviços, horários e um botão pra falar com vocês num lugar só.`,
      question: `O link de site ${a.de} abre a rede social, né? Vocês já pensaram em ter uma página própria?`,
    };
  }
  if (site.kind === "link-in-bio") {
    return {
      key: "link-in-bio",
      short: `Vi que ${a.o} usa um link de bio (${site.host}) no lugar de site.`,
      long: `Vi que ${a.o} usa um link de bio (${site.host}) como site. Resolve o básico, só que não aparece no Google quando alguém procura por ${getCategory(ctx.category).plural.toLowerCase()} em ${ctx.city}.`,
      question: `Vocês usam ${site.host} como site, certo? Já pensaram numa página própria que apareça no Google?`,
    };
  }
  if (site.kind === "own" && !site.https) {
    return {
      key: "no-https",
      short: `O site ${a.de} aparece como "não seguro" no Chrome. Falta o certificado HTTPS.`,
      long: `Abri o site ${a.de} e o Chrome mostra o aviso de "não seguro", porque falta o certificado HTTPS. Muita gente fecha a página nessa hora.`,
      question: `Vocês já viram que o site aparece como "não seguro" no Chrome?`,
    };
  }
  if (site.kind === "free-builder") {
    return {
      key: "free-builder",
      short: `Vi o site ${a.de} no ${site.host}. Dá pra deixar ele bem mais rápido e com domínio próprio.`,
      long: `Vi o site ${a.de}, feito no ${site.host}. Ele cumpre o papel, mas o endereço com o nome da plataforma e o carregamento lento pesam contra quem chega pelo Google.`,
      question: `O site de vocês é do ${site.host}, né? Já pensaram em ter domínio próprio?`,
    };
  }
  if (ig && site.kind === "none") {
    return {
      key: "instagram-no-site",
      short: `Vi o perfil ${a.de} no Instagram (${ig}) e não encontrei um site de vocês.`,
      long: `Vi o perfil ${a.de} no Instagram (${ig}) e procurei um site, mas não encontrei. Hoje quem quer saber preço, horário ou onde fica precisa mandar direct.`,
      question: `Tava vendo o Instagram ${a.de} (${ig}). Vocês têm site? Procurei e não achei.`,
    };
  }
  if (site.kind === "none") {
    return {
      key: "no-site",
      short: `Procurei um site ${a.de} e não encontrei.`,
      long: `Encontrei ${a.o} pesquisando ${getCategory(ctx.category).plural.toLowerCase()} em ${ctx.city} e não achei um site de vocês. Quem procura pelo Google acaba indo pro concorrente que aparece com página própria.`,
      question: `Procurei um site ${a.de} e não achei. Vocês têm um?`,
    };
  }
  return {
    key: "generic",
    short: `Encontrei ${a.o} pesquisando em ${ctx.city} e tive uma ideia pro site de vocês.`,
    long: `Encontrei ${a.o} pesquisando ${getCategory(ctx.category).plural.toLowerCase()} em ${ctx.city} e tive algumas ideias pra deixar o site mais direto ao ponto, pensando em quem acessa pelo celular.`,
    question: `Encontrei ${a.o} aqui em ${ctx.city}. Posso te mostrar uma ideia rápida pro site de vocês?`,
  };
}

function servicesSnippet(services: string[] | undefined) {
  const s = (services ?? []).slice(0, 2).map((x) => x.toLowerCase());
  if (s.length === 0) return "os serviços";
  return s.length === 1 ? s[0] : `${s[0]}, ${s[1]}`;
}

export function generateOutreach(ctx: OutreachContext): Record<OutreachVariant, string> {
  const cat = getCategory(ctx.category);
  const hook = pickHook(ctx);
  const seed = ctx.seed;
  const first = ctx.senderName?.trim().split(/\s+/)[0] || null;
  const who = cat.plural.toLowerCase();
  const link = ctx.includeLink && ctx.prototypeUrl ? ctx.prototypeUrl : null;

  const greeting = choose(seed, "g", ["Oi, tudo bem?", "Olá, tudo bem?", "Oi! Tudo certo por aí?", "Bom dia! Tudo bem?"]);

  const offer = link
    ? choose(seed, "l", [`Montei uma prévia de como poderia ficar: ${link}`, `Fiz um rascunho de página pra vocês, dá uma olhada: ${link}`])
    : ctx.hasPrototype
      ? choose(seed, "p", [
          "Montei uma prévia de como poderia ficar a página de vocês. Posso te mandar?",
          "Inclusive já montei um rascunho com a cara de vocês. Quer ver?",
          "Fiz uma prévia rápida da página. Posso enviar o link?",
        ])
      : choose(seed, "o", ["Posso te mostrar uma ideia de como ficaria?", "Quer que eu te mostre como poderia ficar?"]);

  const intro = first
    ? choose(seed, "i", [
        `Meu nome é ${first}, trabalho com sites para ${who}${ctx.agencyName ? ` na ${ctx.agencyName}` : ""}.`,
        `Aqui é ${first}${ctx.agencyName ? `, da ${ctx.agencyName}` : ""}. Faço sites para ${who}.`,
      ])
    : `Trabalho criando sites para ${who}.`;

  const value = choose(seed, "v", [
    `Uma página com ${servicesSnippet(ctx.services)} e um botão de "${cat.cta.toLowerCase()}" costuma virar ${cat.goal} sem depender de direct.`,
    `A ideia é simples: quem encontra vocês no Google vê ${servicesSnippet(ctx.services)} e chama no WhatsApp com um toque.`,
    `Com uma página própria, quem pesquisa no Google chega direto no botão de ${cat.cta.toLowerCase()}.`,
  ]);

  const short = [greeting, hook.short, offer].join(" ");

  const professional = [greeting, intro, hook.long, value, offer].join(" ");

  const conversational = [
    choose(seed, "c", ["Oi! Tudo bem?", "Opa, tudo certo?", "Oi, tudo bom?"]),
    hook.question ?? hook.short,
    choose(seed, "w", [
      `Pergunto porque monto sites pra ${who} aqui de ${ctx.city}${ctx.hasPrototype ? " e fiz um rascunho pra vocês, sem compromisso." : "."}`,
      `Faço sites pra ${who}${ctx.hasPrototype ? " e já deixei uma prévia pronta pra vocês, sem compromisso." : " e tive uma ideia pra vocês."}`,
    ]),
    link ? `Tá aqui: ${link}` : ctx.hasPrototype ? "Quer ver?" : "Posso te mostrar?",
  ].join(" ");

  return { SHORT: short, PROFESSIONAL: professional, CONVERSATIONAL: conversational };
}
