import { isValidISODate } from '../dates';

export interface RecurrenceInput {
  kind: 'expense' | 'income';
  description: string;
  amountCents: number;
  dayOfMonth: number;
  accountId: number;
  categoryId: number | null;
  startsOn: string;
  endsOn: string | null;
}

/** Devolve a lista de erros; vazio = válido. Regras de US-03. */
export function validateRecurrence(input: RecurrenceInput): string[] {
  const errors: string[] = [];

  if (input.description.trim() === '') {
    errors.push('Descrição é obrigatória.');
  }
  if (!Number.isInteger(input.amountCents) || input.amountCents <= 0) {
    errors.push('Valor precisa ser maior que zero.');
  }
  if (!Number.isInteger(input.dayOfMonth) || input.dayOfMonth < 1 || input.dayOfMonth > 31) {
    errors.push('Dia do mês precisa estar entre 1 e 31.');
  }
  if (!Number.isInteger(input.accountId) || input.accountId <= 0) {
    errors.push('Conta ou cartão é obrigatório.');
  }
  if (!isValidISODate(input.startsOn)) {
    errors.push('Data de início inválida.');
  }
  if (input.endsOn !== null) {
    if (!isValidISODate(input.endsOn)) {
      errors.push('Data de fim inválida.');
    } else if (isValidISODate(input.startsOn) && input.endsOn < input.startsOn) {
      errors.push('Data de fim não pode ser antes da data de início.');
    }
  }

  return errors;
}
