import { validateCategory, type CategoryInput } from '../domain/categories/validate';
import type { Category, CategoryGroup } from '../domain/types';
import { getDb } from './db';

interface CategoryRow {
  id: number;
  name: string;
  group_kind: CategoryGroup;
}

function fromRow(row: CategoryRow): Category {
  return { id: row.id, name: row.name, groupKind: row.group_kind };
}

export async function listCategories(): Promise<Category[]> {
  const db = await getDb();
  const rows = await db.select<CategoryRow[]>('SELECT * FROM categories ORDER BY name');
  return rows.map(fromRow);
}

export async function createCategory(input: CategoryInput): Promise<Category> {
  const errors = validateCategory(input);
  if (errors.length > 0) throw new Error(errors.join(' '));

  const db = await getDb();
  const result = await db.execute('INSERT INTO categories (name, group_kind) VALUES (?, ?)', [
    input.name.trim(),
    input.groupKind,
  ]);
  const id = result.lastInsertId as number;
  const rows = await db.select<CategoryRow[]>('SELECT * FROM categories WHERE id = ?', [id]);
  return fromRow(rows[0]);
}

export async function updateCategory(id: number, input: CategoryInput): Promise<Category> {
  const errors = validateCategory(input);
  if (errors.length > 0) throw new Error(errors.join(' '));

  const db = await getDb();
  await db.execute('UPDATE categories SET name = ?, group_kind = ? WHERE id = ?', [
    input.name.trim(),
    input.groupKind,
    id,
  ]);
  const rows = await db.select<CategoryRow[]>('SELECT * FROM categories WHERE id = ?', [id]);
  return fromRow(rows[0]);
}

/** Recusa apagar categoria em uso — mensagem clara, sem deixar lançamento órfão. */
export async function deleteCategory(id: number): Promise<void> {
  const db = await getDb();
  const inUse = await db.select<{ total: number }[]>(
    'SELECT COUNT(*) AS total FROM transactions WHERE category_id = ?',
    [id],
  );
  if (inUse[0].total > 0) {
    throw new Error('Essa categoria está em uso em algum lançamento e não pode ser excluída.');
  }
  await db.execute('DELETE FROM categories WHERE id = ?', [id]);
}
