import { describe, expect, it } from 'vitest';
import { normalizeDescription } from './normalize';

describe('normalizeDescription', () => {
  it('remove acentos', () => {
    expect(normalizeDescription('Farmácia São João')).toBe('FARMACIA SAO JOAO');
  });

  it('coloca em maiúsculas', () => {
    expect(normalizeDescription('ifood restaurante')).toBe('IFOOD RESTAURANTE');
  });

  it('colapsa espaços extras', () => {
    expect(normalizeDescription('Loja   XYZ    00088')).toBe('LOJA XYZ 00088');
  });

  it('remove espaços nas pontas', () => {
    expect(normalizeDescription('  Uber Trip  ')).toBe('UBER TRIP');
  });

  it('duas grafias equivalentes normalizam igual', () => {
    expect(normalizeDescription('Supermercado Extra')).toBe(normalizeDescription('SUPERMERCADO   EXTRA'));
  });
});
