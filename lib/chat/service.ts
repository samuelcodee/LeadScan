import "server-only";
import { UserFacingError } from "@/lib/action";
import { db } from "@/lib/db";
import { isDemoMode } from "@/lib/env";
import type { MessageKind } from "@/lib/generated/prisma/client";
import { badgeKeyFor } from "@/lib/gamification/levels";
import { presenceOf } from "@/lib/chat/presence";
import { publish } from "@/lib/realtime";

/**
 * Mensagens privadas entre usuários. Regras:
 *  - uma conversa por par de pessoas (pairKey)
 *  - só quem está na conversa lê, envia ou baixa a mídia dela
 *  - bloqueio vale nos dois sentidos: ninguém envia para quem bloqueou ou foi bloqueado
 *  - quem não é amigo chega como "pedido de mensagem" (ConversationMember.inbox = REQUEST):
 *    não conta como não lida, não mostra "visto" e só vira conversa quando a pessoa aceita
 *    (ou responde). Recusou = a conversa some da lista dela e o outro não envia mais.
 *  - quem escolheu "só amigos" (User.messagesFrom) não recebe pedido de quem não é amigo
 */
export const MAX_TEXT = 4000;

const PEER_SELECT = {
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

type PeerRow = {
  id: string;
  name: string;
  username: string | null;
  avatarId: string | null;
  level: number;
  displayTitle: string | null;
  isDemo: boolean;
  lastActiveAt: Date | null;
  presenceVisible: boolean;
};

export function toPeer(u: PeerRow) {
  return {
    id: u.id,
    name: u.name,
    username: u.username,
    avatarId: u.avatarId,
    level: u.level,
    badge: badgeKeyFor(u.displayTitle, u.level),
    isDemo: u.isDemo,
    // Quem ocultou o status não expõe nem o horário
    lastActiveAt: u.presenceVisible ? (u.lastActiveAt?.toISOString() ?? null) : null,
    presenceVisible: u.presenceVisible,
  };
}
export type ChatPeer = ReturnType<typeof toPeer>;

const MESSAGE_SELECT = {
  id: true,
  senderId: true,
  kind: true,
  body: true,
  mediaId: true,
  posterId: true,
  durationMs: true,
  createdAt: true,
  deletedAt: true,
  editedAt: true,
  media: { select: { width: true, height: true, mime: true } },
  poster: { select: { width: true, height: true } },
} as const;

type MessageRow = {
  id: string;
  senderId: string;
  kind: MessageKind;
  body: string | null;
  mediaId: string | null;
  posterId: string | null;
  durationMs: number | null;
  createdAt: Date;
  deletedAt: Date | null;
  editedAt: Date | null;
  media: { width: number; height: number; mime: string } | null;
  poster: { width: number; height: number } | null;
};

export function toMessage(m: MessageRow) {
  const deleted = !!m.deletedAt;
  return {
    id: m.id,
    senderId: m.senderId,
    kind: m.kind,
    body: deleted ? null : m.body,
    mediaId: deleted ? null : m.mediaId,
    posterId: deleted ? null : m.posterId,
    durationMs: m.durationMs,
    // Vídeo não tem dimensões salvas: a capa (mesma proporção) reserva o espaço
    width: m.media?.width || m.poster?.width || null,
    height: m.media?.height || m.poster?.height || null,
    mime: m.media?.mime ?? null,
    createdAt: m.createdAt.toISOString(),
    editedAt: deleted ? null : (m.editedAt?.toISOString() ?? null),
    deleted,
  };
}
export type ChatMessage = ReturnType<typeof toMessage>;

export const pairKey = (a: string, b: string) => [a, b].sort().join(":");

export async function isBlockedBetween(a: string, b: string) {
  const n = await db.userBlock.count({ where: { OR: [{ blockerId: a, blockedId: b }, { blockerId: b, blockedId: a }] } });
  return n > 0;
}

async function friendsBetween(a: string, b: string) {
  const f = await db.friendship.findUnique({ where: { pairKey: pairKey(a, b) }, select: { status: true } });
  return f?.status === "ACCEPTED";
}

/** Abre (ou reabre) a conversa com alguém pelo @. */
export async function openConversation(meId: string, username: string) {
  const other = await db.user.findUnique({
    where: { username: username.toLowerCase() },
    select: { id: true, name: true, onboardedAt: true, isDemo: true, messagesFrom: true },
  });
  if (!other || !other.onboardedAt || (other.isDemo && !isDemoMode())) throw new UserFacingError("Usuário não encontrado.");
  if (other.id === meId) throw new UserFacingError("Você não pode conversar com você mesmo.");
  const key = pairKey(meId, other.id);
  const existing = await db.conversation.findUnique({ where: { pairKey: key }, select: { id: true } });
  if (existing) {
    // Abrir de propósito uma conversa que estava em Pedidos (ou recusada) é aceitar
    await db.conversationMember.updateMany({ where: { conversationId: existing.id, userId: meId, inbox: { not: "ACCEPTED" } }, data: { inbox: "ACCEPTED" } });
    return existing.id;
  }
  if (await isBlockedBetween(meId, other.id)) throw new UserFacingError("Não é possível conversar com esta pessoa.");
  const friends = await friendsBetween(meId, other.id);
  if (!friends && other.messagesFrom === "FRIENDS") {
    throw new UserFacingError(`${other.name.split(" ")[0]} só recebe mensagens de amigos. Mande um convite de amizade pelo perfil.`);
  }
  try {
    const c = await db.conversation.create({
      data: {
        pairKey: key,
        members: { create: [{ userId: meId, lastReadAt: new Date() }, { userId: other.id, inbox: friends ? "ACCEPTED" : "REQUEST" }] },
      },
      select: { id: true },
    });
    return c.id;
  } catch {
    // Corrida: as duas pessoas abriram ao mesmo tempo
    const again = await db.conversation.findUnique({ where: { pairKey: key }, select: { id: true } });
    if (again) return again.id;
    throw new UserFacingError("Não deu para abrir a conversa. Tente de novo.");
  }
}

/** Conversa + a outra pessoa, se eu fizer parte dela. */
export async function getConversation(meId: string, conversationId: string) {
  const member = await db.conversationMember.findUnique({
    where: { conversationId_userId: { conversationId, userId: meId } },
    select: {
      lastReadAt: true,
      inbox: true,
      conversation: { select: { id: true, members: { where: { userId: { not: meId } }, select: { lastReadAt: true, inbox: true, user: { select: PEER_SELECT } } } } },
    },
  });
  const other = member?.conversation.members[0];
  if (!member || !other) return null;
  const [iBlocked, blockedMe] = await Promise.all([
    db.userBlock.count({ where: { blockerId: meId, blockedId: other.user.id } }),
    db.userBlock.count({ where: { blockerId: other.user.id, blockedId: meId } }),
  ]);
  return {
    id: member.conversation.id,
    peer: toPeer(other.user),
    // Pedido ainda não aceito: a outra pessoa não "viu" nada
    peerLastReadAt: other.inbox === "ACCEPTED" ? (other.lastReadAt?.toISOString() ?? null) : null,
    iBlocked: iBlocked > 0,
    blockedMe: blockedMe > 0,
    /** Minha caixa: REQUEST = pedido de mensagem esperando eu aceitar */
    myInbox: member.inbox,
    /** Caixa da outra pessoa: REQUEST = meu pedido ainda não foi aceito; DECLINED = recusado */
    peerInbox: other.inbox,
  };
}

export async function assertMember(meId: string, conversationId: string) {
  const m = await db.conversationMember.findUnique({ where: { conversationId_userId: { conversationId, userId: meId } }, select: { userId: true } });
  if (!m) throw new UserFacingError("Conversa não encontrada.");
}

async function peerOf(meId: string, conversationId: string) {
  const other = await db.conversationMember.findFirst({ where: { conversationId, userId: { not: meId } }, select: { userId: true } });
  if (!other) throw new UserFacingError("Conversa não encontrada.");
  return other.userId;
}

/** Aceitar (vira conversa normal) ou recusar (some da minha lista; a outra pessoa não envia mais) um pedido. */
export async function setInbox(meId: string, conversationId: string, accept: boolean) {
  const { count } = await db.conversationMember.updateMany({
    where: { conversationId, userId: meId },
    data: accept ? { inbox: "ACCEPTED", lastReadAt: new Date() } : { inbox: "DECLINED" },
  });
  if (!count) throw new UserFacingError("Conversa não encontrada.");
  const peerId = await peerOf(meId, conversationId);
  await Promise.all([publish({ type: "inbox", userId: meId, conversationId }), publish({ type: "inbox", userId: peerId, conversationId })]);
}

/** Página de mensagens (mais novas primeiro no banco; devolvidas em ordem cronológica). */
export async function listMessages(meId: string, conversationId: string, opts: { before?: string; after?: string; take?: number } = {}) {
  await assertMember(meId, conversationId);
  const take = Math.min(opts.take ?? 40, 100);
  if (opts.after) {
    const pivot = await db.message.findFirst({ where: { id: opts.after, conversationId }, select: { createdAt: true } });
    const rows = await db.message.findMany({
      where: { conversationId, NOT: { hiddenFor: { has: meId } }, ...(pivot ? { createdAt: { gt: pivot.createdAt } } : {}) },
      orderBy: { createdAt: "asc" },
      take: 100,
      select: MESSAGE_SELECT,
    });
    return { messages: rows.map(toMessage), hasMore: false };
  }
  const pivot = opts.before ? await db.message.findFirst({ where: { id: opts.before, conversationId }, select: { createdAt: true } }) : null;
  const rows = await db.message.findMany({
    where: { conversationId, NOT: { hiddenFor: { has: meId } }, ...(pivot ? { createdAt: { lt: pivot.createdAt } } : {}) },
    orderBy: { createdAt: "desc" },
    take: take + 1,
    select: MESSAGE_SELECT,
  });
  const hasMore = rows.length > take;
  return { messages: rows.slice(0, take).reverse().map(toMessage), hasMore };
}

export async function sendMessage(
  meId: string,
  conversationId: string,
  data: { kind: MessageKind; body?: string | null; mediaId?: string | null; posterId?: string | null; durationMs?: number | null },
) {
  const members = await db.conversationMember.findMany({ where: { conversationId }, select: { userId: true, inbox: true } });
  const me = members.find((m) => m.userId === meId);
  const peer = members.find((m) => m.userId !== meId);
  if (!me || !peer) throw new UserFacingError("Conversa não encontrada.");
  const peerId = peer.userId;
  if (await isBlockedBetween(meId, peerId)) throw new UserFacingError("Não é possível enviar mensagens para esta pessoa.");
  if (peer.inbox === "DECLINED") throw new UserFacingError("Esta pessoa não aceitou seu pedido de mensagem.");
  const body = data.body?.trim().slice(0, MAX_TEXT) || null;
  if (data.kind === "TEXT" && !body) throw new UserFacingError("Escreva uma mensagem.");
  const now = new Date();
  // Responder um pedido é aceitar
  if (me.inbox !== "ACCEPTED") {
    await db.conversationMember.update({ where: { conversationId_userId: { conversationId, userId: meId } }, data: { inbox: "ACCEPTED" } });
    await publish({ type: "inbox", userId: meId, conversationId });
  }
  const [msg] = await db.$transaction([
    db.message.create({
      data: { conversationId, senderId: meId, kind: data.kind, body, mediaId: data.mediaId ?? null, posterId: data.posterId ?? null, durationMs: data.durationMs ?? null, createdAt: now },
      select: MESSAGE_SELECT,
    }),
    db.conversation.update({ where: { id: conversationId }, data: { lastMessageAt: now } }),
    db.conversationMember.update({ where: { conversationId_userId: { conversationId, userId: meId } }, data: { lastReadAt: now } }),
  ]);
  const event = { type: "message" as const, conversationId, messageId: msg.id, fromUserId: meId };
  await Promise.all([publish({ ...event, userId: peerId }), publish({ ...event, userId: meId })]);
  return toMessage(msg);
}

export async function markRead(meId: string, conversationId: string) {
  const peerId = await peerOf(meId, conversationId);
  // Pedido de mensagem ainda não aceito: ler não avisa ninguém ("visto" só depois de aceitar)
  const { count } = await db.conversationMember.updateMany({ where: { conversationId, userId: meId, inbox: "ACCEPTED" }, data: { lastReadAt: new Date() } });
  if (!count) return;
  const event = { type: "read" as const, conversationId, byUserId: meId };
  await Promise.all([publish({ ...event, userId: peerId }), publish({ ...event, userId: meId })]);
}

/** Apagar para todos: só quem enviou; a mídia sai do banco na hora. */
export async function deleteMessage(meId: string, messageId: string) {
  const msg = await db.message.findUnique({ where: { id: messageId }, select: { senderId: true, conversationId: true, mediaId: true, posterId: true, deletedAt: true } });
  if (!msg || msg.senderId !== meId) throw new UserFacingError("Você só pode apagar mensagens que enviou.");
  if (msg.deletedAt) return;
  const mediaIds = [msg.mediaId, msg.posterId].filter((x): x is string => !!x);
  await db.$transaction([
    db.message.update({ where: { id: messageId }, data: { deletedAt: new Date(), body: null, mediaId: null, posterId: null } }),
    db.media.deleteMany({ where: { id: { in: mediaIds }, userId: meId } }),
  ]);
  const peerId = await peerOf(meId, msg.conversationId);
  const event = { type: "deleted" as const, conversationId: msg.conversationId, messageId };
  await Promise.all([publish({ ...event, userId: peerId }), publish({ ...event, userId: meId })]);
}

/** "Apagar para mim": qualquer participante tira a mensagem da PRÓPRIA conversa (a outra pessoa continua vendo). */
export async function hideMessage(meId: string, messageId: string) {
  const msg = await db.message.findUnique({ where: { id: messageId }, select: { conversationId: true, hiddenFor: true } });
  if (!msg) throw new UserFacingError("Mensagem não encontrada.");
  await assertMember(meId, msg.conversationId);
  if (msg.hiddenFor.includes(meId)) return;
  await db.message.update({ where: { id: messageId }, data: { hiddenFor: { push: meId } } });
}

/** Corrigir o texto: só quem enviou, só mensagem de texto, não apagada. A bolha passa a dizer "editada". */
export async function editMessage(meId: string, messageId: string, body: string) {
  const text = body.trim().slice(0, MAX_TEXT);
  if (!text) throw new UserFacingError("A mensagem não pode ficar vazia. Para tirar, use Apagar.");
  const msg = await db.message.findUnique({ where: { id: messageId }, select: { senderId: true, conversationId: true, kind: true, body: true, deletedAt: true } });
  if (!msg || msg.senderId !== meId) throw new UserFacingError("Você só pode editar mensagens que enviou.");
  if (msg.deletedAt) throw new UserFacingError("Essa mensagem foi apagada.");
  if (msg.kind !== "TEXT") throw new UserFacingError("Só dá para editar mensagens de texto.");
  if (msg.body === text) {
    const same = await db.message.findUniqueOrThrow({ where: { id: messageId }, select: MESSAGE_SELECT });
    return toMessage(same);
  }
  const updated = await db.message.update({ where: { id: messageId }, data: { body: text, editedAt: new Date() }, select: MESSAGE_SELECT });
  const peerId = await peerOf(meId, msg.conversationId);
  const event = { type: "edited" as const, conversationId: msg.conversationId, messageId };
  await Promise.all([publish({ ...event, userId: peerId }), publish({ ...event, userId: meId })]);
  return toMessage(updated);
}

/** Uma mensagem só (atualizar a bolha quando a outra pessoa edita). */
export async function getMessage(meId: string, conversationId: string, messageId: string) {
  await assertMember(meId, conversationId);
  const m = await db.message.findFirst({ where: { id: messageId, conversationId }, select: MESSAGE_SELECT });
  return m ? toMessage(m) : null;
}

/** Não lidas das conversas aceitas (pedidos de mensagem têm contador próprio). */
export async function unreadTotal(meId: string) {
  const [row] = await db.$queryRaw<{ n: bigint }[]>`
    SELECT COUNT(*) AS n FROM "Message" m
    JOIN "ConversationMember" cm ON cm."conversationId" = m."conversationId" AND cm."userId" = ${meId} AND cm."inbox" = 'ACCEPTED'
    WHERE m."senderId" <> ${meId} AND m."deletedAt" IS NULL AND (cm."lastReadAt" IS NULL OR m."createdAt" > cm."lastReadAt")`;
  return Number(row?.n ?? 0);
}

/** Lista de conversas (com pelo menos uma mensagem), mais recentes primeiro. `requests` = caixa de pedidos. */
export async function listConversations(meId: string, box: "inbox" | "requests" = "inbox") {
  const rows = await db.conversationMember.findMany({
    where: { userId: meId, inbox: box === "requests" ? "REQUEST" : "ACCEPTED", conversation: { messages: { some: {} } } },
    orderBy: { conversation: { lastMessageAt: "desc" } },
    take: 60,
    select: {
      conversation: {
        select: {
          id: true,
          lastMessageAt: true,
          members: { where: { userId: { not: meId } }, select: { user: { select: PEER_SELECT } } },
          messages: { orderBy: { createdAt: "desc" }, take: 1, select: { senderId: true, kind: true, body: true, deletedAt: true, createdAt: true } },
        },
      },
    },
  });
  const unread = await db.$queryRaw<{ id: string; n: bigint }[]>`
    SELECT m."conversationId" AS id, COUNT(*) AS n FROM "Message" m
    JOIN "ConversationMember" cm ON cm."conversationId" = m."conversationId" AND cm."userId" = ${meId}
    WHERE m."senderId" <> ${meId} AND m."deletedAt" IS NULL AND (cm."lastReadAt" IS NULL OR m."createdAt" > cm."lastReadAt")
    GROUP BY 1`;
  const unreadBy = new Map(unread.map((u) => [u.id, Number(u.n)]));
  return rows
    .filter((r) => r.conversation.members[0])
    .map((r) => {
      const last = r.conversation.messages[0];
      return {
        id: r.conversation.id,
        peer: toPeer(r.conversation.members[0].user),
        lastMessageAt: r.conversation.lastMessageAt.toISOString(),
        unread: unreadBy.get(r.conversation.id) ?? 0,
        last: last ? { mine: last.senderId === meId, kind: last.kind, body: last.deletedAt ? null : last.body, deleted: !!last.deletedAt } : null,
      };
    });
}
export type ConversationItem = Awaited<ReturnType<typeof listConversations>>[number];

/** Pedidos de mensagem esperando resposta (com pelo menos uma mensagem). */
export async function requestCount(meId: string) {
  return db.conversationMember.count({ where: { userId: meId, inbox: "REQUEST", conversation: { messages: { some: {} } } } });
}

/** Pessoas para começar conversa (nome ou @). */
export async function findPeople(meId: string, q: string) {
  const term = q.trim().replace(/^@/, "");
  if (term.length < 2) return [];
  const rows = await db.user.findMany({
    where: {
      id: { not: meId },
      onboardedAt: { not: null },
      username: { not: null },
      // Versão pública: as contas de exemplo da demonstração não aparecem para gente de verdade
      ...(isDemoMode() ? {} : { isDemo: false }),
      OR: [{ username: { contains: term.toLowerCase() } }, { name: { contains: term, mode: "insensitive" } }],
    },
    orderBy: [{ level: "desc" }, { name: "asc" }],
    take: 8,
    select: PEER_SELECT,
  });
  return rows.map(toPeer);
}

/** Heartbeat do app aberto. Grava no máximo a cada 45 s (o banco não vira gargalo). */
export async function touchPresence(meId: string, last: Date | null) {
  if (last && Date.now() - last.getTime() < 45_000) return;
  await db.user.update({ where: { id: meId }, data: { lastActiveAt: new Date() } });
}

export function peerPresence(peer: ChatPeer) {
  return presenceOf(peer.lastActiveAt, peer.presenceVisible);
}
