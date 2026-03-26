// components/pharmacy/pharmacy-controlled.tsx
// Controlled substance register with witness requirement
'use client';
import React, { useState, useMemo } from 'react';
import { Shield, Eye } from 'lucide-react';

interface PharmacyControlledProps {
  register: any[];
  loading: boolean;
  onAddEntry: (data: any) => Promise<{ success: boolean; error?: string }>;
  drugSearch: (q: string) => any[];
  staffId: string;
  onFlash: (msg: string) => void;
}

const TRANSACTION_TYPES = ['dispensed', 'received', 'wastage', 'adjustment'];

export default function PharmacyControlled({ register, loading, onAddEntry, drugSearch, staffId, onFlash }: PharmacyControlledProps) {
  const [form, setForm] = useState({ drugSearch: '', drugId: '', drugName: '', quantity: '', batchNumber: '', transactionType: 'dispensed', witnessId: '', notes: '' });
  const results = useMemo(() => form.drugSearch.length >= 2 ? drugSearch(form.drugSearch) : [], [form.drugSearch, drugSearch]);

  const handleLog = async () => {
    const r = await onAddEntry({
      drugId: form.drugId, quantity: parseInt(form.quantity), batchNumber: form.batchNumber,
      transactionType: form.transactionType, administeredBy: staffId,
      witnessedBy: form.witnessId, notes: form.notes,
    });
    if (r.success) {
      onFlash('Entry logged');
      setForm({ drugSearch: '', drugId: '', drugName: '', quantity: '', batchNumber: '', transactionType: 'dispensed', witnessId: '', notes: '' });
    } else {
      onFlash(r.error || 'Failed');
    }
  };

  return (
    <div className="space-y-4">
      <h2 className="text-h1-card-title text-h1-navy flex items-center gap-1.5">
        <Shield className="w-5 h-5 text-h1-red" /> Controlled Substance Register
      </h2>

      {/* Entry form */}
      <div className="bg-h1-card rounded-h1 border border-h1-border p-4">
        <h3 className="text-h1-small font-semibold text-h1-text-secondary mb-3">Log Entry</h3>
        <div className="grid grid-cols-2 md:grid-cols-7 gap-2">
          <div className="relative">
            <label className="text-[10px] text-h1-text-secondary">Drug *</label>
            <input type="text" value={form.drugId ? form.drugName : form.drugSearch} placeholder="Search..."
              onChange={e => setForm(f => ({ ...f, drugSearch: e.target.value, drugId: '', drugName: '' }))}
              className="w-full px-2 py-1.5 border border-h1-border rounded-h1-sm text-h1-small focus:outline-none focus:ring-1 focus:ring-h1-teal" />
            {results.length > 0 && !form.drugId && (
              <div className="absolute top-full left-0 right-0 bg-h1-card border border-h1-border rounded-h1-sm shadow-h1-dropdown z-10 max-h-32 overflow-y-auto">
                {results.slice(0, 5).map((d: any) => (
                  <button key={d.id} onClick={() => setForm(f => ({ ...f, drugId: d.id, drugName: d.generic_name || d.drug_name, drugSearch: '' }))}
                    className="w-full text-left px-2 py-1.5 text-[10px] hover:bg-h1-teal/5 border-b border-h1-border cursor-pointer">{d.generic_name || d.drug_name}</button>
                ))}
              </div>
            )}
          </div>
          <div><label className="text-[10px] text-h1-text-secondary">Type</label>
            <select value={form.transactionType} onChange={e => setForm(f => ({ ...f, transactionType: e.target.value }))}
              className="w-full px-2 py-1.5 border border-h1-border rounded-h1-sm text-h1-small focus:outline-none focus:ring-1 focus:ring-h1-teal">
              {TRANSACTION_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
            </select></div>
          <div><label className="text-[10px] text-h1-text-secondary">Qty *</label>
            <input type="number" value={form.quantity} onChange={e => setForm(f => ({ ...f, quantity: e.target.value }))}
              className="w-full px-2 py-1.5 border border-h1-border rounded-h1-sm text-h1-small focus:outline-none focus:ring-1 focus:ring-h1-teal" /></div>
          <div><label className="text-[10px] text-h1-text-secondary">Batch</label>
            <input type="text" value={form.batchNumber} onChange={e => setForm(f => ({ ...f, batchNumber: e.target.value }))}
              className="w-full px-2 py-1.5 border border-h1-border rounded-h1-sm text-h1-small focus:outline-none focus:ring-1 focus:ring-h1-teal" /></div>
          <div><label className="text-[10px] text-h1-red font-medium flex items-center gap-0.5"><Eye className="w-3 h-3" /> Witness *</label>
            <input type="text" value={form.witnessId} onChange={e => setForm(f => ({ ...f, witnessId: e.target.value }))}
              className="w-full px-2 py-1.5 border border-h1-red/30 rounded-h1-sm text-h1-small focus:outline-none focus:ring-1 focus:ring-h1-red" placeholder="Witness ID" /></div>
          <div><label className="text-[10px] text-h1-text-secondary">Notes</label>
            <input type="text" value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
              className="w-full px-2 py-1.5 border border-h1-border rounded-h1-sm text-h1-small focus:outline-none focus:ring-1 focus:ring-h1-teal" /></div>
          <div className="flex items-end">
            <button onClick={handleLog} disabled={!form.drugId || !form.quantity || !form.witnessId}
              className="w-full py-1.5 bg-h1-red text-white text-h1-small font-medium rounded-h1-sm
                disabled:opacity-40 hover:bg-h1-red/90 cursor-pointer">Log</button>
          </div>
        </div>
      </div>

      {/* Register table */}
      {loading ? <div className="animate-h1-shimmer h-24 bg-h1-navy/5 rounded-h1" /> : (
        <div className="bg-h1-card rounded-h1 border border-h1-border overflow-x-auto">
          <table className="w-full text-h1-small">
            <thead><tr className="bg-h1-navy/[0.03] border-b border-h1-border">
              <th className="text-left p-2 font-medium text-h1-text-secondary">Drug</th>
              <th className="p-2 font-medium text-h1-text-secondary">Type</th>
              <th className="p-2 font-medium text-h1-text-secondary">Qty</th>
              <th className="p-2 font-medium text-h1-text-secondary">Batch</th>
              <th className="p-2 font-medium text-h1-text-secondary">By</th>
              <th className="p-2 font-medium text-h1-text-secondary">Witness</th>
              <th className="p-2 font-medium text-h1-text-secondary">Date/Time</th>
            </tr></thead>
            <tbody>{register.slice(0, 50).map((r: any) => (
              <tr key={r.id} className={`border-b border-h1-border ${r.transaction_type === 'wastage' ? 'bg-h1-red/[0.03]' : ''}`}>
                <td className="p-2 font-medium text-h1-text">{r.drug?.drug_name || r.drug?.generic_name || '—'}</td>
                <td className="p-2 text-center">
                  <span className={`px-1.5 py-0.5 rounded-h1-sm text-[9px] font-medium
                    ${r.transaction_type === 'dispensed' ? 'bg-h1-teal/10 text-h1-teal'
                      : r.transaction_type === 'received' ? 'bg-h1-success/10 text-h1-success'
                      : r.transaction_type === 'wastage' ? 'bg-h1-red/10 text-h1-red'
                      : 'bg-h1-navy/5 text-h1-text-muted'}`}>
                    {r.transaction_type}
                  </span>
                </td>
                <td className="p-2 text-center font-bold text-h1-text">{r.quantity}</td>
                <td className="p-2 text-center text-h1-text-muted">{r.batch_number}</td>
                <td className="p-2 text-[10px] text-h1-text-secondary">{r.staff?.full_name || '—'}</td>
                <td className="p-2 text-[10px]">
                  {r.witness?.full_name || <span className="text-h1-red font-bold">NO WITNESS</span>}
                </td>
                <td className="p-2 text-center text-h1-text-muted text-[10px]">{new Date(r.created_at).toLocaleString('en-IN')}</td>
              </tr>
            ))}</tbody>
          </table>
        </div>
      )}
    </div>
  );
}
