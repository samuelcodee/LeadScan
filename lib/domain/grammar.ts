/**
 * Artigos e contrações para nomes de negócio em português:
 * "do Studio Bella", "na Clínica Vida", "Sobre o Hotel Brisa".
 * Quando o gênero não é óbvio pelo primeiro termo, omite o artigo (soa natural em PT-BR).
 */
const FEMININE =
  /^(cl[ií]nica|barbearia|academia|pizzaria|hamburgueria|confeitaria|doceria|pousada|imobili[aá]ria|advocacia|contabilidade|oficina|mec[aâ]nica|escola|loja|casa|cantina|sociedade|assessoria|cozinha|padaria|odonto|est[eé]tica|dra\.?|doutora)\b/i;
const MASCULINE =
  /^(studio|est[uú]dio|espa[cç]o|instituto|ateli[eê]|restaurante|bistr[oô]|hotel|hostel|box|centro|consult[oó]rio|escrit[oó]rio|auto center|pet shop|emp[oó]rio|grupo|sal[aã]o|residencial|barber|dr\.?|doutor)\b/i;

export type Articles = { o: string; de: string; em: string; O: string; Em: string };

export function articles(name: string): Articles {
  const n = name.trim();
  const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
  let r: Omit<Articles, "O" | "Em">;
  if (MASCULINE.test(n)) r = { o: `o ${n}`, de: `do ${n}`, em: `no ${n}` };
  else if (FEMININE.test(n)) r = { o: `a ${n}`, de: `da ${n}`, em: `na ${n}` };
  else r = { o: n, de: `de ${n}`, em: `em ${n}` };
  return { ...r, O: cap(r.o), Em: cap(r.em) };
}
