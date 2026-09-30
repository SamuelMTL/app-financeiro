import type { SpendEntry } from '../planning/spending';
import type { Category } from '../types';

/**
 * Análise usa o mesmo gasto do mês do planejamento (data da compra, estornos
 * descontando), mas **sem o grupo Investimento**: aporte não é "saída", aparece
 * à parte — igual às telas de referência (Saiu × Aportes).
 */
export function outflowEntries(entries: SpendEntry[], categories: Category[]): SpendEntry[] {
  const groupById = new Map(categories.map((c) => [c.id, c.groupKind]));
  return entries.filter(
    ({ tx }) => tx.categoryId === null || groupById.get(tx.categoryId) !== 'invest',
  );
}

export const sumEntries = (entries: SpendEntry[]): number =>
  Math.max(0, entries.reduce((sum, e) => sum + e.cents, 0));

export interface Variation {
  diffCents: number;
  /** Variação em décimos de ponto percentual (156 = +15,6%); `null` quando o mês anterior foi zero. */
  permille: number | null;
}

export function variation(currentCents: number, previousCents: number): Variation {
  return {
    diffCents: currentCents - previousCents,
    permille: previousCents > 0 ? Math.round(((currentCents - previousCents) * 1000) / previousCents) : null,
  };
}

export interface CategoryComparison extends Variation {
  category: Category;
  previousCents: number;
  currentCents: number;
}

/**
 * Categorias lado a lado, das que mais cresceram para as que mais caíram (US-19).
 * Categoria que não existia no mês anterior (sem base para %) vem primeiro.
 */
export function compareCategories(
  categories: Category[],
  current: Map<number, number>,
  previous: Map<number, number>,
): CategoryComparison[] {
  const rows = categories
    .filter((c) => c.groupKind !== 'invest' && c.groupKind !== 'income' && c.groupKind !== 'neutral')
    .map((category): CategoryComparison => {
      const currentCents = Math.max(0, current.get(category.id) ?? 0);
      const previousCents = Math.max(0, previous.get(category.id) ?? 0);
      return { category, currentCents, previousCents, ...variation(currentCents, previousCents) };
    })
    .filter((r) => r.currentCents > 0 || r.previousCents > 0);

  return rows.sort((a, b) => {
    if (a.permille === null && b.permille !== null) return -1;
    if (b.permille === null && a.permille !== null) return 1;
    return (
      (b.permille ?? 0) - (a.permille ?? 0) ||
      b.diffCents - a.diffCents ||
      a.category.name.localeCompare(b.category.name)
    );
  });
}

/** Os `limit` maiores gastos do mês (lançamentos de gasto, sem estornos). */
export function topExpenses(entries: SpendEntry[], limit: number): SpendEntry[] {
  return entries
    .filter((e) => e.tx.kind === 'expense')
    .sort((a, b) => b.cents - a.cents || b.tx.id - a.tx.id)
    .slice(0, limit);
}

export interface MonthTotal {
  month: string;
  totalCents: number;
}
