import "server-only";
import { z } from "zod";

/**
 * Leitura centralizada das variáveis de ambiente.
 * Este módulo é server-only: nenhuma chave chega ao bundle do navegador.
 */
const bool = z
  .enum(["true", "false", "1", "0"])
  .transform((v) => v === "true" || v === "1")
  .optional();

const schema = z.object({
  DATABASE_URL: z.string().min(1, "DATABASE_URL não configurada"),
  AUTH_SECRET: z.string().default(""),
  /**
   * demo = mostra "Explorar a demonstração" no login; public = só contas reais.
   * Sem valor: public em produção (versão aberta ao público), demo no desenvolvimento.
   */
  AUTH_MODE: z.enum(["demo", "public"]).optional(),
  /** Chave de 32 bytes (base64) para criptografar chaves de API e tokens de pagamento. */
  ENCRYPTION_KEY: z.string().default(""),
  ADMIN_EMAILS: z.string().default(""),
  /** E-mail do encarregado de dados (LGPD) exibido em Termos e Privacidade. */
  CONTACT_EMAIL: z.string().default(""),

  // Login
  AUTH_GOOGLE_ID: z.string().default(""),
  AUTH_GOOGLE_SECRET: z.string().default(""),
  RESEND_API_KEY: z.string().default(""),
  EMAIL_FROM: z.string().default("LeadScan <nao-responda@leadscan.local>"),
  TWILIO_ACCOUNT_SID: z.string().default(""),
  TWILIO_AUTH_TOKEN: z.string().default(""),
  TWILIO_FROM: z.string().default(""),

  // Moderação de imagens (fotos de perfil e dos sites)
  MODERATION_PROVIDER: z.enum(["none", "openai", "sightengine"]).default("none"),
  MODERATION_API_KEY: z.string().default(""),
  SIGHTENGINE_USER: z.string().default(""),
  SIGHTENGINE_SECRET: z.string().default(""),

  // Dados de empresas
  DATA_PROVIDER: z.enum(["mock", "osm", "google"]).default("mock"),
  MAPS_API_KEY: z.string().default(""),
  OVERPASS_URL: z.string().url().default("https://overpass-api.de/api/interpreter"),
  DATA_PROVIDER_API_KEY: z.string().default(""),

  // IA da plataforma (fallback quando o usuário não conectou a própria)
  AI_PROVIDER: z.enum(["none", "anthropic", "openai"]).default("none"),
  AI_API_KEY: z.string().default(""),
  AI_MODEL: z.string().default(""),
  AI_BASE_URL: z.string().default(""),

  // Pagamentos
  PAYMENTS_MOCK: bool,
  MP_CLIENT_ID: z.string().default(""),
  MP_CLIENT_SECRET: z.string().default(""),
  MP_WEBHOOK_SECRET: z.string().default(""),
  STRIPE_SECRET_KEY: z.string().default(""),
  STRIPE_WEBHOOK_SECRET: z.string().default(""),
  STRIPE_PIX: bool,
  PLATFORM_FEE_PERCENT: z.coerce.number().min(0).max(30).default(0),
  RANKING_MIN_SALE_CENTS: z.coerce.number().int().min(0).default(10000),

  WHATSAPP_PROVIDER_API_KEY: z.string().default(""),

  NEXT_PUBLIC_APP_URL: z.string().default("http://localhost:3000"),
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
});

type Env = Omit<z.infer<typeof schema>, "AUTH_MODE"> & { AUTH_MODE: "demo" | "public" };

let cached: Env | null = null;

export function env(): Env {
  if (cached) return cached;
  // Strings vazias no .env contam como "não definido" para os defaults funcionarem.
  const raw: Record<string, string | undefined> = Object.fromEntries(
    Object.entries(process.env).filter(([, v]) => v !== undefined && v !== ""),
  );
  // Integrações de banco (Neon/Supabase pela Vercel, Vercel Postgres) nem sempre criam
  // "DATABASE_URL" com esse nome exato — aceita as variações mais comuns, pooled primeiro
  // (é a que o app usa em runtime; a direta fica para prisma.config.ts e lib/realtime.ts).
  raw.DATABASE_URL ||= process.env.POSTGRES_PRISMA_URL || process.env.POSTGRES_URL || process.env.DATABASE_URL_UNPOOLED || process.env.POSTGRES_URL_NON_POOLING;
  const parsed = schema.safeParse(raw);
  if (!parsed.success) {
    const issues = parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; ");
    throw new Error(`Variáveis de ambiente inválidas — ${issues}`);
  }
  if (parsed.data.NODE_ENV === "production" && parsed.data.AUTH_SECRET.length < 32) {
    throw new Error("AUTH_SECRET precisa ter pelo menos 32 caracteres em produção.");
  }
  const authMode = parsed.data.AUTH_MODE ?? (parsed.data.NODE_ENV === "production" ? "public" : "demo");
  cached = { ...parsed.data, AUTH_MODE: authMode };
  return cached;
}

export const isDemoMode = () => env().AUTH_MODE === "demo";

/** Pagamentos simulados: ligados por padrão no modo demo, desligados em produção pública. */
export const mockPaymentsEnabled = () => env().PAYMENTS_MOCK ?? isDemoMode();

/** Status público (sem segredos) das integrações — usado nas telas de Configurações e Integrações. */
export function integrationStatus() {
  const e = env();
  return {
    dataProvider: e.DATA_PROVIDER,
    googleConfigured: e.MAPS_API_KEY.length > 0,
    aiProvider: e.AI_PROVIDER,
    aiConfigured: e.AI_PROVIDER !== "none" && e.AI_API_KEY.length > 0,
    aiModel: e.AI_MODEL || null,
    authMode: e.AUTH_MODE,
    googleLogin: Boolean(e.AUTH_GOOGLE_ID && e.AUTH_GOOGLE_SECRET),
    emailSender: e.RESEND_API_KEY ? "resend" : null,
    smsSender: e.TWILIO_ACCOUNT_SID && e.TWILIO_AUTH_TOKEN && e.TWILIO_FROM ? "twilio" : null,
    moderation: e.MODERATION_PROVIDER,
    mercadopago: Boolean(e.MP_CLIENT_ID && e.MP_CLIENT_SECRET),
    stripe: Boolean(e.STRIPE_SECRET_KEY),
    mockPayments: mockPaymentsEnabled(),
  };
}
