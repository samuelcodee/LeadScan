import { decryptSecret, encryptSecret } from "@/lib/crypto/secrets";
import { db } from "@/lib/db";

export async function GET() {
  try {
    await db.$queryRaw`SELECT 1`;
    // versão publicada (commit) para conferir se um deploy já entrou no ar
    // criptografia de segredos (tokens de pagamento, contas bancárias) funcionando? sem revelar nada
    let secrets = "ok";
    try {
      if (decryptSecret(encryptSecret("ping")) !== "ping") secrets = "falhou";
    } catch {
      secrets = "falhou";
    }
    return Response.json({ ok: true, db: "up", secrets, version: process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 7) ?? "local" });
  } catch {
    return Response.json({ ok: false, db: "down" }, { status: 503 });
  }
}
