import { formatCents } from '../../domain/money';
import { CommitmentsChart } from '../components/CommitmentsChart';
import { dayMonth, monthLong } from '../format';
import { useOverview } from '../useOverview';
import './Lancamentos.css';
import './CartoesContas.css';
import './CartoesResumo.css';

/**
 * Topo da tela Cartões e contas (US-09): saldo de cada conta, fatura atual de
 * cada cartão, comprometido em faturas futuras e parcelamentos em andamento.
 */
export function CartoesResumo({ refreshKey }: { refreshKey?: unknown }) {
  const { overview, accounts, error } = useOverview(refreshKey);

  if (error) return <p className="error">Não foi possível calcular o resumo: {error}</p>;
  if (!overview) return null;

  const active = accounts.filter((a) => !a.archived);
  const cards = active.filter((a) => a.kind === 'credit_card');
  const cashAccounts = active.filter((a) => a.kind !== 'credit_card');
  const nameOf = (id: number) => accounts.find((a) => a.id === id)?.name ?? 'Cartão';
  const { commitments } = overview;

  return (
    <>
      <section className="panel" aria-labelledby="balances-title">
        <h2 id="balances-title">Contas</h2>
        {cashAccounts.length === 0 ? (
          <p className="muted">Nenhuma conta cadastrada.</p>
        ) : (
          <ul className="summary-list">
            {cashAccounts.map((a) => (
              <li key={a.id}>
                <span>{a.name}</span>
                <span className="mono">
                  {formatCents(overview.balances.find((b) => b.accountId === a.id)?.balanceCents ?? 0)}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="panel" aria-labelledby="cards-title">
        <h2 id="cards-title">Cartões de crédito</h2>
        {cards.length === 0 ? (
          <p className="muted">Nenhum cartão cadastrado.</p>
        ) : (
          <ul className="summary-list">
            {cards.map((card) => {
              const statement = overview.currentStatements.find((s) => s.accountId === card.id);
              return (
                <li key={card.id}>
                  <span>
                    {card.name}
                    <span className="muted">
                      {card.dueDay ? ` · vence dia ${card.dueDay}` : ''}
                      {card.creditLimitCents ? ` · limite ${formatCents(card.creditLimitCents)}` : ''}
                    </span>
                  </span>
                  <span className="mono">
                    {statement
                      ? `Fatura ${formatCents(statement.openCents)} · vence ${dayMonth(statement.dueOn)}`
                      : 'Sem fatura em aberto'}
                  </span>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <section className="panel" aria-labelledby="commit-title">
        <h2 id="commit-title">Comprometido em faturas futuras</h2>
        {commitments.length === 0 ? (
          <p className="muted">Nada comprometido além da fatura atual.</p>
        ) : (
          <>
            <p className="commit-headline">{formatCents(overview.commitmentsTotalCents)}</p>
            <p className="muted">
              de {monthLong(commitments[0].month)} a {monthLong(commitments[commitments.length - 1].month)},
              além das faturas do mês corrente.
            </p>
            <CommitmentsChart commitments={commitments} cards={cards} />
          </>
        )}
      </section>

      <section className="panel" aria-labelledby="installments-title">
        <h2 id="installments-title">Parcelamentos em andamento</h2>
        {overview.installments.length === 0 ? (
          <p className="muted">Nenhum parcelamento em andamento.</p>
        ) : (
          <table className="tx-table">
            <thead>
              <tr>
                <th>Compra</th>
                <th>Cartão</th>
                <th>Parcela</th>
                <th>Valor</th>
                <th>Restante</th>
              </tr>
            </thead>
            <tbody>
              {overview.installments.map((i) => (
                <tr key={i.groupId}>
                  <td>{i.description}</td>
                  <td>{nameOf(i.accountId)}</td>
                  <td className="mono">{i.currentNo}/{i.totalNo}</td>
                  <td className="mono">{formatCents(i.currentAmountCents)}</td>
                  <td className="mono">{formatCents(i.remainingCents)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
    </>
  );
}
