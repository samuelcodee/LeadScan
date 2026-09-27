import "server-only";
import { env } from "@/lib/env";
import { logger } from "@/lib/logger";
import { UserFacingError } from "@/lib/action";

/**
 * Envio de e-mail (Resend) e SMS (Twilio) — chamados só pelo servidor.
 * Sem provedor configurado em desenvolvimento, a mensagem vai para o log do servidor
 * e `devPreview` volta para a tela de login mostrar o código (nunca em produção).
 */
export type SendResult = { delivered: boolean; devPreview?: string };

export class MessagingUnavailableError extends UserFacingError {}

const isProd = () => env().NODE_ENV === "production";

export async function sendEmail(msg: { to: string; subject: string; text: string; html?: string }): Promise<SendResult> {
  const e = env();
  if (!e.RESEND_API_KEY) {
    if (isProd()) throw new MessagingUnavailableError("Login por e-mail indisponível no momento.");
    logger.info("email (dev, não enviado)", { to: msg.to, subject: msg.subject, text: msg.text });
    return { delivered: false, devPreview: msg.text };
  }
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${e.RESEND_API_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({ from: e.EMAIL_FROM, to: [msg.to], subject: msg.subject, text: msg.text, html: msg.html }),
    signal: AbortSignal.timeout(10_000),
  });
  if (!res.ok) {
    logger.error("resend falhou", { status: res.status });
    throw new MessagingUnavailableError("Não conseguimos enviar o e-mail agora. Tente de novo em instantes.");
  }
  return { delivered: true };
}

export async function sendSms(msg: { to: string; text: string }): Promise<SendResult> {
  const e = env();
  if (!e.TWILIO_ACCOUNT_SID || !e.TWILIO_AUTH_TOKEN || !e.TWILIO_FROM) {
    if (isProd()) throw new MessagingUnavailableError("Login por celular indisponível no momento.");
    logger.info("sms (dev, não enviado)", { to: msg.to, text: msg.text });
    return { delivered: false, devPreview: msg.text };
  }
  const body = new URLSearchParams({ To: `+${msg.to}`, Body: msg.text });
  // TWILIO_FROM pode ser um número (+55…) ou um Messaging Service SID (MG…)
  if (e.TWILIO_FROM.startsWith("MG")) body.set("MessagingServiceSid", e.TWILIO_FROM);
  else body.set("From", e.TWILIO_FROM);
  const res = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${e.TWILIO_ACCOUNT_SID}/Messages.json`, {
    method: "POST",
    headers: {
      Authorization: `Basic ${Buffer.from(`${e.TWILIO_ACCOUNT_SID}:${e.TWILIO_AUTH_TOKEN}`).toString("base64")}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body,
    signal: AbortSignal.timeout(10_000),
  });
  if (!res.ok) {
    logger.error("twilio falhou", { status: res.status });
    throw new MessagingUnavailableError("Não conseguimos enviar o SMS agora. Confira o número e tente de novo.");
  }
  return { delivered: true };
}
