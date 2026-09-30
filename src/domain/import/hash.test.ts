import { describe, expect, it } from 'vitest';
import { computeImportHash } from './hash';

describe('computeImportHash', () => {
  it('gera o mesmo hash para a mesma data+valor+descrição, mesmo com grafia diferente', () => {
    const a = computeImportHash('2026-10-05', 4780, 'Farmácia São João');
    const b = computeImportHash('2026-10-05', 4780, 'FARMACIA   SAO JOAO');
    expect(a).toBe(b);
  });

  it('muda se a data mudar', () => {
    const a = computeImportHash('2026-10-05', 4780, 'Farmácia São João');
    const b = computeImportHash('2026-10-06', 4780, 'Farmácia São João');
    expect(a).not.toBe(b);
  });

  it('muda se o valor mudar', () => {
    const a = computeImportHash('2026-10-05', 4780, 'Farmácia São João');
    const b = computeImportHash('2026-10-05', 4781, 'Farmácia São João');
    expect(a).not.toBe(b);
  });

  it('muda se a descrição mudar de verdade', () => {
    const a = computeImportHash('2026-10-05', 4780, 'Farmácia São João');
    const b = computeImportHash('2026-10-05', 4780, 'Posto Ipiranga');
    expect(a).not.toBe(b);
  });
});
