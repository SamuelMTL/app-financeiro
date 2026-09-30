import { daysInMonth, toMonth } from '../dates';
import type { Account } from '../types';
import { totalBalanceCents } from './balances';
import type { StatementSummary } from './statements';
import type { TxLite } from './types';

/**
 * Dias entre amanhã e o último dia do mês, mínimo 1 (docs/business-rules.md).
 * Em 12/10: 31 − 12 = 19.
 */
export function remainingDays(today: string): number {
  const day = Number(today.slice(8, 10));
  return Math.max(1, daysInMonth(toMonth(today)) - day);
}

/** `max(0, saldo_previsto) / dias_restantes`, em centavos inteiros (arredonda para baixo). */
export function dailyAllowanceCents(forecastCents: number, days: number): number {
  return Math.floor(Math.max(0, forecastCents) / Math.max(1, days));
}

export interface Forecast {
  currentBalanceCents: number;
  /** Rendas com data entre amanhã e o fim do mês, ainda não recebidas. */
  remainingIncomeCents: number;
  /** Gastos em conta (recorrentes ou agendados) com data até o fim do mês, ainda não saídos. */
  remainingOutflowsCents: number;
  /** Faturas com vencimento no mês e ainda não pagas (em aberto). */
  statementsDueCents: number;
  forecastCents: number;
  remainingDays: number;
  perDayCents: number;
}

/**
 * Saldo previsto (caixa) para o fim do mês (docs/business-rules.md):
 *
 *   saldo_atual + rendas_previstas_restantes
 *               − gastos_em_conta_restantes − faturas_a_vencer_no_mês
 *
 * Gastos no cartão não entram em "gastos em conta": já estão nas faturas, e
 * contar os dois seria contar duas vezes.
 */
export function computeForecast(input: {
  accounts: Account[];
  txs: TxLite[];
  summaries: StatementSummary[];
  today: string;
}): Forecast {
  const { accounts, txs, summaries, today } = input;
  const month = toMonth(today);
  const monthEnd = `${month}-${String(daysInMonth(month)).padStart(2, '0')}`;
  const cardIds = new Set(accounts.filter((a) => a.kind === 'credit_card').map((a) => a.id));

  let remainingIncomeCents = 0;
  let remainingOutflowsCents = 0;
  for (const tx of txs) {
    if (tx.effectiveOn <= today || tx.effectiveOn > monthEnd) continue;
    if (cardIds.has(tx.accountId)) continue;
    if (tx.kind === 'income') remainingIncomeCents += tx.amountCents;
    else if (tx.kind === 'expense') remainingOutflowsCents += tx.amountCents;
  }

  const statementsDueCents = summaries
    .filter((s) => toMonth(s.dueOn) === month)
    .reduce((sum, s) => sum + s.openCents, 0);

  const currentBalanceCents = totalBalanceCents(accounts, txs, today);
  const forecastCents =
    currentBalanceCents + remainingIncomeCents - remainingOutflowsCents - statementsDueCents;
  const days = remainingDays(today);

  return {
    currentBalanceCents,
    remainingIncomeCents,
    remainingOutflowsCents,
    statementsDueCents,
    forecastCents,
    remainingDays: days,
    perDayCents: dailyAllowanceCents(forecastCents, days),
  };
}
