import type { CategoryGroup } from '../types';

export interface CategoryInput {
  name: string;
  groupKind: CategoryGroup;
}

const GROUPS: CategoryGroup[] = ['need', 'want', 'invest', 'income', 'neutral'];

export function validateCategory(input: CategoryInput): string[] {
  const errors: string[] = [];

  if (input.name.trim() === '') {
    errors.push('Nome é obrigatório.');
  }
  if (!GROUPS.includes(input.groupKind)) {
    errors.push('Grupo inválido.');
  }

  return errors;
}
