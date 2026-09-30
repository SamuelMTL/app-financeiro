# Modelo de dados (SQLite)

Esboço inicial. Ajuste conforme necessário, mas mantenha: valores em centavos, datas ISO, migrations versionadas.

```sql
CREATE TABLE accounts (
  id INTEGER PRIMARY KEY,
  name TEXT NOT NULL,
  kind TEXT NOT NULL CHECK (kind IN ('checking','cash','credit_card')),
  opening_balance_cents INTEGER NOT NULL DEFAULT 0,
  credit_limit_cents INTEGER,            -- só cartão
  closing_day INTEGER,                   -- só cartão (1-31)
  due_day INTEGER,                       -- só cartão (1-31)
  archived INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE categories (
  id INTEGER PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  group_kind TEXT NOT NULL CHECK (group_kind IN ('need','want','invest','income','neutral'))
);

CREATE TABLE recurrences (
  id INTEGER PRIMARY KEY,
  kind TEXT NOT NULL CHECK (kind IN ('expense','income')),
  description TEXT NOT NULL,
  amount_cents INTEGER NOT NULL,
  day_of_month INTEGER NOT NULL,
  account_id INTEGER NOT NULL REFERENCES accounts(id),
  category_id INTEGER REFERENCES categories(id),
  starts_on TEXT NOT NULL,
  ends_on TEXT
);

CREATE TABLE transactions (
  id INTEGER PRIMARY KEY,
  kind TEXT NOT NULL CHECK (kind IN ('expense','income','transfer','card_payment','refund')),
  account_id INTEGER NOT NULL REFERENCES accounts(id),
  dest_account_id INTEGER REFERENCES accounts(id),      -- transfer / card_payment
  category_id INTEGER REFERENCES categories(id),
  amount_cents INTEGER NOT NULL CHECK (amount_cents > 0),
  purchased_on TEXT NOT NULL,                            -- data da compra (competência)
  effective_on TEXT NOT NULL,                            -- data em que afeta caixa/fatura
  description TEXT NOT NULL,
  notes TEXT,
  installment_group_id TEXT,
  installment_no INTEGER,
  installments_total INTEGER,
  recurrence_id INTEGER REFERENCES recurrences(id),
  refund_of_id INTEGER REFERENCES transactions(id),
  statement_id INTEGER REFERENCES statements(id),
  import_hash TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE (recurrence_id, effective_on)                   -- idempotência das recorrências
);
CREATE INDEX idx_tx_purchased ON transactions(purchased_on);
CREATE INDEX idx_tx_effective ON transactions(effective_on);
CREATE INDEX idx_tx_hash ON transactions(account_id, import_hash);

CREATE TABLE tags (id INTEGER PRIMARY KEY, name TEXT NOT NULL UNIQUE);
CREATE TABLE transaction_tags (
  transaction_id INTEGER NOT NULL REFERENCES transactions(id) ON DELETE CASCADE,
  tag_id INTEGER NOT NULL REFERENCES tags(id),
  PRIMARY KEY (transaction_id, tag_id)
);

CREATE TABLE statements (                                -- faturas de cartão
  id INTEGER PRIMARY KEY,
  account_id INTEGER NOT NULL REFERENCES accounts(id),
  month TEXT NOT NULL,                                   -- 'YYYY-MM' da fatura
  due_on TEXT NOT NULL,
  paid_by_transaction_id INTEGER REFERENCES transactions(id),
  UNIQUE (account_id, month)
);

CREATE TABLE budgets (
  month TEXT NOT NULL,
  category_id INTEGER NOT NULL REFERENCES categories(id),
  planned_cents INTEGER NOT NULL,
  alert_80 INTEGER NOT NULL DEFAULT 1,
  alert_100 INTEGER NOT NULL DEFAULT 1,
  PRIMARY KEY (month, category_id)
);

CREATE TABLE payment_limits (                            -- tetos por forma de pagamento
  month TEXT NOT NULL,
  method TEXT NOT NULL CHECK (method IN ('credit','debit_cash')),
  limit_cents INTEGER NOT NULL,
  alert_80 INTEGER NOT NULL DEFAULT 1,
  alert_100 INTEGER NOT NULL DEFAULT 1,
  PRIMARY KEY (month, method)
);

CREATE TABLE goals (                                     -- meta de investimento
  month TEXT PRIMARY KEY,
  amount_cents INTEGER,                                  -- ou
  percent_of_income REAL                                 -- um dos dois
);

CREATE TABLE distribution_plan (
  month TEXT PRIMARY KEY,
  need_pct REAL NOT NULL DEFAULT 50,
  want_pct REAL NOT NULL DEFAULT 30,
  invest_pct REAL NOT NULL DEFAULT 20
);

CREATE TABLE alert_events (                              -- garante 1 disparo por limiar/mês
  month TEXT NOT NULL,
  subject TEXT NOT NULL,                                 -- 'category:12' | 'limit:credit'
  threshold INTEGER NOT NULL,                            -- 80 | 100
  fired_at TEXT NOT NULL DEFAULT (datetime('now')),
  PRIMARY KEY (month, subject, threshold)
);

CREATE TABLE closed_months (
  month TEXT PRIMARY KEY,
  closed_at TEXT NOT NULL,
  reopened_at TEXT
);
```

## Criação de faturas (`statements`)
Uma linha de `statements` nasce de forma **preguiçosa (lazy)**: quando o primeiro lançamento de um cartão cai em um período de fechamento que ainda não tem fatura criada (`account_id` + `month` correspondentes), o domínio cria a linha antes de gravar o lançamento. `due_on` é calculado a partir do `due_day` do cartão. Não há job nem tela que precomputa faturas futuras vazias — elas só existem quando há pelo menos um lançamento nelas. Isso vale tanto para lançamento manual quanto para importação (Fase 3) e para o cálculo de "faturas a vencer no mês" do saldo previsto (Fase 4): uma fatura sem nenhum lançamento simplesmente não existe e não entra em nenhum total.

## Bloqueio de mês fechado
Criar triggers `BEFORE INSERT/UPDATE/DELETE` em `transactions`, `budgets`, `payment_limits` que abortem quando `strftime('%Y-%m', purchased_on)` (ou o mês do orçamento) estiver em `closed_months` com `reopened_at IS NULL`. Além disso, o domínio valida antes e devolve um erro legível.

## Categorias iniciais sugeridas
Necessidade: Moradia, Mercado, Transporte, Saúde. Querer: Restaurantes, Lazer, Assinaturas, Compras. Investimento: Investimento. Renda: Renda. Neutro: Transferência, Fatura.
