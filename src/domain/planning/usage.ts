export type UsageStatus = 'ok' | 'near' | 'over';

/**
 * Situação de um teto/orçamento (docs/business-rules.md): `< 80%` dentro;
 * `80–99%` perto; `≥ 100%` estourado. Aritmética inteira — sem float na borda.
 * Planejado 0 com algum gasto já é estourado.
 */
export function usageStatus(usedCents: number, plannedCents: number): UsageStatus {
  if (usedCents >= plannedCents && usedCents > 0) return 'over';
  if (usedCents * 100 >= plannedCents * 80 && usedCents > 0) return 'near';
  return 'ok';
}

/** Uso em décimos de ponto percentual (897 = 89,7%), arredondado. `null` se não há planejado. */
export function usagePermille(usedCents: number, plannedCents: number): number | null {
  if (plannedCents <= 0) return null;
  return Math.round((usedCents * 1000) / plannedCents);
}

/** `restante = planejado − usado`; negativo significa "acima". */
export function remainingCents(usedCents: number, plannedCents: number): number {
  return plannedCents - usedCents;
}

/** `897` -> `"89,7%"` */
export function formatPermille(permille: number): string {
  return `${(permille / 10).toFixed(1).replace('.', ',')}%`;
}

export const STATUS_LABEL: Record<UsageStatus, string> = {
  ok: 'Dentro do teto',
  near: 'Perto do teto',
  over: 'Acima do teto',
};
