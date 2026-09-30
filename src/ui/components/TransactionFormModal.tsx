import { useEffect, useMemo, useRef, useState } from 'react';
import { formatCents, parseToCents } from '../../domain/money';
import { todayISO } from '../../domain/dates';
import type { SimpleTransactionKind, TransactionInput } from '../../domain/transactions/validate';
import { validateTransaction } from '../../domain/transactions/validate';
import { ceilingWarning } from '../../domain/planning/ceilings';
import { splitInstallments } from '../../domain/transactions/installments';
import { previewInstallments } from '../../domain/transactions/installments';
import type { Account, Category, Transaction } from '../../domain/types';
import type { InstallmentPurchaseInput } from '../../ipc/transactions';
import { Modal } from './Modal';
import { Field } from './Field';
import { Button } from './Button';

const LAST_ACCOUNT_KEY = 'app-financeiro:last-account-id';

function readLastAccountId(): number | null {
  try {
    const raw = localStorage.getItem(LAST_ACCOUNT_KEY);
    return raw ? Number(raw) : null;
  } catch {
    return null; // localStorage pode falhar (ex.: contexto restrito) — segue sem lembrar
  }
}

function writeLastAccountId(id: number): void {
  try {
    localStorage.setItem(LAST_ACCOUNT_KEY, String(id));
  } catch {
    // não crítico — só perde a conveniência de lembrar a última conta usada
  }
}

interface TransactionFormModalProps {
  accounts: Account[];
  categories: Category[];
  /** Presente = editando; ausente = criando (US-08). */
  transaction?: Transaction;
  onClose: () => void;
  onSaved: (opts: { andNew: boolean }) => void;
  onSubmit: (input: TransactionInput) => Promise<void>;
  /** Só usado ao criar um gasto com mais de 1 parcela (US-02). */
  onSubmitInstallments?: (input: InstallmentPurchaseInput) => Promise<void>;
  /** Teto e uso do mês para a forma de pagamento da conta (US-17); `null` = sem teto definido. */
  getCeiling?: (accountId: number, purchasedOn: string) => Promise<{ limitCents: number; usedCents: number; label: string } | null>;
}

export function TransactionFormModal({
  accounts,
  categories,
  transaction,
  onClose,
  onSaved,
  onSubmit,
  onSubmitInstallments,
  getCeiling,
}: TransactionFormModalProps) {
  const amountInputRef = useRef<HTMLInputElement>(null);

  const [kind, setKind] = useState<SimpleTransactionKind>(
    transaction?.kind === 'income' ? 'income' : 'expense',
  );
  const [amountText, setAmountText] = useState(
    transaction ? formatCents(transaction.amountCents).replace('R$ ', '') : '',
  );
  const [purchasedOn, setPurchasedOn] = useState(transaction?.purchasedOn ?? todayISO());
  const [accountId, setAccountId] = useState<number | ''>(
    transaction?.accountId ?? readLastAccountId() ?? accounts[0]?.id ?? '',
  );
  const [categoryId, setCategoryId] = useState<number | ''>(transaction?.categoryId ?? '');
  const [description, setDescription] = useState(transaction?.description ?? '');
  const [notes, setNotes] = useState(transaction?.notes ?? '');
  const [tagsText, setTagsText] = useState(transaction?.tags.join(', ') ?? '');
  const [installmentsText, setInstallmentsText] = useState('1');
  const [errors, setErrors] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);

  // Parcelamento só faz sentido criando um gasto novo (US-02) — editar uma
  // parcela já lançada edita só aquela linha, não o grupo inteiro.
  const canInstallment = !transaction && kind === 'expense' && Boolean(onSubmitInstallments);
  const installmentsTotal = Math.max(1, Number(installmentsText) || 1);
  const selectedAccount = accounts.find((a) => a.id === accountId) ?? null;

  const installmentPreview = useMemo(() => {
    if (!canInstallment || installmentsTotal <= 1) return null;
    try {
      const amountCents = parseToCents(amountText || '0');
      if (amountCents <= 0) return null;
      return previewInstallments(
        purchasedOn,
        amountCents,
        installmentsTotal,
        selectedAccount?.kind === 'credit_card' ? selectedAccount.closingDay : null,
      );
    } catch {
      return null;
    }
  }, [canInstallment, installmentsTotal, amountText, purchasedOn, selectedAccount]);

  // Aviso de teto (US-17): só ao criar um gasto; avisa, não bloqueia.
  const [ceiling, setCeiling] = useState<{ limitCents: number; usedCents: number; label: string } | null>(null);
  useEffect(() => {
    if (!getCeiling || transaction || kind !== 'expense' || accountId === '') {
      setCeiling(null);
      return;
    }
    let cancelled = false;
    getCeiling(accountId, purchasedOn)
      .then((info) => !cancelled && setCeiling(info))
      .catch(() => !cancelled && setCeiling(null));
    return () => {
      cancelled = true;
    };
  }, [getCeiling, transaction, kind, accountId, purchasedOn]);

  const ceilingAlert = useMemo(() => {
    if (!ceiling) return null;
    try {
      const total = parseToCents(amountText || '0');
      if (total <= 0) return null;
      // Parcelado: só a parcela do mês da compra pesa no teto (docs/business-rules.md).
      const counted = canInstallment && installmentsTotal > 1 ? splitInstallments(total, installmentsTotal)[0] : total;
      const warning = ceilingWarning({ usedCents: ceiling.usedCents, limitCents: ceiling.limitCents, amountCents: counted });
      return warning.exceeds ? warning : null;
    } catch {
      return null;
    }
  }, [ceiling, amountText, canInstallment, installmentsTotal]);

  // Ctrl/Cmd+N abre com foco no valor (US-08).
  useEffect(() => {
    amountInputRef.current?.focus();
  }, []);

  function buildInput(): TransactionInput | null {
    let amountCents: number;
    try {
      amountCents = parseToCents(amountText);
    } catch {
      setErrors(['Valor inválido.']);
      return null;
    }

    const input: TransactionInput = {
      kind,
      accountId: accountId === '' ? 0 : accountId,
      categoryId: categoryId === '' ? null : categoryId,
      amountCents,
      purchasedOn,
      description,
      notes: notes.trim() === '' ? null : notes,
      tags: tagsText
        .split(',')
        .map((tag) => tag.trim())
        .filter((tag) => tag !== ''),
    };

    const validationErrors = validateTransaction(input);
    if (validationErrors.length > 0) {
      setErrors(validationErrors);
      return null;
    }
    return input;
  }

  async function handleSave(andNew: boolean) {
    const input = buildInput();
    if (!input) return;

    setSaving(true);
    setErrors([]);
    try {
      if (canInstallment && installmentsTotal > 1 && onSubmitInstallments) {
        await onSubmitInstallments({
          accountId: input.accountId,
          categoryId: input.categoryId,
          totalCents: input.amountCents,
          installmentsTotal,
          purchasedOn: input.purchasedOn,
          description: input.description,
          notes: input.notes,
          tags: input.tags,
          closingDay: selectedAccount?.kind === 'credit_card' ? selectedAccount.closingDay : null,
        });
      } else {
        await onSubmit(input);
      }
      writeLastAccountId(input.accountId);
      onSaved({ andNew });
    } catch (err) {
      setErrors([err instanceof Error ? err.message : String(err)]);
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal
      title={transaction ? 'Editar lançamento' : 'Novo lançamento'}
      onClose={onClose}
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={saving}>
            Cancelar
          </Button>
          {!transaction && (
            <Button variant="secondary" onClick={() => handleSave(true)} disabled={saving}>
              Salvar e novo
            </Button>
          )}
          <Button variant="primary" onClick={() => handleSave(false)} disabled={saving}>
            Salvar
          </Button>
        </>
      }
    >
      <form
        onSubmit={(e) => {
          e.preventDefault();
          handleSave(false);
        }}
        style={{ display: 'flex', flexDirection: 'column', gap: 16 }}
      >
        <div style={{ display: 'flex', gap: 8 }}>
          <Button
            type="button"
            variant={kind === 'expense' ? 'primary' : 'secondary'}
            onClick={() => setKind('expense')}
          >
            Gasto
          </Button>
          <Button
            type="button"
            variant={kind === 'income' ? 'primary' : 'secondary'}
            onClick={() => setKind('income')}
          >
            Renda
          </Button>
        </div>

        <Field label="Valor (R$)">
          <input
            ref={amountInputRef}
            className="num"
            inputMode="decimal"
            placeholder="0,00"
            value={amountText}
            onChange={(e) => setAmountText(e.target.value)}
          />
        </Field>

        <Field label="Data">
          <input
            type="date"
            value={purchasedOn}
            onChange={(e) => setPurchasedOn(e.target.value)}
          />
        </Field>

        <Field label="Conta ou cartão">
          <select
            value={accountId}
            onChange={(e) => setAccountId(e.target.value === '' ? '' : Number(e.target.value))}
          >
            <option value="">Selecione…</option>
            {accounts.map((account) => (
              <option key={account.id} value={account.id}>
                {account.name}
              </option>
            ))}
          </select>
        </Field>

        {canInstallment && (
          <Field label="Parcelas">
            <input
              type="number"
              min={1}
              max={48}
              value={installmentsText}
              onChange={(e) => setInstallmentsText(e.target.value)}
            />
          </Field>
        )}

        {installmentPreview && (
          <ul className="installment-preview">
            {installmentPreview.map((item) => (
              <li key={item.installmentNo}>
                <span>
                  {item.installmentNo}/{installmentsTotal} · {item.effectiveOn}
                </span>
                <span className="num">{formatCents(item.amountCents)}</span>
              </li>
            ))}
          </ul>
        )}

        {ceilingAlert && ceiling && (
          <p role="alert" className="ceiling-warning">
            ⚠ Esta compra passa do {ceiling.label.toLowerCase()} em {formatCents(ceilingAlert.overByCents)}.
            {ceilingAlert.remainingBeforeCents > 0
              ? ` Ainda restavam ${formatCents(ceilingAlert.remainingBeforeCents)}.`
              : ' O teto já estava estourado.'}{' '}
            Você ainda pode salvar.
          </p>
        )}

        <Field label="Categoria">
          <select
            value={categoryId}
            onChange={(e) => setCategoryId(e.target.value === '' ? '' : Number(e.target.value))}
          >
            <option value="">Sem categoria</option>
            {categories.map((category) => (
              <option key={category.id} value={category.id}>
                {category.name}
              </option>
            ))}
          </select>
        </Field>

        <Field label="Descrição">
          <input value={description} onChange={(e) => setDescription(e.target.value)} />
        </Field>

        <Field label="Tags (separadas por vírgula)">
          <input value={tagsText} onChange={(e) => setTagsText(e.target.value)} />
        </Field>

        <Field label="Observação">
          <textarea value={notes} onChange={(e) => setNotes(e.target.value)} />
        </Field>

        {errors.length > 0 && (
          <ul style={{ color: 'var(--warn)', margin: 0, paddingLeft: 20 }}>
            {errors.map((error) => (
              <li key={error}>{error}</li>
            ))}
          </ul>
        )}
      </form>
    </Modal>
  );
}
