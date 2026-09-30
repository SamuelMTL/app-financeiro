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
