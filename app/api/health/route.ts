import { db } from "@/lib/db";

export async function GET() {
  try {
    await db.$queryRaw`SELECT 1`;
    // versão publicada (commit) para conferir se um deploy já entrou no ar
    return Response.json({ ok: true, db: "up", version: process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 7) ?? "local" });
  } catch {
    return Response.json({ ok: false, db: "down" }, { status: 503 });
  }
}
