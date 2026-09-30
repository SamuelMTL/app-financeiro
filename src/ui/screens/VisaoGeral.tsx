import { daysInMonth } from '../../domain/dates';
import { formatCents } from '../../domain/money';
import { Button } from '../components/Button';
import { dateLong, dayMonth } from '../format';
import { useEffect, useState } from 'react';
import { crossedThresholds } from '../../domain/planning/alerts';
import { formatPermille } from '../../domain/planning/usage';
import { METHOD_LABEL } from '../../domain/planning/view';
import { loadPlanningView } from '../../ipc/planning';
import { UsageBar } from '../components/UsageBar';
import { useOverview } from '../useOverview';
import './Lancamentos.css'; // .screen, .screen-header, .muted (compartilhados entre telas)
import './CartoesContas.css'; // .panel
import './VisaoGeral.css';

/**
 * Visão geral (US-15, US-16): saldo previsto até o fim do mês, quanto dá para
 * gastar por dia e as faturas a vencer. Orçamento, tetos e alertas chegam na Fase 5.
 */
export function VisaoGeral() {
  const { overview, accounts, today, error, reload } = useOverview();
  const [planning, setPlanning] = useState<Awaited<ReturnType<typeof loadPlanningView>> | null>(null);
  useEffect(() => {
    loadPlanningView(today.slice(0, 7)).then(setPlanning).catch(() => setPlanning(null));
  }, [today, overview]);

  if (error) return <div className="screen"><p className="error">Não foi possível carregar: {error}</p></div>;
  if (!overview) return <div className="screen"><p className="muted">Carregando…</p></div>;

  const { forecast } = overview;
  const accountName = (id: number) => accounts.find((a) => a.id === id)?.name ?? 'Cartão';
  const lastDay = daysInMonth(today.slice(0, 7));
  const monthEnd = `${today.slice(0, 7)}-${String(lastDay).padStart(2, '0')}`;
  const isLastDay = Number(today.slice(8, 10)) === lastDay;

  return (
    <div className="screen">
      <header className="screen-header">
        <div>
          <h1>Visão geral</h1>
          <p className="muted">Posição em {dateLong(today)}</p>
        </div>
        <Button variant="secondary" onClick={reload}>Atualizar</Button>
      </header>

      <section className="panel forecast-hero" aria-labelledby="forecast-title">
        <h2 id="forecast-title">Saldo previsto em {dayMonth(monthEnd)}</h2>
        <p className={`hero-number ${forecast.forecastCents < 0 ? 'negative' : ''}`}>
          {formatCents(forecast.forecastCents)}
          {forecast.forecastCents < 0 && <span className="hero-flag"> · abaixo de zero</span>}
        </p>
        <dl className="forecast-lines">
          <div><dt>Saldo atual nas contas</dt><dd>{formatCents(forecast.currentBalanceCents)}</dd></div>
          {forecast.remainingIncomeCents > 0 && (
            <div><dt>Rendas a receber</dt><dd>+ {formatCents(forecast.remainingIncomeCents)}</dd></div>
          )}
          <div><dt>Gastos em conta a vencer (recorrentes e agendados)</dt><dd>− {formatCents(forecast.remainingOutflowsCents)}</dd></div>
          <div><dt>Faturas a vencer</dt><dd>− {formatCents(forecast.statementsDueCents)}</dd></div>
        </dl>
      </section>

      <section className="panel" aria-labelledby="perday-title">
        <h2 id="perday-title">Você pode gastar por dia</h2>
        <p className="hero-number">{formatCents(forecast.perDayCents)}</p>
        <p className="muted">
          Saldo previsto dividido por {forecast.remainingDays} {forecast.remainingDays === 1 ? 'dia' : 'dias'}{' '}
          {isLastDay ? '(hoje é o último dia do mês).' : 'restantes, de amanhã até o fim do mês.'}
          {forecast.forecastCents <= 0 && ' Como o saldo previsto não sobra, o valor por dia é zero.'}
        </p>
      </section>

      {planning && (
        <section className="panel" aria-labelledby="limits-title">
          <h2 id="limits-title">Tetos do mês</h2>
          {planning.limits.every((l) => l.limitCents === null) ? (
            <p className="muted">Defina tetos em Planejamento para ver quanto ainda pode gastar.</p>
          ) : (
            <div className="limit-cards">
              {planning.limits.filter((l) => l.limitCents !== null).map((l) => (
                <div key={l.method} className="limit-card">
                  <strong>{METHOD_LABEL[l.method]}</strong>
                  <span className="hero-small">
                    {l.remainingCents! >= 0 ? formatCents(l.remainingCents!) : `${formatCents(-l.remainingCents!)} acima`}
                  </span>
                  <span className="muted">
                    {l.remainingCents! >= 0 ? 'ainda posso gastar' : 'do teto'} · {formatCents(l.usedCents)} de {formatCents(l.limitCents!)}
                  </span>
                  <UsageBar permille={l.permille} status={l.status} />
                </div>
              ))}
            </div>
          )}
        </section>
      )}

      {planning && planning.lines.some((l) => l.plannedCents > 0) && (
        <section className="panel" aria-labelledby="budget-title">
          <h2 id="budget-title">Orçamento por categoria</h2>
          <ul className="due-list">
            {planning.lines.filter((l) => l.plannedCents > 0).map((l) => (
              <li key={l.category.id}>
                <span>{l.category.name}</span>
                <span className="mono">{formatCents(l.realizedCents)} / {formatCents(l.plannedCents)} · {l.permille !== null ? formatPermille(l.permille) : ''}</span>
              </li>
            ))}
          </ul>
        </section>
      )}

      {planning && (() => {
        const alerts = planning.alertSubjects
          .map((a) => ({ a, crossed: crossedThresholds(a.usedCents, a.plannedCents) }))
          .filter(({ crossed }) => crossed.length > 0);
        return (
          <section className="panel" aria-labelledby="alerts-title">
            <h2 id="alerts-title">Alertas de orçamento</h2>
            {alerts.length === 0 ? (
              <p className="muted">Nenhuma categoria ou teto passou de 80% do planejado.</p>
            ) : (
              <ul className="due-list">
                {alerts.map(({ a, crossed }) => (
                  <li key={a.subject}>
                    <span>⚠ {a.label} passou de {Math.max(...crossed)}%</span>
                    <span className="mono">{formatCents(a.usedCents)} de {formatCents(a.plannedCents)}</span>
                  </li>
                ))}
              </ul>
            )}
          </section>
        );
      })()}

      <section className="panel" aria-labelledby="due-title">
        <h2 id="due-title">Faturas a vencer</h2>
        {overview.statementsDueThisMonth.length === 0 ? (
          <p className="muted">Nenhuma fatura em aberto vence neste mês.</p>
        ) : (
          <ul className="due-list">
            {overview.statementsDueThisMonth.map((s) => (
              <li key={s.statementId}>
                <span>{accountName(s.accountId)} · vence {dayMonth(s.dueOn)}{s.dueOn < today && ' (vencida)'}</span>
                <span className="mono">{formatCents(s.openCents)}</span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
