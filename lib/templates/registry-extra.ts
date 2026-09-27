import type { TemplateDefinition } from "@/lib/templates/types";

/**
 * Templates v2 — segmentos que antes caíam no genérico. Mesmas regras dos originais:
 * textos com tokens ({name}, {city}, {bairro}, {cta}…), nada de fatos que não sabemos
 * (anos de mercado, número de clientes, prêmios) e depoimentos marcados como ilustrativos.
 */
const img = (id: string, w = 1600) => `https://images.unsplash.com/${id}?auto=format&fit=crop&w=${w}&q=75`;

export const EXTRA_TEMPLATES = {
  cafe: {
    id: "cafe",
    label: "Café & Padaria",
    mood: "Cheiro de forno: marrom torrado, mostarda e títulos com personalidade.",
    theme: { primary: "#4A2F22", accent: "#C9A227", surface: "light", font: "bricolage", radius: "round" },
    heroLayout: "overlay",
    order: ["hero", "services", "about", "gallery", "benefits", "testimonials", "faq", "location", "cta"],
    images: {
      hero: [img("photo-1509440159596-0249088772ff"), img("photo-1554118811-1e0d58224f24")],
      about: [img("photo-1501339847302-ac426a4a7cbb", 1200), img("photo-1447933601403-0c6688de566e", 1200)],
      gallery: [
        img("photo-1495474472287-4d71bcdd2085", 900),
        img("photo-1486427944299-d1955d23e34d", 900),
        img("photo-1578985545062-69928b1d9587", 900),
        img("photo-1517433670267-08bbd4be890f", 900),
        img("photo-1509440159596-0249088772ff", 900),
      ],
    },
    copy: {
      heroTitles: ["Do forno para a sua mesa, em {bairro}.", "Café passado na hora e pão saindo quentinho.", "Encomende hoje, retire amanhã cedo."],
      heroSubtitles: [
        "Veja o que sai do forno {no_name} e faça sua encomenda pelo WhatsApp.",
        "Cardápio, horários e encomendas para festas. Tudo numa mensagem.",
      ],
      about: [
        "{name} fica em {bairro}, {city}. A fornada começa cedo e o cardápio muda com a estação. Encomendas para festas e cafés da manhã são combinadas pelo WhatsApp.",
        "{No_name}, o balcão é o lugar do bairro para o café da manhã e o lanche da tarde. Se quiser algo especial, é só pedir com um dia de antecedência.",
      ],
      highlights: ["Fornadas ao longo do dia", "Encomendas para festas", "Pedidos pelo WhatsApp", "Em {bairro}"],
      servicesTitle: "Do nosso balcão",
      servicesSubtitle: "Os preços e sabores do dia a gente confirma pelo WhatsApp.",
      serviceBlurbs: [
        "Feito todo dia, em pequenas fornadas.",
        "Dá pra encomendar com antecedência e retirar no horário que preferir.",
        "Pergunte pelas opções do dia. Variam conforme a estação.",
        "Para festas e reuniões, a gente monta a quantidade certa.",
      ],
      benefitsTitle: "Como encomendar",
      benefits: [
        { title: "Mande o pedido", description: "Diga o que quer, a quantidade e o dia." },
        { title: "Confirmação", description: "A gente responde com o valor e o horário de retirada." },
        { title: "Retire ou receba", description: "No balcão ou por entrega na região, quando disponível." },
      ],
      galleryTitle: "Saindo do forno",
      testimonials: [
        { name: "Paula", text: "O pão de fermentação natural é o melhor do bairro. Encomendo toda sexta." },
        { name: "Rogério", text: "Pedi os salgados do aniversário pelo WhatsApp. Chegou tudo certinho." },
        { name: "Lúcia", text: "Café bom, atendimento rápido e o bolo de laranja é imperdível." },
      ],
      faq: [
        { question: "Fazem encomendas para festas?", answer: "Sim. Mande a data e a quantidade pelo WhatsApp que a gente monta o orçamento." },
        { question: "Tem opção sem glúten ou sem lactose?", answer: "Pergunte pelo WhatsApp. As opções variam conforme o dia." },
        { question: "Vocês entregam?", answer: "Consulte a disponibilidade de entrega para o seu endereço pelo WhatsApp." },
        { question: "Quais formas de pagamento?", answer: "Pix, cartão de débito e crédito." },
      ],
      ctaTitles: ["Bateu vontade? Faça sua encomenda.", "Reserve sua fornada de amanhã."],
      ctaSubtitle: "Respondemos pelo WhatsApp no horário de funcionamento.",
    },
  },

  beleza: {
    id: "beleza",
    label: "Salão & Unhas",
    mood: "Elegante e leve: amora profunda, blush e serifa refinada.",
    theme: { primary: "#8C2F5B", accent: "#F2C6B4", surface: "light", font: "cormorant", radius: "round" },
    heroLayout: "split",
    order: ["hero", "services", "gallery", "about", "benefits", "testimonials", "faq", "location", "cta"],
    images: {
      hero: [img("photo-1562322140-8baeececf3df"), img("photo-1560066984-138dadb4c035")],
      about: [img("photo-1633681926022-84c23e8cb2d6", 1200), img("photo-1595476108010-b4d1f102b1b1", 1200)],
      gallery: [
        img("photo-1604654894610-df63bc536371", 900),
        img("photo-1522335789203-aabd1fc54bc9", 900),
        img("photo-1519699047748-de8e457a634e", 900),
        img("photo-1560066984-138dadb4c035", 900),
        img("photo-1562322140-8baeececf3df", 900),
      ],
    },
    copy: {
      heroTitles: ["Seu horário, do seu jeito.", "Cabelo, unhas e sobrancelha em {bairro}.", "Agende em uma mensagem."],
      heroSubtitles: [
        "Veja os serviços {do_name} e escolha o melhor horário pelo WhatsApp.",
        "Atendimento com hora marcada em {city}. Sem fila, sem espera.",
      ],
      about: [
        "{name} atende em {bairro}, {city}, com hora marcada. Antes de começar, a gente conversa sobre o resultado que você quer e o cuidado que o seu cabelo ou suas unhas pedem.",
        "{No_name}, cada atendimento tem tempo reservado. Você chega, é atendida no horário e sai do jeito que combinou.",
      ],
      highlights: ["Hora marcada", "Materiais esterilizados", "Agendamento pelo WhatsApp", "Em {bairro}"],
      servicesTitle: "Serviços",
      servicesSubtitle: "Valores e duração de cada serviço a gente confirma pelo WhatsApp.",
      serviceBlurbs: [
        "Feito com hora marcada e tempo certo para não correr.",
        "Tire dúvidas e mande referências antes do dia.",
        "Resultado combinado antes de começar.",
        "Dá pra juntar com outros serviços no mesmo horário.",
      ],
      benefitsTitle: "Como funciona",
      benefits: [
        { title: "Escolha o serviço", description: "Mande a foto de referência, se tiver." },
        { title: "Marque o horário", description: "Confirmação na hora pelo WhatsApp." },
        { title: "Chegue e relaxe", description: "Seu horário fica reservado só pra você." },
      ],
      galleryTitle: "Trabalhos recentes",
      testimonials: [
        { name: "Carla", text: "Fiz alongamento em gel e durou três semanas perfeito. Já marquei a manutenção." },
        { name: "Bianca", text: "Atendimento pontual. Mandei a foto do corte e saiu igualzinho." },
        { name: "Mônica", text: "Ambiente tranquilo e tudo muito limpo. Recomendo." },
      ],
      faq: [
        { question: "Precisa agendar?", answer: "Sim, trabalhamos com hora marcada. É só chamar no WhatsApp." },
        { question: "Posso mandar foto de referência?", answer: "Pode e ajuda muito. Mande junto com o pedido de horário." },
        { question: "Quanto tempo leva cada serviço?", answer: "Depende do serviço. Informamos a duração quando você agenda." },
        { question: "Quais formas de pagamento?", answer: "Pix, cartão de débito e crédito." },
      ],
      ctaTitles: ["Seu próximo horário começa aqui.", "Bora marcar?"],
      ctaSubtitle: "Agendamento pelo WhatsApp em horário comercial.",
    },
  },

  studio: {
    id: "studio",
    label: "Pilates, Yoga & Dança",
    mood: "Calmo e firme: verde-sálvia profundo, areia e muito respiro.",
    theme: { primary: "#2F5D50", accent: "#E9C46A", surface: "tint", font: "sora", radius: "round" },
    heroLayout: "stacked",
    order: ["hero", "benefits", "services", "about", "gallery", "testimonials", "faq", "location", "cta"],
    images: {
      hero: [img("photo-1518611012118-696072aa579a"), img("photo-1544367567-0f2fcb009e0b")],
      about: [img("photo-1506126613408-eca07ce68773", 1200), img("photo-1599901860904-17e6ed7083a0", 1200)],
      gallery: [
        img("photo-1575052814086-f385e2e2ad1b", 900),
        img("photo-1508700929628-666bc8bd84ea", 900),
        img("photo-1544367567-0f2fcb009e0b", 900),
        img("photo-1518611012118-696072aa579a", 900),
      ],
    },
    copy: {
      heroTitles: ["Seu corpo agradece a primeira aula.", "Aulas em turmas pequenas em {bairro}.", "Comece com uma aula experimental."],
      heroSubtitles: [
        "Conheça as modalidades {do_name}, veja os horários e agende a aula experimental pelo WhatsApp.",
        "Turmas pequenas e acompanhamento de perto em {city}.",
      ],
      about: [
        "{name} fica em {bairro}, {city}. As turmas são pequenas para o professor acompanhar cada aluno. Iniciante é bem-vindo: a primeira aula serve pra entender seu momento.",
        "{No_name}, o ritmo é o seu. A gente ajusta os exercícios ao seu corpo e ao que você quer melhorar.",
      ],
      highlights: ["Turmas pequenas", "Aula experimental", "Horários flexíveis", "Em {bairro}"],
      servicesTitle: "Modalidades",
      servicesSubtitle: "Horários e planos a gente passa pelo WhatsApp.",
      serviceBlurbs: [
        "Para quem está começando ou voltando a se mexer.",
        "Acompanhamento de perto, com ajustes em cada exercício.",
        "Planos mensais com horários fixos ou flexíveis.",
        "Aula experimental para você sentir antes de decidir.",
      ],
      benefitsTitle: "Por que começar aqui",
      benefits: [
        { title: "Atenção de verdade", description: "Turmas pequenas: o professor vê o que você está fazendo." },
        { title: "Sem pressão", description: "Cada um no seu ritmo, do iniciante ao avançado." },
        { title: "Agenda fácil", description: "Marca, remarca e tira dúvida pelo WhatsApp." },
      ],
      galleryTitle: "O espaço",
      testimonials: [
        { name: "Renata", text: "Voltei a treinar depois de uma lesão. A atenção nas aulas fez toda a diferença." },
        { name: "Fábio", text: "Nunca tinha feito pilates. Em dois meses, a dor nas costas diminuiu muito." },
        { name: "Tati", text: "Turma pequena e professora atenta. Virou o melhor horário da minha semana." },
      ],
      faq: [
        { question: "Nunca pratiquei. Posso começar?", answer: "Pode. A aula experimental serve justamente pra entender seu nível." },
        { question: "Preciso de atestado?", answer: "Para algumas condições pedimos liberação médica. Conte pelo WhatsApp." },
        { question: "Quantas pessoas por turma?", answer: "Turmas pequenas. Confirme a lotação do horário que você quer." },
        { question: "Como funcionam os planos?", answer: "Temos planos mensais. Mandamos os valores pelo WhatsApp." },
      ],
      ctaTitles: ["Agende sua aula experimental.", "O primeiro passo é uma mensagem."],
      ctaSubtitle: "Respondemos rápido pelo WhatsApp.",
    },
  },

  educacao: {
    id: "educacao",
    label: "Escola & Cursos",
    mood: "Confiável e animado: azul escola, amarelo e cantos amigáveis.",
    theme: { primary: "#1F4E9A", accent: "#F4B400", surface: "light", font: "nunito", radius: "round" },
    heroLayout: "split",
    order: ["hero", "services", "benefits", "about", "gallery", "testimonials", "faq", "location", "cta"],
    images: {
      hero: [img("photo-1503676260728-1c00da094a0b"), img("photo-1522202176988-66273c2fd55f")],
      about: [img("photo-1427504494785-3a9ca7044f45", 1200), img("photo-1497633762265-9d179a990aa6", 1200)],
      gallery: [
        img("photo-1509062522246-3755977927d7", 900),
        img("photo-1546410531-bb4caa6b424d", 900),
        img("photo-1522202176988-66273c2fd55f", 900),
        img("photo-1497633762265-9d179a990aa6", 900),
      ],
    },
    copy: {
      heroTitles: ["Matrículas abertas em {bairro}.", "Aprender com gente que acompanha de perto.", "Venha conhecer antes de decidir."],
      heroSubtitles: [
        "Conheça os cursos {do_name}, veja horários e agende uma visita ou aula experimental.",
        "Turmas por nível, material incluso e acompanhamento. Tire dúvidas pelo WhatsApp.",
      ],
      about: [
        "{name} fica em {bairro}, {city}. As turmas são organizadas por nível e idade, e cada aluno tem acompanhamento do começo ao fim.",
        "{No_name}, a família sabe como o aluno está indo. A comunicação é direta, pelo WhatsApp, sem esperar a reunião do bimestre.",
      ],
      highlights: ["Turmas por nível", "Acompanhamento próximo", "Visita sem compromisso", "Em {bairro}"],
      servicesTitle: "Cursos e turmas",
      servicesSubtitle: "Horários, vagas e valores a gente confirma pelo WhatsApp.",
      serviceBlurbs: [
        "Turmas por nível, com avaliação antes da matrícula.",
        "Aulas presenciais e, quando disponível, online.",
        "Acompanhamento com retorno frequente para a família.",
        "Vagas limitadas por turma.",
      ],
      benefitsTitle: "Como funciona a matrícula",
      benefits: [
        { title: "1. Visite ou teste", description: "Agende uma visita ou uma aula experimental." },
        { title: "2. Avaliação", description: "Entendemos o nível e indicamos a turma certa." },
        { title: "3. Matrícula", description: "Tudo resolvido pelo WhatsApp, sem burocracia." },
      ],
      galleryTitle: "Nosso espaço",
      testimonials: [
        { name: "Cláudia (mãe)", text: "Meu filho perdeu a vergonha de falar inglês. As professoras mandam retorno toda semana." },
        { name: "Diego", text: "Passei na prova com a turma preparatória. Material bom e aula objetiva." },
        { name: "Sônia", text: "A visita tirou todas as dúvidas. Matriculei no mesmo dia." },
      ],
      faq: [
        { question: "Tem aula experimental?", answer: "Sim. Agende pelo WhatsApp e venha conhecer." },
        { question: "Como sei a turma certa?", answer: "Fazemos uma avaliação rápida antes da matrícula." },
        { question: "O material está incluso?", answer: "Confirme pelo WhatsApp: depende do curso." },
        { question: "Quais formas de pagamento?", answer: "Pix, boleto ou cartão. Informamos as condições na matrícula." },
      ],
      ctaTitles: ["Garanta sua vaga.", "Vamos conversar sobre a matrícula?"],
      ctaSubtitle: "Atendimento pelo WhatsApp em horário comercial.",
    },
  },

  construcao: {
    id: "construcao",
    label: "Construção & Planejados",
    mood: "Sólido e direto: grafite, laranja de obra e títulos condensados.",
    theme: { primary: "#1E2A32", accent: "#F28C28", surface: "light", font: "anton", radius: "none" },
    heroLayout: "overlay",
    order: ["hero", "services", "gallery", "benefits", "about", "testimonials", "faq", "location", "cta"],
    images: {
      hero: [img("photo-1541888946425-d81bb19240f5"), img("photo-1600585154340-be6161a56a0c")],
      about: [img("photo-1504307651254-35680f356dfd", 1200), img("photo-1503387762-592deb58ef4e", 1200)],
      gallery: [
        img("photo-1556911220-bff31c812dba", 900),
        img("photo-1600607687939-ce8a6c25118c", 900),
        img("photo-1581858726788-75bc0f6a952d", 900),
        img("photo-1600585154340-be6161a56a0c", 900),
        img("photo-1503387762-592deb58ef4e", 900),
      ],
    },
    copy: {
      heroTitles: ["Obra com prazo e orçamento por escrito.", "Do projeto à entrega em {city}.", "Peça seu orçamento hoje."],
      heroSubtitles: [
        "Conheça os serviços {do_name}, veja trabalhos e peça um orçamento pelo WhatsApp.",
        "Visita técnica, orçamento detalhado e acompanhamento da obra do início ao fim.",
      ],
      about: [
        "{name} atende {city} e região. Antes de começar, você recebe o orçamento detalhado e o cronograma. Durante a obra, fotos e atualizações pelo WhatsApp.",
        "{No_name}, cada projeto começa com uma visita técnica. É ali que a gente mede, entende o que você quer e diz o que é possível.",
      ],
      highlights: ["Orçamento por escrito", "Visita técnica", "Cronograma combinado", "Atende {city}"],
      servicesTitle: "Serviços",
      servicesSubtitle: "Mande fotos ou medidas pelo WhatsApp para agilizar o orçamento.",
      serviceBlurbs: [
        "Orçamento detalhado depois da visita técnica.",
        "Materiais combinados antes, sem troca surpresa.",
        "Acompanhamento com fotos durante a execução.",
        "Garantia do serviço conforme o contrato.",
      ],
      benefitsTitle: "Como trabalhamos",
      benefits: [
        { title: "Visita e medição", description: "Entendemos o espaço e o que você quer." },
        { title: "Orçamento e prazo", description: "Tudo por escrito antes de começar." },
        { title: "Obra acompanhada", description: "Atualizações pelo WhatsApp até a entrega." },
      ],
      galleryTitle: "Trabalhos",
      testimonials: [
        { name: "Marcos", text: "Reformaram a cozinha no prazo combinado. Me mandavam foto todo dia." },
        { name: "Aline", text: "O orçamento veio detalhado e não teve cobrança extra no final." },
        { name: "Jorge", text: "Móveis planejados sob medida, acabamento muito bom." },
      ],
      faq: [
        { question: "A visita para orçamento é cobrada?", answer: "Confirme pelo WhatsApp as condições para o seu bairro." },
        { question: "Quanto tempo leva uma obra?", answer: "Depende do escopo. O cronograma vem junto com o orçamento." },
        { question: "Vocês fornecem o material?", answer: "Pode ser com ou sem material. A gente combina no orçamento." },
        { question: "Como é o pagamento?", answer: "Por etapas, conforme o contrato. Pix, boleto ou cartão." },
      ],
      ctaTitles: ["Tem um projeto? Vamos orçar.", "Mande as fotos e receba o orçamento."],
      ctaSubtitle: "Respondemos pelo WhatsApp em horário comercial.",
    },
  },

  "servicos-casa": {
    id: "servicos-casa",
    label: "Serviços para casa",
    mood: "Confiança imediata: azul forte, amarelo de atenção e botões grandes.",
    theme: { primary: "#0B5CAD", accent: "#FFC23D", surface: "light", font: "manrope", radius: "soft" },
    heroLayout: "split",
    order: ["hero", "services", "benefits", "about", "testimonials", "faq", "location", "cta"],
    images: {
      hero: [img("photo-1621905251189-08b45d6a269e"), img("photo-1581092160562-40aa08e78837")],
      about: [img("photo-1585704032915-c3400ca199e7", 1200), img("photo-1581578731548-c64695cc6952", 1200)],
      gallery: [
        img("photo-1581578731548-c64695cc6952", 900),
        img("photo-1558618666-fcd25c85cd64", 900),
        img("photo-1621905251189-08b45d6a269e", 900),
        img("photo-1581092160562-40aa08e78837", 900),
      ],
    },
    copy: {
      heroTitles: ["Resolvido hoje, com orçamento antes.", "Atendimento em {city} e região.", "Chamou, a gente responde."],
      heroSubtitles: [
        "Mande uma foto do problema pelo WhatsApp e receba o orçamento {do_name} sem compromisso.",
        "Atendimento residencial e comercial em {city}. Horário marcado e serviço garantido.",
      ],
      about: [
        "{name} atende {city} e região. Você manda a foto ou descreve o problema, recebe o orçamento e marca o melhor horário. Sem surpresa no valor.",
        "{No_name}, o combinado é simples: preço antes, horário respeitado e local limpo depois do serviço.",
      ],
      highlights: ["Orçamento antes", "Horário marcado", "Atendimento residencial e comercial", "{city} e região"],
      servicesTitle: "O que a gente resolve",
      servicesSubtitle: "Não achou o seu caso? Mande mensagem que a gente diz se atende.",
      serviceBlurbs: [
        "Orçamento pelo WhatsApp com foto ou vídeo.",
        "Atendimento com hora marcada.",
        "Material de qualidade, combinado antes.",
        "Garantia do serviço realizado.",
      ],
      benefitsTitle: "Por que chamar a gente",
      benefits: [
        { title: "Preço antes do serviço", description: "Você aprova o orçamento antes de começar." },
        { title: "Pontualidade", description: "Horário marcado e aviso se houver imprevisto." },
        { title: "Garantia", description: "Deu problema no que fizemos? A gente volta." },
      ],
      galleryTitle: "Serviços realizados",
      testimonials: [
        { name: "Sandra", text: "Mandei foto do vazamento de manhã e à tarde já estava resolvido." },
        { name: "Paulo", text: "Orçamento honesto e deixou tudo limpo depois." },
        { name: "Cíntia", text: "Atendimento rápido e educado. Já salvei o contato." },
      ],
      faq: [
        { question: "Atendem no meu bairro?", answer: "Atendemos {city} e região. Mande seu bairro pelo WhatsApp." },
        { question: "Cobram visita?", answer: "Muitas vezes dá pra orçar por foto. Se precisar de visita, avisamos antes." },
        { question: "Atendem emergências?", answer: "Chame no WhatsApp e informe a urgência. Fazemos o possível para encaixar." },
        { question: "Quais formas de pagamento?", answer: "Pix, cartão de débito e crédito." },
      ],
      ctaTitles: ["Mande uma foto e receba o orçamento.", "Precisa de ajuda agora?"],
      ctaSubtitle: "Atendimento pelo WhatsApp.",
    },
  },

  eventos: {
    id: "eventos",
    label: "Festas & Eventos",
    mood: "Noite de festa: fundo escuro, vinho e dourado, serifa elegante.",
    theme: { primary: "#7A1F3D", accent: "#D4AF37", surface: "dark", font: "playfair", radius: "soft" },
    heroLayout: "overlay",
    order: ["hero", "gallery", "services", "about", "benefits", "testimonials", "faq", "location", "cta"],
    images: {
      hero: [img("photo-1519741497674-611481863552"), img("photo-1478146896981-b80fe463b330")],
      about: [img("photo-1511795409834-ef04bbd61622", 1200), img("photo-1464366400600-7168b8af9bc3", 1200)],
      gallery: [
        img("photo-1530103862676-de8c9debad1d", 900),
        img("photo-1511795409834-ef04bbd61622", 900),
        img("photo-1490750967868-88aa4486c946", 900),
        img("photo-1464366400600-7168b8af9bc3", 900),
        img("photo-1478146896981-b80fe463b330", 900),
        img("photo-1519741497674-611481863552", 900),
      ],
    },
    copy: {
      heroTitles: ["A sua festa, do jeito que você imaginou.", "Eventos em {city} com tudo resolvido.", "Datas abertas. Vamos conversar?"],
      heroSubtitles: [
        "Veja trabalhos {do_name} e peça um orçamento com a data do seu evento.",
        "Aniversários, casamentos e eventos corporativos. Orçamento sem compromisso pelo WhatsApp.",
      ],
      about: [
        "{name} cuida de eventos em {city} e região. A gente começa entendendo o estilo que você quer, o número de convidados e o orçamento, e monta a proposta a partir disso.",
        "{No_name}, cada evento é único. Você aprova cada detalhe antes e no dia só aproveita.",
      ],
      highlights: ["Proposta personalizada", "Datas sob consulta", "Atende {city} e região", "Orçamento pelo WhatsApp"],
      servicesTitle: "O que fazemos",
      servicesSubtitle: "Pacotes montados conforme a data, o tamanho e o estilo do evento.",
      serviceBlurbs: [
        "Proposta montada a partir do seu estilo e orçamento.",
        "Tudo aprovado por você antes do dia.",
        "Equipe presente no evento, se contratado.",
        "Datas concorridas: vale reservar cedo.",
      ],
      benefitsTitle: "Como funciona",
      benefits: [
        { title: "Conte sobre o evento", description: "Data, número de convidados e referências." },
        { title: "Receba a proposta", description: "Com opções e valores por escrito." },
        { title: "Reserve a data", description: "Contrato simples e tudo acompanhado pelo WhatsApp." },
      ],
      galleryTitle: "Eventos que fizemos",
      testimonials: [
        { name: "Juliana e Pedro", text: "Nosso casamento ficou exatamente como sonhamos. Zero estresse no dia." },
        { name: "Renata", text: "A festa da minha filha foi linda. Os convidados perguntaram quem fez." },
        { name: "Carlos", text: "Evento da empresa organizado em duas semanas. Tudo no horário." },
      ],
      faq: [
        { question: "Com quanta antecedência reservar?", answer: "Quanto antes melhor, principalmente sextas e sábados. Consulte a data." },
        { question: "Vocês têm pacotes?", answer: "Temos, e também montamos sob medida. Peça a proposta." },
        { question: "Atendem fora da cidade?", answer: "Consulte pelo WhatsApp. Pode haver taxa de deslocamento." },
        { question: "Como é o pagamento?", answer: "Sinal para reservar a data e o restante até o evento." },
      ],
      ctaTitles: ["Qual é a data do seu evento?", "Vamos montar sua proposta."],
      ctaSubtitle: "Orçamento sem compromisso pelo WhatsApp.",
    },
  },

  moda: {
    id: "moda",
    label: "Moda & Varejo",
    mood: "Editorial: tinta, caramelo e serifa de revista, cantos retos.",
    theme: { primary: "#151515", accent: "#C8A27A", surface: "light", font: "playfair", radius: "none" },
    heroLayout: "stacked",
    order: ["hero", "gallery", "services", "about", "benefits", "testimonials", "faq", "location", "cta"],
    images: {
      hero: [img("photo-1441986300917-64674bd600d8"), img("photo-1567401893414-76b7b1e5a7a5")],
      about: [img("photo-1445205170230-053b83016050", 1200), img("photo-1483985988355-763728e1935b", 1200)],
      gallery: [
        img("photo-1445205170230-053b83016050", 900),
        img("photo-1515562141207-7a88fb7ce338", 900),
        img("photo-1574258495973-f010dfbb5371", 900),
        img("photo-1483985988355-763728e1935b", 900),
        img("photo-1567401893414-76b7b1e5a7a5", 900),
      ],
    },
    copy: {
      heroTitles: ["Chegou novidade.", "A loja de {bairro}, agora na palma da mão.", "Veja antes, prove depois."],
      heroSubtitles: [
        "Confira as novidades {do_name}, tire dúvidas de tamanho e reserve pelo WhatsApp.",
        "Atendimento personalizado em {city}. Reserve a peça e retire na loja.",
      ],
      about: [
        "{name} fica em {bairro}, {city}. A seleção muda com frequência e o atendimento é de perto: a gente ajuda a achar o tamanho e o modelo certo.",
        "{No_name}, você pode ver as novidades aqui, reservar pelo WhatsApp e retirar na loja sem pressa.",
      ],
      highlights: ["Novidades frequentes", "Reserva pelo WhatsApp", "Ajuda com tamanho", "Em {bairro}"],
      servicesTitle: "Na loja",
      servicesSubtitle: "Estoque e tamanhos mudam rápido. Confirme pelo WhatsApp.",
      serviceBlurbs: [
        "Reserve pelo WhatsApp e retire na loja.",
        "Dúvida de tamanho? A gente mede e manda foto.",
        "Condições de pagamento combinadas na hora.",
        "Troca conforme a política da loja.",
      ],
      benefitsTitle: "Comprar é simples",
      benefits: [
        { title: "Viu, gostou", description: "Mande o print da peça pelo WhatsApp." },
        { title: "Confirmamos", description: "Tamanho, cor e disponibilidade na hora." },
        { title: "Retire ou receba", description: "Na loja ou por entrega, quando disponível." },
      ],
      galleryTitle: "Novidades",
      testimonials: [
        { name: "Letícia", text: "Mandei print do vestido e já separaram meu tamanho. Atendimento ótimo." },
        { name: "Viviane", text: "Sempre tem coisa nova. Virou minha loja preferida do bairro." },
        { name: "Rafaela", text: "Troquei o tamanho sem nenhuma dificuldade." },
      ],
      faq: [
        { question: "Posso reservar uma peça?", answer: "Pode. Mande a foto pelo WhatsApp e confirmamos a reserva." },
        { question: "Vocês entregam?", answer: "Consulte a entrega para o seu endereço pelo WhatsApp." },
        { question: "Como funciona a troca?", answer: "Seguimos a política da loja. Pergunte as condições na compra." },
        { question: "Quais formas de pagamento?", answer: "Pix, débito e crédito. Parcelamento a combinar." },
      ],
      ctaTitles: ["Viu algo que gostou?", "Fale com a gente e reserve."],
      ctaSubtitle: "Atendimento pelo WhatsApp no horário da loja.",
    },
  },

  saude: {
    id: "saude",
    label: "Saúde & Terapias",
    mood: "Acolhedor: verde-azulado, pêssego e letras arredondadas.",
    theme: { primary: "#2E7D7A", accent: "#F3A683", surface: "tint", font: "nunito", radius: "round" },
    heroLayout: "split",
    order: ["hero", "services", "about", "benefits", "testimonials", "faq", "location", "cta"],
    images: {
      hero: [img("photo-1544161515-4ab6ce6db874"), img("photo-1573497019940-1c28c88b4f3e")],
      about: [img("photo-1505751172876-fa1923c5c528", 1200), img("photo-1498837167922-ddd27525d352", 1200)],
      gallery: [
        img("photo-1600334089648-b0d9d3028eb2", 900),
        img("photo-1512290923902-8a9f81dc236c", 900),
        img("photo-1544161515-4ab6ce6db874", 900),
        img("photo-1498837167922-ddd27525d352", 900),
      ],
    },
    copy: {
      heroTitles: ["Cuidado que começa por ouvir você.", "Atendimento em {bairro}, com hora marcada.", "Agende sua primeira sessão."],
      heroSubtitles: [
        "Conheça os atendimentos {do_name} e marque sua avaliação pelo WhatsApp.",
        "Presencial em {city} e, quando possível, online. Tire dúvidas antes de agendar.",
      ],
      about: [
        "{name} atende em {bairro}, {city}. A primeira sessão é para entender sua história e o que você busca. A partir daí, o plano é construído junto com você.",
        "{No_name}, cada atendimento tem tempo e atenção. Sem pressa e sem fórmula pronta.",
      ],
      highlights: ["Primeira avaliação", "Hora marcada", "Online quando possível", "Em {bairro}"],
      servicesTitle: "Atendimentos",
      servicesSubtitle: "Valores e disponibilidade de horário a gente passa pelo WhatsApp.",
      serviceBlurbs: [
        "Começa com uma avaliação para entender o seu caso.",
        "Plano de acompanhamento combinado com você.",
        "Sessões com hora marcada e tempo reservado.",
        "Dúvidas entre as sessões? Fale pelo WhatsApp.",
      ],
      benefitsTitle: "Como funciona",
      benefits: [
        { title: "Primeiro contato", description: "Conte rapidamente o que você procura." },
        { title: "Avaliação", description: "Entendemos seu momento e indicamos o caminho." },
        { title: "Acompanhamento", description: "Sessões no ritmo que faz sentido pra você." },
      ],
      galleryTitle: "O espaço",
      testimonials: [
        { name: "Mariana", text: "Me senti ouvida desde a primeira sessão. Recomendo de olhos fechados." },
        { name: "Eduardo", text: "O acompanhamento fez diferença na minha rotina. Atendimento muito humano." },
        { name: "Priscila", text: "Consegui encaixar as sessões online na semana corrida." },
      ],
      faq: [
        { question: "Atende online?", answer: "Quando o tipo de atendimento permite, sim. Pergunte pelo WhatsApp." },
        { question: "Aceita convênio?", answer: "Confirme pelo WhatsApp. Emitimos recibo para reembolso quando aplicável." },
        { question: "Quanto dura cada sessão?", answer: "Depende do atendimento. Informamos na hora de agendar." },
        { question: "Como faço para agendar?", answer: "Pelo WhatsApp. Você escolhe o horário e recebe a confirmação." },
      ],
      ctaTitles: ["Vamos marcar sua primeira sessão?", "Dê o primeiro passo hoje."],
      ctaSubtitle: "Respondemos pelo WhatsApp com carinho e discrição.",
    },
  },
} satisfies Record<string, TemplateDefinition>;
