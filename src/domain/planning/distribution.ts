import type { Category, CategoryGroup } from '../types';

export type DistributionGroup = Extract<CategoryGroup, 'need' | 'want' | 'invest'>;

export interface DistributionPlan {
  needPct: number;
  wantPct: number;
  investPct: number;
}

export const DEFAULT_DISTRIBUTION: DistributionPlan = { needPct: 50, wantPct: 30, investPct: 20 };

/** A distribuição planejada precisa somar 100%. */
export function validateDistribution(plan: DistributionPlan): string[] {
  const errors: string[] = [];
  for (const value of [plan.needPct, plan.wantPct, plan.investPct]) {
    if (!Number.isFinite(value) || value < 0 || value > 100) {
      errors.push('Cada percentual precisa estar entre 0 e 100.');
      break;
    }
  }
  if (Math.abs(plan.needPct + plan.wantPct + plan.investPct - 100) >= 0.01) {
    errors.push('Os três percentuais precisam somar 100%.');
  }
  return errors;
}

/**
 * Renda do mês = rendas lançadas (por data da compra). Se ainda não há nenhuma,
 * usa as previstas (recorrências de renda ativas) — docs/business-rules.md.
 */
export function monthIncomeCents(bookedIncomeCents: number, expectedIncomeCents: number): number {
  return bookedIncomeCents > 0 ? bookedIncomeCents : expectedIncomeCents;
}

export interface DistributionLine {
  group: DistributionGroup;
  plannedPct: number;
  /** Realizado em décimos de ponto percentual da renda (371 = 37,1%); `null` sem renda. */
  realizedPermille: number | null;
  realizedCents: number;
  plannedCents: number;
}

/** Planejado × realizado de cada grupo, em % da renda do mês (US-13). */
export function buildDistribution(
  plan: DistributionPlan,
  incomeCents: number,
  spentByGroup: Record<CategoryGroup, number>,
): DistributionLine[] {
  const rows: [DistributionGroup, number][] = [
    ['need', plan.needPct],
    ['want', plan.wantPct],
    ['invest', plan.investPct],
  ];
  return rows.map(([group, plannedPct]) => {
    const realizedCents = Math.max(0, spentByGroup[group]);
    return {
      group,
      plannedPct,
      realizedCents,
      plannedCents: Math.round((incomeCents * plannedPct) / 100),
      realizedPermille: incomeCents > 0 ? Math.round((realizedCents * 1000) / incomeCents) : null,
    };
  });
}

export function groupOfCategories(categories: Category[], categoryId: number): CategoryGroup | null {
  return categories.find((c) => c.id === categoryId)?.groupKind ?? null;
}
