// components/pharmacy/pharmacy-inventory.tsx
// Stock overview with add stock form, low stock and expiring alerts
'use client';
import React, { useState, useMemo } from 'react';
import { Package, AlertTriangle, Plus, X } from 'lucide-react';

interface PharmacyInventoryProps {
  stock: any[];
  aggregated: any[];
  lowStock: any[];
  expiringSoon: any[];
  expired: any[];
  onLoad: (filter?: any) => void;
  onAddStock: (data: any) => Promise<void>;
  drugSearch: (q: string) => any[];
  onFlash: (msg: string) => void;
}

const daysToExpiry = (d: string) => Math.ceil((new Date(d).getTime() - Date.now()) / 86400000);
const expiryColor = (d: string) => {
  const days = daysToExpiry(d);
  if (days <= 0) return 'text-h1-red bg-h1-red/[0.05]';
  if (days <= 30) return 'text-h1-red bg-h1-red/[0.05]';
  if (days <= 90) return 'text-h1-yellow bg-h1-yellow/[0.05]';
  return 'text-h1-success';
};

export default function PharmacyInventory({ stock, aggregated, lowStock, expiringSoon, expired, onLoad, onAddStock, drugSearch, onFlash }: PharmacyInventoryProps) {
  const [showAdd, setShowAdd] = useState(false);
  const [drugQ, setDrugQ] = useState('');
  const drugResults = useMemo(() => drugSearch(drugQ), [drugQ, drugSearch]);
  const [form, setForm] = useState({ drug_id: '', drug_name: '', batch_number: '', expiry_date: '', purchase_rate: '', mrp: '', quantity_received: '', supplier: '' });
  const [error, setError] = useState('');

  const handleSave = async () => {
    if (!form.drug_id || !form.batch_number || !form.expiry_date || !form.quantity_received) {
      setError('Drug, batch, expiry, and quantity are required'); return;
    }
    setError('');
    await onAddStock({
      drug_id: form.drug_id, batch_number: form.batch_number, expiry_date: form.expiry_date,
      purchase_rate: parseFloat(form.purchase_rate) || 0, mrp: parseFloat(form.mrp) || 0,
      quantity_received: parseInt(form.quantity_received), quantity_available: parseInt(form.quantity_received),
      supplier: form.supplier,
    });
    onFlash('Stock added');
    setForm({ drug_id: '', drug_name: '', batch_number: '', expiry_date: '', purchase_rate: '', mrp: '', quantity_received: '', supplier: '' });
    setShowAdd(false);
  };

  return (
    <div className="space-y-3">
      {/* Filters + Add */}
      <div className="flex justify-between items-center">
        <div className="flex gap-1.5">
          <button onClick={() => onLoad()} className="px-3 py-1.5 rounded-h1-sm text-h1-small font-medium border border-h1-border bg-h1-card hover:bg-h1-navy/5 cursor-pointer">All Stock</button>
          <button onClick={() => onLoad({ lowStock: true })} className="px-3 py-1.5 rounded-h1-sm text-h1-small font-medium bg-h1-red/10 text-h1-red cursor-pointer">Low Stock ({lowStock.length})</button>
          <button onClick={() => onLoad({ expiringSoon: true })} className="px-3 py-1.5 rounded-h1-sm text-h1-small font-medium bg-h1-yellow/10 text-h1-yellow cursor-pointer">Expiring ({expiringSoon.length})</button>
        </div>
        <button onClick={() => setShowAdd(!showAdd)}
          className="flex items-center gap-1 px-3 py-1.5 bg-h1-navy text-white text-h1-small font-medium rounded-h1-sm hover:bg-h1-navy/90 cursor-pointer">
          {showAdd ? <X className="w-3.5 h-3.5" /> : <Plus className="w-3.5 h-3.5" />}
          {showAdd ? 'Cancel' : 'Add Stock'}
        </button>
      </div>

      {/* Add stock form */}
      {showAdd && (
        <div className="bg-h1-card rounded-h1 border border-h1-border p-4 space-y-3">
          <h3 className="text-h1-small font-semibold text-h1-text-secondary">Add Stock Entry</h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <div className="relative">
              <label className="text-[10px] text-h1-text-secondary">Drug *</label>
              <input type="text" value={form.drug_name || drugQ} placeholder="Search drug..."
                onChange={e => { setDrugQ(e.target.value); setForm(f => ({ ...f, drug_id: '', drug_name: '' })); }}
                className="w-full px-2 py-1.5 border border-h1-border rounded-h1-sm text-h1-small focus:outline-none focus:ring-1 focus:ring-h1-teal" />
              {drugQ.length >= 2 && !form.drug_id && drugResults.length > 0 && (
                <div className="absolute top-full left-0 right-0 bg-h1-card border border-h1-border rounded-h1-sm shadow-h1-dropdown z-10 max-h-32 overflow-y-auto">
                  {drugResults.slice(0, 5).map((d: any) => (
                    <button key={d.id} onClick={() => { setForm(f => ({ ...f, drug_id: d.id, drug_name: d.generic_name || d.drug_name })); setDrugQ(''); }}
                      className="w-full text-left px-2 py-1.5 text-[10px] hover:bg-h1-teal/5 border-b border-h1-border cursor-pointer">{d.generic_name || d.drug_name}</button>
                  ))}
                </div>
              )}
              {form.drug_id && <div className="text-[10px] text-h1-teal mt-0.5">{form.drug_name}</div>}
            </div>
            <div><label className="text-[10px] text-h1-text-secondary">Batch *</label>
              <input type="text" value={form.batch_number} onChange={e => setForm(f => ({ ...f, batch_number: e.target.value }))} className="w-full px-2 py-1.5 border border-h1-border rounded-h1-sm text-h1-small focus:outline-none focus:ring-1 focus:ring-h1-teal" /></div>
            <div><label className="text-[10px] text-h1-text-secondary">Expiry *</label>
              <input type="date" value={form.expiry_date} onChange={e => setForm(f => ({ ...f, expiry_date: e.target.value }))} className="w-full px-2 py-1.5 border border-h1-border rounded-h1-sm text-h1-small focus:outline-none focus:ring-1 focus:ring-h1-teal" /></div>
            <div><label className="text-[10px] text-h1-text-secondary">Quantity *</label>
              <input type="number" value={form.quantity_received} onChange={e => setForm(f => ({ ...f, quantity_received: e.target.value }))} className="w-full px-2 py-1.5 border border-h1-border rounded-h1-sm text-h1-small focus:outline-none focus:ring-1 focus:ring-h1-teal" /></div>
            <div><label className="text-[10px] text-h1-text-secondary">Purchase Rate</label>
              <input type="number" value={form.purchase_rate} onChange={e => setForm(f => ({ ...f, purchase_rate: e.target.value }))} className="w-full px-2 py-1.5 border border-h1-border rounded-h1-sm text-h1-small focus:outline-none focus:ring-1 focus:ring-h1-teal" step="0.01" /></div>
            <div><label className="text-[10px] text-h1-text-secondary">MRP</label>
              <input type="number" value={form.mrp} onChange={e => setForm(f => ({ ...f, mrp: e.target.value }))} className="w-full px-2 py-1.5 border border-h1-border rounded-h1-sm text-h1-small focus:outline-none focus:ring-1 focus:ring-h1-teal" step="0.01" /></div>
            <div><label className="text-[10px] text-h1-text-secondary">Supplier</label>
              <input type="text" value={form.supplier} onChange={e => setForm(f => ({ ...f, supplier: e.target.value }))} className="w-full px-2 py-1.5 border border-h1-border rounded-h1-sm text-h1-small focus:outline-none focus:ring-1 focus:ring-h1-teal" /></div>
            <div className="flex items-end">
              <button onClick={handleSave} className="w-full py-1.5 bg-h1-success text-white text-h1-small font-medium rounded-h1-sm hover:bg-h1-success/90 cursor-pointer">Save</button>
            </div>
          </div>
          {error && <div className="text-h1-small text-h1-red">{error}</div>}
        </div>
      )}

      {/* Stock table */}
      <div className="bg-h1-card rounded-h1 border border-h1-border overflow-x-auto">
        <table className="w-full text-h1-small">
          <thead><tr className="bg-h1-navy/[0.03] border-b border-h1-border">
            <th className="text-left p-2.5 font-medium text-h1-text-secondary">Drug</th>
            <th className="p-2.5 font-medium text-h1-text-secondary">Batch</th>
            <th className="p-2.5 font-medium text-h1-text-secondary">Qty</th>
            <th className="p-2.5 font-medium text-h1-text-secondary">MRP</th>
            <th className="p-2.5 font-medium text-h1-text-secondary">Expiry</th>
            <th className="p-2.5 font-medium text-h1-text-secondary">Status</th>
          </tr></thead>
          <tbody>
            {stock.slice(0, 100).map((s: any, i: number) => (
              <tr key={s.id || i} className="border-b border-h1-border hover:bg-h1-navy/[0.02]">
                <td className="p-2.5 font-medium text-h1-text">{s.drug?.generic_name || s.drug?.drug_name || '—'}</td>
                <td className="p-2.5 text-center text-h1-text-secondary">{s.batch_number}</td>
                <td className={`p-2.5 text-center font-bold ${s.quantity_available <= (s.drug?.reorder_level || 20) ? 'text-h1-red' : 'text-h1-text'}`}>{s.quantity_available}</td>
                <td className="p-2.5 text-center text-h1-text-secondary">₹{s.mrp || '—'}</td>
                <td className={`p-2.5 text-center ${s.expiry_date ? expiryColor(s.expiry_date) : ''}`}>
                  {s.expiry_date ? new Date(s.expiry_date).toLocaleDateString('en-IN', { month: 'short', year: 'numeric' }) : '—'}
                </td>
                <td className="p-2.5 text-center">
                  {s.expiry_date && daysToExpiry(s.expiry_date) <= 0 && <span className="bg-h1-red text-white px-1.5 py-0.5 rounded-h1-sm text-[10px] font-bold">EXPIRED</span>}
                  {s.expiry_date && daysToExpiry(s.expiry_date) > 0 && daysToExpiry(s.expiry_date) <= 90 && <span className="bg-h1-yellow/10 text-h1-yellow px-1.5 py-0.5 rounded-h1-sm text-[10px]">{daysToExpiry(s.expiry_date)}d</span>}
                  {s.quantity_available <= (s.drug?.reorder_level || 20) && s.quantity_available > 0 && <span className="bg-h1-red/10 text-h1-red px-1.5 py-0.5 rounded-h1-sm text-[10px] ml-0.5">LOW</span>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
