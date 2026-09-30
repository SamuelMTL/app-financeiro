import { describe, expect, it } from 'vitest';
import type { Account, Category, Statement } from '../types';
import type { TxLite } from '../overview/types';
import { AlertSubject, alertMessage, crossedThresholds, decideAlerts } from './alerts';
import { buildBudgetLines, planCopyBudget, type BudgetRow } from './budget';
import { ceilingWarning } from './ceilings';
import { buildDistribution, monthIncomeCents, validateDistribution, DEFAULT_DISTRIBUTION } from './distribution';
import { goalProgress, validateGoal } from './goal';
import { monthlySpend, spentByCategory, spentByGroup, spentByMethod } from './spending';
import { formatPermille, remainingCents, usagePermille, usageStatus } from './usage';

const checking: Account = { id: 1, name: 'Itaú', kind: 'checking', openingBalanceCents: 0, creditLimitCents: null, closingDay: null, dueDay: null, archived: false };
const card: Account = { ...checking, id: 2, name: 'PicPay', kind: 'credit_card', closingDay: 12, dueDay: 20 };
const accounts = [checking, card];
const cats: Category[] = [
  { id: 1, name: 'Moradia', groupKind: 'need' },
  { id: 2, name: 'Mercado', groupKind: 'need' },
  { id: 3, name: 'Restaurantes', groupKind: 'want' },
  { id: 4, name: 'Investimento', groupKind: 'invest' },
  { id: 5, name: 'Renda', groupKind: 'income' },
];

let n = 1;
function tx(p: Partial<TxLite> & Pick<TxLite, 'kind' | 'accountId' | 'amountCents'>): TxLite {
  return { id: n++, destAccountId: null, categoryId: null, purchasedOn: '2026-10-05', effectiveOn: '2026-10-05', description: 'x', notes: null, installmentGroupId: null, installmentNo: null, installmentsTotal: null, statementId: null, ...p } as TxLite;
}

describe('situação de teto/orçamento', () => {
  it('< 80% dentro, 80–99% perto, ≥ 100% acima', () => {
    expect(usageStatus(7999, 10000)).toBe('ok');
    expect(usageStatus(8000, 10000)).toBe('near');
    expect(usageStatus(9999, 10000)).toBe('near');
    expect(usageStatus(10000, 10000)).toBe('over');
  });

  it('exemplos do design', () => {
    expect(formatPermille(usagePermille(260000, 290000)!)).toBe('89,7%');
    expect(usageStatus(260000, 290000)).toBe('near');
    expect(formatPermille(usagePermille(64250, 60000)!)).toBe('107,1%');
    expect(usageStatus(64250, 60000)).toBe('over');
    expect(formatPermille(usagePermille(54480, 60000)!)).toBe('90,8%'); // crédito
    expect(remainingCents(54480, 60000)).toBe(5520); // "ainda posso gastar R$ 55,20"
    expect(formatPermille(usagePermille(260000, 400000)!)).toBe('65,0%'); // débito
    expect(remainingCents(260000, 400000)).toBe(140000);
  });

  it('sem planejado: sem porcentagem; qualquer gasto já estoura', () => {
    expect(usagePermille(100, 0)).toBeNull();
    expect(usageStatus(100, 0)).toBe('over');
    expect(usageStatus(0, 0)).toBe('ok');
  });
});

describe('gasto do mês', () => {
  const statements: Statement[] = [{ id: 7, accountId: 2, month: '2026-10', dueOn: '2026-10-20', paidByTransactionId: null }];
  const txs = [
    tx({ kind: 'expense', accountId: 1, amountCents: 260000, categoryId: 1 }),
    tx({ kind: 'expense', accountId: 2, amountCents: 50000, categoryId: 3, statementId: 7 }),
    tx({ kind: 'refund', accountId: 2, amountCents: 10000, categoryId: 3 }),
    tx({ kind: 'expense', accountId: 2, amountCents: 38990, categoryId: 2, purchasedOn: '2026-09-02', statementId: 7, installmentGroupId: 'g', installmentNo: 2, installmentsTotal: 6 }),
    tx({ kind: 'transfer', accountId: 1, destAccountId: 2, amountCents: 99999 }),
    tx({ kind: 'card_payment', accountId: 1, destAccountId: 2, amountCents: 88888 }),
    tx({ kind: 'income', accountId: 1, amountCents: 500000, categoryId: 5 }),
    tx({ kind: 'expense', accountId: 1, amountCents: 77777, purchasedOn: '2026-09-30', effectiveOn: '2026-09-30', categoryId: 1 }),
  ];

  it('conta só gasto do mês, com estorno descontando; transferência/pagamento/renda ficam fora', () => {
    const e = monthlySpend(txs, statements, '2026-10');
    expect(e.reduce((s, x) => s + x.cents, 0)).toBe(260000 + 50000 - 10000);
    expect(spentByMethod(e, accounts)).toEqual({ credit: 40000, debit_cash: 260000 });
    expect(spentByCategory(e).get(3)).toBe(40000);
  });

  it('parcela antiga só entra com incluirParcelasAntigasNoTeto', () => {
    const e = monthlySpend(txs, statements, '2026-10', { incluirParcelasAntigasNoTeto: true });
    expect(spentByMethod(e, accounts).credit).toBe(40000 + 38990);
    expect(spentByGroup(e, cats).need).toBe(260000 + 38990);
  });
});

describe('orçamento', () => {
  const budgets: BudgetRow[] = [
    { month: '2026-10', categoryId: 1, plannedCents: 290000, alert80: true, alert100: true },
    { month: '2026-10', categoryId: 3, plannedCents: 60000, alert80: true, alert100: false },
  ];

  it('monta linhas por grupo com planejado × realizado', () => {
    const lines = buildBudgetLines(cats, budgets, new Map([[1, 260000], [3, 64250], [2, 1000]]));
    expect(lines.map((l) => [l.category.name, l.status])).toEqual([
      ['Mercado', 'over'], // gasto sem orçamento
      ['Moradia', 'near'],
      ['Restaurantes', 'over'],
    ]);
    expect(lines.find((l) => l.category.id === 3)?.alert100).toBe(false);
  });

  it('copiar mês anterior: pede confirmação se já há orçamento; senão copia para o mês novo', () => {
    const from = budgets;
    const blocked = planCopyBudget({ fromRows: from, toMonth: '2026-11', existingToRows: [from[0]], confirmed: false });
    expect(blocked).toEqual({ kind: 'needs-confirmation', existingCount: 1 });
    const done = planCopyBudget({ fromRows: from, toMonth: '2026-11', existingToRows: [from[0]], confirmed: true });
    expect(done.kind === 'copy' && done.rows.map((r) => r.month)).toEqual(['2026-11', '2026-11']);
    const empty = planCopyBudget({ fromRows: from, toMonth: '2026-11', existingToRows: [], confirmed: false });
    expect(empty.kind).toBe('copy');
    // preserva planejado e alertas
    expect(empty.kind === 'copy' && empty.rows[1]).toMatchObject({ plannedCents: 60000, alert100: false });
  });
});

describe('distribuição 50/30/20 e meta (exemplo do design, renda R$ 11.000)', () => {
  it('37,1% / 20,7% / 13,6%', () => {
    const lines = buildDistribution(DEFAULT_DISTRIBUTION, 1100000, { need: 407640, want: 228030, invest: 150000, income: 0, neutral: 0 });
    expect(lines.map((l) => formatPermille(l.realizedPermille!))).toEqual(['37,1%', '20,7%', '13,6%']);
    expect(lines[2].plannedCents).toBe(220000);
  });

  it('sem renda: sem porcentagem; usa a prevista quando nada foi lançado', () => {
    expect(buildDistribution(DEFAULT_DISTRIBUTION, 0, { need: 1, want: 1, invest: 1, income: 0, neutral: 0 })[0].realizedPermille).toBeNull();
    expect(monthIncomeCents(0, 900000)).toBe(900000);
    expect(monthIncomeCents(1100000, 900000)).toBe(1100000);
  });

  it('o plano precisa somar 100%', () => {
    expect(validateDistribution(DEFAULT_DISTRIBUTION)).toEqual([]);
    expect(validateDistribution({ needPct: 50, wantPct: 30, investPct: 30 })).not.toEqual([]);
  });

  it('meta em % da renda: 20% de 11.000 = 2.200; aportou 1.500, faltam 700', () => {
    const p = goalProgress({ amountCents: null, percentOfIncome: 20 }, 1100000, 150000);
    expect(p).toMatchObject({ targetCents: 220000, missingCents: 70000, reached: false });
    expect(goalProgress({ amountCents: 100000, percentOfIncome: null }, 0, 150000).reached).toBe(true);
  });

  it('meta: um dos dois, nunca ambos nem nenhum', () => {
    expect(validateGoal({ amountCents: 1, percentOfIncome: 1 })).not.toEqual([]);
    expect(validateGoal({ amountCents: null, percentOfIncome: null })).not.toEqual([]);
    expect(validateGoal({ amountCents: null, percentOfIncome: 20 })).toEqual([]);
  });
});

describe('aviso do teto no formulário', () => {
  it('compra que passa do que resta avisa; quanto passa é informado', () => {
    // crédito: usado 544,80 de 600,00; compra de 100 → passa em 44,80
    const w = ceilingWarning({ usedCents: 54480, limitCents: 60000, amountCents: 10000 });
    expect(w).toMatchObject({ exceeds: true, statusAfter: 'over', overByCents: 4480, remainingBeforeCents: 5520 });
  });
  it('compra que cabe não avisa estouro', () => {
    expect(ceilingWarning({ usedCents: 54480, limitCents: 60000, amountCents: 5520 })).toMatchObject({ exceeds: false, statusAfter: 'over', overByCents: 0 });
    expect(ceilingWarning({ usedCents: 10000, limitCents: 60000, amountCents: 1000 }).statusAfter).toBe('ok');
  });
});

describe('alertas 80% / 100% — uma vez por mês', () => {
  const subj = (used: number, over: Partial<AlertSubject> = {}): AlertSubject => ({
    subject: 'category:3', label: 'Restaurantes', usedCents: used, plannedCents: 60000, alert80: true, alert100: true, ...over,
  });

  it('limiares cruzados', () => {
    expect(crossedThresholds(47999, 60000)).toEqual([]);
    expect(crossedThresholds(48000, 60000)).toEqual([80]);
    expect(crossedThresholds(60000, 60000)).toEqual([80, 100]);
    expect(crossedThresholds(100, 0)).toEqual([]);
  });

  it('estourar dispara exatamente uma vez: a segunda checagem não repete', () => {
    const fired = new Set<string>();
    const first = decideAlerts([subj(64250)], fired);
    expect(first).toHaveLength(1);
    expect(first[0].notify).toBe(100);
    first[0].newlyCrossed.forEach((t) => fired.add(`category:3|${t}`)); // o que o IPC registra
    expect(decideAlerts([subj(70000)], fired)).toEqual([]);
  });

  it('80% primeiro e 100% depois → um aviso de cada, sem repetir', () => {
    const fired = new Set<string>();
    const a = decideAlerts([subj(50000)], fired);
    expect(a[0].notify).toBe(80);
    a[0].newlyCrossed.forEach((t) => fired.add(`category:3|${t}`));
    const b = decideAlerts([subj(61000)], fired);
    expect(b[0]).toMatchObject({ newlyCrossed: [100], notify: 100 });
  });

  it('limiar desabilitado registra mas não notifica', () => {
    const d = decideAlerts([subj(61000, { alert100: false, alert80: false })], new Set());
    expect(d[0]).toMatchObject({ newlyCrossed: [80, 100], notify: null });
    expect(decideAlerts([subj(61000, { alert100: false })], new Set())[0].notify).toBe(80);
  });

  it('mensagem legível', () => {
    expect(alertMessage(subj(64250), 100)).toEqual({ title: 'Restaurantes passou de 100%', body: '107,1% do planejado' });
  });
});
