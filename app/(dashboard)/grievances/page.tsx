'use client';
import React, { useState } from 'react';
import { RoleGuard } from '@/components/ui/shared';
import { useAuthStore } from '@/lib/store/auth';
import { useGrievances } from '@/lib/modules/module-hooks-2';
import { Plus, X, Search, Clock, AlertTriangle, CheckCircle2 } from 'lucide-react';
import { PieChart, Pie, Cell, ResponsiveContainer } from 'recharts';

const TYPES = ['clinical', 'billing', 'behavior', 'facility', 'food', 'delay', 'privacy', 'other'];
const SEVERITY_BADGE: Record<string, string> = { minor: 'h1-badge-blue', major: 'h1-badge-amber', critical: 'h1-badge-red' };
const STATUS_BADGE: Record<string, string> = { received: 'h1-badge-gray', acknowledged: 'h1-badge-blue', investigating: 'h1-badge-amber', resolved: 'h1-badge-green', closed: 'h1-badge-green', escalated: 'h1-badge-red', reopened: 'h1-badge-purple' };
const C = ['#0d9488', '#3b82f6', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4', '#10b981', '#475569'];

function GrievanceInner() {
  const { staff, activeCentreId } = useAuthStore();
  const centreId = activeCentreId || '';
  const staffId = staff?.id || '';
  const grv = useGrievances(centreId);
  const [showNew, setShowNew] = useState(false);
  const [selected, setSelected] = useState<any>(null);
  const [toast, setToast] = useState('');
  const flash = (m: string) => { setToast(m); setTimeout(() => setToast(''), 3000); };
  const [statusFilter, setStatusFilter] = useState('all');
  const [form, setForm] = useState({ complainant_name: '', complainant_phone: '', complainant_relation: 'self', complaint_type: 'facility', department: '', description: '', severity: 'minor', source: 'in_person' });
  const [resolution, setResolution] = useState('');

  const typeData = Object.entries(grv.stats.byType).map(([k, v], i) => ({ name: k, value: v as number, fill: C[i % C.length] }));

  const handleCreate = async () => {
    if (!form.complainant_name || !form.description) return;
    const res = await grv.create(form);
    if (res.success) { flash('Grievance registered'); setShowNew(false); setForm({ complainant_name: '', complainant_phone: '', complainant_relation: 'self', complaint_type: 'facility', department: '', description: '', severity: 'minor', source: 'in_person' }); }
  };

  const tatDisplay = (g: any) => {
    const created = new Date(g.created_at);
    const now = g.resolved_at ? new Date(g.resolved_at) : new Date();
    const hours = Math.floor((now.getTime() - created.getTime()) / 3600000);
    const days = Math.floor(hours / 24);
    return days > 0 ? `${days}d ${hours % 24}h` : `${hours}h`;
  };

  return (
    <div className="max-w-[1400px] mx-auto space-y-4">
      {toast && <div className="fixed top-4 left-1/2 -translate-x-1/2 z-50 bg-teal-600 text-white px-5 py-2.5 rounded-xl shadow-lg text-sm font-medium">{toast}</div>}

      <div className="flex items-center justify-between">
        <div><h1 className="text-xl font-bold tracking-tight">Patient Grievances</h1><p className="text-xs text-gray-400">NABH — acknowledge &lt;24h, resolve &lt;7 days</p></div>
        <button onClick={() => setShowNew(true)} className="flex items-center gap-2 px-4 py-2.5 bg-teal-600 text-white text-sm rounded-xl font-semibold hover:bg-teal-700"><Plus size={15} /> Register Complaint</button>
      </div>

      <div className="grid grid-cols-8 gap-2">
        {[
          { l: 'Total', v: grv.stats.total, c: 'text-gray-800' },
          { l: 'Open', v: grv.stats.received + grv.stats.acknowledged + grv.stats.investigating, c: 'text-amber-700' },
          { l: 'Resolved', v: grv.stats.resolved, c: 'text-emerald-700' },
          { l: 'Escalated', v: grv.stats.escalated, c: 'text-red-600' },
          { l: 'Ack Overdue', v: grv.stats.overdue_ack, c: grv.stats.overdue_ack > 0 ? 'text-red-600' : 'text-gray-400' },
          { l: 'Res Overdue', v: grv.stats.overdue_res, c: grv.stats.overdue_res > 0 ? 'text-red-600' : 'text-gray-400' },
          { l: 'Satisfaction', v: grv.stats.satisfactionRate + '%', c: grv.stats.satisfactionRate >= 80 ? 'text-emerald-700' : 'text-amber-700' },
          { l: 'This Month', v: grv.grievances.filter(g => g.created_at >= new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString()).length, c: 'text-blue-700' },
        ].map(s => (
          <div key={s.l} className="bg-white rounded-xl border px-3 py-3 text-center"><div className="text-[9px] text-gray-400 uppercase font-semibold">{s.l}</div><div className={`text-lg font-black ${s.c}`}>{s.v}</div></div>
        ))}
      </div>

      <div className="grid grid-cols-4 gap-4">
        {/* Type chart */}
        <div className="bg-white rounded-2xl border p-4">
          <h3 className="text-xs font-bold mb-2">By Type</h3>
          {typeData.length > 0 ? (
            <div className="flex items-center gap-3">
              <ResponsiveContainer width={100} height={100}><PieChart><Pie data={typeData} dataKey="value" cx="50%" cy="50%" innerRadius={25} outerRadius={42} strokeWidth={0}>{typeData.map((d, i) => <Cell key={i} fill={d.fill} />)}</Pie></PieChart></ResponsiveContainer>
              <div className="space-y-1">{typeData.slice(0, 5).map(d => <div key={d.name} className="flex items-center gap-1.5 text-[10px]"><span className="w-2 h-2 rounded-full" style={{ background: d.fill }} /><span className="capitalize">{d.name}</span><span className="font-bold ml-auto">{d.value}</span></div>)}</div>
            </div>
          ) : <div className="text-center py-6 text-gray-300 text-xs">No data</div>}
        </div>

        {/* Pipeline */}
        <div className="col-span-3 bg-white rounded-2xl border p-4">
          <h3 className="text-xs font-bold mb-3">Resolution Pipeline</h3>
          <div className="flex items-center gap-2">
            {[
              { label: 'Received', count: grv.stats.received, color: '#94a3b8' },
              { label: 'Acknowledged', count: grv.stats.acknowledged, color: '#3b82f6' },
              { label: 'Investigating', count: grv.stats.investigating, color: '#f59e0b' },
              { label: 'Resolved', count: grv.stats.resolved, color: '#10b981' },
            ].map((step, i, arr) => (
              <React.Fragment key={step.label}>
                <div className="flex-1 text-center rounded-xl py-3" style={{ backgroundColor: step.color + '15' }}>
                  <div className="text-xl font-black" style={{ color: step.color }}>{step.count}</div>
                  <div className="text-[9px] font-medium text-gray-500">{step.label}</div>
                </div>
                {i < arr.length - 1 && <div className="text-gray-300">→</div>}
              </React.Fragment>
            ))}
          </div>
        </div>
      </div>

      {/* List */}
      <div className="bg-white rounded-2xl border overflow-hidden">
        <div className="px-4 py-3 border-b flex items-center gap-3">
          {['all', 'received', 'acknowledged', 'investigating', 'resolved', 'escalated'].map(s => <button key={s} onClick={() => { setStatusFilter(s); grv.load({ status: s }); }} className={`px-2.5 py-1.5 text-[10px] font-medium rounded-lg ${statusFilter === s ? 'bg-teal-50 text-teal-700 border border-teal-200' : 'bg-gray-50 text-gray-500'}`}>{s === 'all' ? 'All' : s}</button>)}
        </div>
        <table className="h1-table"><thead><tr><th>Ref#</th><th>Complainant</th><th>Type</th><th>Description</th><th>Severity</th><th>TAT</th><th>Status</th><th>Action</th></tr></thead>
          <tbody>{grv.grievances.map(g => (
            <tr key={g.id} className={g.status === 'received' && (Date.now() - new Date(g.created_at).getTime()) > 24 * 3600000 ? 'bg-red-50/50' : ''}>
              <td className="font-mono text-[10px]">{g.grievance_number}</td>
              <td><div className="font-semibold">{g.complainant_name}</div><div className="text-[10px] text-gray-400">{g.complainant_phone} · {g.complainant_relation}</div></td>
              <td><span className="h1-badge h1-badge-gray capitalize">{g.complaint_type}</span></td>
              <td className="max-w-[250px] truncate text-[11px] text-gray-600">{g.description}</td>
              <td><span className={`h1-badge ${SEVERITY_BADGE[g.severity] || 'h1-badge-gray'}`}>{g.severity}</span></td>
              <td className="text-[11px] font-mono">{tatDisplay(g)}</td>
              <td><span className={`h1-badge ${STATUS_BADGE[g.status] || 'h1-badge-gray'}`}>{g.status}</span></td>
              <td>
                <div className="flex gap-1">
                  {g.status === 'received' && <button onClick={() => { grv.acknowledge(g.id, staffId); flash('Acknowledged'); }} className="px-2 py-1 bg-teal-50 text-teal-700 text-[10px] rounded-lg font-medium hover:bg-teal-100">Ack</button>}
                  {['acknowledged', 'investigating'].includes(g.status) && <button onClick={() => setSelected(g)} className="px-2 py-1 bg-emerald-50 text-emerald-700 text-[10px] rounded-lg font-medium hover:bg-emerald-100">Resolve</button>}
                </div>
              </td>
            </tr>
          ))}{grv.grievances.length === 0 && <tr><td colSpan={8} className="text-center py-12 text-gray-400">No grievances</td></tr>}</tbody>
        </table>
      </div>

      {/* New Grievance Modal */}
      {showNew && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4" onClick={() => setShowNew(false)}>
          <div className="bg-white rounded-2xl w-full max-w-lg p-6 space-y-3" onClick={e => e.stopPropagation()}>
            <div className="flex justify-between"><h2 className="text-lg font-bold">Register Grievance</h2><button onClick={() => setShowNew(false)}><X size={18} className="text-gray-400" /></button></div>
            <div className="grid grid-cols-2 gap-3">
              <div><label className="text-[10px] text-gray-500 uppercase font-semibold">Complainant Name *</label><input className="w-full mt-1 px-3 py-2 border rounded-xl text-sm" value={form.complainant_name} onChange={e => setForm(f => ({ ...f, complainant_name: e.target.value }))} /></div>
              <div><label className="text-[10px] text-gray-500 uppercase font-semibold">Phone</label><input className="w-full mt-1 px-3 py-2 border rounded-xl text-sm" value={form.complainant_phone} onChange={e => setForm(f => ({ ...f, complainant_phone: e.target.value }))} /></div>
              <div><label className="text-[10px] text-gray-500 uppercase font-semibold">Type *</label><select className="w-full mt-1 px-3 py-2 border rounded-xl text-sm" value={form.complaint_type} onChange={e => setForm(f => ({ ...f, complaint_type: e.target.value }))}>{TYPES.map(t => <option key={t} value={t}>{t}</option>)}</select></div>
              <div><label className="text-[10px] text-gray-500 uppercase font-semibold">Department</label><select className="w-full mt-1 px-3 py-2 border rounded-xl text-sm" value={form.department} onChange={e => setForm(f => ({ ...f, department: e.target.value }))}><option value="">Select</option>{['OPD', 'IPD', 'Emergency', 'Laboratory', 'Pharmacy', 'Radiology', 'Billing', 'Housekeeping', 'Food', 'Security', 'Administration'].map(d => <option key={d}>{d}</option>)}</select></div>
              <div><label className="text-[10px] text-gray-500 uppercase font-semibold">Severity</label><div className="flex gap-1 mt-1">{['minor', 'major', 'critical'].map(s => <button key={s} onClick={() => setForm(f => ({ ...f, severity: s }))} className={`flex-1 py-2 rounded-lg text-[10px] font-semibold capitalize ${form.severity === s ? 'bg-teal-600 text-white' : 'bg-gray-100 text-gray-500'}`}>{s}</button>)}</div></div>
              <div><label className="text-[10px] text-gray-500 uppercase font-semibold">Source</label><select className="w-full mt-1 px-3 py-2 border rounded-xl text-sm" value={form.source} onChange={e => setForm(f => ({ ...f, source: e.target.value }))}>{['in_person', 'phone', 'email', 'online', 'suggestion_box', 'social_media'].map(s => <option key={s} value={s}>{s.replace('_', ' ')}</option>)}</select></div>
            </div>
            <div><label className="text-[10px] text-gray-500 uppercase font-semibold">Description *</label><textarea className="w-full mt-1 px-3 py-2 border rounded-xl text-sm h-20 resize-none" value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} /></div>
            <button onClick={handleCreate} disabled={!form.complainant_name || !form.description} className="w-full py-2.5 bg-teal-600 text-white text-sm rounded-xl font-semibold disabled:opacity-40">Register Grievance</button>
          </div>
        </div>
      )}

      {/* Resolve Modal */}
      {selected && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4" onClick={() => setSelected(null)}>
          <div className="bg-white rounded-2xl w-full max-w-md p-6 space-y-3" onClick={e => e.stopPropagation()}>
            <h2 className="text-lg font-bold">Resolve: {selected.grievance_number}</h2>
            <p className="text-xs text-gray-500">{selected.description}</p>
            <div><label className="text-[10px] text-gray-500 uppercase font-semibold">Resolution *</label><textarea className="w-full mt-1 px-3 py-2 border rounded-xl text-sm h-20 resize-none" value={resolution} onChange={e => setResolution(e.target.value)} placeholder="Describe the resolution..." /></div>
            <button onClick={() => { grv.resolve(selected.id, staffId, resolution); setSelected(null); setResolution(''); flash('Resolved'); }} disabled={!resolution} className="w-full py-2.5 bg-emerald-600 text-white text-sm rounded-xl font-semibold disabled:opacity-40">Mark Resolved</button>
          </div>
        </div>
      )}
    </div>
  );
}
export default function GrievancePage() { return <RoleGuard module="settings"><GrievanceInner /></RoleGuard>; }
