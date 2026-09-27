import { CATEGORIES } from "@/lib/domain/categories";
import { CITIES, STATES } from "@/lib/domain/geo";
import type { SearchFilters } from "@/lib/domain/search";
import { fold } from "@/lib/format";

/**
 * Busca em linguagem natural → parâmetros estruturados. 100% determinístico (zero tokens).
 *
 * "Quero encontrar 100 clínicas de estética em Fortaleza que não possuem site,
 *  possuem Instagram e WhatsApp e tenham pelo menos 50 avaliações"
 *  → { category: clinica-estetica, city: Fortaleza/CE, limit: 100,
 *      filters: { website: without, instagram: with, whatsapp: with, minReviews: 50 } }
 */
export type ParsedQuery = {
  categories: string[];
  city?: { name: string; uf: string };
  /** Cidade citada após "em" que não está na lista curada e veio sem UF (o formulário resolve no IBGE). */
  freeCity?: string;
  uf?: string;
  /** "no Brasil", "todo o país": busca geral, sem cidade nem estado. */
  nationwide?: boolean;
  limit?: number;
  filters: Partial<SearchFilters>;
};

const synonymIndex = CATEGORIES.flatMap((c) =>
  [c.label, c.plural, ...c.synonyms].map((s) => ({ slug: c.slug, term: fold(s) })),
).sort((a, b) => b.term.length - a.term.length);

const cityIndex = [...CITIES].sort((a, b) => b.name.length - a.name.length);

const LOWER_WORDS = new Set(["de", "da", "do", "das", "dos", "e"]);

function titleCase(s: string) {
  return s
    .toLowerCase()
    .split(" ")
    .map((w, i) => (i > 0 && LOWER_WORDS.has(w) ? w : w.charAt(0).toUpperCase() + w.slice(1)))
    .join(" ");
}

function hasWord(text: string, term: string) {
  return new RegExp(`(^|[^a-z0-9])${term.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}([^a-z0-9]|$)`).test(text);
}

export function parseSearchQuery(input: string): ParsedQuery {
  const text = ` ${fold(input).replace(/\s+/g, " ")} `;
  const result: ParsedQuery = { categories: [], filters: {} };

  // Categorias (mais longas primeiro; remove o trecho para não casar de novo)
  let rest = text;
  for (const { slug, term } of synonymIndex) {
    if (result.categories.includes(slug)) continue;
    if (hasWord(rest, term)) {
      result.categories.push(slug);
      rest = rest.replace(term, " ");
      if (result.categories.length >= 3) break;
    }
  }

  if (/\b(todo o brasil|brasil inteiro|(no|do|em|pelo) brasil|todo o pais|pais inteiro)\b/.test(text)) {
    result.nationwide = true;
  }

  // Estado explícito: "fortaleza - ce", "em sp", "ceara"
  const ufMatch = text.match(/(?:-|,|\/|\bem|\bno|\bna|\bde)\s*([a-z]{2})(?=[^a-z]|$)/g);
  if (ufMatch) {
    for (const m of ufMatch) {
      const uf = m.replace(/[^a-z]/g, "").slice(-2).toUpperCase();
      if (STATES.some((s) => s.uf === uf) && !["DE", "NO", "NA", "EM"].includes(uf)) result.uf = uf;
    }
  }
  if (!result.uf) {
    const byName = [...STATES].sort((a, b) => b.name.length - a.name.length).find((s) => hasWord(text, fold(s.name)));
    if (byName) result.uf = byName.uf;
  }

  // Cidade conhecida (respeita a UF se informada)
  const city = result.nationwide ? undefined : cityIndex.find((c) => hasWord(text, fold(c.name)) && (!result.uf || c.uf === result.uf));
  if (city) {
    result.city = { name: city.name, uf: city.uf };
    result.uf = city.uf;
  } else {
    // Cidade livre após "em": "barbearias em quixadá - ce"
    const free = result.nationwide ? null : input.match(/\bem\s+([A-Za-zÀ-ÿ' ]{3,40}?)(?:\s*[-,/]\s*([A-Za-z]{2}))?(?=\s+(que|com|sem|e|onde)\b|[,.;]|$)/i);
    if (free) {
      const name = free[1].trim().replace(/\s+/g, " ");
      if (!STATES.some((s) => fold(s.name) === fold(name))) {
        if (result.uf) result.city = { name: titleCase(name), uf: result.uf };
        else result.freeCity = titleCase(name);
      }
    }
  }

  // Quantidade: primeiro número que não seja avaliação/nota
  const qty = text.match(/(?:^|\s)(\d{1,3})(?:\s+(?!avalia|estrela|reviews?)|$)/);
  if (qty && !/nota\s*(de|acima de|maior que|minima)?\s*$/.test(text.slice(0, qty.index! + 1))) {
    const n = Number(qty[1]);
    if (n >= 5 && n <= 500) result.limit = n;
  }

  // Site
  if (/(sem|nao tem|nao tenham|nao possui|nao possuem|nao possuam|sem ter)\s+(um\s+)?(site|website|pagina)/.test(text)) {
    result.filters.website = "without";
  } else if (/(com|que tem|que tenham|possui|possuem|possuam)\s+(um\s+)?(site|website)/.test(text)) {
    result.filters.website = "with";
  }

  // Instagram / WhatsApp
  if (/sem\s+(instagram|insta)\b/.test(text)) result.filters.instagram = "without";
  else if (/\b(instagram|insta)\b/.test(text)) result.filters.instagram = "with";
  if (/sem\s+(whatsapp|whats|zap)\b/.test(text)) result.filters.whatsapp = "without";
  else if (/\b(whatsapp|whats|zap)\b/.test(text)) result.filters.whatsapp = "with";

  // Avaliações mínimas
  const rev = text.match(/(?:mais de|pelo menos|acima de|no minimo|minimo de|>=?)\s*(\d{1,5})\s*(avaliac|avaliaç|reviews?)/);
  if (rev) result.filters.minReviews = Number(rev[1]);

  // Nota mínima
  const rating = text.match(/nota\s*(?:acima de|maior que|minima de|minima|de|>=?)?\s*(\d(?:[.,]\d)?)/);
  if (rating) {
    const r = Number(rating[1].replace(",", "."));
    if (r > 0 && r <= 5) result.filters.minRating = r;
  }

  if (/alto potencial|alta oportunidade|melhores oportunidades/.test(text)) result.filters.potential = "high";

  return result;
}
