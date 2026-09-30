const MONTHS_SHORT = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
const MONTHS_LONG = [
  'janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho',
  'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro',
];

/** `"2026-11"` -> `"Nov"` */
export function monthShort(month: string): string {
  return MONTHS_SHORT[Number(month.slice(5, 7)) - 1];
}

/** `"2026-11"` -> `"novembro de 2026"` */
export function monthLong(month: string): string {
  return `${MONTHS_LONG[Number(month.slice(5, 7)) - 1]} de ${month.slice(0, 4)}`;
}

/** `"2026-10-20"` -> `"20/10"` */
export function dayMonth(dateISO: string): string {
  return `${dateISO.slice(8, 10)}/${dateISO.slice(5, 7)}`;
}

/** `"2026-10-12"` -> `"12 de outubro de 2026"` */
export function dateLong(dateISO: string): string {
  return `${Number(dateISO.slice(8, 10))} de ${monthLong(dateISO.slice(0, 7))}`;
}
