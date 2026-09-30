import type { CommitmentMonth } from '../../domain/overview/commitments';
import type { Account } from '../../domain/types';
import { formatCents } from '../../domain/money';
import { monthShort } from '../format';
import './CommitmentsChart.css';

const SERIES_COLORS = ['var(--primary)', 'var(--chart-neutral)', 'var(--warn-fill)', 'var(--border-strong)'];

interface Props {
  commitments: CommitmentMonth[];
  cards: Account[];
}

/**
 * Barras empilhadas por cartão, uma coluna por mês futuro (US-09). CSS puro —
 * sem biblioteca de gráficos. O total de cada mês vem escrito acima da barra e
 * a legenda diz qual cor é qual cartão (nunca só cor).
 */
export function CommitmentsChart({ commitments, cards }: Props) {
  const max = Math.max(1, ...commitments.map((m) => m.totalCents));
  const colorOf = (accountId: number) => {
    const index = cards.findIndex((c) => c.id === accountId);
    return SERIES_COLORS[Math.max(0, index) % SERIES_COLORS.length];
  };

  return (
    <figure className="commit-chart">
      <ul className="commit-legend">
        {cards.map((card) => (
          <li key={card.id}>
            <span className="swatch" style={{ background: colorOf(card.id) }} aria-hidden />
            {card.name}
          </li>
        ))}
      </ul>
      <div className="commit-bars" role="img" aria-label="Comprometido em faturas futuras, por mês">
        {commitments.map((m) => (
          <div key={m.month} className="commit-col">
            <span className="commit-total">{formatCents(m.totalCents).replace('R$ ', '')}</span>
            <div className="commit-stack" style={{ height: `${(m.totalCents / max) * 100}%` }}>
              {m.byCard.map((part) => (
                <div
                  key={part.accountId}
                  className="commit-seg"
                  style={{ flexGrow: part.cents, background: colorOf(part.accountId) }}
                  title={`${cards.find((c) => c.id === part.accountId)?.name ?? 'Cartão'}: ${formatCents(part.cents)}`}
                />
              ))}
            </div>
            <span className="commit-month">{monthShort(m.month)}</span>
          </div>
        ))}
      </div>
    </figure>
  );
}
