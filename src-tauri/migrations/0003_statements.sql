-- Fase 3 — importação de fatura. `transactions.statement_id` já existe desde a
-- migration inicial (sem FK, a tabela não existia ainda); continua sem FK, mesmo
-- motivo do `recurrence_id` na migration 0002.

CREATE TABLE statements (
  id INTEGER PRIMARY KEY,
  account_id INTEGER NOT NULL REFERENCES accounts(id),
  month TEXT NOT NULL,                                   -- 'YYYY-MM' da fatura
  due_on TEXT NOT NULL,
  paid_by_transaction_id INTEGER REFERENCES transactions(id),
  UNIQUE (account_id, month)
);

-- "Importar duas vezes a mesma fatura não duplica nada" (docs/roadmap.md) — índice
-- único garante isso no banco, não só na tela de conferência (que já filtra
-- duplicados antes de mostrar, mas isso é defesa em profundidade: mesmo uma
-- confirmação repetida após falha parcial não duplica). Parcial (WHERE ... NOT
-- NULL) porque lançamentos manuais não têm import_hash.
CREATE UNIQUE INDEX idx_tx_import_hash_unique
  ON transactions(account_id, import_hash)
  WHERE import_hash IS NOT NULL;
