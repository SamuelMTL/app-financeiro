import { useEffect, useState } from 'react';
import { Sidebar, type ScreenId } from './ui/Sidebar';
import { Lancamentos } from './ui/screens/Lancamentos';
import { CartoesContas } from './ui/screens/CartoesContas';
import { PlaceholderScreen } from './ui/screens/PlaceholderScreen';
import { TransactionFormModal } from './ui/components/TransactionFormModal';
import type { Account, Category } from './domain/types';
import { listAccounts } from './ipc/accounts';
import { listCategories } from './ipc/categories';
import { createTransaction } from './ipc/transactions';
import './ui/theme/theme.css';
import './App.css';

function Screen({ id }: { id: ScreenId }) {
  switch (id) {
    case 'visao-geral':
      return <PlaceholderScreen title="Visão geral" phase="Fase 4" />;
    case 'lancamentos':
      return <Lancamentos />;
    case 'cartoes':
      return <CartoesContas />;
    case 'importar':
      return <PlaceholderScreen title="Importar fatura" phase="Fase 3" />;
    case 'planejamento':
      return <PlaceholderScreen title="Planejamento" phase="Fase 5" />;
    case 'analise':
      return <PlaceholderScreen title="Análise" phase="Fase 6" />;
    case 'fechamento':
      return <PlaceholderScreen title="Fechamento" phase="Fase 6" />;
  }
}

function App() {
  const [activeScreen, setActiveScreen] = useState<ScreenId>('lancamentos');
  const [newTxOpen, setNewTxOpen] = useState(false);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);

  useEffect(() => {
    listAccounts().then(setAccounts);
    listCategories().then(setCategories);
  }, [newTxOpen]); // reabrir o modal (depois de salvar) já recarrega as listas

  // Atalho global Ctrl/Cmd+N — "Novo lançamento" de qualquer tela (US-08).
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      const isShortcut = (e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'n';
      if (isShortcut) {
        e.preventDefault();
        setNewTxOpen(true);
      }
    }
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  return (
    <div className="app-shell">
      <Sidebar active={activeScreen} onNavigate={setActiveScreen} onNewTransaction={() => setNewTxOpen(true)} />
      <main className="app-main">
        <Screen id={activeScreen} />
      </main>

      {newTxOpen && (
        <TransactionFormModal
          accounts={accounts}
          categories={categories}
          onClose={() => setNewTxOpen(false)}
          onSaved={({ andNew }) => {
            if (!andNew) setNewTxOpen(false);
            // "Salvar e novo" (US-08): fecha e reabre para limpar o formulário.
            else {
              setNewTxOpen(false);
              setTimeout(() => setNewTxOpen(true), 0);
            }
          }}
          onSubmit={(input) => createTransaction(input).then(() => undefined)}
        />
      )}
    </div>
  );
}

export default App;
