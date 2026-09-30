import { useCallback, useEffect, useState } from 'react';
import { addMonths, currentMonth } from '../../domain/dates';
import { isClosed, type ClosedMonth } from '../../domain/closing/closing';
import type { MonthSummary } from '../../domain/closing/summary';
import { formatCents } from '../../domain/money';
import type { Account } from '../../domain/types';
import { listAccounts } from '../../ipc/accounts';
import { closeMonth, listClosedMonths, reopenMonth } from '../../ipc/closing';
import { loadMonthSummary } from '../../ipc/closingSummary';
import { gatherDatasets, saveExport, type ExportSelection } from '../../ipc/export';
import { Button } from '../components/Button';
import { monthLong } from '../format';
import './Lancamentos.css';
import './CartoesContas.css';
import './Fechamento.css';

const fmtDate = (iso: string) => `${iso.slice(8, 10)}/${iso.slice(5, 7)}/${iso.slice(0, 4)}`;
const monthName = (m: string) => monthLong(m).split(" de ")[0];

/** Fechamento e exportação (US-21, US-22, US-23). */
export function Fechamento() {
  const [month, setMonth] = useState(addMonths(currentMonth(), -1));
  const [summary, setSummary] = useState<MonthSummary | null>(null);
  const [closed, setClosed] = useState<ClosedMonth[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [checks, setChecks] = useState<Record<string, boolean>>({});
  const [confirmReopen, setConfirmReopen] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const [format, setFormat] = useState<'csv' | 'xlsx'>('xlsx');
  const [periodFrom, setPeriodFrom] = useState('');
  const [periodTo, setPeriodTo] = useState('');
  const [selection, setSelection] = useState<ExportSelection>({ transactions: true, planning: true, accounts: true });
  const [exporting, setExporting] = useState(false);

  const reload = useCallback(async () => {
    try {
      const [s, c, a] = await Promise.all([loadMonthSummary(month), listClosedMonths(), listAccounts()]);
      setSummary(s);
      setClosed(c);
      setAccounts(a);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  }, [month]);

  useEffect(() => {
    setChecks({});
    setMessage(null);
    setError(null);
    reload();
  }, [reload]);

  const cards = accounts.filter((a) => a.kind === 'credit_card');
  const checklist = [
    { id: 'tx', label: 'Todos os lançamentos conferidos' },
    ...cards.map((c) => ({ id: `card-${c.id}`, label: `Fatura ${c.name} conciliada` })),
    { id: 'balance', label: 'Saldo das contas conferido' },
  ];
  const allChecked = checklist.every((item) => checks[item.id]);
  const monthClosed = isClosed(closed, month);

  async function run(action: () => Promise<unknown>, ok: string) {
    setError(null);
    setMessage(null);
    try {
      await action();
      setMessage(ok);
      await reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  }

  async function handleExport() {
    setExporting(true);
    setError(null);
    setMessage(null);
    try {
      const datasets = await gatherDatasets(selection, { from: periodFrom || null, to: periodTo || null });
      const paths = await saveExport(format, datasets);
      if (paths) setMessage(`Exportado: ${paths.join(', ')}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setExporting(false);
    }
  }

  const monthOptions = Array.from({ length: 24 }, (_, i) => addMonths(currentMonth(), -i));

  return (
    <div className="screen">
      <header className="screen-header">
        <div>
          <h1>Fechamento e exportação</h1>
          <p className="muted">Resumo de {monthLong(month)}</p>
        </div>
        <div className="month-nav">
          <Button aria-label="Mês anterior" onClick={() => setMonth(addMonths(month, -1))}>‹</Button>
          <strong>{monthLong(month)}</strong>
          <Button aria-label="Próximo mês" onClick={() => setMonth(addMonths(month, 1))}>›</Button>
        </div>
      </header>

      {error && <p className="error" role="alert">{error}</p>}
      {message && <p className="muted" role="status">{message}</p>}

      {summary && (
        <section className="panel" aria-labelledby="summary-title">
          <h2 id="summary-title">Resumo de {monthLong(month)}</h2>
          <div className="summary-cards">
            <div><span className="muted">Entrou</span><strong>{formatCents(summary.entrouCents)}</strong></div>
            <div><span className="muted">Saiu</span><strong>{formatCents(summary.saiuCents)}</strong></div>
            <div><span className="muted">Aportes</span><strong>{formatCents(summary.aportesCents)}</strong></div>
            <div>
              <span className="muted">Sobrou no mês</span>
              <strong className={summary.sobrouCents < 0 ? 'neg' : ''}>{formatCents(summary.sobrouCents)}</strong>
            </div>
          </div>
          <h3>O que fugiu do planejado</h3>
          {summary.deviations.length === 0 ? (
            <p className="muted">Nada fugiu do planejado neste mês.</p>
          ) : (
            <ul className="dev-list">
              {summary.deviations.map((d) => (
                <li key={d.label}>
                  <span>
                    <strong>{d.label}</strong>
                    <span className="muted">
                      {d.kind === 'over-budget'
                        ? ` ${formatCents(d.realizedCents)} gastos de ${formatCents(d.plannedCents)} planejados`
                        : ` ${formatCents(d.realizedCents)} aportados da meta de ${formatCents(d.plannedCents)}`}
                    </span>
                  </span>
                  <span className="mono neg">
                    {d.kind === 'over-budget' ? '+' : '−'} {formatCents(d.diffCents)} ({d.pct}%)
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>
      )}

      <section className="panel" aria-labelledby="close-title">
        <h2 id="close-title">Fechar {monthName(month)} de {month.slice(0, 4)}</h2>
        {monthClosed ? (
          <p className="muted">Este mês está fechado. Lançamentos, parcelas e orçamento estão bloqueados para edição.</p>
        ) : (
          <>
            <p className="muted">Lançamentos, parcelas e orçamento do mês ficam bloqueados para edição. Você pode reabrir o mês com uma confirmação.</p>
            <ul className="checklist">
              {checklist.map((item) => (
                <li key={item.id}>
                  <label>
                    <input type="checkbox" checked={Boolean(checks[item.id])} onChange={(e) => setChecks({ ...checks, [item.id]: e.target.checked })} />
                    {item.label}
                  </label>
                </li>
              ))}
            </ul>
            <div>
              <Button variant="primary" disabled={!allChecked} onClick={() => run(() => closeMonth(month), `${monthName(month)} fechado.`)}>
                Fechar {monthName(month).toLowerCase()}
              </Button>
              {!allChecked && <span className="muted"> Marque todos os itens para fechar.</span>}
            </div>
          </>
        )}
      </section>

      <section className="panel" aria-labelledby="export-title">
        <h2 id="export-title">Exportar dados</h2>
        <p className="muted">Leve seus dados para fora quando quiser. Exportar não altera nada.</p>
        <div className="export-grid">
          <fieldset>
            <legend>Formato</legend>
            <label><input type="radio" name="fmt" checked={format === 'csv'} onChange={() => setFormat('csv')} /> CSV</label>
            <label><input type="radio" name="fmt" checked={format === 'xlsx'} onChange={() => setFormat('xlsx')} /> Excel (.xlsx)</label>
          </fieldset>
          <fieldset>
            <legend>Período</legend>
            <label>De
              <select value={periodFrom} onChange={(e) => setPeriodFrom(e.target.value)}>
                <option value="">Todos os meses</option>
                {monthOptions.map((m) => <option key={m} value={m}>{monthLong(m)}</option>)}
              </select>
            </label>
            <label>Até
              <select value={periodTo} onChange={(e) => setPeriodTo(e.target.value)}>
                <option value="">Todos os meses</option>
                {monthOptions.map((m) => <option key={m} value={m}>{monthLong(m)}</option>)}
              </select>
            </label>
          </fieldset>
          <fieldset>
            <legend>Incluir</legend>
            <label><input type="checkbox" checked={selection.transactions} onChange={(e) => setSelection({ ...selection, transactions: e.target.checked })} /> Lançamentos, parcelas e estornos</label>
            <label><input type="checkbox" checked={selection.planning} onChange={(e) => setSelection({ ...selection, planning: e.target.checked })} /> Categorias, orçamentos e metas</label>
            <label><input type="checkbox" checked={selection.accounts} onChange={(e) => setSelection({ ...selection, accounts: e.target.checked })} /> Contas e cartões</label>
          </fieldset>
        </div>
        <div>
          <Button variant="primary" disabled={exporting || !(selection.transactions || selection.planning || selection.accounts)} onClick={handleExport}>
            {exporting ? 'Exportando…' : 'Exportar'}
          </Button>
        </div>
      </section>

      <section className="panel" aria-labelledby="closed-title">
        <h2 id="closed-title">Meses fechados</h2>
        {closed.length === 0 ? (
          <p className="muted">Nenhum mês fechado ainda.</p>
        ) : (
          <ul className="dev-list">
            {closed.map((c) => (
              <li key={c.month}>
                <span>
                  <strong>{monthLong(c.month)}</strong>
                  <span className="muted">
                    {c.reopenedAt ? ` · reaberto em ${fmtDate(c.reopenedAt)} (fechado em ${fmtDate(c.closedAt)})` : ` · fechado em ${fmtDate(c.closedAt)}`}
                  </span>
                </span>
                {!c.reopenedAt &&
                  (confirmReopen === c.month ? (
                    <span className="confirm-row">
                      Reabrir libera a edição deste mês.
                      <Button variant="danger" onClick={() => { setConfirmReopen(null); run(() => reopenMonth(c.month), `${monthName(c.month)} reaberto.`); }}>Reabrir</Button>
                      <Button onClick={() => setConfirmReopen(null)}>Cancelar</Button>
                    </span>
                  ) : (
                    <Button onClick={() => setConfirmReopen(c.month)}>Reabrir</Button>
                  ))}
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
