import type { Account, Statement, TransactionKind } from '../domain/types';
import type { TxLite } from '../domain/overview/types';
import { listAccounts } from './accounts';
import { getDb } from './db';

interface TxRow {
  id: number;
  kind: TransactionKind;
  account_id: number;
  dest_account_id: number | null;
  category_id: number | null;
  amount_cents: number;
  purchased_on: string;
  effective_on: string;
  description: string;
  notes: string | null;
  installment_group_id: string | null;
  installment_no: number | null;
  installments_total: number | null;
  statement_id: number | null;
}

interface StatementRow {
  id: number;
  account_id: number;
  month: string;
  due_on: string;
  paid_by_transaction_id: number | null;
}

export interface OverviewData {
  accounts: Account[];
  txs: TxLite[];
  statements: Statement[];
}

/**
 * Lê tudo que as projeções precisam, em três consultas simples. Num app pessoal
 * o volume é pequeno; as contas em si ficam em `src/domain/overview` (funções
 * puras), então aqui não há regra de negócio.
 */
export async function loadOverviewData(): Promise<OverviewData> {
  const db = await getDb();
  const [accounts, txRows, statementRows] = await Promise.all([
    listAccounts({ includeArchived: true }),
    db.select<TxRow[]>('SELECT * FROM transactions'),
    db.select<StatementRow[]>('SELECT * FROM statements'),
  ]);

  return {
    accounts,
    txs: txRows.map((row) => ({
      id: row.id,
      kind: row.kind,
      accountId: row.account_id,
      destAccountId: row.dest_account_id,
      categoryId: row.category_id,
      amountCents: row.amount_cents,
      purchasedOn: row.purchased_on,
      effectiveOn: row.effective_on,
      description: row.description,
      notes: row.notes,
      installmentGroupId: row.installment_group_id,
      installmentNo: row.installment_no,
      installmentsTotal: row.installments_total,
      statementId: row.statement_id,
    })),
    statements: statementRows.map((row) => ({
      id: row.id,
      accountId: row.account_id,
      month: row.month,
      dueOn: row.due_on,
      paidByTransactionId: row.paid_by_transaction_id,
    })),
  };
}
