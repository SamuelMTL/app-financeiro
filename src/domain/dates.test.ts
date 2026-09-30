import { describe, expect, it } from 'vitest';
import { currentMonth, isValidISODate, isValidMonth, todayISO, toMonth } from './dates';

describe('todayISO', () => {
  it('devolve uma data no formato YYYY-MM-DD', () => {
    expect(todayISO()).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });
});

describe('currentMonth', () => {
  it('devolve o mês de hoje no formato YYYY-MM', () => {
    expect(currentMonth()).toMatch(/^\d{4}-\d{2}$/);
    expect(currentMonth()).toBe(todayISO().slice(0, 7));
  });
});

describe('toMonth', () => {
  it('extrai o mês de uma data ISO', () => {
    expect(toMonth('2025-10-12')).toBe('2025-10');
  });

  it('rejeita data inválida', () => {
    expect(() => toMonth('12/10/2025')).toThrow();
  });
});

describe('isValidISODate', () => {
  it('aceita datas válidas', () => {
    expect(isValidISODate('2025-10-12')).toBe(true);
    expect(isValidISODate('2024-02-29')).toBe(true); // ano bissexto
  });

  it('rejeita datas inválidas', () => {
    expect(isValidISODate('2025-13-01')).toBe(false); // mês inexistente
    expect(isValidISODate('2025-02-30')).toBe(false); // dia inexistente
    expect(isValidISODate('2025-1-1')).toBe(false); // formato errado
    expect(isValidISODate('12/10/2025')).toBe(false);
    expect(isValidISODate('')).toBe(false);
  });
});

describe('isValidMonth', () => {
  it('aceita meses válidos', () => {
    expect(isValidMonth('2025-01')).toBe(true);
    expect(isValidMonth('2025-12')).toBe(true);
  });

  it('rejeita meses inválidos', () => {
    expect(isValidMonth('2025-00')).toBe(false);
    expect(isValidMonth('2025-13')).toBe(false);
    expect(isValidMonth('2025-1')).toBe(false);
  });
});
