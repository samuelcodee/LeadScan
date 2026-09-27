"use server";

import { refresh } from "next/cache";
import { z } from "zod";
import { action, UserFacingError } from "@/lib/action";
import { isReservedUsername, USERNAME_RE } from "@/lib/auth/accounts";
import { clearSessionCookie } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { userTitles } from "@/lib/gamification/service";
import { fileToBuffer, saveImage } from "@/lib/media/store";
import { publish } from "@/lib/realtime";

const instagramHandle = z
  .string()
  .trim()
  .transform((v) => v.replace(/^https?:\/\/(www\.)?instagram\.com\//i, "").replace(/^@/, "").replace(/\/.*$/, ""))
  .refine((v) => v === "" || /^[A-Za-z0-9._]{1,30}$/.test(v), "Instagram inválido. Use só o @, ex.: @seuestudio");

export const updateProfile = action(
  {
    schema: z.object({
      name: z.string().trim().min(2, "Seu nome precisa de pelo menos 2 letras.").max(60),
      username: z.string().trim().toLowerCase().regex(USERNAME_RE, "Use de 3 a 24 caracteres: letras, números, ponto ou _."),
      bio: z.string().trim().max(280, "A bio tem limite de 280 caracteres."),
      instagram: instagramHandle,
    }),
    name: "updateProfile",
  },
  async (input, user) => {
    if (isReservedUsername(input.username)) throw new UserFacingError("Esse @ é reservado. Escolha outro.");
    const taken = await db.user.findFirst({ where: { username: input.username, NOT: { id: user.id } }, select: { id: true } });
    if (taken) throw new UserFacingError("Esse @ já está em uso.");
    await db.user.update({
      where: { id: user.id },
      data: {
        name: input.name,
        username: input.username,
        bio: input.bio || null,
        instagram: input.instagram || null,
      },
    });
    await publish({ type: "profile", userId: user.id });
    refresh();
    return { username: input.username };
  },
);

export const updatePrivacy = action(
  {
    schema: z.object({ profilePublic: z.boolean(), showAccountAge: z.boolean(), rankingOptIn: z.boolean(), presenceVisible: z.boolean() }),
    name: "updatePrivacy",
  },
  async (input, user) => {
    await db.user.update({
      where: { id: user.id },
      data: {
        ...input,
        rankingOptInAt: input.rankingOptIn ? (user.rankingOptIn ? user.rankingOptInAt : new Date()) : null,
      },
    });
    await publish({ type: "profile", userId: user.id });
    refresh();
    return { ok: true };
  },
);

export const setDisplayTitle = action({ schema: z.object({ key: z.string().max(40).nullable() }), name: "setDisplayTitle" }, async ({ key }, user) => {
  if (key) {
    const titles = await userTitles(user.id, user.level);
    if (!titles.some((t) => t.key === key)) throw new UserFacingError("Você ainda não conquistou esse título.");
  }
  await db.user.update({ where: { id: user.id }, data: { displayTitle: key } });
  refresh();
  return { ok: true };
});

/** Upload da foto de perfil (FormData com "file"). Passa pela moderação antes de salvar. */
export const uploadAvatar = action({ schema: z.instanceof(FormData), limit: "upload", name: "uploadAvatar" }, async (form, user) => {
  const input = await fileToBuffer(form.get("file"));
  const media = await saveImage({ userId: user.id, kind: "AVATAR", input });
  const previous = user.avatarId;
  await db.user.update({ where: { id: user.id }, data: { avatarId: media.id } });
  if (previous) await db.media.delete({ where: { id: previous } }).catch(() => {});
  await publish({ type: "profile", userId: user.id });
  refresh();
  return { id: media.id, unverified: media.moderation === "UNVERIFIED" };
});

export const removeAvatar = action({ schema: z.object({}), name: "removeAvatar" }, async (_i, user) => {
  if (!user.avatarId) return { ok: true };
  const id = user.avatarId;
  await db.user.update({ where: { id: user.id }, data: { avatarId: null } });
  await db.media.delete({ where: { id } }).catch(() => {});
  refresh();
  return { ok: true };
});

/** LGPD: apaga a conta e tudo que pertence a ela (cascata no banco). Irreversível. */
export const deleteAccount = action(
  { schema: z.object({ confirm: z.literal("EXCLUIR", { error: "Digite EXCLUIR para confirmar." }) }), name: "deleteAccount" },
  async (_i, user) => {
    if (user.isDemo) throw new UserFacingError("A conta de demonstração não pode ser excluída.");
    await db.user.delete({ where: { id: user.id } });
    await clearSessionCookie();
    return { redirect: "/" };
  },
);
