import { dateInMonth } from '../domain/dates';
import { installmentStatementMonth } from '../domain/transactions/installments';
import type { Statement } from '../domain/types';
import { getDb } from './db';

interface StatementRow {
  id: number;
  account_id: number;
  month: string;
  due_on: string;
  paid_by_transaction_id: number | null;
}

function fromRow(row: StatementRow): Statement {
  return {
    id: row.id,
    accountId: row.account_id,
    month: row.month,
    dueOn: row.due_on,
    paidByTransactionId: row.paid_by_transaction_id,
  };
}

/**
 * Fatura de um cartão num mês: nasce no primeiro lançamento que cair nesse
 * período (lazy), não precomputada — ver docs/data-model.md, "Criação de
 * faturas". `due_on` usa o `due_day` do cartão dentro do próprio mês da fatura;
 * sem `due_day` configurado, cai num dia 10 como padrão razoável.
 */
export async function getOrCreateStatement(accountId: number, month: string): Promise<Statement> {
  const db = await getDb();
  const existing = await db.select<StatementRow[]>(
    'SELECT * FROM statements WHERE account_id = ? AND month = ?',
    [accountId, month],
  );
  if (existing.length > 0) return fromRow(existing[0]);

  const accountRows = await db.select<{ due_day: number | null }[]>(
    'SELECT due_day FROM accounts WHERE id = ?',
    [accountId],
  );
  const dueDay = accountRows[0]?.due_day ?? 10;
  const dueOn = dateInMonth(month, dueDay);

  const result = await db.execute('INSERT INTO statements (account_id, month, due_on) VALUES (?, ?, ?)', [
    accountId,
    month,
    dueOn,
  ]);
  return { id: result.lastInsertId as number, accountId, month, dueOn, paidByTransactionId: null };
}

export async function listStatements(accountId: number): Promise<Statement[]> {
  const db = await getDb();
  const rows = await db.select<StatementRow[]>('SELECT * FROM statements WHERE account_id = ? ORDER BY month', [
    accountId,
  ]);
  return rows.map(fromRow);
}

/**
 * Para um gasto simples numa conta: se for cartão, resolve (ou cria) a fatura do
 * mês e usa o vencimento como `effective_on` — "data em que afeta caixa/fatura"
 * (docs/data-model.md). Conta que não é cartão não tem fatura: `effective_on`
 * continua igual a `purchasedOn` (comportamento da Fase 1/2, inalterado).
 */
export async function resolveExpenseEffective(
  accountId: number,
  purchasedOn: string,
): Promise<{ statementId: number | null; effectiveOn: string }> {
  const db = await getDb();
  const accountRows = await db.select<{ kind: string; closing_day: number | null }[]>(
    'SELECT kind, closing_day FROM accounts WHERE id = ?',
    [accountId],
  );
  const account = accountRows[0];
  if (!account || account.kind !== 'credit_card') {
    return { statementId: null, effectiveOn: purchasedOn };
  }

  const month = installmentStatementMonth(purchasedOn, 1, account.closing_day);
  const statement = await getOrCreateStatement(accountId, month);
  return { statementId: statement.id, effectiveOn: statement.dueOn };
}
