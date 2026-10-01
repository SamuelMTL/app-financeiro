/**
 * Dinheiro sempre em centavos inteiros. Nunca `float`. Formatação pt-BR só aqui,
 * na borda da UI — o resto do domínio e o banco trabalham só com `amountCents`.
 * Ver docs/CLAUDE.md, "Princípios inegociáveis".
 */

const BRL_FORMATTER = new Intl.NumberFormat('pt-BR', {
  style: 'currency',
  currency: 'BRL',
});

/** 12345 -> "R$ 123,45" */
export function formatCents(amountCents: number): string {
  if (!Number.isInteger(amountCents)) {
    throw new Error(`amountCents deve ser um inteiro, recebi ${amountCents}`);
  }
  // Intl.NumberFormat usa espaco nao-quebravel (categoria Unicode Zs) entre "R$" e
  // o valor; \s do JS cobre esses caracteres. Normaliza para espaco comum: fica
  // previsivel em testes, busca e copia.
  return BRL_FORMATTER.format(amountCents / 100).replace(/\s/g, ' ');
}

/**
 * Aceita o que a pessoa digitar num campo de valor: "123,45", "123.45", "1.234,56",
 * "1234" — sempre devolve centavos inteiros. Lança erro se não conseguir interpretar.
 */
export function parseToCents(input: string): number {
  const trimmed = input.trim();
  if (trimmed === '') {
    throw new Error('Valor vazio');
  }

  // Só dígitos, opcionalmente um separador decimal (',' ou '.') com até 2 casas,
  // e separadores de milhar opcionais. Sinal negativo não é esperado nesta borda:
  // o `kind` do lançamento é quem decide o efeito no saldo, não o sinal do valor.
  const cleaned = trimmed.replace(/[^\d.,]/g, '');
  if (cleaned === '') {
    throw new Error(`Valor inválido: "${input}"`);
  }

  const lastComma = cleaned.lastIndexOf(',');
  const lastDot = cleaned.lastIndexOf('.');
  const decimalSeparatorIndex = Math.max(lastComma, lastDot);

  let integerPart: string;
  let decimalPart: string;
  if (decimalSeparatorIndex === -1) {
    integerPart = cleaned;
    decimalPart = '';
  } else {
    integerPart = cleaned.slice(0, decimalSeparatorIndex);
    decimalPart = cleaned.slice(decimalSeparatorIndex + 1);
  }

  const digitsOnlyInteger = integerPart.replace(/[.,]/g, '');
  if (!/^\d+$/.test(digitsOnlyInteger) || !/^\d*$/.test(decimalPart) || decimalPart.length > 2) {
    throw new Error(`Valor inválido: "${input}"`);
  }

  const decimalPadded = decimalPart.padEnd(2, '0');
  const cents = Number(digitsOnlyInteger) * 100 + Number(decimalPadded || '0');
  return cents;
}

/**
 * Como `parseToCents`, mas aceita sinal negativo ("-150,00", "- 150"). Para campos em que
 * o valor pode legitimamente ser negativo, como o saldo inicial de uma conta no vermelho.
 */
export function parseSignedToCents(input: string): number {
  const trimmed = input.trim();
  const negative = /^[-−–]/.test(trimmed);
  const cents = parseToCents(negative ? trimmed.slice(1) : trimmed);
  return negative && cents !== 0 ? -cents : cents;
}

/** Soma uma lista de valores em centavos — só para deixar explícito que é sempre inteiro. */
export function sumCents(values: number[]): number {
  return values.reduce((total, value) => total + value, 0);
}
