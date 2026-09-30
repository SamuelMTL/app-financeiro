import type { Account } from '../types';
import type { TxLite } from './types';

/**
 * Saldo de uma conta (corrente ou dinheiro) em `asOf`, por caixa: só entram
 * lançamentos cujo `effectiveOn` já chegou. Cartão de crédito não tem saldo —
 * o que ele acumula aparece na fatura (ver statements.ts).
 *
 * - renda e estorno somam; gasto subtrai;
 * - transferência sai da origem e entra no destino;
 * - pagamento de fatura só sai da conta de origem (quem recebe é o cartão).
 */
export function accountBalanceCents(account: Account, txs: TxLite[], asOf: string): number {
  let balance = account.openingBalanceCents;
  for (const tx of txs) {
    if (tx.effectiveOn > asOf) continue;
    if (tx.accountId === account.id) {
      if (tx.kind === 'income' || tx.kind === 'refund') balance += tx.amountCents;
      else balance -= tx.amountCents; // expense, transfer, card_payment
    } else if (tx.kind === 'transfer' && tx.destAccountId === account.id) {
      balance += tx.amountCents;
    }
  }
  return balance;
}

/** Soma dos saldos das contas que guardam dinheiro (corrente e dinheiro). */
export function totalBalanceCents(accounts: Account[], txs: TxLite[], asOf: string): number {
  return accounts
    .filter((a) => a.kind !== 'credit_card' && !a.archived)
    .reduce((sum, a) => sum + accountBalanceCents(a, txs, asOf), 0);
}
