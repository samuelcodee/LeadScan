import { CATEGORIES } from "@/lib/domain/categories";
import { buildSiteSpec } from "@/lib/templates/build";
import type { TemplateDefinition } from "@/lib/templates/types";

/**
 * Site de exemplo de um template (biblioteca de templates): empresa fictícia, só para ver o
 * visual. Marcado como demonstração — nenhum dado aqui é de empresa real.
 */
export function sampleSpec(t: TemplateDefinition) {
  const cat = CATEGORIES.find((c) => c.template === t.id);
  return buildSiteSpec(
    {
      id: `sample-${t.id}`,
      name: `${t.label.split(" ")[0]} Exemplo`,
      category: cat?.slug ?? "servicos",
      city: "Fortaleza",
      state: "CE",
      neighborhood: "Aldeota",
      address: null,
      phone: null,
      whatsapp: null,
      instagram: null,
      facebook: null,
      openingHours: [],
      rating: 4.8,
      reviewCount: 214,
      mapsUrl: null,
      services: [],
      isDemo: true,
    },
    { templateId: t.id },
  );
}

/** Categorias que usam o template (ex.: "Clínicas de estética, Salões de beleza"). */
export function templateUsedBy(t: TemplateDefinition) {
  return CATEGORIES.filter((c) => c.template === t.id).map((c) => c.plural);
}
