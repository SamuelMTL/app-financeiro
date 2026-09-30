import { buildMonthSummary, type MonthSummary } from '../domain/closing/summary';
import { listCategories } from './categories';
import { loadOverviewData } from './overview';
import { loadPlanningView } from './planning';
import { getSpendOptions } from './settings';

/** Resumo do mês para a tela de fechamento (US-21). Só lê. */
export async function loadMonthSummary(month: string): Promise<MonthSummary> {
  const [data, categories, view] = await Promise.all([loadOverviewData(), listCategories(), loadPlanningView(month)]);
  return buildMonthSummary({ month, txs: data.txs, statements: data.statements, categories, view, options: getSpendOptions() });
}
