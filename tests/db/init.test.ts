/**
 * Testes de integração do banco: roda as migrations SQL de verdade (as mesmas
 * que o Tauri aplica em produção, via `include_str!` em src-tauri/src/lib.rs,
 * na mesma ordem) contra um SQLite em memória, e verifica que os
 * CHECK/FK/UNIQUE do schema realmente funcionam — não só que o domínio em
 * TypeScript valida antes de mandar a query. Ver docs/CLAUDE.md, seção "Stack".
 */
import Database from 'better-sqlite3';
import { readdirSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

const __dirname = dirname(fileURLToPath(import.meta.url));
const MIGRATIONS_DIR = join(__dirname, '../../src-tauri/migrations');
const MIGRATION_FILES = readdirSync(MIGRATIONS_DIR)
  .filter((f) => f.endsWith('.sql'))
  .sort(); // "0001_init.sql", "0002_recurrences.sql"... ordena igual ao número do arquivo

let db: Database.Database;

beforeEach(() => {
  db = new Database(':memory:');
  db.pragma('foreign_keys = ON');
  for (const file of MIGRATION_FILES) {
    db.exec(readFileSync(join(MIGRATIONS_DIR, file), 'utf-8'));
  }
});

afterEach(() => {
  db.close();
});

describe('migration 0001_init', () => {
  it('cria as 12 categorias iniciais sugeridas (docs/data-model.md)', () => {
    const { total } = db.prepare('SELECT COUNT(*) AS total FROM categories').get() as {
      total: number;
    };
    expect(total).toBe(12);

    const mercado = db.prepare('SELECT group_kind FROM categories WHERE name = ?').get('Mercado') as
      | { group_kind: string }
      | undefined;
    expect(mercado?.group_kind).toBe('need');
  });

  it('rejeita conta com kind fora do enum', () => {
    expect(() =>
      db
        .prepare('INSERT INTO accounts (name, kind, opening_balance_cents) VALUES (?, ?, ?)')
        .run('Poupança mágica', 'invalido', 0),
    ).toThrow(/CHECK constraint failed/);
  });

  it('rejeita lançamento com valor zero ou negativo', () => {
    const accountId = insertChecking(db);
    expect(() =>
      db
        .prepare(
          `INSERT INTO transactions (kind, account_id, amount_cents, purchased_on, effective_on, description)
           VALUES ('expense', ?, 0, '2025-10-01', '2025-10-01', 'Teste')`,
        )
        .run(accountId),
    ).toThrow(/CHECK constraint failed/);
  });

  it('rejeita lançamento apontando para conta inexistente (foreign key)', () => {
    expect(() =>
      db
        .prepare(
          `INSERT INTO transactions (kind, account_id, amount_cents, purchased_on, effective_on, description)
           VALUES ('expense', 999, 1000, '2025-10-01', '2025-10-01', 'Teste')`,
        )
        .run(),
    ).toThrow(/FOREIGN KEY constraint failed/);
  });

  it('rejeita categoria duplicada (UNIQUE)', () => {
    expect(() =>
      db.prepare("INSERT INTO categories (name, group_kind) VALUES ('Mercado', 'need')").run(),
    ).toThrow(/UNIQUE constraint failed/);
  });

  it('apaga transaction_tags junto ao apagar o lançamento (ON DELETE CASCADE)', () => {
    const accountId = insertChecking(db);
    const txResult = db
      .prepare(
        `INSERT INTO transactions (kind, account_id, amount_cents, purchased_on, effective_on, description)
         VALUES ('expense', ?, 1500, '2025-10-01', '2025-10-01', 'Mercado')`,
      )
      .run(accountId);
    const txId = txResult.lastInsertRowid;

    const tagResult = db.prepare("INSERT INTO tags (name) VALUES ('essencial')").run();
    db.prepare('INSERT INTO transaction_tags (transaction_id, tag_id) VALUES (?, ?)').run(
      txId,
      tagResult.lastInsertRowid,
    );

    db.prepare('DELETE FROM transactions WHERE id = ?').run(txId);

    const { total } = db
      .prepare('SELECT COUNT(*) AS total FROM transaction_tags WHERE transaction_id = ?')
      .get(txId) as { total: number };
    expect(total).toBe(0);
  });

  it('aceita um lançamento válido de ponta a ponta', () => {
    const accountId = insertChecking(db);
    const categoryId = (
      db.prepare('SELECT id FROM categories WHERE name = ?').get('Mercado') as { id: number }
    ).id;

    const result = db
      .prepare(
        `INSERT INTO transactions (kind, account_id, category_id, amount_cents, purchased_on, effective_on, description)
         VALUES ('expense', ?, ?, 15695, '2025-10-12', '2025-10-12', 'Compra da semana')`,
      )
      .run(accountId, categoryId);

    expect(result.changes).toBe(1);
  });
});

describe('migration 0002_recurrences', () => {
  it('rejeita recorrência com dia do mês fora de 1-31', () => {
    const accountId = insertChecking(db);
    expect(() =>
      db
        .prepare(
          `INSERT INTO recurrences (kind, description, amount_cents, day_of_month, account_id, starts_on)
           VALUES ('expense', 'Aluguel', 150000, 32, ?, '2025-01-01')`,
        )
        .run(accountId),
    ).toThrow(/CHECK constraint failed/);
  });

  it('rejeita recorrência com valor zero ou negativo', () => {
    const accountId = insertChecking(db);
    expect(() =>
      db
        .prepare(
          `INSERT INTO recurrences (kind, description, amount_cents, day_of_month, account_id, starts_on)
           VALUES ('expense', 'Aluguel', 0, 5, ?, '2025-01-01')`,
        )
        .run(accountId),
    ).toThrow(/CHECK constraint failed/);
  });

  it('impede duas ocorrências da mesma recorrência no mesmo dia (idempotência)', () => {
    const accountId = insertChecking(db);
    const recResult = db
      .prepare(
        `INSERT INTO recurrences (kind, description, amount_cents, day_of_month, account_id, starts_on)
         VALUES ('expense', 'Aluguel', 150000, 5, ?, '2025-01-01')`,
      )
      .run(accountId);
    const recurrenceId = recResult.lastInsertRowid;

    db.prepare(
      `INSERT INTO transactions (kind, account_id, amount_cents, purchased_on, effective_on, description, recurrence_id)
       VALUES ('expense', ?, 150000, '2025-03-05', '2025-03-05', 'Aluguel', ?)`,
    ).run(accountId, recurrenceId);

    expect(() =>
      db
        .prepare(
          `INSERT INTO transactions (kind, account_id, amount_cents, purchased_on, effective_on, description, recurrence_id)
           VALUES ('expense', ?, 150000, '2025-03-05', '2025-03-05', 'Aluguel', ?)`,
        )
        .run(accountId, recurrenceId),
    ).toThrow(/UNIQUE constraint failed/);
  });
});

function insertChecking(db: Database.Database): number {
  const result = db
    .prepare("INSERT INTO accounts (name, kind, opening_balance_cents) VALUES ('Conta corrente', 'checking', 0)")
    .run();
  return result.lastInsertRowid as number;
}
