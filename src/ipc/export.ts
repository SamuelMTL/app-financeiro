import { save, open } from '@tauri-apps/plugin-dialog';
import { writeFile } from '@tauri-apps/plugin-fs';
import writeXlsxFile from 'write-excel-file/universal';
import {
  accountsDataset,
  budgetsDataset,
  categoriesDataset,
  goalsDataset,
  limitsDataset,
  transactionsDataset,
} from '../domain/export/datasets';
import { toCsv, type Dataset, type Period } from '../domain/export/export';
import { listAccounts } from './accounts';
import { listCategories } from './categories';
import { getDb } from './db';
import { listTransactions } from './transactions';

export interface ExportSelection {
  transactions: boolean;
  planning: boolean; // categorias, orçamentos, tetos e metas
  accounts: boolean;
}

/**
 * Monta as tabelas a exportar. **Só lê** — exportar nunca altera nada e funciona
 * a qualquer momento, inclusive com meses fechados (docs/business-rules.md).
 */
export async function gatherDatasets(selection: ExportSelection, period: Period): Promise<Dataset[]> {
  const datasets: Dataset[] = [];
  const [accounts, categories] = await Promise.all([listAccounts({ includeArchived: true }), listCategories()]);
  const db = await getDb();

  if (selection.transactions) {
    datasets.push(transactionsDataset(await listTransactions(), accounts, categories, period));
  }
  if (selection.planning) {
    const [budgets, limits, goals] = await Promise.all([
      db.select<{ month: string; category_id: number; planned_cents: number; alert_80: number; alert_100: number }[]>('SELECT * FROM budgets'),
      db.select<{ month: string; method: 'credit' | 'debit_cash'; limit_cents: number; alert_80: number; alert_100: number }[]>('SELECT * FROM payment_limits'),
      db.select<{ month: string; amount_cents: number | null; percent_of_income: number | null }[]>('SELECT * FROM goals'),
    ]);
    datasets.push(
      categoriesDataset(categories),
      budgetsDataset(
        budgets.map((b) => ({ month: b.month, categoryId: b.category_id, plannedCents: b.planned_cents, alert80: b.alert_80 === 1, alert100: b.alert_100 === 1 })),
        categories,
        period,
      ),
      limitsDataset(
        limits.map((l) => ({ month: l.month, method: l.method, limitCents: l.limit_cents, alert80: l.alert_80 === 1, alert100: l.alert_100 === 1 })),
        period,
      ),
      goalsDataset(
        goals.map((g) => ({ month: g.month, goal: { amountCents: g.amount_cents, percentOfIncome: g.percent_of_income } })),
        period,
      ),
    );
  }
  if (selection.accounts) datasets.push(accountsDataset(accounts));
  return datasets;
}

export async function xlsxBytes(datasets: Dataset[]): Promise<Uint8Array> {
  // Excel guarda números em ponto flutuante; a conversão centavos → reais acontece
  // só aqui, na borda do arquivo.
  const sheets = datasets.map((d) => ({
    sheet: d.name.slice(0, 31),
    data: [
      d.headers.map((h) => ({ value: h, fontWeight: 'bold' as const })),
      ...d.rows.map((row) =>
        row.map((cell) =>
          cell === null
            ? null
            : typeof cell === 'object'
              ? { value: cell.money / 100, type: Number, format: '#,##0.00' }
              : cell,
        ),
      ),
    ],
  }));
  const blob = await writeXlsxFile(sheets as never).toBlob();
  return new Uint8Array(await blob.arrayBuffer());
}

/** Devolve os caminhos gravados, ou `null` se a pessoa cancelou o diálogo. */
export async function saveExport(format: 'csv' | 'xlsx', datasets: Dataset[]): Promise<string[] | null> {
  if (datasets.length === 0) throw new Error('Selecione pelo menos um conteúdo para exportar.');

  if (format === 'xlsx') {
    const path = await save({ defaultPath: 'caderno.xlsx', filters: [{ name: 'Excel', extensions: ['xlsx'] }] });
    if (!path) return null;
    await writeFile(path, await xlsxBytes(datasets));
    return [path];
  }

  const encoder = new TextEncoder();
  if (datasets.length === 1) {
    const path = await save({ defaultPath: `caderno-${datasets[0].key}.csv`, filters: [{ name: 'CSV', extensions: ['csv'] }] });
    if (!path) return null;
    await writeFile(path, encoder.encode(toCsv(datasets[0])));
    return [path];
  }

  // Vários conteúdos em CSV: um arquivo por tabela, dentro de uma pasta escolhida.
  const folder = await open({ directory: true, recursive: true, title: 'Escolha a pasta para os arquivos CSV' });
  if (!folder || Array.isArray(folder)) return null;
  const paths: string[] = [];
  for (const dataset of datasets) {
    const path = `${folder.replace(/\/$/, '')}/caderno-${dataset.key}.csv`;
    await writeFile(path, encoder.encode(toCsv(dataset)));
    paths.push(path);
  }
  return paths;
}
