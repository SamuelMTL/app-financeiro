import { useEffect, useState } from 'react';
import { isClosed } from '../domain/closing/closing';
import { listClosedMonths } from '../ipc/closing';
import { monthLong } from './format';
import './Sidebar.css';

export type ScreenId =
  | 'visao-geral'
  | 'lancamentos'
  | 'cartoes'
  | 'importar'
  | 'planejamento'
  | 'analise'
  | 'fechamento';

const NAV_ITEMS: { id: ScreenId; label: string }[] = [
  { id: 'visao-geral', label: 'Visão geral' },
  { id: 'lancamentos', label: 'Lançamentos' },
  { id: 'cartoes', label: 'Cartões e contas' },
  { id: 'importar', label: 'Importar fatura' },
  { id: 'planejamento', label: 'Planejamento' },
  { id: 'analise', label: 'Análise' },
  { id: 'fechamento', label: 'Fechamento' },
];

interface SidebarProps {
  active: ScreenId;
  onNavigate: (screen: ScreenId) => void;
  onNewTransaction: () => void;
}

export function Sidebar({ active, onNavigate, onNewTransaction }: SidebarProps) {
  // Último mês fechado (mais recente ainda fechado), como nas telas de referência.
  const [lastClosed, setLastClosed] = useState<string | null>(null);
  useEffect(() => {
    listClosedMonths()
      .then((list) => setLastClosed(list.filter((c) => isClosed(list, c.month)).map((c) => c.month).sort().pop() ?? null))
      .catch(() => setLastClosed(null));
  }, [active]);

  return (
    <nav className="sidebar">
      <div className="sidebar-title">Caderno</div>

      <button className="new-tx-btn" onClick={onNewTransaction}>
        + Novo lançamento
        <span className="shortcut">⌘N</span>
      </button>

      <ul className="nav-list">
        {NAV_ITEMS.map((item) => (
          <li key={item.id}>
            <button
              className={`nav-item ${active === item.id ? 'active' : ''}`}
              onClick={() => onNavigate(item.id)}
            >
              {item.label}
            </button>
          </li>
        ))}
      </ul>

      {lastClosed && <p className="sidebar-closed">{monthLong(lastClosed).split(' de ')[0]} fechado</p>}
    </nav>
  );
}
