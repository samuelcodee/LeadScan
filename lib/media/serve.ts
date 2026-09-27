import "server-only";
import { db } from "@/lib/db";

/**
 * Entrega de mídia guardada no banco com suporte a Range (206) — o Safari não toca vídeo/áudio
 * sem isso, e o player pula para qualquer ponto sem baixar tudo. O banco devolve só o pedaço
 * pedido (substring no bytea): um vídeo grande não é lido inteiro a cada requisição. Pedaços de
 * até 3 MB (a Vercel limita a resposta comum a 4,5 MB); sem Range, sai em streaming, fatia por fatia.
 * Quem chama já conferiu a permissão (membro da conversa, dono do arquivo…).
 */
const SLICE = 3 * 1024 * 1024;

async function readSlice(id: string, start: number, length: number) {
  const rows = await db.$queryRaw<{ chunk: Uint8Array }[]>`SELECT substring("data" from ${start + 1}::int for ${length}::int) AS chunk FROM "Media" WHERE "id" = ${id}`;
  return rows[0]?.chunk ? Buffer.from(rows[0].chunk) : Buffer.alloc(0);
}

export async function serveMedia(request: Request, media: { id: string; mime: string; size: number }, opts: { download?: string | null } = {}) {
  const { id, size } = media;
  const base = {
    "Content-Type": media.mime,
    "Accept-Ranges": "bytes",
    "Cache-Control": "private, max-age=31536000, immutable",
    "X-Content-Type-Options": "nosniff",
    "Content-Disposition": opts.download ? `attachment; filename*=UTF-8''${encodeURIComponent(opts.download)}` : "inline",
  };
  const range = request.headers.get("range")?.match(/^bytes=(\d*)-(\d*)$/);
  if (range) {
    let start = range[1] ? Number(range[1]) : NaN;
    let end = range[2] ? Number(range[2]) : size - 1;
    if (Number.isNaN(start)) {
      start = Math.max(0, size - end);
      end = size - 1;
    }
    end = Math.min(end, size - 1, start + SLICE - 1);
    if (start > end || start >= size) return new Response(null, { status: 416, headers: { ...base, "Content-Range": `bytes */${size}` } });
    const chunk = await readSlice(id, start, end - start + 1);
    return new Response(new Uint8Array(chunk), {
      status: 206,
      headers: { ...base, "Content-Range": `bytes ${start}-${end}/${size}`, "Content-Length": String(chunk.byteLength) },
    });
  }

  // Arquivo pequeno (foto, capa, áudio curto): de uma vez
  if (size <= SLICE) {
    const all = await readSlice(id, 0, size);
    return new Response(new Uint8Array(all), { headers: { ...base, "Content-Length": String(all.byteLength) } });
  }
  // Grande sem Range (ex.: baixar o vídeo): streaming em fatias
  let offset = 0;
  const stream = new ReadableStream<Uint8Array>({
    async pull(controller) {
      if (offset >= size) return controller.close();
      const chunk = await readSlice(id, offset, Math.min(SLICE, size - offset));
      if (!chunk.byteLength) return controller.close();
      offset += chunk.byteLength;
      controller.enqueue(new Uint8Array(chunk));
    },
  });
  return new Response(stream, { headers: { ...base, "Content-Length": String(size) } });
}
