import type { Account, Category, CategoryGroup, Statement } from '../types';
import type { TxLite } from '../overview/types';

export type PaymentMethod = 'credit' | 'debit_cash';

export interface SpendOptions {
  /**
   * Decisão em aberto (docs/business-rules.md): parcelas de compras antigas que
   * caem na fatura do mês entram nos tetos/orçamento? Padrão: não.
   */
  incluirParcelasAntigasNoTeto: boolean;
}

export const DEFAULT_SPEND_OPTIONS: SpendOptions = { incluirParcelasAntigasNoTeto: false };

/** Forma de pagamento de uma conta: cartão é crédito; corrente e dinheiro são débito/Pix/dinheiro. */
export function paymentMethodOf(account: Pick<Account, 'kind'>): PaymentMethod {
  return account.kind === 'credit_card' ? 'credit' : 'debit_cash';
}

export interface SpendEntry {
  tx: TxLite;
  /** Valor com sinal: gasto positivo, estorno negativo. */
  cents: number;
}

/**
 * Lançamentos que contam como **gasto do mês** (competência: data da compra),
 * com estornos descontando. Transferência, pagamento de fatura e renda ficam de fora.
 *
 * Compra parcelada conta a parcela do mês da compra (a 1ª). As parcelas seguintes
 * de compras antigas só entram se `incluirParcelasAntigasNoTeto` — nesse caso
 * contam no mês da fatura em que caem.
 */
export function monthlySpend(
  txs: TxLite[],
  statements: Statement[],
  month: string,
  options: SpendOptions = DEFAULT_SPEND_OPTIONS,
): SpendEntry[] {
  const monthByStatement = new Map(statements.map((s) => [s.id, s.month]));
  const entries: SpendEntry[] = [];
  for (const tx of txs) {
    if (tx.kind === 'refund') {
      if (tx.purchasedOn.slice(0, 7) === month) entries.push({ tx, cents: -tx.amountCents });
      continue;
    }
    if (tx.kind !== 'expense') continue;

    const isOldInstallment = tx.installmentNo !== null && tx.installmentNo > 1;
    if (!isOldInstallment) {
      if (tx.purchasedOn.slice(0, 7) === month) entries.push({ tx, cents: tx.amountCents });
    } else if (options.incluirParcelasAntigasNoTeto) {
      const statementMonth =
        (tx.statementId !== null ? monthByStatement.get(tx.statementId) : undefined) ??
        tx.effectiveOn.slice(0, 7);
      if (statementMonth === month && tx.purchasedOn.slice(0, 7) !== month) {
        entries.push({ tx, cents: tx.amountCents });
      }
    }
  }
  return entries;
}

/** Gasto do mês por forma de pagamento (usado pelos tetos). Nunca negativo. */
export function spentByMethod(
  entries: SpendEntry[],
  accounts: Account[],
): Record<PaymentMethod, number> {
  const kindById = new Map(accounts.map((a) => [a.id, a]));
  const totals: Record<PaymentMethod, number> = { credit: 0, debit_cash: 0 };
  for (const { tx, cents } of entries) {
    const account = kindById.get(tx.accountId);
    if (!account) continue;
    totals[paymentMethodOf(account)] += cents;
  }
  return { credit: Math.max(0, totals.credit), debit_cash: Math.max(0, totals.debit_cash) };
}

/** Gasto do mês por categoria (sem categoria fica de fora). */
export function spentByCategory(entries: SpendEntry[]): Map<number, number> {
  const totals = new Map<number, number>();
  for (const { tx, cents } of entries) {
    if (tx.categoryId === null) continue;
    totals.set(tx.categoryId, (totals.get(tx.categoryId) ?? 0) + cents);
  }
  return totals;
}

/** Gasto do mês por grupo de categoria (Necessidade, Querer, Investimento…). */
export function spentByGroup(
  entries: SpendEntry[],
  categories: Category[],
): Record<CategoryGroup, number> {
  const groupById = new Map(categories.map((c) => [c.id, c.groupKind]));
  const totals: Record<CategoryGroup, number> = { need: 0, want: 0, invest: 0, income: 0, neutral: 0 };
  for (const { tx, cents } of entries) {
    if (tx.categoryId === null) continue;
    const group = groupById.get(tx.categoryId);
    if (group) totals[group] += cents;
  }
  return totals;
}
