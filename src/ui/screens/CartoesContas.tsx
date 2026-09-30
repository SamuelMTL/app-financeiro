import { useEffect, useState } from 'react';
import { formatCents, parseToCents } from '../../domain/money';
import { validateAccount, type AccountInput } from '../../domain/accounts/validate';
import { validateCategory, type CategoryInput } from '../../domain/categories/validate';
import type { Account, AccountKind, Category, CategoryGroup } from '../../domain/types';
import { archiveAccount, createAccount, listAccounts, updateAccount } from '../../ipc/accounts';
import { createCategory, deleteCategory, listCategories } from '../../ipc/categories';
import { Button } from '../components/Button';
import { Field } from '../components/Field';
import './Lancamentos.css'; // .screen, .screen-header, .muted (compartilhados entre telas)
import './CartoesContas.css';

const ACCOUNT_KIND_LABEL: Record<AccountKind, string> = {
  checking: 'Conta corrente',
  cash: 'Dinheiro',
  credit_card: 'Cartão de crédito',
};

const CATEGORY_GROUP_LABEL: Record<CategoryGroup, string> = {
  need: 'Necessidade',
  want: 'Querer',
  invest: 'Investimento',
  income: 'Renda',
  neutral: 'Neutro',
};

const emptyAccountForm = {
  name: '',
  kind: 'checking' as AccountKind,
  openingBalanceText: '0,00',
  creditLimitText: '',
  closingDay: '',
  dueDay: '',
};

function buildAccountInput(form: typeof emptyAccountForm): AccountInput | null {
  try {
    return {
      name: form.name,
      kind: form.kind,
      openingBalanceCents: parseToCents(form.openingBalanceText || '0'),
      creditLimitCents: form.kind === 'credit_card' ? parseToCents(form.creditLimitText || '0') : null,
      closingDay: form.kind === 'credit_card' && form.closingDay ? Number(form.closingDay) : null,
      dueDay: form.kind === 'credit_card' && form.dueDay ? Number(form.dueDay) : null,
    };
  } catch {
    return null;
  }
}

export function CartoesContas() {
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [accountForm, setAccountForm] = useState(emptyAccountForm);
  const [accountErrors, setAccountErrors] = useState<string[]>([]);
  const [editingAccountId, setEditingAccountId] = useState<number | null>(null);

  const [categoryName, setCategoryName] = useState('');
  const [categoryGroup, setCategoryGroup] = useState<CategoryGroup>('want');
  const [categoryErrors, setCategoryErrors] = useState<string[]>([]);

  async function reload() {
    const [accs, cats] = await Promise.all([listAccounts({ includeArchived: true }), listCategories()]);
    setAccounts(accs);
    setCategories(cats);
  }

  useEffect(() => {
    reload();
  }, []);

  function startEditAccount(account: Account) {
    setEditingAccountId(account.id);
    setAccountForm({
      name: account.name,
      kind: account.kind,
      openingBalanceText: formatCents(account.openingBalanceCents).replace('R$ ', ''),
      creditLimitText: account.creditLimitCents !== null ? formatCents(account.creditLimitCents).replace('R$ ', '') : '',
      closingDay: account.closingDay?.toString() ?? '',
      dueDay: account.dueDay?.toString() ?? '',
    });
  }

  async function handleSaveAccount() {
    const input = buildAccountInput(accountForm);
    if (!input) {
      setAccountErrors(['Valor inválido.']);
      return;
    }
    const errors = validateAccount(input);
    if (errors.length > 0) {
      setAccountErrors(errors);
      return;
    }
    setAccountErrors([]);
    if (editingAccountId) {
      await updateAccount(editingAccountId, input);
    } else {
      await createAccount(input);
    }
    setAccountForm(emptyAccountForm);
    setEditingAccountId(null);
    await reload();
  }

  async function handleArchiveAccount(id: number) {
    const confirmed = window.confirm('Arquivar esta conta/cartão? Ela some das listas, mas o histórico continua.');
    if (!confirmed) return;
    await archiveAccount(id);
    await reload();
  }

  async function handleAddCategory() {
    const input: CategoryInput = { name: categoryName, groupKind: categoryGroup };
    const errors = validateCategory(input);
    if (errors.length > 0) {
      setCategoryErrors(errors);
      return;
    }
    setCategoryErrors([]);
    await createCategory(input);
    setCategoryName('');
    await reload();
  }

  async function handleDeleteCategory(id: number) {
    try {
      await deleteCategory(id);
      await reload();
    } catch (err) {
      alert(err instanceof Error ? err.message : String(err));
    }
  }

  return (
    <div className="screen">
      <header className="screen-header">
        <h1>Cartões e contas</h1>
      </header>

      <section className="panel">
        <h2>{editingAccountId ? 'Editar conta/cartão' : 'Nova conta/cartão'}</h2>
        <div className="account-form">
          <Field label="Nome">
            <input
              value={accountForm.name}
              onChange={(e) => setAccountForm({ ...accountForm, name: e.target.value })}
            />
          </Field>
          <Field label="Tipo">
            <select
              value={accountForm.kind}
              onChange={(e) => setAccountForm({ ...accountForm, kind: e.target.value as AccountKind })}
            >
              <option value="checking">Conta corrente</option>
              <option value="cash">Dinheiro</option>
              <option value="credit_card">Cartão de crédito</option>
            </select>
          </Field>
          <Field label="Saldo inicial (R$)">
            <input
              className="num"
              value={accountForm.openingBalanceText}
              onChange={(e) => setAccountForm({ ...accountForm, openingBalanceText: e.target.value })}
            />
          </Field>
          {accountForm.kind === 'credit_card' && (
            <>
              <Field label="Limite (R$)">
                <input
                  className="num"
                  value={accountForm.creditLimitText}
                  onChange={(e) => setAccountForm({ ...accountForm, creditLimitText: e.target.value })}
                />
              </Field>
              <Field label="Dia de fechamento">
                <input
                  type="number"
                  min={1}
                  max={31}
                  value={accountForm.closingDay}
                  onChange={(e) => setAccountForm({ ...accountForm, closingDay: e.target.value })}
                />
              </Field>
              <Field label="Dia de vencimento">
                <input
                  type="number"
                  min={1}
                  max={31}
                  value={accountForm.dueDay}
                  onChange={(e) => setAccountForm({ ...accountForm, dueDay: e.target.value })}
                />
              </Field>
            </>
          )}
        </div>
        {accountErrors.length > 0 && (
          <ul className="errors">
            {accountErrors.map((e) => (
              <li key={e}>{e}</li>
            ))}
          </ul>
        )}
        <div className="panel-actions">
          {editingAccountId && (
            <Button
              variant="secondary"
              onClick={() => {
                setEditingAccountId(null);
                setAccountForm(emptyAccountForm);
              }}
            >
              Cancelar edição
            </Button>
          )}
          <Button variant="primary" onClick={handleSaveAccount}>
            {editingAccountId ? 'Salvar alterações' : 'Adicionar'}
          </Button>
        </div>
      </section>

      <section className="panel">
        <h2>Suas contas e cartões</h2>
        <ul className="account-list">
          {accounts.map((account) => (
            <li key={account.id} className={account.archived ? 'archived' : ''}>
              <div>
                <strong>{account.name}</strong>
                <span className="muted"> · {ACCOUNT_KIND_LABEL[account.kind]}</span>
                {account.archived && <span className="muted"> · arquivada</span>}
              </div>
              <div className="account-list-actions">
                <button className="link" onClick={() => startEditAccount(account)}>
                  Editar
                </button>
                {!account.archived && (
                  <button className="link" onClick={() => handleArchiveAccount(account.id)}>
                    Arquivar
                  </button>
                )}
              </div>
            </li>
          ))}
        </ul>
      </section>

      <section className="panel">
        <h2>Categorias</h2>
        <div className="category-form">
          <Field label="Nome">
            <input value={categoryName} onChange={(e) => setCategoryName(e.target.value)} />
          </Field>
          <Field label="Grupo">
            <select value={categoryGroup} onChange={(e) => setCategoryGroup(e.target.value as CategoryGroup)}>
              {Object.entries(CATEGORY_GROUP_LABEL).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </Field>
          <Button variant="primary" onClick={handleAddCategory}>
            Adicionar
          </Button>
        </div>
        {categoryErrors.length > 0 && (
          <ul className="errors">
            {categoryErrors.map((e) => (
              <li key={e}>{e}</li>
            ))}
          </ul>
        )}
        <ul className="category-list">
          {categories.map((category) => (
            <li key={category.id}>
              <span>
                {category.name} <span className="muted">· {CATEGORY_GROUP_LABEL[category.groupKind]}</span>
              </span>
              <button className="link" onClick={() => handleDeleteCategory(category.id)}>
                Excluir
              </button>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
