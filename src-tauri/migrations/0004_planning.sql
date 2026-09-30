-- Fase 5 — orçamento por categoria, tetos por forma de pagamento, distribuição
-- 50/30/20, meta de investimento e alertas (docs/data-model.md).
-- O bloqueio de mês fechado (triggers) chega na Fase 6, junto com `closed_months`.

CREATE TABLE budgets (
  month TEXT NOT NULL,
  category_id INTEGER NOT NULL REFERENCES categories(id),
  planned_cents INTEGER NOT NULL CHECK (planned_cents >= 0),
  alert_80 INTEGER NOT NULL DEFAULT 1,
  alert_100 INTEGER NOT NULL DEFAULT 1,
  PRIMARY KEY (month, category_id)
);

CREATE TABLE payment_limits (                            -- tetos por forma de pagamento
  month TEXT NOT NULL,
  method TEXT NOT NULL CHECK (method IN ('credit','debit_cash')),
  limit_cents INTEGER NOT NULL CHECK (limit_cents >= 0),
  alert_80 INTEGER NOT NULL DEFAULT 1,
  alert_100 INTEGER NOT NULL DEFAULT 1,
  PRIMARY KEY (month, method)
);

CREATE TABLE goals (                                     -- meta de investimento
  month TEXT PRIMARY KEY,
  amount_cents INTEGER CHECK (amount_cents IS NULL OR amount_cents >= 0),
  percent_of_income REAL CHECK (percent_of_income IS NULL OR (percent_of_income >= 0 AND percent_of_income <= 100)),
  CHECK ((amount_cents IS NULL) <> (percent_of_income IS NULL))   -- um dos dois
);

CREATE TABLE distribution_plan (
  month TEXT PRIMARY KEY,
  need_pct REAL NOT NULL DEFAULT 50,
  want_pct REAL NOT NULL DEFAULT 30,
  invest_pct REAL NOT NULL DEFAULT 20,
  CHECK (ABS(need_pct + want_pct + invest_pct - 100) < 0.01)
);

CREATE TABLE alert_events (                              -- garante 1 disparo por limiar/mês
  month TEXT NOT NULL,
  subject TEXT NOT NULL,                                 -- 'category:12' | 'limit:credit'
  threshold INTEGER NOT NULL CHECK (threshold IN (80, 100)),
  fired_at TEXT NOT NULL DEFAULT (datetime('now')),
  PRIMARY KEY (month, subject, threshold)
);
