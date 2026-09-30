import { useEffect, useState } from 'react';
import { formatCents } from '../../domain/money';
import { currentMonth } from '../../domain/dates';
import {
  applyMapping,
  parseCsvText,
  READER_PRESETS,
  type ColumnMapping,
  type ParsedCsv,
} from '../../domain/import/csv';
import type { ClassifiedImportRow } from '../../domain/import/reconcile';
import type { Account, Category } from '../../domain/types';
import { listAccounts } from '../../ipc/accounts';
import { listCategories } from '../../ipc/categories';
import { confirmImport, previewImport } from '../../ipc/import';
import { Button } from '../components/Button';
import { Field } from '../components/Field';
import './Lancamentos.css';
import './ImportarFatura.css';

const STATUS_LABEL: Record<ClassifiedImportRow['status'], string> = {
  new: 'Novo',
  duplicate: 'Já lançado',
  installment_new: 'Parcela detectada',
  installment_linked: 'Parcela detectada',
  review: 'A revisar',
};

interface PreviewRow extends ClassifiedImportRow {
  selected: boolean;
  categoryId: number | null;
}

export function ImportarFatura() {
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);

  const [accountId, setAccountId] = useState<number | ''>('');
  const [month, setMonth] = useState(currentMonth());
  const [presetId, setPresetId] = useState(READER_PRESETS[0].id);
  const [mapping, setMapping] = useState<ColumnMapping>(READER_PRESETS[0].mapping);
  const [fileName, setFileName] = useState('');
  const [parsedCsv, setParsedCsv] = useState<ParsedCsv | null>(null);

  const [rows, setRows] = useState<PreviewRow[] | null>(null);
  const [totalFaturaText, setTotalFaturaText] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [importing, setImporting] = useState(false);
  const [result, setResult] = useState<{ createdCount: number; skippedCount: number } | null>(null);

  useEffect(() => {
    Promise.all([listAccounts(), listCategories()]).then(([accs, cats]) => {
      setAccounts(accs);
      setCategories(cats);
    });
  }, []);

  const cardAccounts = accounts.filter((a) => a.kind === 'credit_card' && !a.archived);

  function handlePresetChange(id: string) {
    setPresetId(id);
    const preset = READER_PRESETS.find((p) => p.id === id);
    if (preset) setMapping(preset.mapping);
  }

  function handleFile(file: File) {
    setFileName(file.name);
    setError(null);
    const reader = new FileReader();
    reader.onload = () => {
      const text = String(reader.result ?? '');
      try {
        setParsedCsv(parseCsvText(text));
      } catch (err) {
        setError(err instanceof Error ? err.message : String(err));
      }
    };
    reader.onerror = () => setError('Não consegui ler o arquivo.');
    reader.readAsText(file, 'utf-8');
  }

  async function handlePreview() {
    if (!parsedCsv || accountId === '') return;
    setError(null);
    try {
      const { rows: mapped, errors } = applyMapping(parsedCsv, mapping);
      if (errors.length > 0) {
        setError(
          `${errors.length} linha(s) não puderam ser lidas (ex.: linha ${errors[0].rowIndex + 2}: ${errors[0].message}). Confira o mapeamento de colunas.`,
        );
      }
      const classified = await previewImport(accountId, mapped);
      setRows(
        classified.map((row) => ({
          ...row,
          selected: row.status === 'new' || row.status === 'installment_new' || row.status === 'installment_linked',
          categoryId: row.suggestedCategoryId,
        })),
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  }

  function updateRow(rowIndex: number, patch: Partial<PreviewRow>) {
    setRows((current) => current?.map((r) => (r.rowIndex === rowIndex ? { ...r, ...patch } : r)) ?? null);
  }

  const selectedRows = rows?.filter((r) => r.selected) ?? [];
  const newTotalCents = selectedRows
    .filter((r) => r.status !== 'duplicate')
    .reduce((sum, r) => sum + r.amountCents, 0);
  const alreadyLaunchedTotalCents = (rows ?? [])
    .filter((r) => r.status === 'duplicate')
    .reduce((sum, r) => sum + r.amountCents, 0);
  const computedTotalCents = newTotalCents + alreadyLaunchedTotalCents;

  let totalFaturaCents: number | null = null;
  try {
    totalFaturaCents = totalFaturaText.trim() === '' ? null : Math.round(parseFloat(totalFaturaText.replace(',', '.')) * 100);
  } catch {
    totalFaturaCents = null;
  }
  const totalMatches = totalFaturaCents === null || totalFaturaCents === computedTotalCents;

  async function handleConfirm() {
    if (!rows || accountId === '') return;
    setImporting(true);
    setError(null);
    try {
      const toImport = rows.filter((r) => r.selected);
      const summary = await confirmImport(
        accountId,
        month,
        toImport.map((r) => ({
          purchasedOn: r.purchasedOn,
          description: r.description,
          amountCents: r.amountCents,
          importHash: r.importHash,
          categoryId: r.categoryId,
          installmentNo: r.installmentNo,
          installmentsTotal: r.installmentsTotal,
          linkedGroupId: r.linkedGroupId,
        })),
      );
      setResult(summary);
      setRows(null);
      setParsedCsv(null);
      setFileName('');
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setImporting(false);
    }
  }

  return (
    <div className="screen">
      <header className="screen-header">
        <h1>Importar fatura</h1>
      </header>

      {result && (
        <p className="muted">
          Importados {result.createdCount} lançamento(s)
          {result.skippedCount > 0 && ` (${result.skippedCount} pulado(s) por já existir)`}.
        </p>
      )}

      {!rows && (
        <section className="panel">
          <h2>Escolher arquivo</h2>
          <div className="account-form">
            <Field label="Cartão">
              <select value={accountId} onChange={(e) => setAccountId(e.target.value === '' ? '' : Number(e.target.value))}>
                <option value="">Selecione…</option>
                {cardAccounts.map((account) => (
                  <option key={account.id} value={account.id}>
                    {account.name}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Mês da fatura">
              <input type="month" value={month} onChange={(e) => setMonth(e.target.value)} />
            </Field>
            <Field label="Leitor">
              <select value={presetId} onChange={(e) => handlePresetChange(e.target.value)}>
                {READER_PRESETS.map((preset) => (
                  <option key={preset.id} value={preset.id}>
                    {preset.label}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Arquivo (CSV)">
              <input
                type="file"
                accept=".csv,text/csv"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) handleFile(file);
                }}
              />
            </Field>
          </div>
          <p className="muted" style={{ margin: 0 }}>
            Só CSV por enquanto — PDF ainda não está implementado. Se o cabeçalho do seu arquivo não bater com o
            leitor escolhido, ajuste as colunas abaixo.
          </p>

          {parsedCsv && parsedCsv.headers.length > 0 && (
            <div className="account-form">
              <Field label="Coluna da data">
                <select value={mapping.dateColumn} onChange={(e) => setMapping({ ...mapping, dateColumn: e.target.value })}>
                  <option value="">Selecione…</option>
                  {parsedCsv.headers.map((h) => (
                    <option key={h} value={h}>
                      {h}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Coluna da descrição">
                <select
                  value={mapping.descriptionColumn}
                  onChange={(e) => setMapping({ ...mapping, descriptionColumn: e.target.value })}
                >
                  <option value="">Selecione…</option>
                  {parsedCsv.headers.map((h) => (
                    <option key={h} value={h}>
                      {h}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Coluna do valor">
                <select value={mapping.amountColumn} onChange={(e) => setMapping({ ...mapping, amountColumn: e.target.value })}>
                  <option value="">Selecione…</option>
                  {parsedCsv.headers.map((h) => (
                    <option key={h} value={h}>
                      {h}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Formato da data">
                <select
                  value={mapping.dateFormat}
                  onChange={(e) => setMapping({ ...mapping, dateFormat: e.target.value as ColumnMapping['dateFormat'] })}
                >
                  <option value="DD/MM/YYYY">DD/MM/AAAA</option>
                  <option value="YYYY-MM-DD">AAAA-MM-DD</option>
                </select>
              </Field>
            </div>
          )}

          {error && <p className="error">{error}</p>}

          <div className="panel-actions">
            <Button
              variant="primary"
              disabled={!parsedCsv || accountId === ''}
              onClick={handlePreview}
            >
              Conferir lançamentos
            </Button>
          </div>
          {fileName && <p className="muted" style={{ margin: 0 }}>{fileName}</p>}
        </section>
      )}

      {rows && (
        <>
          <section className="panel">
            <h2>Conferir lançamentos</h2>
            <p className="muted" style={{ margin: 0 }}>Confira o que foi encontrado antes de lançar.</p>

            <table className="tx-table import-table">
              <thead>
                <tr>
                  <th />
                  <th>Data</th>
                  <th>Descrição</th>
                  <th>Categoria</th>
                  <th className="num">Valor</th>
                  <th>Situação</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row.rowIndex} className={row.status === 'duplicate' ? 'row-duplicate' : ''}>
                    <td>
                      <input
                        type="checkbox"
                        checked={row.selected}
                        onChange={(e) => updateRow(row.rowIndex, { selected: e.target.checked })}
                      />
                    </td>
                    <td className="num-mono">{row.purchasedOn}</td>
                    <td>
                      {row.description}
                      {row.installmentNo !== null && (
                        <span className="tag-chip kind-chip">
                          {row.installmentNo}/{row.installmentsTotal}
                        </span>
                      )}
                    </td>
                    <td>
                      <select
                        value={row.categoryId ?? ''}
                        onChange={(e) =>
                          updateRow(row.rowIndex, { categoryId: e.target.value === '' ? null : Number(e.target.value) })
                        }
                      >
                        <option value="">Sem categoria</option>
                        {categories.map((c) => (
                          <option key={c.id} value={c.id}>
                            {c.name}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td className="num">{formatCents(row.amountCents)}</td>
                    <td>
                      <span className={`status-chip status-${row.status}`}>{STATUS_LABEL[row.status]}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>

          <section className="panel">
            <p style={{ margin: 0 }}>
              Novos {formatCents(newTotalCents)} + já lançados {formatCents(alreadyLaunchedTotalCents)} = {formatCents(computedTotalCents)}
            </p>
            <div className="account-form">
              <Field label="Total da fatura (R$) — opcional, pra conferir">
                <input className="num" value={totalFaturaText} onChange={(e) => setTotalFaturaText(e.target.value)} />
              </Field>
            </div>
            {!totalMatches && (
              <p className="error">
                Não bate: diferença de {formatCents(Math.abs((totalFaturaCents ?? 0) - computedTotalCents))}.
              </p>
            )}
            {error && <p className="error">{error}</p>}
            <div className="panel-actions">
              <Button
                variant="secondary"
                onClick={() => {
                  setRows(null);
                  setParsedCsv(null);
                }}
              >
                Voltar
              </Button>
              <Button variant="primary" disabled={importing || selectedRows.length === 0} onClick={handleConfirm}>
                Importar {selectedRows.length} lançamento(s)
              </Button>
            </div>
          </section>
        </>
      )}
    </div>
  );
}
