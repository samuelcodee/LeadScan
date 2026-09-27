"use client";

/**
 * Envio com progresso (XHR: fetch ainda não informa o progresso do upload) e em partes para
 * arquivos grandes — a Vercel recusa corpo acima de 4,5 MB por requisição.
 */
export const PART_BYTES = 3.5 * 1024 * 1024;

function send<T>(url: string, body: Blob | FormData, onProgress: (loaded: number, total: number) => void, headers: Record<string, string> = {}) {
  return new Promise<T>((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("POST", url);
    for (const [k, v] of Object.entries(headers)) xhr.setRequestHeader(k, v);
    xhr.upload.onprogress = (e) => e.lengthComputable && onProgress(e.loaded, e.total);
    xhr.onload = () => {
      let j: (T & { error?: string }) | null = null;
      try {
        j = JSON.parse(xhr.responseText);
      } catch {
        // resposta sem JSON
      }
      if (xhr.status < 300 && j && !j.error) resolve(j);
      else reject(new Error(j?.error ?? "Não deu para enviar. Tente de novo."));
    };
    xhr.onerror = () => reject(new Error("Sem conexão. Tente de novo."));
    xhr.send(body);
  });
}

export function postForm<T>(url: string, form: FormData, onProgress: (p: number) => void) {
  return send<T>(url, form, (loaded, total) => onProgress(loaded / total));
}

/** Manda o arquivo em partes; devolve o id do envio para fechar depois. Progresso vai de 0 a 0,95. */
export async function uploadInParts(baseUrl: string, file: Blob, onProgress: (p: number) => void) {
  let upload: string | null = null;
  for (let offset = 0; offset < file.size; offset += PART_BYTES) {
    const part = file.slice(offset, offset + PART_BYTES);
    const sep = baseUrl.includes("?") ? "&" : "?";
    const q = upload ? `upload=${upload}` : `total=${file.size}`;
    const r: { upload: string } = await send(`${baseUrl}${sep}${q}`, part, (loaded) => onProgress(((offset + loaded) / file.size) * 0.95), {
      "Content-Type": "application/octet-stream",
    });
    upload = r.upload;
  }
  return upload!;
}
