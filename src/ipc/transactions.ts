import type Database from '@tauri-apps/plugin-sql';
import { validateTransaction, type TransactionInput } from '../domain/transactions/validate';
import { installmentStatementMonth, previewInstallments } from '../domain/transactions/installments';
import { validateTransfer, type TransferInput } from '../domain/transactions/transfers';
import {
  validateRefund,
  validateRefundAmount,
  type RefundInput,
} from '../domain/transactions/refunds';
import type { Transaction, TransactionKind } from '../domain/types';
import { assertDatesOpen } from './closing';
import { getDb } from './db';
import { getOrCreateStatement, resolveExpenseEffective } from './statements';

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
  installment_group_id: string | null;
  installment_no: number | null;
  installments_total: number | null;
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
    installmentGroupId: row.installment_group_id,
    installmentNo: row.installment_no,
    installmentsTotal: row.installments_total,
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
  await assertDatesOpen(input.purchasedOn);

  const db = await getDb();
  // Gasto num cartão: effective_on vira o vencimento da fatura do mês certo
  // (Fase 3, docs/data-model.md). Renda e gasto fora de cartão: effective_on =
  // purchased_on, como desde a Fase 1.
  const { statementId, effectiveOn } =
    input.kind === 'expense'
      ? await resolveExpenseEffective(input.accountId, input.purchasedOn)
      : { statementId: null, effectiveOn: input.purchasedOn };

  const result = await db.execute(
    `INSERT INTO transactions (kind, account_id, category_id, amount_cents, purchased_on, effective_on, description, notes, statement_id)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      input.kind,
      input.accountId,
      input.categoryId,
      input.amountCents,
      input.purchasedOn,
      effectiveOn,
      input.description.trim(),
      input.notes,
      statementId,
    ],
  );
  const id = result.lastInsertId as number;
  await replaceTags(db, id, input.tags);
  return getTransaction(id);
}

export async function updateTransaction(id: number, input: TransactionInput): Promise<Transaction> {
  const errors = validateTransaction(input);
  if (errors.length > 0) throw new Error(errors.join(' '));
  await assertDatesOpen((await getTransaction(id)).purchasedOn, input.purchasedOn);

  const db = await getDb();
  const { statementId, effectiveOn } =
    input.kind === 'expense'
      ? await resolveExpenseEffective(input.accountId, input.purchasedOn)
      : { statementId: null, effectiveOn: input.purchasedOn };

  await db.execute(
    `UPDATE transactions
     SET kind = ?, account_id = ?, category_id = ?, amount_cents = ?, purchased_on = ?, effective_on = ?,
         description = ?, notes = ?, statement_id = ?, updated_at = datetime('now')
     WHERE id = ?`,
    [
      input.kind,
      input.accountId,
      input.categoryId,
      input.amountCents,
      input.purchasedOn,
      effectiveOn,
      input.description.trim(),
      input.notes,
      statementId,
      id,
    ],
  );
  await replaceTags(db, id, input.tags);
  return getTransaction(id);
}

export async function deleteTransaction(id: number): Promise<void> {
  await assertDatesOpen((await getTransaction(id)).purchasedOn);
  const db = await getDb();
  await db.execute('DELETE FROM transactions WHERE id = ?', [id]);
}

// ---------------------------------------------------------------------------
// Fase 2: parcelas, transferências, pagamento de fatura, estornos.
// ---------------------------------------------------------------------------

export interface InstallmentPurchaseInput {
  accountId: number;
  categoryId: number | null;
  totalCents: number;
  installmentsTotal: number;
  purchasedOn: string;
  description: string;
  notes: string | null;
  tags: string[];
  /** Dia de fechamento do cartão (null se a conta não for cartão). */
  closingDay: number | null;
}

/**
 * Cria todas as parcelas de uma vez, cada uma na fatura certa (US-02). A soma
 * bate ao centavo com `totalCents` (ver src/domain/transactions/installments.ts).
 * `installmentsTotal <= 1` cai para um lançamento simples, sem grupo de parcela.
 */
export async function createInstallmentPurchase(
  input: InstallmentPurchaseInput,
): Promise<Transaction[]> {
  await assertDatesOpen(input.purchasedOn);
  if (input.installmentsTotal <= 1) {
    const tx = await createTransaction({
      kind: 'expense',
      accountId: input.accountId,
      categoryId: input.categoryId,
      amountCents: input.totalCents,
      purchasedOn: input.purchasedOn,
      description: input.description,
      notes: input.notes,
      tags: input.tags,
    });
    return [tx];
  }

  const preview = previewInstallments(
    input.purchasedOn,
    input.totalCents,
    input.installmentsTotal,
    input.closingDay,
  );

  const db = await getDb();
  const groupId = crypto.randomUUID();
  const createdIds: number[] = [];

  for (const item of preview) {
    // Com cartão, cada parcela usa o vencimento real da fatura do mês dela (não
    // só o dia estimado de `previewInstallments`, que não tem acesso ao banco).
    let statementId: number | null = null;
    let effectiveOn = item.effectiveOn;
    if (input.closingDay !== null) {
      const month = installmentStatementMonth(input.purchasedOn, item.installmentNo, input.closingDay);
      const statement = await getOrCreateStatement(input.accountId, month);
      statementId = statement.id;
      effectiveOn = statement.dueOn;
    }

    const result = await db.execute(
      `INSERT INTO transactions
         (kind, account_id, category_id, amount_cents, purchased_on, effective_on, description,
          notes, installment_group_id, installment_no, installments_total, statement_id)
       VALUES ('expense', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        input.accountId,
        input.categoryId,
        item.amountCents,
        input.purchasedOn,
        effectiveOn,
        // Descrição fica limpa (sem "(N/M)" no texto) — o nº da parcela já é
        // coluna própria; embuti-lo no texto quebraria o casamento de grupo na
        // importação de fatura (Fase 3), que compara description normalizada.
        input.description,
        input.notes,
        groupId,
        item.installmentNo,
        input.installmentsTotal,
        statementId,
      ],
    );
    createdIds.push(result.lastInsertId as number);
  }

  if (input.tags.length > 0) {
    for (const id of createdIds) {
      await replaceTags(db, id, input.tags);
    }
  }

  return Promise.all(createdIds.map((id) => getTransaction(id)));
}

async function findCategoryIdByName(db: Database, name: string): Promise<number | null> {
  const rows = await db.select<{ id: number }[]>('SELECT id FROM categories WHERE name = ?', [name]);
  return rows[0]?.id ?? null;
}

/** Transferência entre contas — não conta como gasto/renda (US-05). */
export async function createTransfer(input: TransferInput): Promise<Transaction> {
  const errors = validateTransfer(input);
  if (errors.length > 0) throw new Error(errors.join(' '));
  await assertDatesOpen(input.purchasedOn);

  const db = await getDb();
  const categoryId = await findCategoryIdByName(db, 'Transferência');
  const result = await db.execute(
    `INSERT INTO transactions (kind, account_id, dest_account_id, category_id, amount_cents, purchased_on, effective_on, description, notes)
     VALUES ('transfer', ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      input.accountId,
      input.destAccountId,
      categoryId,
      input.amountCents,
      input.purchasedOn,
      input.purchasedOn,
      input.description.trim(),
      input.notes,
    ],
  );
  return getTransaction(result.lastInsertId as number);
}

/** Pagamento de fatura: sai da conta, quita o cartão — não conta como gasto (US-05). */
export async function createCardPayment(input: TransferInput): Promise<Transaction> {
  const errors = validateTransfer(input);
  if (errors.length > 0) throw new Error(errors.join(' '));
  await assertDatesOpen(input.purchasedOn);

  const db = await getDb();
  const categoryId = await findCategoryIdByName(db, 'Fatura');
  const result = await db.execute(
    `INSERT INTO transactions (kind, account_id, dest_account_id, category_id, amount_cents, purchased_on, effective_on, description, notes)
     VALUES ('card_payment', ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      input.accountId,
      input.destAccountId,
      categoryId,
      input.amountCents,
      input.purchasedOn,
      input.purchasedOn,
      input.description.trim(),
      input.notes,
    ],
  );
  return getTransaction(result.lastInsertId as number);
}

/** Soma dos estornos já lançados para um gasto (US-06). */
export async function getRefundedCents(originalTransactionId: number): Promise<number> {
  const db = await getDb();
  const rows = await db.select<{ total: number | null }[]>(
    'SELECT SUM(amount_cents) AS total FROM transactions WHERE refund_of_id = ?',
    [originalTransactionId],
  );
  return rows[0]?.total ?? 0;
}

/**
 * Registra um estorno vinculado a um gasto (US-06). Herda categoria e conta/cartão
 * do gasto original. Recusa se a soma dos estornos passar do valor original.
 */
export async function createRefund(input: RefundInput): Promise<Transaction> {
  const fieldErrors = validateRefund(input);
  if (fieldErrors.length > 0) throw new Error(fieldErrors.join(' '));

  const original = await getTransaction(input.originalTransactionId);
  if (original.kind !== 'expense') {
    throw new Error('Só é possível estornar um gasto.');
  }

  await assertDatesOpen(input.purchasedOn);
  const alreadyRefunded = await getRefundedCents(input.originalTransactionId);
  const capErrors = validateRefundAmount(original.amountCents, alreadyRefunded, input.amountCents);
  if (capErrors.length > 0) throw new Error(capErrors.join(' '));

  const db = await getDb();
  const result = await db.execute(
    `INSERT INTO transactions (kind, account_id, category_id, amount_cents, purchased_on, effective_on, description, notes, refund_of_id)
     VALUES ('refund', ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      original.accountId,
      original.categoryId,
      input.amountCents,
      input.purchasedOn,
      input.purchasedOn,
      `Estorno: ${original.description}`,
      input.notes,
      input.originalTransactionId,
    ],
  );
  return getTransaction(result.lastInsertId as number);
}
