import { useEffect, useState } from 'react';
import { addMonths, currentMonth } from '../../domain/dates';
import { formatCents } from '../../domain/money';
import { formatPermille } from '../../domain/planning/usage';
import { loadAnalysis, type AnalysisData } from '../../ipc/analysis';
import { Button } from '../components/Button';
import { dayMonth, monthLong, monthShort } from '../format';
import './Lancamentos.css';
import './CartoesContas.css';
import './Analise.css';

const signed = (cents: number) => `${cents > 0 ? '+ ' : cents < 0 ? '− ' : ''}${formatCents(Math.abs(cents))}`;
const signedPct = (permille: number | null) =>
  permille === null ? 'novo' : `${permille > 0 ? '+' : permille < 0 ? '−' : ''}${formatPermille(Math.abs(permille))}`;

/** Análise (US-18, US-19): saídas mês a mês, maiores gastos e categorias que mais cresceram. */
export function Analise() {
  const [month, setMonth] = useState(addMonths(currentMonth(), -1));
  const [data, setData] = useState<AnalysisData | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setError(null);
    loadAnalysis(month).then(setData).catch((err: unknown) => setError(err instanceof Error ? err.message : String(err)));
  }, [month]);

  const categoryName = (id: number | null) => data?.categories.find((c) => c.id === id)?.name ?? 'Sem categoria';
  const max = Math.max(1, ...(data?.series.map((s) => s.totalCents) ?? [1]));

  return (
    <div className="screen">
      <header className="screen-header">
        <div>
          <h1>Análise</h1>
          <p className="muted">Comparação entre meses · saídas não incluem aportes em investimento</p>
        </div>
        <div className="month-nav">
          <Button aria-label="Mês anterior" onClick={() => setMonth(addMonths(month, -1))}>‹</Button>
          <strong>{monthLong(month)}</strong>
          <Button aria-label="Próximo mês" onClick={() => setMonth(addMonths(month, 1))}>›</Button>
        </div>
      </header>

      {error && <p className="error" role="alert">{error}</p>}
      {!data ? (
        !error && <p className="muted">Carregando…</p>
      ) : (
        <>
          <section className="panel" aria-labelledby="series-title">
            <h2 id="series-title">Saídas por mês</h2>
            <p className="hero-line">
              <strong>{formatCents(data.total.currentCents)}</strong>{' '}
              <span className={data.total.diffCents > 0 ? 'up' : ''}>
                {signed(data.total.diffCents)} ({signedPct(data.total.permille)})
              </span>
            </p>
            <p className="muted">{monthLong(data.month).split(' de ')[0]} comparado a {monthLong(data.previousMonth).split(' de ')[0]}</p>
            <div className="series" role="img" aria-label="Saídas dos últimos seis meses">
              {data.series.map((s) => (
                <div key={s.month} className="series-col">
                  <span className="series-value">{formatCents(s.totalCents).replace('R$ ', '')}</span>
                  <div className={`series-bar ${s.month === data.month ? 'current' : ''}`} style={{ height: `${(s.totalCents / max) * 100}%` }} />
                  <span className="series-month">{monthShort(s.month)}</span>
                </div>
              ))}
            </div>
          </section>

          <section className="panel" aria-labelledby="top-title">
            <h2 id="top-title">Maiores gastos de {monthLong(data.month).split(' de ')[0]}</h2>
            {data.top.length === 0 ? (
              <p className="muted">Nenhum gasto neste mês.</p>
            ) : (
              <ul className="top-list">
                {data.top.map(({ tx, cents }) => (
                  <li key={tx.id}>
                    <span>
                      {tx.description}
                      <span className="muted"> · {dayMonth(tx.purchasedOn)} · {categoryName(tx.categoryId)}</span>
                    </span>
                    <span className="mono">{formatCents(cents)}</span>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section className="panel" aria-labelledby="growth-title">
            <h2 id="growth-title">Categorias que mais cresceram</h2>
            {data.growth.length === 0 ? (
              <p className="muted">Sem gastos por categoria nestes dois meses.</p>
            ) : (
              <table className="tx-table">
                <thead>
                  <tr>
                    <th>Categoria</th>
                    <th>{monthLong(data.previousMonth).split(' de ')[0]}</th>
                    <th>{monthLong(data.month).split(' de ')[0]}</th>
                    <th>Diferença</th>
                    <th>Variação</th>
                  </tr>
                </thead>
                <tbody>
                  {data.growth.map((r) => (
                    <tr key={r.category.id}>
                      <td>{r.category.name}</td>
                      <td className="mono">{formatCents(r.previousCents)}</td>
                      <td className="mono">{formatCents(r.currentCents)}</td>
                      <td className={`mono ${r.diffCents > 0 ? 'up' : ''}`}>{r.diffCents === 0 ? formatCents(0) : signed(r.diffCents)}</td>
                      <td className={`mono ${r.diffCents > 0 ? 'up' : ''}`}>{signedPct(r.permille)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </section>
        </>
      )}
    </div>
  );
}
