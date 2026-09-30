/**
 * "Detectar N/M na descrição como parcela N de M" — docs/business-rules.md.
 * Heurística simples (primeiro "N/M" de 1-2 dígitos na descrição); descrições de
 * loja que por acaso contenham esse padrão são um falso positivo aceito, igual
 * ao comportamento descrito no documento de referência.
 */
export interface DetectedInstallmentTag {
  installmentNo: number;
  installmentsTotal: number;
  /** Descrição sem o "N/M", espaços colapsados. */
  cleanDescription: string;
}

const INSTALLMENT_RE = /(\d{1,2})\s*\/\s*(\d{1,2})/;

export function detectInstallmentTag(description: string): DetectedInstallmentTag | null {
  const match = INSTALLMENT_RE.exec(description);
  if (!match || match.index === undefined) return null;

  const installmentNo = Number(match[1]);
  const installmentsTotal = Number(match[2]);
  if (installmentNo < 1 || installmentsTotal < 1 || installmentNo > installmentsTotal) {
    return null;
  }

  const cleanDescription = (
    description.slice(0, match.index) + description.slice(match.index + match[0].length)
  )
    .replace(/\s+/g, ' ')
    .trim();

  return { installmentNo, installmentsTotal, cleanDescription };
}
