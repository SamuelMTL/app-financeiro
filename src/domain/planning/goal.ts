export interface GoalInput {
  amountCents: number | null;
  percentOfIncome: number | null;
}

export function validateGoal(goal: GoalInput): string[] {
  const hasAmount = goal.amountCents !== null;
  const hasPercent = goal.percentOfIncome !== null;
  if (hasAmount === hasPercent) return ['Informe a meta em valor ou em % da renda (só um dos dois).'];
  if (hasAmount && (!Number.isInteger(goal.amountCents) || (goal.amountCents as number) < 0)) {
    return ['Valor da meta inválido.'];
  }
  if (hasPercent && (!(goal.percentOfIncome! >= 0) || goal.percentOfIncome! > 100)) {
    return ['O percentual da meta precisa estar entre 0 e 100.'];
  }
  return [];
}

export interface GoalProgress {
  targetCents: number;
  investedCents: number;
  missingCents: number;
  reached: boolean;
}

/** Meta de investimento do mês (US-12): alvo em valor fixo ou % da renda; aportado vs. alvo. */
export function goalProgress(goal: GoalInput, incomeCents: number, investedCents: number): GoalProgress {
  const targetCents =
    goal.amountCents !== null
      ? goal.amountCents
      : Math.round((incomeCents * (goal.percentOfIncome ?? 0)) / 100);
  const invested = Math.max(0, investedCents);
  return {
    targetCents,
    investedCents: invested,
    missingCents: Math.max(0, targetCents - invested),
    reached: targetCents > 0 && invested >= targetCents,
  };
}
