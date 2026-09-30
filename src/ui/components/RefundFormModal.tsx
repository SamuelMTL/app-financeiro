import { useEffect, useState } from 'react';
import { formatCents, parseToCents } from '../../domain/money';
import { todayISO } from '../../domain/dates';
import { validateRefund, validateRefundAmount, type RefundInput } from '../../domain/transactions/refunds';
import type { Transaction } from '../../domain/types';
import { getRefundedCents } from '../../ipc/transactions';
import { Modal } from './Modal';
import { Field } from './Field';
import { Button } from './Button';

interface RefundFormModalProps {
  original: Transaction;
  onClose: () => void;
  onSaved: () => void;
  onSubmit: (input: RefundInput) => Promise<void>;
}

/** "A partir de um gasto, 'Registrar estorno' cria um lançamento ligado a ele" (US-06). */
export function RefundFormModal({ original, onClose, onSaved, onSubmit }: RefundFormModalProps) {
  const [amountText, setAmountText] = useState('');
  const [purchasedOn, setPurchasedOn] = useState(todayISO());
  const [notes, setNotes] = useState('');
  const [alreadyRefundedCents, setAlreadyRefundedCents] = useState<number | null>(null);
  const [errors, setErrors] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    getRefundedCents(original.id).then(setAlreadyRefundedCents);
  }, [original.id]);

  const remainingCents =
    alreadyRefundedCents === null ? null : original.amountCents - alreadyRefundedCents;

  async function handleSave() {
    let amountCents: number;
    try {
      amountCents = parseToCents(amountText);
    } catch {
      setErrors(['Valor inválido.']);
      return;
    }

    const input: RefundInput = {
      originalTransactionId: original.id,
      amountCents,
      purchasedOn,
      notes: notes.trim() === '' ? null : notes,
    };

    const fieldErrors = validateRefund(input);
    const capErrors =
      alreadyRefundedCents !== null
        ? validateRefundAmount(original.amountCents, alreadyRefundedCents, amountCents)
        : [];
    const allErrors = [...fieldErrors, ...capErrors];
    if (allErrors.length > 0) {
      setErrors(allErrors);
      return;
    }

    setSaving(true);
    setErrors([]);
    try {
      await onSubmit(input);
      onSaved();
    } catch (err) {
      setErrors([err instanceof Error ? err.message : String(err)]);
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal
      title={`Estornar "${original.description}"`}
      onClose={onClose}
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={saving}>
            Cancelar
          </Button>
          <Button variant="primary" onClick={handleSave} disabled={saving}>
            Registrar estorno
          </Button>
        </>
      }
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        <p className="muted" style={{ margin: 0 }}>
          Gasto original: {formatCents(original.amountCents)}
          {remainingCents !== null && remainingCents < original.amountCents && (
            <> · já estornado: {formatCents(original.amountCents - remainingCents)}</>
          )}
          {remainingCents !== null && <> · ainda pode estornar: {formatCents(remainingCents)}</>}
        </p>

        <Field label="Valor do estorno (R$)">
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
