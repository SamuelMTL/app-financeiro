import { normalizeDescription } from '../domain/import/normalize';
import {
  classifyRows,
  type ClassifiedImportRow,
  type ClassifyContext,
  type ExistingInstallmentGroup,
} from '../domain/import/reconcile';
import type { RawImportRow } from '../domain/import/csv';
import { getDb } from './db';
import { getOrCreateStatement } from './statements';

async function buildClassifyContext(accountId: number): Promise<ClassifyContext> {
  const db = await getDb();

  const hashRows = await db.select<{ import_hash: string }[]>(
    'SELECT import_hash FROM transactions WHERE account_id = ? AND import_hash IS NOT NULL',
    [accountId],
  );
  const existingHashes = new Set(hashRows.map((row) => row.import_hash));

  const installmentRows = await db.select<
    { description: string; installments_total: number; installment_no: number; installment_group_id: string }[]
  >(
    `SELECT description, installments_total, installment_no, installment_group_id
     FROM transactions
     WHERE account_id = ? AND installment_group_id IS NOT NULL`,
    [accountId],
  );
  const existingInstallmentGroups = new Map<string, ExistingInstallmentGroup>();
  for (const row of installmentRows) {
    const key = `${accountId}|${normalizeDescription(row.description)}|${row.installments_total}`;
    const group = existingInstallmentGroups.get(key);
    if (group) {
      group.installmentNos.add(row.installment_no);
    } else {
      existingInstallmentGroups.set(key, {
        groupId: row.installment_group_id,
        installmentNos: new Set([row.installment_no]),
      });
    }
  }

  // Categoria sugerida por histórico: descrição normalizada -> categoria do
  // lançamento mais recente com essa descrição (docs/business-rules.md).
  const historyRows = await db.select<{ description: string; category_id: number }[]>(
    `SELECT description, category_id FROM transactions
     WHERE kind = 'expense' AND category_id IS NOT NULL
     ORDER BY purchased_on DESC, id DESC`,
  );
  const categoryHistory = new Map<string, number>();
  for (const row of historyRows) {
    const key = normalizeDescription(row.description);
    if (!categoryHistory.has(key)) {
      categoryHistory.set(key, row.category_id);
    }
  }

  return { existingHashes, existingInstallmentGroups, categoryHistory };
}

/** Conferência antes de importar (US-10): classifica cada linha do arquivo. */
export async function previewImport(accountId: number, rows: RawImportRow[]): Promise<ClassifiedImportRow[]> {
  const context = await buildClassifyContext(accountId);
  return classifyRows(rows, accountId, context);
}

export interface ConfirmImportRow {
  purchasedOn: string;
  description: string;
  amountCents: number;
  importHash: string;
  categoryId: number | null;
  installmentNo: number | null;
  installmentsTotal: number | null;
  /** Presente quando a linha se vincula a um grupo de parcela já existente. */
  linkedGroupId: string | null;
}

/**
 * Grava só o que foi marcado (US-10: "só importa o que estiver marcado; nada é
 * gravado antes de confirmar"). Cada linha vira um lançamento `expense` — o
 * `import_hash` com índice único no banco (migration 0003) garante que reimportar
 * a mesma fatura não duplica nada, mesmo que a confirmação seja repetida.
 */
export async function confirmImport(
  accountId: number,
  month: string,
  rows: ConfirmImportRow[],
): Promise<{ createdCount: number; skippedCount: number }> {
  const db = await getDb();
  const statement = await getOrCreateStatement(accountId, month);

  let createdCount = 0;
  let skippedCount = 0;

  for (const row of rows) {
    const groupId =
      row.linkedGroupId ?? (row.installmentNo !== null && row.installmentNo === 1 ? crypto.randomUUID() : null);

    try {
      await db.execute(
        `INSERT INTO transactions
           (kind, account_id, category_id, amount_cents, purchased_on, effective_on, description,
            installment_group_id, installment_no, installments_total, statement_id, import_hash)
         VALUES ('expense', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          accountId,
          row.categoryId,
          row.amountCents,
          row.purchasedOn,
          statement.dueOn,
          row.description,
          groupId,
          row.installmentNo,
          row.installmentsTotal,
          statement.id,
          row.importHash,
        ],
      );
      createdCount += 1;
    } catch {
      // Índice único de import_hash barrou um duplicado que passou pela
      // conferência (ex.: duas linhas idênticas no mesmo arquivo) — não falha a
      // importação inteira por isso, só pula e conta.
      skippedCount += 1;
    }
  }

  return { createdCount, skippedCount };
}
