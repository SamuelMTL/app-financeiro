import { describe, expect, it } from 'vitest';
import { validateTransaction, type TransactionInput } from './validate';

const base: TransactionInput = {
  kind: 'expense',
  accountId: 1,
  categoryId: 2,
  amountCents: 1500,
  purchasedOn: '2025-10-12',
  description: 'Mercado',
  notes: null,
  tags: [],
};

describe('validateTransaction', () => {
  it('aceita um gasto válido', () => {
    expect(validateTransaction(base)).toEqual([]);
  });

  it('aceita uma renda válida', () => {
    expect(validateTransaction({ ...base, kind: 'income' })).toEqual([]);
  });

  it('rejeita tipo fora do escopo da Fase 1', () => {
    // @ts-expect-error testando entrada inválida de propósito
    const errors = validateTransaction({ ...base, kind: 'transfer' });
    expect(errors).toContain('Tipo de lançamento inválido.');
  });

  it('exige conta/cartão', () => {
    expect(validateTransaction({ ...base, accountId: 0 })).toContain(
      'Conta ou cartão é obrigatório.',
    );
  });

  it('exige valor positivo', () => {
    expect(validateTransaction({ ...base, amountCents: 0 })).toContain(
      'Valor precisa ser maior que zero.',
    );
    expect(validateTransaction({ ...base, amountCents: -100 })).toContain(
      'Valor precisa ser maior que zero.',
    );
  });

  it('exige data válida', () => {
    expect(validateTransaction({ ...base, purchasedOn: '12/10/2025' })).toContain(
      'Data inválida.',
    );
  });

  it('exige descrição', () => {
    expect(validateTransaction({ ...base, description: '  ' })).toContain(
      'Descrição é obrigatória.',
    );
  });

  it('rejeita tag vazia', () => {
    expect(validateTransaction({ ...base, tags: ['mercado', ''] })).toContain(
      'Tag vazia não é permitida.',
    );
  });

  it('aceita categoria nula', () => {
    expect(validateTransaction({ ...base, categoryId: null })).toEqual([]);
  });
});
