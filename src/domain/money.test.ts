import { describe, expect, it } from 'vitest';
import { formatCents, parseSignedToCents, parseToCents, sumCents } from './money';

describe('formatCents', () => {
  it('formata centavos como BRL', () => {
    expect(formatCents(12345)).toBe('R$ 123,45');
  });

  it('formata zero', () => {
    expect(formatCents(0)).toBe('R$ 0,00');
  });

  it('formata valores com milhar', () => {
    expect(formatCents(298205)).toBe('R$ 2.982,05');
  });

  it('rejeita valores não inteiros', () => {
    expect(() => formatCents(12.5)).toThrow();
  });
});

describe('parseToCents', () => {
  it('interpreta vírgula como separador decimal', () => {
    expect(parseToCents('123,45')).toBe(12345);
  });

  it('interpreta ponto como separador decimal', () => {
    expect(parseToCents('123.45')).toBe(12345);
  });

  it('interpreta separador de milhar com vírgula decimal', () => {
    expect(parseToCents('1.234,56')).toBe(123456);
  });

  it('interpreta valor sem centavos', () => {
    expect(parseToCents('1234')).toBe(123400);
  });

  it('interpreta uma casa decimal como centavo único', () => {
    expect(parseToCents('10,5')).toBe(1050);
  });

  it('ignora prefixo de moeda e espaços', () => {
    expect(parseToCents('R$ 156,95')).toBe(15695);
  });

  it('rejeita valor vazio', () => {
    expect(() => parseToCents('')).toThrow();
    expect(() => parseToCents('   ')).toThrow();
  });

  it('rejeita valor não numérico', () => {
    expect(() => parseToCents('abc')).toThrow();
  });
});

describe('parseSignedToCents', () => {
  it('aceita valor negativo', () => {
    expect(parseSignedToCents('-150,50')).toBe(-15050);
    expect(parseSignedToCents('- 1.234,00')).toBe(-123400);
  });

  it('mantém o comportamento para valores positivos', () => {
    expect(parseSignedToCents('150,50')).toBe(15050);
  });

  it('não devolve -0 para zero negativo', () => {
    expect(Object.is(parseSignedToCents('-0'), 0)).toBe(true);
  });

  it('rejeita valor não numérico', () => {
    expect(() => parseSignedToCents('-abc')).toThrow();
  });
});

describe('sumCents', () => {
  it('soma uma lista de centavos', () => {
    expect(sumCents([100, 200, 300])).toBe(600);
  });

  it('soma lista vazia como zero', () => {
    expect(sumCents([])).toBe(0);
  });
});
