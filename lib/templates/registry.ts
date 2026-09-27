import type { TemplateId } from "@/lib/domain/categories";
import { EXTRA_TEMPLATES } from "@/lib/templates/registry-extra";
import type { TemplateDefinition } from "@/lib/templates/types";

/**
 * Biblioteca de templates. Cada um é CONFIGURAÇÃO (tema + ordem + imagens + bancos
 * de texto) sobre os mesmos componentes de seção — criar um protótipo custa zero
 * tokens: escolher template → preencher dados reais → aplicar identidade → renderizar.
 *
 * Tokens nos textos: {name} {city} {bairro} {cta} {goal} {categoria} {servico}
 * Regra: não afirmar fatos que não sabemos (anos de mercado, nº de clientes, prêmios).
 */
const img = (id: string, w = 1600) => `https://images.unsplash.com/${id}?auto=format&fit=crop&w=${w}&q=75`;

const BASE_TEMPLATES: Record<Exclude<TemplateId, keyof typeof EXTRA_TEMPLATES>, TemplateDefinition> = {
  estetica: {
    id: "estetica",
    label: "Estética & Beleza",
    mood: "Delicado e confiante: rosa névoa, bordô profundo e títulos clássicos.",
    theme: { primary: "#6B2346", accent: "#9DB4A0", surface: "tint", font: "marcellus", radius: "round" },
    heroLayout: "split",
    order: ["hero", "services", "about", "benefits", "gallery", "testimonials", "faq", "location", "cta"],
    images: {
      hero: [img("photo-1570172619644-dfd03ed5d881"), img("photo-1487412947147-5cebf100ffc2")],
      about: [img("photo-1540555700478-4be289fbecef", 1200), img("photo-1519823551278-64ac92734fb1", 1200)],
      gallery: [
        img("photo-1560066984-138dadb4c035", 900),
        img("photo-1522335789203-aabd1fc54bc9", 900),
        img("photo-1540555700478-4be289fbecef", 900),
        img("photo-1519823551278-64ac92734fb1", 900),
      ],
    },
    copy: {
      heroTitles: ["Sua pele, com hora marcada.", "Estética em {bairro}, sem pressa.", "Cuidado de pele que começa por uma conversa."],
      heroSubtitles: [
        "Veja os tratamentos {do_name}, tire dúvidas e agende sua avaliação pelo WhatsApp.",
        "Tratamentos faciais e corporais em {city}. Escolha o horário e confirme em uma mensagem.",
      ],
      about: [
        "{name} atende em {bairro}, {city}. Cada pele reage de um jeito, então o primeiro passo é entender o que você procura. Depois disso a gente indica o tratamento e o número de sessões.",
        "{No_name}, cada atendimento começa ouvindo você. Sem pacote empurrado. O plano é montado a partir da sua pele e da sua rotina.",
      ],
      highlights: ["Avaliação antes de começar", "Atendimento com hora marcada", "Agendamento pelo WhatsApp", "Em {bairro}"],
      servicesTitle: "Tratamentos",
      servicesSubtitle: "Os mais procurados. Os valores e o número de sessões são combinados na avaliação.",
      serviceBlurbs: [
        "Indicado depois da avaliação. Você sai sabendo quantas sessões fazem sentido.",
        "Procedimento feito com hora marcada e acompanhamento entre as sessões.",
        "Tira dúvidas antes pelo WhatsApp. A gente explica o passo a passo.",
        "Resultado depende da sua pele. Por isso a conversa vem primeiro.",
      ],
      benefitsTitle: "Como funciona",
      benefits: [
        { title: "1. Você chama no WhatsApp", description: "Conta o que quer tratar. Dá pra mandar foto, se preferir." },
        { title: "2. Avaliação", description: "Olhamos sua pele com calma e indicamos o protocolo." },
        { title: "3. Sessões com hora marcada", description: "Sem fila. Seu horário fica reservado." },
      ],
      galleryTitle: "O espaço",
      testimonials: [
        { name: "Juliana", text: "Fui pela limpeza de pele e voltei pra fazer o resto. Atendimento sem pressa, explicaram tudo." },
        { name: "Camila", text: "Gostei de não sair com um pacote empurrado. Fiz só o que precisava." },
        { name: "Renata", text: "Marquei pelo WhatsApp em dois minutos. Pontualidade impecável." },
      ],
      faq: [
        { question: "Preciso de avaliação antes?", answer: "Sim, pra maioria dos tratamentos. É ali que a gente entende sua pele e indica o que faz sentido." },
        { question: "Como faço para agendar?", answer: "Pelo WhatsApp. Você escolhe o dia e recebe a confirmação na hora." },
        { question: "Vocês têm estacionamento?", answer: "Confirme pelo WhatsApp. A gente te passa a melhor opção perto do endereço." },
        { question: "Quais formas de pagamento?", answer: "Pix, cartão de débito e crédito. Parcelamento a combinar." },
      ],
      ctaTitles: ["Quer saber qual tratamento combina com você?", "Sua avaliação começa com uma mensagem."],
      ctaSubtitle: "Responde no WhatsApp em horário de atendimento.",
    },
  },

  dentista: {
    id: "dentista",
    label: "Odontologia",
    mood: "Limpo e seguro: branco, verde-petróleo e muito respiro.",
    theme: { primary: "#0E5E63", accent: "#F2B94B", surface: "light", font: "manrope", radius: "soft" },
    heroLayout: "split",
    order: ["hero", "services", "benefits", "about", "testimonials", "faq", "location", "cta"],
    images: {
      hero: [img("photo-1629909613654-28e377c37b09"), img("photo-1588776814546-1ffcf47267a5")],
      about: [img("photo-1606811971618-4486d14f3f99", 1200), img("photo-1609840114035-3c981b782dfe", 1200)],
      gallery: [img("photo-1629909613654-28e377c37b09", 900), img("photo-1588776814546-1ffcf47267a5", 900), img("photo-1606811971618-4486d14f3f99", 900)],
    },
    copy: {
      heroTitles: ["Dentista em {bairro}, com horário que cabe na sua semana.", "Seu sorriso sem sustos.", "Consulta marcada em uma mensagem."],
      heroSubtitles: [
        "{name}: tratamentos explicados antes de começar, com orçamento claro. Agende pelo WhatsApp.",
        "Da limpeza ao implante. Você entende cada etapa e decide com calma.",
      ],
      about: [
        "{name} fica em {bairro}, {city}. Antes de qualquer tratamento, você recebe o plano e o orçamento por escrito. Sem surpresa na hora de pagar.",
        "Atendimento com hora marcada, sem sala de espera cheia. A primeira consulta serve pra entender o que você precisa, e só.",
      ],
      highlights: ["Orçamento antes de começar", "Hora marcada", "Agendamento pelo WhatsApp", "Em {bairro}"],
      servicesTitle: "Tratamentos",
      servicesSubtitle: "Tire dúvidas pelo WhatsApp. A indicação final é feita na consulta.",
      serviceBlurbs: [
        "Feito em etapas, com o plano explicado antes da primeira sessão.",
        "Indicado depois da avaliação clínica. Orçamento sem compromisso.",
        "Para quem quer resolver sem pressa e sem dor desnecessária.",
        "Atendimento com hora marcada e retorno agendado.",
      ],
      benefitsTitle: "Por que marcar aqui",
      benefits: [
        { title: "Orçamento claro", description: "Você sabe o valor de cada etapa antes de começar." },
        { title: "Horário respeitado", description: "Consulta marcada é consulta atendida no horário." },
        { title: "Fala com a gente direto", description: "Dúvida no meio do tratamento? Chama no WhatsApp." },
      ],
      galleryTitle: "Consultório",
      testimonials: [
        { name: "Marcelo", text: "Tinha pavor de dentista. Explicaram cada passo e foi tranquilo." },
        { name: "Patrícia", text: "Orçamento certinho, sem nada escondido. Recomendo." },
        { name: "André", text: "Consegui horário pro mesmo dia pelo WhatsApp." },
      ],
      faq: [
        { question: "Vocês atendem convênio?", answer: "Confirme pelo WhatsApp quais convênios são aceitos hoje." },
        { question: "A primeira consulta é paga?", answer: "Pergunte pelo WhatsApp. A gente te passa os valores atualizados." },
        { question: "Atendem urgência?", answer: "Mande mensagem descrevendo o caso. Sempre que possível encaixamos no mesmo dia." },
        { question: "Dá pra parcelar?", answer: "Sim, os tratamentos maiores podem ser parcelados no cartão." },
      ],
      ctaTitles: ["Marque sua consulta.", "Dor de dente não espera. Chama no WhatsApp."],
      ctaSubtitle: "Resposta rápida em horário de atendimento.",
    },
  },

  clinic: {
    id: "clinic",
    label: "Clínica & Saúde",
    mood: "Sereno e objetivo: azul profundo, branco e tipografia sem enfeite.",
    theme: { primary: "#1F4E8C", accent: "#3BB08F", surface: "light", font: "manrope", radius: "soft" },
    heroLayout: "split",
    order: ["hero", "services", "about", "benefits", "faq", "location", "cta"],
    images: {
      hero: [img("photo-1576091160399-112ba8d25d1d"), img("photo-1631217868264-e5b90bb7e133")],
      about: [img("photo-1519494026892-80bbd2d6fd0d", 1200), img("photo-1631217868264-e5b90bb7e133", 1200)],
      gallery: [img("photo-1519494026892-80bbd2d6fd0d", 900), img("photo-1631217868264-e5b90bb7e133", 900), img("photo-1576091160399-112ba8d25d1d", 900)],
    },
    copy: {
      heroTitles: ["Atendimento com hora marcada em {bairro}.", "Cuidar da saúde fica mais fácil quando é perto.", "Agende sua consulta sem ligar."],
      heroSubtitles: [
        "{name}, em {city}. Veja as especialidades e agende pelo WhatsApp.",
        "Consultas e acompanhamento com horário reservado pra você. Sem fila de espera.",
      ],
      about: [
        "{name} atende em {bairro}, {city}. A ideia é simples: horário marcado, conversa sem pressa e orientação clara no fim da consulta.",
        "Você agenda pelo WhatsApp, recebe a confirmação e chega sabendo o que levar. É isso.",
      ],
      highlights: ["Hora marcada", "Agendamento pelo WhatsApp", "Em {bairro}", "Retorno orientado"],
      servicesTitle: "Especialidades e atendimentos",
      servicesSubtitle: "Confirme disponibilidade de horários pelo WhatsApp.",
      serviceBlurbs: [
        "Consulta com horário reservado e orientação ao final.",
        "Acompanhamento com retorno agendado conforme a necessidade.",
        "Tire dúvidas antes pelo WhatsApp sobre preparo e documentos.",
        "Atendimento individual, sem pressa.",
      ],
      benefitsTitle: "Antes da sua consulta",
      benefits: [
        { title: "Agende por mensagem", description: "Escolha o dia pelo WhatsApp e receba a confirmação." },
        { title: "Chegue preparado", description: "A gente avisa o que levar e se precisa de algum preparo." },
        { title: "Retorno combinado", description: "Você sai com o próximo passo definido." },
      ],
      galleryTitle: "A clínica",
      testimonials: [
        { name: "Lúcia", text: "Marquei pelo WhatsApp e fui atendida no horário. Fez diferença." },
        { name: "Roberto", text: "Explicaram tudo com calma. Saí sabendo exatamente o que fazer." },
        { name: "Fernanda", text: "Atendimento humano, sem aquela correria de sempre." },
      ],
      faq: [
        { question: "Vocês atendem convênio?", answer: "Pergunte pelo WhatsApp. A lista de convênios muda, então confirmamos na hora." },
        { question: "Preciso levar algum exame?", answer: "Se tiver exames recentes, traga. Na dúvida, pergunte ao agendar." },
        { question: "Tem atendimento online?", answer: "Alguns atendimentos podem ser por vídeo. Consulte pelo WhatsApp." },
        { question: "Como remarcar?", answer: "É só mandar mensagem com antecedência." },
      ],
      ctaTitles: ["Agende sua consulta.", "Um horário reservado pra você."],
      ctaSubtitle: "Atendimento pelo WhatsApp em horário comercial.",
    },
  },

  restaurant: {
    id: "restaurant",
    label: "Restaurante & Gastronomia",
    mood: "Apetitoso e direto: fotos grandes, verde-oliva e açafrão.",
    theme: { primary: "#2F3E2B", accent: "#E0A21B", surface: "light", font: "bricolage", radius: "soft" },
    heroLayout: "overlay",
    order: ["hero", "services", "gallery", "about", "testimonials", "location", "faq", "cta"],
    images: {
      hero: [img("photo-1414235077428-338989a2e8c0"), img("photo-1517248135467-4c7edcad34c4"), img("photo-1555396273-367ea4eb4db5")],
      about: [img("photo-1559339352-11d035aa65de", 1200), img("photo-1517248135467-4c7edcad34c4", 1200)],
      gallery: [
        img("photo-1504674900247-0877df9cc836", 900),
        img("photo-1565299624946-b28f40a0ae38", 900),
        img("photo-1414235077428-338989a2e8c0", 900),
        img("photo-1513104890138-7c749659a591", 900),
        img("photo-1555396273-367ea4eb4db5", 900),
      ],
    },
    copy: {
      heroTitles: ["Mesa posta em {bairro}.", "Comida boa perto de você.", "Bateu a fome? A gente resolve."],
      heroSubtitles: [
        "{name}, em {city}. Veja o cardápio, os horários e reserve ou peça pelo WhatsApp.",
        "Do almoço ao jantar. Chame no WhatsApp pra reservar mesa ou pedir pra entrega.",
      ],
      about: [
        "{name} fica em {bairro}, {city}. Cozinha de verdade, feita no dia. Venha comer aqui ou peça pra levar.",
        "A gente cozinha pra quem mora e trabalha em {bairro}. Cardápio curto, bem feito, e mesa pra quem chega.",
      ],
      highlights: ["Reserva pelo WhatsApp", "Pedidos para viagem", "Em {bairro}", "Aberto hoje"],
      servicesTitle: "Na casa",
      servicesSubtitle: "O cardápio completo e os preços do dia você recebe no WhatsApp.",
      serviceBlurbs: [
        "Pergunte o que tem de especial hoje.",
        "Feito na hora. Dá pra pedir pra levar.",
        "Serve bem duas pessoas.",
        "Um dos mais pedidos da casa.",
      ],
      benefitsTitle: "Como pedir",
      benefits: [
        { title: "Reserve sua mesa", description: "Mande dia, horário e quantas pessoas. A confirmação vem na hora." },
        { title: "Peça pra viagem", description: "Faça o pedido no WhatsApp e retire sem esperar." },
        { title: "Grupos e eventos", description: "Aniversário ou confraternização? Combine o espaço com antecedência." },
      ],
      galleryTitle: "Do nosso fogão",
      testimonials: [
        { name: "Thiago", text: "Voltei na mesma semana. O prato do dia vale cada centavo." },
        { name: "Beatriz", text: "Reservei pelo WhatsApp pra um aniversário e deu tudo certo." },
        { name: "Carlos", text: "Porção generosa e atendimento rápido." },
      ],
      faq: [
        { question: "Precisa reservar?", answer: "Nos fins de semana é melhor. Durante a semana geralmente tem mesa." },
        { question: "Vocês entregam?", answer: "Pergunte pelo WhatsApp se atendemos o seu bairro." },
        { question: "Tem opção vegetariana?", answer: "Tem sim. Peça as opções do dia no WhatsApp." },
        { question: "Aceitam cartão?", answer: "Pix, débito e crédito." },
      ],
      ctaTitles: ["Reserve agora pelo WhatsApp.", "Hoje tem mesa pra você?"],
      ctaSubtitle: "Mande uma mensagem com o dia e o número de pessoas.",
    },
  },

  barbearia: {
    id: "barbearia",
    label: "Barbearia",
    mood: "Clássico e sóbrio: grafite, latão e títulos com serifa.",
    theme: { primary: "#C8913A", accent: "#E8DCC8", surface: "dark", font: "playfair", radius: "none" },
    heroLayout: "overlay",
    order: ["hero", "services", "about", "gallery", "testimonials", "location", "cta"],
    images: {
      hero: [img("photo-1503951914875-452162b0f3f1"), img("photo-1585747860715-2ba37e788b70")],
      about: [img("photo-1621605815971-fbc98d665033", 1200), img("photo-1599351431202-1e0f0137899a", 1200)],
      gallery: [
        img("photo-1585747860715-2ba37e788b70", 900),
        img("photo-1621605815971-fbc98d665033", 900),
        img("photo-1599351431202-1e0f0137899a", 900),
        img("photo-1503951914875-452162b0f3f1", 900),
      ],
    },
    copy: {
      heroTitles: ["Corte marcado. Sem fila.", "Barba e cabelo em {bairro}.", "Seu horário te espera."],
      heroSubtitles: [
        "{name}, em {city}. Escolha o serviço e reserve seu horário pelo WhatsApp.",
        "Chegou, sentou, cortou. Agende pelo WhatsApp e não pegue fila.",
      ],
      about: [
        "{name} fica em {bairro}. Cadeira reservada, tempo certo pra cada corte e conversa boa. Sem correria.",
        "Barbearia de bairro, do jeito que tem que ser. Horário marcado pra você não perder a tarde esperando.",
      ],
      highlights: ["Horário marcado", "Agende no WhatsApp", "Em {bairro}", "Corte + barba"],
      servicesTitle: "Serviços",
      servicesSubtitle: "Valores atualizados no WhatsApp.",
      serviceBlurbs: [
        "Acabamento na navalha.",
        "Com toalha quente e finalização.",
        "Pergunte pelo combo com barba.",
        "Cerca de 40 minutos na cadeira.",
      ],
      benefitsTitle: "Do seu jeito",
      benefits: [
        { title: "Sem fila", description: "Seu horário fica reservado. Chegou, sentou." },
        { title: "Lembrete", description: "A gente avisa no WhatsApp antes do horário." },
        { title: "Remarcar é fácil", description: "Imprevisto acontece. Manda mensagem e troca o horário." },
      ],
      galleryTitle: "Trabalhos",
      testimonials: [
        { name: "Diego", text: "Melhor degradê que já fiz. E sem fila." },
        { name: "Rafael", text: "Marco pelo WhatsApp toda quinzena. Nunca atrasou." },
        { name: "Bruno", text: "Barba impecável, ambiente bom." },
      ],
      faq: [
        { question: "Atendem sem horário?", answer: "Se tiver cadeira livre, sim. Mas com horário marcado você não espera." },
        { question: "Quanto tempo leva um corte?", answer: "Por volta de 40 minutos. Corte e barba, cerca de 1 hora." },
        { question: "Formas de pagamento?", answer: "Pix, débito e crédito." },
      ],
      ctaTitles: ["Reserve sua cadeira.", "Bora marcar?"],
      ctaSubtitle: "Mande o serviço e o melhor horário pra você.",
    },
  },

  academia: {
    id: "academia",
    label: "Academia & Fitness",
    mood: "Energia sem neon: branco, azul-cobalto e amarelo, títulos condensados.",
    theme: { primary: "#1D3FBF", accent: "#FFC933", surface: "light", font: "anton", radius: "none" },
    heroLayout: "stacked",
    order: ["hero", "services", "benefits", "gallery", "about", "testimonials", "faq", "location", "cta"],
    images: {
      hero: [img("photo-1534438327276-14e5300c3a48"), img("photo-1571019613454-1cb2f99b2d8b")],
      about: [img("photo-1540497077202-7c8a3999166f", 1200), img("photo-1583454110551-21f2fa2afe61", 1200)],
      gallery: [
        img("photo-1517836357463-d25dfeac3438", 900),
        img("photo-1540497077202-7c8a3999166f", 900),
        img("photo-1583454110551-21f2fa2afe61", 900),
        img("photo-1571019613454-1cb2f99b2d8b", 900),
      ],
    },
    copy: {
      heroTitles: ["Treine perto de casa.", "Primeira aula por nossa conta.", "Comece segunda. Ou hoje."],
      heroSubtitles: [
        "{name}, em {bairro}. Conheça os planos, os horários e agende uma aula experimental pelo WhatsApp.",
        "Musculação, aulas e acompanhamento em {city}. Mande mensagem e venha conhecer.",
      ],
      about: [
        "{name} fica em {bairro}, {city}. Equipamento pra treinar de verdade e gente pra te orientar no começo.",
        "Você não precisa chegar pronto. Precisa chegar. A gente monta o treino a partir de onde você está.",
      ],
      highlights: ["Aula experimental", "Planos mensais", "Em {bairro}", "Orientação no salão"],
      servicesTitle: "Modalidades",
      servicesSubtitle: "Horários das aulas e valores dos planos pelo WhatsApp.",
      serviceBlurbs: [
        "Com orientação de professor no salão.",
        "Turmas em horários variados durante a semana.",
        "Bom pra quem está começando ou voltando.",
        "Pergunte pelo plano que inclui essa modalidade.",
      ],
      benefitsTitle: "Pra você começar",
      benefits: [
        { title: "Aula experimental", description: "Venha treinar um dia antes de decidir." },
        { title: "Treino montado", description: "Você começa com uma ficha pensada pro seu objetivo." },
        { title: "Horários amplos", description: "Confira os horários de funcionamento abaixo." },
      ],
      galleryTitle: "Estrutura",
      testimonials: [
        { name: "Lucas", text: "Voltei a treinar depois de 2 anos parado. A orientação no começo fez diferença." },
        { name: "Mariana", text: "As aulas coletivas são o ponto alto da minha semana." },
        { name: "Paulo", text: "Perto de casa e com horário que encaixa. Sem desculpa." },
      ],
      faq: [
        { question: "Posso fazer uma aula teste?", answer: "Pode. Agende pelo WhatsApp e traga roupa de treino." },
        { question: "Tem fidelidade?", answer: "Temos planos com e sem fidelidade. Pergunte os valores." },
        { question: "Preciso de avaliação física?", answer: "É recomendada para montar seu treino. Pergunte como agendar." },
        { question: "Tem estacionamento?", answer: "Confirme pelo WhatsApp." },
      ],
      ctaTitles: ["Agende sua aula experimental.", "O primeiro treino é o mais difícil. Vem."],
      ctaSubtitle: "Mande uma mensagem e escolha o melhor horário.",
    },
  },

  advocacia: {
    id: "advocacia",
    label: "Advocacia",
    mood: "Institucional e calmo: azul-marinho, dourado fosco, serifa clássica.",
    theme: { primary: "#14213D", accent: "#B08D57", surface: "light", font: "cormorant", radius: "none" },
    heroLayout: "split",
    order: ["hero", "services", "about", "benefits", "faq", "location", "contact"],
    images: {
      hero: [img("photo-1589829545856-d10d557cf95f"), img("photo-1505664194779-8beaceb93744")],
      about: [img("photo-1450101499163-c8848c66ca85", 1200), img("photo-1521791055366-0d553872125f", 1200)],
      gallery: [img("photo-1505664194779-8beaceb93744", 900), img("photo-1450101499163-c8848c66ca85", 900)],
    },
    copy: {
      heroTitles: ["Orientação jurídica clara, em {city}.", "Seu caso explicado sem juridiquês.", "Fale com um advogado antes de decidir."],
      heroSubtitles: [
        "{name}. Agende uma conversa inicial pelo WhatsApp e entenda suas opções.",
        "Atendimento presencial em {bairro} e online. Marque um horário para analisar seu caso.",
      ],
      about: [
        "{name} atende em {bairro}, {city}. Na primeira conversa, você conta o que está acontecendo e sai sabendo quais caminhos existem, e o que cada um envolve.",
        "Cada caso tem prazo e detalhe. Por isso o atendimento começa com uma análise do seu caso, e não com uma promessa.",
      ],
      highlights: ["Atendimento presencial e online", "Agendamento pelo WhatsApp", "Em {bairro}", "Sigilo profissional"],
      servicesTitle: "Áreas de atuação",
      servicesSubtitle: "Não achou sua situação aqui? Mande uma mensagem e pergunte.",
      serviceBlurbs: [
        "Análise do caso, orientação e acompanhamento do processo.",
        "Atuação consultiva e contenciosa.",
        "Primeiro, entendemos os documentos. Depois, o melhor caminho.",
        "Atendimento com horário marcado.",
      ],
      benefitsTitle: "Como é o atendimento",
      benefits: [
        { title: "Conversa inicial", description: "Você explica o caso e tira as primeiras dúvidas." },
        { title: "Análise", description: "Avaliamos documentos, prazos e possibilidades." },
        { title: "Proposta clara", description: "Honorários e próximos passos combinados por escrito." },
      ],
      galleryTitle: "Escritório",
      testimonials: [
        { name: "Cláudia", text: "Explicaram meu caso de um jeito que eu finalmente entendi." },
        { name: "Jorge", text: "Atendimento sério e sempre respondendo no prazo." },
        { name: "Sônia", text: "Me senti segura desde a primeira conversa." },
      ],
      faq: [
        { question: "A primeira consulta é cobrada?", answer: "Pergunte pelo WhatsApp. As condições são informadas antes do agendamento." },
        { question: "Atendem online?", answer: "Sim, por videochamada, para todo o Brasil quando a área permitir." },
        { question: "Que documentos devo levar?", answer: "Tudo que tiver relação com o caso. Na dúvida, mande uma lista por mensagem." },
        { question: "Meus dados ficam sigilosos?", answer: "Sim. O sigilo é um dever profissional do advogado." },
      ],
      ctaTitles: ["Agende uma conversa inicial.", "Entenda seu caso antes de decidir."],
      ctaSubtitle: "Atendimento com horário marcado.",
    },
  },

  contabilidade: {
    id: "contabilidade",
    label: "Contabilidade",
    mood: "Preciso e acessível: verde-floresta, branco e números em destaque.",
    theme: { primary: "#1B5E4B", accent: "#F2A541", surface: "light", font: "sora", radius: "soft" },
    heroLayout: "split",
    order: ["hero", "services", "benefits", "about", "faq", "location", "contact"],
    images: {
      hero: [img("photo-1554224155-6726b3ff858f"), img("photo-1454165804606-c3d57bc86b40")],
      about: [img("photo-1497366216548-37526070297c", 1200), img("photo-1556761175-5973dc0f32e7", 1200)],
      gallery: [img("photo-1497366811353-6870744d04b2", 900), img("photo-1454165804606-c3d57bc86b40", 900)],
    },
    copy: {
      heroTitles: ["Contabilidade que responde no WhatsApp.", "Sua empresa em dia, sem dor de cabeça.", "Abra, regularize ou troque de contador."],
      heroSubtitles: [
        "{name}, em {city}. MEI, pequenas empresas e profissionais liberais. Peça um orçamento por mensagem.",
        "Impostos, folha e obrigações em dia. Você cuida do negócio, a gente cuida do resto.",
      ],
      about: [
        "{name} atende empresas de {city} e região. Nada de linguagem técnica sem explicação: você sabe o que está pagando e por quê.",
        "Trocar de contador parece complicado, mas quem faz a transição somos nós. Você só assina.",
      ],
      highlights: ["Atendimento pelo WhatsApp", "MEI a Lucro Presumido", "Em {bairro}", "Troca de contador sem burocracia"],
      servicesTitle: "Serviços",
      servicesSubtitle: "Orçamento conforme o porte e o regime da empresa.",
      serviceBlurbs: [
        "Com prazos acompanhados e aviso antes do vencimento.",
        "Feito por quem entende o seu regime tributário.",
        "Orçamento fechado, sem taxa escondida.",
        "Tira dúvidas direto pelo WhatsApp.",
      ],
      benefitsTitle: "Por que trocar",
      benefits: [
        { title: "Resposta rápida", description: "Dúvida de imposto não pode esperar uma semana." },
        { title: "Tudo explicado", description: "Guia, prazo e valor, sem juridiquês contábil." },
        { title: "Transição cuidada", description: "Pegamos a documentação com o contador anterior." },
      ],
      galleryTitle: "Escritório",
      testimonials: [
        { name: "Eduardo", text: "Troquei de contador e não precisei fazer nada. Eles resolveram tudo." },
        { name: "Aline", text: "Finalmente entendo o que pago de imposto." },
        { name: "Márcio", text: "Respondem rápido e sem enrolar." },
      ],
      faq: [
        { question: "Atendem MEI?", answer: "Sim. E ajudamos quando for hora de desenquadrar." },
        { question: "Como é a troca de contador?", answer: "Você autoriza e a gente pede os documentos ao escritório anterior." },
        { question: "Quanto custa?", answer: "Depende do regime e do volume de notas. Peça um orçamento pelo WhatsApp." },
        { question: "Atendem empresas de outras cidades?", answer: "Sim, o atendimento pode ser 100% online." },
      ],
      ctaTitles: ["Peça um orçamento.", "Quer saber quanto sua empresa pode economizar?"],
      ctaSubtitle: "Mande o CNPJ ou o tipo de negócio e retornamos com uma proposta.",
    },
  },

  "auto-center": {
    id: "auto-center",
    label: "Auto Center & Oficina",
    mood: "Robusto: branco, vermelho-sinal e títulos condensados em caixa alta.",
    theme: { primary: "#C8102E", accent: "#1E2227", surface: "light", font: "anton", radius: "none" },
    heroLayout: "overlay",
    order: ["hero", "services", "benefits", "about", "gallery", "testimonials", "faq", "location", "cta"],
    images: {
      hero: [img("photo-1486262715619-67b85e0b08d3"), img("photo-1619642751034-765dfdf7c58e")],
      about: [img("photo-1487754180451-c456f719a1fc", 1200), img("photo-1580273916550-e323be2ae537", 1200)],
      gallery: [
        img("photo-1487754180451-c456f719a1fc", 900),
        img("photo-1619642751034-765dfdf7c58e", 900),
        img("photo-1580273916550-e323be2ae537", 900),
        img("photo-1486262715619-67b85e0b08d3", 900),
      ],
    },
    copy: {
      heroTitles: ["Seu carro em boas mãos.", "Orçamento antes de mexer.", "Revisão marcada em {bairro}."],
      heroSubtitles: [
        "{name}, em {city}. Mande o modelo do carro e o problema pelo WhatsApp e receba um orçamento.",
        "Diagnóstico, orçamento aprovado por você e serviço com prazo. Chame no WhatsApp.",
      ],
      about: [
        "{name} fica em {bairro}, {city}. A regra aqui é simples: nada é trocado sem você aprovar o orçamento antes.",
        "Você manda uma foto ou descreve o barulho. A gente diz o que pode ser e quanto custa pra verificar.",
      ],
      highlights: ["Orçamento antes do serviço", "Peças com nota", "Em {bairro}", "Atendimento pelo WhatsApp"],
      servicesTitle: "Serviços",
      servicesSubtitle: "Valores variam por modelo. Peça orçamento pelo WhatsApp.",
      serviceBlurbs: [
        "Orçamento aprovado por você antes de começar.",
        "Mande o modelo e o ano do carro pelo WhatsApp.",
        "Peças com nota fiscal.",
        "Prazo combinado na entrega do carro.",
      ],
      benefitsTitle: "Sem surpresa",
      benefits: [
        { title: "Orçamento primeiro", description: "Nada é trocado sem a sua aprovação." },
        { title: "Peça velha na mão", description: "Quer ver o que foi trocado? A gente mostra." },
        { title: "Prazo combinado", description: "Você sabe quando pegar o carro." },
      ],
      galleryTitle: "A oficina",
      testimonials: [
        { name: "Sérgio", text: "Mandei foto pelo WhatsApp e já saí com o orçamento. Serviço honesto." },
        { name: "Vanessa", text: "Me mostraram a peça trocada. Isso passa confiança." },
        { name: "Anderson", text: "Prazo cumprido e preço justo." },
      ],
      faq: [
        { question: "Fazem orçamento pelo WhatsApp?", answer: "Um orçamento inicial, sim. O valor final é confirmado depois do diagnóstico." },
        { question: "Trabalham com todas as marcas?", answer: "Pergunte pelo WhatsApp informando modelo e ano." },
        { question: "Tem garantia?", answer: "Sim. O prazo de garantia é informado no orçamento." },
        { question: "Precisa agendar?", answer: "Recomendado para revisões. Emergências, mande mensagem." },
      ],
      ctaTitles: ["Peça seu orçamento.", "Barulho estranho? Manda um áudio."],
      ctaSubtitle: "Informe modelo, ano e o que está acontecendo.",
    },
  },

  "real-estate": {
    id: "real-estate",
    label: "Imóveis & Arquitetura",
    mood: "Editorial: grafite, areia e fotos grandes de espaços.",
    theme: { primary: "#23262B", accent: "#B39269", surface: "light", font: "sora", radius: "none" },
    heroLayout: "overlay",
    order: ["hero", "services", "gallery", "about", "benefits", "testimonials", "location", "contact"],
    images: {
      hero: [img("photo-1600596542815-ffad4c1539a9"), img("photo-1600585154340-be6161a56a0c")],
      about: [img("photo-1600607687939-ce8a6c25118c", 1200), img("photo-1560518883-ce09059eeffa", 1200)],
      gallery: [
        img("photo-1600585154340-be6161a56a0c", 900),
        img("photo-1600607687939-ce8a6c25118c", 900),
        img("photo-1560518883-ce09059eeffa", 900),
        img("photo-1600596542815-ffad4c1539a9", 900),
      ],
    },
    copy: {
      heroTitles: ["O próximo endereço começa aqui.", "Imóveis em {city}, com quem conhece a região.", "Projetos pensados pra como você vive."],
      heroSubtitles: [
        "{name}. Conte o que procura pelo WhatsApp e receba opções que fazem sentido pra você.",
        "Atendimento em {bairro} e região. Agende uma visita ou uma conversa sobre seu projeto.",
      ],
      about: [
        "{name} atua em {city}. Antes de mostrar qualquer coisa, a gente pergunta: quantas pessoas, qual rotina, qual orçamento. Economiza visita à toa.",
        "Conhecer o bairro faz diferença na hora de escolher. É o que a gente faz todo dia em {bairro}.",
      ],
      highlights: ["Atendimento pelo WhatsApp", "Visitas agendadas", "Atuação em {city}", "Acompanhamento até o fim"],
      servicesTitle: "O que fazemos",
      servicesSubtitle: "Conte o que você precisa e indicamos o melhor caminho.",
      serviceBlurbs: [
        "Com atendimento do primeiro contato até a assinatura.",
        "Opções filtradas pelo que você realmente procura.",
        "Explicamos cada etapa e cada custo.",
        "Agende uma conversa sem compromisso.",
      ],
      benefitsTitle: "Como trabalhamos",
      benefits: [
        { title: "Entendemos o perfil", description: "Rotina, orçamento e prioridades antes de qualquer visita." },
        { title: "Seleção enxuta", description: "Menos opções, mais certeiras." },
        { title: "Até o fim", description: "Documentação e burocracia acompanhadas de perto." },
      ],
      galleryTitle: "Portfólio",
      testimonials: [
        { name: "Gustavo", text: "Mostraram só o que fazia sentido. Achamos o apartamento na segunda visita." },
        { name: "Helena", text: "Acompanharam toda a papelada. Tranquilo do início ao fim." },
        { name: "Ricardo", text: "Conhecem o bairro de verdade." },
      ],
      faq: [
        { question: "Como agendar uma visita?", answer: "Pelo WhatsApp. Informe o imóvel ou o que procura." },
        { question: "Ajudam com financiamento?", answer: "Sim, orientamos as etapas e a documentação." },
        { question: "Atendem outras cidades?", answer: "Pergunte pelo WhatsApp. Depende da região." },
      ],
      ctaTitles: ["Conte o que você procura.", "Vamos marcar uma conversa?"],
      ctaSubtitle: "Resposta pelo WhatsApp em horário comercial.",
    },
  },

  hotel: {
    id: "hotel",
    label: "Hotel & Pousada",
    mood: "Leve e ensolarado: azul-mar, areia e títulos com serifa.",
    theme: { primary: "#0B5563", accent: "#E9B872", surface: "light", font: "playfair", radius: "soft" },
    heroLayout: "overlay",
    order: ["hero", "about", "services", "gallery", "testimonials", "faq", "location", "cta"],
    images: {
      hero: [img("photo-1566073771259-6a8506099945"), img("photo-1520250497591-112f2f40a3f4")],
      about: [img("photo-1582719478250-c89cae4dc85b", 1200), img("photo-1571003123894-1f0594d2b5d9", 1200)],
      gallery: [
        img("photo-1582719478250-c89cae4dc85b", 900),
        img("photo-1571003123894-1f0594d2b5d9", 900),
        img("photo-1520250497591-112f2f40a3f4", 900),
        img("photo-1566073771259-6a8506099945", 900),
      ],
    },
    copy: {
      heroTitles: ["Reserve direto e economize.", "Sua estadia em {city} começa aqui.", "Descanso marcado."],
      heroSubtitles: [
        "{name}. Consulte datas e tarifas pelo WhatsApp, sem taxa de plataforma.",
        "Quartos, café da manhã e atendimento de perto. Reserve direto com a gente.",
      ],
      about: [
        "{name} fica em {bairro}, {city}. Reservando direto, você fala com quem vai te receber e não paga comissão de site de reserva.",
        "Hospedagem com cara de casa. Pergunte o que quiser antes de reservar: a resposta vem de quem está aqui.",
      ],
      highlights: ["Reserva direta", "Café da manhã", "Em {bairro}", "Atendimento pelo WhatsApp"],
      servicesTitle: "Estrutura",
      servicesSubtitle: "Consulte disponibilidade e tarifas pelo WhatsApp.",
      serviceBlurbs: [
        "Pergunte pela disponibilidade nas suas datas.",
        "Incluso em todas as tarifas? Confirme ao reservar.",
        "Para curtir sem sair daqui.",
        "Informe na reserva se precisar.",
      ],
      benefitsTitle: "Por que reservar direto",
      benefits: [
        { title: "Sem comissão", description: "A tarifa direta costuma ser a melhor." },
        { title: "Fala com a gente", description: "Dúvidas respondidas por quem conhece cada quarto." },
        { title: "Flexibilidade", description: "Combine check-in e pedidos especiais antes de chegar." },
      ],
      galleryTitle: "Conheça",
      testimonials: [
        { name: "Isabela", text: "Reservamos direto pelo WhatsApp e saiu mais barato. Café da manhã caprichado." },
        { name: "Felipe", text: "Atendimento atencioso do começo ao fim." },
        { name: "Tânia", text: "Quarto limpo, silencioso, bem localizado." },
      ],
      faq: [
        { question: "Qual o horário de check-in?", answer: "Confirme os horários abaixo ou pelo WhatsApp." },
        { question: "Aceitam pets?", answer: "Pergunte antes de reservar. As regras podem variar por quarto." },
        { question: "Tem estacionamento?", answer: "Consulte disponibilidade pelo WhatsApp." },
        { question: "Como funciona o pagamento?", answer: "Um sinal confirma a reserva e o restante é pago na chegada." },
      ],
      ctaTitles: ["Consulte suas datas.", "Reserve direto pelo WhatsApp."],
      ctaSubtitle: "Mande as datas e o número de hóspedes.",
    },
  },

  pet: {
    id: "pet",
    label: "Pet & Veterinária",
    mood: "Acolhedor e alegre: laranja, verde-água e letras arredondadas.",
    theme: { primary: "#E0661B", accent: "#2A9D8F", surface: "tint", font: "nunito", radius: "round" },
    heroLayout: "split",
    order: ["hero", "services", "benefits", "gallery", "about", "testimonials", "faq", "location", "cta"],
    images: {
      hero: [img("photo-1548199973-03cce0bbc87b"), img("photo-1587300003388-59208cc962cb")],
      about: [img("photo-1583337130417-3346a1be7dee", 1200), img("photo-1516734212186-a967f81ad0d7", 1200)],
      gallery: [
        img("photo-1587300003388-59208cc962cb", 900),
        img("photo-1583337130417-3346a1be7dee", 900),
        img("photo-1516734212186-a967f81ad0d7", 900),
        img("photo-1548199973-03cce0bbc87b", 900),
      ],
    },
    copy: {
      heroTitles: ["Seu pet bem cuidado, pertinho de casa.", "Banho, tosa e carinho em {bairro}.", "Cuidado de quem ama bicho."],
      heroSubtitles: [
        "{name}, em {city}. Agende pelo WhatsApp e mande a foto do seu pet.",
        "Serviços para cães e gatos com horário marcado. Chame no WhatsApp.",
      ],
      about: [
        "{name} fica em {bairro}, {city}. Cada bichinho tem seu jeito, e a gente respeita o tempo de cada um.",
        "Aqui o pet não é mais um da fila. Horário marcado, atenção e atualização pelo WhatsApp.",
      ],
      highlights: ["Horário marcado", "Agende no WhatsApp", "Em {bairro}", "Cães e gatos"],
      servicesTitle: "Serviços",
      servicesSubtitle: "Valores variam por porte. Pergunte pelo WhatsApp.",
      serviceBlurbs: [
        "Informe raça e porte ao agendar.",
        "Com produtos próprios para pets.",
        "Pergunte pelos pacotes mensais.",
        "Com horário marcado, sem estresse.",
      ],
      benefitsTitle: "Tranquilidade pra você",
      benefits: [
        { title: "Foto no WhatsApp", description: "Mandamos notícia enquanto seu pet está aqui." },
        { title: "Horário marcado", description: "Menos tempo esperando, menos estresse pro bicho." },
        { title: "Leva e traz", description: "Pergunte se atendemos o seu bairro." },
      ],
      galleryTitle: "Nossos clientes de quatro patas",
      testimonials: [
        { name: "Priscila", text: "Minha cachorra tem medo de banho e aqui ela vai tranquila." },
        { name: "Rodrigo", text: "Mandam foto pelo WhatsApp. Adoro." },
        { name: "Letícia", text: "Tosa impecável e preço justo." },
      ],
      faq: [
        { question: "Precisa agendar?", answer: "Sim, pra garantir horário e evitar espera." },
        { question: "Atendem gatos?", answer: "Pergunte pelo WhatsApp sobre os serviços para gatos." },
        { question: "Tem leva e traz?", answer: "Depende do bairro. Consulte pelo WhatsApp." },
        { question: "Precisa de vacina em dia?", answer: "Sim, pedimos a carteirinha de vacinação atualizada." },
      ],
      ctaTitles: ["Agende o banho do seu pet.", "Manda a foto dele pra gente!"],
      ctaSubtitle: "Informe raça, porte e o serviço desejado.",
    },
  },

  "local-business": {
    id: "local-business",
    label: "Negócio local",
    mood: "Versátil e direto: azul-tinta, coral e tipografia geométrica.",
    theme: { primary: "#243B6B", accent: "#F26B5B", surface: "light", font: "sora", radius: "soft" },
    heroLayout: "split",
    order: ["hero", "services", "about", "benefits", "testimonials", "faq", "location", "cta"],
    images: {
      hero: [img("photo-1556742049-0cfed4f6a45d"), img("photo-1600880292203-757bb62b4baf")],
      about: [img("photo-1556761175-5973dc0f32e7", 1200), img("photo-1542744173-8e7e53415bb0", 1200)],
      gallery: [
        img("photo-1441986300917-64674bd600d8", 900),
        img("photo-1556742049-0cfed4f6a45d", 900),
        img("photo-1600880292203-757bb62b4baf", 900),
        img("photo-1542744173-8e7e53415bb0", 900),
      ],
    },
    copy: {
      heroTitles: ["{name}, em {city}.", "Atendimento de perto, em {bairro}.", "Fale com a gente no WhatsApp."],
      heroSubtitles: [
        "Veja o que fazemos, onde estamos e chame no WhatsApp. A resposta vem de quem atende de verdade.",
        "Orçamentos, dúvidas e pedidos pelo WhatsApp. Simples assim.",
      ],
      about: [
        "{name} atende em {bairro}, {city}. Somos um negócio local, e isso significa atendimento feito por gente que conhece a região.",
        "Sem central de atendimento. Você manda mensagem e quem responde é quem vai resolver.",
      ],
      highlights: ["Atendimento pelo WhatsApp", "Em {bairro}", "Orçamento sem compromisso", "Negócio local"],
      servicesTitle: "O que fazemos",
      servicesSubtitle: "Pergunte pelo WhatsApp o que não estiver aqui.",
      serviceBlurbs: [
        "Orçamento sem compromisso pelo WhatsApp.",
        "Atendimento com hora marcada.",
        "Pergunte condições e prazos.",
        "Feito por quem conhece a região.",
      ],
      benefitsTitle: "Por que chamar a gente",
      benefits: [
        { title: "Resposta rápida", description: "Mensagem respondida em horário de atendimento." },
        { title: "Perto de você", description: "Atendemos {bairro} e região." },
        { title: "Combinado claro", description: "Valor e prazo definidos antes de começar." },
      ],
      galleryTitle: "Nosso trabalho",
      testimonials: [
        { name: "Daniela", text: "Atendimento rápido e sem enrolação." },
        { name: "Mateus", text: "Resolveram no mesmo dia. Recomendo." },
        { name: "Cristina", text: "Preço justo e combinado cumprido." },
      ],
      faq: [
        { question: "Como peço um orçamento?", answer: "Mande uma mensagem no WhatsApp contando o que precisa." },
        { question: "Qual o horário de atendimento?", answer: "Veja os horários abaixo ou pergunte pelo WhatsApp." },
        { question: "Quais formas de pagamento?", answer: "Pix, débito e crédito." },
      ],
      ctaTitles: ["Fale com a gente.", "Peça seu orçamento pelo WhatsApp."],
      ctaSubtitle: "Resposta em horário de atendimento.",
    },
  },
};

export const TEMPLATES: Record<TemplateId, TemplateDefinition> = { ...BASE_TEMPLATES, ...EXTRA_TEMPLATES };

export function getTemplate(id: string): TemplateDefinition {
  return TEMPLATES[id as TemplateId] ?? TEMPLATES["local-business"];
}

export const TEMPLATE_LIST = Object.values(TEMPLATES);
