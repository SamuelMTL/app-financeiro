import { useEffect, useRef, useState } from 'react';
import { formatCents, parseSignedToCents, parseToCents } from '../../domain/money';
import { todayISO } from '../../domain/dates';
import { validateAccount, type AccountInput } from '../../domain/accounts/validate';
import { validateCategory, type CategoryInput } from '../../domain/categories/validate';
import { validateRecurrence, type RecurrenceInput } from '../../domain/recurrences/validate';
import type { Account, AccountKind, Category, CategoryGroup, Recurrence } from '../../domain/types';
import { archiveAccount, createAccount, listAccounts, updateAccount } from '../../ipc/accounts';
import { createCategory, deleteCategory, listCategories } from '../../ipc/categories';
import { createRecurrence, deleteRecurrence, listRecurrences } from '../../ipc/recurrences';
import { Button } from '../components/Button';
import { Field } from '../components/Field';
import { CartoesResumo } from './CartoesResumo';
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
      openingBalanceCents: parseSignedToCents(form.openingBalanceText || '0'),
      creditLimitCents: form.kind === 'credit_card' ? parseToCents(form.creditLimitText || '0') : null,
      closingDay: form.kind === 'credit_card' && form.closingDay ? Number(form.closingDay) : null,
      dueDay: form.kind === 'credit_card' && form.dueDay ? Number(form.dueDay) : null,
    };
  } catch {
    return null;
  }
}

const emptyRecurrenceForm = {
  kind: 'expense' as 'expense' | 'income',
  description: '',
  amountText: '',
  dayOfMonth: '5',
  accountId: '' as number | '',
  categoryId: '' as number | '',
  startsOn: todayISO(),
  endsOn: '',
};

function buildRecurrenceInput(form: typeof emptyRecurrenceForm): RecurrenceInput | null {
  try {
    return {
      kind: form.kind,
      description: form.description,
      amountCents: parseToCents(form.amountText || '0'),
      dayOfMonth: Number(form.dayOfMonth),
      accountId: form.accountId === '' ? 0 : form.accountId,
      categoryId: form.categoryId === '' ? null : form.categoryId,
      startsOn: form.startsOn,
      endsOn: form.endsOn === '' ? null : form.endsOn,
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

  const [recurrences, setRecurrences] = useState<Recurrence[]>([]);
  const accountFormRef = useRef<HTMLElement>(null);
  const [recurrenceForm, setRecurrenceForm] = useState(emptyRecurrenceForm);
  const [recurrenceErrors, setRecurrenceErrors] = useState<string[]>([]);

  async function reload() {
    const [accs, cats, recs] = await Promise.all([
      listAccounts({ includeArchived: true }),
      listCategories(),
      listRecurrences(),
    ]);
    setAccounts(accs);
    setCategories(cats);
    setRecurrences(recs);
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
    accountFormRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
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

  async function handleAddRecurrence() {
    const input = buildRecurrenceInput(recurrenceForm);
    if (!input) {
      setRecurrenceErrors(['Valor inválido.']);
      return;
    }
    const errors = validateRecurrence(input);
    if (errors.length > 0) {
      setRecurrenceErrors(errors);
      return;
    }
    setRecurrenceErrors([]);
    await createRecurrence(input);
    setRecurrenceForm(emptyRecurrenceForm);
    await reload();
  }

  async function handleDeleteRecurrence(id: number) {
    const confirmed = window.confirm('Excluir esta recorrência? Os lançamentos já gerados por ela continuam no histórico.');
    if (!confirmed) return;
    await deleteRecurrence(id);
    await reload();
  }

  return (
    <div className="screen">
      <header className="screen-header">
        <h1>Cartões e contas</h1>
      </header>

      <CartoesResumo refreshKey={accounts} />

      <section className="panel" ref={accountFormRef}>
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
          <Field label="Saldo inicial (R$) — use - para saldo negativo">
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
                {account.kind !== 'credit_card' && (
                  <span className="muted"> · saldo inicial {formatCents(account.openingBalanceCents)}</span>
                )}
                {account.archived && <span className="muted"> · arquivada</span>}
              </div>
              <div className="account-list-actions">
                <button className="link" onClick={() => startEditAccount(account)}>
                  {account.kind !== 'credit_card' ? 'Editar / corrigir saldo inicial' : 'Editar'}
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

      <section className="panel">
        <h2>Recorrências</h2>
        <p className="muted" style={{ margin: 0 }}>
          Aluguel, assinaturas, salário — o lançamento do mês aparece sozinho em Lançamentos.
        </p>
        <div className="account-form">
          <Field label="Tipo">
            <select
              value={recurrenceForm.kind}
              onChange={(e) =>
                setRecurrenceForm({ ...recurrenceForm, kind: e.target.value as 'expense' | 'income' })
              }
            >
              <option value="expense">Gasto</option>
              <option value="income">Renda</option>
            </select>
          </Field>
          <Field label="Descrição">
            <input
              value={recurrenceForm.description}
              onChange={(e) => setRecurrenceForm({ ...recurrenceForm, description: e.target.value })}
            />
          </Field>
          <Field label="Valor (R$)">
            <input
              className="num"
              value={recurrenceForm.amountText}
              onChange={(e) => setRecurrenceForm({ ...recurrenceForm, amountText: e.target.value })}
            />
          </Field>
          <Field label="Dia do mês">
            <input
              type="number"
              min={1}
              max={31}
              value={recurrenceForm.dayOfMonth}
              onChange={(e) => setRecurrenceForm({ ...recurrenceForm, dayOfMonth: e.target.value })}
            />
          </Field>
          <Field label="Conta ou cartão">
            <select
              value={recurrenceForm.accountId}
              onChange={(e) =>
                setRecurrenceForm({
                  ...recurrenceForm,
                  accountId: e.target.value === '' ? '' : Number(e.target.value),
                })
              }
            >
              <option value="">Selecione…</option>
              {accounts
                .filter((a) => !a.archived)
                .map((account) => (
                  <option key={account.id} value={account.id}>
                    {account.name}
                  </option>
                ))}
            </select>
          </Field>
          <Field label="Categoria">
            <select
              value={recurrenceForm.categoryId}
              onChange={(e) =>
                setRecurrenceForm({
                  ...recurrenceForm,
                  categoryId: e.target.value === '' ? '' : Number(e.target.value),
                })
              }
            >
              <option value="">Sem categoria</option>
              {categories.map((category) => (
                <option key={category.id} value={category.id}>
                  {category.name}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Início">
            <input
              type="date"
              value={recurrenceForm.startsOn}
              onChange={(e) => setRecurrenceForm({ ...recurrenceForm, startsOn: e.target.value })}
            />
          </Field>
          <Field label="Fim (opcional)">
            <input
              type="date"
              value={recurrenceForm.endsOn}
              onChange={(e) => setRecurrenceForm({ ...recurrenceForm, endsOn: e.target.value })}
            />
          </Field>
        </div>
        {recurrenceErrors.length > 0 && (
          <ul className="errors">
            {recurrenceErrors.map((e) => (
              <li key={e}>{e}</li>
            ))}
          </ul>
        )}
        <div className="panel-actions">
          <Button variant="primary" onClick={handleAddRecurrence}>
            Adicionar
          </Button>
        </div>
        <ul className="category-list">
          {recurrences.map((recurrence) => (
            <li key={recurrence.id}>
              <span>
                {recurrence.description}{' '}
                <span className="muted">
                  · {formatCents(recurrence.amountCents)} · dia {recurrence.dayOfMonth} ·{' '}
                  {accounts.find((a) => a.id === recurrence.accountId)?.name ?? '—'}
                  {recurrence.endsOn && ` · até ${recurrence.endsOn}`}
                </span>
              </span>
              <button className="link" onClick={() => handleDeleteRecurrence(recurrence.id)}>
                Excluir
              </button>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
