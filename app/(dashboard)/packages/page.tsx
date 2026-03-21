'use client';
import React, { useState } from 'react';
import { RoleGuard } from '@/components/ui/shared';
import { useAuthStore } from '@/lib/store/auth';
import { usePackages } from '@/lib/modules/module-hooks';
import { Plus, Search, X } from 'lucide-react';
const fmt = (n: number) => Math.round(n).toLocaleString('en-IN');
const CC: Record<string, string> = { surgical: 'h1-badge-red', medical: 'h1-badge-blue', daycare: 'h1-badge-green', diagnostic: 'h1-badge-purple', maternity: 'h1-badge-amber' };

function PkgInner() {
  const { staff, activeCentreId } = useAuthStore();
  const { packages, stats, create } = usePackages(activeCentreId || '');
  const [search, setSearch] = useState('');
  const [showNew, setShowNew] = useState(false);
  const [toast, setToast] = useState('');
  const flash = (m: string) => { setToast(m); setTimeout(() => setToast(''), 3000); };
  const [f, setF] = useState({ package_name: '', department: '', category: 'surgical', package_rate: '', rate_insurance: '', rate_pmjay: '', los_days: '3', room_category: 'general', exclusions: '' });
  const filtered = search ? packages.filter(p => p.package_name.toLowerCase().includes(search.toLowerCase())) : packages;

  const handleCreate = async () => {
    if (!f.package_name || !f.package_rate) return;
    const res = await create({ ...f, package_rate: parseFloat(f.package_rate), rate_insurance: f.rate_insurance ? parseFloat(f.rate_insurance) : null, rate_pmjay: f.rate_pmjay ? parseFloat(f.rate_pmjay) : null, los_days: parseInt(f.los_days) || 3, exclusions: f.exclusions ? f.exclusions.split(',').map(s => s.trim()) : [] }, staff?.id || '');
    if (res.success) { flash('Package created'); setShowNew(false); }
  };

  return (
    <div className="max-w-[1400px] mx-auto space-y-4">
      {toast && <div className="fixed top-4 left-1/2 -translate-x-1/2 z-50 bg-teal-600 text-white px-5 py-2.5 rounded-xl shadow-lg text-sm font-medium">{toast}</div>}
      <div className="flex items-center justify-between">
        <div><h1 className="text-xl font-bold tracking-tight">Package Management</h1><p className="text-xs text-gray-400">{stats.total} active packages</p></div>
        <button onClick={() => setShowNew(true)} className="flex items-center gap-2 px-4 py-2.5 bg-teal-600 text-white text-sm rounded-xl font-semibold"><Plus size={15} /> New Package</button>
      </div>
      <div className="flex gap-2">{Object.entries(stats.byCategory).map(([k, v]) => <div key={k} className="bg-white rounded-xl border px-3 py-2"><span className={`h1-badge ${CC[k] || 'h1-badge-gray'} capitalize mr-2`}>{k}</span><span className="font-bold">{v as number}</span></div>)}</div>
      <div className="bg-white rounded-2xl border overflow-hidden">
        <div className="px-4 py-3 border-b"><div className="relative max-w-xs"><Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" /><input value={search} onChange={e => setSearch(e.target.value)} className="w-full pl-9 pr-3 py-2 text-xs border rounded-lg" placeholder="Search packages..." /></div></div>
        <table className="h1-table"><thead><tr><th>Code</th><th>Package</th><th>Dept</th><th>Category</th><th>LOS</th><th>Room</th><th className="text-right">Self ₹</th><th className="text-right">Insurance ₹</th><th className="text-right">PMJAY ₹</th></tr></thead>
          <tbody>{filtered.map(p => (<tr key={p.id}><td className="font-mono text-[10px]">{p.package_code}</td><td className="font-semibold">{p.package_name}</td><td className="text-teal-700 text-[11px]">{p.department || '—'}</td><td><span className={`h1-badge ${CC[p.category] || 'h1-badge-gray'} capitalize`}>{p.category}</span></td><td>{p.los_days}d</td><td className="capitalize text-[11px]">{p.room_category?.replace('_', ' ')}</td><td className="text-right font-bold">₹{fmt(p.package_rate)}</td><td className="text-right text-blue-700">{p.rate_insurance ? `₹${fmt(p.rate_insurance)}` : '—'}</td><td className="text-right text-green-700">{p.rate_pmjay ? `₹${fmt(p.rate_pmjay)}` : '—'}</td></tr>))}
            {filtered.length === 0 && <tr><td colSpan={9} className="text-center py-12 text-gray-400">No packages</td></tr>}</tbody></table>
      </div>
      {showNew && <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4" onClick={() => setShowNew(false)}>
        <div className="bg-white rounded-2xl w-full max-w-lg p-6 space-y-3" onClick={e => e.stopPropagation()}>
          <div className="flex justify-between"><h2 className="text-lg font-bold">New Package</h2><button onClick={() => setShowNew(false)}><X size={18} className="text-gray-400" /></button></div>
          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2"><label className="text-[10px] text-gray-500 uppercase font-semibold">Name *</label><input className="w-full mt-1 px-3 py-2 border rounded-xl text-sm" value={f.package_name} onChange={e => setF(v => ({ ...v, package_name: e.target.value }))} /></div>
            <div><label className="text-[10px] text-gray-500 uppercase font-semibold">Department</label><select className="w-full mt-1 px-3 py-2 border rounded-xl text-sm" value={f.department} onChange={e => setF(v => ({ ...v, department: e.target.value }))}><option value="">Select</option>{['Cardiology', 'Orthopaedics', 'Neurology', 'General Surgery', 'Urology', 'Gynaecology', 'ENT', 'Ophthalmology', 'Gastroenterology'].map(d => <option key={d}>{d}</option>)}</select></div>
            <div><label className="text-[10px] text-gray-500 uppercase font-semibold">Category</label><select className="w-full mt-1 px-3 py-2 border rounded-xl text-sm" value={f.category} onChange={e => setF(v => ({ ...v, category: e.target.value }))}>{['surgical', 'medical', 'daycare', 'diagnostic', 'maternity'].map(c => <option key={c} value={c}>{c}</option>)}</select></div>
            <div><label className="text-[10px] text-gray-500 uppercase font-semibold">Self Rate ₹ *</label><input type="number" className="w-full mt-1 px-3 py-2 border rounded-xl text-sm" value={f.package_rate} onChange={e => setF(v => ({ ...v, package_rate: e.target.value }))} /></div>
            <div><label className="text-[10px] text-gray-500 uppercase font-semibold">Insurance ₹</label><input type="number" className="w-full mt-1 px-3 py-2 border rounded-xl text-sm" value={f.rate_insurance} onChange={e => setF(v => ({ ...v, rate_insurance: e.target.value }))} /></div>
            <div><label className="text-[10px] text-gray-500 uppercase font-semibold">PMJAY ₹</label><input type="number" className="w-full mt-1 px-3 py-2 border rounded-xl text-sm" value={f.rate_pmjay} onChange={e => setF(v => ({ ...v, rate_pmjay: e.target.value }))} /></div>
            <div><label className="text-[10px] text-gray-500 uppercase font-semibold">LOS (days)</label><input type="number" className="w-full mt-1 px-3 py-2 border rounded-xl text-sm" value={f.los_days} onChange={e => setF(v => ({ ...v, los_days: e.target.value }))} /></div>
          </div>
          <button onClick={handleCreate} disabled={!f.package_name || !f.package_rate} className="w-full py-2.5 bg-teal-600 text-white text-sm rounded-xl font-semibold disabled:opacity-40">Create</button>
        </div>
      </div>}
    </div>
  );
}
export default function PackagesPage() { return <RoleGuard module="billing"><PkgInner /></RoleGuard>; }
