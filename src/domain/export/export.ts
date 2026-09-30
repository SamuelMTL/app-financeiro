/**
 * Exportação (US-22). Tudo aqui é leitura: monta tabelas a partir dos dados e
 * nunca grava nada. Dinheiro fica em centavos até a borda do arquivo.
 */
export type ExportCell = string | number | null | { money: number };
export interface Dataset {
  key: string;
  name: string;
  headers: string[];
  rows: ExportCell[][];
}

/** 123456 -> "1234,56" (decimal com vírgula, sem separador de milhar). */
export function moneyToBR(cents: number): string {
  const sign = cents < 0 ? '-' : '';
  const abs = Math.abs(cents);
  return `${sign}${Math.floor(abs / 100)},${String(abs % 100).padStart(2, '0')}`;
}

function csvField(value: string): string {
  return /[;"\r\n]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value;
}

function cellToText(cell: ExportCell): string {
  if (cell === null) return '';
  if (typeof cell === 'object') return moneyToBR(cell.money);
  return String(cell);
}

/** CSV para Excel brasileiro: UTF-8 com BOM, separador `;`, decimal com vírgula. */
export function toCsv(dataset: Pick<Dataset, 'headers' | 'rows'>): string {
  const lines = [dataset.headers, ...dataset.rows.map((r) => r.map(cellToText))];
  return '﻿' + lines.map((line) => line.map((f) => csvField(f)).join(';')).join('\r\n') + '\r\n';
}

/** Período opcional (`YYYY-MM`, inclusive nos dois extremos). */
export interface Period {
  from: string | null;
  to: string | null;
}

export function inPeriod(month: string, period: Period): boolean {
  return (period.from === null || month >= period.from) && (period.to === null || month <= period.to);
}
