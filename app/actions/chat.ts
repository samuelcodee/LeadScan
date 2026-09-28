"use server";

import { z } from "zod";
import { action, idSchema } from "@/lib/action";
import { deleteMessage, editMessage, hideMessage, markRead, MAX_TEXT, openConversation, sendMessage, setInbox } from "@/lib/chat/service";
import { setBlock } from "@/lib/social/friends";

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

export const hideChatMessage = action({ name: "hideChatMessage", schema: z.object({ messageId: idSchema }), limit: "chat" }, async ({ messageId }, user) => {
  await hideMessage(user.id, messageId);
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

/** Bloquear/desbloquear alguém (vale nos dois sentidos; desfaz amizade e convites). */
export const setBlocked = action({ name: "setBlocked", schema: z.object({ userId: idSchema, blocked: z.boolean() }) }, async ({ userId, blocked }, user) => {
  await setBlock(user.id, userId, blocked);
  return { ok: true };
});

/** Pedido de mensagem: aceitar (vira conversa normal) ou recusar (some da lista; a pessoa não envia mais). */
export const answerMessageRequest = action(
  { name: "answerMessageRequest", schema: z.object({ conversationId: idSchema, accept: z.boolean() }), limit: "chat" },
  async ({ conversationId, accept }, user) => {
    await setInbox(user.id, conversationId, accept);
    return { ok: true };
  },
);
