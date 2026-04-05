'use client';
import React, { useState, useMemo } from 'react';
import { RoleGuard } from '@/components/ui/shared';
import { useAuthStore } from '@/lib/store/auth';
import { usePackages, CATEGORIES, ROOMS, RATE_TYPES, INCLUSION_CATS } from '@/lib/packages/packages-hooks';

const fmt = (n: number) => Math.round(n).toLocaleString('en-IN');
const INR = (n: number) => n >= 100000 ? `₹${(n / 100000).toFixed(1)}L` : `₹${fmt(n)}`;
const CAT_COLORS: Record<string, string> = { surgical: 'bg-red-100 text-red-700', medical: 'bg-blue-100 text-blue-700', daycare: 'bg-green-100 text-green-700', diagnostic: 'bg-purple-100 text-purple-700', maternity: 'bg-amber-100 text-amber-700', trauma: 'bg-orange-100 text-orange-700', transplant: 'bg-teal-100 text-teal-700', robotic: 'bg-indigo-100 text-indigo-700', cardiac: 'bg-red-100 text-red-700', neuro: 'bg-cyan-100 text-cyan-700' };

type Tab = 'packages' | 'utilization' | 'analytics';

function PkgInner() {
  const { staff, activeCentreId } = useAuthStore();
  const centreId = activeCentreId || '';
  const pkg = usePackages(centreId);
  const [tab, setTab] = useState<Tab>('packages');
  const [search, setSearch] = useState('');
  const [catFilter, setCatFilter] = useState('all');
  const [showNew, setShowNew] = useState(false);
  const [showDetail, setShowDetail] = useState<any>(null);
  const [toast, setToast] = useState('');
  const flash = (m: string) => { setToast(m); setTimeout(() => setToast(''), 3000); };

  const [f, setF] = useState({
    package_name: '', department: '', category: 'surgical', procedure_name: '', icd_code: '',
    package_rate: '', rate_insurance: '', rate_pmjay: '', rate_cghs: '',
    los_days: '3', room_category: 'general',
    surgeon_fee: '', anaesthetist_fee: '', assistant_fee: '',
    exclusions: '', notes: '',
    inclusions: [] as { category: string; description: string; amount: number }[],
  });

  const [incForm, setIncForm] = useState({ category: 'room', description: '', amount: '' });
  const addInclusion = () => {
    if (!incForm.description) return;
    setF(p => ({ ...p, inclusions: [...p.inclusions, { ...incForm, amount: parseFloat(incForm.amount) || 0 }] }));
    setIncForm({ category: 'room', description: '', amount: '' });
  };

  const handleCreate = async () => {
    if (!f.package_name || !f.package_rate) return;
    const res = await pkg.createPackage({
      package_name: f.package_name, department: f.department, category: f.category,
      procedure_name: f.procedure_name, icd_code: f.icd_code,
      package_rate: parseFloat(f.package_rate), rate_insurance: f.rate_insurance ? parseFloat(f.rate_insurance) : null,
      rate_pmjay: f.rate_pmjay ? parseFloat(f.rate_pmjay) : null, rate_cghs: f.rate_cghs ? parseFloat(f.rate_cghs) : null,
      los_days: parseInt(f.los_days) || 3, room_category: f.room_category,
      surgeon_fee: parseFloat(f.surgeon_fee) || 0, anaesthetist_fee: parseFloat(f.anaesthetist_fee) || 0,
      assistant_fee: parseFloat(f.assistant_fee) || 0,
      inclusions: f.inclusions, exclusions: f.exclusions ? f.exclusions.split(',').map(s => s.trim()) : [],
      notes: f.notes, gross_amount: parseFloat(f.package_rate), net_amount: parseFloat(f.package_rate),
      name: f.package_name,
    }, staff?.id || '');
    if (res.success) { flash('Package created'); setShowNew(false); } else { flash(res.error || 'Operation failed'); }
  };

  const filtered = useMemo(() => {
    let list = pkg.packages;
    if (catFilter !== 'all') list = list.filter(p => p.category === catFilter);
    if (search) list = list.filter(p => p.package_name?.toLowerCase().includes(search.toLowerCase()) || p.procedure_name?.toLowerCase().includes(search.toLowerCase()));
    return list;
  }, [pkg.packages, catFilter, search]);

  return (
    <div className="max-w-7xl mx-auto space-y-4">
      {toast && <div className="fixed top-4 left-1/2 -translate-x-1/2 z-50 bg-emerald-600 text-white px-4 py-2 rounded-xl shadow-lg text-sm font-medium">{toast}</div>}

      <div className="flex items-center justify-between">
        <div><h1 className="text-xl font-bold">Packages & Accounting</h1><p className="text-xs text-gray-500">{pkg.stats.total} packages · {pkg.stats.activeUtils} active utilizations</p></div>
        <button onClick={() => setShowNew(true)} className="px-4 py-2 bg-teal-600 text-white text-xs rounded-lg font-medium hover:bg-teal-700 cursor-pointer">+ New Package</button>
      </div>

      <div className="grid grid-cols-4 lg:grid-cols-8 gap-2">
        {[
          { l: 'Total Pkgs', v: pkg.stats.total }, { l: 'Active Cases', v: pkg.stats.activeUtils },
          { l: 'Completed', v: pkg.stats.completedUtils },
          { l: 'Avg Margin', v: pkg.stats.avgVariancePct + '%', warn: parseFloat(pkg.stats.avgVariancePct) < 0 },
          { l: 'Total Variance', v: INR(Math.abs(pkg.stats.totalVariance)), warn: pkg.stats.totalVariance < 0 },
          { l: 'Loss Cases', v: pkg.stats.lossCount, warn: pkg.stats.lossCount > 0 },
          { l: 'Total Loss', v: INR(pkg.stats.totalLoss), warn: pkg.stats.totalLoss > 0 },
          ...Object.entries(pkg.stats.byCategory).slice(0, 1).map(([k, v]) => ({ l: k, v: v as number })),
        ].map(k => <div key={k.l} className={`${(k as any).warn ? 'bg-red-50' : 'bg-white'} rounded-xl border p-2 text-center`}><div className="text-[8px] text-gray-500 leading-tight capitalize">{k.l}</div><div className="text-lg font-bold">{k.v}</div></div>)}
      </div>

      <div className="flex gap-1">
        {(['packages', 'utilization', 'analytics'] as Tab[]).map(t =>
          <button key={t} onClick={() => setTab(t)} className={`px-4 py-2 text-xs font-medium rounded-lg ${tab === t ? 'bg-teal-600 text-white' : 'bg-white border'} cursor-pointer`}>
            {t === 'packages' ? `Packages (${pkg.packages.length})` : t === 'utilization' ? `Utilization (${pkg.utilizations.length})` : 'Analytics'}
          </button>
        )}
      </div>

      {/* PACKAGES TAB */}
      {tab === 'packages' && <>
        <div className="flex gap-2 items-center">
          <input value={search} onChange={e => setSearch(e.target.value)} className="px-3 py-1.5 border rounded-lg text-xs w-64" placeholder="Search packages..." />
          <div className="flex gap-1">{['all', ...CATEGORIES.slice(0, 6)].map(c => <button key={c} onClick={() => setCatFilter(c)} className={`px-2 py-1 text-[10px] rounded-lg capitalize ${catFilter === c ? 'bg-teal-100 text-teal-700 font-bold' : 'bg-white border'} cursor-pointer`}>{c}</button>)}</div>
        </div>
        <div className="bg-white rounded-xl border overflow-x-auto">
          <table className="w-full text-xs"><thead><tr className="bg-gray-50 border-b">
            <th className="p-2 text-left">Code</th><th className="p-2 text-left">Package</th><th className="p-2">Dept</th><th className="p-2">Category</th>
            <th className="p-2">Room</th><th className="p-2">LOS</th>
            <th className="p-2 text-right">Self ₹</th><th className="p-2 text-right">Insurance</th><th className="p-2 text-right">PMJAY</th><th className="p-2 text-right">CGHS</th>
            <th className="p-2 text-right">Surgeon</th><th className="p-2">Details</th>
          </tr></thead><tbody>{filtered.map(p => (
            <tr key={p.id} className="border-b hover:bg-gray-50 cursor-pointer" onClick={() => setShowDetail(p)}>
              <td className="p-2 font-mono text-[10px]">{p.package_code || '—'}</td>
              <td className="p-2"><div className="font-medium">{p.package_name || p.name}</div>{p.procedure_name && <div className="text-[10px] text-gray-400">{p.procedure_name}</div>}</td>
              <td className="p-2 text-center text-[10px]">{p.department || '—'}</td>
              <td className="p-2 text-center"><span className={`text-[9px] px-1.5 py-0.5 rounded capitalize ${CAT_COLORS[p.category] || 'bg-gray-100'}`}>{p.category}</span></td>
              <td className="p-2 text-center capitalize text-[10px]">{p.room_category?.replace('_', ' ')}</td>
              <td className="p-2 text-center">{p.los_days}d</td>
              <td className="p-2 text-right font-bold">₹{fmt(p.package_rate || p.net_amount || 0)}</td>
              <td className="p-2 text-right text-blue-700">{p.rate_insurance ? `₹${fmt(p.rate_insurance)}` : '—'}</td>
              <td className="p-2 text-right text-green-700">{p.rate_pmjay ? `₹${fmt(p.rate_pmjay)}` : '—'}</td>
              <td className="p-2 text-right text-purple-700">{p.rate_cghs ? `₹${fmt(p.rate_cghs)}` : '—'}</td>
              <td className="p-2 text-right text-[10px]">{p.surgeon_fee ? `₹${fmt(p.surgeon_fee)}` : '—'}</td>
              <td className="p-2 text-center">{(p.inclusions || []).length > 0 ? <span className="text-[9px] bg-blue-50 text-blue-700 px-1.5 py-0.5 rounded">{(p.inclusions || []).length} items</span> : '—'}</td>
            </tr>
          ))}{filtered.length === 0 && <tr><td colSpan={12} className="text-center py-12 text-gray-400">No packages</td></tr>}</tbody></table>
        </div>
      </>}

      {/* UTILIZATION TAB */}
      {tab === 'utilization' && (pkg.utilizations.length === 0 ? <div className="text-center py-12 bg-white rounded-xl border text-gray-400 text-sm">No package utilizations</div> :
        <div className="bg-white rounded-xl border overflow-x-auto">
          <table className="w-full text-xs"><thead><tr className="bg-gray-50 border-b">
            <th className="p-2 text-left">Patient</th><th className="p-2">Package</th><th className="p-2">Rate Type</th>
            <th className="p-2 text-right">Pkg Rate</th><th className="p-2 text-right">Actual</th><th className="p-2 text-right">Variance</th>
            <th className="p-2">LOS</th><th className="p-2 text-right">Over-Pkg</th><th className="p-2">Status</th>
          </tr></thead><tbody>{pkg.utilizations.map(u => {
            const isLoss = (u.variance || 0) < 0;
            return (
              <tr key={u.id} className={`border-b ${isLoss ? 'bg-red-50/30' : ''}`}>
                <td className="p-2"><div className="font-medium">{u.patient_name}</div><div className="text-[10px] text-gray-400">{u.uhid}</div></td>
                <td className="p-2 text-[10px]">{u.pkg_name} <span className="text-gray-400">{u.pkg_code}</span></td>
                <td className="p-2 text-center"><span className="text-[9px] bg-gray-100 px-1.5 py-0.5 rounded uppercase">{u.rate_type}</span></td>
                <td className="p-2 text-right font-bold">₹{fmt(u.package_rate)}</td>
                <td className="p-2 text-right">₹{fmt(u.actual_total || 0)}</td>
                <td className="p-2 text-right"><span className={`font-bold ${isLoss ? 'text-red-600' : 'text-green-600'}`}>{isLoss ? '-' : '+'}₹{fmt(Math.abs(u.variance || 0))}</span><div className="text-[9px] text-gray-400">{u.variance_pct?.toFixed(1)}%</div></td>
                <td className="p-2 text-center">{u.actual_los || '—'}/{u.expected_los}d {u.overstay_days > 0 && <span className="text-[9px] text-red-600 font-bold">+{u.overstay_days}</span>}</td>
                <td className="p-2 text-right">{u.over_package_amount > 0 ? <span className="text-amber-600 font-bold">₹{fmt(u.over_package_amount)}</span> : '—'}</td>
                <td className="p-2 text-center"><span className={`text-[9px] px-1.5 py-0.5 rounded ${u.status === 'completed' ? 'bg-green-100 text-green-700' : u.status === 'active' ? 'bg-blue-100 text-blue-700' : 'bg-gray-100'}`}>{u.status}</span></td>
              </tr>
            );
          })}</tbody></table>
        </div>
      )}

      {/* ANALYTICS TAB */}
      {tab === 'analytics' && <div className="grid grid-cols-2 gap-4">
        <div className="bg-white rounded-xl border p-5 space-y-2">
          <h3 className="text-sm font-bold">Category breakdown</h3>
          {Object.entries(pkg.stats.byCategory).sort((a: any, b: any) => b[1] - a[1]).map(([cat, count]) => (
            <div key={cat} className="flex items-center gap-3">
              <span className={`text-[9px] px-1.5 py-0.5 rounded capitalize w-20 text-center ${CAT_COLORS[cat] || 'bg-gray-100'}`}>{cat}</span>
              <div className="flex-1 h-2.5 bg-gray-100 rounded-full overflow-hidden"><div className="h-full bg-teal-500 rounded-full" style={{ width: `${((count as number) / Math.max(1, pkg.stats.total)) * 100}%` }} /></div>
              <span className="text-xs font-bold w-6 text-right">{count as number}</span>
            </div>
          ))}
        </div>
        <div className="bg-white rounded-xl border p-5 space-y-2">
          <h3 className="text-sm font-bold">Utilization performance</h3>
          <div className="text-xs space-y-2">
            <div className="flex justify-between"><span>Completed packages</span><b>{pkg.stats.completedUtils}</b></div>
            <div className="flex justify-between"><span>Avg margin</span><b className={parseFloat(pkg.stats.avgVariancePct) < 0 ? 'text-red-600' : 'text-green-600'}>{pkg.stats.avgVariancePct}%</b></div>
            <div className="flex justify-between"><span>Net variance</span><b className={pkg.stats.totalVariance < 0 ? 'text-red-600' : 'text-green-600'}>{pkg.stats.totalVariance >= 0 ? '+' : '-'}₹{fmt(Math.abs(pkg.stats.totalVariance))}</b></div>
            <div className="flex justify-between"><span>Loss-making cases</span><b className="text-red-600">{pkg.stats.lossCount}</b></div>
          </div>
        </div>
      </div>}

      {/* NEW PACKAGE MODAL */}
      {showNew && <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center" onClick={() => setShowNew(false)}>
        <div className="bg-white rounded-xl w-[650px] max-h-[90vh] overflow-y-auto p-5 space-y-4" onClick={e => e.stopPropagation()}>
          <div className="flex justify-between"><h3 className="font-bold text-sm">New package</h3><button onClick={() => setShowNew(false)} className="text-gray-400 text-lg cursor-pointer">×</button></div>
          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2"><label className="text-[9px] text-gray-500">Package name *</label><input value={f.package_name} onChange={e => setF(p => ({...p, package_name: e.target.value}))} className="w-full px-3 py-2 border rounded-lg text-sm" placeholder="e.g. Laparoscopic Cholecystectomy — General Ward" /></div>
            <div><label className="text-[9px] text-gray-500">Procedure</label><input value={f.procedure_name} onChange={e => setF(p => ({...p, procedure_name: e.target.value}))} className="w-full px-3 py-2 border rounded-lg text-sm" placeholder="e.g. Lap Chole" /></div>
            <div><label className="text-[9px] text-gray-500">Department</label><select value={f.department} onChange={e => setF(p => ({...p, department: e.target.value}))} className="w-full px-3 py-2 border rounded-lg text-sm"><option value="">Select</option>{['Cardiology','Orthopaedics','Neurology','Neurosurgery','General Surgery','CTVS','Urology','Gynaecology','ENT','Ophthalmology','Gastroenterology','Nephrology','Oncology'].map(d => <option key={d}>{d}</option>)}</select></div>
            <div><label className="text-[9px] text-gray-500">Category</label><select value={f.category} onChange={e => setF(p => ({...p, category: e.target.value}))} className="w-full px-3 py-2 border rounded-lg text-sm">{CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}</select></div>
            <div><label className="text-[9px] text-gray-500">Room</label><select value={f.room_category} onChange={e => setF(p => ({...p, room_category: e.target.value}))} className="w-full px-3 py-2 border rounded-lg text-sm">{ROOMS.map(r => <option key={r} value={r}>{r.replace('_', ' ')}</option>)}</select></div>
            <div><label className="text-[9px] text-gray-500">LOS (days)</label><input type="number" value={f.los_days} onChange={e => setF(p => ({...p, los_days: e.target.value}))} className="w-full px-3 py-2 border rounded-lg text-sm" /></div>
            <div><label className="text-[9px] text-gray-500">ICD code</label><input value={f.icd_code} onChange={e => setF(p => ({...p, icd_code: e.target.value}))} className="w-full px-3 py-2 border rounded-lg text-sm" placeholder="K80.2" /></div>
          </div>
          <div className="bg-blue-50 rounded-lg p-3 space-y-2">
            <h4 className="text-xs font-bold text-blue-800">Rate tiers</h4>
            <div className="grid grid-cols-4 gap-2">
              <div><label className="text-[9px] text-gray-500">Self ₹ *</label><input type="number" value={f.package_rate} onChange={e => setF(p => ({...p, package_rate: e.target.value}))} className="w-full px-2 py-1.5 border rounded text-xs" /></div>
              <div><label className="text-[9px] text-gray-500">Insurance ₹</label><input type="number" value={f.rate_insurance} onChange={e => setF(p => ({...p, rate_insurance: e.target.value}))} className="w-full px-2 py-1.5 border rounded text-xs" /></div>
              <div><label className="text-[9px] text-gray-500">PMJAY ₹</label><input type="number" value={f.rate_pmjay} onChange={e => setF(p => ({...p, rate_pmjay: e.target.value}))} className="w-full px-2 py-1.5 border rounded text-xs" /></div>
              <div><label className="text-[9px] text-gray-500">CGHS ₹</label><input type="number" value={f.rate_cghs} onChange={e => setF(p => ({...p, rate_cghs: e.target.value}))} className="w-full px-2 py-1.5 border rounded text-xs" /></div>
            </div>
          </div>
          <div className="bg-green-50 rounded-lg p-3 space-y-2">
            <h4 className="text-xs font-bold text-green-800">Doctor fees (within package)</h4>
            <div className="grid grid-cols-3 gap-2">
              <div><label className="text-[9px] text-gray-500">Surgeon ₹</label><input type="number" value={f.surgeon_fee} onChange={e => setF(p => ({...p, surgeon_fee: e.target.value}))} className="w-full px-2 py-1.5 border rounded text-xs" /></div>
              <div><label className="text-[9px] text-gray-500">Anaesthetist ₹</label><input type="number" value={f.anaesthetist_fee} onChange={e => setF(p => ({...p, anaesthetist_fee: e.target.value}))} className="w-full px-2 py-1.5 border rounded text-xs" /></div>
              <div><label className="text-[9px] text-gray-500">Assistant ₹</label><input type="number" value={f.assistant_fee} onChange={e => setF(p => ({...p, assistant_fee: e.target.value}))} className="w-full px-2 py-1.5 border rounded text-xs" /></div>
            </div>
          </div>
          <div className="space-y-2">
            <h4 className="text-xs font-bold">Inclusions ({f.inclusions.length})</h4>
            {f.inclusions.map((inc, i) => <div key={i} className="flex items-center gap-2 bg-gray-50 rounded px-2 py-1 text-xs"><span className="text-gray-400 capitalize">{inc.category}</span><span className="font-medium">{inc.description}</span><span className="ml-auto font-bold">₹{fmt(inc.amount)}</span></div>)}
            <div className="grid grid-cols-4 gap-2">
              <select value={incForm.category} onChange={e => setIncForm(f => ({...f, category: e.target.value}))} className="px-2 py-1.5 border rounded text-[10px]">{INCLUSION_CATS.map(c => <option key={c} value={c}>{c}</option>)}</select>
              <input value={incForm.description} onChange={e => setIncForm(f => ({...f, description: e.target.value}))} className="px-2 py-1.5 border rounded text-[10px] col-span-2" placeholder="Description" />
              <div className="flex gap-1"><input type="number" value={incForm.amount} onChange={e => setIncForm(f => ({...f, amount: e.target.value}))} className="w-full px-2 py-1.5 border rounded text-[10px]" placeholder="₹" /><button onClick={addInclusion} className="px-2 bg-teal-600 text-white rounded text-[10px] cursor-pointer">+</button></div>
            </div>
          </div>
          <div><label className="text-[9px] text-gray-500">Exclusions (comma-separated)</label><input value={f.exclusions} onChange={e => setF(p => ({...p, exclusions: e.target.value}))} className="w-full px-3 py-2 border rounded-lg text-sm" placeholder="Implant cost, Blood products, ICU stay, Extended stay" /></div>
          <button onClick={handleCreate} disabled={!f.package_name || !f.package_rate} className="w-full py-2.5 bg-teal-600 text-white text-sm rounded-lg font-medium disabled:opacity-40 cursor-pointer">Create Package</button>
        </div>
      </div>}

      {/* DETAIL DRAWER */}
      {showDetail && <div className="fixed inset-0 bg-black/50 z-50 flex justify-end" onClick={() => setShowDetail(null)}>
        <div className="w-[500px] bg-white h-full overflow-y-auto shadow-xl p-5 space-y-4" onClick={e => e.stopPropagation()}>
          <div className="flex justify-between"><h3 className="font-bold text-sm">{showDetail.package_name || showDetail.name}</h3><button onClick={() => setShowDetail(null)} className="text-gray-400 text-lg cursor-pointer">×</button></div>
          <div className="flex gap-2"><span className={`text-[9px] px-1.5 py-0.5 rounded capitalize ${CAT_COLORS[showDetail.category] || 'bg-gray-100'}`}>{showDetail.category}</span><span className="text-[9px] bg-gray-100 px-1.5 py-0.5 rounded capitalize">{showDetail.room_category?.replace('_', ' ')} · {showDetail.los_days}d</span></div>
          <div className="grid grid-cols-2 gap-3 text-xs">
            {[['Self', showDetail.package_rate], ['Insurance', showDetail.rate_insurance], ['PMJAY', showDetail.rate_pmjay], ['CGHS', showDetail.rate_cghs]].map(([label, val]) => val && <div key={label as string}><span className="text-gray-400">{label}</span>: <b>₹{fmt(val as number)}</b></div>)}
          </div>
          {showDetail.surgeon_fee > 0 && <div className="text-xs"><b>Doctor fees:</b> Surgeon ₹{fmt(showDetail.surgeon_fee)} + Anaesth ₹{fmt(showDetail.anaesthetist_fee || 0)}{showDetail.assistant_fee > 0 ? ` + Asst ₹${fmt(showDetail.assistant_fee)}` : ''}</div>}
          {(showDetail.inclusions || []).length > 0 && <div><h4 className="text-xs font-bold mb-1">Inclusions</h4>{showDetail.inclusions.map((inc: any, i: number) => <div key={i} className="flex justify-between text-xs bg-gray-50 rounded px-2 py-1 mb-0.5"><span><span className="text-gray-400 capitalize">{inc.category}</span> — {inc.description}</span><b>₹{fmt(inc.amount)}</b></div>)}</div>}
          {(showDetail.exclusions || []).length > 0 && <div><h4 className="text-xs font-bold mb-1 text-red-600">Exclusions</h4><div className="flex gap-1 flex-wrap">{showDetail.exclusions.map((ex: string, i: number) => <span key={i} className="text-[9px] bg-red-50 text-red-600 px-1.5 py-0.5 rounded">{ex}</span>)}</div></div>}
        </div>
      </div>}
    </div>
  );
}

export default function PackagesPage() { return <RoleGuard module="billing"><PkgInner /></RoleGuard>; }
