import { formatPermille, STATUS_LABEL, type UsageStatus } from '../../domain/planning/usage';
import './UsageBar.css';

interface Props {
  permille: number | null;
  status: UsageStatus;
}

/** Barra de uso com marca nos 80%. A situação sempre vem escrita (nunca só cor). */
export function UsageBar({ permille, status }: Props) {
  const width = Math.min(100, (permille ?? 0) / 10);
  return (
    <div className="usage">
      <div className="usage-track" aria-hidden>
        <div className={`usage-fill ${status}`} style={{ width: `${width}%` }} />
        <div className="usage-mark" />
      </div>
      <span className={`usage-text ${status}`}>
        {permille === null ? 'sem teto' : formatPermille(permille)} · {STATUS_LABEL[status]}
      </span>
    </div>
  );
}
