import { computeImportHash } from './hash';
import { detectInstallmentTag } from './installmentTag';
import { normalizeDescription } from './normalize';
import type { RawImportRow } from './csv';

export type ImportRowStatus = 'new' | 'duplicate' | 'installment_new' | 'installment_linked' | 'review';

export interface ExistingInstallmentGroup {
  groupId: string;
  installmentNos: Set<number>;
}

/** Dados do banco que a classificação (pura) precisa — montados pelo IPC. */
export interface ClassifyContext {
  existingHashes: Set<string>;
  /** Chave: `${accountId}|${descrição normalizada sem tag}|${installmentsTotal}`. */
  existingInstallmentGroups: Map<string, ExistingInstallmentGroup>;
  /** Chave: descrição normalizada (sem tag de parcela) -> categoria usada da última vez. */
  categoryHistory: Map<string, number>;
}

export interface ClassifiedImportRow {
  rowIndex: number;
  purchasedOn: string;
  /** Sem a tag "N/M" quando parcela detectada. */
  description: string;
  amountCents: number;
  importHash: string;
  status: ImportRowStatus;
  suggestedCategoryId: number | null;
  installmentNo: number | null;
  installmentsTotal: number | null;
  /** Preenchido só em `installment_linked` — grupo já existente a que esta linha pertence. */
  linkedGroupId: string | null;
}

function installmentGroupKey(accountId: number, cleanDescription: string, installmentsTotal: number): string {
  return `${accountId}|${normalizeDescription(cleanDescription)}|${installmentsTotal}`;
}

export function buildInstallmentGroupKey(
  accountId: number,
  cleanDescription: string,
  installmentsTotal: number,
): string {
  return installmentGroupKey(accountId, cleanDescription, installmentsTotal);
}

/**
 * Classifica uma linha do arquivo (US-10): Novo, Já lançado, Parcela detectada
 * (nova ou vinculada a um grupo existente) ou A revisar (parcela > 1 sem grupo
 * correspondente — não dá para reconstruir com segurança, ver
 * docs/business-rules.md).
 */
export function classifyRow(
  row: RawImportRow,
  accountId: number,
  context: ClassifyContext,
): ClassifiedImportRow {
  const installment = detectInstallmentTag(row.description);
  const description = installment ? installment.cleanDescription : row.description;
  const importHash = computeImportHash(row.purchasedOn, row.amountCents, row.description);
  const suggestedCategoryId = context.categoryHistory.get(normalizeDescription(description)) ?? null;

  const base = {
    rowIndex: row.rowIndex,
    purchasedOn: row.purchasedOn,
    description,
    amountCents: row.amountCents,
    importHash,
    suggestedCategoryId,
  };

  if (!installment) {
    return {
      ...base,
      status: context.existingHashes.has(importHash) ? 'duplicate' : 'new',
      installmentNo: null,
      installmentsTotal: null,
      linkedGroupId: null,
    };
  }

  const groupKey = installmentGroupKey(accountId, installment.cleanDescription, installment.installmentsTotal);
  const group = context.existingInstallmentGroups.get(groupKey);

  let status: ImportRowStatus;
  let linkedGroupId: string | null = null;

  if (installment.installmentNo === 1) {
    status = context.existingHashes.has(importHash) ? 'duplicate' : 'installment_new';
  } else if (group) {
    if (group.installmentNos.has(installment.installmentNo)) {
      status = 'duplicate'; // já foi criada junto com a 1ª parcela em outro mês
    } else {
      status = 'installment_linked';
      linkedGroupId = group.groupId;
    }
  } else {
    status = 'review'; // parcela > 1 sem grupo conhecido — não é seguro reconstruir
  }

  return {
    ...base,
    status,
    installmentNo: installment.installmentNo,
    installmentsTotal: installment.installmentsTotal,
    linkedGroupId,
  };
}

export function classifyRows(
  rows: RawImportRow[],
  accountId: number,
  context: ClassifyContext,
): ClassifiedImportRow[] {
  return rows.map((row) => classifyRow(row, accountId, context));
}
