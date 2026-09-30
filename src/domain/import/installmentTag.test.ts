import { describe, expect, it } from 'vitest';
import { detectInstallmentTag } from './installmentTag';

describe('detectInstallmentTag', () => {
  it('detecta parcela no fim da descrição', () => {
    expect(detectInstallmentTag('TV SAMSUNG 4/10')).toEqual({
      installmentNo: 4,
      installmentsTotal: 10,
      cleanDescription: 'TV SAMSUNG',
    });
  });

  it('detecta parcela colada ao nome (sem espaço antes)', () => {
    expect(detectInstallmentTag('SOFA CASA&CO 2/6')).toEqual({
      installmentNo: 2,
      installmentsTotal: 6,
      cleanDescription: 'SOFA CASA&CO',
    });
  });

  it('devolve null quando não há padrão N/M', () => {
    expect(detectInstallmentTag('POSTO IPIRANGA')).toBeNull();
    expect(detectInstallmentTag('LOJA XYZ 00088')).toBeNull();
    expect(detectInstallmentTag('IFOOD *RESTAURANTE')).toBeNull();
  });

  it('devolve null quando N > M (não é parcela válida)', () => {
    expect(detectInstallmentTag('ALGO 10/4')).toBeNull();
  });

  it('devolve null quando N ou M é zero', () => {
    expect(detectInstallmentTag('ALGO 0/5')).toBeNull();
  });
});
