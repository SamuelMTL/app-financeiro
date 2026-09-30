import { useEffect, useState } from 'react';
import { formatCents } from '../../domain/money';
import type { Account, Category, Transaction } from '../../domain/types';
import { listAccounts } from '../../ipc/accounts';
import { listCategories } from '../../ipc/categories';
import { deleteTransaction, listTransactions, updateTransaction } from '../../ipc/transactions';
import { TransactionFormModal } from '../components/TransactionFormModal';
import './Lancamentos.css';

export function Lancamentos() {
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [search, setSearch] = useState('');
  const [accountFilter, setAccountFilter] = useState<number | ''>('');
  const [categoryFilter, setCategoryFilter] = useState<number | ''>('');
  const [editing, setEditing] = useState<Transaction | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  async function reload() {
    setLoading(true);
    setError(null);
    try {
      const [accs, cats, txs] = await Promise.all([
        listAccounts(),
        listCategories(),
        listTransactions({
          search: search || undefined,
          accountId: accountFilter || undefined,
          categoryId: categoryFilter || undefined,
        }),
      ]);
      setAccounts(accs);
      setCategories(cats);
      setTransactions(txs);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    reload();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search, accountFilter, categoryFilter]);

  function accountName(id: number): string {
    return accounts.find((a) => a.id === id)?.name ?? '—';
  }

  function categoryName(id: number | null): string {
    if (id === null) return '—';
    return categories.find((c) => c.id === id)?.name ?? '—';
  }

  async function handleDelete(transaction: Transaction) {
    const confirmed = window.confirm(`Excluir "${transaction.description}"?`);
    if (!confirmed) return;
    await deleteTransaction(transaction.id);
    await reload();
  }

  return (
    <div className="screen lancamentos">
      <header className="screen-header">
        <h1>Lançamentos</h1>
      </header>

      <div className="filters">
        <input
          className="search"
          placeholder="Buscar por descrição, observação ou tag…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <select value={accountFilter} onChange={(e) => setAccountFilter(e.target.value === '' ? '' : Number(e.target.value))}>
          <option value="">Todas as contas/cartões</option>
          {accounts.map((account) => (
            <option key={account.id} value={account.id}>
              {account.name}
            </option>
          ))}
        </select>
        <select value={categoryFilter} onChange={(e) => setCategoryFilter(e.target.value === '' ? '' : Number(e.target.value))}>
          <option value="">Todas as categorias</option>
          {categories.map((category) => (
            <option key={category.id} value={category.id}>
              {category.name}
            </option>
          ))}
        </select>
      </div>

      {error && <p className="error">{error}</p>}
      {loading ? (
        <p className="muted">Carregando…</p>
      ) : transactions.length === 0 ? (
        <p className="muted">Nenhum lançamento encontrado.</p>
      ) : (
        <table className="tx-table">
          <thead>
            <tr>
              <th>Data</th>
              <th>Descrição</th>
              <th>Categoria</th>
              <th>Conta/cartão</th>
              <th className="num">Valor</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {transactions.map((tx) => (
              <tr key={tx.id} onClick={() => setEditing(tx)}>
                <td className="num-mono">{tx.purchasedOn}</td>
                <td>
                  {tx.description}
                  {tx.tags.length > 0 && (
                    <span className="tags">
                      {tx.tags.map((tag) => (
                        <span key={tag} className="tag-chip">
                          {tag}
                        </span>
                      ))}
                    </span>
                  )}
                </td>
                <td>{categoryName(tx.categoryId)}</td>
                <td>{accountName(tx.accountId)}</td>
                <td className={`num ${tx.kind === 'income' ? 'positive' : ''}`}>
                  {tx.kind === 'income' ? '+ ' : '- '}
                  {formatCents(tx.amountCents)}
                </td>
                <td>
                  <button
                    className="row-delete"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleDelete(tx);
                    }}
                    aria-label="Excluir"
                  >
                    ×
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {editing && (
        <TransactionFormModal
          accounts={accounts}
          categories={categories}
          transaction={editing}
          onClose={() => setEditing(null)}
          onSaved={() => setEditing(null)}
          onSubmit={(input) => updateTransaction(editing.id, input).then(() => reload())}
        />
      )}
    </div>
  );
}
