import { EXTRA_CATEGORIES } from "@/lib/domain/categories-extra";
/**
 * Taxonomia de categorias — fonte única usada por:
 *  - parser de busca em linguagem natural (synonyms)
 *  - motor de oportunidade (potential)
 *  - gerador de abordagem e de protótipo (goal, cta, services, template)
 *  - provedores de dados (osm tags, texto de busca do Google)
 */
export type TemplateId =
  | "restaurant"
  | "clinic"
  | "estetica"
  | "barbearia"
  | "academia"
  | "dentista"
  | "advocacia"
  | "contabilidade"
  | "auto-center"
  | "real-estate"
  | "hotel"
  | "pet"
  | "local-business"
  // v2
  | "cafe"
  | "beleza"
  | "studio"
  | "educacao"
  | "construcao"
  | "servicos-casa"
  | "eventos"
  | "moda"
  | "saude";

export type Potential = "high" | "medium" | "low";

export type Category = {
  slug: string;
  label: string;
  plural: string;
  synonyms: string[];
  template: TemplateId;
  /** Quanto um site próprio tende a gerar conversão nesse segmento. */
  potential: Potential;
  /** O que o site gera para o negócio: "agendamentos", "reservas diretas"… */
  goal: string;
  /** Texto do botão principal do site. */
  cta: string;
  services: string[];
  /** Filtros OpenStreetMap: "chave=valor" simples ou filtro Overpass bruto começando com "[". Vazio = fonte não cobre a categoria. */
  osm: string[];
  /** Termo usado na busca textual do Google Places. */
  searchTerm: string;
};

const BASE_CATEGORIES: Category[] = [
  {
    slug: "clinica-estetica",
    label: "Clínica de estética",
    plural: "Clínicas de estética",
    synonyms: ["clinica de estetica", "clinicas de estetica", "estetica", "esteticista", "harmonizacao", "spa"],
    template: "estetica",
    potential: "high",
    goal: "agendamentos",
    cta: "Agendar avaliação",
    services: ["Limpeza de pele", "Botox", "Preenchimento facial", "Depilação a laser", "Drenagem linfática", "Harmonização facial"],
    osm: ["shop=beauty", "craft=beautician", "amenity=spa"],
    searchTerm: "clínica de estética",
  },
  {
    slug: "dentista",
    label: "Dentista",
    plural: "Dentistas",
    synonyms: ["dentista", "dentistas", "odontologia", "odontologica", "odontologico", "clinica odontologica", "ortodontista"],
    template: "dentista",
    potential: "high",
    goal: "agendamentos",
    cta: "Agendar consulta",
    services: ["Clareamento dental", "Implantes", "Ortodontia", "Limpeza e prevenção", "Lentes de contato dental", "Tratamento de canal"],
    osm: ["amenity=dentist", "healthcare=dentist"],
    searchTerm: "dentista",
  },
  {
    slug: "barbearia",
    label: "Barbearia",
    plural: "Barbearias",
    synonyms: ["barbearia", "barbearias", "barbeiro", "barber", "barbershop"],
    template: "barbearia",
    potential: "medium",
    goal: "agendamentos",
    cta: "Agendar horário",
    services: ["Corte masculino", "Barba completa", "Corte + barba", "Pigmentação", "Sobrancelha", "Tratamento capilar"],
    osm: ['["shop"="hairdresser"]["name"~"barb",i]', "shop=barber"],
    searchTerm: "barbearia",
  },
  {
    slug: "salao-beleza",
    label: "Salão de beleza",
    plural: "Salões de beleza",
    synonyms: ["salao de beleza", "saloes de beleza", "salao", "cabeleireiro", "cabeleireira", "manicure", "studio de beleza"],
    template: "beleza",
    potential: "medium",
    goal: "agendamentos",
    cta: "Agendar horário",
    services: ["Corte e escova", "Coloração", "Manicure e pedicure", "Progressiva", "Maquiagem", "Penteados"],
    osm: ["shop=hairdresser", "shop=beauty"],
    searchTerm: "salão de beleza",
  },
  {
    slug: "restaurante",
    label: "Restaurante",
    plural: "Restaurantes",
    synonyms: ["restaurante", "restaurantes", "bistro", "churrascaria", "comida"],
    template: "restaurant",
    potential: "high",
    goal: "reservas e pedidos",
    cta: "Fazer reserva",
    services: ["Almoço executivo", "Pratos à la carte", "Delivery", "Eventos e grupos", "Sobremesas da casa", "Carta de vinhos"],
    osm: ["amenity=restaurant"],
    searchTerm: "restaurante",
  },
  {
    slug: "pizzaria",
    label: "Pizzaria",
    plural: "Pizzarias",
    synonyms: ["pizzaria", "pizzarias", "pizza"],
    template: "restaurant",
    potential: "high",
    goal: "pedidos",
    cta: "Pedir agora",
    services: ["Pizzas tradicionais", "Pizzas especiais", "Delivery", "Rodízio", "Bordas recheadas", "Sobremesas"],
    osm: ['["amenity"="restaurant"]["cuisine"~"pizza"]', '["amenity"="fast_food"]["cuisine"~"pizza"]'],
    searchTerm: "pizzaria",
  },
  {
    slug: "hamburgueria",
    label: "Hamburgueria",
    plural: "Hamburguerias",
    synonyms: ["hamburgueria", "hamburguerias", "hamburguer", "burger", "lanchonete"],
    template: "restaurant",
    potential: "medium",
    goal: "pedidos",
    cta: "Pedir agora",
    services: ["Burgers artesanais", "Combos", "Delivery", "Porções", "Milkshakes", "Opções veganas"],
    osm: ['["amenity"="fast_food"]["cuisine"~"burger"]'],
    searchTerm: "hamburgueria",
  },
  {
    slug: "confeitaria",
    label: "Confeitaria",
    plural: "Confeitarias",
    synonyms: ["confeitaria", "confeitarias", "doceria", "docerias", "bolos", "padaria"],
    template: "cafe",
    potential: "medium",
    goal: "encomendas",
    cta: "Fazer encomenda",
    services: ["Bolos personalizados", "Doces finos", "Encomendas para festas", "Cafés especiais", "Salgados", "Kits presente"],
    osm: ["shop=pastry", "shop=confectionery", "shop=bakery"],
    searchTerm: "confeitaria",
  },
  {
    slug: "academia",
    label: "Academia",
    plural: "Academias",
    synonyms: ["academia", "academias", "crossfit", "box de crossfit", "studio de pilates", "pilates"],
    template: "academia",
    potential: "high",
    goal: "matrículas",
    cta: "Agendar aula experimental",
    services: ["Musculação", "Treino funcional", "Aulas coletivas", "Avaliação física", "Personal trainer", "Spinning"],
    osm: ["leisure=fitness_centre", '["leisure"="sports_centre"]["sport"~"fitness|crossfit"]'],
    searchTerm: "academia",
  },
  {
    slug: "personal-trainer",
    label: "Personal trainer",
    plural: "Personal trainers",
    synonyms: ["personal trainer", "personal trainers", "personal"],
    template: "academia",
    potential: "medium",
    goal: "novos alunos",
    cta: "Quero começar",
    services: ["Treino personalizado", "Consultoria online", "Avaliação física", "Emagrecimento", "Hipertrofia", "Treino para idosos"],
    osm: [],
    searchTerm: "personal trainer",
  },
  {
    slug: "oficina-mecanica",
    label: "Oficina mecânica",
    plural: "Oficinas mecânicas",
    synonyms: ["oficina mecanica", "oficinas mecanicas", "oficina", "mecanica", "mecanico", "funilaria"],
    template: "auto-center",
    potential: "medium",
    goal: "orçamentos",
    cta: "Pedir orçamento",
    services: ["Revisão completa", "Freios", "Suspensão", "Troca de óleo", "Injeção eletrônica", "Ar-condicionado automotivo"],
    osm: ["shop=car_repair"],
    searchTerm: "oficina mecânica",
  },
  {
    slug: "auto-center",
    label: "Auto center",
    plural: "Auto centers",
    synonyms: ["auto center", "auto centers", "autocenter", "pneus", "alinhamento"],
    template: "auto-center",
    potential: "medium",
    goal: "orçamentos",
    cta: "Pedir orçamento",
    services: ["Alinhamento e balanceamento", "Pneus", "Freios", "Suspensão", "Troca de óleo", "Revisão preventiva"],
    osm: ["shop=tyres", '["shop"="car_repair"]["service:vehicle:tyres"="yes"]'],
    searchTerm: "auto center",
  },
  {
    slug: "contabilidade",
    label: "Contabilidade",
    plural: "Contadores",
    synonyms: ["contador", "contadores", "contabilidade", "contabil", "escritorio de contabilidade"],
    template: "contabilidade",
    potential: "medium",
    goal: "novos clientes",
    cta: "Falar com um contador",
    services: ["Abertura de empresa", "Contabilidade para MEI", "Folha de pagamento", "Imposto de Renda", "Planejamento tributário", "BPO financeiro"],
    osm: ["office=accountant", "office=tax_advisor"],
    searchTerm: "escritório de contabilidade",
  },
  {
    slug: "advocacia",
    label: "Advocacia",
    plural: "Advogados",
    synonyms: ["advogado", "advogados", "advogada", "advocacia", "escritorio de advocacia", "juridico"],
    template: "advocacia",
    potential: "high",
    goal: "consultas",
    cta: "Agendar consulta",
    services: ["Direito trabalhista", "Direito de família", "Direito previdenciário", "Direito civil", "Direito do consumidor", "Direito empresarial"],
    osm: ["office=lawyer"],
    searchTerm: "escritório de advocacia",
  },
  {
    slug: "imobiliaria",
    label: "Imobiliária",
    plural: "Imobiliárias",
    synonyms: ["imobiliaria", "imobiliarias", "corretor", "corretora de imoveis", "imoveis"],
    template: "real-estate",
    potential: "high",
    goal: "visitas e contatos",
    cta: "Agendar visita",
    services: ["Venda de imóveis", "Locação", "Administração de imóveis", "Avaliação de imóveis", "Lançamentos", "Financiamento"],
    osm: ["office=estate_agent"],
    searchTerm: "imobiliária",
  },
  {
    slug: "arquitetura",
    label: "Arquitetura",
    plural: "Arquitetos",
    synonyms: ["arquiteto", "arquitetos", "arquiteta", "arquitetura", "design de interiores", "decoracao"],
    template: "construcao",
    potential: "high",
    goal: "novos projetos",
    cta: "Solicitar proposta",
    services: ["Projeto residencial", "Projeto comercial", "Design de interiores", "Reformas", "Regularização", "Paisagismo"],
    osm: ["office=architect"],
    searchTerm: "escritório de arquitetura",
  },
  {
    slug: "fotografia",
    label: "Fotografia",
    plural: "Fotógrafos",
    synonyms: ["fotografo", "fotografos", "fotografa", "fotografia", "estudio fotografico"],
    template: "eventos",
    potential: "medium",
    goal: "orçamentos",
    cta: "Pedir orçamento",
    services: ["Casamentos", "Ensaios", "Eventos corporativos", "Newborn", "Fotos de produto", "Formaturas"],
    osm: ["craft=photographer", "shop=photo"],
    searchTerm: "fotógrafo",
  },
  {
    slug: "hotel",
    label: "Hotel",
    plural: "Hotéis",
    synonyms: ["hotel", "hoteis", "hospedagem", "flat"],
    template: "hotel",
    potential: "high",
    goal: "reservas diretas",
    cta: "Reservar agora",
    services: ["Quartos confortáveis", "Café da manhã", "Piscina", "Estacionamento", "Wi-Fi", "Salas de eventos"],
    osm: ["tourism=hotel"],
    searchTerm: "hotel",
  },
  {
    slug: "pousada",
    label: "Pousada",
    plural: "Pousadas",
    synonyms: ["pousada", "pousadas", "hostel", "chale", "chales"],
    template: "hotel",
    potential: "high",
    goal: "reservas diretas",
    cta: "Reservar agora",
    services: ["Suítes", "Café da manhã regional", "Piscina", "Pet friendly", "Passeios", "Estacionamento"],
    osm: ["tourism=guest_house", "tourism=hostel"],
    searchTerm: "pousada",
  },
  {
    slug: "pet-shop",
    label: "Pet shop",
    plural: "Pet shops",
    synonyms: ["pet shop", "pet shops", "petshop", "banho e tosa", "pet"],
    template: "pet",
    potential: "medium",
    goal: "agendamentos de banho e tosa",
    cta: "Agendar banho e tosa",
    services: ["Banho e tosa", "Rações e acessórios", "Hotelzinho", "Leva e traz", "Hidratação", "Tosa higiênica"],
    osm: ["shop=pet", "amenity=animal_boarding"],
    searchTerm: "pet shop",
  },
  {
    slug: "veterinario",
    label: "Veterinário",
    plural: "Veterinários",
    synonyms: ["veterinario", "veterinarios", "veterinaria", "clinica veterinaria", "hospital veterinario"],
    template: "pet",
    potential: "high",
    goal: "consultas",
    cta: "Agendar consulta",
    services: ["Consultas", "Vacinação", "Cirurgias", "Exames laboratoriais", "Internação", "Atendimento de emergência"],
    osm: ["amenity=veterinary"],
    searchTerm: "clínica veterinária",
  },
  {
    slug: "clinica-medica",
    label: "Clínica médica",
    plural: "Clínicas médicas",
    synonyms: ["clinica medica", "clinicas medicas", "clinica", "clinicas", "consultorio", "medico", "medicos"],
    template: "clinic",
    potential: "high",
    goal: "agendamentos",
    cta: "Agendar consulta",
    services: ["Clínica geral", "Cardiologia", "Dermatologia", "Ginecologia", "Pediatria", "Exames"],
    osm: ["amenity=clinic", "amenity=doctors"],
    searchTerm: "clínica médica",
  },
  {
    slug: "fisioterapia",
    label: "Fisioterapia",
    plural: "Fisioterapeutas",
    synonyms: ["fisioterapia", "fisioterapeuta", "fisioterapeutas", "rpg", "quiropraxia"],
    template: "saude",
    potential: "high",
    goal: "agendamentos",
    cta: "Agendar sessão",
    services: ["Fisioterapia ortopédica", "Pilates clínico", "RPG", "Fisioterapia esportiva", "Acupuntura", "Reabilitação"],
    osm: ["healthcare=physiotherapist"],
    searchTerm: "fisioterapia",
  },
  {
    slug: "psicologia",
    label: "Psicologia",
    plural: "Psicólogos",
    synonyms: ["psicologo", "psicologos", "psicologa", "psicologia", "terapia", "terapeuta"],
    template: "saude",
    potential: "medium",
    goal: "novos pacientes",
    cta: "Agendar sessão",
    services: ["Terapia individual", "Terapia de casal", "Atendimento online", "Terapia infantil", "Orientação vocacional", "Avaliação psicológica"],
    osm: ["healthcare=psychotherapist", "healthcare=psychologist"],
    searchTerm: "psicólogo",
  },
  {
    slug: "nutricionista",
    label: "Nutricionista",
    plural: "Nutricionistas",
    synonyms: ["nutricionista", "nutricionistas", "nutricao"],
    template: "saude",
    potential: "high",
    goal: "consultas",
    cta: "Agendar consulta",
    services: ["Reeducação alimentar", "Emagrecimento", "Nutrição esportiva", "Nutrição materno-infantil", "Bioimpedância", "Consulta online"],
    osm: ["healthcare=nutrition_counselling"],
    searchTerm: "nutricionista",
  },
  {
    slug: "escola",
    label: "Escola",
    plural: "Escolas",
    synonyms: ["escola", "escolas", "colegio", "colegios", "educacao infantil", "creche"],
    template: "educacao",
    potential: "medium",
    goal: "matrículas",
    cta: "Agendar visita",
    services: ["Educação infantil", "Ensino fundamental", "Ensino médio", "Período integral", "Atividades extracurriculares", "Reforço escolar"],
    osm: ["amenity=kindergarten", '["amenity"="school"]["operator:type"="private"]'],
    searchTerm: "escola particular",
  },
  {
    slug: "curso",
    label: "Curso",
    plural: "Cursos",
    synonyms: ["curso", "cursos", "escola de idiomas", "idiomas", "ingles", "autoescola", "curso preparatorio"],
    template: "educacao",
    potential: "medium",
    goal: "matrículas",
    cta: "Quero me matricular",
    services: ["Turmas presenciais", "Aulas online", "Turmas reduzidas", "Certificado", "Aulas práticas", "Material incluso"],
    osm: ["amenity=language_school", "amenity=driving_school", "amenity=training"],
    searchTerm: "curso",
  },
  {
    slug: "loja",
    label: "Loja",
    plural: "Lojas",
    synonyms: ["loja", "lojas", "boutique", "comercio", "moda"],
    template: "moda",
    potential: "low",
    goal: "vendas",
    cta: "Falar com a loja",
    services: ["Novidades toda semana", "Entrega na cidade", "Retirada na loja", "Parcelamento", "Atendimento personalizado", "Trocas facilitadas"],
    osm: ["shop=clothes", "shop=boutique", "shop=shoes", "shop=gift"],
    searchTerm: "loja",
  },
  {
    slug: "servicos",
    label: "Empresa de serviços",
    plural: "Empresas de serviços",
    synonyms: ["empresa de servicos", "empresas de servicos", "servicos", "prestador de servicos", "manutencao"],
    template: "servicos-casa",
    potential: "medium",
    goal: "orçamentos",
    cta: "Pedir orçamento",
    services: ["Atendimento residencial", "Atendimento empresarial", "Orçamento sem compromisso", "Garantia do serviço", "Emergências", "Manutenção preventiva"],
    osm: ["craft=electrician", "craft=plumber", "craft=hvac", "shop=trade"],
    searchTerm: "empresa de serviços",
  },
  {
    slug: "autonomo",
    label: "Profissional autônomo",
    plural: "Profissionais autônomos",
    synonyms: ["autonomo", "autonomos", "profissional autonomo", "profissionais autonomos", "freelancer"],
    template: "local-business",
    potential: "medium",
    goal: "novos clientes",
    cta: "Falar comigo",
    services: ["Atendimento personalizado", "Orçamento rápido", "Atendimento a domicílio", "Horários flexíveis", "Pagamento facilitado", "Garantia"],
    osm: [],
    searchTerm: "profissional autônomo",
  },
  {
    slug: "empresa-b2b",
    label: "Empresa B2B",
    plural: "Empresas B2B",
    synonyms: ["b2b", "empresa b2b", "empresas b2b", "industria", "distribuidora", "atacado", "fornecedor"],
    template: "local-business",
    potential: "medium",
    goal: "reuniões comerciais",
    cta: "Solicitar proposta",
    services: ["Atendimento a empresas", "Pedidos recorrentes", "Condições para atacado", "Logística própria", "Suporte dedicado", "Proposta sob medida"],
    osm: ["office=company", "shop=wholesale"],
    searchTerm: "empresa",
  },
];

export const CATEGORIES: Category[] = [...BASE_CATEGORIES, ...EXTRA_CATEGORIES];

const bySlug = new Map(CATEGORIES.map((c) => [c.slug, c]));

export function getCategory(slug: string): Category {
  return bySlug.get(slug) ?? FALLBACK_CATEGORY;
}

export function isCategorySlug(slug: string) {
  return bySlug.has(slug);
}

export const FALLBACK_CATEGORY: Category = {
  slug: "negocio-local",
  label: "Negócio local",
  plural: "Negócios locais",
  synonyms: [],
  template: "local-business",
  potential: "medium",
  goal: "novos clientes",
  cta: "Falar no WhatsApp",
  services: [],
  osm: [],
  searchTerm: "empresa",
};

export const POTENTIAL_LABEL: Record<Potential, string> = {
  high: "alta conversão com site",
  medium: "boa conversão com site",
  low: "conversão moderada com site",
};
