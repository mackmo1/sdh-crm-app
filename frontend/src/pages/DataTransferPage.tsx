import { useState } from 'react';
import { api, ApiError } from '../api/client';
import type { ImportEntity, ImportPreview } from '../api/types';
import { useToast } from '../components/Toast';
import { Badge, Button, Field, Select, TextArea } from '../components/ui';

const ENTITIES: { value: ImportEntity; label: string }[] = [
  { value: 'properties', label: 'Properties' },
  { value: 'projects', label: 'Projects' },
  { value: 'contacts', label: 'Contacts' },
  { value: 'leads', label: 'Leads' },
];

export function DataTransferPage() {
  const { notify } = useToast();
  const [entity, setEntity] = useState<ImportEntity>('contacts');
  const [exporting, setExporting] = useState(false);

  const [csv, setCsv] = useState('');
  const [fileName, setFileName] = useState('');
  const [preview, setPreview] = useState<ImportPreview | null>(null);
  const [previewing, setPreviewing] = useState(false);
  const [importing, setImporting] = useState(false);
  const [result, setResult] = useState<{ imported: number; skipped: number; failed: number } | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleExport() {
    setExporting(true);
    try {
      const content = await api.data.exportCsv(entity);
      const blob = new Blob([content], { type: 'text/csv;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `${entity}.csv`;
      link.click();
      URL.revokeObjectURL(url);
      notify(`${entity} exported`);
    } catch (caught) {
      notify(caught instanceof ApiError ? caught.message : 'Export failed', 'error');
    } finally {
      setExporting(false);
    }
  }

  async function handleFile(file: File | null) {
    setPreview(null);
    setResult(null);
    setError(null);
    if (!file) return;
    if (file.size > 5_000_000) {
      setError('The file is larger than 5 MB. Split it into smaller files.');
      return;
    }
    setFileName(file.name);
    setCsv(await file.text());
  }

  async function handlePreview() {
    setPreviewing(true);
    setError(null);
    try {
      setPreview(await api.data.previewImport(entity, csv));
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : 'Could not validate this file.');
    } finally {
      setPreviewing(false);
    }
  }

  async function handleImport() {
    setImporting(true);
    setError(null);
    try {
      const summary = await api.data.commitImport(entity, csv, []);
      setResult(summary);
      setPreview(null);
      notify(`Imported ${summary.imported} ${entity}`);
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : 'Import failed.');
    } finally {
      setImporting(false);
    }
  }

  return (
    <>
      <div className="page-header">
        <div>
          <h1 className="page-title">Import and export</h1>
          <p className="page-subtitle">
            Move data in and out as CSV. Nothing is imported until you confirm the preview.
          </p>
        </div>
      </div>

      <div className="card" style={{ marginBottom: 18 }}>
        <div className="card-header"><span className="card-title">Export</span></div>
        <div className="card-body">
          <div className="row">
            <Field label="Dataset" htmlFor="exportEntity">
              <Select id="exportEntity" value={entity} onChange={(event) => setEntity(event.target.value as ImportEntity)} style={{ width: 200 }}>
                {ENTITIES.map((option) => (
                  <option key={option.value} value={option.value}>{option.label}</option>
                ))}
              </Select>
            </Field>
            <Button variant="primary" onClick={() => void handleExport()} disabled={exporting}>
              {exporting ? 'Preparing…' : 'Download CSV'}
            </Button>
          </div>
          <p className="field-hint" style={{ marginTop: 10 }}>
            Exports contain business fields only — never passwords, tokens or session data.
          </p>
        </div>
      </div>

      <div className="card">
        <div className="card-header"><span className="card-title">Import</span></div>
        <div className="card-body">
          <div className="row" style={{ marginBottom: 12 }}>
            <Field label="Dataset" htmlFor="importEntity">
              <Select id="importEntity" value={entity} onChange={(event) => setEntity(event.target.value as ImportEntity)} style={{ width: 200 }}>
                {ENTITIES.map((option) => (
                  <option key={option.value} value={option.value}>{option.label}</option>
                ))}
              </Select>
            </Field>
            <Field label="CSV file" htmlFor="importFile">
              <input
                id="importFile"
                className="input"
                type="file"
                accept=".csv,text/csv"
                onChange={(event) => void handleFile(event.target.files?.[0] ?? null)}
              />
            </Field>
            <Button variant="secondary" onClick={() => void handlePreview()} disabled={!csv || previewing}>
              {previewing ? 'Validating…' : 'Validate file'}
            </Button>
          </div>

          {fileName && <p className="subtle" style={{ fontSize: 12.5, marginTop: 0 }}>{fileName}</p>}
          {error && <div className="alert alert-error" style={{ marginBottom: 12 }}>{error}</div>}

          {result && (
            <div className="alert alert-success" style={{ marginBottom: 12 }}>
              Imported {result.imported}, skipped {result.skipped}, failed {result.failed}.
            </div>
          )}

          {preview && (
            <>
              <div className="row" style={{ gap: 8, marginBottom: 12 }}>
                <Badge tone="neutral">{preview.totalRows} rows</Badge>
                <Badge tone="success">{preview.validRows} ready</Badge>
                <Badge tone="warn">{preview.duplicateRows} duplicates</Badge>
                <Badge tone="danger">{preview.invalidRows} invalid</Badge>
              </div>

              {preview.issues.length > 0 && (
                <div style={{ maxHeight: 260, overflowY: 'auto', border: '1px solid var(--border)', borderRadius: 8, marginBottom: 14 }}>
                  <table className="table" style={{ minWidth: 0 }}>
                    <thead>
                      <tr><th>Row</th><th>Problem</th></tr>
                    </thead>
                    <tbody>
                      {preview.issues.map((issue) => (
                        <tr key={issue.index}>
                          <td>{issue.index}</td>
                          <td>
                            {issue.errors.length > 0 ? (
                              <span style={{ color: 'var(--danger)' }}>{issue.errors.join('; ')}</span>
                            ) : (
                              <span className="subtle">Skipped — {issue.duplicateOf}</span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              <div style={{ marginBottom: 12 }}>
                <div className="detail-label" style={{ marginBottom: 6 }}>Preview</div>
                <TextArea
                  readOnly
                  value={preview.preview
                    .map((row) => preview.headers.map((header) => `${header}: ${row[header] ?? ''}`).join(' | '))
                    .join('\n')}
                  style={{ minHeight: 120, fontFamily: 'ui-monospace, monospace', fontSize: 12 }}
                />
              </div>

              <div className="alert alert-warn" style={{ marginBottom: 12 }}>
                Only the {preview.validRows} valid, non-duplicate rows will be inserted. Invalid and duplicate
                rows are listed above and are never silently discarded.
              </div>

              <Button variant="primary" onClick={() => void handleImport()} disabled={importing || preview.validRows === 0}>
                {importing ? 'Importing…' : `Import ${preview.validRows} rows`}
              </Button>
            </>
          )}
        </div>
      </div>
    </>
  );
}
