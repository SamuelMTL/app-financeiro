import { isRecurrenceActiveInMonth, occurrenceDate } from '../domain/recurrences/occurrences';
import { validateRecurrence, type RecurrenceInput } from '../domain/recurrences/validate';
import type { Recurrence } from '../domain/types';
import { listClosedMonths } from './closing';
import { isClosed } from '../domain/closing/closing';
import { getDb } from './db';

interface RecurrenceRow {
  id: number;
  kind: 'expense' | 'income';
  description: string;
  amount_cents: number;
  day_of_month: number;
  account_id: number;
  category_id: number | null;
  starts_on: string;
  ends_on: string | null;
}

function fromRow(row: RecurrenceRow): Recurrence {
  return {
    id: row.id,
    kind: row.kind,
    description: row.description,
    amountCents: row.amount_cents,
    dayOfMonth: row.day_of_month,
    accountId: row.account_id,
    categoryId: row.category_id,
    startsOn: row.starts_on,
    endsOn: row.ends_on,
  };
}

export async function listRecurrences(): Promise<Recurrence[]> {
  const db = await getDb();
  const rows = await db.select<RecurrenceRow[]>('SELECT * FROM recurrences ORDER BY description');
  return rows.map(fromRow);
}

export async function createRecurrence(input: RecurrenceInput): Promise<Recurrence> {
  const errors = validateRecurrence(input);
  if (errors.length > 0) throw new Error(errors.join(' '));

  const db = await getDb();
  const result = await db.execute(
    `INSERT INTO recurrences (kind, description, amount_cents, day_of_month, account_id, category_id, starts_on, ends_on)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      input.kind,
      input.description.trim(),
      input.amountCents,
      input.dayOfMonth,
      input.accountId,
      input.categoryId,
      input.startsOn,
      input.endsOn,
    ],
  );
  const id = result.lastInsertId as number;
  const rows = await db.select<RecurrenceRow[]>('SELECT * FROM recurrences WHERE id = ?', [id]);
  return fromRow(rows[0]);
}

/**
 * "Mudar valor vale a partir do mês seguinte; meses fechados nunca são alterados"
 * (docs/business-rules.md) — isso já vale de graça: só atualiza o modelo, nunca os
 * lançamentos já gerados (a chave única `recurrence_id + effective_on` impede
 * regeneração). Meses futuros ainda não gerados passam a usar os novos valores.
 */
export async function updateRecurrence(id: number, input: RecurrenceInput): Promise<Recurrence> {
  const errors = validateRecurrence(input);
  if (errors.length > 0) throw new Error(errors.join(' '));

  const db = await getDb();
  await db.execute(
    `UPDATE recurrences
     SET kind = ?, description = ?, amount_cents = ?, day_of_month = ?, account_id = ?, category_id = ?, starts_on = ?, ends_on = ?
     WHERE id = ?`,
    [
      input.kind,
      input.description.trim(),
      input.amountCents,
      input.dayOfMonth,
      input.accountId,
      input.categoryId,
      input.startsOn,
      input.endsOn,
      id,
    ],
  );
  const rows = await db.select<RecurrenceRow[]>('SELECT * FROM recurrences WHERE id = ?', [id]);
  return fromRow(rows[0]);
}

/** Encerra a recorrência (não some do histórico — só para de gerar lançamentos novos). */
export async function endRecurrence(id: number, endsOn: string): Promise<void> {
  const db = await getDb();
  await db.execute('UPDATE recurrences SET ends_on = ? WHERE id = ?', [endsOn, id]);
}

export async function deleteRecurrence(id: number): Promise<void> {
  const db = await getDb();
  await db.execute('DELETE FROM recurrences WHERE id = ?', [id]);
}

/**
 * Gera os lançamentos do mês para as recorrências ativas nele — idempotente: se
 * já existir um lançamento para `(recurrence_id, effective_on)`, não duplica (a
 * migration 0001 já tem essa UNIQUE constraint). Chamado ao abrir o app (US-03).
 * Devolve quantos lançamentos novos foram criados.
 */
export async function generateOccurrencesForMonth(month: string): Promise<number> {
  // Mês fechado nunca é alterado — inclusive pela geração automática de recorrências.
  if (isClosed(await listClosedMonths(), month)) return 0;

  const db = await getDb();
  const recurrences = await listRecurrences();
  let created = 0;

  for (const recurrence of recurrences) {
    if (!isRecurrenceActiveInMonth(recurrence, month)) continue;

    const date = occurrenceDate(recurrence, month);
    const existing = await db.select<{ id: number }[]>(
      'SELECT id FROM transactions WHERE recurrence_id = ? AND effective_on = ?',
      [recurrence.id, date],
    );
    if (existing.length > 0) continue;

    await db.execute(
      `INSERT INTO transactions (kind, account_id, category_id, amount_cents, purchased_on, effective_on, description, recurrence_id)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        recurrence.kind,
        recurrence.accountId,
        recurrence.categoryId,
        recurrence.amountCents,
        date,
        date,
        recurrence.description,
        recurrence.id,
      ],
    );
    created += 1;
  }

  return created;
}
