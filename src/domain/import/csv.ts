import Papa from 'papaparse';
import { parseToCents } from '../money';
import { isValidISODate } from '../dates';

export interface ParsedCsv {
  headers: string[];
  rows: string[][];
}

/** Papaparse detecta `,` vs `;` sozinho quando `delimiter` não é informado. */
export function parseCsvText(text: string): ParsedCsv {
  const result = Papa.parse<string[]>(text.trim(), { skipEmptyLines: true });
  const [headers, ...rows] = result.data;
  if (!headers) return { headers: [], rows: [] };
  return { headers, rows };
}

export type DateFormat = 'DD/MM/YYYY' | 'YYYY-MM-DD';

export interface ColumnMapping {
  dateColumn: string;
  descriptionColumn: string;
  amountColumn: string;
  dateFormat: DateFormat;
}

/**
 * Nomes de coluna são o melhor palpite (sem arquivo de exemplo real de PicPay/
 * Itaú Azul em mãos) — por isso o mapeamento é sempre editável na tela de
 * importação: se não bater com o cabeçalho real do arquivo, a pessoa ajusta.
 * Ver docs/business-rules.md: "um leitor por emissor... com mapeamento de colunas".
 */
export interface ReaderPreset {
  id: string;
  label: string;
  mapping: ColumnMapping;
}

export const READER_PRESETS: ReaderPreset[] = [
  {
    id: 'picpay',
    label: 'PicPay (cartão)',
    mapping: {
      dateColumn: 'Data',
      descriptionColumn: 'Descrição',
      amountColumn: 'Valor',
      dateFormat: 'DD/MM/YYYY',
    },
  },
  {
    id: 'itau_azul',
    label: 'Itaú Azul',
    mapping: {
      dateColumn: 'data',
      descriptionColumn: 'lançamento',
      amountColumn: 'valor',
      dateFormat: 'DD/MM/YYYY',
    },
  },
  {
    id: 'custom',
    label: 'Personalizado',
    mapping: { dateColumn: '', descriptionColumn: '', amountColumn: '', dateFormat: 'DD/MM/YYYY' },
  },
];

export function parseFileDate(value: string, format: DateFormat): string {
  const trimmed = value.trim();
  if (format === 'YYYY-MM-DD') {
    if (!isValidISODate(trimmed)) throw new Error(`Data inválida: "${value}"`);
    return trimmed;
  }

  const match = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(trimmed);
  if (!match) throw new Error(`Data inválida: "${value}"`);
  const [, day, month, year] = match;
  const iso = `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
  if (!isValidISODate(iso)) throw new Error(`Data inválida: "${value}"`);
  return iso;
}

export interface RawImportRow {
  rowIndex: number;
  purchasedOn: string;
  description: string;
  /** Sempre positivo — o sinal original (débito/crédito) não é usado aqui. */
  amountCents: number;
}

export interface MappingError {
  rowIndex: number;
  message: string;
}

export function applyMapping(
  parsed: ParsedCsv,
  mapping: ColumnMapping,
): { rows: RawImportRow[]; errors: MappingError[] } {
  const dateIdx = parsed.headers.indexOf(mapping.dateColumn);
  const descIdx = parsed.headers.indexOf(mapping.descriptionColumn);
  const amountIdx = parsed.headers.indexOf(mapping.amountColumn);

  if (dateIdx === -1 || descIdx === -1 || amountIdx === -1) {
    throw new Error('Alguma coluna mapeada não existe no arquivo. Confira o mapeamento.');
  }

  const rows: RawImportRow[] = [];
  const errors: MappingError[] = [];

  parsed.rows.forEach((cells, rowIndex) => {
    try {
      const purchasedOn = parseFileDate(cells[dateIdx] ?? '', mapping.dateFormat);
      const description = (cells[descIdx] ?? '').trim();
      if (description === '') throw new Error('Descrição vazia.');
      const amountCents = Math.abs(parseToCents(cells[amountIdx] ?? ''));
      rows.push({ rowIndex, purchasedOn, description, amountCents });
    } catch (err) {
      errors.push({ rowIndex, message: err instanceof Error ? err.message : String(err) });
    }
  });

  return { rows, errors };
}
