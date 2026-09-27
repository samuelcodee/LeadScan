import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Studio } from "@/components/prototypes/studio";
import { isAIEnabled } from "@/lib/ai";
import { getAiProvider } from "@/lib/ai/catalog";
import { listConnections } from "@/lib/ai/connections";
import { requireUser } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { recentPhotoUrls } from "@/lib/media/files";
import { appUrl, leadPhotos, parseSpec, proposalUrl } from "@/lib/prototypes/service";

export const metadata: Metadata = { title: "Estúdio" };

export default async function PrototypePage(props: PageProps<"/prototypes/[id]">) {
  const user = await requireUser();
  const { id } = await props.params;
  const proto = await db.prototype.findFirst({
    where: { id, userId: user.id },
    include: { lead: { select: { id: true, name: true, isDemo: true, phone: true, whatsapp: true, photos: true } } },
  });
  if (!proto) notFound();
  // Tudo que o estúdio precisa sai numa rodada só (antes eram 6 consultas em fila)
  const [allConns, base, versions, library, shareUrl, aiEnabled] = await Promise.all([
    listConnections(user.id),
    appUrl(),
    db.prototype.findMany({
      where: { leadId: proto.leadId, userId: user.id },
      orderBy: { version: "asc" },
      select: { id: true, name: true, createdAt: true },
    }),
    recentPhotoUrls(user.id),
    proto.shareEnabled && proto.shareSlug ? proposalUrl(proto.shareSlug) : Promise.resolve(null),
    isAIEnabled(user.id),
  ]);
  const conns = allConns.filter((c) => c.status === "ACTIVE");
  const ai = {
    connected: conns.map((c) => ({ id: c.provider, name: getAiProvider(c.provider)?.name ?? c.provider })),
    defaultId: user.aiDefault,
    imageProviders: conns
      .filter((c) => c.provider === "gemini" || c.provider === "openai")
      .map((c) => ({ id: c.provider as "gemini" | "openai", label: getAiProvider(c.provider)?.image?.label ?? c.provider })),
    base,
  };
  return (
    <Studio
      key={proto.id}
      prototype={{ id: proto.id, name: proto.name, spec: parseSpec(proto.spec) }}
      lead={{ id: proto.lead.id, name: proto.lead.name, isDemo: proto.lead.isDemo, phone: proto.lead.phone, whatsapp: proto.lead.whatsapp }}
      // fotos do negócio primeiro, depois as enviadas em Arquivos
      leadPhotos={[...leadPhotos(proto.lead).photos, ...library]}
      versions={versions}
      initialShareUrl={shareUrl}
      aiEnabled={aiEnabled}
      ai={ai}
    />
  );
}
