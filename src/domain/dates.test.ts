import { describe, expect, it } from 'vitest';
import {
  addMonths,
  currentMonth,
  dateInMonth,
  daysInMonth,
  isValidISODate,
  isValidMonth,
  todayISO,
  toMonth,
} from './dates';

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

describe('daysInMonth', () => {
  it('conta os dias de meses normais', () => {
    expect(daysInMonth('2025-01')).toBe(31);
    expect(daysInMonth('2025-04')).toBe(30);
  });

  it('lida com fevereiro e ano bissexto', () => {
    expect(daysInMonth('2025-02')).toBe(28);
    expect(daysInMonth('2024-02')).toBe(29);
  });
});

describe('addMonths', () => {
  it('soma meses dentro do mesmo ano', () => {
    expect(addMonths('2025-01', 2)).toBe('2025-03');
  });

  it('vira o ano ao somar', () => {
    expect(addMonths('2025-11', 3)).toBe('2026-02');
  });

  it('vira o ano ao subtrair', () => {
    expect(addMonths('2025-01', -1)).toBe('2024-12');
  });

  it('aceita delta zero', () => {
    expect(addMonths('2025-06', 0)).toBe('2025-06');
  });
});

describe('dateInMonth', () => {
  it('monta a data normalmente quando o dia existe no mês', () => {
    expect(dateInMonth('2025-10', 12)).toBe('2025-10-12');
  });

  it('ajusta para o último dia quando o dia não existe no mês', () => {
    expect(dateInMonth('2025-04', 31)).toBe('2025-04-30'); // abril não tem dia 31
    expect(dateInMonth('2025-02', 31)).toBe('2025-02-28');
    expect(dateInMonth('2024-02', 31)).toBe('2024-02-29'); // bissexto
  });
});
