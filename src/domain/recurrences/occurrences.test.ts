import { describe, expect, it } from 'vitest';
import { isRecurrenceActiveInMonth, occurrenceDate } from './occurrences';

const monthly = { dayOfMonth: 5, startsOn: '2025-01-01', endsOn: null };

describe('occurrenceDate', () => {
  it('monta a data do mês com o dia da recorrência', () => {
    expect(occurrenceDate(monthly, '2025-03')).toBe('2025-03-05');
  });

  it('ajusta o dia em meses mais curtos', () => {
    expect(occurrenceDate({ ...monthly, dayOfMonth: 31 }, '2025-04')).toBe('2025-04-30');
  });
});

describe('isRecurrenceActiveInMonth', () => {
  it('está ativa em meses depois do início, sem data de fim', () => {
    expect(isRecurrenceActiveInMonth(monthly, '2025-06')).toBe(true);
  });

  it('não está ativa antes do início', () => {
    expect(isRecurrenceActiveInMonth({ ...monthly, startsOn: '2025-06-01' }, '2025-03')).toBe(false);
  });

  it('está ativa no mês exato do início', () => {
    expect(isRecurrenceActiveInMonth({ ...monthly, startsOn: '2025-01-05' }, '2025-01')).toBe(true);
  });

  it('não está ativa depois do fim', () => {
    const ended = { ...monthly, endsOn: '2025-06-30' };
    expect(isRecurrenceActiveInMonth(ended, '2025-07')).toBe(false);
    expect(isRecurrenceActiveInMonth(ended, '2025-06')).toBe(true);
  });
});
