import "server-only";
import { db } from "@/lib/db";
import { env } from "@/lib/env";
import { pointsForSale } from "@/lib/gamification/points";
import { recomputeLevel } from "@/lib/gamification/service";
import type { LeadStatus, Prisma } from "@/lib/generated/prisma/client";
import { randomSlug } from "@/lib/hash";
import { toLeadData } from "@/lib/leads/ingest";
import { leadToSite } from "@/lib/prototypes/service";
import { generateMockBusiness } from "@/lib/providers/mock";
import { buildSiteSpec } from "@/lib/templates/build";

/**
 * COMUNIDADE DE DEMONSTRAÇÃO — membros fictícios (isDemo) com vendas espalhadas nas
 * últimas semanas, para o ranking, os campeões e os perfis terem o que mostrar.
 * Fora do modo demo, contas e vendas isDemo/isTest não aparecem em lugar nenhum.
 */
const DOMAIN = "membros.leadsite.local";
const DAY = 86400000;

function rng(seed: number) {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

type Member = { name: string; username: string; agency?: string; bio: string; city: [string, string]; sales: number; monthsBack: number; ticket: number; optIn?: boolean; ig?: string };

const MEMBERS: Member[] = [
  { name: "Larissa Menezes", username: "larissa.sites", agency: "Menezes Digital", bio: "Sites para clínicas e consultórios em Fortaleza. Entrego em 10 dias.", city: ["Fortaleza", "CE"], sales: 320, monthsBack: 18, ticket: 1900, ig: "menezesdigital" },
  { name: "Rafael Tavares", username: "rafatavares", agency: "Tavares Web", bio: "Restaurantes e delivery. Cardápio no site, pedido no WhatsApp.", city: ["Recife", "PE"], sales: 170, monthsBack: 14, ticket: 1600 },
  { name: "Bruna Carvalho", username: "brunacarvalho", bio: "Designer. Faço landing pages para estética e salões.", city: ["São Paulo", "SP"], sales: 95, monthsBack: 11, ticket: 1500, ig: "bruna.designs" },
  { name: "Diego Nogueira", username: "diegonog", agency: "Nogueira Lab", bio: "Oficinas e auto centers. Orçamento pelo site.", city: ["Belo Horizonte", "MG"], sales: 45, monthsBack: 8, ticket: 1250 },
  { name: "Camila Rocha", username: "camilarocha", bio: "Começando agora, focada em academias e studios.", city: ["Curitiba", "PR"], sales: 22, monthsBack: 5, ticket: 1100 },
  { name: "Thiago Brandão", username: "thiagobrandao", agency: "Brandão Studio", bio: "Advogados e contadores. Site sóbrio que passa confiança.", city: ["Salvador", "BA"], sales: 14, monthsBack: 4, ticket: 2200 },
  { name: "Patrícia Lemos", username: "patilemos", bio: "Pet shops e veterinárias em Natal e região.", city: ["Natal", "RN"], sales: 9, monthsBack: 3, ticket: 1300 },
  { name: "Henrique Duarte", username: "henriqued", bio: "Freelancer de fim de semana. Imobiliárias e corretores.", city: ["Goiânia", "GO"], sales: 7, monthsBack: 3, ticket: 1800 },
  { name: "Juliana Pires", username: "jupires", agency: "Pires & Co", bio: "Hotéis e pousadas do litoral. Reserva direta, sem comissão.", city: ["Maceió", "AL"], sales: 6, monthsBack: 2, ticket: 2600, ig: "piresco" },
  { name: "Marcos Vieira", username: "marcosvieira", bio: "Barbearias com agenda online.", city: ["Rio de Janeiro", "RJ"], sales: 5, monthsBack: 2, ticket: 950 },
  { name: "Aline Freitas", username: "alinefreitas", bio: "Nutricionistas e psicólogos. Sites acolhedores.", city: ["Porto Alegre", "RS"], sales: 4, monthsBack: 2, ticket: 1400 },
  { name: "Gustavo Ramos", username: "gustavoramos", bio: "Dev full-stack. Sites rápidos para negócio local.", city: ["Florianópolis", "SC"], sales: 3, monthsBack: 1, ticket: 1700 },
  { name: "Renata Moura", username: "renatamoura", bio: "Confeitarias e cafés.", city: ["Campinas", "SP"], sales: 2, monthsBack: 1, ticket: 1200 },
  { name: "Felipe Andrade", username: "felipeandrade", bio: "Primeiro site vendido pela plataforma!", city: ["Manaus", "AM"], sales: 1, monthsBack: 1, ticket: 1000 },
  { name: "Vanessa Lima", username: "vanessalima", agency: "VL Sites", bio: "Clínicas de estética. Agendamento no WhatsApp.", city: ["Teresina", "PI"], sales: 11, monthsBack: 3, ticket: 1500 },
  { name: "Rodrigo Sales", username: "rodrigosales", bio: "Escolas de idiomas e cursos livres.", city: ["Brasília", "DF"], sales: 8, monthsBack: 2, ticket: 1900 },
  { name: "Isabela Costa", username: "isabelacosta", bio: "Sites para arquitetos e designers de interiores.", city: ["Vitória", "ES"], sales: 5, monthsBack: 2, ticket: 2400, optIn: false },
  { name: "André Figueiredo", username: "andrefig", bio: "Agência pequena, entregas grandes.", city: ["João Pessoa", "PB"], sales: 16, monthsBack: 4, ticket: 1350 },
];

const STATUSES_WON: LeadStatus = "WON";

export async function seedCommunityDemo() {
  const exists = await db.user.count({ where: { email: { endsWith: `@${DOMAIN}` } } });
  if (exists > 0) return { skipped: true };
  const minSale = env().RANKING_MIN_SALE_CENTS;
  const now = Date.now();
  const categories = ["clinica-estetica", "restaurante", "barbearia", "academia", "dentista", "pet-shop", "advocacia", "oficina-mecanica"];

  for (const [mi, m] of MEMBERS.entries()) {
    const rand = rng(1000 + mi * 97);
    const createdAt = new Date(now - (m.monthsBack * 30 + 12 + Math.floor(rand() * 40)) * DAY);
    const user = await db.user.create({
      data: {
        email: `${m.username.replace(/\./g, "")}@${DOMAIN}`,
        emailVerifiedAt: createdAt,
        name: m.name,
        username: m.username,
        agencyName: m.agency ?? null,
        bio: m.bio,
        instagram: m.ig ?? null,
        isDemo: true,
        profilePublic: true,
        showAccountAge: rand() > 0.2,
        rankingOptIn: m.optIn ?? true,
        rankingOptInAt: m.optIn === false ? null : createdAt,
        termsAcceptedAt: createdAt,
        onboardedAt: createdAt,
        createdAt,
      },
    });

    // Vendas: distribuídas desde a criação da conta, com mais peso nas semanas recentes
    const span = now - createdAt.getTime() - DAY;
    const sales: Prisma.SaleCreateManyInput[] = [];
    for (let i = 0; i < m.sales; i++) {
      const recentBias = Math.pow(rand(), 0.75);
      const closedAt = new Date(now - DAY / 2 - span * (1 - recentBias));
      const amountCents = Math.round((m.ticket * (0.6 + rand() * 0.9)) / 10) * 1000;
      sales.push({
        userId: user.id,
        source: "PLATFORM",
        verified: true,
        isTest: true,
        amountCents,
        method: rand() < 0.62 ? "pix" : rand() < 0.8 ? "credit_card" : "debit_card",
        points: pointsForSale(amountCents, minSale),
        closedAt,
      });
    }
    // Movimento na semana atual (ranking ao vivo): 0 a 3 vendas nos últimos dias
    const thisWeek = m.sales > 3 ? Math.floor(rand() * 4) : 0;
    for (let i = 0; i < thisWeek; i++) {
      const amountCents = Math.round((m.ticket * (0.7 + rand() * 0.8)) / 10) * 1000;
      sales.push({
        userId: user.id,
        source: "PLATFORM",
        verified: true,
        isTest: true,
        amountCents,
        method: "pix",
        points: pointsForSale(amountCents, minSale),
        closedAt: new Date(now - Math.floor(rand() * 2.5 * DAY) - 60 * 60 * 1000),
      });
    }
    await db.sale.createMany({ data: sales });

    // Atividade de prospecção (gráficos do perfil): leads, buscas, abordagens e protótipos
    const [city, uf] = m.city;
    const leadCount = Math.min(40, 8 + Math.round(m.sales / 6));
    const leads = Array.from({ length: leadCount }, (_, i) => {
      const category = categories[(mi + i) % categories.length];
      const b = generateMockBusiness({ category, city, uf }, 500 + mi * 50 + i);
      const r = rand();
      const status: LeadStatus = r < 0.3 ? STATUSES_WON : r < 0.5 ? "NOT_INTERESTED" : r < 0.6 ? "LOST" : r < 0.8 ? "CONTACTED" : "NEW";
      return { ...toLeadData(b, category), userId: user.id, provider: "mock", externalId: `community:${m.username}:${i}`, isDemo: true, saved: true, status, createdAt: new Date(now - Math.floor(rand() * 80) * DAY) };
    });
    await db.lead.createMany({ data: leads });
    const saved = await db.lead.findMany({ where: { userId: user.id }, select: { id: true, status: true } });
    const events: Prisma.LeadEventCreateManyInput[] = [];
    for (const l of saved) {
      const at = () => new Date(now - Math.floor(rand() * 84) * DAY - Math.floor(rand() * DAY));
      if (l.status !== "NEW") events.push({ userId: user.id, leadId: l.id, type: "WHATSAPP_OPENED", createdAt: at() });
      if (["WON", "NOT_INTERESTED", "LOST"].includes(l.status)) events.push({ userId: user.id, leadId: l.id, type: "STATUS_CHANGED", meta: { to: l.status }, createdAt: at() });
      if (rand() < 0.4) events.push({ userId: user.id, leadId: l.id, type: "OUTREACH_COPIED", createdAt: at() });
    }
    await db.leadEvent.createMany({ data: events });
    const searchCount = 3 + Math.floor(rand() * 12);
    await db.search.createMany({
      data: Array.from({ length: searchCount }, () => ({
        userId: user.id,
        params: { categories: [categories[Math.floor(rand() * categories.length)]], cities: [{ name: city, uf }], limit: 25 },
        provider: "mock",
        status: "DONE" as const,
        resultCount: 25,
        createdAt: new Date(now - Math.floor(rand() * 84) * DAY),
      })),
    });
    const protoLeads = await db.lead.findMany({ where: { userId: user.id }, take: Math.min(6, 1 + Math.floor(m.sales / 20)) });
    for (const [pi, lead] of protoLeads.entries()) {
      const spec = buildSiteSpec(leadToSite(lead), { variant: pi });
      await db.prototype.create({
        data: {
          userId: user.id,
          leadId: lead.id,
          name: "Protótipo 01",
          templateId: spec.templateId,
          spec: spec as unknown as Prisma.InputJsonValue,
          createdAt: new Date(now - Math.floor(rand() * 84) * DAY),
          shareSlug: pi === 0 ? `${m.username.replace(/\./g, "-")}-${randomSlug(8)}` : null,
        },
      });
    }

    await recomputeLevel(user.id);
    // Datas de conquista realistas: espalha entre a criação da conta e hoje
    const achievements = await db.achievement.findMany({ where: { userId: user.id }, orderBy: { key: "asc" } });
    for (const [ai, a] of achievements.entries()) {
      const t = createdAt.getTime() + ((ai + 1) / (achievements.length + 1)) * (now - createdAt.getTime());
      await db.achievement.update({ where: { id: a.id }, data: { unlockedAt: new Date(t) } });
    }
  }
  return { skipped: false, members: MEMBERS.length };
}

/** Vendas e cobranças da conta demo (o seu "financeiro" de exemplo). */
export async function seedDemoFinance(userId: string) {
  const has = await db.charge.count({ where: { userId } });
  if (has > 0) return { skipped: true };
  const minSale = env().RANKING_MIN_SALE_CENTS;
  const now = Date.now();
  const account = await db.paymentAccount.upsert({
    where: { userId_provider: { userId, provider: "mock" } },
    create: { userId, provider: "mock", status: "ACTIVE", externalId: `mock_${userId}` },
    update: {},
  });
  const won = await db.lead.findMany({ where: { userId, status: "WON" }, take: 3 });
  const open = await db.lead.findMany({ where: { userId, status: { in: ["PROPOSAL", "NEGOTIATION"] } }, take: 2 });

  const paid = [
    { days: 44, cents: 150000, method: "pix", lead: won[0] },
    { days: 37, cents: 180000, method: "credit_card" },
    { days: 29, cents: 120000, method: "pix" },
    { days: 18, cents: 240000, method: "pix", lead: won[1] },
    { days: 11, cents: 160000, method: "debit_card" },
    { days: 6, cents: 210000, method: "pix", lead: won[2] },
    { days: 1, cents: 190000, method: "credit_card" },
  ];
  const fees: Record<string, number> = { pix: 0.0099, debit_card: 0.0199, credit_card: 0.0498 };
  for (const p of paid) {
    const paidAt = new Date(now - p.days * DAY - 3 * 3600000);
    const fee = Math.round(p.cents * fees[p.method]);
    const charge = await db.charge.create({
      data: {
        userId,
        leadId: p.lead?.id ?? null,
        accountId: account.id,
        provider: "mock",
        slug: randomSlug(14),
        description: p.lead ? `Criação do site — ${p.lead.name}` : "Criação de site institucional",
        amountCents: p.cents,
        methods: ["pix", "credit_card", "debit_card"],
        status: "PAID",
        paidMethod: p.method,
        feeCents: fee,
        netCents: p.cents - fee,
        isTest: true,
        paidAt,
        createdAt: new Date(paidAt.getTime() - 2 * DAY),
      },
    });
    await db.sale.create({
      data: { userId, leadId: p.lead?.id ?? null, chargeId: charge.id, source: "PLATFORM", verified: true, isTest: true, amountCents: p.cents, method: p.method, points: pointsForSale(p.cents, minSale), closedAt: paidAt },
    });
  }
  for (const lead of open) {
    await db.charge.create({
      data: {
        userId,
        leadId: lead.id,
        accountId: account.id,
        provider: "mock",
        slug: randomSlug(14),
        description: `Criação do site — ${lead.name}`,
        amountCents: lead.dealValue ?? 180000,
        methods: ["pix", "credit_card", "debit_card"],
        checkoutUrl: null,
        isTest: true,
        createdAt: new Date(now - 2 * DAY),
      },
    });
  }
  await db.sale.create({ data: { userId, source: "MANUAL", verified: false, amountCents: 90000, note: "Manutenção mensal (transferência)", closedAt: new Date(now - 20 * DAY) } });
  await recomputeLevel(userId);
  return { skipped: false };
}
