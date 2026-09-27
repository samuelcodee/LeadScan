import "server-only";
import { randomBytes } from "node:crypto";
import { UserFacingError } from "@/lib/action";
import { dummyHash, hashPassword, passwordProblem, verifyPassword } from "@/lib/auth/password";
import { db } from "@/lib/db";
import { env } from "@/lib/env";
import { fold } from "@/lib/format";
import { normalizeBrazilPhone } from "@/lib/whatsapp/phone";

/**
 * Contas: e-mail, celular ou Google. Um mesmo e-mail verificado vira a mesma conta,
 * não importa por onde a pessoa entrou.
 */
export const USERNAME_RE = /^[a-z0-9](?:[a-z0-9._]{1,22}[a-z0-9])$/;
const RESERVED = new Set([
  "admin", "api", "login", "logout", "perfil", "u", "comunidade", "ranking", "financeiro", "configuracoes", "settings",
  "suporte", "leadsite", "demo", "proposta", "pagar", "onboarding", "termos", "privacidade", "integracoes",
]);

export function normalizeEmail(raw: string) {
  const email = raw.trim().toLowerCase();
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email) && email.length <= 160 ? email : null;
}

/** Só celular brasileiro recebe código por SMS. Retorna E.164 sem "+". */
export function normalizeMobile(raw: string) {
  const p = normalizeBrazilPhone(raw);
  return p?.isMobile ? p.e164 : null;
}

export function isReservedUsername(u: string) {
  return RESERVED.has(u);
}

/** @usuário livre a partir do nome ("Ana Paula" → "anapaula", "anapaula2"…). */
export async function makeUsername(seed: string) {
  let base = fold(seed).replace(/[^a-z0-9]/g, "").slice(0, 18);
  if (base.length < 3) base = `user${base}`;
  if (RESERVED.has(base)) base = `${base}1`;
  for (let i = 0; i < 20; i++) {
    const candidate = i === 0 ? base : `${base}${i < 10 ? i + 1 : randomBytes(2).readUInt16BE() % 10000}`;
    const taken = await db.user.findUnique({ where: { username: candidate }, select: { id: true } });
    if (!taken) return candidate;
  }
  return `${base}${Date.now().toString(36)}`;
}

function isAdminEmail(email: string | null) {
  if (!email) return false;
  return env()
    .ADMIN_EMAILS.split(",")
    .map((x) => x.trim().toLowerCase())
    .filter(Boolean)
    .includes(email);
}

function nameFromEmail(email: string) {
  const local = email.split("@")[0].replace(/[._-]+/g, " ").replace(/\d+/g, "").trim();
  return local ? local.replace(/\b\w/g, (c) => c.toUpperCase()).slice(0, 60) : "Novo usuário";
}

/**
 * Dono provou o contato (código ou Google) numa conta que foi criada com senha e contato NÃO
 * verificado: a senha pode ser de quem cadastrou o e-mail/celular alheio. Apaga a senha e
 * derruba as sessões abertas — a conta passa a ser só do dono verdadeiro.
 */
const claimUnverified = { passwordHash: null, sessionVersion: { increment: 1 } } as const;

export async function loginWithEmail(email: string) {
  const existing = await db.user.findUnique({ where: { email } });
  if (existing) {
    if (existing.emailVerifiedAt) return existing;
    return db.user.update({ where: { id: existing.id }, data: { emailVerifiedAt: new Date(), ...(existing.passwordHash ? claimUnverified : {}) } });
  }
  const name = nameFromEmail(email);
  return db.user.create({
    data: { email, emailVerifiedAt: new Date(), name, username: await makeUsername(name), role: isAdminEmail(email) ? "ADMIN" : "USER" },
  });
}

export async function loginWithPhone(phone: string) {
  const existing = await db.user.findUnique({ where: { phone } });
  if (existing) {
    if (existing.phoneVerifiedAt) return existing;
    return db.user.update({ where: { id: existing.id }, data: { phoneVerifiedAt: new Date(), ...(existing.passwordHash ? claimUnverified : {}) } });
  }
  return db.user.create({
    data: { phone, phoneVerifiedAt: new Date(), name: "Novo usuário", username: await makeUsername(`user${phone.slice(-4)}`) },
  });
}

export type GoogleProfile = { sub: string; email: string | null; emailVerified: boolean; name: string | null };

export async function loginWithGoogle(p: GoogleProfile) {
  const byGoogle = await db.user.findUnique({ where: { googleId: p.sub } });
  if (byGoogle) return byGoogle;
  // Só vincula a uma conta existente se o Google confirmou o e-mail
  if (p.email && p.emailVerified) {
    const byEmail = await db.user.findUnique({ where: { email: p.email } });
    if (byEmail) {
      return db.user.update({
        where: { id: byEmail.id },
        data: { googleId: p.sub, emailVerifiedAt: byEmail.emailVerifiedAt ?? new Date(), ...(!byEmail.emailVerifiedAt && byEmail.passwordHash ? claimUnverified : {}) },
      });
    }
  }
  const name = (p.name?.trim() || (p.email ? nameFromEmail(p.email) : "Novo usuário")).slice(0, 60);
  return db.user.create({
    data: {
      googleId: p.sub,
      email: p.email && p.emailVerified ? p.email : null,
      emailVerifiedAt: p.email && p.emailVerified ? new Date() : null,
      name,
      username: await makeUsername(name),
      role: isAdminEmail(p.email) ? "ADMIN" : "USER",
    },
  });
}

/* ─── E-mail ou celular + senha ─────────────────────────────────────────────
 * Funciona sem provedor de e-mail/SMS. O contato fica "não verificado" até a pessoa
 * confirmar por código ou Google (aí vale a proteção de claimUnverified acima).
 */
export type Identifier = { kind: "EMAIL"; value: string } | { kind: "PHONE"; value: string };

export function parseIdentifier(raw: string): Identifier | null {
  const v = raw.trim();
  if (v.includes("@")) {
    const email = normalizeEmail(v);
    return email ? { kind: "EMAIL", value: email } : null;
  }
  const phone = normalizeMobile(v);
  return phone ? { kind: "PHONE", value: phone } : null;
}

const WRONG = "E-mail/celular ou senha não conferem.";

export async function signUpWithPassword(raw: string, password: string) {
  const id = parseIdentifier(raw);
  if (!id) throw new UserFacingError("Use um e-mail válido ou um celular com DDD. Ex.: voce@empresa.com.br ou (85) 99999-8888");
  const problem = passwordProblem(password, raw.trim());
  if (problem) throw new UserFacingError(problem);
  const where = id.kind === "EMAIL" ? { email: id.value } : { phone: id.value };
  const existing = await db.user.findUnique({ where, select: { id: true } });
  if (existing) {
    throw new UserFacingError(id.kind === "EMAIL" ? "Já existe uma conta com esse e-mail. Entre com a senha ou pelo Google." : "Já existe uma conta com esse celular. Entre com a senha.");
  }
  const name = id.kind === "EMAIL" ? nameFromEmail(id.value) : "Novo usuário";
  try {
    return await db.user.create({
      data: {
        ...where,
        passwordHash: await hashPassword(password),
        name,
        username: await makeUsername(id.kind === "EMAIL" ? name : `user${id.value.slice(-4)}`),
        role: id.kind === "EMAIL" && isAdminEmail(id.value) ? "ADMIN" : "USER",
      },
    });
  } catch {
    // corrida: duas criações ao mesmo tempo com o mesmo contato
    throw new UserFacingError("Já existe uma conta com esse contato. Entre com a senha.");
  }
}

export async function signInWithPassword(raw: string, password: string) {
  const id = parseIdentifier(raw);
  const user = id ? await db.user.findUnique({ where: id.kind === "EMAIL" ? { email: id.value } : { phone: id.value } }) : null;
  if (!user?.passwordHash) {
    await verifyPassword(password, await dummyHash()); // mesmo tempo de resposta com ou sem conta
    if (user && (user.googleId || user.emailVerifiedAt || user.phoneVerifiedAt)) {
      throw new UserFacingError(user.googleId ? "Essa conta entra pelo Google. Toque em “Continuar com Google”." : "Essa conta entra por código. Toque em “Entrar com código”.");
    }
    throw new UserFacingError(WRONG);
  }
  if (!(await verifyPassword(password, user.passwordHash))) throw new UserFacingError(WRONG);
  return user;
}
