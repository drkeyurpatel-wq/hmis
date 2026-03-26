// components/pharmacy/pharmacy-drug-master.tsx
// Drug master: search, add, and browse drugs
'use client';
import React, { useState, useMemo } from 'react';
import { Plus, X, Pill, Shield, Bug } from 'lucide-react';

interface PharmacyDrugMasterProps {
  drugs: any[];
  onSearch: (q: string) => any[];
  onAddDrug: (data: any) => Promise<void>;
  onFlash: (msg: string) => void;
}

const FORMULATIONS = ['tablet', 'capsule', 'syrup', 'injection', 'ointment', 'drops', 'inhaler', 'powder', 'gel', 'patch'];
const UNITS = ['strip', 'vial', 'bottle', 'tube', 'ampoule', 'sachet', 'box', 'unit'];
const SCHEDULES = ['', 'H', 'H1', 'X'];
const GST_RATES = [0, 5, 12, 18];

export default function PharmacyDrugMaster({ drugs, onSearch, onAddDrug, onFlash }: PharmacyDrugMasterProps) {
  const [search, setSearch] = useState('');
  const [showAdd, setShowAdd] = useState(false);
  const [form, setForm] = useState({
    generic_name: '', brand_name: '', manufacturer: '', formulation: 'tablet',
    strength: '', unit: 'strip', schedule: '', is_narcotic: false, is_antibiotic: false,
    hsn_code: '', gst_rate: 12, reorder_level: 20, rack_location: '', bin_number: '',
  });

  const results = useMemo(() => search ? onSearch(search) : drugs.slice(0, 50), [search, drugs, onSearch]);

  const handleSave = async () => {
    if (!form.generic_name) return;
    await onAddDrug(form);
    setShowAdd(false);
    onFlash('Drug added');
    setForm({ generic_name: '', brand_name: '', manufacturer: '', formulation: 'tablet', strength: '', unit: 'strip', schedule: '', is_narcotic: false, is_antibiotic: false, hsn_code: '', gst_rate: 12, reorder_level: 20, rack_location: '', bin_number: '' });
  };

  return (
    <div className="space-y-3">
      <div className="flex gap-2">
        <input type="text" value={search} onChange={e => setSearch(e.target.value)}
          className="flex-1 px-3 py-2 border border-h1-border rounded-h1-sm text-h1-body
            focus:outline-none focus:ring-1 focus:ring-h1-teal" placeholder="Search drugs..." />
        <button onClick={() => setShowAdd(!showAdd)}
          className="flex items-center gap-1 px-3 py-2 bg-h1-navy text-white text-h1-small font-medium rounded-h1-sm cursor-pointer">
          {showAdd ? <X className="w-3.5 h-3.5" /> : <Plus className="w-3.5 h-3.5" />}
          {showAdd ? 'Cancel' : 'Add Drug'}
        </button>
      </div>

      {showAdd && (
        <div className="bg-h1-card rounded-h1 border border-h1-border p-4 space-y-3">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <div><label className="text-[10px] text-h1-text-secondary">Generic name *</label>
              <input type="text" value={form.generic_name} onChange={e => setForm(f => ({ ...f, generic_name: e.target.value }))}
                className="w-full px-2 py-1.5 border border-h1-border rounded-h1-sm text-h1-small focus:outline-none focus:ring-1 focus:ring-h1-teal" /></div>
            <div><label className="text-[10px] text-h1-text-secondary">Brand name</label>
              <input type="text" value={form.brand_name} onChange={e => setForm(f => ({ ...f, brand_name: e.target.value }))}
                className="w-full px-2 py-1.5 border border-h1-border rounded-h1-sm text-h1-small focus:outline-none focus:ring-1 focus:ring-h1-teal" /></div>
            <div><label className="text-[10px] text-h1-text-secondary">Manufacturer</label>
              <input type="text" value={form.manufacturer} onChange={e => setForm(f => ({ ...f, manufacturer: e.target.value }))}
                className="w-full px-2 py-1.5 border border-h1-border rounded-h1-sm text-h1-small focus:outline-none focus:ring-1 focus:ring-h1-teal" /></div>
            <div><label className="text-[10px] text-h1-text-secondary">Strength</label>
              <input type="text" value={form.strength} onChange={e => setForm(f => ({ ...f, strength: e.target.value }))}
                className="w-full px-2 py-1.5 border border-h1-border rounded-h1-sm text-h1-small focus:outline-none focus:ring-1 focus:ring-h1-teal" placeholder="500mg" /></div>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
            <div><label className="text-[10px] text-h1-text-secondary">Formulation</label>
              <div className="flex gap-0.5 mt-0.5 flex-wrap">{FORMULATIONS.map(f => (
                <button key={f} onClick={() => setForm(d => ({ ...d, formulation: f }))}
                  className={`px-1.5 py-0.5 rounded-h1-sm text-[9px] border cursor-pointer transition-colors
                    ${form.formulation === f ? 'bg-h1-navy text-white border-h1-navy' : 'bg-h1-card border-h1-border hover:bg-h1-navy/5'}`}>{f}</button>
              ))}</div></div>
            <div><label className="text-[10px] text-h1-text-secondary">Unit</label>
              <div className="flex gap-0.5 mt-0.5 flex-wrap">{UNITS.map(u => (
                <button key={u} onClick={() => setForm(d => ({ ...d, unit: u }))}
                  className={`px-1.5 py-0.5 rounded-h1-sm text-[9px] border cursor-pointer transition-colors
                    ${form.unit === u ? 'bg-h1-navy text-white border-h1-navy' : 'bg-h1-card border-h1-border hover:bg-h1-navy/5'}`}>{u}</button>
              ))}</div></div>
            <div><label className="text-[10px] text-h1-text-secondary">Schedule</label>
              <div className="flex gap-0.5 mt-0.5">{SCHEDULES.map(s => (
                <button key={s || 'none'} onClick={() => setForm(d => ({ ...d, schedule: s, is_narcotic: s === 'X' }))}
                  className={`px-2 py-0.5 rounded-h1-sm text-[9px] border cursor-pointer transition-colors
                    ${form.schedule === s ? 'bg-h1-navy text-white border-h1-navy' : 'bg-h1-card border-h1-border hover:bg-h1-navy/5'}`}>{s || 'None'}</button>
              ))}</div></div>
            <div><label className="text-[10px] text-h1-text-secondary">GST %</label>
              <div className="flex gap-0.5 mt-0.5">{GST_RATES.map(g => (
                <button key={g} onClick={() => setForm(d => ({ ...d, gst_rate: g }))}
                  className={`px-2 py-0.5 rounded-h1-sm text-[9px] border cursor-pointer transition-colors
                    ${form.gst_rate === g ? 'bg-h1-navy text-white border-h1-navy' : 'bg-h1-card border-h1-border hover:bg-h1-navy/5'}`}>{g}%</button>
              ))}</div></div>
            <div className="flex gap-3 items-center">
              <label className="flex items-center gap-1 text-[10px] text-h1-text-secondary cursor-pointer">
                <input type="checkbox" checked={form.is_antibiotic} onChange={e => setForm(d => ({ ...d, is_antibiotic: e.target.checked }))} className="w-3 h-3 accent-h1-teal" />
                <Bug className="w-3 h-3" /> Antibiotic
              </label>
              <label className="flex items-center gap-1 text-[10px] text-h1-text-secondary cursor-pointer">
                <input type="checkbox" checked={form.is_narcotic} onChange={e => setForm(d => ({ ...d, is_narcotic: e.target.checked }))} className="w-3 h-3 accent-h1-red" />
                <Shield className="w-3 h-3" /> Narcotic
              </label>
            </div>
          </div>
          <button onClick={handleSave} disabled={!form.generic_name}
            className="px-4 py-2 bg-h1-success text-white text-h1-small font-medium rounded-h1-sm
              disabled:opacity-40 hover:bg-h1-success/90 cursor-pointer">Save Drug</button>
        </div>
      )}

      {/* Drug table */}
      <div className="bg-h1-card rounded-h1 border border-h1-border overflow-x-auto">
        <table className="w-full text-h1-small">
          <thead><tr className="bg-h1-navy/[0.03] border-b border-h1-border">
            <th className="text-left p-2 font-medium text-h1-text-secondary">Generic Name</th>
            <th className="text-left p-2 font-medium text-h1-text-secondary">Brand</th>
            <th className="p-2 font-medium text-h1-text-secondary">Form</th>
            <th className="p-2 font-medium text-h1-text-secondary">Strength</th>
            <th className="p-2 font-medium text-h1-text-secondary">Sch</th>
            <th className="p-2 font-medium text-h1-text-secondary">GST</th>
            <th className="p-2 font-medium text-h1-text-secondary">Reorder</th>
          </tr></thead>
          <tbody>{results.map((d: any) => (
            <tr key={d.id} className="border-b border-h1-border hover:bg-h1-navy/[0.02]">
              <td className="p-2 font-medium text-h1-text">
                {d.generic_name}
                {d.is_antibiotic && <span className="ml-1 text-[9px] bg-h1-yellow/10 text-h1-yellow px-1 rounded-h1-sm">AB</span>}
                {d.is_narcotic && <span className="ml-1 text-[9px] bg-h1-red/10 text-h1-red px-1 rounded-h1-sm">NAR</span>}
              </td>
              <td className="p-2 text-h1-text-secondary">{d.brand_name || '—'}</td>
              <td className="p-2 text-center text-h1-text-secondary">{d.formulation}</td>
              <td className="p-2 text-center text-h1-text-secondary">{d.strength || '—'}</td>
              <td className="p-2 text-center">
                {d.schedule ? <span className={`px-1 py-0.5 rounded-h1-sm text-[9px]
                  ${d.schedule === 'X' ? 'bg-h1-red/10 text-h1-red' : d.schedule === 'H1' ? 'bg-h1-yellow/10 text-h1-yellow' : 'bg-h1-navy/5 text-h1-text-muted'}`}>{d.schedule}</span> : '—'}
              </td>
              <td className="p-2 text-center text-h1-text-secondary">{d.gst_rate}%</td>
              <td className="p-2 text-center text-h1-text-secondary">{d.reorder_level || 20}</td>
            </tr>
          ))}</tbody>
        </table>
      </div>
      <div className="text-h1-small text-h1-text-muted text-center">{drugs.length} drugs in master</div>
    </div>
  );
}
