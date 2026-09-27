/**
 * Logger estruturado mínimo (JSON em produção, legível em dev).
 * Campos com nomes sensíveis são mascarados antes de sair.
 * Substituível por pino/OpenTelemetry sem mudar os pontos de chamada.
 */
type Level = "debug" | "info" | "warn" | "error";

const SENSITIVE = /(key|secret|token|password|authorization|cookie)/i;

function redact(value: unknown, depth = 0): unknown {
  if (depth > 4 || value === null || typeof value !== "object") return value;
  if (value instanceof Error) return { name: value.name, message: value.message };
  if (Array.isArray(value)) return value.map((v) => redact(v, depth + 1));
  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>).map(([k, v]) => [
      k,
      SENSITIVE.test(k) ? "[redacted]" : redact(v, depth + 1),
    ]),
  );
}

function write(level: Level, msg: string, ctx?: Record<string, unknown>) {
  if (level === "debug" && process.env.NODE_ENV === "production") return;
  const entry = { level, msg, time: new Date().toISOString(), ...(redact(ctx ?? {}) as object) };
  const out = process.env.NODE_ENV === "production" ? JSON.stringify(entry) : `[${level}] ${msg}`;
  const extra = process.env.NODE_ENV === "production" || !ctx ? [] : [redact(ctx)];
  if (level === "error") console.error(out, ...extra);
  else if (level === "warn") console.warn(out, ...extra);
  else console.log(out, ...extra);
}

export const logger = {
  debug: (msg: string, ctx?: Record<string, unknown>) => write("debug", msg, ctx),
  info: (msg: string, ctx?: Record<string, unknown>) => write("info", msg, ctx),
  warn: (msg: string, ctx?: Record<string, unknown>) => write("warn", msg, ctx),
  error: (msg: string, ctx?: Record<string, unknown>) => write("error", msg, ctx),
};
