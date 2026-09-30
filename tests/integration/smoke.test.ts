/**
 * Smoke tests de integração (Fase 6, docs/roadmap.md).
 *
 * Rodam as funções REAIS de `src/ipc/*` (as mesmas que a interface chama) contra um
 * SQLite de verdade com as migrations de verdade (`src-tauri/migrations`, incluindo
 * os triggers de mês fechado). A única peça trocada é o transporte: em vez do
 * `@tauri-apps/plugin-sql` (que só existe dentro da janela do Tauri), o teste
 * injeta um adaptador com a mesma interface (`select`/`execute`) sobre o
 * better-sqlite3. Não sobe a janela do Tauri — o tauri-driver não suporta macOS.
 */
import Database from 'better-sqlite3';
import { readdirSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const holder = vi.hoisted(() => ({ db: null as unknown as import('better-sqlite3').Database }));

vi.mock('@tauri-apps/plugin-sql', () => {
  const adapter = {
    select: async (sql: string, params: unknown[] = []) => holder.db.prepare(sql).all(...params),
    execute: async (sql: string, params: unknown[] = []) => {
      const r = holder.db.prepare(sql).run(...params);
      return { rowsAffected: r.changes, lastInsertId: Number(r.lastInsertRowid) };
    },
  };
  return { default: { load: async () => adapter } };
});

import { createAccount } from '../../src/ipc/accounts';
import { closeMonth, reopenMonth } from '../../src/ipc/closing';
import { confirmImport, previewImport } from '../../src/ipc/import';
import { saveBudget } from '../../src/ipc/planning';
import { generateOccurrencesForMonth, createRecurrence } from '../../src/ipc/recurrences';
import {
  createInstallmentPurchase,
  createTransaction,
  deleteTransaction,
  getTransaction,
  listTransactions,
  updateTransaction,
} from '../../src/ipc/transactions';

const dir = join(dirname(fileURLToPath(import.meta.url)), '../../src-tauri/migrations');

function freshDatabase() {
  const db = new Database(':memory:');
  db.pragma('foreign_keys = ON');
  for (const f of readdirSync(dir).filter((x) => x.endsWith('.sql')).sort()) {
    db.exec(readFileSync(join(dir, f), 'utf-8'));
  }
  return db;
}

const expense = (accountId: number, purchasedOn: string, over: Record<string, unknown> = {}) => ({
  kind: 'expense' as const, accountId, categoryId: null, amountCents: 10000, purchasedOn,
  description: 'Mercado', notes: null, tags: [] as string[], ...over,
});

let itauId: number;
let cardId: number;

beforeEach(async () => {
  holder.db = freshDatabase();
  itauId = (await createAccount({ name: 'Itaú', kind: 'checking', openingBalanceCents: 0, creditLimitCents: null, closingDay: null, dueDay: null })).id;
  cardId = (await createAccount({ name: 'PicPay', kind: 'credit_card', openingBalanceCents: 0, creditLimitCents: 800000, closingDay: 12, dueDay: 20 })).id;
});

describe('criar lançamento → fechar mês → tentar editar (deve bloquear)', () => {
  it('mês fechado recusa criar, editar, excluir e mudar tags, com mensagem legível', async () => {
    const tx = await createTransaction(expense(itauId, '2026-08-10', { tags: ['casa'] }));
    await closeMonth('2026-08');

    await expect(createTransaction(expense(itauId, '2026-08-20'))).rejects.toThrow(/fechado/);
    await expect(updateTransaction(tx.id, expense(itauId, '2026-08-10', { amountCents: 99 }))).rejects.toThrow(/fechado/);
    await expect(deleteTransaction(tx.id)).rejects.toThrow(/fechado/);
    // tirar um lançamento de um mês fechado movendo a data também é bloqueado
    await expect(updateTransaction(tx.id, expense(itauId, '2026-09-01'))).rejects.toThrow(/fechado/);

    const after = await getTransaction(tx.id);
    expect(after).toMatchObject({ amountCents: 10000, purchasedOn: '2026-08-10', tags: ['casa'] });
  });

  it('o trigger do banco barra mesmo por SQL direto, sem passar pela camada ipc', async () => {
    const tx = await createTransaction(expense(itauId, '2026-08-10'));
    await closeMonth('2026-08');
    const db = holder.db;
    expect(() => db.prepare('UPDATE transactions SET amount_cents = 1 WHERE id = ?').run(tx.id)).toThrow(/Mês fechado/);
    expect(() => db.prepare('DELETE FROM transactions WHERE id = ?').run(tx.id)).toThrow(/Mês fechado/);
    expect(() => db.prepare("INSERT INTO transactions (kind, account_id, amount_cents, purchased_on, effective_on, description) VALUES ('expense', ?, 1, '2026-08-30', '2026-08-30', 'x')").run(itauId)).toThrow(/Mês fechado/);
    db.prepare("INSERT INTO tags (name) VALUES ('t')").run();
    expect(() => db.prepare('INSERT INTO transaction_tags (transaction_id, tag_id) VALUES (?, 1)').run(tx.id)).toThrow(/Mês fechado/);
    expect(() => db.prepare("UPDATE transactions SET purchased_on = '2026-09-01' WHERE id = ?").run(tx.id)).toThrow(/Mês fechado/);
    // empurrar um lançamento de outro mês PARA dentro do mês fechado
    const other = await createTransaction(expense(itauId, '2026-09-05'));
    expect(() => db.prepare("UPDATE transactions SET purchased_on = '2026-08-05' WHERE id = ?").run(other.id)).toThrow(/Mês fechado/);
  });

  it('orçamento, parcelas, recorrências e importação também respeitam o mês fechado', async () => {
    await closeMonth('2026-08');
    await expect(saveBudget({ month: '2026-08', categoryId: 1, plannedCents: 1000, alert80: true, alert100: true })).rejects.toThrow(/fechado/);
    expect(() => holder.db.prepare("INSERT INTO budgets (month, category_id, planned_cents) VALUES ('2026-08', 1, 5)").run()).toThrow(/Mês fechado/);

    await expect(createInstallmentPurchase({
      accountId: cardId, categoryId: null, totalCents: 30000, installmentsTotal: 3, purchasedOn: '2026-08-05',
      description: 'TV', notes: null, tags: [], closingDay: 12,
    })).rejects.toThrow(/fechado/);
    expect(holder.db.prepare('SELECT COUNT(*) AS n FROM statements').get()).toEqual({ n: 0 }); // sem efeito colateral

    await createRecurrence({ kind: 'expense', description: 'Internet', amountCents: 9990, dayOfMonth: 15, accountId: itauId, categoryId: null, startsOn: '2026-01-01', endsOn: null });
    expect(await generateOccurrencesForMonth('2026-08')).toBe(0);
    expect(await generateOccurrencesForMonth('2026-09')).toBe(1);

    await expect(confirmImport(cardId, '2026-08', [{
      purchasedOn: '2026-08-03', description: 'Loja', amountCents: 5000, importHash: 'h1',
      categoryId: null, installmentNo: null, installmentsTotal: null, linkedGroupId: null,
    }])).rejects.toThrow(/fechado/);
  });

  it('reabrir libera a edição e registra a data; fechar de novo bloqueia outra vez', async () => {
    const tx = await createTransaction(expense(itauId, '2026-08-10'));
    await closeMonth('2026-08');
    await reopenMonth('2026-08');
    const row = holder.db.prepare("SELECT reopened_at FROM closed_months WHERE month = '2026-08'").get() as { reopened_at: string | null };
    expect(row.reopened_at).toMatch(/^\d{4}-\d{2}-\d{2}$/);

    await updateTransaction(tx.id, expense(itauId, '2026-08-10', { amountCents: 777 }));
    expect((await getTransaction(tx.id)).amountCents).toBe(777);

    await closeMonth('2026-08');
    await expect(deleteTransaction(tx.id)).rejects.toThrow(/fechado/);
    await expect(reopenMonth('2026-07')).rejects.toThrow(/não está fechado/);
  });

  it('meses vizinhos continuam editáveis', async () => {
    await closeMonth('2026-08');
    const ok = await createTransaction(expense(itauId, '2026-09-01'));
    expect(ok.id).toBeGreaterThan(0);
    expect(await listTransactions()).toHaveLength(1);
  });
});

describe('importar a mesma fatura duas vezes (não deve duplicar)', () => {
  const raw = [
    { rowIndex: 1, purchasedOn: '2026-09-03', description: 'Padaria Central', amountCents: 2550 },
    { rowIndex: 2, purchasedOn: '2026-09-05', description: 'Loja X 1/3', amountCents: 10000 },
  ];

  async function importOnce() {
    const preview = await previewImport(cardId, raw);
    const toSave = preview.filter((r) => r.status !== 'duplicate' && r.status !== 'review').map((r) => ({
      purchasedOn: r.purchasedOn, description: r.description, amountCents: r.amountCents, importHash: r.importHash,
      categoryId: r.suggestedCategoryId, installmentNo: r.installmentNo, installmentsTotal: r.installmentsTotal, linkedGroupId: r.linkedGroupId,
    }));
    return { preview, result: await confirmImport(cardId, '2026-09', toSave) };
  }

  it('segunda importação: tudo vira "já lançado" e nada novo é gravado', async () => {
    const first = await importOnce();
    expect(first.result.createdCount).toBe(2);
    const count = () => (holder.db.prepare('SELECT COUNT(*) AS n FROM transactions').get() as { n: number }).n;
    expect(count()).toBe(2);

    const second = await importOnce();
    expect(second.preview.every((r) => r.status === 'duplicate')).toBe(true);
    expect(second.result.createdCount).toBe(0);
    expect(count()).toBe(2);
  });

  it('mesmo forçando a confirmação repetida, o índice único barra duplicado', async () => {
    const rows = [{ purchasedOn: '2026-09-03', description: 'Padaria Central', amountCents: 2550, importHash: 'same', categoryId: null, installmentNo: null, installmentsTotal: null, linkedGroupId: null }];
    expect((await confirmImport(cardId, '2026-09', rows)).createdCount).toBe(1);
    expect(await confirmImport(cardId, '2026-09', rows)).toEqual({ createdCount: 0, skippedCount: 1 });
  });
});
