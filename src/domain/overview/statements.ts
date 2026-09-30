import { installmentStatementMonth } from '../transactions/installments';
import type { Account, Statement } from '../types';
import type { TxLite } from './types';

export interface StatementSummary {
  statementId: number;
  accountId: number;
  month: string; // YYYY-MM da fatura
  dueOn: string;
  totalCents: number;
  paidCents: number;
  /** `total − pago`, nunca negativo. */
  openCents: number;
}

/**
 * Totais de cada fatura e quanto já foi pago.
 *
 * - total = gastos ligados à fatura (`statementId`) − estornos no cartão, que
 *   abatem a fatura do período em que caíram;
 * - pagamentos (`card_payment` com destino no cartão) quitam as faturas mais
 *   antigas primeiro; uma fatura com `paidByTransactionId` já conta como paga.
 *
 * Fatura sem lançamento não existe (criação lazy, docs/data-model.md), então
 * nunca aparece aqui.
 */
export function summarizeStatements(
  statements: Statement[],
  txs: TxLite[],
  accounts: Account[],
): StatementSummary[] {
  const closingDayByAccount = new Map(accounts.map((a) => [a.id, a.closingDay]));
  const statementByKey = new Map(statements.map((s) => [`${s.accountId}|${s.month}`, s]));
  const totals = new Map<number, number>();

  for (const tx of txs) {
    if (tx.kind === 'expense' && tx.statementId !== null) {
      totals.set(tx.statementId, (totals.get(tx.statementId) ?? 0) + tx.amountCents);
    } else if (tx.kind === 'refund' && closingDayByAccount.has(tx.accountId)) {
      const closingDay = closingDayByAccount.get(tx.accountId) ?? null;
      if (closingDay === null) continue; // conta que não é cartão
      const month = installmentStatementMonth(tx.effectiveOn, 1, closingDay);
      const statement = statementByKey.get(`${tx.accountId}|${month}`);
      if (statement) totals.set(statement.id, (totals.get(statement.id) ?? 0) - tx.amountCents);
    }
  }

  const paymentsByCard = new Map<number, number>();
  for (const tx of txs) {
    if (tx.kind === 'card_payment' && tx.destAccountId !== null) {
      paymentsByCard.set(tx.destAccountId, (paymentsByCard.get(tx.destAccountId) ?? 0) + tx.amountCents);
    }
  }

  const summaries: StatementSummary[] = [];
  const ordered = [...statements].sort((a, b) =>
    a.accountId === b.accountId ? a.month.localeCompare(b.month) : a.accountId - b.accountId,
  );
  const remainingPayments = new Map(paymentsByCard);
  for (const statement of ordered) {
    const totalCents = Math.max(0, totals.get(statement.id) ?? 0);
    let paidCents: number;
    if (statement.paidByTransactionId !== null) {
      paidCents = totalCents;
    } else {
      const available = remainingPayments.get(statement.accountId) ?? 0;
      paidCents = Math.min(totalCents, available);
      remainingPayments.set(statement.accountId, available - paidCents);
    }
    summaries.push({
      statementId: statement.id,
      accountId: statement.accountId,
      month: statement.month,
      dueOn: statement.dueOn,
      totalCents,
      paidCents,
      openCents: totalCents - paidCents,
    });
  }
  return summaries;
}

/** Fatura "atual" de um cartão: a mais antiga ainda em aberto. */
export function currentStatement(
  summaries: StatementSummary[],
  accountId: number,
): StatementSummary | null {
  return (
    summaries
      .filter((s) => s.accountId === accountId && s.openCents > 0)
      .sort((a, b) => a.month.localeCompare(b.month))[0] ?? null
  );
}
