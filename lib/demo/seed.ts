import "server-only";
import { db } from "@/lib/db";
import type { LeadStatus } from "@/lib/generated/prisma/client";
import { createSearch, runSearchJob } from "@/lib/leads/search";
import { DEMO_USER_NAME, generateOutreachForLead } from "@/lib/outreach/service";
import { createPrototype, enableShare } from "@/lib/prototypes/service";

/**
 * MODO DEMONSTRAÇÃO — tudo aqui é fictício e marcado como DEMO na interface.
 * 5 categorias × 5 cidades, pipeline distribuído, protótipos, abordagens e histórico.
 */
export const DEMO_EMAIL = "demo@leadsite.local";

export async function ensureDemoUser() {
  const profile = {
    username: "demo",
    bio: "Conta de demonstração. Crio sites para negócios locais em Fortaleza e região.",
    instagram: null,
    profilePublic: true,
    rankingOptIn: true,
  };
  const user = await db.user.upsert({
    where: { email: DEMO_EMAIL },
    create: {
      email: DEMO_EMAIL,
      emailVerifiedAt: new Date(),
      name: DEMO_USER_NAME,
      isDemo: true,
      defaultTicket: 180000,
      plan: "PRO",
      ...profile,
      rankingOptInAt: new Date(),
      termsAcceptedAt: new Date(),
      onboardedAt: new Date(),
    },
    update: {},
  });
  // Conta demo criada antes da v2 (sem perfil): completa uma vez
  if (!user.onboardedAt) {
    return db.user.update({
      where: { id: user.id },
      data: { ...profile, rankingOptInAt: new Date(), termsAcceptedAt: new Date(), onboardedAt: new Date() },
    });
  }
  return user;
}

const SEARCHES = [
  { category: "clinica-estetica", city: { name: "Fortaleza", uf: "CE" } },
  { category: "dentista", city: { name: "São Paulo", uf: "SP" } },
  { category: "restaurante", city: { name: "Recife", uf: "PE" } },
  { category: "academia", city: { name: "Belo Horizonte", uf: "MG" } },
  { category: "barbearia", city: { name: "Rio de Janeiro", uf: "RJ" } },
];

// Etapas para os melhores leads (ordem = do topo do score para baixo)
const PIPELINE: { status: LeadStatus; favorite?: boolean; deal?: number }[] = [
  { status: "WON", favorite: true, deal: 240000 },
  { status: "PROPOSAL", favorite: true, deal: 220000 },
  { status: "PROPOSAL", deal: 180000 },
  { status: "NEGOTIATION", favorite: true, deal: 200000 },
  { status: "NEGOTIATION", deal: 150000 },
  { status: "REPLIED", favorite: true },
  { status: "REPLIED" },
  { status: "REPLIED" },
  { status: "CONTACTED" },
  { status: "CONTACTED" },
  { status: "CONTACTED" },
  { status: "CONTACTED" },
  { status: "CONTACTED" },
  { status: "INTERESTING", favorite: true },
  { status: "INTERESTING" },
  { status: "INTERESTING" },
  { status: "INTERESTING" },
  { status: "NEW" },
  { status: "NEW" },
  { status: "NEW" },
  { status: "NEW" },
  { status: "NEW" },
  { status: "NOT_INTERESTED" },
  { status: "LOST" },
];

const DAY = 24 * 60 * 60 * 1000;
const CONTACTED_OR_LATER: LeadStatus[] = ["CONTACTED", "REPLIED", "NEGOTIATION", "PROPOSAL", "WON", "NOT_INTERESTED", "LOST"];

export async function seedDemoData(userId: string) {
  const existing = await db.lead.count({ where: { userId } });
  if (existing > 0) return { skipped: true };

  const user = await db.user.findUniqueOrThrow({ where: { id: userId } });

  // 1) Buscas (passam pelo mesmo pipeline das buscas reais)
  for (const [i, s] of SEARCHES.entries()) {
    const search = await createSearch(userId, { categories: [s.category], cities: [s.city], limit: 20, provider: "mock" });
    await runSearchJob(search.id);
    await db.search.update({ where: { id: search.id }, data: { createdAt: new Date(Date.now() - (14 - i * 2) * DAY) } });
  }

  // 2) Espalha os melhores leads pelo pipeline, alternando categorias
  const byCategory = await Promise.all(
    SEARCHES.map((s) => db.lead.findMany({ where: { userId, category: s.category }, orderBy: { score: "desc" }, take: 6 })),
  );
  const interleaved = byCategory[0].flatMap((_, i) => byCategory.map((list) => list[i])).filter(Boolean);
  const picked = interleaved.slice(0, PIPELINE.length);

  for (const [i, lead] of picked.entries()) {
    const step = PIPELINE[i];
    const daysAgo = 12 - Math.floor(i / 2);
    const contacted = CONTACTED_OR_LATER.includes(step.status);
    await db.lead.update({
      where: { id: lead.id },
      data: {
        saved: true,
        status: step.status,
        favorite: step.favorite ?? false,
        dealValue: step.deal ?? null,
        lastContactAt: contacted ? new Date(Date.now() - daysAgo * DAY + 3 * 60 * 60 * 1000) : null,
        notes: step.status === "NEGOTIATION" ? "Pediu uma versão com agendamento online. Retomar na sexta." : null,
      },
    });
    await db.leadEvent.createMany({
      data: [
        { userId, leadId: lead.id, type: "SAVED", createdAt: new Date(Date.now() - daysAgo * DAY) },
        ...(step.status !== "NEW"
          ? [{ userId, leadId: lead.id, type: "STATUS_CHANGED" as const, meta: { to: step.status }, createdAt: new Date(Date.now() - (daysAgo - 1) * DAY) }]
          : []),
      ],
    });

    if (contacted || step.status === "INTERESTING") {
      if (i < 8) {
        const proto = await createPrototype(userId, lead.id);
        if (i < 5) {
          await enableShare(userId, proto.id);
          await db.prototype.update({ where: { id: proto.id }, data: { views: 3 + i * 2, lastViewedAt: new Date(Date.now() - i * DAY) } });
          await db.leadEvent.create({ data: { userId, leadId: lead.id, type: "PROPOSAL_VIEWED", createdAt: new Date(Date.now() - (daysAgo - 2) * DAY) } });
        }
      }
      await generateOutreachForLead(user, lead.id);
      if (contacted) {
        await db.leadEvent.create({
          data: { userId, leadId: lead.id, type: "WHATSAPP_OPENED", createdAt: new Date(Date.now() - daysAgo * DAY + 2 * 60 * 60 * 1000) },
        });
      }
    }
  }

  // Datas dos eventos "FOUND" acompanham as buscas
  await db.leadEvent.updateMany({ where: { userId, type: "FOUND" }, data: { createdAt: new Date(Date.now() - 14 * DAY) } });
  return { skipped: false, leads: await db.lead.count({ where: { userId } }) };
}

/** "Restaurar demonstração": apaga tudo da conta demo e popula de novo. */
export async function resetDemoData(userId: string) {
  await db.$transaction([
    db.leadEvent.deleteMany({ where: { userId } }),
    db.outreach.deleteMany({ where: { userId } }),
    db.prototype.deleteMany({ where: { userId } }),
    db.lead.deleteMany({ where: { userId } }),
    db.search.deleteMany({ where: { userId } }),
  ]);
  return seedDemoData(userId);
}
