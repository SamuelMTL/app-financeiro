-- Fase 2 — recorrências. `transactions.recurrence_id` já existe desde a migration
-- inicial (sem FK, porque esta tabela não existia ainda); continua sem FK aqui
-- também — SQLite não permite adicionar constraint em coluna já existente sem
-- reescrever a tabela, e a integridade é garantida pelo domínio/IPC.

CREATE TABLE recurrences (
  id INTEGER PRIMARY KEY,
  kind TEXT NOT NULL CHECK (kind IN ('expense', 'income')),
  description TEXT NOT NULL,
  amount_cents INTEGER NOT NULL CHECK (amount_cents > 0),
  day_of_month INTEGER NOT NULL CHECK (day_of_month BETWEEN 1 AND 31),
  account_id INTEGER NOT NULL REFERENCES accounts(id),
  category_id INTEGER REFERENCES categories(id),
  starts_on TEXT NOT NULL,
  ends_on TEXT
);
