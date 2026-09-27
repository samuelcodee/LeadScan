"use server";

import { z } from "zod";
import { action, publicAction, UserFacingError } from "@/lib/action";
import { loginWithEmail, loginWithPhone, normalizeEmail, normalizeMobile, isReservedUsername, USERNAME_RE } from "@/lib/auth/accounts";
import { consumeCode, issueCode } from "@/lib/auth/otp";
import { clearSessionCookie, safeNext, setSessionCookie } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { formatPhone } from "@/lib/whatsapp/phone";
import { sendEmail, sendSms } from "@/lib/messaging";

const channelSchema = z.enum(["EMAIL", "SMS"]);

function normalizeTarget(channel: "EMAIL" | "SMS", raw: string) {
  const target = channel === "EMAIL" ? normalizeEmail(raw) : normalizeMobile(raw);
  if (!target) {
    throw new UserFacingError(channel === "EMAIL" ? "Confira o e-mail. Ex.: voce@empresa.com.br" : "Use um celular com DDD. Ex.: (85) 99999-8888");
  }
  return target;
}

async function deliver(channel: "EMAIL" | "SMS", target: string, code: string) {
  const text =
    channel === "EMAIL"
      ? `Seu código de acesso ao LeadScan é ${code}.\n\nEle vale por 10 minutos. Se não foi você, é só ignorar este e-mail.`
      : `LeadScan: seu código é ${code}. Vale por 10 min. Não compartilhe.`;
  const r = channel === "EMAIL" ? await sendEmail({ to: target, subject: `${code} é seu código do LeadScan`, text }) : await sendSms({ to: target, text });
  // Sem provedor de envio (só em desenvolvimento): a tela mostra o código para testar o fluxo.
  return r.delivered ? null : code;
}

export const requestLoginCode = publicAction(
  { schema: z.object({ channel: channelSchema, target: z.string().trim().min(3).max(160) }), limit: "auth", name: "requestLoginCode" },
  async ({ channel, target: raw }) => {
    const target = normalizeTarget(channel, raw);
    const code = await issueCode(channel, target);
    const devCode = await deliver(channel, target, code);
    return { target, display: channel === "EMAIL" ? target : (formatPhone(target) ?? target), devCode };
  },
);

export const verifyLoginCode = publicAction(
  {
    schema: z.object({ channel: channelSchema, target: z.string().max(160), code: z.string().trim().min(6).max(8), next: z.string().max(300).optional() }),
    limit: "auth",
    name: "verifyLoginCode",
  },
  async ({ channel, target: raw, code, next }) => {
    const target = normalizeTarget(channel, raw);
    await consumeCode(channel, target, code);
    const user = channel === "EMAIL" ? await loginWithEmail(target) : await loginWithPhone(target);
    await setSessionCookie(user);
    const dest = safeNext(next);
    return { redirect: user.onboardedAt ? dest : `/onboarding?next=${encodeURIComponent(dest)}` };
  },
);

export const completeOnboarding = action(
  {
    schema: z.object({
      name: z.string().trim().min(2, "Seu nome precisa de pelo menos 2 letras.").max(60),
      username: z
        .string()
        .trim()
        .toLowerCase()
        .regex(USERNAME_RE, "Use de 3 a 24 caracteres: letras, números, ponto ou _ (sem começar/terminar com símbolo)."),
      agencyName: z.string().trim().max(80).optional(),
      acceptTerms: z.literal(true, { error: "Para continuar, aceite os termos e a política de privacidade." }),
      profilePublic: z.boolean(),
      rankingOptIn: z.boolean(),
    }),
    name: "completeOnboarding",
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
        agencyName: input.agencyName || null,
        profilePublic: input.profilePublic,
        rankingOptIn: input.rankingOptIn,
        rankingOptInAt: input.rankingOptIn ? new Date() : null,
        termsAcceptedAt: user.termsAcceptedAt ?? new Date(),
        onboardedAt: user.onboardedAt ?? new Date(),
      },
    });
    return { ok: true };
  },
);

export const checkUsername = action(
  { schema: z.object({ username: z.string().trim().toLowerCase().max(30) }), name: "checkUsername" },
  async ({ username }, user) => {
    if (!USERNAME_RE.test(username)) return { available: false, reason: "formato" as const };
    if (isReservedUsername(username)) return { available: false, reason: "reservado" as const };
    const taken = await db.user.findFirst({ where: { username, NOT: { id: user.id } }, select: { id: true } });
    return { available: !taken, reason: taken ? ("em uso" as const) : null };
  },
);

/** Invalida todas as sessões (inclusive esta) e volta para o login. */
export const signOutEverywhere = action({ schema: z.object({}), name: "signOutEverywhere" }, async (_input, user) => {
  await db.user.update({ where: { id: user.id }, data: { sessionVersion: { increment: 1 } } });
  await clearSessionCookie();
  return { redirect: "/login" };
});

/** Vincular e-mail ou celular a uma conta existente (Configurações → Conta). */
export const requestLinkCode = action(
  { schema: z.object({ channel: channelSchema, target: z.string().trim().min(3).max(160) }), limit: "search", name: "requestLinkCode" },
  async ({ channel, target: raw }, user) => {
    const target = normalizeTarget(channel, raw);
    const owner = await db.user.findFirst({ where: channel === "EMAIL" ? { email: target } : { phone: target }, select: { id: true } });
    if (owner && owner.id !== user.id) throw new UserFacingError("Esse contato já pertence a outra conta.");
    const code = await issueCode(channel, target, "LINK", user.id);
    return { target, devCode: await deliver(channel, target, code) };
  },
);

export const confirmLinkCode = action(
  { schema: z.object({ channel: channelSchema, target: z.string().max(160), code: z.string().trim().min(6).max(8) }), name: "confirmLinkCode" },
  async ({ channel, target: raw, code }, user) => {
    const target = normalizeTarget(channel, raw);
    const row = await consumeCode(channel, target, code, "LINK");
    if (row.userId !== user.id) throw new UserFacingError("Código inválido para esta conta.");
    await db.user.update({
      where: { id: user.id },
      data: channel === "EMAIL" ? { email: target, emailVerifiedAt: new Date() } : { phone: target, phoneVerifiedAt: new Date() },
    });
    return { ok: true };
  },
);
