import { addMonths } from '../dates';
import type { Account, Statement } from '../types';
import { DEFAULT_SPEND_OPTIONS, monthlySpend, spentByMethod, type SpendOptions } from '../planning/spending';
import type { StatementSummary } from './statements';
import type { TxLite } from './types';

export interface CommitmentMonth {
  month: string;
  totalCents: number;
  byCard: { accountId: number; cents: number }[];
}

/**
 * Comprometido em faturas futuras (US-09): o que ainda está em aberto nas faturas
 * de meses **depois** de `currentMonth`, somado por mês e separado por cartão.
 * A fatura do mês corrente fica de fora — ela aparece como "fatura atual".
 */
export function commitmentsByMonth(
  summaries: StatementSummary[],
  currentMonth: string,
): CommitmentMonth[] {
  const byMonth = new Map<string, Map<number, number>>();
  for (const s of summaries) {
    if (s.month <= currentMonth || s.openCents <= 0) continue;
    const cards = byMonth.get(s.month) ?? new Map<number, number>();
    cards.set(s.accountId, (cards.get(s.accountId) ?? 0) + s.openCents);
    byMonth.set(s.month, cards);
  }
  return [...byMonth.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([month, cards]) => {
      const byCard = [...cards.entries()].map(([accountId, cents]) => ({ accountId, cents }));
      return { month, totalCents: byCard.reduce((sum, c) => sum + c.cents, 0), byCard };
    });
}

export interface OngoingInstallment {
  groupId: string;
  description: string;
  accountId: number;
  /** Parcela atual (a última cuja fatura já é a do mês corrente ou anterior) e o total. */
  currentNo: number;
  totalNo: number;
  currentAmountCents: number;
  /** Soma das parcelas que ainda virão em faturas futuras. */
  remainingCents: number;
}

/**
 * Parcelamentos em andamento (US-09): grupos com parcelas ainda por vir. Ex.: 3/10
 * de R$ 214,90 → restante = 7 × 214,90 (as parcelas depois da atual).
 */
export function ongoingInstallments(
  txs: TxLite[],
  statements: Statement[],
  currentMonth: string,
): OngoingInstallment[] {
  const monthByStatement = new Map(statements.map((s) => [s.id, s.month]));
  const groups = new Map<string, TxLite[]>();
  for (const tx of txs) {
    if (tx.kind !== 'expense' || tx.installmentGroupId === null) continue;
    const list = groups.get(tx.installmentGroupId) ?? [];
    list.push(tx);
    groups.set(tx.installmentGroupId, list);
  }

  const result: OngoingInstallment[] = [];
  for (const [groupId, list] of groups) {
    const monthOf = (tx: TxLite) =>
      (tx.statementId !== null ? monthByStatement.get(tx.statementId) : undefined) ??
      tx.effectiveOn.slice(0, 7);
    const sorted = [...list].sort((a, b) => (a.installmentNo ?? 0) - (b.installmentNo ?? 0));
    const future = sorted.filter((tx) => monthOf(tx) > currentMonth);
    if (future.length === 0) continue;
    const started = sorted.filter((tx) => monthOf(tx) <= currentMonth);
    const current = started[started.length - 1];
    if (!current) continue; // compra ainda nem entrou na primeira fatura
    result.push({
      groupId,
      description: current.description,
      accountId: current.accountId,
      currentNo: current.installmentNo ?? started.length,
      totalNo: current.installmentsTotal ?? sorted.length,
      currentAmountCents: current.amountCents,
      remainingCents: future.reduce((sum, tx) => sum + tx.amountCents, 0),
    });
  }
  return result.sort((a, b) => b.remainingCents - a.remainingCents);
}

export type CreditUsageOptions = SpendOptions;

/**
 * Quanto do teto de crédito foi usado em `month` (por data da compra), já
 * descontados estornos. Regra de parcelas em `monthlySpend` (planning/spending.ts).
 */
export function creditUsedCents(
  txs: TxLite[],
  accounts: Account[],
  statements: Statement[],
  month: string,
  options: CreditUsageOptions = DEFAULT_SPEND_OPTIONS,
): number {
  return spentByMethod(monthlySpend(txs, statements, month, options), accounts).credit;
}

/** Meses consecutivos a partir de `from`, para montar o eixo do gráfico. */
export function monthRange(from: string, count: number): string[] {
  return Array.from({ length: count }, (_, i) => addMonths(from, i));
}
