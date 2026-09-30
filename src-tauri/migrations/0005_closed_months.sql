-- Fase 6 — fechamento de mês (docs/business-rules.md, "Fechamento de mês").
-- Mês fechado é imutável NO BANCO: os triggers abortam qualquer INSERT/UPDATE/DELETE
-- que toque um mês com `closed_months.reopened_at IS NULL`, venha de onde vier
-- (tela, importação, geração de recorrências, SQL direto).

CREATE TABLE closed_months (
  month TEXT PRIMARY KEY,
  closed_at TEXT NOT NULL,
  reopened_at TEXT
);

-- Lançamentos: o mês é o de `purchased_on` (competência). No UPDATE vale para o mês
-- antigo e para o novo — não dá para tirar um lançamento de um mês fechado nem
-- empurrar um para dentro dele.
CREATE TRIGGER tx_closed_month_insert BEFORE INSERT ON transactions
WHEN EXISTS (SELECT 1 FROM closed_months WHERE reopened_at IS NULL AND month = strftime('%Y-%m', NEW.purchased_on))
BEGIN SELECT RAISE(ABORT, 'Mês fechado: não é possível criar lançamentos neste mês.'); END;

CREATE TRIGGER tx_closed_month_update BEFORE UPDATE ON transactions
WHEN EXISTS (SELECT 1 FROM closed_months WHERE reopened_at IS NULL AND month IN (strftime('%Y-%m', OLD.purchased_on), strftime('%Y-%m', NEW.purchased_on)))
BEGIN SELECT RAISE(ABORT, 'Mês fechado: não é possível editar lançamentos deste mês.'); END;

CREATE TRIGGER tx_closed_month_delete BEFORE DELETE ON transactions
WHEN EXISTS (SELECT 1 FROM closed_months WHERE reopened_at IS NULL AND month = strftime('%Y-%m', OLD.purchased_on))
BEGIN SELECT RAISE(ABORT, 'Mês fechado: não é possível excluir lançamentos deste mês.'); END;

-- Tags são parte do lançamento: mexer nelas também altera o mês fechado.
CREATE TRIGGER txtag_closed_month_insert BEFORE INSERT ON transaction_tags
WHEN EXISTS (SELECT 1 FROM transactions t JOIN closed_months c ON c.month = strftime('%Y-%m', t.purchased_on) AND c.reopened_at IS NULL WHERE t.id = NEW.transaction_id)
BEGIN SELECT RAISE(ABORT, 'Mês fechado: não é possível alterar tags de lançamentos deste mês.'); END;

CREATE TRIGGER txtag_closed_month_delete BEFORE DELETE ON transaction_tags
WHEN EXISTS (SELECT 1 FROM transactions t JOIN closed_months c ON c.month = strftime('%Y-%m', t.purchased_on) AND c.reopened_at IS NULL WHERE t.id = OLD.transaction_id)
BEGIN SELECT RAISE(ABORT, 'Mês fechado: não é possível alterar tags de lançamentos deste mês.'); END;

-- Orçamento, tetos, meta e distribuição do mês (a chave é a coluna `month`).
CREATE TRIGGER budgets_closed_month_insert BEFORE INSERT ON budgets
WHEN EXISTS (SELECT 1 FROM closed_months WHERE reopened_at IS NULL AND month = NEW.month)
BEGIN SELECT RAISE(ABORT, 'Mês fechado: não é possível alterar o orçamento deste mês.'); END;
CREATE TRIGGER budgets_closed_month_update BEFORE UPDATE ON budgets
WHEN EXISTS (SELECT 1 FROM closed_months WHERE reopened_at IS NULL AND month IN (OLD.month, NEW.month))
BEGIN SELECT RAISE(ABORT, 'Mês fechado: não é possível alterar o orçamento deste mês.'); END;
CREATE TRIGGER budgets_closed_month_delete BEFORE DELETE ON budgets
WHEN EXISTS (SELECT 1 FROM closed_months WHERE reopened_at IS NULL AND month = OLD.month)
BEGIN SELECT RAISE(ABORT, 'Mês fechado: não é possível alterar o orçamento deste mês.'); END;

CREATE TRIGGER limits_closed_month_insert BEFORE INSERT ON payment_limits
WHEN EXISTS (SELECT 1 FROM closed_months WHERE reopened_at IS NULL AND month = NEW.month)
BEGIN SELECT RAISE(ABORT, 'Mês fechado: não é possível alterar os tetos deste mês.'); END;
CREATE TRIGGER limits_closed_month_update BEFORE UPDATE ON payment_limits
WHEN EXISTS (SELECT 1 FROM closed_months WHERE reopened_at IS NULL AND month IN (OLD.month, NEW.month))
BEGIN SELECT RAISE(ABORT, 'Mês fechado: não é possível alterar os tetos deste mês.'); END;
CREATE TRIGGER limits_closed_month_delete BEFORE DELETE ON payment_limits
WHEN EXISTS (SELECT 1 FROM closed_months WHERE reopened_at IS NULL AND month = OLD.month)
BEGIN SELECT RAISE(ABORT, 'Mês fechado: não é possível alterar os tetos deste mês.'); END;

CREATE TRIGGER goals_closed_month_insert BEFORE INSERT ON goals
WHEN EXISTS (SELECT 1 FROM closed_months WHERE reopened_at IS NULL AND month = NEW.month)
BEGIN SELECT RAISE(ABORT, 'Mês fechado: não é possível alterar a meta deste mês.'); END;
CREATE TRIGGER goals_closed_month_update BEFORE UPDATE ON goals
WHEN EXISTS (SELECT 1 FROM closed_months WHERE reopened_at IS NULL AND month IN (OLD.month, NEW.month))
BEGIN SELECT RAISE(ABORT, 'Mês fechado: não é possível alterar a meta deste mês.'); END;
CREATE TRIGGER goals_closed_month_delete BEFORE DELETE ON goals
WHEN EXISTS (SELECT 1 FROM closed_months WHERE reopened_at IS NULL AND month = OLD.month)
BEGIN SELECT RAISE(ABORT, 'Mês fechado: não é possível alterar a meta deste mês.'); END;

CREATE TRIGGER dist_closed_month_insert BEFORE INSERT ON distribution_plan
WHEN EXISTS (SELECT 1 FROM closed_months WHERE reopened_at IS NULL AND month = NEW.month)
BEGIN SELECT RAISE(ABORT, 'Mês fechado: não é possível alterar a distribuição deste mês.'); END;
CREATE TRIGGER dist_closed_month_update BEFORE UPDATE ON distribution_plan
WHEN EXISTS (SELECT 1 FROM closed_months WHERE reopened_at IS NULL AND month IN (OLD.month, NEW.month))
BEGIN SELECT RAISE(ABORT, 'Mês fechado: não é possível alterar a distribuição deste mês.'); END;
CREATE TRIGGER dist_closed_month_delete BEFORE DELETE ON distribution_plan
WHEN EXISTS (SELECT 1 FROM closed_months WHERE reopened_at IS NULL AND month = OLD.month)
BEGIN SELECT RAISE(ABORT, 'Mês fechado: não é possível alterar a distribuição deste mês.'); END;
