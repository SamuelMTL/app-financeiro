-- Fase 1 — base do app: contas/cartões, categorias, lançamentos, tags.
--
-- `transactions` já inclui as colunas de fases futuras (installment_*, recurrence_id,
-- refund_of_id, statement_id, import_hash) sem FK para tabelas que ainda não existem
-- (`recurrences` chega na Fase 2, `statements` na Fase 3): reshape de tabela com dados
-- é caro no SQLite, coluna NULL sem uso não custa nada. Ver docs/data-model.md.

PRAGMA foreign_keys = ON;

CREATE TABLE accounts (
  id INTEGER PRIMARY KEY,
  name TEXT NOT NULL,
  kind TEXT NOT NULL CHECK (kind IN ('checking', 'cash', 'credit_card')),
  opening_balance_cents INTEGER NOT NULL DEFAULT 0,
  credit_limit_cents INTEGER,            -- só cartão
  closing_day INTEGER,                   -- só cartão (1-31)
  due_day INTEGER,                       -- só cartão (1-31)
  archived INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE categories (
  id INTEGER PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  group_kind TEXT NOT NULL CHECK (group_kind IN ('need', 'want', 'invest', 'income', 'neutral'))
);

CREATE TABLE transactions (
  id INTEGER PRIMARY KEY,
  kind TEXT NOT NULL CHECK (kind IN ('expense', 'income', 'transfer', 'card_payment', 'refund')),
  account_id INTEGER NOT NULL REFERENCES accounts(id),
  dest_account_id INTEGER REFERENCES accounts(id),       -- transfer / card_payment
  category_id INTEGER REFERENCES categories(id),
  amount_cents INTEGER NOT NULL CHECK (amount_cents > 0),
  purchased_on TEXT NOT NULL,                            -- data da compra (competência)
  effective_on TEXT NOT NULL,                            -- data em que afeta caixa/fatura
  description TEXT NOT NULL,
  notes TEXT,
  installment_group_id TEXT,
  installment_no INTEGER,
  installments_total INTEGER,
  recurrence_id INTEGER,                                 -- FK para `recurrences` (Fase 2)
  refund_of_id INTEGER REFERENCES transactions(id),
  statement_id INTEGER,                                  -- FK para `statements` (Fase 3)
  import_hash TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE (recurrence_id, effective_on)                   -- idempotência das recorrências
);
CREATE INDEX idx_tx_purchased ON transactions(purchased_on);
CREATE INDEX idx_tx_effective ON transactions(effective_on);
CREATE INDEX idx_tx_hash ON transactions(account_id, import_hash);

CREATE TABLE tags (
  id INTEGER PRIMARY KEY,
  name TEXT NOT NULL UNIQUE
);

CREATE TABLE transaction_tags (
  transaction_id INTEGER NOT NULL REFERENCES transactions(id) ON DELETE CASCADE,
  tag_id INTEGER NOT NULL REFERENCES tags(id),
  PRIMARY KEY (transaction_id, tag_id)
);

-- Categorias iniciais sugeridas (docs/data-model.md)
INSERT INTO categories (name, group_kind) VALUES
  ('Moradia', 'need'),
  ('Mercado', 'need'),
  ('Transporte', 'need'),
  ('Saúde', 'need'),
  ('Restaurantes', 'want'),
  ('Lazer', 'want'),
  ('Assinaturas', 'want'),
  ('Compras', 'want'),
  ('Investimento', 'invest'),
  ('Renda', 'income'),
  ('Transferência', 'neutral'),
  ('Fatura', 'neutral');
