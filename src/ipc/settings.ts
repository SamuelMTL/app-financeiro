import type { SpendOptions } from '../domain/planning/spending';

const KEY = 'caderno.incluirParcelasAntigasNoTeto';

/**
 * Opções de cálculo (docs/business-rules.md, "Decisão em aberto"). Guardadas no
 * armazenamento local do app — é preferência de tela, não dado financeiro.
 */
export function getSpendOptions(): SpendOptions {
  try {
    return { incluirParcelasAntigasNoTeto: localStorage.getItem(KEY) === '1' };
  } catch {
    return { incluirParcelasAntigasNoTeto: false };
  }
}

export function setIncluirParcelasAntigas(value: boolean): void {
  try {
    localStorage.setItem(KEY, value ? '1' : '0');
  } catch {
    /* sem armazenamento: fica no padrão */
  }
}
