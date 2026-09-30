import { isValidISODate } from '../dates';
import { formatCents } from '../money';

export interface RefundInput {
  originalTransactionId: number;
  amountCents: number;
  purchasedOn: string;
  notes: string | null;
}

export function validateRefund(input: RefundInput): string[] {
  const errors: string[] = [];

  if (!Number.isInteger(input.originalTransactionId) || input.originalTransactionId <= 0) {
    errors.push('Lançamento original é obrigatório.');
  }
  if (!Number.isInteger(input.amountCents) || input.amountCents <= 0) {
    errors.push('Valor precisa ser maior que zero.');
  }
  if (!isValidISODate(input.purchasedOn)) {
    errors.push('Data inválida.');
  }

  return errors;
}

/**
 * "A soma dos estornos ≤ valor do gasto" (US-06, docs/business-rules.md). Pura —
 * quem soma os estornos já lançados é o IPC, que tem acesso ao banco.
 */
export function validateRefundAmount(
  originalAmountCents: number,
  existingRefundsCents: number,
  newRefundCents: number,
): string[] {
  if (existingRefundsCents + newRefundCents > originalAmountCents) {
    const remaining = originalAmountCents - existingRefundsCents;
    return [`Estorno passaria do valor do gasto original. Ainda pode estornar até ${formatCents(remaining)}.`];
  }
  return [];
}
