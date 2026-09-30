import { toMonth } from '../dates';
import type { Account, Statement } from '../types';
import { accountBalanceCents } from './balances';
import {
  commitmentsByMonth,
  ongoingInstallments,
  type CommitmentMonth,
  type OngoingInstallment,
} from './commitments';
import { computeForecast, type Forecast } from './forecast';
import { currentStatement, summarizeStatements, type StatementSummary } from './statements';
import type { TxLite } from './types';

export interface Overview {
  forecast: Forecast;
  balances: { accountId: number; balanceCents: number }[];
  /** Fatura atual (mais antiga em aberto) por cartão. */
  currentStatements: StatementSummary[];
  /** Faturas em aberto com vencimento no mês corrente, por data. */
  statementsDueThisMonth: StatementSummary[];
  commitments: CommitmentMonth[];
  commitmentsTotalCents: number;
  installments: OngoingInstallment[];
}

/** Reúne tudo que as telas Visão geral e Cartões e contas mostram (US-09, US-15, US-16). */
export function buildOverview(input: {
  accounts: Account[];
  txs: TxLite[];
  statements: Statement[];
  today: string;
}): Overview {
  const { accounts, txs, statements, today } = input;
  const month = toMonth(today);
  const summaries = summarizeStatements(statements, txs, accounts);
  const commitments = commitmentsByMonth(summaries, month);

  return {
    forecast: computeForecast({ accounts, txs, summaries, today }),
    balances: accounts
      .filter((a) => a.kind !== 'credit_card' && !a.archived)
      .map((a) => ({ accountId: a.id, balanceCents: accountBalanceCents(a, txs, today) })),
    currentStatements: accounts
      .filter((a) => a.kind === 'credit_card' && !a.archived)
      .map((a) => currentStatement(summaries, a.id))
      .filter((s): s is StatementSummary => s !== null),
    statementsDueThisMonth: summaries
      .filter((s) => s.openCents > 0 && toMonth(s.dueOn) === month)
      .sort((a, b) => a.dueOn.localeCompare(b.dueOn)),
    commitments,
    commitmentsTotalCents: commitments.reduce((sum, m) => sum + m.totalCents, 0),
    installments: ongoingInstallments(txs, statements, month),
  };
}
