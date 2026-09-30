import { closedMonthError, validateClose, type ClosedMonth } from '../domain/closing/closing';
import { todayISO } from '../domain/dates';
import { getDb } from './db';

interface ClosedRow {
  month: string;
  closed_at: string;
  reopened_at: string | null;
}

export async function listClosedMonths(): Promise<ClosedMonth[]> {
  const db = await getDb();
  const rows = await db.select<ClosedRow[]>('SELECT * FROM closed_months ORDER BY month DESC');
  return rows.map((r) => ({ month: r.month, closedAt: r.closed_at, reopenedAt: r.reopened_at }));
}

/**
 * Confere antes de gravar e devolve um erro legível. O trigger do banco (migration
 * 0005) continua sendo a garantia — isto só evita efeitos colaterais no meio do
 * caminho (ex.: criar a fatura do mês) e dá uma mensagem melhor que a do SQLite.
 */
export async function assertDatesOpen(...dates: string[]): Promise<void> {
  const message = closedMonthError(await listClosedMonths(), ...dates);
  if (message) throw new Error(message);
}

export async function assertMonthOpen(month: string): Promise<void> {
  await assertDatesOpen(`${month}-01`);
}

export async function closeMonth(month: string): Promise<void> {
  const today = todayISO();
  const errors = validateClose(await listClosedMonths(), month, today);
  if (errors.length > 0) throw new Error(errors.join(' '));
  const db = await getDb();
  await db.execute(
    `INSERT INTO closed_months (month, closed_at, reopened_at) VALUES (?, ?, NULL)
     ON CONFLICT (month) DO UPDATE SET closed_at = excluded.closed_at, reopened_at = NULL`,
    [month, today],
  );
}

/** Reabrir registra a data; o histórico do fechamento anterior fica na mesma linha. */
export async function reopenMonth(month: string): Promise<void> {
  const db = await getDb();
  const res = await db.execute(
    'UPDATE closed_months SET reopened_at = ? WHERE month = ? AND reopened_at IS NULL',
    [todayISO(), month],
  );
  if (res.rowsAffected === 0) throw new Error('Este mês não está fechado.');
}
