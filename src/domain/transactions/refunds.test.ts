import { describe, expect, it } from 'vitest';
import { validateRefund, validateRefundAmount, type RefundInput } from './refunds';

const base: RefundInput = {
  originalTransactionId: 1,
  amountCents: 5000,
  purchasedOn: '2025-10-15',
  notes: null,
};

describe('validateRefund', () => {
  it('aceita um estorno válido', () => {
    expect(validateRefund(base)).toEqual([]);
  });

  it('exige o lançamento original', () => {
    expect(validateRefund({ ...base, originalTransactionId: 0 })).toContain(
      'Lançamento original é obrigatório.',
    );
  });

  it('exige valor positivo', () => {
    expect(validateRefund({ ...base, amountCents: 0 })).toContain('Valor precisa ser maior que zero.');
  });

  it('exige data válida', () => {
    expect(validateRefund({ ...base, purchasedOn: '15/10/2025' })).toContain('Data inválida.');
  });
});

describe('validateRefundAmount', () => {
  it('aceita estorno dentro do valor do gasto', () => {
    expect(validateRefundAmount(10000, 0, 5000)).toEqual([]);
  });

  it('aceita estorno que fecha exatamente o valor do gasto', () => {
    expect(validateRefundAmount(10000, 3000, 7000)).toEqual([]);
  });

  it('rejeita estorno que passa do valor do gasto', () => {
    const errors = validateRefundAmount(10000, 0, 10001);
    expect(errors).toHaveLength(1);
    expect(errors[0]).toMatch(/passaria do valor/);
  });

  it('rejeita quando já há estornos e o novo passaria do total', () => {
    const errors = validateRefundAmount(10000, 8000, 3000);
    expect(errors[0]).toContain('R$ 20,00'); // 10000 - 8000 = 2000 centavos restantes
  });
});
