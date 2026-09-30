import { remainingCents, usageStatus, type UsageStatus } from './usage';

export interface CeilingWarning {
  /** A compra passa do que resta do teto. */
  exceeds: boolean;
  /** Situação do teto depois da compra. */
  statusAfter: UsageStatus;
  /** Quanto resta do teto antes da compra (negativo = já estava acima). */
  remainingBeforeCents: number;
  /** Quanto fica acima do teto depois da compra (0 se não passa). */
  overByCents: number;
}

/**
 * Aviso do formulário antes de salvar (US-17): a compra de `amountCents` estoura
 * o teto? Avisa, não bloqueia.
 */
export function ceilingWarning(input: {
  usedCents: number;
  limitCents: number;
  amountCents: number;
}): CeilingWarning {
  const { usedCents, limitCents, amountCents } = input;
  const after = usedCents + amountCents;
  return {
    exceeds: after > limitCents,
    statusAfter: usageStatus(after, limitCents),
    remainingBeforeCents: remainingCents(usedCents, limitCents),
    overByCents: Math.max(0, after - limitCents),
  };
}
