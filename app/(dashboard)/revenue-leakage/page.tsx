'use client';
import React, { useState, useEffect, useMemo } from 'react';
import { RoleGuard } from '@/components/ui/shared';
import { useAuthStore } from '@/lib/store/auth';
import { useLeakageScanner, useLeakageActions, LEAK_TYPES, type Leak } from '@/lib/revenue-leakage/leakage-hooks';

const fmt = (n: number) => Math.round(n).toLocaleString('en-IN');
const INR = (n: number) => n >= 100000 ? `₹${(n / 100000).toFixed(1)}L` : `₹${fmt(n)}`;
const SEV_COLORS: Record<string, string> = { critical: 'bg-red-600 text-white', high: 'bg-red-100 text-red-700', medium: 'bg-amber-100 text-amber-700', low: 'bg-gray-100 text-gray-600' };
const SEV_ROW: Record<string, string> = { critical: 'bg-red-50/50 border-l-4 border-l-red-500', high: 'bg-red-50/20', medium: '', low: '' };

function LeakageInner() {
  const { staff, activeCentreId } = useAuthStore();
  const centreId = activeCentreId || '';
  const staffId = staff?.id || '';
  const scanner = useLeakageScanner(centreId);
  const actions = useLeakageActions(centreId);
  const [typeFilter, setTypeFilter] = useState('all');
  const [sevFilter, setSevFilter] = useState('all');
  const [toast, setToast] = useState('');
  const flash = (m: string) => { setToast(m); setTimeout(() => setToast(''), 3000); };

  useEffect(() => { scanner.scan(); }, []);

  const filtered = useMemo(() => {
    let list = scanner.leaks;
    if (typeFilter !== 'all') list = list.filter(l => l.type === typeFilter);
    if (sevFilter !== 'all') list = list.filter(l => l.severity === sevFilter);
    return list;
  }, [scanner.leaks, typeFilter, sevFilter]);

  return (
    <div className="max-w-7xl mx-auto space-y-4">
      <div className="flex items-center justify-between">
        <div><h1 className="text-xl font-bold">Revenue Leakage Detector</h1>
          <p className="text-xs text-gray-500">{scanner.lastScanned ? `Last scan: ${new Date(scanner.lastScanned).toLocaleTimeString('en-IN')}` : 'Scanning...'}</p></div>
        <button onClick={scanner.scan} disabled={scanner.loading} className="px-4 py-2 bg-teal-600 text-white text-xs rounded-lg font-medium hover:bg-teal-700 disabled:opacity-50">
          {scanner.loading ? 'Scanning...' : '↻ Re-scan'}
        </button>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-3 gap-3">
        <div className={`rounded-xl border-2 p-5 text-center ${scanner.stats.totalAmount > 0 ? 'border-red-200 bg-red-50' : 'border-green-200 bg-green-50'}`}>
          <div className={`text-3xl font-black ${scanner.stats.totalAmount > 0 ? 'text-red-600' : 'text-green-600'}`}>{scanner.stats.totalAmount > 0 ? INR(scanner.stats.totalAmount) : '₹0'}</div>
          <div className="text-xs text-gray-500 mt-1">Estimated leakage</div>
        </div>
        <div className="bg-white rounded-xl border p-5 text-center">
          <div className="text-3xl font-black text-amber-700">{scanner.stats.totalLeaks}</div>
          <div className="text-xs text-gray-500 mt-1">Issues found</div>
        </div>
        <div className="bg-white rounded-xl border p-5">
          <div className="text-xs font-bold mb-2">By severity</div>
          <div className="space-y-1.5">
            {Object.entries(scanner.stats.bySeverity).filter(([, v]) => v > 0).map(([sev, count]) =>
              <div key={sev} className="flex items-center justify-between"><span className={`text-[9px] px-1.5 py-0.5 rounded font-medium capitalize ${SEV_COLORS[sev]}`}>{sev}</span><span className="text-xs font-bold">{count}</span></div>
            )}
          </div>
        </div>
      </div>

      {/* Category summary */}
      <div className="grid grid-cols-5 gap-2">
        {Object.entries(scanner.stats.byType).sort((a, b) => b[1].amount - a[1].amount || b[1].count - a[1].count).map(([type, data]) => {
          const cfg = LEAK_TYPES[type as keyof typeof LEAK_TYPES];
          return (
            <div key={type} className="bg-white rounded-xl border p-3 cursor-pointer hover:shadow-sm" onClick={() => setTypeFilter(typeFilter === type ? 'all' : type)}>
              <div className="flex items-center gap-2 mb-1"><span className="text-lg">{cfg?.icon || '⚠️'}</span><span className="text-[10px] font-medium">{cfg?.label || type}</span></div>
              <div className="text-lg font-black">{data.count}</div>
              {data.amount > 0 && <div className="text-[10px] text-red-600 font-bold">{INR(data.amount)}</div>}
            </div>
          );
        })}
      </div>

      {/* Filters */}
      <div className="flex gap-4">
        <div className="flex gap-1">
          <button onClick={() => setTypeFilter('all')} className={`px-2 py-1 text-[10px] rounded-lg ${typeFilter === 'all' ? 'bg-teal-100 text-teal-700 font-bold' : 'bg-white border'}`}>All ({scanner.stats.totalLeaks})</button>
          {Object.entries(scanner.stats.byType).map(([type, data]) =>
            <button key={type} onClick={() => setTypeFilter(typeFilter === type ? 'all' : type)} className={`px-2 py-1 text-[10px] rounded-lg ${typeFilter === type ? 'bg-teal-100 text-teal-700 font-bold' : 'bg-white border'}`}>{(LEAK_TYPES[type as keyof typeof LEAK_TYPES]?.label || type).split(' ').map(w => w[0]).join('')} ({data.count})</button>
          )}
        </div>
        <div className="flex gap-1">
          {['all', 'critical', 'high', 'medium'].map(s =>
            <button key={s} onClick={() => setSevFilter(s)} className={`px-2 py-1 text-[10px] rounded-lg capitalize ${sevFilter === s ? 'bg-teal-100 text-teal-700 font-bold' : 'bg-white border'}`}>{s}</button>
          )}
        </div>
      </div>

      {toast && <div className="fixed top-4 left-1/2 -translate-x-1/2 z-50 bg-teal-600 text-white px-5 py-2.5 rounded-xl shadow-lg text-sm font-medium">{toast}</div>}

      {/* Leaks table */}
      <div className="bg-white rounded-xl border overflow-hidden">
        <table className="w-full text-xs"><thead><tr className="bg-gray-50 border-b">
          <th className="p-2">Severity</th><th className="p-2">Type</th><th className="p-2 text-left">Patient</th>
          <th className="p-2 text-left">Issue</th><th className="p-2 text-right">Amount</th><th className="p-2">Age</th><th className="p-2">Action</th>
        </tr></thead><tbody>{filtered.map(l => {
          const cfg = LEAK_TYPES[l.type as keyof typeof LEAK_TYPES];
          const canPost = ['missing_room_charge', 'unbilled_lab', 'unbilled_pharmacy', 'unbilled_charge'].includes(l.type);
          const isPosting = actions.posting === (l.admission_id || l.id);
          return (
            <tr key={l.id} className={`border-b ${SEV_ROW[l.severity]}`}>
              <td className="p-2 text-center"><span className={`text-[8px] px-1.5 py-0.5 rounded font-medium capitalize ${SEV_COLORS[l.severity]}`}>{l.severity}</span></td>
              <td className="p-2"><div className="flex items-center gap-1.5"><span>{cfg?.icon || '⚠️'}</span><span className="text-[10px] font-medium">{cfg?.label || l.type}</span></div></td>
              <td className="p-2"><span className="font-medium">{l.patient_name}</span> <span className="text-[10px] text-gray-400">{l.uhid}</span></td>
              <td className="p-2 text-gray-600 max-w-[350px]">{l.description}</td>
              <td className="p-2 text-right font-bold text-red-600">{l.amount > 0 ? `₹${fmt(l.amount)}` : '—'}</td>
              <td className="p-2 text-center"><span className={l.days_old > 7 ? 'text-red-600 font-bold' : 'text-gray-500'}>{l.days_old}d</span></td>
              <td className="p-2 text-center">{canPost ? (
                <button disabled={isPosting} onClick={async () => {
                  let res;
                  if (l.type === 'missing_room_charge' && l.admission_id) { res = await actions.postRoomCharge(l.admission_id, staffId); }
                  else if (l.type === 'unbilled_lab') { res = await actions.postLabCharge(l.id.replace('lab-', ''), staffId); }
                  else if (l.type === 'unbilled_pharmacy') { res = await actions.postPharmacyCharge(l.id.replace('rx-', ''), staffId); }
                  else if (l.type === 'unbilled_charge') { res = await actions.markBilled(l.id); }
                  if (res?.success) { flash(`Charge posted${res.amount ? ` ₹${Math.round(res.amount)}` : ''}`); scanner.scan(); }
                  else flash(res?.error || 'Failed to post charge');
                }} className="px-2 py-1 bg-blue-600 text-white text-[9px] font-medium rounded-lg hover:bg-blue-700 disabled:opacity-50">
                  {isPosting ? '...' : 'Post Charge'}
                </button>
              ) : <span className="text-[9px] text-gray-400">Manual</span>}</td>
            </tr>
          );
        })}{filtered.length === 0 && <tr><td colSpan={7} className="text-center py-12 text-green-600 font-medium">{scanner.loading ? 'Scanning...' : 'No leakage detected — all services billed'}</td></tr>}</tbody></table>
      </div>
    </div>
  );
}

export default function LeakagePage() { return <RoleGuard module="billing"><LeakageInner /></RoleGuard>; }
