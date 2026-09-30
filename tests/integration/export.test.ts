import { execFileSync } from 'node:child_process';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it, vi } from 'vitest';

vi.mock('@tauri-apps/plugin-sql', () => ({ default: { load: async () => ({}) } }));

import { xlsxBytes } from '../../src/ipc/export';

describe('exportação Excel', () => {
  it('gera um .xlsx válido com uma aba por tabela e valores em reais', async () => {
    const bytes = await xlsxBytes([
      { key: 'a', name: 'Lançamentos', headers: ['Descrição', 'Valor'], rows: [['Mercado', { money: 12345 }], ['Sem valor', null]] },
      { key: 'b', name: 'Contas e cartões', headers: ['Nome'], rows: [['Itaú']] },
    ]);
    expect(String.fromCharCode(bytes[0], bytes[1])).toBe('PK'); // zip
    const dir = mkdtempSync(join(tmpdir(), 'xlsx-'));
    const file = join(dir, 'x.xlsx');
    writeFileSync(file, bytes);
    const workbook = execFileSync('unzip', ['-p', file, 'xl/workbook.xml']).toString();
    expect(workbook).toContain('Lançamentos');
    expect(workbook).toContain('Contas e cartões');
    const sheet1 = execFileSync('unzip', ['-p', file, 'xl/worksheets/sheet1.xml']).toString();
    expect(sheet1).toContain('123.45');
  });
});
