import { describe, expect, it } from 'vitest';
import { computeImportHash } from './hash';
import { buildInstallmentGroupKey, classifyRow, type ClassifyContext } from './reconcile';
import type { RawImportRow } from './csv';

const emptyContext: ClassifyContext = {
  existingHashes: new Set(),
  existingInstallmentGroups: new Map(),
  categoryHistory: new Map(),
};

function row(overrides: Partial<RawImportRow> = {}): RawImportRow {
  return { rowIndex: 0, purchasedOn: '2026-10-05', description: 'IFOOD *RESTAURANTE', amountCents: 4780, ...overrides };
}

describe('classifyRow — lançamentos simples', () => {
  it('classifica como novo quando o hash não existe ainda', () => {
    const result = classifyRow(row(), 1, emptyContext);
    expect(result.status).toBe('new');
    expect(result.installmentNo).toBeNull();
  });

  it('classifica como duplicado quando o hash já existe', () => {
    const r = row();
    const hash = computeImportHash(r.purchasedOn, r.amountCents, r.description);
    const context: ClassifyContext = { ...emptyContext, existingHashes: new Set([hash]) };
    expect(classifyRow(r, 1, context).status).toBe('duplicate');
  });

  it('sugere categoria pelo histórico normalizado', () => {
    const context: ClassifyContext = {
      ...emptyContext,
      categoryHistory: new Map([['IFOOD *RESTAURANTE', 7]]),
    };
    expect(classifyRow(row(), 1, context).suggestedCategoryId).toBe(7);
  });

  it('sem histórico, categoria sugerida é null', () => {
    expect(classifyRow(row(), 1, emptyContext).suggestedCategoryId).toBeNull();
  });
});

describe('classifyRow — parcelas', () => {
  it('1ª parcela sem hash existente: installment_new', () => {
    const result = classifyRow(row({ description: 'TV SAMSUNG 1/10' }), 1, emptyContext);
    expect(result.status).toBe('installment_new');
    expect(result.installmentNo).toBe(1);
    expect(result.installmentsTotal).toBe(10);
    expect(result.description).toBe('TV SAMSUNG'); // sem a tag
  });

  it('1ª parcela com hash já existente: duplicate (reimportar o mesmo arquivo)', () => {
    const r = row({ description: 'TV SAMSUNG 1/10' });
    const hash = computeImportHash(r.purchasedOn, r.amountCents, r.description);
    const context: ClassifyContext = { ...emptyContext, existingHashes: new Set([hash]) };
    expect(classifyRow(r, 1, context).status).toBe('duplicate');
  });

  it('parcela > 1 com grupo existente e nº ainda não presente: installment_linked', () => {
    const groupKey = buildInstallmentGroupKey(1, 'TV SAMSUNG', 10);
    const context: ClassifyContext = {
      ...emptyContext,
      existingInstallmentGroups: new Map([[groupKey, { groupId: 'g1', installmentNos: new Set([1, 2, 3]) }]]),
    };
    const result = classifyRow(row({ description: 'TV SAMSUNG 4/10' }), 1, context);
    expect(result.status).toBe('installment_linked');
    expect(result.linkedGroupId).toBe('g1');
  });

  it('parcela > 1 com grupo existente e nº já presente: duplicate', () => {
    const groupKey = buildInstallmentGroupKey(1, 'TV SAMSUNG', 10);
    const context: ClassifyContext = {
      ...emptyContext,
      existingInstallmentGroups: new Map([[groupKey, { groupId: 'g1', installmentNos: new Set([1, 2, 3, 4]) }]]),
    };
    const result = classifyRow(row({ description: 'TV SAMSUNG 4/10' }), 1, context);
    expect(result.status).toBe('duplicate');
  });

  it('parcela > 1 sem grupo conhecido: review', () => {
    const result = classifyRow(row({ description: 'SOFA CASA&CO 2/6' }), 1, emptyContext);
    expect(result.status).toBe('review');
    expect(result.installmentNo).toBe(2);
  });

  it('grupo de outra conta não conta (chave inclui accountId)', () => {
    const groupKey = buildInstallmentGroupKey(2, 'TV SAMSUNG', 10); // conta 2, não a conta 1 usada abaixo
    const context: ClassifyContext = {
      ...emptyContext,
      existingInstallmentGroups: new Map([[groupKey, { groupId: 'g1', installmentNos: new Set([1, 2, 3]) }]]),
    };
    const result = classifyRow(row({ description: 'TV SAMSUNG 4/10' }), 1, context);
    expect(result.status).toBe('review');
  });
});
