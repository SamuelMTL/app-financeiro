import { describe, expect, it } from 'vitest';
import type { Account, Statement } from '../types';
import { accountBalanceCents } from './balances';
import { commitmentsByMonth, creditUsedCents, ongoingInstallments } from './commitments';
import { computeForecast, dailyAllowanceCents, remainingDays } from './forecast';
import { buildOverview } from './overview';
import { currentStatement, summarizeStatements } from './statements';
import type { TxLite } from './types';

const itau: Account = { id: 1, name: 'Conta Itaú', kind: 'checking', openingBalanceCents: 0, creditLimitCents: null, closingDay: null, dueDay: null, archived: false };
const carteira: Account = { ...itau, id: 2, name: 'Carteira', kind: 'cash' };
const picpay: Account = { ...itau, id: 3, name: 'PicPay', kind: 'credit_card', creditLimitCents: 800000, closingDay: 12, dueDay: 20 };
const azul: Account = { ...picpay, id: 4, name: 'Itaú Azul', creditLimitCents: 600000, closingDay: 18, dueDay: 25 };
const accounts = [itau, carteira, picpay, azul];

let nextId = 1;
function tx(partial: Partial<TxLite> & Pick<TxLite, 'kind' | 'accountId' | 'amountCents' | 'effectiveOn'>): TxLite {
  return {
    id: nextId++,
    destAccountId: null,
    categoryId: null,
    purchasedOn: partial.effectiveOn,
    description: 'x',
    notes: null,
    installmentGroupId: null,
    installmentNo: null,
    installmentsTotal: null,
    statementId: null,
    ...partial,
  } as TxLite;
}
function stmt(id: number, accountId: number, month: string, dueOn: string): Statement {
  return { id, accountId, month, dueOn, paidByTransactionId: null };
}

/** Reproduz o exemplo de design de docs/business-rules.md: hoje = 12/10/2026. */
function designExample() {
  const today = '2026-10-12';
  const statements = [stmt(10, 3, '2026-10', '2026-10-20'), stmt(11, 4, '2026-10', '2026-10-25')];
  const txs = [
    // saldo atual: Itaú 5.740,50 + Carteira 500,00 = 6.240,50
    tx({ kind: 'income', accountId: 1, amountCents: 574050, effectiveOn: '2026-10-05' }),
    tx({ kind: 'income', accountId: 2, amountCents: 50000, effectiveOn: '2026-10-01' }),
    // recorrentes a vencer em conta: internet + academia + streaming = 289,70
    tx({ kind: 'expense', accountId: 1, amountCents: 9990, effectiveOn: '2026-10-15' }),
    tx({ kind: 'expense', accountId: 1, amountCents: 12000, effectiveOn: '2026-10-20' }),
    tx({ kind: 'expense', accountId: 1, amountCents: 6980, effectiveOn: '2026-10-28' }),
    // faturas: PicPay 1.842,35 e Itaú Azul 1.126,40
    tx({ kind: 'expense', accountId: 3, amountCents: 184235, effectiveOn: '2026-10-20', statementId: 10 }),
    tx({ kind: 'expense', accountId: 4, amountCents: 112640, effectiveOn: '2026-10-25', statementId: 11 }),
  ];
  return { today, statements, txs };
}

describe('saldo por conta', () => {
  it('soma rendas, subtrai gastos e ignora o que ainda não aconteceu', () => {
    const { txs } = designExample();
    expect(accountBalanceCents(itau, txs, '2026-10-12')).toBe(574050);
    expect(accountBalanceCents(itau, txs, '2026-10-31')).toBe(574050 - 28970);
  });

  it('transferência move saldo e pagamento de fatura só sai da conta', () => {
    const txs = [
      tx({ kind: 'transfer', accountId: 1, destAccountId: 2, amountCents: 10000, effectiveOn: '2026-10-01' }),
      tx({ kind: 'card_payment', accountId: 1, destAccountId: 3, amountCents: 5000, effectiveOn: '2026-10-02' }),
    ];
    expect(accountBalanceCents(itau, txs, '2026-10-12')).toBe(-15000);
    expect(accountBalanceCents(carteira, txs, '2026-10-12')).toBe(10000);
  });
});

describe('saldo previsto e "posso gastar por dia" (exemplo do design)', () => {
  it('dias restantes: 12/10 → 19 (13 a 31); último dia do mês → 1', () => {
    expect(remainingDays('2026-10-12')).toBe(19);
    expect(remainingDays('2026-10-31')).toBe(1);
  });

  it('bate com R$ 2.982,05 e R$ 156,95 por dia', () => {
    const { today, statements, txs } = designExample();
    const summaries = summarizeStatements(statements, txs, accounts);
    const f = computeForecast({ accounts, txs, summaries, today });
    expect(f.currentBalanceCents).toBe(624050);
    expect(f.remainingOutflowsCents).toBe(28970);
    expect(f.statementsDueCents).toBe(296875);
    expect(f.forecastCents).toBe(298205);
    expect(f.remainingDays).toBe(19);
    expect(f.perDayCents).toBe(15695);
  });

  it('renda futura entra; gasto futuro no cartão não conta duas vezes', () => {
    const { today, statements, txs } = designExample();
    const extra = [
      ...txs,
      tx({ kind: 'income', accountId: 1, amountCents: 100000, effectiveOn: '2026-10-30' }),
      tx({ kind: 'expense', accountId: 3, amountCents: 99999, effectiveOn: '2026-10-22', statementId: 10 }),
    ];
    const summaries = summarizeStatements(statements, extra, accounts);
    const f = computeForecast({ accounts, txs: extra, summaries, today });
    expect(f.remainingIncomeCents).toBe(100000);
    expect(f.remainingOutflowsCents).toBe(28970); // o gasto do cartão só pesa via fatura
    expect(f.statementsDueCents).toBe(296875 + 99999);
  });

  it('saldo previsto negativo → por dia é 0; divisão arredonda para baixo', () => {
    expect(dailyAllowanceCents(-5000, 10)).toBe(0);
    expect(dailyAllowanceCents(1000, 3)).toBe(333);
  });

  it('fatura já paga não entra em "a vencer"', () => {
    const { today, statements, txs } = designExample();
    const paid = [...txs, tx({ kind: 'card_payment', accountId: 1, destAccountId: 3, amountCents: 184235, effectiveOn: '2026-10-10' })];
    const summaries = summarizeStatements(statements, paid, accounts);
    const f = computeForecast({ accounts, txs: paid, summaries, today });
    expect(f.statementsDueCents).toBe(112640);
  });
});

describe('faturas', () => {
  it('estorno no cartão abate a fatura do período', () => {
    const { statements, txs } = designExample();
    const withRefund = [...txs, tx({ kind: 'refund', accountId: 3, amountCents: 5000, effectiveOn: '2026-10-08' })];
    const s = summarizeStatements(statements, withRefund, accounts).find((x) => x.statementId === 10)!;
    expect(s.totalCents).toBe(184235 - 5000);
  });

  it('pagamento parcial quita as faturas mais antigas primeiro', () => {
    const statements = [stmt(1, 3, '2026-09', '2026-09-20'), stmt(2, 3, '2026-10', '2026-10-20')];
    const txs = [
      tx({ kind: 'expense', accountId: 3, amountCents: 10000, effectiveOn: '2026-09-20', statementId: 1 }),
      tx({ kind: 'expense', accountId: 3, amountCents: 20000, effectiveOn: '2026-10-20', statementId: 2 }),
      tx({ kind: 'card_payment', accountId: 1, destAccountId: 3, amountCents: 15000, effectiveOn: '2026-09-21' }),
    ];
    const s = summarizeStatements(statements, txs, accounts);
    expect(s.map((x) => x.openCents)).toEqual([0, 15000]);
    expect(currentStatement(s, 3)?.month).toBe('2026-10');
  });
});

describe('comprometido futuro e parcelamentos (exemplo do design)', () => {
  function installments() {
    const statements: Statement[] = [];
    const txs: TxLite[] = [];
    let sid = 100;
    // Cadeira 3/10 no Itaú Azul: parcelas 1..10, parcela 3 na fatura de 2026-10
    for (let n = 1; n <= 10; n++) {
      const month = `${n + 7 <= 12 ? '2026' : '2027'}-${String(((n + 6) % 12) + 1).padStart(2, '0')}`;
      const s = stmt(sid++, 4, month, `${month}-25`);
      statements.push(s);
      txs.push(tx({ kind: 'expense', accountId: 4, amountCents: 21490, effectiveOn: s.dueOn, purchasedOn: '2026-08-05', statementId: s.id, installmentGroupId: 'cadeira', installmentNo: n, installmentsTotal: 10, description: 'Cadeira ergonômica' }));
    }
    return { statements, txs };
  }

  it('parcela atual 3/10, valor 214,90, restante 7 × 214,90 = 1.504,30', () => {
    const { statements, txs } = installments();
    const [cadeira] = ongoingInstallments(txs, statements, '2026-10');
    expect(cadeira).toMatchObject({ currentNo: 3, totalNo: 10, currentAmountCents: 21490, remainingCents: 150430 });
  });

  it('parcelamento na última parcela (ou além) sai da lista', () => {
    const { statements, txs } = installments();
    expect(ongoingInstallments(txs, statements, '2027-05')).toEqual([]);
  });

  it('comprometido: só meses depois do corrente, por cartão, somando ao centavo', () => {
    const { statements, txs } = installments();
    const summaries = summarizeStatements(statements, txs, accounts);
    const c = commitmentsByMonth(summaries, '2026-10');
    expect(c[0].month).toBe('2026-11');
    expect(c).toHaveLength(7);
    expect(c.reduce((s, m) => s + m.totalCents, 0)).toBe(150430);
    expect(c[0].byCard).toEqual([{ accountId: 4, cents: 21490 }]);
  });

  it('buildOverview reúne faturas atuais e vencimentos do mês', () => {
    const { today, statements, txs } = designExample();
    const o = buildOverview({ accounts, txs, statements, today });
    expect(o.currentStatements.map((s) => s.openCents)).toEqual([184235, 112640]);
    expect(o.statementsDueThisMonth.map((s) => s.dueOn)).toEqual(['2026-10-20', '2026-10-25']);
    expect(o.forecast.forecastCents).toBe(298205);
    expect(o.balances.find((b) => b.accountId === 1)?.balanceCents).toBe(574050);
  });
});

describe('creditUsedCents — incluirParcelasAntigasNoTeto', () => {
  const statements = [stmt(1, 3, '2026-10', '2026-10-20')];
  const txs = [
    // compra à vista neste mês
    tx({ kind: 'expense', accountId: 3, amountCents: 10000, effectiveOn: '2026-10-20', purchasedOn: '2026-10-03', statementId: 1 }),
    // 1ª parcela de compra nova neste mês
    tx({ kind: 'expense', accountId: 3, amountCents: 5000, effectiveOn: '2026-10-20', purchasedOn: '2026-10-04', statementId: 1, installmentGroupId: 'a', installmentNo: 1, installmentsTotal: 3 }),
    // parcela 2/6 de compra antiga caindo na fatura de outubro
    tx({ kind: 'expense', accountId: 3, amountCents: 38990, effectiveOn: '2026-10-20', purchasedOn: '2026-09-02', statementId: 1, installmentGroupId: 'b', installmentNo: 2, installmentsTotal: 6 }),
    // estorno no mês
    tx({ kind: 'refund', accountId: 3, amountCents: 2000, effectiveOn: '2026-10-09', purchasedOn: '2026-10-09' }),
    // gasto em conta corrente não é crédito
    tx({ kind: 'expense', accountId: 1, amountCents: 99999, effectiveOn: '2026-10-09' }),
  ];

  it('padrão (false): parcela antiga fica de fora', () => {
    expect(creditUsedCents(txs, accounts, statements, '2026-10', { incluirParcelasAntigasNoTeto: false })).toBe(13000);
  });

  it('true: soma a parcela antiga que cai na fatura do mês', () => {
    expect(creditUsedCents(txs, accounts, statements, '2026-10', { incluirParcelasAntigasNoTeto: true })).toBe(13000 + 38990);
  });

  it('sem opções usa o padrão (false)', () => {
    expect(creditUsedCents(txs, accounts, statements, '2026-10')).toBe(13000);
  });
});
