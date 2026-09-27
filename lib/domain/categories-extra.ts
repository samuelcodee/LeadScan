import type { Category, Potential, TemplateId } from "@/lib/domain/categories";

/**
 * Segmentos adicionais (v2). Mesma estrutura das categorias principais; escrito de forma
 * compacta: c(slug, rótulo, plural, sinônimos, template, potencial, objetivo, CTA, serviços, filtros OSM, termo Google).
 * Filtros OSM começando com "[" são filtros Overpass brutos.
 */
function c(
  slug: string,
  label: string,
  plural: string,
  synonyms: string[],
  template: TemplateId,
  potential: Potential,
  goal: string,
  cta: string,
  services: string[],
  osm: string[],
  searchTerm: string,
): Category {
  return { slug, label, plural, synonyms, template, potential, goal, cta, services, osm, searchTerm };
}

export const EXTRA_CATEGORIES: Category[] = [
  // Alimentação
  c("padaria", "Padaria", "Padarias", ["padaria", "padarias", "panificadora"], "cafe", "medium", "encomendas", "Fazer encomenda",
    ["Pães artesanais", "Café da manhã", "Bolos por encomenda", "Salgados para festa", "Frios e laticínios", "Entrega no bairro"], ["shop=bakery"], "padaria"),
  c("cafeteria", "Cafeteria", "Cafeterias", ["cafeteria", "cafeterias", "coffee shop", "cafe especial"], "cafe", "medium", "visitas e encomendas", "Ver cardápio",
    ["Cafés especiais", "Brunch", "Doces da casa", "Opções sem glúten", "Café para levar", "Grãos à venda"], ["amenity=cafe"], "cafeteria"),
  c("acaiteria", "Açaíteria", "Açaíterias", ["acai", "acaiteria", "sorveteria", "sorveterias", "gelateria"], "cafe", "medium", "pedidos", "Pedir agora",
    ["Açaí no copo", "Tigelas", "Sorvetes", "Milk-shakes", "Combos", "Delivery"], ["amenity=ice_cream"], "açaí"),
  c("japones", "Restaurante japonês", "Restaurantes japoneses", ["japones", "restaurante japones", "sushi", "temakeria", "comida japonesa"], "restaurant", "high",
    "pedidos e reservas", "Fazer pedido", ["Sushi e sashimi", "Temakis", "Combinados", "Pratos quentes", "Rodízio", "Delivery"],
    ['["amenity"="restaurant"]["cuisine"~"japanese|sushi"]'], "restaurante japonês"),
  c("churrascaria", "Churrascaria", "Churrascarias", ["churrascaria", "churrascarias", "churrasco", "espetinho", "steakhouse"], "restaurant", "high", "reservas",
    "Reservar mesa", ["Rodízio de carnes", "Buffet", "Espetos", "Carnes nobres", "Aniversários", "Chopp"],
    ['["amenity"="restaurant"]["cuisine"~"barbecue|steak_house"]'], "churrascaria"),
  c("marmitaria", "Marmitaria", "Marmitarias", ["marmitaria", "marmita", "marmitex", "quentinha", "comida caseira"], "restaurant", "medium", "pedidos",
    "Pedir marmita", ["Marmita do dia", "Cardápio da semana", "Marmitas fitness", "Planos mensais", "Entrega no trabalho", "Self-service"],
    ['["amenity"="restaurant"]["cuisine"~"regional|brazilian"]'], "marmitaria"),
  c("bar", "Bar", "Bares", ["bar", "bares", "boteco", "pub", "choperia", "cervejaria"], "restaurant", "medium", "reservas e eventos", "Reservar mesa",
    ["Petiscos", "Chopp gelado", "Drinks", "Música ao vivo", "Aniversários", "Transmissão de jogos"], ["amenity=bar", "amenity=pub"], "bar"),

  // Beleza e bem-estar
  c("esmalteria", "Esmalteria", "Esmalterias", ["esmalteria", "manicure", "nail designer", "unhas", "pedicure"], "beleza", "high", "agendamentos", "Agendar horário",
    ["Manicure e pedicure", "Alongamento em gel", "Esmaltação em gel", "Nail art", "Spa dos pés", "Blindagem"], ['["shop"="beauty"]["beauty"~"nails"]'], "esmalteria"),
  c("sobrancelha", "Studio de sobrancelhas e cílios", "Studios de sobrancelhas e cílios",
    ["sobrancelha", "sobrancelhas", "design de sobrancelhas", "lash", "cilios", "extensao de cilios", "micropigmentacao"], "beleza", "high", "agendamentos",
    "Agendar horário", ["Design de sobrancelhas", "Henna", "Extensão de cílios", "Lash lifting", "Micropigmentação", "Brow lamination"],
    ['["shop"="beauty"]["beauty"~"eyebrow|lashes"]'], "design de sobrancelhas"),
  c("tatuagem", "Estúdio de tatuagem", "Estúdios de tatuagem", ["tatuagem", "tatuador", "tattoo", "piercing", "estudio de tatuagem"], "barbearia", "medium",
    "orçamentos", "Pedir orçamento", ["Tatuagem autoral", "Flash tattoo", "Cobertura", "Piercing", "Retoque", "Projeto personalizado"], ["shop=tattoo"], "estúdio de tatuagem"),
  c("massagem", "Massoterapia", "Massoterapeutas", ["massagem", "massoterapia", "massoterapeuta", "day spa", "quick massage"], "saude", "high", "agendamentos",
    "Agendar sessão", ["Massagem relaxante", "Drenagem", "Pedras quentes", "Reflexologia", "Day spa", "Quick massage"], ["shop=massage"], "massagem"),

  // Saúde
  c("oftalmologista", "Oftalmologista", "Oftalmologistas", ["oftalmologista", "oftalmologistas", "oftalmo", "clinica de olhos"], "clinic", "high", "agendamentos",
    "Agendar consulta", ["Consulta oftalmológica", "Exame de vista", "Mapeamento de retina", "Lentes de contato", "Cirurgia refrativa", "Oftalmopediatria"],
    ['["healthcare:speciality"~"ophthalmology"]'], "oftalmologista"),
  c("dermatologista", "Dermatologista", "Dermatologistas", ["dermatologista", "dermatologistas", "dermato"], "clinic", "high", "agendamentos", "Agendar consulta",
    ["Consulta dermatológica", "Tratamento de acne", "Check-up de pintas", "Queda de cabelo", "Peeling", "Laser"], ['["healthcare:speciality"~"dermatology"]'], "dermatologista"),
  c("pediatra", "Pediatra", "Pediatras", ["pediatra", "pediatras", "pediatria", "clinica infantil"], "clinic", "high", "agendamentos", "Agendar consulta",
    ["Consulta pediátrica", "Puericultura", "Vacinação", "Teleconsulta", "Desenvolvimento infantil", "Orientação para pais"], ['["healthcare:speciality"~"paediatrics"]'], "pediatra"),
  c("laboratorio", "Laboratório de análises", "Laboratórios de análises", ["laboratorio", "laboratorios", "analises clinicas", "exames de sangue"], "clinic", "medium",
    "agendamentos", "Agendar exame", ["Exames de sangue", "Coleta domiciliar", "Check-up", "Exames de imagem", "Resultados online", "Convênios"],
    ["healthcare=laboratory"], "laboratório de análises clínicas"),
  c("farmacia-manipulacao", "Farmácia de manipulação", "Farmácias de manipulação", ["farmacia de manipulacao", "manipulacao", "farmacia magistral"], "saude",
    "medium", "orçamentos", "Enviar receita", ["Fórmulas manipuladas", "Florais", "Dermocosméticos", "Suplementos", "Entrega", "Orçamento pelo WhatsApp"],
    ["amenity=pharmacy"], "farmácia de manipulação"),
  c("fonoaudiologia", "Fonoaudiólogo", "Fonoaudiólogos", ["fonoaudiologo", "fonoaudiologa", "fono", "fonoaudiologia"], "saude", "high", "agendamentos",
    "Agendar avaliação", ["Avaliação", "Terapia de fala", "Linguagem infantil", "Voz", "Audiologia", "Atendimento online"], ['["healthcare:speciality"~"speech"]'], "fonoaudiólogo"),
  c("terapias", "Terapias integrativas", "Terapias integrativas", ["acupuntura", "quiropraxia", "osteopatia", "reiki", "terapia holistica", "auriculoterapia"], "saude",
    "high", "agendamentos", "Agendar sessão", ["Acupuntura", "Quiropraxia", "Osteopatia", "Auriculoterapia", "Reiki", "Ventosaterapia"], ["healthcare=alternative"], "acupuntura"),

  // Movimento
  c("pilates", "Studio de pilates", "Studios de pilates", ["pilates", "studio de pilates", "estudio de pilates"], "studio", "high", "agendamentos",
    "Agendar aula experimental", ["Pilates solo", "Pilates aparelhos", "Aulas em dupla", "Reabilitação", "Pilates para gestantes", "Planos mensais"],
    ['["sport"~"pilates"]'], "studio de pilates"),
  c("yoga", "Studio de yoga", "Studios de yoga", ["yoga", "ioga", "meditacao", "studio de yoga"], "studio", "medium", "matrículas", "Agendar aula experimental",
    ["Hatha yoga", "Vinyasa", "Yoga para iniciantes", "Meditação", "Aulas online", "Retiros"], ['["sport"="yoga"]'], "studio de yoga"),
  c("danca", "Escola de dança", "Escolas de dança", ["escola de danca", "danca", "ballet", "bale", "zumba", "danca de salao"], "studio", "medium", "matrículas",
    "Agendar aula experimental", ["Ballet", "Dança de salão", "Zumba", "Jazz", "Turmas infantis", "Coreografia de casamento"], ["leisure=dance", "amenity=dancing_school"], "escola de dança"),
  c("crossfit", "Box de crossfit", "Boxes de crossfit", ["crossfit", "box de crossfit", "treinamento funcional", "funcional"], "academia", "high", "matrículas",
    "Agendar aula experimental", ["Crossfit", "Funcional", "LPO", "Mobilidade", "Kids", "Planos"], ['["sport"~"crossfit"]'], "crossfit"),
  c("artes-marciais", "Academia de artes marciais", "Academias de artes marciais", ["jiu jitsu", "jiujitsu", "muay thai", "karate", "judo", "artes marciais", "boxe"],
    "academia", "medium", "matrículas", "Agendar aula experimental", ["Jiu-jitsu", "Muay thai", "Boxe", "Judô", "Turmas infantis", "Aula experimental"],
    ['["sport"~"martial_arts|judo|karate|taekwondo|boxing|brazilian_jiu_jitsu"]'], "academia de jiu-jitsu"),

  // Educação
  c("idiomas", "Escola de idiomas", "Escolas de idiomas", ["escola de idiomas", "curso de ingles", "ingles", "espanhol", "idiomas"], "educacao", "high", "matrículas",
    "Agendar aula experimental", ["Inglês", "Espanhol", "Turmas kids", "Conversação", "Aulas online", "Preparatório para exames"], ["amenity=language_school"], "escola de inglês"),
  c("autoescola", "Autoescola", "Autoescolas", ["autoescola", "auto escola", "autoescolas", "cfc", "habilitacao"], "educacao", "medium", "matrículas", "Tirar minha CNH",
    ["Primeira habilitação", "Adição de categoria", "Aulas para habilitados", "Moto", "Reciclagem", "Simulados"], ["amenity=driving_school"], "autoescola"),
  c("reforco", "Reforço escolar", "Reforços escolares", ["reforco escolar", "aula particular", "explicadora", "cursinho", "preparatorio enem"], "educacao", "medium",
    "matrículas", "Falar com a coordenação", ["Reforço escolar", "Alfabetização", "Preparação para provas", "ENEM", "Tarefa assistida", "Aulas online"],
    ["amenity=prep_school"], "reforço escolar"),
  c("creche", "Creche e escola infantil", "Creches e escolas infantis", ["creche", "creches", "bercario", "escola infantil", "educacao infantil"], "educacao", "high",
    "matrículas", "Agendar visita", ["Berçário", "Maternal", "Período integral", "Alimentação balanceada", "Atividades", "Agenda digital"],
    ["amenity=kindergarten", "amenity=childcare"], "creche"),

  // Casa e construção
  c("construtora", "Construtora", "Construtoras", ["construtora", "construtoras", "reforma", "reformas", "empreiteira", "construcao civil"], "construcao", "high",
    "orçamentos", "Pedir orçamento", ["Construção", "Reformas", "Projetos", "Acabamentos", "Gestão de obra", "Laudos"],
    ["office=construction_company", "craft=builder"], "construtora"),
  c("marcenaria", "Marcenaria", "Marcenarias", ["marcenaria", "marceneiro", "moveis planejados", "planejados"], "construcao", "high", "orçamentos", "Pedir orçamento",
    ["Móveis planejados", "Cozinhas", "Closets", "Home office", "Painéis", "Restauração"], ["craft=carpenter"], "marcenaria"),
  c("vidracaria", "Vidraçaria", "Vidraçarias", ["vidracaria", "vidraceiro", "box de banheiro", "esquadrias", "serralheria"], "construcao", "medium", "orçamentos",
    "Pedir orçamento", ["Box para banheiro", "Espelhos", "Guarda-corpo", "Esquadrias", "Portas de vidro", "Fechamento de sacada"],
    ["craft=glaziery", "craft=metal_construction"], "vidraçaria"),
  c("moveis", "Loja de móveis", "Lojas de móveis", ["loja de moveis", "moveis", "colchoes", "decoracao de interiores"], "construcao", "medium", "vendas",
    "Falar com a loja", ["Sala e quarto", "Colchões", "Planejados", "Decoração", "Entrega e montagem", "Parcelamento"], ["shop=furniture", "shop=bed"], "loja de móveis"),
  c("material-construcao", "Material de construção", "Lojas de material de construção", ["material de construcao", "deposito de construcao", "home center"],
    "construcao", "low", "vendas", "Pedir orçamento", ["Cimento e areia", "Tintas", "Elétrica", "Hidráulica", "Pisos", "Entrega"], ["shop=hardware", "shop=doityourself"],
    "material de construção"),
  c("eletricista", "Eletricista", "Eletricistas", ["eletricista", "eletricistas", "instalacao eletrica"], "servicos-casa", "high", "orçamentos", "Chamar no WhatsApp",
    ["Instalações", "Quadro de energia", "Tomadas e iluminação", "Chuveiro", "Laudo elétrico", "Emergências"], ["craft=electrician"], "eletricista"),
  c("encanador", "Encanador", "Encanadores", ["encanador", "encanadores", "bombeiro hidraulico", "desentupidora", "hidraulica"], "servicos-casa", "high", "orçamentos",
    "Chamar no WhatsApp", ["Vazamentos", "Desentupimento", "Instalações", "Caixa d'água", "Aquecedor", "Emergências"], ["craft=plumber"], "encanador"),
  c("limpeza", "Empresa de limpeza", "Empresas de limpeza", ["limpeza", "diarista", "faxina", "limpeza pos obra", "higienizacao de sofa"], "servicos-casa", "medium",
    "orçamentos", "Pedir orçamento", ["Faxina residencial", "Limpeza pós-obra", "Higienização de sofás", "Limpeza comercial", "Vidros", "Planos mensais"],
    ["craft=cleaning", "shop=dry_cleaning"], "empresa de limpeza"),
  c("dedetizacao", "Dedetizadora", "Dedetizadoras", ["dedetizadora", "dedetizacao", "controle de pragas", "cupim"], "servicos-casa", "medium", "orçamentos",
    "Pedir orçamento", ["Dedetização", "Descupinização", "Desratização", "Limpeza de caixa d'água", "Sanitização", "Certificado"], ['["shop"="pest_control"]'], "dedetizadora"),
  c("ar-condicionado", "Ar-condicionado", "Técnicos de ar-condicionado", ["ar condicionado", "climatizacao", "refrigeracao", "instalacao de ar"], "servicos-casa",
    "medium", "orçamentos", "Pedir orçamento", ["Instalação", "Higienização", "Manutenção preventiva", "Conserto", "PMOC", "Contrato empresarial"], ["craft=hvac"],
    "instalação de ar-condicionado"),
  c("chaveiro", "Chaveiro", "Chaveiros", ["chaveiro", "chaveiros", "fechaduras"], "servicos-casa", "low", "atendimentos", "Chamar agora",
    ["Abertura de portas", "Cópia de chaves", "Fechaduras digitais", "Chave de carro", "Troca de segredo", "Atendimento 24h"], ["shop=locksmith", "craft=key_cutter"], "chaveiro"),
  c("assistencia-tecnica", "Assistência técnica", "Assistências técnicas", ["assistencia tecnica", "conserto de celular", "informatica", "manutencao de notebook"],
    "local-business", "medium", "orçamentos", "Pedir orçamento", ["Troca de tela", "Bateria", "Formatação", "Notebook", "Recuperação de dados", "Acessórios"],
    ["shop=mobile_phone", "shop=computer", "craft=electronics_repair"], "assistência técnica celular"),

  // Eventos
  c("buffet", "Buffet e casa de festas", "Buffets e casas de festas", ["buffet", "buffet infantil", "casa de festas", "salao de festas", "espaco de eventos"], "eventos",
    "high", "orçamentos", "Pedir orçamento", ["Aniversários", "Casamentos", "Festas infantis", "Eventos corporativos", "Cardápios", "Decoração"],
    ["amenity=events_venue"], "buffet"),
  c("decoracao-festas", "Decoração de festas", "Decoradoras de festas", ["decoracao de festas", "decoradora", "baloes", "cerimonialista", "cerimonial"], "eventos",
    "high", "orçamentos", "Pedir orçamento", ["Decoração temática", "Arcos de balões", "Mesa posta", "Cerimonial", "Casamentos", "Aluguel de peças"], ["shop=party"],
    "decoração de festas"),
  c("floricultura", "Floricultura", "Floriculturas", ["floricultura", "floriculturas", "flores", "buques"], "eventos", "medium", "pedidos", "Encomendar flores",
    ["Buquês", "Arranjos", "Entrega no mesmo dia", "Casamentos", "Coroas", "Plantas"], ["shop=florist"], "floricultura"),

  // Moda e varejo
  c("roupas", "Loja de roupas", "Lojas de roupas", ["loja de roupas", "moda feminina", "moda masculina", "roupas", "brecho"], "moda", "medium", "vendas", "Ver novidades",
    ["Novidades toda semana", "Provador em casa", "Plus size", "Parcelamento", "Retirada na loja", "Troca fácil"], ["shop=clothes", "shop=second_hand"], "loja de roupas"),
  c("otica", "Ótica", "Óticas", ["otica", "oticas", "oculos", "lentes de contato"], "moda", "medium", "vendas", "Falar com a ótica",
    ["Óculos de grau", "Óculos de sol", "Lentes de contato", "Exame de vista", "Ajustes", "Parcelamento"], ["shop=optician"], "ótica"),
  c("joalheria", "Joalheria", "Joalherias", ["joalheria", "joias", "semijoias", "relojoaria", "aliancas"], "moda", "medium", "vendas", "Falar com a joalheria",
    ["Alianças", "Joias sob medida", "Semijoias", "Consertos", "Gravação", "Relógios"], ["shop=jewelry", "shop=watches"], "joalheria"),

  // Automotivo
  c("lava-jato", "Lava-jato", "Lava-jatos", ["lava jato", "lava rapido", "estetica automotiva", "polimento", "lavagem de carro"], "auto-center", "medium",
    "agendamentos", "Agendar lavagem", ["Lavagem completa", "Polimento", "Higienização interna", "Vitrificação", "Lavagem de motor", "Leva e traz"], ["amenity=car_wash"], "lava jato"),
  c("borracharia", "Borracharia", "Borracharias", ["borracharia", "pneus", "alinhamento", "balanceamento"], "auto-center", "low", "atendimentos", "Chamar agora",
    ["Pneus novos", "Conserto de pneu", "Alinhamento", "Balanceamento", "Socorro", "Rodas"], ["shop=tyres"], "borracharia"),
  c("motos", "Oficina de motos", "Oficinas de motos", ["oficina de motos", "moto pecas", "motopecas", "mecanico de moto"], "auto-center", "medium", "orçamentos",
    "Pedir orçamento", ["Revisão", "Troca de óleo", "Freios", "Elétrica", "Peças", "Acessórios"], ["shop=motorcycle", "shop=motorcycle_repair"], "oficina de motos"),

  // Pets
  c("hotel-pet", "Hotel e creche para pets", "Hotéis e creches para pets", ["hotel para cachorro", "creche canina", "day care pet", "adestrador", "adestramento"], "pet",
    "high", "reservas", "Reservar vaga", ["Hospedagem", "Creche", "Adestramento", "Banho e tosa", "Leva e traz", "Relatório diário"],
    ["amenity=animal_boarding", "amenity=animal_training"], "hotel para cachorro"),

  // Serviços profissionais
  c("seguros", "Corretora de seguros", "Corretoras de seguros", ["seguros", "corretora de seguros", "seguro auto", "corretor de seguros"], "contabilidade", "medium",
    "cotações", "Fazer cotação", ["Seguro auto", "Seguro residencial", "Seguro de vida", "Plano de saúde", "Empresarial", "Consórcio"], ["office=insurance"], "corretora de seguros"),
  c("consultoria", "Consultoria", "Consultorias", ["consultoria", "consultor", "assessoria empresarial"], "contabilidade", "medium", "reuniões", "Agendar conversa",
    ["Diagnóstico", "Planejamento", "Processos", "Finanças", "Gestão de pessoas", "Treinamentos"], ["office=consulting"], "consultoria empresarial"),
  c("agencia-viagens", "Agência de viagens", "Agências de viagens", ["agencia de viagens", "turismo", "passeios", "excursoes", "viagens"], "hotel", "high", "reservas",
    "Montar minha viagem", ["Pacotes", "Passagens", "Passeios", "Excursões", "Lua de mel", "Seguro viagem"], ["shop=travel_agency"], "agência de viagens"),
  c("coworking", "Coworking", "Coworkings", ["coworking", "escritorio compartilhado", "sala comercial"], "local-business", "medium", "visitas", "Agendar visita",
    ["Estação fixa", "Estação rotativa", "Sala privativa", "Sala de reunião", "Endereço fiscal", "Café e internet"], ["amenity=coworking_space", "office=coworking"], "coworking"),
  c("grafica", "Gráfica", "Gráficas", ["grafica", "graficas", "comunicacao visual", "adesivos", "impressao"], "local-business", "medium", "orçamentos", "Pedir orçamento",
    ["Cartões de visita", "Banners", "Adesivos", "Fachadas", "Impressão digital", "Brindes"], ["shop=copyshop", "craft=printer"], "gráfica"),
];
