import "server-only";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@/lib/generated/prisma/client";
import { env } from "@/lib/env";

// Uma instância por processo (evita estourar conexões com o hot-reload do dev server).
const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

function createClient() {
  const url = env().DATABASE_URL;
  // O Postgres embutido do `prisma dev` (PGlite) atende UMA conexão ativa por vez: com mais,
  // conexões simultâneas levam reset. Em dev as consultas entram em fila.
  const isLocalDev = /localhost:5121\d/.test(url);
  // Serverless (Vercel): muitas instâncias pequenas → poucas conexões cada, e use a URL com
  // pooler do provedor (Neon/Supabase) em DATABASE_URL. Servidor único: pool maior.
  const serverless = !!process.env.VERCEL;
  const max = isLocalDev ? 1 : Number(process.env.DB_POOL_MAX) || (serverless ? 5 : 10);
  const adapter = new PrismaPg({
    connectionString: url,
    max,
    idleTimeoutMillis: serverless ? 10_000 : 30_000,
    connectionTimeoutMillis: 10_000,
  });
  return new PrismaClient({
    adapter,
    log: env().NODE_ENV === "development" ? ["warn", "error"] : ["error"],
  });
}

// Global também em produção: o bundler pode duplicar este módulo entre camadas (RSC, actions,
// rotas) e cada cópia abriria o próprio pool.
export const db = (globalForPrisma.prisma ??= createClient());
