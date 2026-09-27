# LeadScan

Central de prospecção para quem vende sites: **encontra empresas → mostra quais têm mais chance de comprar → monta um protótipo do site → prepara a mensagem → abre o WhatsApp → recebe pelo Pix ou cartão.** E uma comunidade com ranking semanal, níveis e perfis.

> Nome provisório. Troque em `components/app-shell/logo.tsx` e `app/layout.tsx`.

---

## Rodando em 3 comandos

Requisitos: Node 20+ (testado no 24). Não precisa instalar PostgreSQL nem Docker.

```bash
npm install
npm run setup     # sobe o Postgres local (Prisma Dev), cria as tabelas e popula a demonstração
npm run dev       # http://localhost:3000
```

A página inicial é pública. Em **Entrar** dá pra criar conta com e-mail ou celular (em desenvolvimento, sem provedor de envio configurado, o código aparece na própria tela) ou clicar em **Explorar a demonstração**: 100 empresas fictícias, 18 membros de comunidade com vendas nas últimas semanas, cobranças e protótipos. Tudo que é fictício aparece com o selo **DEMO**.

Depois de reiniciar o computador, suba o banco de novo com `npm run db:start`.

> O Postgres embutido do `prisma dev` atende **uma conexão por vez**. O app já usa uma só em dev; não rode `db:seed`, `db:studio` ou scripts com o `npm run dev` ligado (conexões simultâneas derrubam o banco local — se acontecer: `npm run db:stop && npm run db:start`). Em produção use um Postgres normal.

| Script | O que faz |
|---|---|
| `npm run dev` | servidor de desenvolvimento |
| `npm run build` / `start` | build e servidor de produção |
| `npm test` | testes (score, WhatsApp, parser, abordagens, templates, níveis, pontos, semana, webhooks, criptografia) |
| `npm run typecheck` / `lint` | TypeScript e ESLint |
| `npm run db:start` / `db:stop` | liga/desliga o Postgres local |
| `npm run db:push` | aplica o `schema.prisma` no banco |
| `npm run db:seed` | popula a demonstração e a comunidade (idempotente) |
| `node scripts/update-municipios.mjs` | atualiza a lista de municípios do IBGE |

---

## O que tem

**Prospecção** — busca em linguagem natural (“dentistas em Quixadá sem site”) em **5.571 municípios** (lista oficial do IBGE, a UF é descoberta sozinha) e **85 tipos de negócio**; sem cidade escolhida a busca é **geral** (o estado inteiro ou o Brasil, cidade por cidade); uma empresa que você já tem **não volta** em buscas novas; score 0–100 com motivos; filtros; pipeline; CRM; abordagens em 3 versões; WhatsApp.

**Varredura** — cada busca continua de onde a anterior parou: "50 padarias em Fortaleza" duas vezes traz 100 padarias diferentes, e assim até acabar ("varredura completa"; a cidade volta a ser consultada depois de 30 dias). No Google Maps a cidade vira uma grade de quadrantes, então passa do limite de 60 resultados por consulta. A busca geral anda pelo estado ou pelo Brasil inteiro em rodízio, pulando as cidades já esgotadas. Botão **Próximas N** na tela de resultados.

**Mensagens** (`/mensagens`) — conversa privada entre usuários com texto, foto, vídeo (até 16 MB) e áudio gravado no próprio app (até 5 min), ao vivo; “digitando…”, “Visto”, editar (a bolha mostra “editada”; seta ↑ no campo vazio edita a última), apagar para todos, bloquear. Status **online / inativo há X min / offline**, que cada pessoa pode ocultar em Perfil → Privacidade. Botão “Mensagem” no perfil público de cada um. Quem não é amigo cai em **Pedidos**: aceitar, recusar ou bloquear (e dá para receber só de amigos).

**Amigos** (`/amigos`) — convite, aceitar/recusar (a recusa não é anunciada), desfazer amizade, bloquear e desbloquear; busca de pessoas por nome ou @.

**Arquivos** (`/arquivos`) — fotos (até 6 MB, com moderação), vídeos (até 40 MB) e áudios (até 20 MB), enviados em partes; 300 MB por conta. Fotos aparecem como sugestão no estúdio dos protótipos; vídeos e áudios só o dono abre.

**Selos** — cada nível (1 a 10) e cada título de campeão tem uma insígnia própria, que aparece no canto da foto em todo o app (ranking, mensagens, perfil).

**Protótipos** — **22 modelos** por segmento, **8 estilos prontos** (Clássico, Moderno, Minimalista, Aconchegante, Editorial, Vibrante, Ousado, Noturno) e **4 paletas por segmento**. Clientes do mesmo segmento já nascem com paletas diferentes. Fotos reais do negócio entram automaticamente quando a fonte é o Google (com crédito aos autores); dá pra enviar fotos do cliente no editor ou gerar capa com IA. A biblioteca abre cada template inteiro, em desktop, tablet ou celular (`/prototypes/templates/[id]`).

**Contas** — Google, e-mail ou celular (código de 6 dígitos, sem senha). Cadastro pede nome, @ e aceite dos termos; ranking é opt-in.

**Perfil** (`/perfil`, público em `/u/@usuario`) — foto (com moderação +18), nome, bio, Instagram, título escolhido, tempo de conta (pode esconder), perfil aberto/fechado, gráficos semanais de leads fechados/recusados, abordagens, buscas e protótipos.

**Financeiro** (`/financeiro`) — contas bancárias e chaves Pix (criptografadas), **Pix direto** (link de pagamento com QR code e copia e cola que cai na conta do usuário, sem taxa; quem cobra marca como recebido), contas de recebimento (Mercado Pago, Stripe, teste), links de cobrança com Pix/crédito/débito, vendas registradas por fora, **extrato** (entradas, tarifas e estornos), gráfico por dia/mês, ticket médio. **Atualiza ao vivo** quando o cliente paga.

**Comunidade** (`/comunidade`) — ranking **ao vivo** da semana (segunda 00:00 → domingo 23:59, horário de Brasília), do mês e geral (top 100); campeões de cada semana; top 3 do mês; faturamento da plataforma e por conta (só de quem consentiu).

**Integrações de IA** (`/integracoes`) — cada usuário conecta a **própria chave**: Claude, ChatGPT (+ GPT Image), Gemini (+ **Nano Banana**), OpenRouter, Groq, DeepSeek, Mistral, Grok, Perplexity, Ollama (instalação própria). No estúdio: reescrever o site inteiro, gerar imagem de capa, e **levar o briefing** para Lovable, Bolt, v0, Claude.ai, ChatGPT, Gemini, Google AI Studio, Google Flow (vídeo), Cursor ou baixar para o **Claude Code**.

---

## Níveis (só vendas pagas pela plataforma, a partir de R$ 100)

| Nível | Nome | Requisito |
|---|---|---|
| 1 | Primeira Venda | 1 venda |
| 2 | Em Ritmo | 5 vendas |
| 3 | Profissional | 15 vendas e R$ 15 mil |
| 4 | Especialista | 40 vendas e R$ 50 mil |
| 5 | Referência | 80 vendas e R$ 120 mil |
| 6 | Estúdio | 150 vendas e R$ 250 mil |
| 7 | Agência | 300 vendas e R$ 550 mil |
| 8 | Autoridade | 600 vendas e R$ 1,2 milhão |
| 9 | Elite | 1.200 vendas, R$ 2,5 milhões e vendas em 10 meses diferentes |
| 10 | Lenda | 2.500 vendas, R$ 6 milhões e vendas em 24 meses diferentes |

**Pontos do ranking:** 100 por venda + 1 a cada R$ 10 (a parte do valor vale no máximo 1.000 pts por venda). Desempate: faturamento, depois quem chegou primeiro. Vendas registradas à mão entram no financeiro, mas não no ranking nem nos níveis — senão qualquer um digitaria. Títulos extras: Campeão da semana, Campeão do mês, Pódio do mês. Tudo em `lib/gamification/`.

---

## Arquitetura

```
Motor de Leads            Motor de Oportunidade        Motor de Venda                    Comunidade
DataProvider (mock/osm/   scoreLead(): 0–100 +         templates + estilos + fotos       Charge → webhook → Sale
google) → IBGE → cache    motivos, 100% código         → SiteSpec → estúdio → proposta   → pontos/nível → SSE ao vivo
→ supressão LGPD → fila                                abordagens → WhatsApp → cobrança
```

| Pasta | Conteúdo |
|---|---|
| `app/(app)/*` | páginas autenticadas (dashboard, search, leads, pipeline, prototypes, outreach, **financeiro, comunidade, perfil, u/[username], integracoes**, settings) |
| `app/page.tsx`, `login`, `onboarding`, `termos`, `privacidade` | páginas públicas e cadastro |
| `app/proposta/[slug]`, `app/pagar/[slug]` | páginas que o cliente final vê (proposta e pagamento) |
| `app/api/webhooks/*` | Mercado Pago e Stripe (assinatura verificada, idempotentes) |
| `app/api/live` | Server-Sent Events (tempo real) |
| `lib/auth` | sessão assinada com versão, códigos OTP, Google OAuth (PKCE), contas |
| `lib/payments` | provedores (Mercado Pago, Stripe, teste), Pix direto (`pix.ts`, BR Code do Banco Central) + `applyPaymentUpdate` idempotente |
| `lib/finance` | resumo, série, extrato e contas bancárias (`banks.ts`, criptografadas) |
| `lib/social` | amizades, convites e bloqueio |
| `lib/gamification`, `lib/ranking` | níveis, pontos, títulos, ranking e pódios (SQL direto das vendas) |
| `lib/ai` | catálogo de IAs, conexões do usuário (criptografadas), imagens, tarefas com cache |
| `lib/media` | upload (sharp: redimensiona, WebP, remove EXIF) + moderação, envio em partes, entrega com Range, Arquivos |
| `lib/providers` | fontes de empresas (Google Maps em grade, OpenStreetMap, demonstração) + cache |
| `lib/templates` | 22 templates, estilos, paletas, briefing para outras IAs |
| `lib/domain` | 85 categorias, municípios do IBGE, parser de busca |
| `lib/realtime.ts` | eventos em memória + LISTEN/NOTIFY do Postgres entre instâncias |

### Economia de tokens

Busca, filtros, score, templates, estilos, paletas, links, ranking e a primeira versão das mensagens são **código**. IA só quando o usuário pede, com contexto mínimo (sem telefone, endereço ou notas), saída JSON validada e cache (`AICache`): o mesmo pedido nunca é pago duas vezes. Com chave própria, o custo é do usuário, direto no provedor.

---

## Conectando serviços reais

Tudo em `.env` (modelo comentado em `.env.example`). Nenhuma chave vai para o navegador. **Configurações → Plataforma** mostra o que está ativo.

- **Google Maps / Places (recomendado em produção)** — só `MAPS_API_KEY`: com a chave, vira a fonte padrão sozinho (a menos que `DATA_PROVIDER` diga outra). Busca mais rápida e completa: a cidade é varrida em quadrantes e cada busca continua da anterior (uma leva de 50 costuma custar de 3 a 10 requisições; o contorno da cidade fica guardado 180 dias e cada quadrante 24 h, também entre usuários). Ative a **Places API (New)** no Google Cloud. O OpenStreetMap é grátis mas os servidores públicos oscilam muito (504/tempo esgotado em horário de pico). Custo: cada página de até 20 empresas é uma requisição do SKU Text Search Enterprise (1.000 grátis por mês; depois cerca de US$ 35 por mil). Coloque uma cota diária no Google Cloud para não ter surpresa. Traz nota, avaliações, site, telefone e até 6 fotos por negócio. As fotos passam por um proxy assinado (`/api/places-photo`), então a chave não vaza e ninguém usa o proxy para gastar a sua cota. Revise os [Termos do Google Maps Platform](https://cloud.google.com/maps-platform/terms) antes de produção (armazenamento de conteúdo e atribuição das fotos).
- **OpenStreetMap** — já funciona, grátis, sem avaliações.
- **Login Google** — `AUTH_GOOGLE_ID/SECRET` (redirect: `/api/auth/google/callback`). **E-mail**: `RESEND_API_KEY`. **SMS**: Twilio.
- **Moderação de fotos** — `MODERATION_PROVIDER="openai"` + `MODERATION_API_KEY` (endpoint de moderação da OpenAI, gratuito) ou Sightengine. Em `AUTH_MODE=public` sem moderação, o envio de fotos fica bloqueado.
- **Mercado Pago** — `MP_CLIENT_ID/SECRET/WEBHOOK_SECRET`. Cada usuário conecta a própria conta por OAuth; Checkout Pro com Pix, crédito (até 12x) e débito; comissão opcional via `PLATFORM_FEE_PERCENT`.
- **Stripe** — `STRIPE_SECRET_KEY/WEBHOOK_SECRET`. Contas Express + destination charges. Pix com `STRIPE_PIX=true`.
- **IA da plataforma** (reserva) — `AI_PROVIDER` + `AI_API_KEY`.

---

## Segurança e LGPD

- Toda consulta filtra por `userId`; autorização no servidor em cada página, action e rota (o `proxy.ts` é só a checagem otimista).
- Sessão HMAC com versão (sair de todos os aparelhos invalida tudo). Códigos de login: só o hash é salvo, 10 min, 5 tentativas, limite por destino e por IP. Google com `state` + PKCE.
- Chaves de IA e tokens de pagamento criptografados (AES-256-GCM). Nunca voltam ao navegador.
- Pagamento: checkout hospedado pelo provedor (a plataforma não vê cartão). Webhooks com assinatura verificada, idempotência por evento e confirmação condicional (uma venda por cobrança, mesmo com webhook repetido).
- Uploads: validação pelo conteúdo, WebP, EXIF removido, moderação antes de salvar.
- Canal ao vivo: o servidor decide o tópico privado do usuário; eventos da comunidade não carregam valores de ninguém.
- Faturamento individual só aparece com consentimento (opt-in revogável). Totais da plataforma são agregados.
- Exportar dados, excluir conta, pedidos de remoção de empresas (supressão vale para a plataforma toda).

---

## Produção

1. PostgreSQL gerenciado → `DATABASE_URL`. Rode `npm run db:deploy` (= `prisma migrate deploy`, migrações em `prisma/migrations`).
2. `AUTH_SECRET` (32+), `ENCRYPTION_KEY` (32 bytes base64, **nunca troque depois**), `NEXT_PUBLIC_APP_URL`. Em produção o padrão já é `AUTH_MODE="public"` (cadastro aberto, sem demonstração); só defina `AUTH_MODE="demo"` se quiser a vitrine de testes.
3. **Pelo menos um login** para o público criar conta: Google (`AUTH_GOOGLE_ID/SECRET`), e-mail (`RESEND_API_KEY`) ou SMS (Twilio). O login mostra só o que estiver configurado. Depois: moderação e pelo menos um provedor de pagamento.
4. Várias instâncias: rate limit em memória (por instância) → para limite global troque por Redis/Upstash (`lib/rate-limit.ts`). A fila de buscas já reserva cada busca no banco e retoma sozinha; tempo real usa LISTEN/NOTIFY.
5. Mídia (fotos, áudios e vídeos do chat) fica no Postgres para funcionar em qualquer hospedagem; vídeo sobe em partes de 3,5 MB e é servido em fatias. Com volume alto de vídeo, mova `lib/media/store.ts` para um storage de objetos (S3/R2) mantendo as rotas `/api/media` e `/api/chat/media`.
6. Revise com um advogado os textos de `/termos` e `/privacidade` (modelos escritos para o funcionamento real do app) e preencha `CONTACT_EMAIL`.

### Subindo na Vercel (GitHub → Vercel)

1. Suba o repositório no GitHub (o `.gitignore` já deixa `.env`, `node_modules`, `.next` e o client gerado do Prisma de fora).
2. Na Vercel: **Add New → Project** → importe o repositório. Framework: Next.js (detectado). Não mude o comando de build: o `package.json` tem `vercel-build`, que roda `prisma generate`, **aplica as migrações** (`prisma migrate deploy`) e faz o `next build`.
3. Banco: em **Storage → Neon (Postgres)** crie o banco e conecte ao projeto. A integração cria `DATABASE_URL` (com pooler, usada pelo app) e `DATABASE_URL_UNPOOLED` (direta, usada pelas migrações e pelo tempo real). Com Supabase, o equivalente é `POSTGRES_URL_NON_POOLING`; em outro provedor, defina `DIRECT_URL` e `REALTIME_DATABASE_URL` com a conexão direta.
4. **Settings → Environment Variables**: copie do `.env.example` o que for usar. Mínimo para abrir: `AUTH_SECRET`, `ENCRYPTION_KEY`, `NEXT_PUBLIC_APP_URL` (ex.: `https://seu-projeto.vercel.app`) e ao menos um login (Google, `RESEND_API_KEY` ou Twilio). Sem `AUTH_MODE`, a produção já abre em modo público; `AUTH_MODE="demo"` liga a conta de demonstração.
5. Deploy. Em modo demo, o botão "Explorar a demonstração" cria os dados de exemplo sozinho.
6. Domínio próprio: **Settings → Domains**; depois atualize `NEXT_PUBLIC_APP_URL` e as URLs de retorno do Google/Mercado Pago/Stripe.

Limites da plataforma que o app já respeita: corpo de requisição/resposta até 4,5 MB (vídeo vai em partes; mídia sai em fatias), tempo máximo por função (busca em lote e canal ao vivo usam `maxDuration = 300`; o canal ao vivo se renova antes do limite e o navegador reconecta sozinho), várias instâncias ao mesmo tempo (pool de 5 conexões por instância; ajuste com `DB_POOL_MAX`).

---

## Componente `PredictionMarketCard`

Integrado em `components/ui/prediction-market-card.tsx` com `avatar`, `separator` e `badge`. Demonstração em **`/demo/prediction-market-card`**. O `button` do shadcn (estilo nova) foi mantido por ter as mesmas props e mais tamanhos; as animações ganharam o tipo `Variants`; a demo usa uma foto do Unsplash no lugar do logo da Wikimedia (que responde 400).
