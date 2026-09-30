import type { Category, CategoryGroup } from '../types';
import { usagePermille, usageStatus, type UsageStatus } from './usage';

export interface BudgetRow {
  month: string;
  categoryId: number;
  plannedCents: number;
  alert80: boolean;
  alert100: boolean;
}

export interface BudgetLine {
  category: Category;
  plannedCents: number;
  realizedCents: number;
  permille: number | null;
  status: UsageStatus;
  alert80: boolean;
  alert100: boolean;
}

/**
 * Linhas do orçamento do mês: uma por categoria de gasto (Necessidade, Querer,
 * Investimento). Categoria sem orçamento aparece com planejado 0 se teve gasto.
 */
export function buildBudgetLines(
  categories: Category[],
  budgets: BudgetRow[],
  spentByCategory: Map<number, number>,
): BudgetLine[] {
  const spendable: CategoryGroup[] = ['need', 'want', 'invest'];
  const order: Record<string, number> = { need: 0, want: 1, invest: 2 };
  const budgetByCategory = new Map(budgets.map((b) => [b.categoryId, b]));

  return categories
    .filter((c) => spendable.includes(c.groupKind))
    .map((category): BudgetLine => {
      const budget = budgetByCategory.get(category.id);
      const plannedCents = budget?.plannedCents ?? 0;
      const realizedCents = Math.max(0, spentByCategory.get(category.id) ?? 0);
      return {
        category,
        plannedCents,
        realizedCents,
        permille: usagePermille(realizedCents, plannedCents),
        status: plannedCents > 0 || realizedCents > 0 ? usageStatus(realizedCents, plannedCents) : 'ok',
        alert80: budget?.alert80 ?? true,
        alert100: budget?.alert100 ?? true,
      };
    })
    .filter((line) => line.plannedCents > 0 || line.realizedCents > 0)
    .sort((a, b) => order[a.category.groupKind] - order[b.category.groupKind] || a.category.name.localeCompare(b.category.name));
}

export type CopyResult =
  | { kind: 'needs-confirmation'; existingCount: number }
  | { kind: 'copy'; rows: BudgetRow[] };

/**
 * Copiar o orçamento do mês anterior (US-14): copia planejado e alertas. Se o
 * mês de destino já tem orçamento, só copia depois de confirmado (`confirmed`),
 * e nesse caso substitui as linhas.
 */
export function planCopyBudget(input: {
  fromRows: BudgetRow[];
  toMonth: string;
  existingToRows: BudgetRow[];
  confirmed: boolean;
}): CopyResult {
  const { fromRows, toMonth, existingToRows, confirmed } = input;
  if (existingToRows.length > 0 && !confirmed) {
    return { kind: 'needs-confirmation', existingCount: existingToRows.length };
  }
  return { kind: 'copy', rows: fromRows.map((row) => ({ ...row, month: toMonth })) };
}
