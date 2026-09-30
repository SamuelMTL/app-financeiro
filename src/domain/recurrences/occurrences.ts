import { dateInMonth } from '../dates';

interface RecurrenceLike {
  dayOfMonth: number;
  startsOn: string;
  endsOn: string | null;
}

/** Data do lançamento da recorrência num mês específico (dia ajustado, ver dateInMonth). */
export function occurrenceDate(recurrence: RecurrenceLike, month: string): string {
  return dateInMonth(month, recurrence.dayOfMonth);
}

/**
 * Se a recorrência deve gerar um lançamento nesse mês: a data calculada cai
 * dentro de `[startsOn, endsOn]` (endsOn null = sem fim). Ver docs/business-rules.md,
 * "Recorrências".
 */
export function isRecurrenceActiveInMonth(recurrence: RecurrenceLike, month: string): boolean {
  const date = occurrenceDate(recurrence, month);
  if (date < recurrence.startsOn) return false;
  if (recurrence.endsOn !== null && date > recurrence.endsOn) return false;
  return true;
}
