import { addMonths, dateInMonth, toMonth } from '../dates';

/**
 * Divide `totalCents` em `n` parcelas: `floor(total/n)` cada, com o resto de
 * centavos (sempre < n) somado na 1ª parcela. Soma das parcelas === totalCents,
 * sempre — ver docs/business-rules.md, "Parcelas".
 */
export function splitInstallments(totalCents: number, n: number): number[] {
  if (!Number.isInteger(totalCents) || totalCents <= 0) {
    throw new Error('Valor total precisa ser um inteiro positivo (centavos).');
  }
  if (!Number.isInteger(n) || n < 1) {
    throw new Error('Número de parcelas precisa ser um inteiro >= 1.');
  }

  const base = Math.floor(totalCents / n);
  const remainder = totalCents - base * n;

  return Array.from({ length: n }, (_, i) => base + (i === 0 ? remainder : 0));
}

/**
 * Mês da fatura em que a parcela `installmentNo` (1-indexado) cai.
 *
 * Regra (docs/business-rules.md): se a compra é depois do dia de fechamento do
 * cartão, a 1ª parcela cai na fatura do mês seguinte; senão, no mês corrente. As
 * demais seguem mês a mês a partir daí. Sem cartão (closingDay null — conta
 * corrente/dinheiro), não há deslocamento: a 1ª parcela fica no mês da compra.
 */
export function installmentStatementMonth(
  purchasedOn: string,
  installmentNo: number,
  closingDay: number | null,
): string {
  const purchaseMonth = toMonth(purchasedOn);
  const purchaseDay = Number(purchasedOn.slice(8, 10));

  const firstInstallmentMonth =
    closingDay !== null && purchaseDay > closingDay ? addMonths(purchaseMonth, 1) : purchaseMonth;

  return addMonths(firstInstallmentMonth, installmentNo - 1);
}

export interface InstallmentPreviewItem {
  installmentNo: number;
  amountCents: number;
  /** Data efetiva da parcela: mesmo dia da compra, ajustado para o mês da fatura. */
  effectiveOn: string;
}

/** Prévia mostrada antes de confirmar (US-02): mês, nº e valor de cada parcela. */
export function previewInstallments(
  purchasedOn: string,
  totalCents: number,
  installmentsTotal: number,
  closingDay: number | null,
): InstallmentPreviewItem[] {
  const amounts = splitInstallments(totalCents, installmentsTotal);
  const purchaseDay = Number(purchasedOn.slice(8, 10));

  return amounts.map((amountCents, index) => {
    const installmentNo = index + 1;
    const month = installmentStatementMonth(purchasedOn, installmentNo, closingDay);
    return { installmentNo, amountCents, effectiveOn: dateInMonth(month, purchaseDay) };
  });
}
