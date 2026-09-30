import type { BudgetRow } from '../domain/planning/budget';
import { planCopyBudget } from '../domain/planning/budget';
import { validateDistribution, type DistributionPlan } from '../domain/planning/distribution';
import { validateGoal, type GoalInput } from '../domain/planning/goal';
import { paymentMethodOf, type PaymentMethod } from '../domain/planning/spending';
import { addMonths } from '../domain/dates';
import { buildPlanningView, METHOD_LABEL, type LimitRow, type PlanningView } from '../domain/planning/view';
import { listCategories } from './categories';
import { assertMonthOpen } from './closing';
import { getDb } from './db';
import { loadOverviewData } from './overview';
import { getSpendOptions } from './settings';

interface BudgetDbRow { month: string; category_id: number; planned_cents: number; alert_80: number; alert_100: number }
interface LimitDbRow { month: string; method: PaymentMethod; limit_cents: number; alert_80: number; alert_100: number }

export async function listBudgets(month: string): Promise<BudgetRow[]> {
  const db = await getDb();
  const rows = await db.select<BudgetDbRow[]>('SELECT * FROM budgets WHERE month = ?', [month]);
  return rows.map((r) => ({
    month: r.month,
    categoryId: r.category_id,
    plannedCents: r.planned_cents,
    alert80: r.alert_80 === 1,
    alert100: r.alert_100 === 1,
  }));
}

export async function saveBudget(row: BudgetRow): Promise<void> {
  if (!Number.isInteger(row.plannedCents) || row.plannedCents < 0) throw new Error('Valor planejado inválido.');
  await assertMonthOpen(row.month);
  const db = await getDb();
  await db.execute(
    `INSERT INTO budgets (month, category_id, planned_cents, alert_80, alert_100) VALUES (?, ?, ?, ?, ?)
     ON CONFLICT (month, category_id) DO UPDATE SET
       planned_cents = excluded.planned_cents, alert_80 = excluded.alert_80, alert_100 = excluded.alert_100`,
    [row.month, row.categoryId, row.plannedCents, row.alert80 ? 1 : 0, row.alert100 ? 1 : 0],
  );
}

export async function deleteBudget(month: string, categoryId: number): Promise<void> {
  await assertMonthOpen(month);
  const db = await getDb();
  await db.execute('DELETE FROM budgets WHERE month = ? AND category_id = ?', [month, categoryId]);
}

/** Copia o orçamento (e os tetos) do mês anterior. Devolve `needs-confirmation` se o mês já tem orçamento. */
export async function copyPreviousMonth(
  month: string,
  confirmed: boolean,
): Promise<{ kind: 'needs-confirmation'; existingCount: number } | { kind: 'copied'; count: number }> {
  await assertMonthOpen(month);
  const from = addMonths(month, -1);
  const [fromRows, existing] = await Promise.all([listBudgets(from), listBudgets(month)]);
  if (fromRows.length === 0) throw new Error('O mês anterior não tem orçamento para copiar.');
  const plan = planCopyBudget({ fromRows, toMonth: month, existingToRows: existing, confirmed });
  if (plan.kind === 'needs-confirmation') return plan;

  const db = await getDb();
  await db.execute('DELETE FROM budgets WHERE month = ?', [month]);
  for (const row of plan.rows) await saveBudget(row);

  for (const limit of await listLimits(from)) await saveLimit({ ...limit, month });
  return { kind: 'copied', count: plan.rows.length };
}

export async function listLimits(month: string): Promise<LimitRow[]> {
  const db = await getDb();
  const rows = await db.select<LimitDbRow[]>('SELECT * FROM payment_limits WHERE month = ?', [month]);
  return rows.map((r) => ({
    month: r.month,
    method: r.method,
    limitCents: r.limit_cents,
    alert80: r.alert_80 === 1,
    alert100: r.alert_100 === 1,
  }));
}

export async function saveLimit(row: LimitRow): Promise<void> {
  if (!Number.isInteger(row.limitCents) || row.limitCents < 0) throw new Error('Valor do teto inválido.');
  await assertMonthOpen(row.month);
  const db = await getDb();
  await db.execute(
    `INSERT INTO payment_limits (month, method, limit_cents, alert_80, alert_100) VALUES (?, ?, ?, ?, ?)
     ON CONFLICT (month, method) DO UPDATE SET
       limit_cents = excluded.limit_cents, alert_80 = excluded.alert_80, alert_100 = excluded.alert_100`,
    [row.month, row.method, row.limitCents, row.alert80 ? 1 : 0, row.alert100 ? 1 : 0],
  );
}

export async function deleteLimit(month: string, method: PaymentMethod): Promise<void> {
  await assertMonthOpen(month);
  const db = await getDb();
  await db.execute('DELETE FROM payment_limits WHERE month = ? AND method = ?', [month, method]);
}

export async function getGoal(month: string): Promise<GoalInput | null> {
  const db = await getDb();
  const rows = await db.select<{ amount_cents: number | null; percent_of_income: number | null }[]>(
    'SELECT amount_cents, percent_of_income FROM goals WHERE month = ?',
    [month],
  );
  return rows[0] ? { amountCents: rows[0].amount_cents, percentOfIncome: rows[0].percent_of_income } : null;
}

export async function saveGoal(month: string, goal: GoalInput | null): Promise<void> {
  await assertMonthOpen(month);
  const db = await getDb();
  if (goal === null) {
    await db.execute('DELETE FROM goals WHERE month = ?', [month]);
    return;
  }
  const errors = validateGoal(goal);
  if (errors.length > 0) throw new Error(errors.join(' '));
  await db.execute(
    `INSERT INTO goals (month, amount_cents, percent_of_income) VALUES (?, ?, ?)
     ON CONFLICT (month) DO UPDATE SET amount_cents = excluded.amount_cents, percent_of_income = excluded.percent_of_income`,
    [month, goal.amountCents, goal.percentOfIncome],
  );
}

export async function getDistributionPlan(month: string): Promise<DistributionPlan | null> {
  const db = await getDb();
  const rows = await db.select<{ need_pct: number; want_pct: number; invest_pct: number }[]>(
    'SELECT need_pct, want_pct, invest_pct FROM distribution_plan WHERE month = ?',
    [month],
  );
  return rows[0] ? { needPct: rows[0].need_pct, wantPct: rows[0].want_pct, investPct: rows[0].invest_pct } : null;
}

export async function saveDistributionPlan(month: string, plan: DistributionPlan): Promise<void> {
  await assertMonthOpen(month);
  const errors = validateDistribution(plan);
  if (errors.length > 0) throw new Error(errors.join(' '));
  const db = await getDb();
  await db.execute(
    `INSERT INTO distribution_plan (month, need_pct, want_pct, invest_pct) VALUES (?, ?, ?, ?)
     ON CONFLICT (month) DO UPDATE SET need_pct = excluded.need_pct, want_pct = excluded.want_pct, invest_pct = excluded.invest_pct`,
    [month, plan.needPct, plan.wantPct, plan.investPct],
  );
}

/** Renda prevista do mês: soma das recorrências de renda ativas (para quando nada foi lançado ainda). */
async function expectedIncomeCents(month: string): Promise<number> {
  const db = await getDb();
  const rows = await db.select<{ total: number | null }[]>(
    `SELECT SUM(amount_cents) AS total FROM recurrences
     WHERE kind = 'income' AND substr(starts_on, 1, 7) <= ? AND (ends_on IS NULL OR substr(ends_on, 1, 7) >= ?)`,
    [month, month],
  );
  return rows[0]?.total ?? 0;
}

/** Carrega tudo do mês e deixa o domínio calcular (Planejamento, Visão geral e alertas usam a mesma conta). */
export async function loadPlanningView(month: string): Promise<PlanningView & { planOrDefault: DistributionPlan | null; goalInput: GoalInput | null }> {
  const [data, categories, budgets, limits, plan, goal, expected] = await Promise.all([
    loadOverviewData(),
    listCategories(),
    listBudgets(month),
    listLimits(month),
    getDistributionPlan(month),
    getGoal(month),
    expectedIncomeCents(month),
  ]);
  const view = buildPlanningView({
    month,
    accounts: data.accounts,
    categories,
    txs: data.txs,
    statements: data.statements,
    budgets,
    limits,
    plan,
    goal,
    expectedIncomeCents: expected,
    options: getSpendOptions(),
  });
  return { ...view, planOrDefault: plan, goalInput: goal };
}

/** Teto e uso do mês da compra para a forma de pagamento da conta — alimenta o aviso do formulário (US-17). */
export async function getCeilingInfo(
  accountId: number,
  purchasedOn: string,
): Promise<{ limitCents: number; usedCents: number; label: string } | null> {
  const view = await loadPlanningView(purchasedOn.slice(0, 7));
  const accounts = (await loadOverviewData()).accounts;
  const account = accounts.find((a) => a.id === accountId);
  if (!account) return null;
  const line = view.limits.find((l) => l.method === paymentMethodOf(account));
  if (!line || line.limitCents === null) return null;
  return { limitCents: line.limitCents, usedCents: line.usedCents, label: `Teto de ${METHOD_LABEL[line.method]}` };
}
