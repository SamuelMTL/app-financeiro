import type { AccountKind } from '../types';

export interface AccountInput {
  name: string;
  kind: AccountKind;
  openingBalanceCents: number;
  creditLimitCents: number | null;
  closingDay: number | null;
  dueDay: number | null;
}

/** Devolve a lista de erros; vazio = válido. Regras de US-04 (docs/user-stories.md). */
export function validateAccount(input: AccountInput): string[] {
  const errors: string[] = [];

  if (input.name.trim() === '') {
    errors.push('Nome é obrigatório.');
  }

  if (!Number.isInteger(input.openingBalanceCents)) {
    errors.push('Saldo inicial deve ser um valor em centavos (inteiro).');
  }

  const isCard = input.kind === 'credit_card';

  if (isCard) {
    if (input.creditLimitCents === null || input.creditLimitCents <= 0) {
      errors.push('Cartão precisa de um limite maior que zero.');
    }
    if (!isValidDayOfMonth(input.closingDay)) {
      errors.push('Dia de fechamento precisa estar entre 1 e 31.');
    }
    if (!isValidDayOfMonth(input.dueDay)) {
      errors.push('Dia de vencimento precisa estar entre 1 e 31.');
    }
  } else {
    if (input.creditLimitCents !== null) {
      errors.push('Só cartão de crédito tem limite.');
    }
    if (input.closingDay !== null || input.dueDay !== null) {
      errors.push('Só cartão de crédito tem dia de fechamento/vencimento.');
    }
  }

  return errors;
}

function isValidDayOfMonth(value: number | null): boolean {
  return value !== null && Number.isInteger(value) && value >= 1 && value <= 31;
}
