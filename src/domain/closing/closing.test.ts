import { describe, expect, it } from 'vitest';
import { compareCategories, outflowEntries, sumEntries, topExpenses, variation } from '../analysis/analysis';
import { moneyToBR, toCsv, inPeriod } from '../export/export';
import { accountsDataset, transactionsDataset } from '../export/datasets';
import type { TxLite } from '../overview/types';
import { monthlySpend, spentByCategory } from '../planning/spending';
import { buildPlanningView } from '../planning/view';
import type { Account, Category, Transaction } from '../types';
import { closedMonthError, isClosed, validateClose, type ClosedMonth } from './closing';
import { buildMonthSummary } from './summary';

const acc: Account = { id: 1, name: 'Itaú', kind: 'checking', openingBalanceCents: 0, creditLimitCents: null, closingDay: null, dueDay: null, archived: false };
const C = {
  moradia: { id: 1, name: 'Moradia', groupKind: 'need' }, mercado: { id: 2, name: 'Mercado', groupKind: 'need' },
  transporte: { id: 3, name: 'Transporte', groupKind: 'need' }, saude: { id: 4, name: 'Saúde', groupKind: 'need' },
  rest: { id: 5, name: 'Restaurantes', groupKind: 'want' }, lazer: { id: 6, name: 'Lazer', groupKind: 'want' },
  assin: { id: 7, name: 'Assinaturas', groupKind: 'want' }, compras: { id: 8, name: 'Compras', groupKind: 'want' },
  invest: { id: 9, name: 'Investimento', groupKind: 'invest' }, renda: { id: 10, name: 'Renda', groupKind: 'income' },
} as const satisfies Record<string, Category>;
const categories: Category[] = Object.values(C);

let n = 1;
const tx = (categoryId: number, cents: number, date: string, kind: TxLite['kind'] = 'expense'): TxLite => ({
  id: n++, kind, accountId: 1, destAccountId: null, categoryId, amountCents: cents, purchasedOn: date, effectiveOn: date,
  description: `d${n}`, notes: null, installmentGroupId: null, installmentNo: null, installmentsTotal: null, statementId: null,
});

const SEP: [number, number][] = [[1, 260000], [2, 131000], [3, 29500], [4, 21000], [5, 87200], [6, 55000], [7, 20980], [8, 193000]];
const AGO: [number, number][] = [[1, 260000], [2, 128000], [3, 38000], [4, 15000], [5, 63200], [6, 41000], [7, 20980], [8, 124000]];
const txs: TxLite[] = [
  ...SEP.map(([c, v]) => tx(c, v, '2026-09-10')),
  ...AGO.map(([c, v]) => tx(c, v, '2026-08-10')),
  tx(9, 150000, '2026-09-15'),
  tx(10, 1030000, '2026-09-05', 'income'),
];
const options = { incluirParcelasAntigasNoTeto: false };

describe('análise (exemplo do design)', () => {
  const sep = outflowEntries(monthlySpend(txs, [], '2026-09', options), categories);
  const ago = outflowEntries(monthlySpend(txs, [], '2026-08', options), categories);

  it('saídas de setembro R$ 7.976,80 vs agosto R$ 6.901,80: + R$ 1.075,00 (+15,6%); aporte não é saída', () => {
    expect(sumEntries(sep)).toBe(797680);
    expect(sumEntries(ago)).toBe(690180);
    expect(variation(797680, 690180)).toEqual({ diffCents: 107500, permille: 156 });
  });

  it('categorias que mais cresceram, na ordem do design', () => {
    const rows = compareCategories(categories, spentByCategory(sep), spentByCategory(ago));
    expect(rows.map((r) => [r.category.name, r.diffCents, r.permille])).toEqual([
      ['Compras', 69000, 556], ['Saúde', 6000, 400], ['Restaurantes', 24000, 380], ['Lazer', 14000, 341],
      ['Mercado', 3000, 23], ['Assinaturas', 0, 0], ['Moradia', 0, 0], ['Transporte', -8500, -224],
    ]);
  });

  it('categoria nova (sem base no mês anterior) vem primeiro, sem porcentagem', () => {
    const rows = compareCategories(categories, new Map([[C.lazer.id, 100], [C.compras.id, 500]]), new Map([[C.compras.id, 100]]));
    expect(rows[0]).toMatchObject({ category: C.lazer, permille: null });
  });

  it('maiores gastos, do maior para o menor', () => {
    const top = topExpenses(sep, 3).map((e) => e.cents);
    expect(top).toEqual([260000, 193000, 131000]);
  });
});

describe('resumo ao fechar o mês (exemplo do design)', () => {
  const view = buildPlanningView({
    month: '2026-09', accounts: [acc], categories, txs, statements: [],
    budgets: [
      { month: '2026-09', categoryId: C.rest.id, plannedCents: 60000, alert80: true, alert100: true },
      { month: '2026-09', categoryId: C.compras.id, plannedCents: 175000, alert80: true, alert100: true },
      { month: '2026-09', categoryId: C.moradia.id, plannedCents: 290000, alert80: true, alert100: true },
    ],
    limits: [], plan: null, goal: { amountCents: 206000, percentOfIncome: null }, expectedIncomeCents: 0, options,
  });
  const s = buildMonthSummary({ month: '2026-09', txs, statements: [], categories, view, options });

  it('entrou 10.300, saiu 7.976,80, aportes 1.500, sobrou 823,20', () => {
    expect(s).toMatchObject({ entrouCents: 1030000, saiuCents: 797680, aportesCents: 150000, sobrouCents: 82320 });
  });

  it('o que fugiu do planejado: Restaurantes +272 (145%), Compras +180 (110%), aporte −560 (73%)', () => {
    expect(s.deviations.map((d) => [d.label, d.diffCents, d.pct])).toEqual([
      ['Restaurantes', 27200, 145], ['Compras', 18000, 110], ['Aporte em investimento', 56000, 73],
    ]);
  });
});

describe('fechamento', () => {
  const closed: ClosedMonth[] = [
    { month: '2026-08', closedAt: '2026-09-01', reopenedAt: null },
    { month: '2026-07', closedAt: '2026-08-01', reopenedAt: '2026-08-10' },
  ];
  it('reaberto conta como aberto', () => {
    expect(isClosed(closed, '2026-08')).toBe(true);
    expect(isClosed(closed, '2026-07')).toBe(false);
  });
  it('não fecha mês futuro nem mês já fechado', () => {
    expect(validateClose(closed, '2026-11', '2026-10-12')).not.toEqual([]);
    expect(validateClose(closed, '2026-08', '2026-10-12')).not.toEqual([]);
    expect(validateClose(closed, '2026-09', '2026-10-12')).toEqual([]);
    expect(validateClose(closed, '2026-10', '2026-10-31')).toEqual([]);
  });
  it('erro legível para a tela quando a data cai em mês fechado', () => {
    expect(closedMonthError(closed, '2026-08-15')).toContain('08/2026');
    expect(closedMonthError(closed, '2026-09-15', '2026-07-01')).toBeNull();
  });
});

describe('exportação', () => {
  it('dinheiro em formato BR, sem float', () => {
    expect(moneyToBR(123456)).toBe('1234,56');
    expect(moneyToBR(5)).toBe('0,05');
    expect(moneyToBR(-1050)).toBe('-10,50');
  });

  it('CSV: BOM, separador ; , aspas e quebra de linha escapadas', () => {
    const csv = toCsv({ headers: ['A', 'B'], rows: [['x;y', { money: 1999 }], ['diz "oi"', null]] });
    expect(csv.startsWith('﻿')).toBe(true);
    expect(csv).toBe('﻿A;B\r\n"x;y";19,99\r\n"diz ""oi""";\r\n');
  });

  it('período filtra por mês da compra', () => {
    expect(inPeriod('2026-08', { from: '2026-08', to: '2026-09' })).toBe(true);
    expect(inPeriod('2026-10', { from: '2026-08', to: '2026-09' })).toBe(false);
    expect(inPeriod('2020-01', { from: null, to: null })).toBe(true);
  });

  it('lançamentos exportados respeitam o período e mostram parcela e tags', () => {
    const t = (id: number, purchasedOn: string, extra: Partial<Transaction> = {}): Transaction => ({
      id, kind: 'expense', accountId: 1, destAccountId: null, categoryId: 5, amountCents: 1000, purchasedOn, effectiveOn: purchasedOn,
      description: 'Jantar', notes: null, tags: ['amigos'], installmentGroupId: null, installmentNo: null, installmentsTotal: null, ...extra,
    });
    const ds = transactionsDataset([t(1, '2026-08-01'), t(2, '2026-09-01', { installmentNo: 2, installmentsTotal: 6 })], [acc], categories, { from: '2026-09', to: '2026-09' });
    expect(ds.rows).toHaveLength(1);
    expect(ds.rows[0]).toContain('2/6');
    expect(ds.rows[0]).toContain('amigos');
    expect(accountsDataset([acc]).rows[0][1]).toBe('Conta corrente');
  });
});
