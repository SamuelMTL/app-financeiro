export type AlertThreshold = 80 | 100;

export interface AlertSubject {
  /** `category:12` | `limit:credit` | `limit:debit_cash` — a mesma chave de `alert_events`. */
  subject: string;
  label: string;
  usedCents: number;
  plannedCents: number;
  alert80: boolean;
  alert100: boolean;
}

export interface AlertDecision {
  subject: AlertSubject;
  /** Limiares cruzados agora que ainda não tinham sido registrados neste mês. */
  newlyCrossed: AlertThreshold[];
  /** Único aviso a mostrar: o maior limiar novo que está habilitado (ou `null`). */
  notify: AlertThreshold | null;
}

export function crossedThresholds(usedCents: number, plannedCents: number): AlertThreshold[] {
  if (plannedCents <= 0 || usedCents <= 0) return [];
  const crossed: AlertThreshold[] = [];
  if (usedCents * 100 >= plannedCents * 80) crossed.push(80);
  if (usedCents >= plannedCents) crossed.push(100);
  return crossed;
}

/**
 * Decide quais alertas disparar (US-11): cada limiar dispara **uma vez por mês por
 * item**. `fired` são as chaves `subject|limiar` já registradas em `alert_events`.
 * Se um gasto pula de 50% para 105%, só o aviso de 100% aparece, mas os dois
 * limiares são registrados — o de 80% não volta a disparar depois.
 */
export function decideAlerts(subjects: AlertSubject[], fired: Set<string>): AlertDecision[] {
  const decisions: AlertDecision[] = [];
  for (const subject of subjects) {
    const newlyCrossed = crossedThresholds(subject.usedCents, subject.plannedCents).filter(
      (t) => !fired.has(`${subject.subject}|${t}`),
    );
    if (newlyCrossed.length === 0) continue;
    const enabled = newlyCrossed.filter((t) => (t === 80 ? subject.alert80 : subject.alert100));
    decisions.push({ subject, newlyCrossed, notify: enabled.length > 0 ? Math.max(...enabled) as AlertThreshold : null });
  }
  return decisions;
}

export function alertMessage(subject: AlertSubject, threshold: AlertThreshold): { title: string; body: string } {
  const pct = Math.round((subject.usedCents * 1000) / subject.plannedCents) / 10;
  return {
    title: threshold === 100 ? `${subject.label} passou de 100%` : `${subject.label} passou de 80%`,
    body: `${pct.toFixed(1).replace('.', ',')}% do planejado`,
  };
}
