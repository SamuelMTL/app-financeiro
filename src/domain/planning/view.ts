import type { TxLite } from '../overview/types';
import type { Account, Category, Statement } from '../types';
import type { AlertSubject } from './alerts';
import { buildBudgetLines, type BudgetLine, type BudgetRow } from './budget';
import {
  buildDistribution,
  DEFAULT_DISTRIBUTION,
  monthIncomeCents,
  type DistributionLine,
  type DistributionPlan,
} from './distribution';
import { goalProgress, type GoalInput, type GoalProgress } from './goal';
import {
  monthlySpend,
  spentByCategory,
  spentByGroup,
  spentByMethod,
  type PaymentMethod,
  type SpendOptions,
} from './spending';
import { remainingCents, usagePermille, usageStatus, type UsageStatus } from './usage';

export interface LimitRow {
  month: string;
  method: PaymentMethod;
  limitCents: number;
  alert80: boolean;
  alert100: boolean;
}

export const METHOD_LABEL: Record<PaymentMethod, string> = {
  credit: 'Crédito',
  debit_cash: 'Débito, Pix e dinheiro',
};

export interface LimitLine {
  method: PaymentMethod;
  limitCents: number | null;
  usedCents: number;
  remainingCents: number | null;
  permille: number | null;
  status: UsageStatus;
  alert80: boolean;
  alert100: boolean;
}

export interface PlanningView {
  month: string;
  lines: BudgetLine[];
  limits: LimitLine[];
  incomeCents: number;
  distribution: DistributionLine[];
  goal: GoalProgress | null;
  /** Tudo que pode disparar alerta neste mês (categorias com orçamento + tetos definidos). */
  alertSubjects: AlertSubject[];
}

/** Junta gasto do mês, orçamento, tetos, distribuição e meta — uma só conta para Planejamento e Visão geral. */
export function buildPlanningView(input: {
  month: string;
  accounts: Account[];
  categories: Category[];
  txs: TxLite[];
  statements: Statement[];
  budgets: BudgetRow[];
  limits: LimitRow[];
  plan: DistributionPlan | null;
  goal: GoalInput | null;
  expectedIncomeCents: number;
  options: SpendOptions;
}): PlanningView {
  const { month, accounts, categories, txs, statements, budgets, limits, options } = input;
  const entries = monthlySpend(txs, statements, month, options);
  const byCategory = spentByCategory(entries);
  const byMethod = spentByMethod(entries, accounts);
  const byGroup = spentByGroup(entries, categories);

  const lines = buildBudgetLines(categories, budgets, byCategory);

  const limitLines: LimitLine[] = (['credit', 'debit_cash'] as PaymentMethod[]).map((method) => {
    const row = limits.find((l) => l.method === method);
    const usedCents = byMethod[method];
    return {
      method,
      limitCents: row?.limitCents ?? null,
      usedCents,
      remainingCents: row ? remainingCents(usedCents, row.limitCents) : null,
      permille: row ? usagePermille(usedCents, row.limitCents) : null,
      status: row ? usageStatus(usedCents, row.limitCents) : 'ok',
      alert80: row?.alert80 ?? true,
      alert100: row?.alert100 ?? true,
    };
  });

  const booked = txs
    .filter((t) => t.kind === 'income' && t.purchasedOn.slice(0, 7) === month)
    .reduce((sum, t) => sum + t.amountCents, 0);
  const incomeCents = monthIncomeCents(booked, input.expectedIncomeCents);

  const alertSubjects: AlertSubject[] = [
    ...lines
      .filter((l) => l.plannedCents > 0)
      .map((l) => ({
        subject: `category:${l.category.id}`,
        label: l.category.name,
        usedCents: l.realizedCents,
        plannedCents: l.plannedCents,
        alert80: l.alert80,
        alert100: l.alert100,
      })),
    ...limitLines
      .filter((l) => l.limitCents !== null && l.limitCents > 0)
      .map((l) => ({
        subject: `limit:${l.method}`,
        label: `Teto de ${METHOD_LABEL[l.method].toLowerCase()}`,
        usedCents: l.usedCents,
        plannedCents: l.limitCents as number,
        alert80: l.alert80,
        alert100: l.alert100,
      })),
  ];

  return {
    month,
    lines,
    limits: limitLines,
    incomeCents,
    distribution: buildDistribution(input.plan ?? DEFAULT_DISTRIBUTION, incomeCents, byGroup),
    goal: input.goal ? goalProgress(input.goal, incomeCents, byGroup.invest) : null,
    alertSubjects,
  };
}
