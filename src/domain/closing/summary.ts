import type { TxLite } from '../overview/types';
import { outflowEntries, sumEntries } from '../analysis/analysis';
import { monthlySpend, spentByGroup, type SpendOptions } from '../planning/spending';
import type { PlanningView } from '../planning/view';
import type { Category, Statement } from '../types';

export interface Deviation {
  kind: 'over-budget' | 'invest-short';
  label: string;
  realizedCents: number;
  plannedCents: number;
  /** `over-budget`: quanto passou; `invest-short`: quanto faltou. Sempre positivo. */
  diffCents: number;
  /** realizado / planejado, em % inteiro (145 = 145%). */
  pct: number;
}

export interface MonthSummary {
  month: string;
  entrouCents: number;
  saiuCents: number;
  aportesCents: number;
  /** `entrou − saiu − aportes`. */
  sobrouCents: number;
  deviations: Deviation[];
}

/**
 * Resumo ao fechar o mês (US-21): entrou (rendas lançadas), saiu (gastos sem
 * investimento), aportes (categorias do grupo Investimento) e sobrou. "Fugiu do
 * planejado": categoria de gasto acima do planejado e meta de investimento não
 * atingida. Investimento acima do planejado não é desvio.
 */
export function buildMonthSummary(input: {
  month: string;
  txs: TxLite[];
  statements: Statement[];
  categories: Category[];
  view: PlanningView;
  options: SpendOptions;
}): MonthSummary {
  const { month, txs, statements, categories, view, options } = input;
  const entries = monthlySpend(txs, statements, month, options);
  const entrouCents = txs
    .filter((t) => t.kind === 'income' && t.purchasedOn.slice(0, 7) === month)
    .reduce((sum, t) => sum + t.amountCents, 0);
  const saiuCents = sumEntries(outflowEntries(entries, categories));
  const aportesCents = Math.max(0, spentByGroup(entries, categories).invest);

  const deviations: Deviation[] = view.lines
    .filter((l) => l.category.groupKind !== 'invest' && l.plannedCents > 0 && l.realizedCents > l.plannedCents)
    .map((l): Deviation => ({
      kind: 'over-budget',
      label: l.category.name,
      realizedCents: l.realizedCents,
      plannedCents: l.plannedCents,
      diffCents: l.realizedCents - l.plannedCents,
      pct: Math.round((l.realizedCents * 100) / l.plannedCents),
    }))
    .sort((a, b) => b.diffCents - a.diffCents);

  if (view.goal && view.goal.targetCents > 0 && view.goal.investedCents < view.goal.targetCents) {
    deviations.push({
      kind: 'invest-short',
      label: 'Aporte em investimento',
      realizedCents: view.goal.investedCents,
      plannedCents: view.goal.targetCents,
      diffCents: view.goal.targetCents - view.goal.investedCents,
      pct: Math.round((view.goal.investedCents * 100) / view.goal.targetCents),
    });
  }

  return {
    month,
    entrouCents,
    saiuCents,
    aportesCents,
    sobrouCents: entrouCents - saiuCents - aportesCents,
    deviations,
  };
}
