import { describe, expect, it } from 'vitest';
import { validateTransfer, type TransferInput } from './transfers';

const base: TransferInput = {
  accountId: 1,
  destAccountId: 2,
  amountCents: 10000,
  purchasedOn: '2025-10-12',
  description: 'Reserva de emergência',
  notes: null,
};

describe('validateTransfer', () => {
  it('aceita uma transferência válida', () => {
    expect(validateTransfer(base)).toEqual([]);
  });

  it('exige conta de origem e destino', () => {
    expect(validateTransfer({ ...base, accountId: 0 })).toContain('Conta de origem é obrigatória.');
    expect(validateTransfer({ ...base, destAccountId: 0 })).toContain('Conta de destino é obrigatória.');
  });

  it('rejeita origem igual ao destino', () => {
    expect(validateTransfer({ ...base, destAccountId: base.accountId })).toContain(
      'Origem e destino precisam ser contas diferentes.',
    );
  });

  it('exige valor positivo', () => {
    expect(validateTransfer({ ...base, amountCents: 0 })).toContain('Valor precisa ser maior que zero.');
  });

  it('exige data válida', () => {
    expect(validateTransfer({ ...base, purchasedOn: '12/10/2025' })).toContain('Data inválida.');
  });

  it('exige descrição', () => {
    expect(validateTransfer({ ...base, description: '  ' })).toContain('Descrição é obrigatória.');
  });
});
