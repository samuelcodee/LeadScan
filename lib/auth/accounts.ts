import "server-only";
import { randomBytes } from "node:crypto";
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

export async function loginWithEmail(email: string) {
  const existing = await db.user.findUnique({ where: { email } });
  if (existing) {
    return existing.emailVerifiedAt ? existing : db.user.update({ where: { id: existing.id }, data: { emailVerifiedAt: new Date() } });
  }
  const name = nameFromEmail(email);
  return db.user.create({
    data: { email, emailVerifiedAt: new Date(), name, username: await makeUsername(name), role: isAdminEmail(email) ? "ADMIN" : "USER" },
  });
}

export async function loginWithPhone(phone: string) {
  const existing = await db.user.findUnique({ where: { phone } });
  if (existing) return existing.phoneVerifiedAt ? existing : db.user.update({ where: { id: existing.id }, data: { phoneVerifiedAt: new Date() } });
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
        data: { googleId: p.sub, emailVerifiedAt: byEmail.emailVerifiedAt ?? new Date() },
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
