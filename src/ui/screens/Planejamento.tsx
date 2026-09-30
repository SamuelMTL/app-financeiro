import { useCallback, useEffect, useState } from 'react';
import { addMonths, currentMonth } from '../../domain/dates';
import { formatCents, parseToCents } from '../../domain/money';
import { GROUP_LABELS } from '../groupLabels';
import type { DistributionPlan } from '../../domain/planning/distribution';
import type { PaymentMethod } from '../../domain/planning/spending';
import { formatPermille } from '../../domain/planning/usage';
import { METHOD_LABEL, type LimitLine } from '../../domain/planning/view';
import type { Category } from '../../domain/types';
import { listCategories } from '../../ipc/categories';
import {
  copyPreviousMonth,
  deleteBudget,
  deleteLimit,
  loadPlanningView,
  saveBudget,
  saveDistributionPlan,
  saveGoal,
  saveLimit,
} from '../../ipc/planning';
import { getSpendOptions, setIncluirParcelasAntigas } from '../../ipc/settings';
import { Button } from '../components/Button';
import { UsageBar } from '../components/UsageBar';
import { monthLong } from '../format';
import './Lancamentos.css';
import './CartoesContas.css';
import './Planejamento.css';

type View = Awaited<ReturnType<typeof loadPlanningView>>;

function centsToText(cents: number | null): string {
  return cents === null ? '' : formatCents(cents).replace('R$ ', '');
}

/** Planejamento (US-11 a US-14, US-17): orçamento, tetos, distribuição e meta de investimento. */
export function Planejamento() {
  const [month, setMonth] = useState(currentMonth());
  const [view, setView] = useState<View | null>(null);
  const [categories, setCategories] = useState<Category[]>([]);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [confirmCopy, setConfirmCopy] = useState(false);
  const [includeOld, setIncludeOld] = useState(getSpendOptions().incluirParcelasAntigasNoTeto);
  const [addCategoryId, setAddCategoryId] = useState<number | ''>('');
  const [plan, setPlan] = useState({ need: '50', want: '30', invest: '20' });
  const [goalMode, setGoalMode] = useState<'amount' | 'percent'>('amount');
  const [goalText, setGoalText] = useState('');

  const reload = useCallback(async () => {
    try {
      const [v, cats] = await Promise.all([loadPlanningView(month), listCategories()]);
      setView(v);
      setCategories(cats);
      const p = v.planOrDefault ?? { needPct: 50, wantPct: 30, investPct: 20 };
      setPlan({ need: String(p.needPct), want: String(p.wantPct), invest: String(p.investPct) });
      if (v.goalInput?.percentOfIncome != null) {
        setGoalMode('percent');
        setGoalText(String(v.goalInput.percentOfIncome).replace('.', ','));
      } else if (v.goalInput?.amountCents != null) {
        setGoalMode('amount');
        setGoalText(centsToText(v.goalInput.amountCents));
      } else {
        setGoalText('');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  }, [month]);

  useEffect(() => {
    setConfirmCopy(false);
    setMessage(null);
    reload();
  }, [reload]);

  async function run(action: () => Promise<unknown>, okMessage?: string) {
    setError(null);
    try {
      await action();
      if (okMessage) setMessage(okMessage);
      await reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  }

  async function handleCopy(confirmed: boolean) {
    setError(null);
    try {
      const result = await copyPreviousMonth(month, confirmed);
      if (result.kind === 'needs-confirmation') {
        setConfirmCopy(true);
        return;
      }
      setConfirmCopy(false);
      setMessage(`Orçamento de ${monthLong(addMonths(month, -1))} copiado (${result.count} categorias).`);
      await reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  }

  if (!view) {
    return <div className="screen">{error ? <p className="error">{error}</p> : <p className="muted">Carregando…</p>}</div>;
  }

  const budgetedIds = new Set(view.lines.map((l) => l.category.id));
  const addable = categories.filter(
    (c) => ['need', 'want', 'invest'].includes(c.groupKind) && !budgetedIds.has(c.id),
  );

  function savePlanned(categoryId: number, text: string, alert80: boolean, alert100: boolean) {
    run(async () => {
      if (text.trim() === '') return deleteBudget(month, categoryId);
      return saveBudget({ month, categoryId, plannedCents: parseToCents(text), alert80, alert100 });
    });
  }

  function saveLimitLine(line: LimitLine, text: string, alert80: boolean, alert100: boolean) {
    run(async () => {
      if (text.trim() === '') return deleteLimit(month, line.method);
      return saveLimit({ month, method: line.method as PaymentMethod, limitCents: parseToCents(text), alert80, alert100 });
    });
  }

  function savePlan() {
    const next: DistributionPlan = {
      needPct: Number(plan.need.replace(',', '.')),
      wantPct: Number(plan.want.replace(',', '.')),
      investPct: Number(plan.invest.replace(',', '.')),
    };
    run(() => saveDistributionPlan(month, next), 'Distribuição salva.');
  }

  function saveGoalNow() {
    run(async () => {
      if (goalText.trim() === '') return saveGoal(month, null);
      return saveGoal(
        month,
        goalMode === 'amount'
          ? { amountCents: parseToCents(goalText), percentOfIncome: null }
          : { amountCents: null, percentOfIncome: Number(goalText.replace(',', '.')) },
      );
    }, 'Meta salva.');
  }

  const distTotal = Number(plan.need.replace(',', '.')) + Number(plan.want.replace(',', '.')) + Number(plan.invest.replace(',', '.'));

  return (
    <div className="screen">
      <header className="screen-header">
        <div>
          <h1>Planejamento</h1>
          <p className="muted">Necessidade, querer e investimento</p>
        </div>
        <div className="month-nav">
          <Button aria-label="Mês anterior" onClick={() => setMonth(addMonths(month, -1))}>‹</Button>
          <strong>{monthLong(month)}</strong>
          <Button aria-label="Próximo mês" onClick={() => setMonth(addMonths(month, 1))}>›</Button>
        </div>
      </header>

      {error && <p className="error" role="alert">{error}</p>}
      {message && <p className="muted" role="status">{message}</p>}

      <section className="panel" aria-labelledby="budget-title">
        <div className="panel-head">
          <h2 id="budget-title">Orçamento de {monthLong(month)}</h2>
          {confirmCopy ? (
            <span className="confirm-row">
              Este mês já tem orçamento. Substituir?
              <Button variant="danger" onClick={() => handleCopy(true)}>Substituir</Button>
              <Button onClick={() => setConfirmCopy(false)}>Cancelar</Button>
            </span>
          ) : (
            <Button onClick={() => handleCopy(false)}>Copiar orçamento de {monthLong(addMonths(month, -1)).split(' de ')[0]}</Button>
          )}
        </div>

        {view.lines.length === 0 ? (
          <p className="muted">Nenhum orçamento definido. Adicione uma categoria ou copie o mês anterior.</p>
        ) : (
          <table className="tx-table plan-table">
            <thead>
              <tr><th>Categoria</th><th>Planejado (R$)</th><th>Realizado</th><th>Uso</th><th>Alertas</th></tr>
            </thead>
            <tbody>
              {view.lines.map((line) => (
                <tr key={line.category.id}>
                  <td>{line.category.name}<br /><span className="muted">{GROUP_LABELS[line.category.groupKind]}</span></td>
                  <td>
                    <input
                      className="num plan-input"
                      aria-label={`Planejado de ${line.category.name}`}
                      defaultValue={centsToText(line.plannedCents || null)}
                      key={`${month}-${line.category.id}-${line.plannedCents}`}
                      onBlur={(e) => {
                        if (e.target.value !== centsToText(line.plannedCents || null)) {
                          savePlanned(line.category.id, e.target.value, line.alert80, line.alert100);
                        }
                      }}
                    />
                  </td>
                  <td className="mono">{formatCents(line.realizedCents)}</td>
                  <td><UsageBar permille={line.permille} status={line.status} /></td>
                  <td className="alert-checks">
                    <label><input type="checkbox" checked={line.alert80} disabled={line.plannedCents === 0}
                      onChange={(e) => savePlanned(line.category.id, centsToText(line.plannedCents), e.target.checked, line.alert100)} /> 80%</label>
                    <label><input type="checkbox" checked={line.alert100} disabled={line.plannedCents === 0}
                      onChange={(e) => savePlanned(line.category.id, centsToText(line.plannedCents), line.alert80, e.target.checked)} /> 100%</label>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}

        {addable.length > 0 && (
          <div className="add-row">
            <select aria-label="Categoria a adicionar" value={addCategoryId}
              onChange={(e) => setAddCategoryId(e.target.value === '' ? '' : Number(e.target.value))}>
              <option value="">Adicionar categoria ao orçamento…</option>
              {addable.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
            <Button disabled={addCategoryId === ''} onClick={() => {
              if (addCategoryId === '') return;
              run(() => saveBudget({ month, categoryId: addCategoryId, plannedCents: 0, alert80: true, alert100: true }));
              setAddCategoryId('');
            }}>Adicionar</Button>
          </div>
        )}
      </section>

      <section className="panel" aria-labelledby="limits-title">
        <h2 id="limits-title">Tetos por forma de pagamento</h2>
        <p className="muted">Quanto você aceita gastar no mês em cada forma, independente das categorias.</p>
        {view.limits.map((line) => (
          <div className="limit-row" key={line.method}>
            <div className="limit-name">
              <strong>{METHOD_LABEL[line.method]}</strong>
              <span className="muted">
                Usado: {formatCents(line.usedCents)}
                {line.remainingCents !== null && (line.remainingCents >= 0
                  ? ` · ainda posso gastar ${formatCents(line.remainingCents)}`
                  : ` · ${formatCents(-line.remainingCents)} acima`)}
              </span>
            </div>
            <input className="num plan-input" aria-label={`Teto de ${METHOD_LABEL[line.method]}`} placeholder="Sem teto"
              defaultValue={centsToText(line.limitCents)} key={`${month}-${line.method}-${line.limitCents}`}
              onBlur={(e) => { if (e.target.value !== centsToText(line.limitCents)) saveLimitLine(line, e.target.value, line.alert80, line.alert100); }} />
            <UsageBar permille={line.permille} status={line.status} />
            <span className="alert-checks">
              <label><input type="checkbox" checked={line.alert80} disabled={line.limitCents === null}
                onChange={(e) => saveLimitLine(line, centsToText(line.limitCents), e.target.checked, line.alert100)} /> 80%</label>
              <label><input type="checkbox" checked={line.alert100} disabled={line.limitCents === null}
                onChange={(e) => saveLimitLine(line, centsToText(line.limitCents), line.alert80, e.target.checked)} /> 100%</label>
            </span>
          </div>
        ))}
        <label className="option-row">
          <input type="checkbox" checked={includeOld} onChange={(e) => {
            setIncludeOld(e.target.checked); setIncluirParcelasAntigas(e.target.checked); reload();
          }} />
          Contar nos tetos e no orçamento as parcelas de compras antigas que caem neste mês
        </label>
      </section>

      <section className="panel" aria-labelledby="dist-title">
        <h2 id="dist-title">Distribuição {plan.need}/{plan.want}/{plan.invest}</h2>
        <p className="muted">Percentual da renda de {view.incomeCents > 0 ? formatCents(view.incomeCents) : 'R$ 0,00 (sem renda lançada ou prevista)'}</p>
        {view.distribution.map((d) => (
          <div className="dist-row" key={d.group}>
            <span>{GROUP_LABELS[d.group]}</span>
            <span className="mono">
              {d.realizedPermille === null ? '—' : formatPermille(d.realizedPermille)} de {d.plannedPct}%
              {' '}({formatCents(d.realizedCents)} de {formatCents(d.plannedCents)})
            </span>
          </div>
        ))}
        <div className="plan-edit">
          {(['need', 'want', 'invest'] as const).map((key) => (
            <label key={key}>{GROUP_LABELS[key]} (%)
              <input className="num plan-input" value={plan[key]} onChange={(e) => setPlan({ ...plan, [key]: e.target.value })} />
            </label>
          ))}
          <Button onClick={savePlan} disabled={Math.abs(distTotal - 100) >= 0.01}>Salvar</Button>
          {Math.abs(distTotal - 100) >= 0.01 && <span className="error">Somam {distTotal}%, precisam somar 100%.</span>}
        </div>
      </section>

      <section className="panel" aria-labelledby="goal-title">
        <h2 id="goal-title">Meta de investimento</h2>
        {view.goal ? (
          <p>
            <strong className="mono">{formatCents(view.goal.investedCents)}</strong> de{' '}
            <span className="mono">{formatCents(view.goal.targetCents)}</span>
            {view.goal.reached ? ' · meta atingida' : ` · faltam ${formatCents(view.goal.missingCents)}`}
          </p>
        ) : (
          <p className="muted">Sem meta definida para este mês.</p>
        )}
        <div className="plan-edit">
          <select aria-label="Tipo da meta" value={goalMode} onChange={(e) => setGoalMode(e.target.value as 'amount' | 'percent')}>
            <option value="amount">Valor fixo (R$)</option>
            <option value="percent">% da renda do mês</option>
          </select>
          <input className="num plan-input" aria-label="Meta" value={goalText} onChange={(e) => setGoalText(e.target.value)} placeholder={goalMode === 'amount' ? '2.200,00' : '20'} />
          <Button onClick={saveGoalNow}>Salvar meta</Button>
        </div>
      </section>
    </div>
  );
}
