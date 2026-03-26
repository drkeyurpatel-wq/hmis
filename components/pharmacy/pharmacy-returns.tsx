// components/pharmacy/pharmacy-returns.tsx
// Returns, write-offs, and inter-centre stock transfers
'use client';
import React, { useState, useMemo } from 'react';
import { RotateCcw, ArrowRightLeft } from 'lucide-react';

interface PharmacyReturnsProps {
  returns: any[];
  returnsLoading: boolean;
  returnsStats: { patientReturns: number; expiryWriteOff: number; totalRefund: number };
  transfers: any[];
  transfersLoading: boolean;
  centres: any[];
  onProcessReturn: (data: any) => Promise<{ success: boolean; error?: string }>;
  onCreateTransfer: (data: any) => Promise<{ success: boolean; error?: string }>;
  drugSearch: (q: string) => any[];
  staffId: string;
  onFlash: (msg: string) => void;
}

const fmt = (n: number) => n.toLocaleString('en-IN', { maximumFractionDigits: 0 });
const RETURN_TYPES = ['patient_return', 'supplier_return', 'expiry_write_off', 'damage'];

export default function PharmacyReturns({
  returns, returnsLoading, returnsStats, transfers, transfersLoading,
  centres, onProcessReturn, onCreateTransfer, drugSearch, staffId, onFlash,
}: PharmacyReturnsProps) {
  const [retForm, setRetForm] = useState({ drugSearch: '', drugId: '', drugName: '', quantity: '', batchNumber: '', returnType: 'patient_return', reason: '', amount: '' });
  const retResults = useMemo(() => retForm.drugSearch.length >= 2 ? drugSearch(retForm.drugSearch) : [], [retForm.drugSearch, drugSearch]);

  const [xferForm, setXferForm] = useState({ drugSearch: '', drugId: '', drugName: '', quantity: '', batchNumber: '', toCentreId: '', reason: '' });
  const xferResults = useMemo(() => xferForm.drugSearch.length >= 2 ? drugSearch(xferForm.drugSearch) : [], [xferForm.drugSearch, drugSearch]);

  const [activeSection, setActiveSection] = useState<'returns' | 'transfers'>('returns');

  const handleReturn = async () => {
    const r = await onProcessReturn({
      drugId: retForm.drugId, quantity: parseInt(retForm.quantity), batchNumber: retForm.batchNumber,
      returnType: retForm.returnType, reason: retForm.reason, amount: parseFloat(retForm.amount) || 0, staffId,
    });
    if (r.success) { onFlash('Return processed'); setRetForm({ drugSearch: '', drugId: '', drugName: '', quantity: '', batchNumber: '', returnType: 'patient_return', reason: '', amount: '' }); }
    else onFlash(r.error || 'Failed');
  };

  const handleTransfer = async () => {
    const r = await onCreateTransfer({
      drugId: xferForm.drugId, quantity: parseInt(xferForm.quantity), batchNumber: xferForm.batchNumber,
      toCentreId: xferForm.toCentreId, reason: xferForm.reason, staffId,
    });
    if (r.success) { onFlash('Transfer created'); setXferForm({ drugSearch: '', drugId: '', drugName: '', quantity: '', batchNumber: '', toCentreId: '', reason: '' }); }
    else onFlash(r.error || 'Failed');
  };

  return (
    <div className="space-y-4">
      {/* Section toggle */}
      <div className="flex gap-1.5">
        <button onClick={() => setActiveSection('returns')}
          className={`flex items-center gap-1.5 px-4 py-2 rounded-h1-sm text-h1-small font-medium cursor-pointer transition-colors
            ${activeSection === 'returns' ? 'bg-h1-teal text-white' : 'bg-h1-card border border-h1-border text-h1-text-secondary hover:bg-h1-navy/5'}`}>
          <RotateCcw className="w-3.5 h-3.5" /> Returns &amp; Write-offs
        </button>
        <button onClick={() => setActiveSection('transfers')}
          className={`flex items-center gap-1.5 px-4 py-2 rounded-h1-sm text-h1-small font-medium cursor-pointer transition-colors
            ${activeSection === 'transfers' ? 'bg-h1-teal text-white' : 'bg-h1-card border border-h1-border text-h1-text-secondary hover:bg-h1-navy/5'}`}>
          <ArrowRightLeft className="w-3.5 h-3.5" /> Stock Transfers
        </button>
      </div>

      {activeSection === 'returns' && (
        <>
          {/* Stats */}
          <div className="flex gap-2 text-[10px]">
            <span className="bg-h1-teal/10 text-h1-teal px-2 py-1 rounded-h1-sm">Patient returns: {returnsStats.patientReturns}</span>
            <span className="bg-h1-red/10 text-h1-red px-2 py-1 rounded-h1-sm">Expiry write-off: {returnsStats.expiryWriteOff}</span>
            <span className="bg-h1-success/10 text-h1-success px-2 py-1 rounded-h1-sm">Total refund: ₹{fmt(returnsStats.totalRefund)}</span>
          </div>

          {/* Return form */}
          <div className="bg-h1-card rounded-h1 border border-h1-border p-4">
            <h3 className="text-h1-small font-semibold text-h1-text-secondary mb-3">Process Return / Write-off</h3>
            <div className="grid grid-cols-2 md:grid-cols-6 gap-2">
              <DrugSearchField value={retForm.drugId ? retForm.drugName : retForm.drugSearch} results={retResults}
                onChange={v => setRetForm(f => ({ ...f, drugSearch: v, drugId: '', drugName: '' }))}
                onSelect={(id, name) => setRetForm(f => ({ ...f, drugId: id, drugName: name, drugSearch: '' }))} />
              <div><label className="text-[10px] text-h1-text-secondary">Type</label>
                <select value={retForm.returnType} onChange={e => setRetForm(f => ({ ...f, returnType: e.target.value }))}
                  className="w-full px-2 py-1.5 border border-h1-border rounded-h1-sm text-h1-small focus:outline-none focus:ring-1 focus:ring-h1-teal">
                  {RETURN_TYPES.map(t => <option key={t} value={t}>{t.replace(/_/g, ' ')}</option>)}
                </select></div>
              <div><label className="text-[10px] text-h1-text-secondary">Qty</label>
                <input type="number" value={retForm.quantity} onChange={e => setRetForm(f => ({ ...f, quantity: e.target.value }))}
                  className="w-full px-2 py-1.5 border border-h1-border rounded-h1-sm text-h1-small focus:outline-none focus:ring-1 focus:ring-h1-teal" /></div>
              <div><label className="text-[10px] text-h1-text-secondary">Batch</label>
                <input type="text" value={retForm.batchNumber} onChange={e => setRetForm(f => ({ ...f, batchNumber: e.target.value }))}
                  className="w-full px-2 py-1.5 border border-h1-border rounded-h1-sm text-h1-small focus:outline-none focus:ring-1 focus:ring-h1-teal" /></div>
              <div><label className="text-[10px] text-h1-text-secondary">Reason *</label>
                <input type="text" value={retForm.reason} onChange={e => setRetForm(f => ({ ...f, reason: e.target.value }))}
                  className="w-full px-2 py-1.5 border border-h1-border rounded-h1-sm text-h1-small focus:outline-none focus:ring-1 focus:ring-h1-teal" /></div>
              <div className="flex items-end">
                <button onClick={handleReturn} disabled={!retForm.drugId || !retForm.quantity || !retForm.reason}
                  className="w-full py-1.5 bg-h1-yellow text-white text-h1-small font-medium rounded-h1-sm
                    disabled:opacity-40 hover:bg-h1-yellow/90 cursor-pointer">Process</button>
              </div>
            </div>
          </div>

          {/* Returns table */}
          {returnsLoading ? <div className="animate-h1-shimmer h-24 bg-h1-navy/5 rounded-h1" /> :
          returns.length === 0 ? <div className="text-center py-8 bg-h1-card rounded-h1 border border-h1-border text-h1-text-muted text-h1-body">No returns processed</div> :
          <div className="bg-h1-card rounded-h1 border border-h1-border overflow-x-auto">
            <table className="w-full text-h1-small"><thead><tr className="bg-h1-navy/[0.03] border-b border-h1-border">
              <th className="text-left p-2 font-medium text-h1-text-secondary">Drug</th>
              <th className="p-2 font-medium text-h1-text-secondary">Type</th>
              <th className="p-2 font-medium text-h1-text-secondary">Qty</th>
              <th className="p-2 font-medium text-h1-text-secondary">Batch</th>
              <th className="p-2 font-medium text-h1-text-secondary">Reason</th>
              <th className="p-2 font-medium text-h1-text-secondary text-right">Refund</th>
              <th className="p-2 font-medium text-h1-text-secondary">By</th>
              <th className="p-2 font-medium text-h1-text-secondary">Date</th>
            </tr></thead><tbody>{returns.slice(0, 50).map((r: any) => (
              <tr key={r.id} className="border-b border-h1-border">
                <td className="p-2 font-medium text-h1-text">{r.drug?.drug_name || r.drug?.generic_name || '—'}</td>
                <td className="p-2 text-center"><span className={`px-1.5 py-0.5 rounded-h1-sm text-[9px]
                  ${r.return_type === 'patient_return' ? 'bg-h1-teal/10 text-h1-teal'
                    : r.return_type === 'expiry_write_off' ? 'bg-h1-red/10 text-h1-red'
                    : 'bg-h1-navy/5 text-h1-text-muted'}`}>{r.return_type?.replace(/_/g, ' ')}</span></td>
                <td className="p-2 text-center text-h1-text">{r.quantity}</td>
                <td className="p-2 text-center text-h1-text-muted">{r.batch_number}</td>
                <td className="p-2 text-h1-text-secondary text-[10px]">{r.reason}</td>
                <td className="p-2 text-right font-bold text-h1-text">{parseFloat(r.refund_amount) > 0 ? `₹${fmt(parseFloat(r.refund_amount))}` : '—'}</td>
                <td className="p-2 text-[10px] text-h1-text-secondary">{r.staff?.full_name}</td>
                <td className="p-2 text-center text-h1-text-muted text-[10px]">{new Date(r.created_at).toLocaleDateString('en-IN')}</td>
              </tr>
            ))}</tbody></table>
          </div>}
        </>
      )}

      {activeSection === 'transfers' && (
        <>
          {/* Transfer form */}
          <div className="bg-h1-card rounded-h1 border border-h1-border p-4">
            <h3 className="text-h1-small font-semibold text-h1-text-secondary mb-3">Create Stock Transfer</h3>
            <div className="grid grid-cols-2 md:grid-cols-6 gap-2">
              <DrugSearchField value={xferForm.drugId ? xferForm.drugName : xferForm.drugSearch} results={xferResults}
                onChange={v => setXferForm(f => ({ ...f, drugSearch: v, drugId: '', drugName: '' }))}
                onSelect={(id, name) => setXferForm(f => ({ ...f, drugId: id, drugName: name, drugSearch: '' }))} />
              <div><label className="text-[10px] text-h1-text-secondary">To Centre *</label>
                <select value={xferForm.toCentreId} onChange={e => setXferForm(f => ({ ...f, toCentreId: e.target.value }))}
                  className="w-full px-2 py-1.5 border border-h1-border rounded-h1-sm text-h1-small focus:outline-none focus:ring-1 focus:ring-h1-teal">
                  <option value="">Select centre</option>
                  {centres.map((c: any) => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select></div>
              <div><label className="text-[10px] text-h1-text-secondary">Qty *</label>
                <input type="number" value={xferForm.quantity} onChange={e => setXferForm(f => ({ ...f, quantity: e.target.value }))}
                  className="w-full px-2 py-1.5 border border-h1-border rounded-h1-sm text-h1-small focus:outline-none focus:ring-1 focus:ring-h1-teal" /></div>
              <div><label className="text-[10px] text-h1-text-secondary">Batch</label>
                <input type="text" value={xferForm.batchNumber} onChange={e => setXferForm(f => ({ ...f, batchNumber: e.target.value }))}
                  className="w-full px-2 py-1.5 border border-h1-border rounded-h1-sm text-h1-small focus:outline-none focus:ring-1 focus:ring-h1-teal" /></div>
              <div><label className="text-[10px] text-h1-text-secondary">Reason</label>
                <input type="text" value={xferForm.reason} onChange={e => setXferForm(f => ({ ...f, reason: e.target.value }))}
                  className="w-full px-2 py-1.5 border border-h1-border rounded-h1-sm text-h1-small focus:outline-none focus:ring-1 focus:ring-h1-teal" /></div>
              <div className="flex items-end">
                <button onClick={handleTransfer} disabled={!xferForm.drugId || !xferForm.quantity || !xferForm.toCentreId}
                  className="w-full py-1.5 bg-h1-teal text-white text-h1-small font-medium rounded-h1-sm
                    disabled:opacity-40 hover:bg-h1-teal/90 cursor-pointer">Transfer</button>
              </div>
            </div>
          </div>

          {/* Transfers table */}
          {transfersLoading ? <div className="animate-h1-shimmer h-24 bg-h1-navy/5 rounded-h1" /> :
          transfers.length === 0 ? <div className="text-center py-8 bg-h1-card rounded-h1 border border-h1-border text-h1-text-muted text-h1-body">No transfers</div> :
          <div className="bg-h1-card rounded-h1 border border-h1-border overflow-x-auto">
            <table className="w-full text-h1-small"><thead><tr className="bg-h1-navy/[0.03] border-b border-h1-border">
              <th className="text-left p-2 font-medium text-h1-text-secondary">Drug</th>
              <th className="p-2 font-medium text-h1-text-secondary">From</th>
              <th className="p-2 font-medium text-h1-text-secondary">To</th>
              <th className="p-2 font-medium text-h1-text-secondary">Qty</th>
              <th className="p-2 font-medium text-h1-text-secondary">Status</th>
              <th className="p-2 font-medium text-h1-text-secondary">Date</th>
            </tr></thead><tbody>{transfers.slice(0, 50).map((t: any) => (
              <tr key={t.id} className="border-b border-h1-border">
                <td className="p-2 font-medium text-h1-text">{t.drug?.generic_name || '—'}</td>
                <td className="p-2 text-center text-h1-text-secondary">{t.from_centre?.name || '—'}</td>
                <td className="p-2 text-center text-h1-text-secondary">{t.to_centre?.name || '—'}</td>
                <td className="p-2 text-center font-bold text-h1-text">{t.quantity}</td>
                <td className="p-2 text-center"><span className={`px-1.5 py-0.5 rounded-h1-sm text-[9px]
                  ${t.status === 'completed' ? 'bg-h1-success/10 text-h1-success'
                    : t.status === 'in_transit' ? 'bg-h1-yellow/10 text-h1-yellow'
                    : 'bg-h1-navy/5 text-h1-text-muted'}`}>{t.status}</span></td>
                <td className="p-2 text-center text-h1-text-muted text-[10px]">{new Date(t.created_at).toLocaleDateString('en-IN')}</td>
              </tr>
            ))}</tbody></table>
          </div>}
        </>
      )}
    </div>
  );
}

// Shared drug search field
function DrugSearchField({ value, results, onChange, onSelect }: {
  value: string; results: any[];
  onChange: (v: string) => void; onSelect: (id: string, name: string) => void;
}) {
  return (
    <div className="relative">
      <label className="text-[10px] text-h1-text-secondary">Drug *</label>
      <input type="text" value={value} onChange={e => onChange(e.target.value)} placeholder="Search..."
        className="w-full px-2 py-1.5 border border-h1-border rounded-h1-sm text-h1-small focus:outline-none focus:ring-1 focus:ring-h1-teal" />
      {results.length > 0 && (
        <div className="absolute top-full left-0 right-0 bg-h1-card border border-h1-border rounded-h1-sm shadow-h1-dropdown z-10 max-h-32 overflow-y-auto">
          {results.slice(0, 5).map((d: any) => (
            <button key={d.id} onClick={() => onSelect(d.id, d.generic_name || d.drug_name)}
              className="w-full text-left px-2 py-1.5 text-[10px] hover:bg-h1-teal/5 border-b border-h1-border cursor-pointer">{d.generic_name || d.drug_name}</button>
          ))}
        </div>
      )}
    </div>
  );
}
