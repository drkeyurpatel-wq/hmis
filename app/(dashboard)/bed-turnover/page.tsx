'use client';
import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { RoleGuard } from '@/components/ui/shared';
import { useAuthStore } from '@/lib/store/auth';
import { useBedTurnover, type BedTurnover, type BedWaitlistEntry } from '@/lib/bed-turnover/bed-turnover-hooks';
import { sb } from '@/lib/supabase/browser';

const SLA_COLORS: Record<string, string> = { on_track: 'bg-green-500', warning: 'bg-amber-400', breached: 'bg-red-500' };
const SLA_BG: Record<string, string> = { on_track: 'bg-green-50 border-green-200', warning: 'bg-amber-50 border-amber-200', breached: 'bg-red-50 border-red-200' };
const STATUS_LABELS: Record<string, string> = {
  housekeeping_pending: 'HK Pending', housekeeping_in_progress: 'Cleaning', housekeeping_done: 'HK Done',
  inspection_pending: 'Awaiting Inspection', inspection_failed: 'Re-clean', ready: 'Ready', assigned: 'Assigned', completed: 'Done',
};
const STATUS_COLORS: Record<string, string> = {
  housekeeping_pending: 'bg-red-100 text-red-700', housekeeping_in_progress: 'bg-amber-100 text-amber-700',
  housekeeping_done: 'bg-blue-100 text-blue-700', inspection_pending: 'bg-blue-100 text-blue-700',
  inspection_failed: 'bg-red-100 text-red-700', ready: 'bg-green-100 text-green-700',
  assigned: 'bg-purple-100 text-purple-700', completed: 'bg-gray-100 text-gray-600',
};

type Tab = 'dashboard' | 'detail' | 'waitlist' | 'initiate';

function Inner() {
  const { staff, activeCentreId } = useAuthStore();
  const centreId = activeCentreId || '';
  const staffId = staff?.id || '';
  const bt = useBedTurnover(centreId);

  const [tab, setTab] = useState<Tab>('dashboard');
  const [toast, setToast] = useState('');
  const flash = (m: string) => { setToast(m); setTimeout(() => setToast(''), 3000); };
  const [selected, setSelected] = useState<BedTurnover | null>(null);
  const [tick, setTick] = useState(0);

  // Staff list
  const [staffList, setStaffList] = useState<{ id: string; full_name: string }[]>([]);
  // Beds with discharge status
  const [dischargeBeds, setDischargeBeds] = useState<any[]>([]);
  // Wards
  const [wards, setWards] = useState<{ id: string; name: string }[]>([]);

  useEffect(() => {
    if (!centreId || !sb()) return;
    sb()!.from('hmis_staff').select('id, full_name').eq('is_active', true).order('full_name').then(({ data }) => setStaffList(data || []));
    sb()!.from('hmis_wards').select('id, name').eq('centre_id', centreId).order('name').then(({ data }) => setWards(data || []));
  }, [centreId]);

  // Tick every 15s for live elapsed
  useEffect(() => { const iv = setInterval(() => setTick(t => t + 1), 15000); return () => clearInterval(iv); }, []);

  // Load beds that are "discharge_initiated" for initiate tab
  const loadDischargeBeds = useCallback(async () => {
    if (!centreId || !sb()) return;
    const { data } = await sb()!.from('hmis_admissions')
      .select('id, ipd_number, bed_id, patient:hmis_patients!inner(first_name, last_name, uhid), bed:hmis_beds!inner(bed_number, room:hmis_rooms(name, ward:hmis_wards(id, name)))')
      .eq('centre_id', centreId)
      .in('status', ['discharged', 'discharge_initiated'])
      .order('actual_discharge', { ascending: false })
      .limit(50);
    setDischargeBeds(data || []);
  }, [centreId]);

  // Initiate form
  const handleInitiate = async (adm: any) => {
    const room = adm.bed?.room as any;
    const result = await bt.initiateTurnover({
      bed_id: adm.bed_id,
      room_id: adm.bed?.room_id || undefined,
      ward_id: room?.ward?.id || undefined,
      discharged_admission_id: adm.id,
      discharge_confirmed_by: staffId,
    });
    if (result) { flash('Bed turnover initiated — HK task created'); bt.load(); setTab('dashboard'); }
    else flash('Error initiating turnover');
  };

  // Waitlist form
  const [wf, setWf] = useState({ patient_search: '', patient_id: '', ward_id: '', priority: 'routine', notes: '' });
  const [patientResults, setPatientResults] = useState<any[]>([]);
  useEffect(() => {
    if (wf.patient_search.length < 2 || !sb()) { setPatientResults([]); return; }
    const t = setTimeout(async () => {
      const { data } = await sb()!.from('hmis_patients')
        .select('id, uhid, first_name, last_name')
        .or(`uhid.ilike.%${wf.patient_search}%,first_name.ilike.%${wf.patient_search}%,last_name.ilike.%${wf.patient_search}%`)
        .limit(5);
      setPatientResults(data || []);
    }, 300);
    return () => clearTimeout(t);
  }, [wf.patient_search]);

  const handleAddWaitlist = async () => {
    if (!wf.patient_id || !wf.ward_id) { flash('Select patient & ward'); return; }
    await bt.addToWaitlist({ patient_id: wf.patient_id, ward_id: wf.ward_id, priority: wf.priority, requested_by: staffId, notes: wf.notes || undefined });
    flash('Added to waitlist');
    setWf({ patient_search: '', patient_id: '', ward_id: '', priority: 'routine', notes: '' });
    bt.load();
  };

  // Detail view refresh
  const openDetail = (t: BedTurnover) => { setSelected(t); setTab('detail'); };

  const refreshSelected = async () => {
    if (!selected) return;
    await bt.load();
    // Find updated version
    const updated = bt.turnovers.find(t => t.id === selected.id);
    if (updated) setSelected(updated);
  };

  return (
    <div className="p-4 md:p-6 max-w-[1400px] mx-auto">
      {toast && <div className="fixed top-4 right-4 z-50 bg-gray-900 text-white px-4 py-2 rounded shadow-lg text-sm">{toast}</div>}

      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">Bed Turnover</h1>
        <div className="flex gap-2">
          {(['dashboard', 'waitlist', 'initiate'] as Tab[]).map(t => (
            <button key={t} onClick={() => { setTab(t); if (t === 'initiate') loadDischargeBeds(); setSelected(null); }}
              className={`px-3 py-1.5 rounded text-sm font-medium ${tab === t ? 'bg-blue-600 text-white' : 'bg-gray-100'}`}>
              {t === 'dashboard' ? 'Dashboard' : t === 'waitlist' ? `Waitlist (${bt.stats.waitlistCount})` : '+ Initiate'}
            </button>
          ))}
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-6">
        {[
          { label: 'In Turnaround', value: bt.stats.inTurnaround, color: 'text-amber-600' },
          { label: 'Ready', value: bt.stats.ready, color: 'text-green-600' },
          { label: 'SLA Breached', value: bt.stats.breached, color: 'text-red-600' },
          { label: 'Warning', value: bt.stats.warning, color: 'text-amber-500' },
          { label: 'Avg Turnaround', value: `${bt.stats.avgMinutes}m`, color: 'text-blue-600' },
        ].map(s => (
          <div key={s.label} className="bg-white border rounded-lg p-4">
            <div className={`text-2xl font-bold ${s.color}`}>{s.value}</div>
            <div className="text-xs text-gray-500 mt-1">{s.label}</div>
          </div>
        ))}
      </div>

      {/* Dashboard — live bed cards */}
      {tab === 'dashboard' && (
        <div>
          {bt.loading ? <p className="text-gray-400 text-sm">Loading...</p> : bt.turnovers.length === 0 ? (
            <p className="text-gray-500 text-sm">No active bed turnovers. Initiate one from a discharged bed.</p>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {bt.turnovers.map(t => {
                const elapsed = bt.getElapsed(t);
                const liveSLA = bt.getLiveSLA(t);
                const b = t.bed as any;
                return (
                  <div key={t.id} className={`border rounded-lg p-4 cursor-pointer hover:shadow-md transition-shadow ${SLA_BG[liveSLA]}`} onClick={() => openDetail(t)}>
                    <div className="flex items-center justify-between mb-2">
                      <div className="font-semibold">{b?.room?.ward?.name || 'Ward'} — {b?.bed_number || 'Bed'}</div>
                      <div className={`w-3 h-3 rounded-full ${SLA_COLORS[liveSLA]} animate-pulse`} />
                    </div>
                    <div className="text-sm text-gray-600 mb-2">{b?.room?.name || ''}</div>
                    <div className="flex items-center justify-between mb-3">
                      <span className={`px-2 py-0.5 rounded text-xs font-medium ${STATUS_COLORS[t.status]}`}>{STATUS_LABELS[t.status]}</span>
                      <span className={`text-sm font-bold ${elapsed > 90 ? 'text-red-600' : elapsed > 45 ? 'text-amber-600' : 'text-green-600'}`}>{elapsed}m</span>
                    </div>
                    {t.hk_assignee?.full_name && <div className="text-xs text-gray-500">HK: {t.hk_assignee.full_name}</div>}
                    {/* Checklist progress */}
                    {t.hk_checklist && (
                      <div className="mt-2">
                        <div className="flex items-center gap-2">
                          <div className="flex-1 bg-gray-200 rounded-full h-1.5">
                            <div className="bg-blue-500 h-1.5 rounded-full" style={{ width: `${(t.hk_checklist.filter(c => c.done).length / t.hk_checklist.length) * 100}%` }} />
                          </div>
                          <span className="text-[10px] text-gray-400">{t.hk_checklist.filter(c => c.done).length}/{t.hk_checklist.length}</span>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Detail View */}
      {tab === 'detail' && selected && (
        <div>
          <button onClick={() => { setTab('dashboard'); setSelected(null); }} className="text-sm text-blue-600 mb-4">← Back</button>
          <div className="bg-white border rounded-lg p-6">
            <div className="flex items-start justify-between mb-4">
              <div>
                <h2 className="text-xl font-bold">{(selected.bed as any)?.room?.ward?.name} — Bed {(selected.bed as any)?.bed_number}</h2>
                <p className="text-sm text-gray-500">{(selected.bed as any)?.room?.name} · Discharge: {new Date(selected.discharge_confirmed_at).toLocaleString()}</p>
              </div>
              <div className="text-right">
                <div className={`text-3xl font-bold ${bt.getElapsed(selected) > 90 ? 'text-red-600' : bt.getElapsed(selected) > 45 ? 'text-amber-600' : 'text-green-600'}`}>
                  {bt.getElapsed(selected)}m
                </div>
                <div className="text-xs text-gray-400">SLA target: {selected.sla_target_minutes}m</div>
              </div>
            </div>

            {/* Step tracker */}
            <div className="flex items-center gap-1 mb-6 overflow-x-auto">
              {['housekeeping_pending','housekeeping_in_progress','inspection_pending','ready','assigned'].map((step, i) => {
                const active = selected.status === step;
                const done = ['housekeeping_pending','housekeeping_in_progress','housekeeping_done','inspection_pending','inspection_failed','ready','assigned','completed'].indexOf(selected.status) > ['housekeeping_pending','housekeeping_in_progress','housekeeping_done','inspection_pending','inspection_failed','ready','assigned','completed'].indexOf(step);
                return (
                  <React.Fragment key={step}>
                    <div className={`px-3 py-1.5 rounded text-xs font-medium whitespace-nowrap ${active ? 'bg-blue-600 text-white' : done ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-400'}`}>
                      {STATUS_LABELS[step] || step}
                    </div>
                    {i < 4 && <div className={`w-6 h-0.5 ${done ? 'bg-green-400' : 'bg-gray-200'}`} />}
                  </React.Fragment>
                );
              })}
            </div>

            {/* Housekeeping checklist */}
            {selected.hk_checklist && (
              <div className="mb-6">
                <h3 className="text-sm font-semibold mb-2">Cleaning Checklist</h3>
                <div className="space-y-1">
                  {selected.hk_checklist.map((item, idx) => (
                    <label key={idx} className="flex items-center gap-2 p-1.5 rounded hover:bg-gray-50 cursor-pointer">
                      <input type="checkbox" checked={item.done} onChange={async (e) => {
                        await bt.updateChecklist(selected.id, idx, e.target.checked);
                        const updated = { ...selected, hk_checklist: selected.hk_checklist.map((c, i) => i === idx ? { ...c, done: e.target.checked } : c) };
                        setSelected(updated);
                      }} className="rounded" />
                      <span className={`text-sm ${item.done ? 'line-through text-gray-400' : ''}`}>{item.item}</span>
                    </label>
                  ))}
                </div>
              </div>
            )}

            {/* Actions based on status */}
            <div className="flex flex-wrap gap-2 pt-4 border-t">
              {selected.status === 'housekeeping_pending' && (
                <div className="flex gap-2 items-center">
                  <select className="border rounded px-2 py-1.5 text-sm" onChange={async (e) => {
                    if (e.target.value) { await bt.assignHK(selected.id, e.target.value); flash('HK assigned'); bt.load(); }
                  }}>
                    <option value="">Assign HK staff...</option>
                    {staffList.map(s => <option key={s.id} value={s.id}>{s.full_name}</option>)}
                  </select>
                </div>
              )}
              {(selected.status === 'housekeeping_in_progress' || selected.status === 'housekeeping_pending') && (
                <button onClick={async () => { await bt.completeHK(selected.id); flash('HK completed — awaiting inspection'); bt.load(); setTab('dashboard'); setSelected(null); }}
                  disabled={selected.hk_checklist?.some(c => !c.done)}
                  className="bg-blue-600 text-white px-4 py-1.5 rounded text-sm font-medium disabled:opacity-50">
                  Complete Cleaning
                </button>
              )}
              {selected.status === 'inspection_pending' && (
                <>
                  <button onClick={async () => { await bt.inspectBed(selected.id, staffId, true); flash('Inspection passed — bed available ✓'); bt.load(); setTab('dashboard'); setSelected(null); }}
                    className="bg-green-600 text-white px-4 py-1.5 rounded text-sm font-medium">Pass Inspection ✓</button>
                  <button onClick={async () => { const r = prompt('Rejection reason?'); if (r) { await bt.inspectBed(selected.id, staffId, false, r); flash('Inspection failed — sent back for re-cleaning'); bt.load(); setTab('dashboard'); setSelected(null); } }}
                    className="bg-red-600 text-white px-4 py-1.5 rounded text-sm font-medium">Fail Inspection ✗</button>
                </>
              )}
              {selected.status === 'ready' && (
                <button onClick={async () => { await bt.markComplete(selected.id); flash('Marked complete'); bt.load(); setTab('dashboard'); setSelected(null); }}
                  className="bg-gray-600 text-white px-4 py-1.5 rounded text-sm font-medium">Mark Complete</button>
              )}
            </div>

            {selected.inspection_remarks && (
              <div className="mt-3 text-sm text-red-600 bg-red-50 p-2 rounded">Inspection: {selected.inspection_remarks}</div>
            )}
          </div>
        </div>
      )}

      {/* Initiate Tab */}
      {tab === 'initiate' && (
        <div className="bg-white border rounded-lg p-6">
          <h2 className="text-lg font-semibold mb-4">Initiate Bed Turnover from Discharge</h2>
          {dischargeBeds.length === 0 ? <p className="text-gray-500 text-sm">No discharged beds awaiting turnover.</p> : (
            <div className="space-y-2">
              {dischargeBeds.map(adm => {
                const b = adm.bed as any;
                return (
                  <div key={adm.id} className="flex items-center justify-between p-3 border rounded hover:bg-gray-50">
                    <div>
                      <div className="font-medium">{b?.room?.ward?.name || 'Ward'} — Bed {b?.bed_number || '?'} <span className="text-gray-400 text-sm">({b?.room?.name})</span></div>
                      <div className="text-sm text-gray-500">{(adm.patient as any)?.first_name} {(adm.patient as any)?.last_name} ({(adm.patient as any)?.uhid}) · IPD: {adm.ipd_number}</div>
                    </div>
                    <button onClick={() => handleInitiate(adm)} className="bg-blue-600 text-white px-3 py-1.5 rounded text-sm">Start Turnover</button>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Waitlist Tab */}
      {tab === 'waitlist' && (
        <div>
          <div className="bg-white border rounded-lg p-6 mb-4">
            <h2 className="text-lg font-semibold mb-4">Add to Waitlist</h2>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-3 mb-3">
              <div className="relative">
                <input className="w-full border rounded px-3 py-2 text-sm" placeholder="Search patient..." value={wf.patient_search}
                  onChange={e => setWf(p => ({ ...p, patient_search: e.target.value, patient_id: '' }))} />
                {patientResults.length > 0 && !wf.patient_id && (
                  <div className="absolute z-10 w-full bg-white border rounded shadow mt-1 max-h-40 overflow-y-auto">
                    {patientResults.map(p => (
                      <div key={p.id} className="px-3 py-2 text-sm hover:bg-blue-50 cursor-pointer" onClick={() => setWf(prev => ({ ...prev, patient_id: p.id, patient_search: `${p.first_name} ${p.last_name} (${p.uhid})` }))}>
                        {p.first_name} {p.last_name} ({p.uhid})
                      </div>
                    ))}
                  </div>
                )}
              </div>
              <select className="border rounded px-3 py-2 text-sm" value={wf.ward_id} onChange={e => setWf(p => ({ ...p, ward_id: e.target.value }))}>
                <option value="">Select ward...</option>
                {wards.map(w => <option key={w.id} value={w.id}>{w.name}</option>)}
              </select>
              <select className="border rounded px-3 py-2 text-sm" value={wf.priority} onChange={e => setWf(p => ({ ...p, priority: e.target.value }))}>
                <option value="routine">Routine</option><option value="urgent">Urgent</option><option value="emergency">Emergency</option>
              </select>
              <button onClick={handleAddWaitlist} disabled={!wf.patient_id || !wf.ward_id} className="bg-blue-600 text-white rounded text-sm font-medium disabled:opacity-50">Add</button>
            </div>
          </div>

          {bt.waitlist.length === 0 ? <p className="text-gray-500 text-sm">No patients waiting.</p> : (
            <div className="bg-white border rounded-lg overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-gray-50"><tr>
                  <th className="text-left p-3">Patient</th><th className="text-left p-3">Ward</th><th className="text-center p-3">Priority</th><th className="text-left p-3">Waiting Since</th><th className="p-3">Action</th>
                </tr></thead>
                <tbody>
                  {bt.waitlist.map(w => (
                    <tr key={w.id} className="border-t">
                      <td className="p-3">{(w.patient as any)?.first_name} {(w.patient as any)?.last_name} <span className="text-gray-400">({(w.patient as any)?.uhid})</span></td>
                      <td className="p-3">{(w.ward as any)?.name || '-'}</td>
                      <td className="p-3 text-center"><span className={`px-2 py-0.5 rounded text-xs font-medium ${w.priority === 'emergency' ? 'bg-red-100 text-red-700' : w.priority === 'urgent' ? 'bg-amber-100 text-amber-700' : 'bg-blue-100 text-blue-700'}`}>{w.priority}</span></td>
                      <td className="p-3 text-gray-500">{new Date(w.requested_at).toLocaleString()}</td>
                      <td className="p-3 text-center"><button onClick={() => { bt.cancelWaitlist(w.id); flash('Removed'); bt.load(); }} className="text-xs text-red-600">Remove</button></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default function BedTurnoverPage() {
  return <RoleGuard module="ipd"><Inner /></RoleGuard>;
}
