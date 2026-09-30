/** Tipos compartilhados do domínio. Espelham `src-tauri/migrations/0001_init.sql`. */

export type AccountKind = 'checking' | 'cash' | 'credit_card';

export interface Account {
  id: number;
  name: string;
  kind: AccountKind;
  openingBalanceCents: number;
  creditLimitCents: number | null; // só cartão
  closingDay: number | null; // só cartão, 1-31
  dueDay: number | null; // só cartão, 1-31
  archived: boolean;
}

export type CategoryGroup = 'need' | 'want' | 'invest' | 'income' | 'neutral';

export interface Category {
  id: number;
  name: string;
  groupKind: CategoryGroup;
}

/**
 * Fase 1 só usa `expense`/`income`. `transfer`, `card_payment` e `refund` chegam
 * na Fase 2 — o tipo já inclui todos porque `kind` no banco aceita o enum inteiro
 * desde a migration inicial (ver docs/data-model.md).
 */
export type TransactionKind = 'expense' | 'income' | 'transfer' | 'card_payment' | 'refund';

export interface Transaction {
  id: number;
  kind: TransactionKind;
  accountId: number;
  destAccountId: number | null;
  categoryId: number | null;
  amountCents: number;
  purchasedOn: string; // YYYY-MM-DD
  effectiveOn: string; // YYYY-MM-DD
  description: string;
  notes: string | null;
  tags: string[];
  /** Presentes quando o lançamento é uma parcela (US-02) — mesmo grupo compartilha `installmentGroupId`. */
  installmentGroupId: string | null;
  installmentNo: number | null;
  installmentsTotal: number | null;
}

export interface Tag {
  id: number;
  name: string;
}

/** Fatura de cartão (Fase 3) — nasce lazy, no primeiro lançamento do período. */
export interface Statement {
  id: number;
  accountId: number;
  month: string; // YYYY-MM
  dueOn: string; // YYYY-MM-DD
  paidByTransactionId: number | null;
}

/** Um "modelo" de recorrência (aluguel, assinatura, salário). Fase 2. */
export interface Recurrence {
  id: number;
  kind: 'expense' | 'income';
  description: string;
  amountCents: number;
  dayOfMonth: number; // 1-31, ajustado para o último dia em meses mais curtos
  accountId: number;
  categoryId: number | null;
  startsOn: string; // YYYY-MM-DD
  endsOn: string | null;
}
