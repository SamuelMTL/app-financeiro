import { useEffect, useState } from 'react';
import { formatCents } from '../../domain/money';
import type { Account, Category, Transaction, TransactionKind } from '../../domain/types';
import { listAccounts } from '../../ipc/accounts';
import { listCategories } from '../../ipc/categories';
import {
  createCardPayment,
  createRefund,
  createTransfer,
  deleteTransaction,
  listTransactions,
  updateTransaction,
} from '../../ipc/transactions';
import { TransactionFormModal } from '../components/TransactionFormModal';
import { TransferFormModal } from '../components/TransferFormModal';
import { RefundFormModal } from '../components/RefundFormModal';
import { Button } from '../components/Button';
import './Lancamentos.css';

const KIND_LABEL: Record<TransactionKind, string> = {
  expense: 'Gasto',
  income: 'Renda',
  transfer: 'Transferência',
  card_payment: 'Pagamento de fatura',
  refund: 'Estorno',
};

export function Lancamentos() {
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [search, setSearch] = useState('');
  const [accountFilter, setAccountFilter] = useState<number | ''>('');
  const [categoryFilter, setCategoryFilter] = useState<number | ''>('');
  const [editing, setEditing] = useState<Transaction | null>(null);
  const [refunding, setRefunding] = useState<Transaction | null>(null);
  const [transferOpen, setTransferOpen] = useState(false);
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

  function accountName(id: number | null): string {
    if (id === null) return '—';
    return accounts.find((a) => a.id === id)?.name ?? '—';
  }

  function categoryName(id: number | null): string {
    if (id === null) return '—';
    return categories.find((c) => c.id === id)?.name ?? '—';
  }

  function accountLabel(tx: Transaction): string {
    if (tx.kind === 'transfer' || tx.kind === 'card_payment') {
      return `${accountName(tx.accountId)} → ${accountName(tx.destAccountId)}`;
    }
    return accountName(tx.accountId);
  }

  function amountDisplay(tx: Transaction): { text: string; className: string } {
    if (tx.kind === 'income' || tx.kind === 'refund') {
      return { text: `+ ${formatCents(tx.amountCents)}`, className: 'positive' };
    }
    if (tx.kind === 'transfer' || tx.kind === 'card_payment') {
      return { text: formatCents(tx.amountCents), className: 'neutral' };
    }
    return { text: `- ${formatCents(tx.amountCents)}`, className: '' };
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
        <Button variant="secondary" onClick={() => setTransferOpen(true)}>
          Transferência / pagamento de fatura
        </Button>
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
            {transactions.map((tx) => {
              const amount = amountDisplay(tx);
              return (
                <tr key={tx.id} onClick={() => setEditing(tx)}>
                  <td className="num-mono">{tx.purchasedOn}</td>
                  <td>
                    {tx.description}
                    <span className="tag-chip kind-chip">{KIND_LABEL[tx.kind]}</span>
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
                  <td>{accountLabel(tx)}</td>
                  <td className={`num ${amount.className}`}>{amount.text}</td>
                  <td className="row-actions">
                    {tx.kind === 'expense' && (
                      <button
                        className="link"
                        onClick={(e) => {
                          e.stopPropagation();
                          setRefunding(tx);
                        }}
                      >
                        Estornar
                      </button>
                    )}
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
              );
            })}
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

      {transferOpen && (
        <TransferFormModal
          accounts={accounts}
          onClose={() => setTransferOpen(false)}
          onSaved={() => {
            setTransferOpen(false);
            reload();
          }}
          onSubmitTransfer={(input) => createTransfer(input).then(() => undefined)}
          onSubmitCardPayment={(input) => createCardPayment(input).then(() => undefined)}
        />
      )}

      {refunding && (
        <RefundFormModal
          original={refunding}
          onClose={() => setRefunding(null)}
          onSaved={() => {
            setRefunding(null);
            reload();
          }}
          onSubmit={(input) => createRefund(input).then(() => undefined)}
        />
      )}
    </div>
  );
}
