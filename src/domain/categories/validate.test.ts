import { describe, expect, it } from 'vitest';
import { validateCategory } from './validate';

describe('validateCategory', () => {
  it('aceita uma categoria válida', () => {
    expect(validateCategory({ name: 'Mercado', groupKind: 'need' })).toEqual([]);
  });

  it('exige nome', () => {
    expect(validateCategory({ name: '', groupKind: 'need' })).toContain('Nome é obrigatório.');
  });

  it('rejeita grupo inválido', () => {
    // @ts-expect-error testando entrada inválida de propósito
    expect(validateCategory({ name: 'X', groupKind: 'invalido' })).toContain('Grupo inválido.');
  });
});
