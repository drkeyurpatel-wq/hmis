'use client';
import React, { useState, useMemo } from 'react';
import { RoleGuard } from '@/components/ui/shared';
import { useAuthStore } from '@/lib/store/auth';
import { useAssets } from '@/lib/assets/asset-hooks';
import { Plus, X, Search, Package, AlertTriangle, Download } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';

const fmt = (n: number) => Math.round(n).toLocaleString('en-IN');
const INR = (n: number) => n >= 10000000 ? `₹${(n / 10000000).toFixed(2)}Cr` : n >= 100000 ? `₹${(n / 100000).toFixed(1)}L` : `₹${fmt(n)}`;
const CAT_COLORS: Record<string, string> = { medical_equipment: '#0d9488', it_hardware: '#3b82f6', furniture: '#f59e0b', surgical_instrument: '#ef4444', electrical: '#8b5cf6', vehicle: '#06b6d4', building: '#475569', other: '#94a3b8' };
const STATUS_BADGE: Record<string, string> = { in_use: 'inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-50 text-emerald-700', in_storage: 'inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold bg-blue-50 text-blue-700', under_maintenance: 'inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold bg-amber-50 text-amber-700', condemned: 'inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold bg-red-50 text-red-700', disposed: 'inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold bg-gray-100 text-gray-600', lost: 'inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold bg-red-50 text-red-700', transferred: 'inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold bg-purple-50 text-purple-700' };
const COND_BADGE: Record<string, string> = { new: 'inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-50 text-emerald-700', good: 'inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-50 text-emerald-700', fair: 'inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold bg-amber-50 text-amber-700', poor: 'inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold bg-red-50 text-red-700', non_functional: 'inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold bg-red-50 text-red-700' };

type Tab = 'registry' | 'analytics';

function AssetInner() {
  const { staff, activeCentreId } = useAuthStore();
  const centreId = activeCentreId || '';
  const staffId = staff?.id || '';
  const ast = useAssets(centreId);
  const [tab, setTab] = useState<Tab>('registry');
  const [showNew, setShowNew] = useState(false);
  const [toast, setToast] = useState('');
  const flash = (m: string) => { setToast(m); setTimeout(() => setToast(''), 3000); };
  const [catFilter, setCatFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [search, setSearch] = useState('');

  const [form, setForm] = useState({ asset_tag: '', name: '', category: 'medical_equipment', department: '', location: '', brand: '', model: '', serial_number: '', purchase_date: '', purchase_cost: '', vendor: '', warranty_expiry: '', useful_life_years: '10', salvage_value: '0' });

  const handleCreate = async () => {
    if (!form.asset_tag || !form.name) return;
    const res = await ast.create({
      ...form,
      purchase_cost: form.purchase_cost ? parseFloat(form.purchase_cost) : null,
      useful_life_years: parseInt(form.useful_life_years) || 10,
      salvage_value: form.salvage_value ? parseFloat(form.salvage_value) : 0,
      purchase_date: form.purchase_date || null,
      warranty_expiry: form.warranty_expiry || null,
    });
    if (res.success) { flash('Asset registered'); setShowNew(false); } else { flash(res.error || 'Operation failed'); }
  };

  // eslint-disable-next-line react-hooks/exhaustive-deps
  const catData = useMemo(() => Object.entries(ast.stats.byCategory).map(([k, v]: any) => ({ name: k.replace(/_/g, ' '), count: v.count, value: v.value, fill: CAT_COLORS[k] || '#94a3b8' })).sort((a, b) => b.value - a.value), [ast.stats]);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const deptData = useMemo(() => Object.entries(ast.stats.byDepartment).sort((a: any, b: any) => b[1] - a[1]).slice(0, 10).map(([k, v]) => ({ dept: k, count: v as number })), [ast.stats]);

  return (
    <div className="max-w-[1400px] mx-auto space-y-4">
      {toast && <div className="fixed top-4 left-1/2 -translate-x-1/2 z-50 bg-teal-600 text-white px-5 py-2.5 rounded-xl shadow-lg text-sm font-medium">{toast}</div>}

      <div className="flex items-center justify-between">
        <div><h1 className="text-xl font-bold tracking-tight">Asset Management</h1><p className="text-xs text-gray-400">{ast.stats.totalAssets} assets · {INR(ast.stats.totalBook)} book value</p></div>
        <button onClick={() => setShowNew(true)} className="flex items-center gap-2 px-4 py-2.5 bg-teal-600 text-white text-sm rounded-xl font-semibold hover:bg-teal-700"><Plus size={15} /> Register Asset</button>
      </div>

      <div className="grid grid-cols-8 gap-2">
        {[
          { l: 'Total Assets', v: ast.stats.totalAssets, c: 'text-gray-800' },
          { l: 'Cost', v: INR(ast.stats.totalCost), c: 'text-gray-800' },
          { l: 'Book Value', v: INR(ast.stats.totalBook), c: 'text-teal-700' },
          { l: 'Depreciation', v: INR(ast.stats.totalDepreciation), c: 'text-red-600' },
          { l: 'In Use', v: ast.stats.inUse, c: 'text-emerald-700' },
          { l: 'Maintenance', v: ast.stats.maintenance, c: 'text-amber-700' },
          { l: 'AMC Expiring', v: ast.stats.amcExpiring, c: ast.stats.amcExpiring > 0 ? 'text-amber-700' : 'text-gray-400' },
          { l: 'AMC Expired', v: ast.stats.amcExpired, c: ast.stats.amcExpired > 0 ? 'text-red-600' : 'text-gray-400' },
        ].map(s => (
          <div key={s.l} className="bg-white rounded-xl border px-3 py-3 text-center"><div className="text-[9px] text-gray-400 uppercase font-semibold">{s.l}</div><div className={`text-lg font-black ${s.c}`}>{s.v}</div></div>
        ))}
      </div>

      <div className="flex gap-1">{(['registry', 'analytics'] as Tab[]).map(t => (
        <button key={t} onClick={() => setTab(t)} className={`px-3.5 py-2 text-xs font-medium rounded-xl capitalize ${tab === t ? 'bg-teal-600 text-white shadow-sm' : 'bg-white text-gray-500 border border-gray-100'}`}>{t}</button>
      ))}</div>

      {/* REGISTRY */}
      {tab === 'registry' && (
        <div className="bg-white rounded-2xl border overflow-hidden">
          <div className="px-4 py-3 border-b flex items-center gap-3 flex-wrap">
            <div className="relative flex-1 max-w-xs"><Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input value={search} onChange={e => { setSearch(e.target.value); ast.load({ search: e.target.value, category: catFilter, status: statusFilter }); }} className="w-full pl-9 pr-3 py-2 text-xs border rounded-lg" placeholder="Search name, tag, serial..." /></div>
            <select value={catFilter} onChange={e => { setCatFilter(e.target.value); ast.load({ category: e.target.value, status: statusFilter, search }); }} className="px-2.5 py-1.5 text-[10px] border rounded-lg">
              <option value="all">All Categories</option>{Object.keys(CAT_COLORS).map(c => <option key={c} value={c}>{c.replace(/_/g, ' ')}</option>)}</select>
            <select value={statusFilter} onChange={e => { setStatusFilter(e.target.value); ast.load({ category: catFilter, status: e.target.value, search }); }} className="px-2.5 py-1.5 text-[10px] border rounded-lg">
              <option value="all">All Status</option>{['in_use', 'in_storage', 'under_maintenance', 'condemned'].map(s => <option key={s} value={s}>{s.replace(/_/g, ' ')}</option>)}</select>
            <span className="text-[10px] text-gray-400 ml-auto">{ast.assets.length} assets</span>
          </div>
          <table className="w-full text-xs"><thead><tr><th>Tag</th><th>Asset</th><th>Category</th><th>Department</th><th>Location</th><th className="text-right">Cost</th><th className="text-right">Book Value</th><th>Warranty</th><th>Condition</th><th>Status</th></tr></thead>
            <tbody>{ast.assets.map(a => {
              const today = new Date().toISOString().split('T')[0];
              const warrantyExpired = a.warranty_expiry && a.warranty_expiry < today;
              const amcExpired = a.amc_expiry && a.amc_expiry < today;
              return (
                <tr key={a.id} className={warrantyExpired || amcExpired ? 'bg-amber-50/30' : ''}>
                  <td className="font-mono text-[10px] font-bold">{a.asset_tag}</td>
                  <td><div className="font-semibold">{a.name}</div><div className="text-[10px] text-gray-400">{a.brand} {a.model} {a.serial_number ? `· S/N: ${a.serial_number}` : ''}</div></td>
                  <td><span className="text-[10px] font-medium capitalize" style={{ color: CAT_COLORS[a.category] || '#475569' }}>{a.category?.replace(/_/g, ' ')}</span></td>
                  <td className="text-[11px]">{a.department || '—'}</td>
                  <td className="text-[11px] text-gray-500">{a.location || '—'}</td>
                  <td className="text-right text-[11px]">{a.purchase_cost ? `₹${fmt(a.purchase_cost)}` : '—'}</td>
                  <td className="text-right font-semibold text-[11px]">{a.current_book_value ? `₹${fmt(a.current_book_value)}` : '—'}</td>
                  <td className="text-[10px]">{a.warranty_expiry ? <span className={warrantyExpired ? 'text-red-600 font-bold' : ''}>{new Date(a.warranty_expiry).toLocaleDateString('en-IN', { month: 'short', year: '2-digit' })}</span> : '—'}{amcExpired && <div className="text-[8px] text-red-500 font-bold">AMC EXPIRED</div>}</td>
                  <td><span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold ${COND_BADGE[a.condition] || 'inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold bg-gray-100 text-gray-600'} capitalize text-[8px]`}>{a.condition}</span></td>
                  <td><span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold ${STATUS_BADGE[a.status] || 'inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold bg-gray-100 text-gray-600'} capitalize text-[8px]`}>{a.status?.replace(/_/g, ' ')}</span></td>
                </tr>
              );
            })}{ast.assets.length === 0 && <tr><td colSpan={10} className="text-center py-12 text-gray-400">No assets found</td></tr>}</tbody>
          </table>
        </div>
      )}

      {/* ANALYTICS */}
      {tab === 'analytics' && (
        <div className="grid grid-cols-2 gap-4">
          <div className="bg-white rounded-2xl border p-5">
            <h3 className="text-sm font-bold mb-3">Assets by Category (Value)</h3>
            {catData.length > 0 ? (
              <div className="flex items-center gap-4">
                <ResponsiveContainer width={140} height={140}><PieChart><Pie data={catData} dataKey="value" cx="50%" cy="50%" innerRadius={35} outerRadius={60} paddingAngle={3} strokeWidth={0}>{catData.map((d, i) => <Cell key={i} fill={d.fill} />)}</Pie></PieChart></ResponsiveContainer>
                <div className="flex-1 space-y-2">{catData.slice(0, 6).map(d => (
                  <div key={d.name} className="flex items-center justify-between">
                    <div className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full" style={{ background: d.fill }} /><span className="text-[10px] capitalize">{d.name}</span></div>
                    <div className="text-right"><span className="text-[10px] font-bold">{INR(d.value)}</span><span className="text-[9px] text-gray-400 ml-1">({d.count})</span></div>
                  </div>
                ))}</div>
              </div>
            ) : <div className="text-center py-8 text-gray-300 text-xs">No data</div>}
          </div>
          <div className="bg-white rounded-2xl border p-5">
            <h3 className="text-sm font-bold mb-3">Assets by Department</h3>
            {deptData.length > 0 ? (
              <ResponsiveContainer width="100%" height={180}><BarChart data={deptData} layout="vertical" margin={{ left: 0, right: 5 }}>
                <XAxis type="number" tick={{ fontSize: 9 }} axisLine={false} tickLine={false} />
                <YAxis type="category" dataKey="dept" tick={{ fontSize: 9, fill: '#64748b' }} width={80} axisLine={false} tickLine={false} />
                <Bar dataKey="count" fill="#0d9488" radius={[0, 4, 4, 0]} barSize={14} />
              </BarChart></ResponsiveContainer>
            ) : <div className="text-center py-8 text-gray-300 text-xs">No data</div>}
          </div>
          {/* Depreciation summary */}
          <div className="col-span-2 bg-white rounded-2xl border p-5">
            <h3 className="text-sm font-bold mb-3">Depreciation Summary</h3>
            <div className="grid grid-cols-4 gap-4 text-center">
              <div><div className="text-[9px] text-gray-400 uppercase font-semibold">Total Purchase Cost</div><div className="text-xl font-black text-gray-800">{INR(ast.stats.totalCost)}</div></div>
              <div><div className="text-[9px] text-gray-400 uppercase font-semibold">Current Book Value</div><div className="text-xl font-black text-teal-700">{INR(ast.stats.totalBook)}</div></div>
              <div><div className="text-[9px] text-gray-400 uppercase font-semibold">Accumulated Depreciation</div><div className="text-xl font-black text-red-600">{INR(ast.stats.totalDepreciation)}</div></div>
              <div><div className="text-[9px] text-gray-400 uppercase font-semibold">Depreciation %</div><div className="text-xl font-black text-amber-700">{ast.stats.totalCost > 0 ? Math.round((ast.stats.totalDepreciation / ast.stats.totalCost) * 100) : 0}%</div></div>
            </div>
            <div className="h-3 bg-gray-100 rounded-full mt-4 overflow-hidden flex">
              <div className="h-full bg-teal-500 rounded-l-full" style={{ width: `${ast.stats.totalCost > 0 ? (ast.stats.totalBook / ast.stats.totalCost) * 100 : 100}%` }} />
              <div className="h-full bg-red-400 rounded-r-full flex-1" />
            </div>
            <div className="flex justify-between mt-1 text-[9px] text-gray-400"><span>Book Value</span><span>Depreciation</span></div>
          </div>
        </div>
      )}

      {/* NEW ASSET MODAL */}
      {showNew && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4" onClick={() => setShowNew(false)}>
          <div className="bg-white rounded-2xl w-full max-w-2xl p-6 space-y-3 max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <div className="flex justify-between"><h2 className="text-lg font-bold">Register Asset</h2><button onClick={() => setShowNew(false)}><X size={18} className="text-gray-400" /></button></div>
            <div className="grid grid-cols-3 gap-3">
              <div><label className="text-[10px] text-gray-500 uppercase font-semibold">Asset Tag *</label><input className="w-full mt-1 px-3 py-2 border rounded-xl text-sm" value={form.asset_tag} onChange={e => setForm(f => ({ ...f, asset_tag: e.target.value }))} placeholder="e.g. H1-MED-0001" /></div>
              <div className="col-span-2"><label className="text-[10px] text-gray-500 uppercase font-semibold">Name *</label><input className="w-full mt-1 px-3 py-2 border rounded-xl text-sm" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} /></div>
              <div><label className="text-[10px] text-gray-500 uppercase font-semibold">Category</label><select className="w-full mt-1 px-3 py-2 border rounded-xl text-sm" value={form.category} onChange={e => setForm(f => ({ ...f, category: e.target.value }))}>{Object.keys(CAT_COLORS).map(c => <option key={c} value={c}>{c.replace(/_/g, ' ')}</option>)}</select></div>
              <div><label className="text-[10px] text-gray-500 uppercase font-semibold">Department</label><select className="w-full mt-1 px-3 py-2 border rounded-xl text-sm" value={form.department} onChange={e => setForm(f => ({ ...f, department: e.target.value }))}><option value="">Select</option>{['OT', 'ICU', 'Emergency', 'Radiology', 'Laboratory', 'Pharmacy', 'OPD', 'IPD', 'Administration', 'IT', 'Maintenance', 'Kitchen', 'Housekeeping'].map(d => <option key={d}>{d}</option>)}</select></div>
              <div><label className="text-[10px] text-gray-500 uppercase font-semibold">Location</label><input className="w-full mt-1 px-3 py-2 border rounded-xl text-sm" value={form.location} onChange={e => setForm(f => ({ ...f, location: e.target.value }))} /></div>
              <div><label className="text-[10px] text-gray-500 uppercase font-semibold">Brand</label><input className="w-full mt-1 px-3 py-2 border rounded-xl text-sm" value={form.brand} onChange={e => setForm(f => ({ ...f, brand: e.target.value }))} /></div>
              <div><label className="text-[10px] text-gray-500 uppercase font-semibold">Model</label><input className="w-full mt-1 px-3 py-2 border rounded-xl text-sm" value={form.model} onChange={e => setForm(f => ({ ...f, model: e.target.value }))} /></div>
              <div><label className="text-[10px] text-gray-500 uppercase font-semibold">Serial Number</label><input className="w-full mt-1 px-3 py-2 border rounded-xl text-sm" value={form.serial_number} onChange={e => setForm(f => ({ ...f, serial_number: e.target.value }))} /></div>
              <div><label className="text-[10px] text-gray-500 uppercase font-semibold">Purchase Date</label><input type="date" className="w-full mt-1 px-3 py-2 border rounded-xl text-sm" value={form.purchase_date} onChange={e => setForm(f => ({ ...f, purchase_date: e.target.value }))} /></div>
              <div><label className="text-[10px] text-gray-500 uppercase font-semibold">Purchase Cost ₹</label><input type="number" className="w-full mt-1 px-3 py-2 border rounded-xl text-sm" value={form.purchase_cost} onChange={e => setForm(f => ({ ...f, purchase_cost: e.target.value }))} /></div>
              <div><label className="text-[10px] text-gray-500 uppercase font-semibold">Vendor</label><input className="w-full mt-1 px-3 py-2 border rounded-xl text-sm" value={form.vendor} onChange={e => setForm(f => ({ ...f, vendor: e.target.value }))} /></div>
              <div><label className="text-[10px] text-gray-500 uppercase font-semibold">Warranty Expiry</label><input type="date" className="w-full mt-1 px-3 py-2 border rounded-xl text-sm" value={form.warranty_expiry} onChange={e => setForm(f => ({ ...f, warranty_expiry: e.target.value }))} /></div>
              <div><label className="text-[10px] text-gray-500 uppercase font-semibold">Useful Life (years)</label><input type="number" className="w-full mt-1 px-3 py-2 border rounded-xl text-sm" value={form.useful_life_years} onChange={e => setForm(f => ({ ...f, useful_life_years: e.target.value }))} /></div>
              <div><label className="text-[10px] text-gray-500 uppercase font-semibold">Salvage Value ₹</label><input type="number" className="w-full mt-1 px-3 py-2 border rounded-xl text-sm" value={form.salvage_value} onChange={e => setForm(f => ({ ...f, salvage_value: e.target.value }))} /></div>
            </div>
            <button onClick={handleCreate} disabled={!form.asset_tag || !form.name} className="w-full py-2.5 bg-teal-600 text-white text-sm rounded-xl font-semibold disabled:opacity-40 hover:bg-teal-700">Register Asset</button>
          </div>
        </div>
      )}
    </div>
  );
}
export default function AssetPage() { return <RoleGuard module="settings"><AssetInner /></RoleGuard>; }
