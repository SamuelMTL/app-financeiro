/** Migration 0004: CHECKs e chaves do planejamento, contra o SQLite de verdade. */
import Database from 'better-sqlite3';
import { readdirSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

const dir = join(dirname(fileURLToPath(import.meta.url)), '../../src-tauri/migrations');
let db: Database.Database;

beforeEach(() => {
  db = new Database(':memory:');
  db.pragma('foreign_keys = ON');
  for (const f of readdirSync(dir).filter((x) => x.endsWith('.sql')).sort()) {
    db.exec(readFileSync(join(dir, f), 'utf-8'));
  }
});
afterEach(() => db.close());

describe('migration 0004_planning', () => {
  it('orçamento: uma linha por (mês, categoria) e planejado não negativo', () => {
    db.prepare("INSERT INTO budgets (month, category_id, planned_cents) VALUES ('2026-10', 1, 1000)").run();
    expect(() => db.prepare("INSERT INTO budgets (month, category_id, planned_cents) VALUES ('2026-10', 1, 5)").run()).toThrow();
    expect(() => db.prepare("INSERT INTO budgets (month, category_id, planned_cents) VALUES ('2026-10', 2, -1)").run()).toThrow();
  });

  it('teto: só crédito ou débito/Pix/dinheiro', () => {
    db.prepare("INSERT INTO payment_limits (month, method, limit_cents) VALUES ('2026-10', 'credit', 60000)").run();
    expect(() => db.prepare("INSERT INTO payment_limits (month, method, limit_cents) VALUES ('2026-10', 'pix', 1)").run()).toThrow();
  });

  it('meta: valor OU percentual, nunca os dois nem nenhum', () => {
    db.prepare("INSERT INTO goals (month, amount_cents) VALUES ('2026-10', 100000)").run();
    db.prepare("INSERT INTO goals (month, percent_of_income) VALUES ('2026-11', 20)").run();
    expect(() => db.prepare("INSERT INTO goals (month, amount_cents, percent_of_income) VALUES ('2026-12', 1, 1)").run()).toThrow();
    expect(() => db.prepare("INSERT INTO goals (month) VALUES ('2027-01')").run()).toThrow();
  });

  it('distribuição: precisa somar 100', () => {
    db.prepare("INSERT INTO distribution_plan (month) VALUES ('2026-10')").run(); // 50/30/20 padrão
    expect(() => db.prepare("INSERT INTO distribution_plan (month, need_pct, want_pct, invest_pct) VALUES ('2026-11', 50, 30, 30)").run()).toThrow();
  });

  it('alerta: o mesmo limiar no mesmo mês grava uma vez só (INSERT OR IGNORE não duplica)', () => {
    const ins = db.prepare("INSERT OR IGNORE INTO alert_events (month, subject, threshold) VALUES ('2026-10', 'category:3', 100)");
    expect(ins.run().changes).toBe(1);
    expect(ins.run().changes).toBe(0);
    expect(() => db.prepare("INSERT INTO alert_events (month, subject, threshold) VALUES ('2026-10', 'category:3', 90)").run()).toThrow();
  });
});
