import "server-only";
import { UserFacingError } from "@/lib/action";
import { pairKey, toPeer } from "@/lib/chat/service";
import { db } from "@/lib/db";
import { isDemoMode } from "@/lib/env";
import { publish } from "@/lib/realtime";

/**
 * Amizades, como numa rede social:
 *  - convite → a outra pessoa aceita ou recusa. Recusa é silenciosa: quem convidou continua
 *    vendo "Convite enviado" (ninguém é avisado de que foi recusado)
 *  - amigos conversam direto; quem não é amigo cai em "Pedidos de mensagem" (lib/chat/service.ts)
 *  - bloqueio vale nos dois sentidos e desfaz amizade e convites
 * Um registro por par de pessoas (pairKey), como as conversas.
 */

const PEER = {
  id: true,
  name: true,
  username: true,
  avatarId: true,
  level: true,
  displayTitle: true,
  isDemo: true,
  lastActiveAt: true,
  presenceVisible: true,
} as const;

/** Convites que uma pessoa pode mandar por dia (contra spam). */
const DAILY_INVITES = 60;

export type Relation =
  | { kind: "self" }
  | { kind: "blocked"; byMe: boolean }
  | { kind: "friends"; since: string }
  | { kind: "outgoing" }
  | { kind: "incoming" }
  | { kind: "none" };

async function blockBetween(a: string, b: string) {
  const rows = await db.userBlock.findMany({ where: { OR: [{ blockerId: a, blockedId: b }, { blockerId: b, blockedId: a }] }, select: { blockerId: true } });
  if (!rows.length) return null;
  return { byMe: rows.some((r) => r.blockerId === a) };
}

/** Como eu me relaciono com outra pessoa (botões do perfil). */
export async function relationWith(meId: string, otherId: string): Promise<Relation> {
  if (meId === otherId) return { kind: "self" };
  const block = await blockBetween(meId, otherId);
  if (block) return { kind: "blocked", byMe: block.byMe };
  const f = await db.friendship.findUnique({ where: { pairKey: pairKey(meId, otherId) } });
  if (!f) return { kind: "none" };
  if (f.status === "ACCEPTED") return { kind: "friends", since: (f.respondedAt ?? f.createdAt).toISOString() };
  if (f.requesterId === meId) return { kind: "outgoing" };
  // Recusei antes: para mim, volta a ser "Adicionar"
  return f.status === "PENDING" ? { kind: "incoming" } : { kind: "none" };
}

export async function areFriends(a: string, b: string) {
  const f = await db.friendship.findUnique({ where: { pairKey: pairKey(a, b) }, select: { status: true } });
  return f?.status === "ACCEPTED";
}

async function findTarget(otherId: string) {
  const other = await db.user.findUnique({ where: { id: otherId }, select: { id: true, name: true, onboardedAt: true, isDemo: true } });
  if (!other || !other.onboardedAt || (other.isDemo && !isDemoMode())) throw new UserFacingError("Usuário não encontrado.");
  return other;
}

/** Pedido de mensagem vira conversa normal para os dois (viraram amigos). */
async function acceptPairInbox(a: string, b: string) {
  const conv = await db.conversation.findUnique({ where: { pairKey: pairKey(a, b) }, select: { id: true } });
  if (!conv) return;
  const { count } = await db.conversationMember.updateMany({ where: { conversationId: conv.id, inbox: { not: "ACCEPTED" } }, data: { inbox: "ACCEPTED" } });
  if (count) await Promise.all([a, b].map((userId) => publish({ type: "inbox", userId, conversationId: conv.id })));
}

export async function sendFriendRequest(meId: string, otherId: string): Promise<Relation> {
  if (meId === otherId) throw new UserFacingError("Você não pode se adicionar.");
  await findTarget(otherId);
  if (await blockBetween(meId, otherId)) throw new UserFacingError("Não é possível adicionar esta pessoa.");
  const key = pairKey(meId, otherId);
  const existing = await db.friendship.findUnique({ where: { pairKey: key } });
  if (existing?.status === "ACCEPTED") return relationWith(meId, otherId);
  if (existing && existing.requesterId === meId) return { kind: "outgoing" };
  // A outra pessoa já tinha me convidado: aceitar é o mesmo que convidar de volta
  if (existing?.status === "PENDING") return respondFriendRequest(meId, otherId, true);

  const today = await db.friendship.count({ where: { requesterId: meId, createdAt: { gt: new Date(Date.now() - 24 * 60 * 60 * 1000) } } });
  if (today >= DAILY_INVITES) throw new UserFacingError("Você mandou muitos convites hoje. Tente amanhã.");

  const data = { requesterId: meId, addresseeId: otherId, status: "PENDING" as const, createdAt: new Date(), respondedAt: null };
  // Eu tinha recusado um convite dessa pessoa e agora convido: o registro vira o meu convite
  if (existing) await db.friendship.update({ where: { pairKey: key }, data });
  else {
    try {
      await db.friendship.create({ data: { pairKey: key, ...data } });
    } catch {
      // Corrida: os dois convidaram ao mesmo tempo
      return relationWith(meId, otherId);
    }
  }
  await publish({ type: "friend", userId: otherId });
  return { kind: "outgoing" };
}

/** Aceitar ou recusar um convite recebido. */
export async function respondFriendRequest(meId: string, otherId: string, accept: boolean): Promise<Relation> {
  const key = pairKey(meId, otherId);
  const { count } = await db.friendship.updateMany({
    where: { pairKey: key, addresseeId: meId, status: "PENDING" },
    data: { status: accept ? "ACCEPTED" : "DECLINED", respondedAt: new Date() },
  });
  if (!count) throw new UserFacingError("Convite não encontrado.");
  if (accept) {
    await acceptPairInbox(meId, otherId);
    await publish({ type: "friend", userId: otherId });
  }
  await publish({ type: "friend", userId: meId });
  return relationWith(meId, otherId);
}

/** Cancelar convite enviado ou desfazer amizade. */
export async function removeFriend(meId: string, otherId: string): Promise<Relation> {
  const key = pairKey(meId, otherId);
  await db.friendship.deleteMany({ where: { pairKey: key, OR: [{ status: "ACCEPTED" }, { requesterId: meId }] } });
  await publish({ type: "friend", userId: meId });
  return relationWith(meId, otherId);
}

/**
 * Bloquear: some amizade e convite entre os dois, e ninguém manda mensagem para ninguém.
 * Desbloquear não refaz a amizade.
 */
export async function setBlock(meId: string, otherId: string, blocked: boolean) {
  if (meId === otherId) return;
  if (blocked) {
    await findTarget(otherId);
    await db.$transaction([
      db.userBlock.upsert({ where: { blockerId_blockedId: { blockerId: meId, blockedId: otherId } }, create: { blockerId: meId, blockedId: otherId }, update: {} }),
      db.friendship.deleteMany({ where: { pairKey: pairKey(meId, otherId) } }),
    ]);
  } else {
    await db.userBlock.deleteMany({ where: { blockerId: meId, blockedId: otherId } });
  }
  await Promise.all([publish({ type: "friend", userId: meId }), publish({ type: "friend", userId: otherId })]);
}

/** Tudo da página Amigos numa ida: amigos, convites recebidos/enviados e bloqueados. */
export async function friendsOverview(meId: string) {
  const [rows, blocked] = await Promise.all([
    db.friendship.findMany({
      where: { OR: [{ requesterId: meId }, { addresseeId: meId, status: { in: ["PENDING", "ACCEPTED"] } }] },
      orderBy: { createdAt: "desc" },
      take: 500,
      select: { status: true, requesterId: true, createdAt: true, respondedAt: true, requester: { select: PEER }, addressee: { select: PEER } },
    }),
    db.userBlock.findMany({ where: { blockerId: meId }, orderBy: { createdAt: "desc" }, select: { createdAt: true, blocked: { select: PEER } } }),
  ]);
  const hidden = (u: { isDemo: boolean }) => u.isDemo && !isDemoMode();
  const friends: { peer: ReturnType<typeof toPeer>; since: string }[] = [];
  const incoming: { peer: ReturnType<typeof toPeer>; at: string }[] = [];
  const outgoing: { peer: ReturnType<typeof toPeer>; at: string }[] = [];
  for (const r of rows) {
    const mine = r.requesterId === meId;
    const other = mine ? r.addressee : r.requester;
    if (hidden(other)) continue;
    const peer = toPeer(other);
    if (r.status === "ACCEPTED") friends.push({ peer, since: (r.respondedAt ?? r.createdAt).toISOString() });
    else if (mine) outgoing.push({ peer, at: r.createdAt.toISOString() });
    else incoming.push({ peer, at: r.createdAt.toISOString() });
  }
  friends.sort((a, b) => a.peer.name.localeCompare(b.peer.name, "pt-BR"));
  return {
    friends,
    incoming,
    outgoing,
    blocked: blocked.filter((b) => !hidden(b.blocked)).map((b) => ({ peer: toPeer(b.blocked), at: b.createdAt.toISOString() })),
  };
}
export type FriendsOverview = Awaited<ReturnType<typeof friendsOverview>>;

/** Pessoas para adicionar (nome ou @), com a relação de cada uma. Sem quem bloqueou ou foi bloqueado. */
export async function searchPeople(meId: string, q: string) {
  const term = q.trim().replace(/^@/, "");
  if (term.length < 2) return [];
  const rows = await db.user.findMany({
    where: {
      id: { not: meId },
      onboardedAt: { not: null },
      username: { not: null },
      ...(isDemoMode() ? {} : { isDemo: false }),
      blocks: { none: { blockedId: meId } },
      blockedBy: { none: { blockerId: meId } },
      OR: [{ username: { contains: term.toLowerCase() } }, { name: { contains: term, mode: "insensitive" } }],
    },
    orderBy: [{ level: "desc" }, { name: "asc" }],
    take: 12,
    select: PEER,
  });
  const keys = rows.map((r) => pairKey(meId, r.id));
  const links = await db.friendship.findMany({ where: { pairKey: { in: keys } }, select: { pairKey: true, status: true, requesterId: true } });
  const byKey = new Map(links.map((l) => [l.pairKey, l]));
  return rows.map((r) => {
    const l = byKey.get(pairKey(meId, r.id));
    const relation: Relation["kind"] = !l
      ? "none"
      : l.status === "ACCEPTED"
        ? "friends"
        : l.requesterId === meId
          ? "outgoing"
          : l.status === "PENDING"
            ? "incoming"
            : "none";
    return { peer: toPeer(r), relation };
  });
}
