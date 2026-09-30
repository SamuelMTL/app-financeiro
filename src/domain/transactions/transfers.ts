import { isValidISODate } from '../dates';

/**
 * Transferência entre contas e pagamento de fatura (US-05): não contam como
 * gasto/renda, então ficam fora do `validateTransaction` de Fase 1 — têm sua
 * própria validação, mais simples (sem categoria obrigatória, sem tipo `expense`/
 * `income`).
 */
export interface TransferInput {
  /** Conta de origem (de onde o dinheiro sai). */
  accountId: number;
  /** Conta de destino. Em pagamento de fatura, é o cartão sendo quitado. */
  destAccountId: number;
  amountCents: number;
  purchasedOn: string;
  description: string;
  notes: string | null;
}

export function validateTransfer(input: TransferInput): string[] {
  const errors: string[] = [];

  if (!Number.isInteger(input.accountId) || input.accountId <= 0) {
    errors.push('Conta de origem é obrigatória.');
  }
  if (!Number.isInteger(input.destAccountId) || input.destAccountId <= 0) {
    errors.push('Conta de destino é obrigatória.');
  }
  if (
    Number.isInteger(input.accountId) &&
    Number.isInteger(input.destAccountId) &&
    input.accountId === input.destAccountId
  ) {
    errors.push('Origem e destino precisam ser contas diferentes.');
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

  return errors;
}
