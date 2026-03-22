'use client';
import React, { useState, useEffect, useMemo } from 'react';
import { useOPDQueue, useDoctors, type OPDVisit } from '@/lib/revenue/hooks';
import { RoleGuard } from '@/components/ui/shared';
import { useAuthStore } from '@/lib/store/auth';
import { createClient } from '@/lib/supabase/client';
import { Plus, Search, X, ChevronRight, Stethoscope, UserPlus } from 'lucide-react';

let _sb: any = null;
function sb() { if (typeof window === 'undefined') return null as any; if (!_sb) { try { _sb = createClient(); } catch { return null; } } return _sb; }

const STATUS_FLOW = ['waiting', 'checked_in', 'with_doctor', 'completed'];
const SC: Record<string, { label: string; badge: string; dot: string }> = {
  waiting: { label: 'Waiting', badge: 'h1-badge-amber', dot: 'bg-amber-500' },
  checked_in: { label: 'Checked In', badge: 'h1-badge-blue', dot: 'bg-blue-500' },
  with_doctor: { label: 'With Doctor', badge: 'h1-badge-purple', dot: 'bg-purple-500' },
  completed: { label: 'Completed', badge: 'h1-badge-green', dot: 'bg-emerald-500' },
  cancelled: { label: 'Cancelled', badge: 'h1-badge-red', dot: 'bg-red-500' },
  no_show: { label: 'No Show', badge: 'h1-badge-gray', dot: 'bg-gray-400' },
};
type ViewMode = 'queue' | 'doctor' | 'list';

function OPDInner() {
  const { staff, activeCentreId } = useAuthStore();
  const centreId = activeCentreId || '';
  const { visits, loading, stats, createVisit, updateStatus } = useOPDQueue(centreId);
  const doctors = useDoctors(centreId);

  const [view, setView] = useState<ViewMode>('queue');
  const [showNew, setShowNew] = useState(false);
  const [toast, setToast] = useState('');
  const flash = (m: string) => { setToast(m); setTimeout(() => setToast(''), 3000); };
  const [filter, setFilter] = useState('active');
  const [doctorFilter, setDoctorFilter] = useState('all');
  const [searchQ, setSearchQ] = useState('');

  // New visit form
  const [patSearch, setPatSearch] = useState('');
  const [patResults, setPatResults] = useState<any[]>([]);
  const [selPat, setSelPat] = useState<any>(null);
  const [selDoctor, setSelDoctor] = useState('');
  const [visitType, setVisitType] = useState('new');
  const [complaint, setComplaint] = useState('');
  const [creating, setCreating] = useState(false);
  const [showQuickReg, setShowQuickReg] = useState(false);
  const [regForm, setRegForm] = useState({ first_name: '', last_name: '', phone: '', gender: 'male', age: '' });

  useEffect(() => { if (staff?.staff_type === 'doctor' && staff?.id) setDoctorFilter(staff.id); }, [staff]);

  useEffect(() => {
    if (patSearch.length < 2 || !sb()) { setPatResults([]); return; }
    const t = setTimeout(async () => {
      const { data } = await sb().from('hmis_patients').select('id, uhid, first_name, last_name, age_years, gender, phone_primary')
        .or(`uhid.ilike.%${patSearch}%,first_name.ilike.%${patSearch}%,last_name.ilike.%${patSearch}%,phone_primary.ilike.%${patSearch}%`)
        .eq('is_active', true).limit(8);
      setPatResults(data || []);
    }, 300);
    return () => clearTimeout(t);
  }, [patSearch]);

  const handleCreate = async () => {
    if (!selPat || !selDoctor) return;
    setCreating(true);
    const result = await createVisit(selPat.id, selDoctor, visitType, complaint);
    if (result?.data) {
      flash(`Token ${result.data.token_number || ''} — ${selPat.first_name} registered`);
      setShowNew(false); setSelPat(null); setSelDoctor(''); setComplaint(''); setPatSearch('');
    }
    setCreating(false);
  };

  const handleQuickReg = async () => {
    if (!regForm.first_name || !regForm.phone) return;
    const { data } = await sb().from('hmis_patients').insert({
      first_name: regForm.first_name, last_name: regForm.last_name, phone_primary: regForm.phone,
      gender: regForm.gender, age_years: parseInt(regForm.age) || null, centre_id: centreId,
    }).select('id, uhid, first_name, last_name, age_years, gender, phone_primary').single();
    if (data) { setSelPat(data); setShowQuickReg(false); flash(`Patient ${data.uhid} registered`); }
  };

  const filtered = useMemo(() => {
    let list = visits;
    if (filter === 'active') list = list.filter(v => !['completed', 'cancelled', 'no_show'].includes(v.status));
    else if (filter === 'completed') list = list.filter(v => v.status === 'completed');
    if (doctorFilter !== 'all') list = list.filter(v => v.doctor?.id === doctorFilter);
    if (searchQ) { const q = searchQ.toLowerCase(); list = list.filter(v => v.patient?.name?.toLowerCase().includes(q) || v.patient?.uhid?.toLowerCase().includes(q)); }
    return list;
  }, [visits, filter, doctorFilter, searchQ]);

  const doctorQueues = useMemo(() => {
    const active = visits.filter(v => !['completed', 'cancelled', 'no_show'].includes(v.status));
    const groups: Record<string, { doctor: OPDVisit['doctor']; visits: OPDVisit[] }> = {};
    active.forEach(v => {
      const did = v.doctor?.id || 'unassigned';
      if (!groups[did]) groups[did] = { doctor: v.doctor || { id: '', name: 'Unassigned', department: '' }, visits: [] };
      groups[did].visits.push(v);
    });
    return Object.values(groups).sort((a, b) => b.visits.length - a.visits.length);
  }, [visits]);

  const moveNext = (v: OPDVisit) => {
    const i = STATUS_FLOW.indexOf(v.status);
    if (i >= 0 && i < STATUS_FLOW.length - 1) updateStatus(v.id, STATUS_FLOW[i + 1]);
  };

  const waitTime = (v: OPDVisit) => {
    if (!v.checkInTime) return '—';
    const m = Math.floor((Date.now() - new Date(v.checkInTime).getTime()) / 60000);
    return m < 60 ? `${m}m` : `${Math.floor(m / 60)}h ${m % 60}m`;
  };

  const activeCount = visits.filter(v => !['completed', 'cancelled', 'no_show'].includes(v.status)).length;
  const avgWait = (() => {
    const w = visits.filter(v => v.status === 'waiting' && v.checkInTime);
    if (!w.length) return '—';
    const avg = w.reduce((s, v) => s + (Date.now() - new Date(v.checkInTime!).getTime()), 0) / w.length / 60000;
    return `${Math.round(avg)}m`;
  })();

  return (
    <div className="max-w-[1400px] mx-auto space-y-4">
      {toast && <div className="fixed top-4 left-1/2 -translate-x-1/2 z-50 bg-teal-600 text-white px-5 py-2.5 rounded-xl shadow-lg text-sm font-medium">{toast}</div>}

      <div className="flex items-center justify-between">
        <div><h1 className="text-xl font-bold tracking-tight">OPD Queue</h1><p className="text-xs text-gray-400">{new Date().toLocaleDateString('en-IN', { weekday: 'long', day: '2-digit', month: 'short' })}</p></div>
        <button onClick={() => setShowNew(true)} className="flex items-center gap-2 px-4 py-2.5 bg-teal-600 text-white text-sm rounded-xl font-semibold hover:bg-teal-700"><Plus size={15} /> New OPD Visit</button>
      </div>

      <div className="grid grid-cols-7 gap-2">
        {[
          { l: 'Total', v: stats?.total || 0, c: 'text-gray-800' },
          { l: 'Waiting', v: visits.filter(v => v.status === 'waiting').length, c: 'text-amber-700' },
          { l: 'Checked In', v: visits.filter(v => v.status === 'checked_in').length, c: 'text-blue-700' },
          { l: 'With Doctor', v: stats?.withDoctor || 0, c: 'text-purple-700' },
          { l: 'Completed', v: stats?.completed || 0, c: 'text-emerald-700' },
          { l: 'No Shows', v: visits.filter(v => v.status === 'no_show').length, c: 'text-red-600' },
          { l: 'Avg Wait', v: avgWait, c: 'text-teal-700' },
        ].map(s => (
          <div key={s.l} className="bg-white rounded-xl border px-3 py-3 text-center"><div className="text-[9px] font-semibold text-gray-400 uppercase tracking-wider">{s.l}</div><div className={`text-2xl font-black mt-0.5 ${s.c}`}>{s.v}</div></div>
        ))}
      </div>

      <div className="flex items-center gap-3 flex-wrap">
        <div className="flex gap-1">{(['queue', 'doctor', 'list'] as ViewMode[]).map(v => (
          <button key={v} onClick={() => setView(v)} className={`px-3 py-2 text-xs font-medium rounded-xl capitalize ${view === v ? 'bg-teal-600 text-white' : 'bg-white text-gray-500 border'}`}>{v === 'doctor' ? 'By Doctor' : v === 'queue' ? 'Queue Board' : 'List'}</button>
        ))}</div>
        <div className="flex gap-1">{['active', 'all', 'completed'].map(f => (
          <button key={f} onClick={() => setFilter(f)} className={`px-2.5 py-1.5 text-[10px] font-medium rounded-lg ${filter === f ? 'bg-teal-50 text-teal-700 border border-teal-200' : 'bg-gray-50 text-gray-500'}`}>{f === 'active' ? 'Active' : f === 'all' ? 'All' : 'Done'}</button>
        ))}</div>
        <select value={doctorFilter} onChange={e => setDoctorFilter(e.target.value)} className="px-3 py-1.5 text-xs border rounded-xl bg-white"><option value="all">All Doctors</option>{doctors.map((d: any) => <option key={d.id} value={d.id}>{d.full_name}</option>)}</select>
        <div className="relative flex-1 max-w-xs ml-auto"><Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" /><input value={searchQ} onChange={e => setSearchQ(e.target.value)} className="w-full pl-9 pr-3 py-2 text-xs border rounded-xl" placeholder="Search patient..." /></div>
      </div>

      {/* QUEUE BOARD */}
      {view === 'queue' && (
        <div className="flex gap-3 overflow-x-auto pb-2 scrollbar-thin">
          {STATUS_FLOW.map(status => {
            const sc = SC[status]; const items = filtered.filter(v => v.status === status);
            return (
              <div key={status} className="flex-shrink-0 w-[220px]">
                <div className="flex items-center gap-2 mb-2 px-1"><span className={`w-2 h-2 rounded-full ${sc.dot}`} /><span className="text-xs font-bold text-gray-700">{sc.label}</span><span className="text-[10px] bg-gray-100 text-gray-500 px-1.5 py-0.5 rounded-full">{items.length}</span></div>
                <div className="space-y-2 min-h-[300px]">
                  {items.map(v => (
                    <div key={v.id} className="bg-white rounded-xl border p-3 hover:shadow-md hover:-translate-y-0.5 transition-all group">
                      <div className="flex items-center justify-between mb-1"><span className="text-xs font-bold text-teal-600">T{v.tokenNumber}</span><span className="text-[9px] text-gray-400">{waitTime(v)}</span></div>
                      <div className="text-sm font-semibold text-gray-800 truncate">{v.patient?.name}</div>
                      <div className="text-[10px] text-gray-400">{v.patient?.uhid} · {v.patient?.age}/{v.patient?.gender?.charAt(0)}</div>
                      {v.chiefComplaint && <div className="text-[10px] text-gray-500 mt-1 truncate">{v.chiefComplaint}</div>}
                      <div className="text-[10px] text-teal-600 font-medium mt-1">Dr. {v.doctor?.name?.split(' ').pop()}</div>
                      {status !== 'completed' && (
                        <button onClick={() => moveNext(v)} className="mt-2 w-full flex items-center justify-center gap-1 px-2 py-1.5 bg-teal-50 text-teal-700 text-[10px] font-semibold rounded-lg hover:bg-teal-100 opacity-0 group-hover:opacity-100 transition-opacity">
                          {SC[STATUS_FLOW[STATUS_FLOW.indexOf(status) + 1]]?.label} <ChevronRight size={10} />
                        </button>
                      )}
                    </div>
                  ))}
                  {items.length === 0 && <div className="text-center py-8 text-gray-300 text-[10px]">Empty</div>}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* BY DOCTOR */}
      {view === 'doctor' && (
        <div className="grid grid-cols-3 gap-4">
          {doctorQueues.map(dq => (
            <div key={dq.doctor.id || dq.doctor.name} className="bg-white rounded-2xl border overflow-hidden">
              <div className="px-4 py-3 border-b bg-gray-50/50 flex items-center gap-3">
                <div className="w-9 h-9 rounded-full bg-teal-100 flex items-center justify-center"><Stethoscope size={16} className="text-teal-700" /></div>
                <div className="flex-1"><div className="text-sm font-bold">{dq.doctor.name}</div><div className="text-[10px] text-gray-400">{dq.doctor.department}</div></div>
                <span className="text-lg font-black text-teal-600">{dq.visits.length}</span>
              </div>
              <div className="p-2 space-y-1.5 max-h-[400px] overflow-y-auto scrollbar-thin">
                {dq.visits.map((v, i) => {
                  const sc = SC[v.status] || SC.waiting;
                  return (
                    <div key={v.id} className="flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-gray-50">
                      <div className="text-sm font-bold text-gray-300 w-5 text-center">{i + 1}</div>
                      <span className={`w-2 h-2 rounded-full shrink-0 ${sc.dot}`} />
                      <div className="flex-1 min-w-0"><div className="text-xs font-semibold truncate">{v.patient?.name}</div><div className="text-[10px] text-gray-400">{v.patient?.uhid} · {waitTime(v)}</div></div>
                      <span className={`h1-badge ${sc.badge} text-[8px]`}>{sc.label}</span>
                      {v.status !== 'completed' && <button onClick={() => moveNext(v)} className="p-1 text-teal-500 hover:bg-teal-50 rounded"><ChevronRight size={14} /></button>}
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
          {doctorQueues.length === 0 && <div className="col-span-3 text-center py-12 bg-white rounded-2xl border text-gray-400">No active consultations</div>}
        </div>
      )}

      {/* LIST */}
      {view === 'list' && (
        <div className="bg-white rounded-2xl border overflow-hidden">
          <table className="h1-table"><thead><tr><th>Token</th><th>Patient</th><th>Complaint</th><th>Doctor</th><th>Wait</th><th>Status</th><th>Action</th></tr></thead>
            <tbody>{filtered.map(v => {
              const sc = SC[v.status] || SC.waiting;
              return (<tr key={v.id}><td className="text-sm font-bold text-teal-600">T{v.tokenNumber}</td><td><div className="font-semibold">{v.patient?.name}</div><div className="text-[10px] text-gray-400">{v.patient?.uhid} · {v.patient?.age}/{v.patient?.gender?.charAt(0)}</div></td><td className="text-[11px] text-gray-600 max-w-[200px] truncate">{v.chiefComplaint || '—'}</td><td className="text-[11px]">{v.doctor?.name?.split(' ').pop()}</td><td className="text-[11px] text-gray-500">{waitTime(v)}</td><td><span className={`h1-badge ${sc.badge}`}>{sc.label}</span></td><td>{v.status !== 'completed' && v.status !== 'cancelled' ? <select value={v.status} onChange={e => updateStatus(v.id, e.target.value)} className="text-[10px] border rounded-lg px-2 py-1">{STATUS_FLOW.map(s => <option key={s} value={s}>{SC[s].label}</option>)}<option value="no_show">No Show</option><option value="cancelled">Cancel</option></select> : '—'}</td></tr>);
            })}{filtered.length === 0 && <tr><td colSpan={7} className="text-center py-12 text-gray-400">No visits</td></tr>}</tbody></table>
        </div>
      )}

      {/* NEW VISIT MODAL */}
      {showNew && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4" onClick={() => setShowNew(false)}>
          <div className="bg-white rounded-2xl w-full max-w-lg p-6 space-y-4" onClick={e => e.stopPropagation()}>
            <div className="flex justify-between"><h2 className="text-lg font-bold">New OPD Visit</h2><button onClick={() => setShowNew(false)}><X size={18} className="text-gray-400" /></button></div>
            {selPat ? (
              <div className="flex items-center gap-3 bg-teal-50 rounded-xl p-3 border border-teal-200">
                <div className="w-10 h-10 rounded-full bg-teal-100 flex items-center justify-center"><span className="font-bold text-teal-700">{selPat.first_name?.[0]}{selPat.last_name?.[0]}</span></div>
                <div><div className="font-bold">{selPat.first_name} {selPat.last_name}</div><div className="text-xs text-gray-500">{selPat.uhid} · {selPat.age_years}/{selPat.gender?.charAt(0)} · {selPat.phone_primary}</div></div>
                <button onClick={() => setSelPat(null)} className="ml-auto text-xs text-red-500">Change</button>
              </div>
            ) : (
              <div className="space-y-2">
                <div className="relative"><input value={patSearch} onChange={e => setPatSearch(e.target.value)} className="w-full px-3 py-2.5 border rounded-xl text-sm" placeholder="Search patient by name, UHID, phone..." />
                  {patResults.length > 0 && <div className="absolute z-10 mt-1 w-full bg-white border rounded-xl shadow-xl max-h-48 overflow-y-auto">{patResults.map(p => <button key={p.id} onClick={() => { setSelPat(p); setPatSearch(''); setPatResults([]); }} className="w-full text-left px-3 py-2.5 hover:bg-teal-50 border-b text-xs"><span className="font-medium">{p.first_name} {p.last_name}</span> · {p.uhid} · {p.phone_primary}</button>)}</div>}</div>
                <button onClick={() => setShowQuickReg(true)} className="flex items-center gap-1.5 text-xs text-teal-600 font-medium"><UserPlus size={12} /> Quick Register</button>
              </div>
            )}
            {showQuickReg && !selPat && (
              <div className="bg-gray-50 rounded-xl p-4 space-y-3 border"><h3 className="text-sm font-bold">Quick Registration</h3>
                <div className="grid grid-cols-2 gap-3"><input className="px-3 py-2 border rounded-xl text-sm" placeholder="First Name *" value={regForm.first_name} onChange={e => setRegForm(f => ({ ...f, first_name: e.target.value }))} /><input className="px-3 py-2 border rounded-xl text-sm" placeholder="Last Name" value={regForm.last_name} onChange={e => setRegForm(f => ({ ...f, last_name: e.target.value }))} /><input className="px-3 py-2 border rounded-xl text-sm" placeholder="Phone *" value={regForm.phone} onChange={e => setRegForm(f => ({ ...f, phone: e.target.value }))} /><input className="px-3 py-2 border rounded-xl text-sm" placeholder="Age" type="number" value={regForm.age} onChange={e => setRegForm(f => ({ ...f, age: e.target.value }))} /></div>
                <div className="flex gap-1">{['male', 'female', 'other'].map(g => <button key={g} onClick={() => setRegForm(f => ({ ...f, gender: g }))} className={`flex-1 py-2 rounded-lg text-xs font-medium capitalize ${regForm.gender === g ? 'bg-teal-600 text-white' : 'bg-white text-gray-500 border'}`}>{g}</button>)}</div>
                <button onClick={handleQuickReg} disabled={!regForm.first_name || !regForm.phone} className="w-full py-2 bg-teal-600 text-white text-sm rounded-xl font-semibold disabled:opacity-40">Register & Select</button>
              </div>
            )}
            <div className="grid grid-cols-2 gap-3">
              <div><label className="text-[10px] font-semibold text-gray-500 uppercase">Doctor *</label><select className="w-full mt-1 px-3 py-2.5 border rounded-xl text-sm" value={selDoctor} onChange={e => setSelDoctor(e.target.value)}><option value="">Select</option>{doctors.map((d: any) => <option key={d.id} value={d.id}>{d.full_name} — {d.specialisation || ''}</option>)}</select></div>
              <div><label className="text-[10px] font-semibold text-gray-500 uppercase">Visit Type</label><div className="flex gap-1 mt-1">{['new', 'follow_up', 'review'].map(t => <button key={t} onClick={() => setVisitType(t)} className={`flex-1 py-2.5 rounded-xl text-[10px] font-semibold capitalize ${visitType === t ? 'bg-teal-600 text-white' : 'bg-gray-100 text-gray-500'}`}>{t.replace('_', ' ')}</button>)}</div></div>
            </div>
            <div><label className="text-[10px] font-semibold text-gray-500 uppercase">Chief Complaint</label><textarea className="w-full mt-1 px-3 py-2 border rounded-xl text-sm h-16 resize-none" value={complaint} onChange={e => setComplaint(e.target.value)} placeholder="e.g., Chest pain since 2 days" /></div>
            <button onClick={handleCreate} disabled={!selPat || !selDoctor || creating} className="w-full py-3 bg-teal-600 text-white text-sm rounded-xl font-semibold disabled:opacity-40 hover:bg-teal-700">{creating ? 'Creating...' : 'Register & Generate Token'}</button>
          </div>
        </div>
      )}
    </div>
  );
}

export default function OPDPage() { return <RoleGuard module="opd"><OPDInner /></RoleGuard>; }
