import { getCurrentUser } from "@/lib/auth/session";
import { db } from "@/lib/db";

/** LGPD: portabilidade — exporta todos os dados da conta em JSON. */
export async function GET() {
  const user = await getCurrentUser();
  if (!user) return new Response("Não autenticado", { status: 401 });
  const [leads, prototypes, outreaches, searches, events] = await Promise.all([
    db.lead.findMany({ where: { userId: user.id } }),
    db.prototype.findMany({ where: { userId: user.id } }),
    db.outreach.findMany({ where: { userId: user.id } }),
    db.search.findMany({ where: { userId: user.id } }),
    db.leadEvent.findMany({ where: { userId: user.id } }),
  ]);
  const body = JSON.stringify(
    {
      exportedAt: new Date().toISOString(),
      user: { name: user.name, email: user.email, agencyName: user.agencyName, plan: user.plan },
      leads,
      prototypes,
      outreaches,
      searches,
      events,
    },
    null,
    2,
  );
  return new Response(body, {
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Content-Disposition": `attachment; filename="leadscan-export-${new Date().toISOString().slice(0, 10)}.json"`,
      "Cache-Control": "no-store",
    },
  });
}
