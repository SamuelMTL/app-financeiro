import { normalizeDescription } from './normalize';

/**
 * "Duplicado: mesma conta/cartão + data + valor + descrição normalizada" —
 * docs/business-rules.md. A conta já é comparada separadamente (é uma coluna
 * própria, indexada junto — ver `idx_tx_import_hash_unique`), então o hash cobre
 * só data + valor + descrição.
 */
export function computeImportHash(purchasedOn: string, amountCents: number, description: string): string {
  return `${purchasedOn}|${amountCents}|${normalizeDescription(description)}`;
}
