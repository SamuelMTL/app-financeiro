import { currentMonthOf } from './months';

export interface ClosedMonth {
  month: string;
  closedAt: string; // YYYY-MM-DD
  reopenedAt: string | null;
}

/** O mês está fechado agora? (reaberto conta como aberto). */
export function isClosed(closed: ClosedMonth[], month: string): boolean {
  return closed.some((c) => c.month === month && c.reopenedAt === null);
}

/** Só dá para fechar mês que já começou e que ainda está aberto. */
export function validateClose(closed: ClosedMonth[], month: string, today: string): string[] {
  if (isClosed(closed, month)) return ['Este mês já está fechado.'];
  if (month > currentMonthOf(today)) return ['Não dá para fechar um mês que ainda não começou.'];
  return [];
}

/** Em que mês (YYYY-MM) cai uma data de lançamento — a mesma regra dos triggers do banco. */
export function monthOfDate(dateISO: string): string {
  return dateISO.slice(0, 7);
}

/** Erro legível para a tela, antes de tentar gravar (o trigger do banco continua sendo a garantia). */
export function closedMonthError(closed: ClosedMonth[], ...dates: string[]): string | null {
  for (const date of dates) {
    const month = monthOfDate(date);
    if (isClosed(closed, month)) {
      return `O mês ${month.slice(5, 7)}/${month.slice(0, 4)} está fechado. Reabra o mês em Fechamento para alterar.`;
    }
  }
  return null;
}
