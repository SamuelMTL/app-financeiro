import type { Transaction } from '../types';

/**
 * Lançamento enxuto para os cálculos de visão geral/projeção: sem tags, e com a
 * fatura a que pertence (`statementId`), que `Transaction` não expõe à UI.
 */
export type TxLite = Omit<Transaction, 'tags'> & { statementId: number | null };
