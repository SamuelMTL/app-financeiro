import type { BudgetRow } from '../planning/budget';
import type { GoalInput } from '../planning/goal';
import type { LimitRow } from '../planning/view';
import { METHOD_LABEL } from '../planning/view';
import type { Account, Category, CategoryGroup, Transaction, TransactionKind } from '../types';
import { inPeriod, type Dataset, type Period } from './export';

const KIND_LABEL: Record<TransactionKind, string> = {
  expense: 'Gasto',
  income: 'Renda',
  transfer: 'Transferência',
  card_payment: 'Pagamento de fatura',
  refund: 'Estorno',
};
const GROUP_LABEL: Record<CategoryGroup, string> = {
  need: 'Necessidade', want: 'Querer', invest: 'Investimento', income: 'Renda', neutral: 'Neutro',
};
const ACCOUNT_KIND_LABEL = { checking: 'Conta corrente', cash: 'Dinheiro', credit_card: 'Cartão de crédito' } as const;

export function transactionsDataset(
  txs: Transaction[],
  accounts: Account[],
  categories: Category[],
  period: Period,
): Dataset {
  const accountName = new Map(accounts.map((a) => [a.id, a.name]));
  const categoryName = new Map(categories.map((c) => [c.id, c.name]));
  const rows = txs
    .filter((t) => inPeriod(t.purchasedOn.slice(0, 7), period))
    .sort((a, b) => a.purchasedOn.localeCompare(b.purchasedOn) || a.id - b.id)
    .map((t) => [
      t.purchasedOn,
      t.effectiveOn,
      KIND_LABEL[t.kind],
      accountName.get(t.accountId) ?? '',
      t.destAccountId !== null ? (accountName.get(t.destAccountId) ?? '') : '',
      t.categoryId !== null ? (categoryName.get(t.categoryId) ?? '') : '',
      t.description,
      { money: t.amountCents },
      t.installmentNo !== null ? `${t.installmentNo}/${t.installmentsTotal}` : '',
      t.tags.join(', '),
      t.notes ?? '',
    ]);
  return {
    key: 'lancamentos',
    name: 'Lançamentos',
    headers: ['Data da compra', 'Data efetiva', 'Tipo', 'Conta/cartão', 'Destino', 'Categoria', 'Descrição', 'Valor', 'Parcela', 'Tags', 'Observação'],
    rows,
  };
}

export function categoriesDataset(categories: Category[]): Dataset {
  return {
    key: 'categorias', name: 'Categorias', headers: ['Categoria', 'Grupo'],
    rows: categories.map((c) => [c.name, GROUP_LABEL[c.groupKind]]),
  };
}

export function budgetsDataset(budgets: BudgetRow[], categories: Category[], period: Period): Dataset {
  const name = new Map(categories.map((c) => [c.id, c.name]));
  return {
    key: 'orcamentos', name: 'Orçamentos',
    headers: ['Mês', 'Categoria', 'Planejado', 'Alerta 80%', 'Alerta 100%'],
    rows: budgets.filter((b) => inPeriod(b.month, period)).sort((a, b) => a.month.localeCompare(b.month))
      .map((b) => [b.month, name.get(b.categoryId) ?? '', { money: b.plannedCents }, b.alert80 ? 'Sim' : 'Não', b.alert100 ? 'Sim' : 'Não']),
  };
}

export function limitsDataset(limits: LimitRow[], period: Period): Dataset {
  return {
    key: 'tetos', name: 'Tetos',
    headers: ['Mês', 'Forma de pagamento', 'Teto', 'Alerta 80%', 'Alerta 100%'],
    rows: limits.filter((l) => inPeriod(l.month, period)).sort((a, b) => a.month.localeCompare(b.month))
      .map((l) => [l.month, METHOD_LABEL[l.method], { money: l.limitCents }, l.alert80 ? 'Sim' : 'Não', l.alert100 ? 'Sim' : 'Não']),
  };
}

export function goalsDataset(goals: { month: string; goal: GoalInput }[], period: Period): Dataset {
  return {
    key: 'metas', name: 'Metas',
    headers: ['Mês', 'Meta em valor', 'Meta em % da renda'],
    rows: goals.filter((g) => inPeriod(g.month, period)).sort((a, b) => a.month.localeCompare(b.month))
      .map((g) => [g.month, g.goal.amountCents !== null ? { money: g.goal.amountCents } : '', g.goal.percentOfIncome !== null ? String(g.goal.percentOfIncome).replace('.', ',') : '']),
  };
}

export function accountsDataset(accounts: Account[]): Dataset {
  return {
    key: 'contas', name: 'Contas e cartões',
    headers: ['Nome', 'Tipo', 'Saldo inicial', 'Limite', 'Dia de fechamento', 'Dia de vencimento', 'Arquivada'],
    rows: accounts.map((a) => [
      a.name, ACCOUNT_KIND_LABEL[a.kind], { money: a.openingBalanceCents },
      a.creditLimitCents !== null ? { money: a.creditLimitCents } : '',
      a.closingDay ?? '', a.dueDay ?? '', a.archived ? 'Sim' : 'Não',
    ]),
  };
}
