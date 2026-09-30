import { describe, expect, it } from 'vitest';
import { applyMapping, parseCsvText, parseFileDate, type ColumnMapping } from './csv';

describe('parseCsvText', () => {
  it('separa cabeçalho e linhas', () => {
    const csv = 'Data,Descrição,Valor\n05/10/2026,IFOOD *RESTAURANTE,4780';
    const { headers, rows } = parseCsvText(csv);
    expect(headers).toEqual(['Data', 'Descrição', 'Valor']);
    expect(rows).toEqual([['05/10/2026', 'IFOOD *RESTAURANTE', '4780']]);
  });

  it('detecta separador ; automaticamente', () => {
    const csv = 'data;lançamento;valor\n05/10/2026;POSTO IPIRANGA;180,00';
    const { headers, rows } = parseCsvText(csv);
    expect(headers).toEqual(['data', 'lançamento', 'valor']);
    expect(rows[0]).toEqual(['05/10/2026', 'POSTO IPIRANGA', '180,00']);
  });

  it('arquivo vazio devolve headers e rows vazios', () => {
    expect(parseCsvText('')).toEqual({ headers: [], rows: [] });
  });
});

describe('parseFileDate', () => {
  it('converte DD/MM/YYYY para ISO', () => {
    expect(parseFileDate('05/10/2026', 'DD/MM/YYYY')).toBe('2026-10-05');
  });

  it('aceita dia/mês sem zero à esquerda', () => {
    expect(parseFileDate('5/1/2026', 'DD/MM/YYYY')).toBe('2026-01-05');
  });

  it('aceita ISO quando o formato já é ISO', () => {
    expect(parseFileDate('2026-10-05', 'YYYY-MM-DD')).toBe('2026-10-05');
  });

  it('rejeita data mal formatada', () => {
    expect(() => parseFileDate('não é data', 'DD/MM/YYYY')).toThrow();
  });

  it('rejeita data inexistente', () => {
    expect(() => parseFileDate('31/02/2026', 'DD/MM/YYYY')).toThrow();
  });
});

describe('applyMapping', () => {
  const mapping: ColumnMapping = {
    dateColumn: 'Data',
    descriptionColumn: 'Descrição',
    amountColumn: 'Valor',
    dateFormat: 'DD/MM/YYYY',
  };

  it('mapeia linhas válidas', () => {
    const parsed = parseCsvText(
      'Data,Descrição,Valor\n05/10/2026,IFOOD *RESTAURANTE,47.80\n06/10/2026,POSTO IPIRANGA,180.00',
    );
    const { rows, errors } = applyMapping(parsed, mapping);
    expect(errors).toEqual([]);
    expect(rows).toEqual([
      { rowIndex: 0, purchasedOn: '2026-10-05', description: 'IFOOD *RESTAURANTE', amountCents: 4780 },
      { rowIndex: 1, purchasedOn: '2026-10-06', description: 'POSTO IPIRANGA', amountCents: 18000 },
    ]);
  });

  it('valor negativo vira positivo (sinal original não é usado)', () => {
    const parsed = parseCsvText('Data,Descrição,Valor\n05/10/2026,ESTORNO LOJA,-50.00');
    const { rows } = applyMapping(parsed, mapping);
    expect(rows[0].amountCents).toBe(5000);
  });

  it('linha com data inválida vira erro, não trava as outras', () => {
    const parsed = parseCsvText(
      'Data,Descrição,Valor\ndata-invalida,IFOOD,47.80\n06/10/2026,POSTO IPIRANGA,180.00',
    );
    const { rows, errors } = applyMapping(parsed, mapping);
    expect(rows).toHaveLength(1);
    expect(errors).toHaveLength(1);
    expect(errors[0].rowIndex).toBe(0);
  });

  it('rejeita mapeamento com coluna que não existe no arquivo', () => {
    const parsed = parseCsvText('Data,Descrição,Valor\n05/10/2026,IFOOD,47.80');
    expect(() =>
      applyMapping(parsed, { ...mapping, amountColumn: 'Total (não existe)' }),
    ).toThrow();
  });
});
