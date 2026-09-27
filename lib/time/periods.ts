/**
 * Períodos do ranking no fuso de Brasília (America/Sao_Paulo).
 * Semana: segunda 00:00 → domingo 23:59:59.999. Mês: dia 1 00:00 → último dia 23:59:59.999.
 *
 * O offset do fuso é calculado pelo Intl para o instante em questão, então o código
 * continua certo se o horário de verão voltar a existir.
 */
export const TZ = "America/Sao_Paulo";

const dtf = new Intl.DateTimeFormat("en-US", {
  timeZone: TZ,
  hourCycle: "h23",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
});

type Parts = { year: number; month: number; day: number; hour: number; minute: number; second: number };

function partsAt(d: Date): Parts {
  const p = Object.fromEntries(dtf.formatToParts(d).map((x) => [x.type, x.value]));
  return { year: +p.year, month: +p.month, day: +p.day, hour: +p.hour, minute: +p.minute, second: +p.second };
}

/** Offset (ms) do fuso no instante: horário local − UTC. */
function offsetAt(d: Date) {
  const p = partsAt(d);
  const asUtc = Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second);
  return asUtc - Math.floor(d.getTime() / 1000) * 1000;
}

/** Instante UTC correspondente a uma data/hora local de Brasília. */
export function zonedToUtc(year: number, month: number, day: number, hour = 0, minute = 0) {
  const guess = new Date(Date.UTC(year, month - 1, day, hour, minute));
  const first = new Date(guess.getTime() - offsetAt(guess));
  // Segunda passada corrige o raro caso de mudança de offset entre o palpite e o resultado
  return new Date(guess.getTime() - offsetAt(first));
}

export type Period = { start: Date; end: Date; key: string; label: string };

/** Número da semana ISO (para chaves estáveis como 2026-W39). */
function isoWeek(year: number, month: number, day: number) {
  const d = new Date(Date.UTC(year, month - 1, day));
  const dow = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dow);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  const week = Math.ceil(((d.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
  return { year: d.getUTCFullYear(), week };
}

const MONTHS = ["janeiro", "fevereiro", "março", "abril", "maio", "junho", "julho", "agosto", "setembro", "outubro", "novembro", "dezembro"];

function fmtDay(y: number, m: number, d: number) {
  return `${String(d).padStart(2, "0")}/${String(m).padStart(2, "0")}`;
}

/** Semana (seg–dom, Brasília) que contém `at`. `offsetWeeks` negativo = semanas anteriores. */
export function weekPeriod(at = new Date(), offsetWeeks = 0): Period {
  const p = partsAt(at);
  const local = new Date(Date.UTC(p.year, p.month - 1, p.day));
  const dow = local.getUTCDay() || 7; // 1 = segunda … 7 = domingo
  local.setUTCDate(local.getUTCDate() - (dow - 1) + offsetWeeks * 7);
  const y = local.getUTCFullYear();
  const m = local.getUTCMonth() + 1;
  const d = local.getUTCDate();
  const nextMon = new Date(local);
  nextMon.setUTCDate(nextMon.getUTCDate() + 7);
  const sun = new Date(local);
  sun.setUTCDate(sun.getUTCDate() + 6);
  const start = zonedToUtc(y, m, d);
  const end = new Date(zonedToUtc(nextMon.getUTCFullYear(), nextMon.getUTCMonth() + 1, nextMon.getUTCDate()).getTime() - 1);
  const iw = isoWeek(y, m, d);
  return {
    start,
    end,
    key: `${iw.year}-W${String(iw.week).padStart(2, "0")}`,
    label: `${fmtDay(y, m, d)} a ${fmtDay(sun.getUTCFullYear(), sun.getUTCMonth() + 1, sun.getUTCDate())}`,
  };
}

/** Mês (Brasília) que contém `at`. */
export function monthPeriod(at = new Date(), offsetMonths = 0): Period {
  const p = partsAt(at);
  const base = new Date(Date.UTC(p.year, p.month - 1 + offsetMonths, 1));
  const y = base.getUTCFullYear();
  const m = base.getUTCMonth() + 1;
  const next = new Date(Date.UTC(y, m, 1));
  return {
    start: zonedToUtc(y, m, 1),
    end: new Date(zonedToUtc(next.getUTCFullYear(), next.getUTCMonth() + 1, 1).getTime() - 1),
    key: `${y}-${String(m).padStart(2, "0")}`,
    label: `${MONTHS[m - 1]} de ${y}`,
  };
}

/** Chave do mês local de um instante (para contar meses distintos com vendas). */
export function monthKey(d: Date) {
  const p = partsAt(d);
  return `${p.year}-${String(p.month).padStart(2, "0")}`;
}

/** Últimos N dias locais (mais antigo primeiro) como AAAA-MM-DD. */
export function lastDays(n: number, now = new Date()) {
  return Array.from({ length: n }, (_, i) => dayKey(new Date(now.getTime() - (n - 1 - i) * 86400000)));
}

/** Dia local (AAAA-MM-DD) de um instante — agrupamento de gráficos. */
export function dayKey(d: Date) {
  const p = partsAt(d);
  return `${p.year}-${String(p.month).padStart(2, "0")}-${String(p.day).padStart(2, "0")}`;
}
