import { fold } from "@/lib/format";

/**
 * Chave de "mesma empresa": nome + cidade + UF sem acento, caixa ou pontuação.
 * Evita que a mesma empresa volte em outra busca (ou por outra fonte de dados).
 */
export function leadDedupeKey(name: string, city: string, state: string) {
  const norm = (x: string) => fold(x).replace(/[^a-z0-9]+/g, " ").trim();
  return `${norm(name)}|${norm(city)}|${state.toUpperCase()}`;
}
