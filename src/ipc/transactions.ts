import type Database from '@tauri-apps/plugin-sql';
import { validateTransaction, type TransactionInput } from '../domain/transactions/validate';
import type { Transaction, TransactionKind } from '../domain/types';
import { getDb } from './db';

interface TransactionRow {
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
}

function fromRow(row: TransactionRow): Omit<Transaction, 'tags'> {
  return {
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
  };
}

async function tagsForTransaction(db: Database, transactionId: number): Promise<string[]> {
  const rows = await db.select<{ name: string }[]>(
    `SELECT t.name FROM tags t
     JOIN transaction_tags tt ON tt.tag_id = t.id
     WHERE tt.transaction_id = ?
     ORDER BY t.name`,
    [transactionId],
  );
  return rows.map((row) => row.name);
}

async function ensureTagIds(db: Database, names: string[]): Promise<number[]> {
  const ids: number[] = [];
  for (const rawName of names) {
    const name = rawName.trim();
    const existing = await db.select<{ id: number }[]>('SELECT id FROM tags WHERE name = ?', [name]);
    if (existing.length > 0) {
      ids.push(existing[0].id);
      continue;
    }
    const result = await db.execute('INSERT INTO tags (name) VALUES (?)', [name]);
    ids.push(result.lastInsertId as number);
  }
  return ids;
}

async function replaceTags(db: Database, transactionId: number, names: string[]): Promise<void> {
  await db.execute('DELETE FROM transaction_tags WHERE transaction_id = ?', [transactionId]);
  const tagIds = await ensureTagIds(db, names);
  for (const tagId of tagIds) {
    await db.execute('INSERT INTO transaction_tags (transaction_id, tag_id) VALUES (?, ?)', [
      transactionId,
      tagId,
    ]);
  }
}

export interface TransactionFilters {
  /** Busca por texto na descrição, observação e tags (US-07, US-20). */
  search?: string;
  accountId?: number;
  categoryId?: number;
  /** Datas ISO (YYYY-MM-DD), inclusive nos dois extremos. */
  fromDate?: string;
  toDate?: string;
}

export async function listTransactions(filters: TransactionFilters = {}): Promise<Transaction[]> {
  const db = await getDb();
  const clauses: string[] = [];
  const params: unknown[] = [];

  if (filters.search) {
    const like = `%${filters.search}%`;
    clauses.push(
      `(description LIKE ? OR notes LIKE ? OR id IN (
        SELECT tt.transaction_id FROM transaction_tags tt
        JOIN tags t ON t.id = tt.tag_id WHERE t.name LIKE ?
      ))`,
    );
    params.push(like, like, like);
  }
  if (filters.accountId) {
    clauses.push('account_id = ?');
    params.push(filters.accountId);
  }
  if (filters.categoryId) {
    clauses.push('category_id = ?');
    params.push(filters.categoryId);
  }
  if (filters.fromDate) {
    clauses.push('purchased_on >= ?');
    params.push(filters.fromDate);
  }
  if (filters.toDate) {
    clauses.push('purchased_on <= ?');
    params.push(filters.toDate);
  }

  const where = clauses.length > 0 ? `WHERE ${clauses.join(' AND ')}` : '';
  const rows = await db.select<TransactionRow[]>(
    `SELECT * FROM transactions ${where} ORDER BY purchased_on DESC, id DESC`,
    params,
  );

  return Promise.all(
    rows.map(async (row) => ({ ...fromRow(row), tags: await tagsForTransaction(db, row.id) })),
  );
}

export async function getTransaction(id: number): Promise<Transaction> {
  const db = await getDb();
  const rows = await db.select<TransactionRow[]>('SELECT * FROM transactions WHERE id = ?', [id]);
  if (rows.length === 0) throw new Error(`Lançamento ${id} não encontrado.`);
  return { ...fromRow(rows[0]), tags: await tagsForTransaction(db, id) };
}

export async function createTransaction(input: TransactionInput): Promise<Transaction> {
  const errors = validateTransaction(input);
  if (errors.length > 0) throw new Error(errors.join(' '));

  const db = await getDb();
  // Fase 1: effective_on = purchased_on. O cálculo de em qual fatura a compra cai
  // (fechamento do cartão) chega na Fase 3, junto com a criação de `statements`.
  const result = await db.execute(
    `INSERT INTO transactions (kind, account_id, category_id, amount_cents, purchased_on, effective_on, description, notes)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      input.kind,
      input.accountId,
      input.categoryId,
      input.amountCents,
      input.purchasedOn,
      input.purchasedOn,
      input.description.trim(),
      input.notes,
    ],
  );
  const id = result.lastInsertId as number;
  await replaceTags(db, id, input.tags);
  return getTransaction(id);
}

export async function updateTransaction(id: number, input: TransactionInput): Promise<Transaction> {
  const errors = validateTransaction(input);
  if (errors.length > 0) throw new Error(errors.join(' '));

  const db = await getDb();
  await db.execute(
    `UPDATE transactions
     SET kind = ?, account_id = ?, category_id = ?, amount_cents = ?, purchased_on = ?, effective_on = ?,
         description = ?, notes = ?, updated_at = datetime('now')
     WHERE id = ?`,
    [
      input.kind,
      input.accountId,
      input.categoryId,
      input.amountCents,
      input.purchasedOn,
      input.purchasedOn,
      input.description.trim(),
      input.notes,
      id,
    ],
  );
  await replaceTags(db, id, input.tags);
  return getTransaction(id);
}

export async function deleteTransaction(id: number): Promise<void> {
  const db = await getDb();
  await db.execute('DELETE FROM transactions WHERE id = ?', [id]);
}
