import { compareCategories, outflowEntries, sumEntries, topExpenses, variation, type CategoryComparison, type MonthTotal, type Variation } from '../domain/analysis/analysis';
import { addMonths } from '../domain/dates';
import { monthlySpend, spentByCategory, type SpendEntry } from '../domain/planning/spending';
import type { Category } from '../domain/types';
import { listCategories } from './categories';
import { loadOverviewData } from './overview';
import { getSpendOptions } from './settings';

export interface AnalysisData {
  month: string;
  previousMonth: string;
  categories: Category[];
  series: MonthTotal[]; // últimos 6 meses, terminando em `month`
  total: Variation & { currentCents: number; previousCents: number };
  growth: CategoryComparison[];
  top: SpendEntry[];
}

/** Comparativo entre meses, maiores gastos e categorias que mais cresceram (US-18, US-19). */
export async function loadAnalysis(month: string): Promise<AnalysisData> {
  const [data, categories] = await Promise.all([loadOverviewData(), listCategories()]);
  const options = getSpendOptions();
  const outflows = (m: string) => outflowEntries(monthlySpend(data.txs, data.statements, m, options), categories);

  const current = outflows(month);
  const previousMonth = addMonths(month, -1);
  const previous = outflows(previousMonth);
  const currentCents = sumEntries(current);
  const previousCents = sumEntries(previous);

  return {
    month,
    previousMonth,
    categories,
    series: Array.from({ length: 6 }, (_, i) => addMonths(month, i - 5)).map((m) => ({
      month: m,
      totalCents: sumEntries(outflows(m)),
    })),
    total: { currentCents, previousCents, ...variation(currentCents, previousCents) },
    growth: compareCategories(categories, spentByCategory(current), spentByCategory(previous)),
    top: topExpenses(current, 5),
  };
}
