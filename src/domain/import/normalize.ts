/**
 * "Descrição normalizada (sem acento, maiúsculas, sem espaços extras)" —
 * docs/business-rules.md, "Importação de fatura". Usada tanto para detectar
 * duplicado quanto para sugerir categoria pelo histórico.
 */
export function normalizeDescription(description: string): string {
  return description
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '') // remove diacríticos (acentos)
    .toUpperCase()
    .replace(/\s+/g, ' ')
    .trim();
}
