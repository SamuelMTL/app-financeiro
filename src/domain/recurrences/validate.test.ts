import { describe, expect, it } from 'vitest';
import { validateRecurrence, type RecurrenceInput } from './validate';

const base: RecurrenceInput = {
  kind: 'expense',
  description: 'Aluguel',
  amountCents: 150000,
  dayOfMonth: 5,
  accountId: 1,
  categoryId: 2,
  startsOn: '2025-01-01',
  endsOn: null,
};

describe('validateRecurrence', () => {
  it('aceita uma recorrência válida', () => {
    expect(validateRecurrence(base)).toEqual([]);
  });

  it('exige descrição', () => {
    expect(validateRecurrence({ ...base, description: ' ' })).toContain('Descrição é obrigatória.');
  });

  it('exige valor positivo', () => {
    expect(validateRecurrence({ ...base, amountCents: 0 })).toContain('Valor precisa ser maior que zero.');
  });

  it('exige dia do mês entre 1 e 31', () => {
    expect(validateRecurrence({ ...base, dayOfMonth: 0 })).toContain('Dia do mês precisa estar entre 1 e 31.');
    expect(validateRecurrence({ ...base, dayOfMonth: 32 })).toContain('Dia do mês precisa estar entre 1 e 31.');
  });

  it('exige data de início válida', () => {
    expect(validateRecurrence({ ...base, startsOn: '01/01/2025' })).toContain('Data de início inválida.');
  });

  it('aceita data de fim válida e posterior ao início', () => {
    expect(validateRecurrence({ ...base, endsOn: '2025-12-31' })).toEqual([]);
  });

  it('rejeita data de fim anterior ao início', () => {
    expect(validateRecurrence({ ...base, startsOn: '2025-06-01', endsOn: '2025-01-01' })).toContain(
      'Data de fim não pode ser antes da data de início.',
    );
  });
});
