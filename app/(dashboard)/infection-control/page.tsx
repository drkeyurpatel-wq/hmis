'use client';
import React, { useState, useMemo } from 'react';
import { RoleGuard } from '@/components/ui/shared';
import { useAuthStore } from '@/lib/store/auth';
import { useHAISurveillance, useAntibiogramData, useHandHygiene } from '@/lib/infection-control/infection-hooks';
import { Plus, Search, Shield, AlertTriangle } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';

type Tab = 'surveillance' | 'antibiogram' | 'hand_hygiene' | 'needle_stick';
const INFECTION_TYPES = ['ssi', 'cauti', 'clabsi', 'vap', 'bsi', 'mrsa', 'esbl', 'cdi', 'other'];

function HICCInner() {
  const { staff, activeCentreId } = useAuthStore();
  const centreId = activeCentreId || '';
  const staffId = staff?.id || '';
  const hai = useHAISurveillance(centreId);
  const abg = useAntibiogramData(centreId);
  const hh = useHandHygiene(centreId);
  const [tab, setTab] = useState<Tab>('surveillance');
  const [showNew, setShowNew] = useState(false);
  const [toast, setToast] = useState('');
  const flash = (m: string) => { setToast(m); setTimeout(() => setToast(''), 3000); };
  const [typeFilter, setTypeFilter] = useState('all');

  const wardData = useMemo(() => Object.entries(hai.stats.byWard).map(([k, v]) => ({ ward: k, count: v as number })).sort((a, b) => b.count - a.count).slice(0, 10), [hai.stats]);

  const TABS: { key: Tab; label: string }[] = [
    { key: 'surveillance', label: 'HAI Surveillance' },
    { key: 'antibiogram', label: 'Antibiogram' },
    { key: 'hand_hygiene', label: 'Hand Hygiene' },
    { key: 'needle_stick', label: 'Needle Stick' },
  ];

  return (
    <div className="max-w-[1400px] mx-auto space-y-4">
      {toast && <div className="fixed top-4 left-1/2 -translate-x-1/2 z-50 bg-teal-600 text-white px-5 py-2.5 rounded-xl shadow-lg text-sm font-medium">{toast}</div>}

      <div className="flex items-center justify-between">
        <div><h1 className="text-xl font-bold tracking-tight">Infection Control (HICC)</h1><p className="text-xs text-gray-400">Hospital Infection Control Committee</p></div>
        <button onClick={() => setShowNew(true)} className="flex items-center gap-2 px-4 py-2.5 bg-red-600 text-white text-sm rounded-xl font-semibold hover:bg-red-700"><Plus size={15} /> Report HAI</button>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-8 gap-2">
        {[
          { l: 'Total', v: hai.stats.total, c: 'text-gray-800' },
          { l: 'Confirmed', v: hai.stats.confirmed, c: 'text-red-600' },
          { l: 'SSI', v: hai.stats.ssi, c: 'text-amber-700' },
          { l: 'CAUTI', v: hai.stats.cauti, c: 'text-blue-700' },
          { l: 'CLABSI', v: hai.stats.clabsi, c: 'text-purple-700' },
          { l: 'VAP', v: hai.stats.vap, c: 'text-cyan-700' },
          { l: 'MRSA', v: hai.stats.mrsa, c: 'text-red-700' },
          { l: 'HH Compliance', v: hh.overallCompliance + '%', c: hh.overallCompliance >= 80 ? 'text-emerald-700' : 'text-red-600' },
        ].map(s => (
          <div key={s.l} className="bg-white rounded-xl border px-3 py-3 text-center"><div className="text-[9px] text-gray-400 uppercase font-semibold">{s.l}</div><div className={`text-lg font-black ${s.c}`}>{s.v}</div></div>
        ))}
      </div>

      <div className="flex gap-1">{TABS.map(t => <button key={t.key} onClick={() => setTab(t.key)} className={`px-3.5 py-2 text-xs font-medium rounded-xl ${tab === t.key ? 'bg-teal-600 text-white shadow-sm' : 'bg-white text-gray-500 border border-gray-100'}`}>{t.label}</button>)}</div>

      {/* SURVEILLANCE */}
      {tab === 'surveillance' && (
        <div className="space-y-4">
          {wardData.length > 0 && (
            <div className="bg-white rounded-2xl border p-5">
              <h3 className="text-sm font-bold mb-3">HAI by Ward</h3>
              <ResponsiveContainer width="100%" height={120}><BarChart data={wardData}><XAxis dataKey="ward" tick={{ fontSize: 9, fill: '#64748b' }} axisLine={false} tickLine={false} /><YAxis tick={{ fontSize: 9 }} axisLine={false} tickLine={false} /><Bar dataKey="count" fill="#ef4444" radius={[4, 4, 0, 0]} barSize={18} /></BarChart></ResponsiveContainer>
            </div>
          )}
          <div className="bg-white rounded-2xl border overflow-hidden">
            <div className="px-4 py-3 border-b flex items-center gap-3">
              {['all', ...INFECTION_TYPES].map(t => <button key={t} onClick={() => { setTypeFilter(t); hai.load({ type: t }); }} className={`px-2.5 py-1.5 text-[10px] font-medium rounded-lg uppercase ${typeFilter === t ? 'bg-teal-50 text-teal-700 border border-teal-200' : 'bg-gray-50 text-gray-500'}`}>{t}</button>)}
            </div>
            <table className="w-full text-xs"><thead><tr><th>Date</th><th>Patient</th><th>Type</th><th>Organism</th><th>Ward</th><th>Device</th><th>Status</th><th>Outcome</th></tr></thead>
              <tbody>{hai.cases.map(c => (
                <tr key={c.id}>
                  <td className="text-[11px]">{c.onset_date ? new Date(c.onset_date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' }) : '—'}</td>
                  <td><div className="font-semibold">{c.patient?.first_name} {c.patient?.last_name}</div><div className="text-[10px] text-gray-400">{c.patient?.uhid}</div></td>
                  <td><span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold bg-red-50 text-red-700 uppercase font-bold">{c.infection_type}</span></td>
                  <td className="text-[11px] font-medium">{c.organism || '—'}</td>
                  <td className="text-[11px]">{c.ward || '—'}</td>
                  <td>{c.device_related ? <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold bg-amber-50 text-amber-700">{c.device_type?.replace('_', ' ')}</span> : '—'}</td>
                  <td><span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold ${c.status === 'confirmed' ? 'inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold bg-red-50 text-red-700' : c.status === 'suspected' ? 'inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold bg-amber-50 text-amber-700' : 'inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-50 text-emerald-700'}`}>{c.status}</span></td>
                  <td><span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold ${c.outcome === 'death' ? 'inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold bg-red-50 text-red-700' : c.outcome === 'resolved' ? 'inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-50 text-emerald-700' : 'inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold bg-gray-100 text-gray-600'}`}>{c.outcome || 'ongoing'}</span></td>
                </tr>
              ))}{hai.cases.length === 0 && <tr><td colSpan={8} className="text-center py-12 text-gray-400">No HAI cases reported</td></tr>}</tbody>
            </table>
          </div>
        </div>
      )}

      {/* ANTIBIOGRAM */}
      {tab === 'antibiogram' && (
        <div className="bg-white rounded-2xl border p-5 overflow-x-auto">
          <h3 className="text-sm font-bold mb-3">Antibiogram Heatmap — {new Date().getFullYear()}</h3>
          {abg.heatmap.organisms.length === 0 ? <div className="text-center py-12 text-gray-400">No antibiogram data</div> : (
            <table className="text-[10px]">
              <thead><tr><th className="text-left p-2 font-bold text-gray-700 sticky left-0 bg-white">Organism</th>
                {abg.heatmap.antibiotics.map(a => <th key={a} className="p-2 text-center font-medium text-gray-500 -rotate-45 origin-bottom-left whitespace-nowrap">{a}</th>)}</tr></thead>
              <tbody>{abg.heatmap.organisms.map(o => (
                <tr key={o}><td className="p-2 font-semibold text-gray-800 sticky left-0 bg-white whitespace-nowrap">{o}</td>
                  {abg.heatmap.antibiotics.map(a => {
                    const cell = abg.heatmap.matrix[o]?.[a];
                    if (!cell) return <td key={a} className="p-2 text-center bg-gray-50">—</td>;
                    const bg = cell.pct >= 80 ? 'bg-emerald-100 text-emerald-800' : cell.pct >= 50 ? 'bg-amber-100 text-amber-800' : 'bg-red-100 text-red-800';
                    return <td key={a} className={`p-2 text-center font-bold ${bg}`}>{cell.pct}%</td>;
                  })}
                </tr>
              ))}</tbody>
            </table>
          )}
          <div className="flex gap-4 mt-3 text-[9px] text-gray-500"><span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-emerald-100" /> ≥80% Sensitive</span><span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-amber-100" /> 50-79%</span><span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-red-100" /> &lt;50% (Resistant)</span></div>
        </div>
      )}

      {/* HAND HYGIENE */}
      {tab === 'hand_hygiene' && (
        <div className="space-y-4">
          <div className="bg-white rounded-2xl border p-5">
            <div className="flex items-center justify-between mb-3"><h3 className="text-sm font-bold">Ward-wise Compliance</h3><span className={`text-2xl font-black ${hh.overallCompliance >= 80 ? 'text-emerald-600' : 'text-red-600'}`}>{hh.overallCompliance}% overall</span></div>
            <div className="space-y-2">
              {hh.wardCompliance.map(w => (
                <div key={w.ward}>
                  <div className="flex items-center justify-between mb-1"><span className="text-xs font-medium text-gray-700">{w.ward}</span><span className={`text-xs font-bold ${w.pct >= 80 ? 'text-emerald-600' : w.pct >= 60 ? 'text-amber-600' : 'text-red-600'}`}>{w.pct}% ({w.comp}/{w.opp})</span></div>
                  <div className="h-2 bg-gray-100 rounded-full overflow-hidden"><div className="h-full rounded-full transition-all" style={{ width: `${w.pct}%`, backgroundColor: w.pct >= 80 ? '#10b981' : w.pct >= 60 ? '#f59e0b' : '#ef4444' }} /></div>
                </div>
              ))}
              {hh.wardCompliance.length === 0 && <div className="text-center py-8 text-gray-400 text-xs">No audits recorded</div>}
            </div>
          </div>
        </div>
      )}

      {tab === 'needle_stick' && (
        <div className="bg-white rounded-2xl border p-8 text-center">
          <Shield size={40} className="mx-auto text-gray-300 mb-3" />
          <h3 className="text-sm font-semibold text-gray-700">Needle Stick Injury Tracking</h3>
          <p className="text-xs text-gray-400 mt-1">No incidents recorded. Report new incidents using the form below.</p>
          <button onClick={() => flash('Needle stick reporting form — use the + button to add incidents')} className="mt-4 px-4 py-2 bg-h1-teal text-white text-xs font-medium rounded-lg hover:bg-h1-teal/90 transition-colors">Report Incident</button>
        </div>
      )}
    </div>
  );
}
export default function InfectionControlPage() { return <RoleGuard module="mis"><HICCInner /></RoleGuard>; }
