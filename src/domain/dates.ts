/**
 * Datas em ISO (`YYYY-MM-DD`), mês como `YYYY-MM`. Fuso: America/Sao_Paulo.
 * Ver docs/CLAUDE.md, "Princípios inegociáveis".
 */

const TIME_ZONE = 'America/Sao_Paulo';

// en-CA formata datas como YYYY-MM-DD nativamente — evita puxar uma lib de fuso
// horário só para pegar "que dia é hoje em São Paulo".
const ISO_DATE_FORMATTER = new Intl.DateTimeFormat('en-CA', {
  timeZone: TIME_ZONE,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
});

const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const MONTH_RE = /^\d{4}-\d{2}$/;

/** Data de hoje em America/Sao_Paulo, como `YYYY-MM-DD`. */
export function todayISO(): string {
  return ISO_DATE_FORMATTER.format(new Date());
}

/** Mês de hoje em America/Sao_Paulo, como `YYYY-MM`. */
export function currentMonth(): string {
  return toMonth(todayISO());
}

/** `"2025-10-12"` -> `"2025-10"` */
export function toMonth(dateISO: string): string {
  if (!isValidISODate(dateISO)) {
    throw new Error(`Data ISO inválida: "${dateISO}"`);
  }
  return dateISO.slice(0, 7);
}

export function isValidISODate(value: string): boolean {
  if (!ISO_DATE_RE.test(value)) return false;
  const [year, month, day] = value.split('-').map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  return (
    date.getUTCFullYear() === year &&
    date.getUTCMonth() === month - 1 &&
    date.getUTCDate() === day
  );
}

export function isValidMonth(value: string): boolean {
  if (!MONTH_RE.test(value)) return false;
  const month = Number(value.slice(5, 7));
  return month >= 1 && month <= 12;
}

/** `"2025-10"` -> 31. Usa UTC só para aritmética de calendário, sem relação com fuso. */
export function daysInMonth(month: string): number {
  if (!isValidMonth(month)) {
    throw new Error(`Mês inválido: "${month}"`);
  }
  const [year, mm] = month.split('-').map(Number);
  return new Date(Date.UTC(year, mm, 0)).getUTCDate();
}

/** `"2025-10"` + 1 -> `"2025-11"`; aceita deltas negativos. */
export function addMonths(month: string, delta: number): string {
  if (!isValidMonth(month)) {
    throw new Error(`Mês inválido: "${month}"`);
  }
  const [year, mm] = month.split('-').map(Number);
  const total = year * 12 + (mm - 1) + delta;
  const newYear = Math.floor(total / 12);
  const newMonth = (total % 12) + 1;
  return `${String(newYear).padStart(4, '0')}-${String(newMonth).padStart(2, '0')}`;
}

/**
 * Monta uma data ISO para `day` dentro de `month`, ajustando para o último dia
 * do mês quando `day` não existe nele (ex.: dia 31 em abril -> 30/04). Usada por
 * parcelas e recorrências.
 */
export function dateInMonth(month: string, day: number): string {
  const clampedDay = Math.min(day, daysInMonth(month));
  return `${month}-${String(clampedDay).padStart(2, '0')}`;
}
