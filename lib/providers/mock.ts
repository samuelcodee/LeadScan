import { getCategory } from "@/lib/domain/categories";
import { dddFor, neighborhoodsFor } from "@/lib/domain/geo";
import { slugify } from "@/lib/format";
import type { DataProvider, ProviderBusiness, ProviderQuery } from "@/lib/providers/types";

/**
 * MOCK_PROVIDER — empresas FICTÍCIAS para desenvolvimento e modo demonstração.
 * Determinístico: a mesma busca sempre devolve as mesmas empresas (cache-friendly e
 * previsível em testes). Domínios usam o TLD reservado .example e telefones
 * são marcados como DEMO — o app nunca abre conversa com eles.
 */

// PRNG mulberry32 com seed derivada da string
function rng(seed: string) {
  let h = 1779033703 ^ seed.length;
  for (let i = 0; i < seed.length; i++) {
    h = Math.imul(h ^ seed.charCodeAt(i), 3432918353);
    h = (h << 13) | (h >>> 19);
  }
  let a = h >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

type Rand = () => number;
const pick = <T,>(r: Rand, arr: readonly T[]) => arr[Math.floor(r() * arr.length)];
const chance = (r: Rand, p: number) => r() < p;

const NAMES: Record<string, { prefix: string[]; core: string[] }> = {
  estetica: {
    prefix: ["Studio", "Espaço", "Clínica", "Instituto", "Ateliê"],
    core: ["Bella", "Lumière", "Aurora", "Essenza", "Lótus", "Jasmim", "Vênus", "Âmbar", "Íris", "Serena", "Dália", "Pétala", "Nuance", "Glow"],
  },
  dentista: {
    prefix: ["Odonto", "Clínica Odontológica", "Sorriso", "Instituto", "Dental"],
    core: ["Prime", "Viver", "Leve", "Aliança", "Harmonia", "Vita", "Essencial", "Integral", "Nobre", "Clarear", "Arte", "Mais"],
  },
  barbearia: {
    prefix: ["Barbearia", "Barber Shop", "Barbearia", "Studio"],
    core: ["Navalha", "Old School", "Vintage", "Dom", "Bigode", "Corte Fino", "Imperial", "Brutus", "Tesoura", "Classic", "Legado", "Raiz"],
  },
  restaurant: {
    prefix: ["Restaurante", "Cantina", "Bistrô", "Casa", "Empório", "Cozinha"],
    core: ["Sabor da Terra", "Maré Alta", "Tempero", "Oliva", "Brasa Viva", "Mangue", "Bella Napoli", "Forno a Lenha", "Dom Giovanni", "Vesúvio", "Raízes", "Jardim"],
  },
  academia: {
    prefix: ["Academia", "Studio", "Box", "Centro de Treinamento", "Espaço"],
    core: ["Pulse", "Iron", "Evolution", "Movimento", "Titan", "Energia", "Força", "Vitta", "Atlas", "Performance", "Ritmo", "Core"],
  },
  clinic: {
    prefix: ["Clínica", "Centro Médico", "Instituto", "Consultório", "Espaço"],
    core: ["Vida", "Bem Estar", "Saúde Integral", "Cuidar", "Viver Bem", "Equilíbrio", "Santa Clara", "São Lucas", "Mais Saúde", "Renova"],
  },
  advocacia: {
    prefix: ["Escritório", "Advocacia", "Sociedade de Advogados"],
    core: ["Almeida & Rocha", "Ferraz Advogados", "Monteiro", "Castro & Lima", "Pires Associados", "Barros", "Nogueira & Sá", "Teixeira"],
  },
  contabilidade: {
    prefix: ["Contabilidade", "Escritório Contábil", "Assessoria Contábil"],
    core: ["Exata", "Balanço", "Precisão", "Conta Certa", "Ativa", "Consult", "Lucro Real", "Base", "Integra", "Soma"],
  },
  "auto-center": {
    prefix: ["Auto Center", "Oficina", "Mecânica", "Centro Automotivo"],
    core: ["Turbo", "Roda Viva", "Pit Stop", "Motor Forte", "Garagem", "Auto Prime", "Rota", "Pneu Show", "Box 7", "Precision"],
  },
  "real-estate": {
    prefix: ["Imobiliária", "Imóveis", "Estúdio", "Arquitetura"],
    core: ["Horizonte", "Morada", "Chave de Ouro", "Lar Ideal", "Planta", "Traço", "Vista Mar", "Endereço Certo", "Espaço Casa", "Alicerce"],
  },
  hotel: {
    prefix: ["Hotel", "Pousada", "Hostel", "Residencial"],
    core: ["Mar Azul", "Brisa", "Recanto", "Sol Nascente", "Coqueiral", "Vila Verde", "Encanto", "Porto", "Maresia", "Canto do Sol"],
  },
  pet: {
    prefix: ["Pet Shop", "Clínica Veterinária", "Pet", "Espaço Pet"],
    core: ["Amigo Fiel", "Patinhas", "Bicho Feliz", "Focinho", "Au Au", "Pet Care", "Mundo Animal", "Lambeijo", "Quatro Patas", "Vet Vida"],
  },
  "local-business": {
    prefix: ["Studio", "Grupo", "Espaço", "Ateliê", "Casa"],
    core: ["Criativo", "Central", "Prime", "Nova Era", "Ponto Certo", "Essência", "Conecta", "Destaque", "Aliança", "Norte"],
  },
};

const STREETS = [
  "Rua das Acácias",
  "Avenida Central",
  "Rua dos Ipês",
  "Rua Boa Esperança",
  "Avenida das Palmeiras",
  "Rua do Comércio",
  "Travessa São Pedro",
  "Rua Nova Aurora",
  "Avenida Beira Rio",
  "Rua dos Girassóis",
];

function hoursFor(template: string, r: Rand): string[] {
  if (template === "restaurant")
    return pick(r, [
      ["Terça a domingo: 11:30–15:00 e 18:30–23:00", "Segunda: fechado"],
      ["Todos os dias: 18:00–23:30"],
      ["Segunda a sábado: 11:00–22:00", "Domingo: 11:00–16:00"],
    ]);
  if (template === "hotel") return ["Recepção 24 horas", "Check-in: 14:00 · Check-out: 12:00"];
  if (template === "academia") return ["Segunda a sexta: 05:30–22:30", "Sábado: 08:00–14:00", "Domingo: 08:00–12:00"];
  return pick(r, [
    ["Segunda a sexta: 08:00–18:00", "Sábado: 08:00–12:00", "Domingo: fechado"],
    ["Segunda a sexta: 09:00–19:00", "Sábado: 09:00–14:00"],
    ["Segunda a sábado: 09:00–20:00"],
  ]);
}

function reviewsFor(r: Rand) {
  const x = r();
  if (x < 0.08) return 0;
  if (x < 0.3) return Math.floor(3 + r() * 30);
  if (x < 0.6) return Math.floor(30 + r() * 90);
  if (x < 0.85) return Math.floor(120 + r() * 230);
  return Math.floor(350 + r() * 650);
}

export function generateMockBusiness(q: Omit<ProviderQuery, "limit">, index: number): ProviderBusiness {
  const cat = getCategory(q.category);
  const r = rng(`${q.category}|${q.city}|${q.uf}|${index}`);
  const names = NAMES[cat.template] ?? NAMES["local-business"];
  const neighborhood = pick(r, neighborhoodsFor(q.city, q.uf));
  let name = `${pick(r, names.prefix)} ${pick(r, names.core)}`;
  if (index >= names.prefix.length * names.core.length * 0.5) name += ` ${neighborhood}`;
  const handle = slugify(name).replace(/-/g, "").slice(0, 24);

  const siteRoll = r();
  const website =
    siteRoll < 0.45
      ? null
      : siteRoll < 0.57
        ? `https://instagram.com/${handle}`
        : siteRoll < 0.64
          ? `https://linktr.ee/${handle}`
          : siteRoll < 0.69
            ? `https://${handle}.business.site`
            : siteRoll < 0.79
              ? `https://${handle}.wixsite.com/site`
              : siteRoll < 0.86
                ? `http://www.${handle}.example`
                : `https://www.${handle}.example`;

  const ddd = dddFor(q.city, q.uf);
  const hasPhone = chance(r, 0.9);
  const isMobile = chance(r, 0.72);
  const suffix = String(1000 + Math.floor(r() * 8999));
  const phone = hasPhone ? (isMobile ? `55${ddd}90000${suffix}` : `55${ddd}3000${suffix}`) : null;
  const whatsapp = phone && isMobile && chance(r, 0.6) ? phone : null;
  const reviewCount = reviewsFor(r);
  const rating = reviewCount > 0 ? Math.round((3.4 + r() * 1.6) * 10) / 10 : null;
  const services = [...cat.services].sort(() => r() - 0.5).slice(0, 4 + Math.floor(r() * 3));

  return {
    externalId: `mock:${q.category}:${slugify(q.city)}:${q.uf}:${index}`,
    name,
    address: `${pick(r, STREETS)}, ${10 + Math.floor(r() * 1990)} — ${neighborhood}`,
    neighborhood,
    city: q.city,
    state: q.uf,
    phone,
    whatsapp,
    website,
    instagram: chance(r, 0.72) ? handle : null,
    facebook: chance(r, 0.3) ? handle : null,
    mapsUrl: null,
    rating,
    reviewCount,
    openingHours: chance(r, 0.82) ? hoursFor(cat.template, r) : [],
    description: chance(r, 0.55)
      ? `${cat.label} em ${neighborhood}, ${q.city}. ${pick(r, [
          "Atendimento com hora marcada.",
          "Equipe especializada e ambiente acolhedor.",
          "Referência no bairro há mais de 10 anos.",
          "Atendimento humanizado e personalizado.",
        ])}`
      : null,
    services,
    latitude: null,
    longitude: null,
  };
}

/** Quantas empresas fictícias uma cidade tem por categoria (80 a 400, sempre o mesmo número). */
export function mockCityTotal(q: Pick<ProviderQuery, "category" | "city" | "uf">) {
  const r = rng(`total|${q.category}|${q.city}|${q.uf}`);
  return 80 + Math.floor(r() * 320);
}

export const mockProvider: DataProvider = {
  id: "mock",
  label: "Demonstração",
  description: "Empresas fictícias geradas localmente. Ideal para testar o fluxo sem custo.",
  isDemo: true,
  capabilities: { reviews: true, instagram: true, whatsapp: true, maxResults: 500 },
  cacheTtlMs: 0,
  minIntervalMs: 0,
  isConfigured: () => true,
  async search(q) {
    const seen = new Set<string>();
    const start = q.offset ?? 0;
    // Cada cidade tem um número finito de empresas: dá para ver a varredura chegar ao fim
    const length = Math.max(0, Math.min(q.limit, mockCityTotal(q) - start));
    return Array.from({ length }, (_, k) => {
      const i = start + k;
      const b = generateMockBusiness(q, i);
      if (seen.has(b.name)) b.name = `${b.name} ${b.neighborhood}`;
      if (seen.has(b.name)) b.name = `${b.name} ${i + 1}`;
      seen.add(b.name);
      return b;
    });
  },
};
