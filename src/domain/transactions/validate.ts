import { isValidISODate } from '../dates';

/**
 * Fase 1 só cria/edita `expense` e `income`. `transfer`, `card_payment` e `refund`
 * têm fluxo próprio e chegam na Fase 2 (US-05, US-06) — ver docs/roadmap.md.
 */
export type SimpleTransactionKind = 'expense' | 'income';

export interface TransactionInput {
  kind: SimpleTransactionKind;
  accountId: number;
  categoryId: number | null;
  amountCents: number;
  purchasedOn: string;
  description: string;
  notes: string | null;
  tags: string[];
}

const SIMPLE_KINDS: SimpleTransactionKind[] = ['expense', 'income'];

/** Devolve a lista de erros; vazio = válido. Regras de US-01/US-07/US-08. */
export function validateTransaction(input: TransactionInput): string[] {
  const errors: string[] = [];

  if (!SIMPLE_KINDS.includes(input.kind)) {
    errors.push('Tipo de lançamento inválido.');
  }
  if (!Number.isInteger(input.accountId) || input.accountId <= 0) {
    errors.push('Conta ou cartão é obrigatório.');
  }
  if (!Number.isInteger(input.amountCents) || input.amountCents <= 0) {
    errors.push('Valor precisa ser maior que zero.');
  }
  if (!isValidISODate(input.purchasedOn)) {
    errors.push('Data inválida.');
  }
  if (input.description.trim() === '') {
    errors.push('Descrição é obrigatória.');
  }
  if (input.tags.some((tag) => tag.trim() === '')) {
    errors.push('Tag vazia não é permitida.');
  }

  return errors;
}
