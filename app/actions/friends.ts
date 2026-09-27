"use server";

import { z } from "zod";
import { action, idSchema } from "@/lib/action";
import { removeFriend, respondFriendRequest, searchPeople, sendFriendRequest, setBlock } from "@/lib/social/friends";

/** Convidar para amizade (se a pessoa já tinha me convidado, vira amizade na hora). */
export const addFriend = action({ name: "addFriend", schema: z.object({ userId: idSchema }), limit: "friend" }, async ({ userId }, user) => ({
  relation: await sendFriendRequest(user.id, userId),
}));

export const answerFriendRequest = action(
  { name: "answerFriendRequest", schema: z.object({ userId: idSchema, accept: z.boolean() }) },
  async ({ userId, accept }, user) => ({ relation: await respondFriendRequest(user.id, userId, accept) }),
);

/** Cancelar convite enviado ou desfazer amizade. */
export const unfriend = action({ name: "unfriend", schema: z.object({ userId: idSchema }) }, async ({ userId }, user) => ({
  relation: await removeFriend(user.id, userId),
}));

/** Bloquear/desbloquear (desfaz amizade e convites; ninguém manda mensagem para ninguém). */
export const setUserBlocked = action({ name: "setUserBlocked", schema: z.object({ userId: idSchema, blocked: z.boolean() }) }, async ({ userId, blocked }, user) => {
  await setBlock(user.id, userId, blocked);
  return { ok: true };
});

/** Procurar pessoas para adicionar (nome ou @), com a relação de cada uma. */
export const findPeopleToAdd = action({ name: "findPeopleToAdd", schema: z.object({ q: z.string().max(60) }), limit: "chat" }, async ({ q }, user) =>
  searchPeople(user.id, q),
);
