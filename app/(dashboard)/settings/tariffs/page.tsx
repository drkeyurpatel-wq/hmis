// app/(dashboard)/settings/tariffs/page.tsx
// Tariff Master — CRUD + CSV bulk import
// Uses new H1 component library throughout.

'use client';

import { useState, useMemo, useCallback } from 'react';
import { useAuthStore } from '@/lib/store/auth';
import { useTariffList, useTariffCategories, useCreateTariff, useUpdateTariff, useBulkImportTariffs } from '@/lib/tariff/tariff-hooks';
import { DataTable, ActionButton, FormField, FormInput, FormSelect, Modal, EmptyState } from '@/components/ui';
import type { Column } from '@/components/ui';
import type { TariffItem, TariffInput } from '@/lib/tariff/tariff-hooks';
import { Plus, Upload, FileSpreadsheet, IndianRupee, Edit2, AlertCircle } from 'lucide-react';

const CATEGORIES = [
  'Consultation', 'Procedure', 'Investigation', 'Room Rent', 'Nursing Charges',
  'OT Charges', 'ICU Charges', 'Consumables', 'Pharmacy', 'Radiology',
  'Laboratory', 'Physiotherapy', 'Dietary', 'Ambulance', 'Other',
];

const fmt = (n: number | null) => n != null ? `₹${n.toLocaleString('en-IN')}` : '—';

export default function TariffSettingsPage() {
  const { activeCentreId } = useAuthStore();
  const centreId = activeCentreId || '';

  const { data: tariffs, isLoading, error, refetch } = useTariffList(centreId);
  const { data: catData } = useTariffCategories(centreId);

  // Modals
  const [showCreate, setShowCreate] = useState(false);
  const [showImport, setShowImport] = useState(false);
  const [editItem, setEditItem] = useState<TariffItem | null>(null);

  // Filter
  const [catFilter, setCatFilter] = useState('');

  const categories = useMemo(() => {
    const cats = catData?.map((c: any) => c.category).filter(Boolean) || [];
    return [...new Set(cats)].sort() as string[];
  }, [catData]);

  const filtered = useMemo(() => {
    if (!tariffs) return [];
    if (!catFilter) return tariffs;
    return tariffs.filter((t) => t.category === catFilter);
  }, [tariffs, catFilter]);

  const columns: Column<TariffItem>[] = [
    { key: 'service_code', header: 'Code', sortable: true, width: '100px' },
    { key: 'service_name', header: 'Service Name', sortable: true },
    { key: 'category', header: 'Category', sortable: true, width: '140px',
      render: (r) => <span className="h1-badge-neutral">{r.category}</span> },
    { key: 'rate_self', header: 'Self (₹)', sortable: true, align: 'right', width: '110px',
      render: (r) => <span className="tabular-nums font-medium">{fmt(r.rate_self)}</span> },
    { key: 'rate_insurance', header: 'Insurance (₹)', sortable: true, align: 'right', width: '120px', hideOnMobile: true,
      render: (r) => <span className="tabular-nums">{fmt(r.rate_insurance)}</span> },
    { key: 'rate_pmjay', header: 'PMJAY (₹)', sortable: true, align: 'right', width: '110px', hideOnMobile: true,
      render: (r) => <span className="tabular-nums">{fmt(r.rate_pmjay)}</span> },
    { key: 'rate_cghs', header: 'CGHS (₹)', sortable: true, align: 'right', width: '110px', hideOnMobile: true,
      render: (r) => <span className="tabular-nums">{fmt(r.rate_cghs)}</span> },
    { key: 'actions', header: '', width: '50px',
      render: (r) => (
        <button onClick={(e) => { e.stopPropagation(); setEditItem(r); }}
          className="p-1 rounded hover:bg-gray-100 text-h1-text-muted hover:text-h1-teal transition-colors cursor-pointer"
          aria-label="Edit tariff">
          <Edit2 className="w-4 h-4" />
        </button>
      ) },
  ];

  return (
    <div className="space-y-h1-lg">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="h1-page-title">Tariff Master</h1>
          <p className="text-h1-body text-h1-text-secondary mt-1">
            {tariffs?.length || 0} services configured
            {catFilter && ` · Filtered: ${catFilter}`}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <ActionButton variant="secondary" icon={Upload} onClick={() => setShowImport(true)}>
            Import CSV
          </ActionButton>
          <ActionButton variant="primary" icon={Plus} onClick={() => setShowCreate(true)}>
            Add Service
          </ActionButton>
        </div>
      </div>

      {/* Error display */}
      {error && (
        <div className="flex items-center gap-2 p-3 bg-h1-red-light border border-red-200 rounded-h1 text-h1-body text-h1-red">
          <AlertCircle className="w-4 h-4 flex-shrink-0" />
          {error}
        </div>
      )}

      {/* Category filter */}
      {categories.length > 1 && (
        <div className="flex gap-2 flex-wrap">
          <button
            onClick={() => setCatFilter('')}
            className={`px-3 py-1.5 rounded-h1-sm text-h1-small font-medium transition-colors cursor-pointer ${
              !catFilter ? 'bg-h1-navy text-white' : 'bg-gray-100 text-h1-text-secondary hover:bg-gray-200'
            }`}>
            All
          </button>
          {categories.map((cat) => (
            <button key={cat}
              onClick={() => setCatFilter(cat === catFilter ? '' : cat)}
              className={`px-3 py-1.5 rounded-h1-sm text-h1-small font-medium transition-colors cursor-pointer ${
                catFilter === cat ? 'bg-h1-navy text-white' : 'bg-gray-100 text-h1-text-secondary hover:bg-gray-200'
              }`}>
              {cat}
            </button>
          ))}
        </div>
      )}

      {/* Table */}
      <DataTable
        columns={columns}
        data={filtered}
        loading={isLoading}
        searchable
        searchPlaceholder="Search by service name or code..."
        onRowClick={(r) => setEditItem(r)}
        emptyIcon={IndianRupee}
        emptyTitle="No tariffs configured yet"
        emptyDescription="Import your fee schedule from CSV or add services one by one."
        emptyAction={{ label: 'Import CSV', onClick: () => setShowImport(true) }}
      />

      {/* Create Modal */}
      {showCreate && (
        <TariffFormModal
          title="Add Service"
          centreId={centreId}
          onClose={() => setShowCreate(false)}
          onSaved={() => { setShowCreate(false); refetch(); }}
        />
      )}

      {/* Edit Modal */}
      {editItem && (
        <TariffFormModal
          title="Edit Service"
          centreId={centreId}
          initial={editItem}
          onClose={() => setEditItem(null)}
          onSaved={() => { setEditItem(null); refetch(); }}
        />
      )}

      {/* CSV Import Modal */}
      {showImport && (
        <CSVImportModal
          centreId={centreId}
          onClose={() => setShowImport(false)}
          onImported={() => { setShowImport(false); refetch(); }}
        />
      )}
    </div>
  );
}


// ============================================================
// TARIFF FORM MODAL — Create / Edit
// ============================================================

function TariffFormModal({ title, centreId, initial, onClose, onSaved }: {
  title: string; centreId: string; initial?: TariffItem; onClose: () => void; onSaved: () => void;
}) {
  const [form, setForm] = useState<TariffInput>({
    service_code: initial?.service_code || '',
    service_name: initial?.service_name || '',
    category: initial?.category || '',
    rate_self: initial?.rate_self || 0,
    rate_insurance: initial?.rate_insurance || undefined,
    rate_pmjay: initial?.rate_pmjay || undefined,
    rate_cghs: initial?.rate_cghs || undefined,
    cost_price: initial?.cost_price || undefined,
  });
  const [errors, setErrors] = useState<Record<string, string>>({});

  const createMut = useCreateTariff({ onSuccess: onSaved });
  const updateMut = useUpdateTariff({ onSuccess: onSaved });
  const isSaving = createMut.isMutating || updateMut.isMutating;
  const mutError = createMut.error || updateMut.error;

  const set = (key: keyof TariffInput, val: any) => {
    setForm((f) => ({ ...f, [key]: val }));
    setErrors((e) => ({ ...e, [key]: '' }));
  };

  const validate = (): boolean => {
    const e: Record<string, string> = {};
    if (!form.service_code.trim()) e.service_code = 'Service code is required';
    if (!form.service_name.trim()) e.service_name = 'Service name is required';
    if (!form.category) e.category = 'Category is required';
    if (!form.rate_self || form.rate_self <= 0) e.rate_self = 'Self-pay rate must be > 0';
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleSubmit = async () => {
    if (!validate()) return;
    if (initial) {
      await updateMut.mutate({ id: initial.id, ...form });
    } else {
      await createMut.mutate({ ...form, centre_id: centreId });
    }
  };

  return (
    <Modal open onClose={onClose} title={title} size="md"
      footer={
        <>
          <ActionButton variant="ghost" onClick={onClose}>Cancel</ActionButton>
          <ActionButton variant="primary" loading={isSaving} onClick={handleSubmit}>
            {initial ? 'Update' : 'Create'}
          </ActionButton>
        </>
      }>
      <div className="space-y-h1-md">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-h1-md">
          <FormField label="Service Code" required error={errors.service_code}>
            <FormInput value={form.service_code} onChange={(e) => set('service_code', e.target.value)}
              placeholder="e.g. CON-001" hasError={!!errors.service_code} />
          </FormField>
          <FormField label="Category" required error={errors.category}>
            <FormSelect value={form.category} onChange={(e) => set('category', e.target.value)}
              options={CATEGORIES.map((c) => ({ value: c, label: c }))} placeholder="Select category"
              hasError={!!errors.category} />
          </FormField>
        </div>

        <FormField label="Service Name" required error={errors.service_name}>
          <FormInput value={form.service_name} onChange={(e) => set('service_name', e.target.value)}
            placeholder="e.g. General Physician Consultation" hasError={!!errors.service_name} />
        </FormField>

        <div className="h1-divider" />

        <div className="grid grid-cols-2 md:grid-cols-4 gap-h1-md">
          <FormField label="Self Pay (₹)" required error={errors.rate_self}>
            <FormInput type="number" value={form.rate_self || ''} onChange={(e) => set('rate_self', Number(e.target.value))}
              placeholder="500" hasError={!!errors.rate_self} />
          </FormField>
          <FormField label="Insurance (₹)">
            <FormInput type="number" value={form.rate_insurance || ''} onChange={(e) => set('rate_insurance', Number(e.target.value) || undefined)}
              placeholder="—" />
          </FormField>
          <FormField label="PMJAY (₹)">
            <FormInput type="number" value={form.rate_pmjay || ''} onChange={(e) => set('rate_pmjay', Number(e.target.value) || undefined)}
              placeholder="—" />
          </FormField>
          <FormField label="CGHS (₹)">
            <FormInput type="number" value={form.rate_cghs || ''} onChange={(e) => set('rate_cghs', Number(e.target.value) || undefined)}
              placeholder="—" />
          </FormField>
        </div>

        <FormField label="Cost Price (₹)" helpText="Internal cost for margin analysis (optional)">
          <FormInput type="number" value={form.cost_price || ''} onChange={(e) => set('cost_price', Number(e.target.value) || undefined)}
            placeholder="—" />
        </FormField>

        {mutError && (
          <div className="flex items-center gap-2 p-3 bg-h1-red-light border border-red-200 rounded-h1 text-h1-body text-h1-red">
            <AlertCircle className="w-4 h-4 flex-shrink-0" />
            {mutError}
          </div>
        )}
      </div>
    </Modal>
  );
}


// ============================================================
// CSV IMPORT MODAL
// ============================================================

interface ParsedRow {
  service_code: string;
  service_name: string;
  category: string;
  rate_self: number;
  rate_insurance?: number;
  rate_pmjay?: number;
  rate_cghs?: number;
  cost_price?: number;
  _error?: string;
}

function CSVImportModal({ centreId, onClose, onImported }: {
  centreId: string; onClose: () => void; onImported: () => void;
}) {
  const [csvText, setCsvText] = useState('');
  const [parsed, setParsed] = useState<ParsedRow[]>([]);
  const [parseError, setParseError] = useState('');
  const [step, setStep] = useState<'upload' | 'preview'>('upload');

  const importMut = useBulkImportTariffs({
    onSuccess: onImported,
    onError: (msg) => setParseError(msg),
  });

  const handleParse = () => {
    setParseError('');
    const lines = csvText.trim().split('\n').filter((l) => l.trim());
    if (lines.length < 2) {
      setParseError('CSV must have a header row and at least one data row.');
      return;
    }

    // Parse header
    const headers = lines[0].split(',').map((h) => h.trim().toLowerCase().replace(/\s+/g, '_'));
    const codeIdx = headers.findIndex((h) => h.includes('code'));
    const nameIdx = headers.findIndex((h) => h.includes('name') || h.includes('service'));
    const catIdx = headers.findIndex((h) => h.includes('cat') || h.includes('type'));
    const selfIdx = headers.findIndex((h) => h.includes('self') || h.includes('base') || h.includes('rate') || h.includes('price'));
    const insIdx = headers.findIndex((h) => h.includes('insurance') || h.includes('ins'));
    const pmjayIdx = headers.findIndex((h) => h.includes('pmjay'));
    const cghsIdx = headers.findIndex((h) => h.includes('cghs'));
    const costIdx = headers.findIndex((h) => h.includes('cost'));

    if (nameIdx === -1 || selfIdx === -1) {
      setParseError('CSV must have columns for service name and rate/price. Found headers: ' + headers.join(', '));
      return;
    }

    const rows: ParsedRow[] = lines.slice(1).map((line, i) => {
      const cols = line.split(',').map((c) => c.trim().replace(/^["']|["']$/g, ''));
      const row: ParsedRow = {
        service_code: codeIdx >= 0 ? cols[codeIdx] || `SVC-${String(i + 1).padStart(4, '0')}` : `SVC-${String(i + 1).padStart(4, '0')}`,
        service_name: cols[nameIdx] || '',
        category: catIdx >= 0 ? cols[catIdx] || 'Other' : 'Other',
        rate_self: parseFloat(cols[selfIdx]) || 0,
        rate_insurance: insIdx >= 0 ? parseFloat(cols[insIdx]) || undefined : undefined,
        rate_pmjay: pmjayIdx >= 0 ? parseFloat(cols[pmjayIdx]) || undefined : undefined,
        rate_cghs: cghsIdx >= 0 ? parseFloat(cols[cghsIdx]) || undefined : undefined,
        cost_price: costIdx >= 0 ? parseFloat(cols[costIdx]) || undefined : undefined,
      };
      if (!row.service_name) row._error = 'Missing service name';
      if (row.rate_self <= 0) row._error = 'Rate must be > 0';
      return row;
    });

    setParsed(rows);
    setStep('preview');
  };

  const handleImport = async () => {
    const valid = parsed.filter((r) => !r._error);
    if (valid.length === 0) { setParseError('No valid rows to import.'); return; }
    await importMut.mutate(valid.map((r) => ({
      service_code: r.service_code,
      service_name: r.service_name,
      category: r.category,
      rate_self: r.rate_self,
      rate_insurance: r.rate_insurance,
      rate_pmjay: r.rate_pmjay,
      rate_cghs: r.rate_cghs,
      cost_price: r.cost_price,
      centre_id: centreId,
    })));
  };

  const validCount = parsed.filter((r) => !r._error).length;
  const errorCount = parsed.filter((r) => r._error).length;

  return (
    <Modal open onClose={onClose} title="Import Tariffs from CSV" size="lg"
      footer={step === 'preview' ? (
        <>
          <ActionButton variant="ghost" onClick={() => setStep('upload')}>Back</ActionButton>
          <ActionButton variant="primary" icon={Upload} loading={importMut.isMutating}
            onClick={handleImport} disabled={validCount === 0}>
            Import {validCount} Services
          </ActionButton>
        </>
      ) : undefined}>

      {step === 'upload' && (
        <div className="space-y-h1-md">
          <div className="p-4 bg-gray-50 rounded-h1 text-h1-small text-h1-text-secondary space-y-2">
            <p className="font-medium text-h1-text">CSV Format:</p>
            <code className="block bg-white p-2 rounded border text-h1-small">
              service_code,service_name,category,rate_self,rate_insurance,rate_pmjay,rate_cghs,cost_price
            </code>
            <p>Required columns: <strong>service_name</strong> and <strong>rate/price</strong>. Other columns are auto-detected by header name.</p>
          </div>

          <FormField label="Paste CSV data or upload file">
            <textarea
              value={csvText}
              onChange={(e) => setCsvText(e.target.value)}
              rows={12}
              className="w-full px-3 py-2 rounded-h1 border border-h1-border text-h1-small font-mono bg-white
                focus:outline-none focus:ring-2 focus:ring-h1-teal/30 focus:border-transparent"
              placeholder="service_code,service_name,category,rate_self&#10;CON-001,General Physician Consultation,Consultation,500&#10;LAB-001,CBC Complete,Laboratory,350"
            />
          </FormField>

          <div className="flex items-center gap-3">
            <label className="inline-flex items-center gap-2 px-4 py-2 rounded-h1 border border-h1-border
              text-h1-body text-h1-text-secondary hover:bg-gray-50 transition-colors cursor-pointer">
              <FileSpreadsheet className="w-4 h-4" />
              Upload CSV File
              <input type="file" accept=".csv,.txt" className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) {
                    const reader = new FileReader();
                    reader.onload = (ev) => setCsvText(ev.target?.result as string || '');
                    reader.readAsText(file);
                  }
                }} />
            </label>
            <ActionButton variant="primary" onClick={handleParse} disabled={!csvText.trim()}>
              Parse & Preview
            </ActionButton>
          </div>

          {parseError && (
            <div className="flex items-center gap-2 p-3 bg-h1-red-light border border-red-200 rounded-h1 text-h1-body text-h1-red">
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
              {parseError}
            </div>
          )}
        </div>
      )}

      {step === 'preview' && (
        <div className="space-y-h1-md">
          <div className="flex items-center gap-4">
            <span className="h1-badge-success">{validCount} valid</span>
            {errorCount > 0 && <span className="h1-badge-danger">{errorCount} errors (will be skipped)</span>}
          </div>

          <div className="max-h-80 overflow-y-auto border border-h1-border rounded-h1">
            <table className="w-full text-h1-small">
              <thead className="bg-gray-50 sticky top-0">
                <tr>
                  <th className="px-3 py-2 text-left font-medium text-h1-text-secondary">Code</th>
                  <th className="px-3 py-2 text-left font-medium text-h1-text-secondary">Service Name</th>
                  <th className="px-3 py-2 text-left font-medium text-h1-text-secondary">Category</th>
                  <th className="px-3 py-2 text-right font-medium text-h1-text-secondary">Self (₹)</th>
                  <th className="px-3 py-2 text-left font-medium text-h1-text-secondary">Status</th>
                </tr>
              </thead>
              <tbody>
                {parsed.slice(0, 50).map((row, i) => (
                  <tr key={i} className={`border-t border-h1-border ${row._error ? 'bg-h1-red-light/50' : ''}`}>
                    <td className="px-3 py-1.5 tabular-nums">{row.service_code}</td>
                    <td className="px-3 py-1.5">{row.service_name || <span className="text-h1-red">Missing</span>}</td>
                    <td className="px-3 py-1.5">{row.category}</td>
                    <td className="px-3 py-1.5 text-right tabular-nums">{fmt(row.rate_self)}</td>
                    <td className="px-3 py-1.5">
                      {row._error
                        ? <span className="text-h1-red text-h1-small">{row._error}</span>
                        : <span className="text-h1-success">✓</span>
                      }
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {parsed.length > 50 && (
              <div className="px-3 py-2 bg-gray-50 text-h1-small text-h1-text-muted">
                Showing first 50 of {parsed.length} rows
              </div>
            )}
          </div>

          {importMut.error && (
            <div className="flex items-center gap-2 p-3 bg-h1-red-light border border-red-200 rounded-h1 text-h1-body text-h1-red">
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
              {importMut.error}
            </div>
          )}
        </div>
      )}
    </Modal>
  );
}
