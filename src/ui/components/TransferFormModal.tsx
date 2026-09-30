import { useState } from 'react';
import { parseToCents } from '../../domain/money';
import { todayISO } from '../../domain/dates';
import { validateTransfer, type TransferInput } from '../../domain/transactions/transfers';
import type { Account } from '../../domain/types';
import { Modal } from './Modal';
import { Field } from './Field';
import { Button } from './Button';

type TransferKind = 'transfer' | 'card_payment';

interface TransferFormModalProps {
  accounts: Account[];
  onClose: () => void;
  onSaved: () => void;
  onSubmitTransfer: (input: TransferInput) => Promise<void>;
  onSubmitCardPayment: (input: TransferInput) => Promise<void>;
}

/**
 * Transferência entre contas e pagamento de fatura (US-05) — mesmo formato de
 * dados, só muda o `kind` gravado e quais contas aparecem como destino.
 */
export function TransferFormModal({
  accounts,
  onClose,
  onSaved,
  onSubmitTransfer,
  onSubmitCardPayment,
}: TransferFormModalProps) {
  const [kind, setKind] = useState<TransferKind>('transfer');
  const [amountText, setAmountText] = useState('');
  const [purchasedOn, setPurchasedOn] = useState(todayISO());
  const [accountId, setAccountId] = useState<number | ''>('');
  const [destAccountId, setDestAccountId] = useState<number | ''>('');
  const [notes, setNotes] = useState('');
  const [errors, setErrors] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);

  // Pagamento de fatura só pode ter cartão como destino; transferência simples
  // nunca tem cartão como destino (pagar fatura é sempre "Pagamento de fatura",
  // para manter o vínculo com a fatura do cartão certo).
  const destOptions =
    kind === 'card_payment'
      ? accounts.filter((a) => a.kind === 'credit_card' && a.id !== accountId)
      : accounts.filter((a) => a.kind !== 'credit_card' && a.id !== accountId);

  async function handleSave() {
    let amountCents: number;
    try {
      amountCents = parseToCents(amountText);
    } catch {
      setErrors(['Valor inválido.']);
      return;
    }

    const input: TransferInput = {
      accountId: accountId === '' ? 0 : accountId,
      destAccountId: destAccountId === '' ? 0 : destAccountId,
      amountCents,
      purchasedOn,
      description: kind === 'card_payment' ? 'Pagamento de fatura' : 'Transferência',
      notes: notes.trim() === '' ? null : notes,
    };

    const validationErrors = validateTransfer(input);
    if (validationErrors.length > 0) {
      setErrors(validationErrors);
      return;
    }

    setSaving(true);
    setErrors([]);
    try {
      if (kind === 'card_payment') {
        await onSubmitCardPayment(input);
      } else {
        await onSubmitTransfer(input);
      }
      onSaved();
    } catch (err) {
      setErrors([err instanceof Error ? err.message : String(err)]);
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal
      title={kind === 'card_payment' ? 'Pagamento de fatura' : 'Transferência'}
      onClose={onClose}
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={saving}>
            Cancelar
          </Button>
          <Button variant="primary" onClick={handleSave} disabled={saving}>
            Salvar
          </Button>
        </>
      }
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        <div style={{ display: 'flex', gap: 8 }}>
          <Button
            type="button"
            variant={kind === 'transfer' ? 'primary' : 'secondary'}
            onClick={() => {
              setKind('transfer');
              setDestAccountId('');
            }}
          >
            Transferência
          </Button>
          <Button
            type="button"
            variant={kind === 'card_payment' ? 'primary' : 'secondary'}
            onClick={() => {
              setKind('card_payment');
              setDestAccountId('');
            }}
          >
            Pagamento de fatura
          </Button>
        </div>

        <Field label="Valor (R$)">
          <input
            className="num"
            inputMode="decimal"
            placeholder="0,00"
            value={amountText}
            onChange={(e) => setAmountText(e.target.value)}
          />
        </Field>

        <Field label="Data">
          <input type="date" value={purchasedOn} onChange={(e) => setPurchasedOn(e.target.value)} />
        </Field>

        <Field label={kind === 'card_payment' ? 'Conta que paga' : 'Conta de origem'}>
          <select
            value={accountId}
            onChange={(e) => setAccountId(e.target.value === '' ? '' : Number(e.target.value))}
          >
            <option value="">Selecione…</option>
            {/* Origem nunca é cartão: transferência e pagamento de fatura sempre saem de
                conta corrente ou dinheiro — cartão só entra como destino do pagamento. */}
            {accounts
              .filter((a) => a.kind !== 'credit_card')
              .map((account) => (
                <option key={account.id} value={account.id}>
                  {account.name}
                </option>
              ))}
          </select>
        </Field>

        <Field label={kind === 'card_payment' ? 'Cartão a pagar' : 'Conta de destino'}>
          <select
            value={destAccountId}
            onChange={(e) => setDestAccountId(e.target.value === '' ? '' : Number(e.target.value))}
          >
            <option value="">Selecione…</option>
            {destOptions.map((account) => (
              <option key={account.id} value={account.id}>
                {account.name}
              </option>
            ))}
          </select>
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
      </div>
    </Modal>
  );
}
