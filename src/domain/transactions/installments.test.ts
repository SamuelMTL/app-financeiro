import { describe, expect, it } from 'vitest';
import {
  installmentStatementMonth,
  previewInstallments,
  splitInstallments,
} from './installments';

describe('splitInstallments', () => {
  it('divide igualmente quando o total é múltiplo de n', () => {
    expect(splitInstallments(1000, 5)).toEqual([200, 200, 200, 200, 200]);
  });

  it('joga o resto de centavos na primeira parcela', () => {
    // 1000 / 3 = 333,33... -> 333 cada, resto 1 -> [334, 333, 333]
    expect(splitInstallments(1000, 3)).toEqual([334, 333, 333]);
  });

  it('a soma das parcelas é sempre exatamente o total', () => {
    for (const [total, n] of [
      [10000, 7],
      [15695, 3],
      [1, 3],
      [999999, 12],
    ]) {
      const parts = splitInstallments(total, n);
      expect(parts.reduce((a, b) => a + b, 0)).toBe(total);
      expect(parts).toHaveLength(n);
    }
  });

  it('uma parcela só devolve o total inteiro', () => {
    expect(splitInstallments(500, 1)).toEqual([500]);
  });

  it('rejeita total não positivo ou não inteiro', () => {
    expect(() => splitInstallments(0, 3)).toThrow();
    expect(() => splitInstallments(-100, 3)).toThrow();
    expect(() => splitInstallments(10.5, 3)).toThrow();
  });

  it('rejeita número de parcelas inválido', () => {
    expect(() => splitInstallments(1000, 0)).toThrow();
    expect(() => splitInstallments(1000, -2)).toThrow();
  });
});

describe('installmentStatementMonth', () => {
  it('compra antes do fechamento: 1ª parcela no mês corrente', () => {
    // fechamento dia 10, compra dia 05 -> fatura do mês corrente
    expect(installmentStatementMonth('2025-10-05', 1, 10)).toBe('2025-10');
  });

  it('compra depois do fechamento: 1ª parcela no mês seguinte', () => {
    // fechamento dia 10, compra dia 12 -> fatura do mês seguinte
    expect(installmentStatementMonth('2025-10-12', 1, 10)).toBe('2025-11');
  });

  it('compra no dia exato do fechamento conta como "antes" (mês corrente)', () => {
    expect(installmentStatementMonth('2025-10-10', 1, 10)).toBe('2025-10');
  });

  it('parcelas seguintes avançam mês a mês a partir da 1ª', () => {
    expect(installmentStatementMonth('2025-10-12', 2, 10)).toBe('2025-12');
    expect(installmentStatementMonth('2025-10-12', 3, 10)).toBe('2026-01');
  });

  it('sem cartão (closingDay null), a 1ª parcela fica no mês da compra', () => {
    expect(installmentStatementMonth('2025-10-28', 1, null)).toBe('2025-10');
    expect(installmentStatementMonth('2025-10-28', 2, null)).toBe('2025-11');
  });
});

describe('previewInstallments', () => {
  it('gera a prévia completa: nº, valor e mês de cada parcela', () => {
    const preview = previewInstallments('2025-10-12', 1000, 3, 10);
    expect(preview).toEqual([
      { installmentNo: 1, amountCents: 334, effectiveOn: '2025-11-12' },
      { installmentNo: 2, amountCents: 333, effectiveOn: '2025-12-12' },
      { installmentNo: 3, amountCents: 333, effectiveOn: '2026-01-12' },
    ]);
  });

  it('ajusta o dia quando o mês da parcela é mais curto', () => {
    // compra dia 31 -> parcelas em meses mais curtos caem no último dia deles
    const preview = previewInstallments('2025-01-31', 300, 3, null);
    expect(preview.map((p) => p.effectiveOn)).toEqual(['2025-01-31', '2025-02-28', '2025-03-31']);
  });
});
