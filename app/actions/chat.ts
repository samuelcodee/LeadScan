"use server";

import { z } from "zod";
import { action, idSchema } from "@/lib/action";
import { deleteMessage, editMessage, markRead, MAX_TEXT, openConversation, sendMessage } from "@/lib/chat/service";
import { db } from "@/lib/db";

export const startConversation = action(
  { name: "startConversation", schema: z.object({ username: z.string().trim().min(2).max(40) }), limit: "chat" },
  async ({ username }, user) => ({ id: await openConversation(user.id, username.replace(/^@/, "")) }),
);

export const sendText = action(
  { name: "sendText", schema: z.object({ conversationId: idSchema, body: z.string().trim().min(1, "Escreva uma mensagem.").max(MAX_TEXT, "Mensagem longa demais.") }), limit: "chat" },
  async ({ conversationId, body }, user) => sendMessage(user.id, conversationId, { kind: "TEXT", body }),
);

export const markConversationRead = action(
  { name: "markConversationRead", schema: z.object({ conversationId: idSchema }), limit: "chat" },
  async ({ conversationId }, user) => {
    await markRead(user.id, conversationId);
    return { ok: true };
  },
);

export const deleteChatMessage = action({ name: "deleteChatMessage", schema: z.object({ messageId: idSchema }), limit: "chat" }, async ({ messageId }, user) => {
  await deleteMessage(user.id, messageId);
  return { ok: true };
});

export const editChatMessage = action(
  {
    name: "editChatMessage",
    schema: z.object({ messageId: idSchema, body: z.string().trim().min(1, "A mensagem não pode ficar vazia.").max(MAX_TEXT, "Mensagem longa demais.") }),
    limit: "chat",
  },
  async ({ messageId, body }, user) => editMessage(user.id, messageId, body),
);

/** Bloquear/desbloquear alguém (vale nos dois sentidos para envio de mensagens). */
export const setBlocked = action({ name: "setBlocked", schema: z.object({ userId: idSchema, blocked: z.boolean() }) }, async ({ userId, blocked }, user) => {
  if (userId === user.id) return { ok: true };
  if (blocked) await db.userBlock.upsert({ where: { blockerId_blockedId: { blockerId: user.id, blockedId: userId } }, create: { blockerId: user.id, blockedId: userId }, update: {} });
  else await db.userBlock.deleteMany({ where: { blockerId: user.id, blockedId: userId } });
  return { ok: true };
});
