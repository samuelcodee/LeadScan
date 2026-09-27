/**
 * Varredura em grade (quadtree) — como cobrir uma cidade inteira numa fonte que devolve no
 * máximo N resultados por consulta (Google: 60).
 *
 * A cidade é um retângulo (viewport). Cada consulta pega um quadrante; se ele vier cheio
 * (tem mais do que a fonte devolve), é dividido em 4 e os filhos entram na fila. Bairro
 * denso vira quadrantes pequenos; zona rural fica num quadrante grande só.
 *
 * O cursor é uma PILHA (busca em profundidade), não uma fila: guarda no máximo ~3 quadrantes
 * por nível, então cabe numa linha do banco mesmo em São Paulo.
 * Caminho do quadrante: "" = cidade inteira; cada dígito escolhe um filho (0=SO 1=SE 2=NO 3=NE).
 */
export type Rect = { s: number; w: number; n: number; e: number };

export type GridCursor = {
  /** Viewport da cidade (raiz da grade) */
  v: Rect;
  /** Quadrantes a visitar; o topo é o último */
  stack: string[];
};

export function cellRect(root: Rect, path: string): Rect {
  let r = root;
  for (const ch of path) {
    const q = Number(ch);
    const midLat = (r.s + r.n) / 2;
    const midLng = (r.w + r.e) / 2;
    r = {
      s: q >= 2 ? midLat : r.s,
      n: q >= 2 ? r.n : midLat,
      w: q % 2 === 1 ? midLng : r.w,
      e: q % 2 === 1 ? r.e : midLng,
    };
  }
  return r;
}

export function startGrid(v: Rect): GridCursor {
  return { v, stack: [""] };
}

/** Quadrante da vez (topo da pilha). */
export function currentCell(c: GridCursor) {
  return c.stack[c.stack.length - 1] ?? null;
}

/**
 * Cursor depois de visitar o quadrante do topo. Cheio e ainda dá para dividir → os 4 filhos
 * entram (o "0" sai primeiro). Pilha vazia = cidade inteira coberta (null).
 */
export function advanceGrid(c: GridCursor, saturated: boolean, maxDepth: number): GridCursor | null {
  const path = currentCell(c);
  if (path === null) return null;
  const stack = c.stack.slice(0, -1);
  if (saturated && path.length < maxDepth) stack.push(`${path}3`, `${path}2`, `${path}1`, `${path}0`);
  return stack.length ? { v: c.v, stack } : null;
}

export function isGridCursor(x: unknown): x is GridCursor {
  if (!x || typeof x !== "object") return false;
  const c = x as GridCursor;
  return Array.isArray(c.stack) && !!c.v && ["s", "w", "n", "e"].every((k) => typeof c.v[k as keyof Rect] === "number");
}
