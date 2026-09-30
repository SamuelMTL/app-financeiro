import { validateAccount, type AccountInput } from '../domain/accounts/validate';
import type { Account, AccountKind } from '../domain/types';
import { getDb } from './db';

interface AccountRow {
  id: number;
  name: string;
  kind: AccountKind;
  opening_balance_cents: number;
  credit_limit_cents: number | null;
  closing_day: number | null;
  due_day: number | null;
  archived: number;
}

function fromRow(row: AccountRow): Account {
  return {
    id: row.id,
    name: row.name,
    kind: row.kind,
    openingBalanceCents: row.opening_balance_cents,
    creditLimitCents: row.credit_limit_cents,
    closingDay: row.closing_day,
    dueDay: row.due_day,
    archived: row.archived === 1,
  };
}

export async function listAccounts(options: { includeArchived?: boolean } = {}): Promise<Account[]> {
  const db = await getDb();
  const rows = await db.select<AccountRow[]>(
    options.includeArchived
      ? 'SELECT * FROM accounts ORDER BY archived, name'
      : 'SELECT * FROM accounts WHERE archived = 0 ORDER BY name',
  );
  return rows.map(fromRow);
}

export async function getAccount(id: number): Promise<Account> {
  const db = await getDb();
  const rows = await db.select<AccountRow[]>('SELECT * FROM accounts WHERE id = ?', [id]);
  if (rows.length === 0) throw new Error(`Conta ${id} não encontrada.`);
  return fromRow(rows[0]);
}

export async function createAccount(input: AccountInput): Promise<Account> {
  const errors = validateAccount(input);
  if (errors.length > 0) throw new Error(errors.join(' '));

  const db = await getDb();
  const result = await db.execute(
    `INSERT INTO accounts (name, kind, opening_balance_cents, credit_limit_cents, closing_day, due_day)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [
      input.name.trim(),
      input.kind,
      input.openingBalanceCents,
      input.creditLimitCents,
      input.closingDay,
      input.dueDay,
    ],
  );
  return getAccount(result.lastInsertId as number);
}

export async function updateAccount(id: number, input: AccountInput): Promise<Account> {
  const errors = validateAccount(input);
  if (errors.length > 0) throw new Error(errors.join(' '));

  const db = await getDb();
  await db.execute(
    `UPDATE accounts
     SET name = ?, kind = ?, opening_balance_cents = ?, credit_limit_cents = ?, closing_day = ?, due_day = ?
     WHERE id = ?`,
    [
      input.name.trim(),
      input.kind,
      input.openingBalanceCents,
      input.creditLimitCents,
      input.closingDay,
      input.dueDay,
      id,
    ],
  );
  return getAccount(id);
}

/** Contas não são apagadas de verdade — lançamentos antigos referenciam por id.
 * "Excluir" uma conta arquiva (`archived = 1`); ela some das listas ativas mas
 * o histórico continua íntegro. */
export async function archiveAccount(id: number): Promise<void> {
  const db = await getDb();
  await db.execute('UPDATE accounts SET archived = 1 WHERE id = ?', [id]);
}

export async function unarchiveAccount(id: number): Promise<void> {
  const db = await getDb();
  await db.execute('UPDATE accounts SET archived = 0 WHERE id = ?', [id]);
}
