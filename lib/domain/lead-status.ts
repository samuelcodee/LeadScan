import type { LeadStatus } from "@/lib/generated/prisma/enums";

export type StatusMeta = { label: string; column: string; dot: string; description: string };

/** Etapas do CRM, na ordem do funil. `dot` usa cores da paleta (sem roxo dominante). */
export const STATUS_META: Record<LeadStatus, StatusMeta> = {
  NEW: { label: "Novo", column: "Novos", dot: "bg-slate-400", description: "Encontrado, ainda não avaliado" },
  INTERESTING: { label: "Interessante", column: "Interessantes", dot: "bg-sky-500", description: "Vale abordar" },
  CONTACTED: { label: "Contatado", column: "Contatados", dot: "bg-blue-600", description: "Primeira mensagem enviada" },
  REPLIED: { label: "Respondeu", column: "Responderam", dot: "bg-teal-500", description: "Houve resposta" },
  NEGOTIATION: { label: "Negociação", column: "Negociação", dot: "bg-amber-500", description: "Conversando sobre o projeto" },
  PROPOSAL: { label: "Proposta", column: "Proposta", dot: "bg-orange-500", description: "Proposta enviada" },
  WON: { label: "Fechado", column: "Fechados", dot: "bg-emerald-600", description: "Cliente fechado" },
  NOT_INTERESTED: { label: "Não interessado", column: "Não interessados", dot: "bg-zinc-400", description: "Recusou por agora" },
  LOST: { label: "Perdido", column: "Perdidos", dot: "bg-red-500", description: "Negócio perdido" },
};

export const STATUS_ORDER: LeadStatus[] = [
  "NEW",
  "INTERESTING",
  "CONTACTED",
  "REPLIED",
  "NEGOTIATION",
  "PROPOSAL",
  "WON",
  "NOT_INTERESTED",
  "LOST",
];

/** Colunas visíveis do kanban (as de saída ficam recolhidas no fim). */
export const PIPELINE_COLUMNS: LeadStatus[] = ["NEW", "INTERESTING", "CONTACTED", "REPLIED", "NEGOTIATION", "PROPOSAL", "WON"];
export const CLOSED_LOST: LeadStatus[] = ["NOT_INTERESTED", "LOST"];
export const OPEN_STAGES: LeadStatus[] = ["INTERESTING", "CONTACTED", "REPLIED", "NEGOTIATION", "PROPOSAL"];
