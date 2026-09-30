import { describe, expect, it } from 'vitest';
import { validateAccount, type AccountInput } from './validate';

const baseChecking: AccountInput = {
  name: 'Conta corrente',
  kind: 'checking',
  openingBalanceCents: 0,
  creditLimitCents: null,
  closingDay: null,
  dueDay: null,
};

describe('validateAccount', () => {
  it('aceita uma conta corrente válida', () => {
    expect(validateAccount(baseChecking)).toEqual([]);
  });

  it('exige nome', () => {
    expect(validateAccount({ ...baseChecking, name: '  ' })).toContain('Nome é obrigatório.');
  });

  it('exige limite, fechamento e vencimento para cartão', () => {
    const errors = validateAccount({ ...baseChecking, kind: 'credit_card' });
    expect(errors).toContain('Cartão precisa de um limite maior que zero.');
    expect(errors).toContain('Dia de fechamento precisa estar entre 1 e 31.');
    expect(errors).toContain('Dia de vencimento precisa estar entre 1 e 31.');
  });

  it('aceita um cartão válido', () => {
    const errors = validateAccount({
      name: 'Nubank',
      kind: 'credit_card',
      openingBalanceCents: 0,
      creditLimitCents: 500000,
      closingDay: 10,
      dueDay: 17,
    });
    expect(errors).toEqual([]);
  });

  it('rejeita dia de fechamento fora de 1-31', () => {
    const errors = validateAccount({
      name: 'Nubank',
      kind: 'credit_card',
      openingBalanceCents: 0,
      creditLimitCents: 500000,
      closingDay: 32,
      dueDay: 10,
    });
    expect(errors).toContain('Dia de fechamento precisa estar entre 1 e 31.');
  });

  it('rejeita limite/fechamento/vencimento em conta que não é cartão', () => {
    const errors = validateAccount({ ...baseChecking, creditLimitCents: 1000 });
    expect(errors).toContain('Só cartão de crédito tem limite.');
  });
});
