'use client';
import React, { useState, useEffect, useMemo } from 'react';
import { RoleGuard } from '@/components/ui/shared';
import { useAuthStore } from '@/lib/store/auth';
import { useDialysis, useDialysisMonitoring, useDialysisPatients, type DialysisSession } from '@/lib/dialysis/dialysis-hooks';
import { sb } from '@/lib/supabase/browser';

const STATUS_COLORS: Record<string, string> = { scheduled: 'bg-blue-100 text-blue-700', in_progress: 'bg-amber-100 text-amber-700', completed: 'bg-green-100 text-green-700', cancelled: 'bg-red-100 text-red-700' };
const SHIFT_COLORS: Record<string, string> = { morning: 'bg-amber-50 text-amber-700', afternoon: 'bg-blue-50 text-blue-700', evening: 'bg-purple-50 text-purple-700' };
const COMPLICATIONS = ['none', 'hypotension', 'cramps', 'nausea', 'vomiting', 'headache', 'chest_pain', 'clotting', 'access_bleeding', 'air_embolism', 'hemolysis', 'arrhythmia', 'seizure'];
const ACCESS_TYPES = ['av_fistula', 'av_graft', 'catheter_perm', 'catheter_temp'];
const DIALYSIS_TYPES = ['hd', 'hdf', 'pd', 'crrt', 'sled'];

type Tab = 'sessions' | 'machines' | 'patients' | 'analytics';

function DialysisInner() {
  const { staff, activeCentreId } = useAuthStore();
  const centreId = activeCentreId || '';
  const staffId = staff?.id || '';
  const dial = useDialysis(centreId);
  const dialPatients = useDialysisPatients(centreId);

  const [tab, setTab] = useState<Tab>('sessions');
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [toast, setToast] = useState('');
  const flash = (m: string) => { setToast(m); setTimeout(() => setToast(''), 3000); };

  const [showNew, setShowNew] = useState(false);
  const [selected, setSelected] = useState<DialysisSession | null>(null);
  const [detailTab, setDetailTab] = useState<'pre' | 'monitoring' | 'post'>('monitoring');

  // Masters
  const [doctors, setDoctors] = useState<any[]>([]);
  const [techs, setTechs] = useState<any[]>([]);
  const [patSearch, setPatSearch] = useState('');
  const [patResults, setPatResults] = useState<any[]>([]);
  const [selPat, setSelPat] = useState<any>(null);

  useEffect(() => {
    if (!sb() || !centreId) return;
    sb()!.from('hmis_staff').select('id, full_name, staff_type, specialisation').eq('is_active', true)
      .then(({ data }: any) => {
        setDoctors((data || []).filter((s: any) => s.staff_type === 'doctor'));
        setTechs((data || []).filter((s: any) => ['technician', 'nurse'].includes(s.staff_type)));
      });
  }, [centreId]);

  useEffect(() => {
    if (patSearch.length < 2 || !sb()) { setPatResults([]); return; }
    const t = setTimeout(async () => {
      const { data } = await sb()!.from('hmis_patients').select('id, uhid, first_name, last_name, age_years, gender')
        .or(`uhid.ilike.%${patSearch}%,first_name.ilike.%${patSearch}%,last_name.ilike.%${patSearch}%`).limit(8);
      setPatResults(data || []);
    }, 300);
    return () => clearTimeout(t);
  }, [patSearch]);

  useEffect(() => { dial.load(date); }, [date]);

  // Schedule form
  const [sf, setSf] = useState({
    machine_id: '', dialysis_type: 'hd', access_type: 'av_fistula', shift: 'morning',
    pre_weight: '', pre_bp: '', target_uf: '', blood_flow_rate: '300', dialysate_flow_rate: '500',
    duration_minutes: '240', dialyzer_type: '', heparin_dose: '', doctor_id: '', technician_id: '',
    is_emergency: false,
  });

  // Auto-fill from patient profile
  const autoFillFromProfile = (patientId: string) => {
    const profile = dialPatients.patients.find(p => p.patient_id === patientId);
    if (profile) {
      setSf(f => ({
        ...f,
        access_type: profile.current_access_type || f.access_type,
        dialyzer_type: profile.standing_dialyzer || f.dialyzer_type,
        blood_flow_rate: String(profile.standing_bfr || 300),
        dialysate_flow_rate: String(profile.standing_dfr || 500),
        duration_minutes: String(profile.standing_duration_min || 240),
        shift: profile.preferred_shift || f.shift,
        machine_id: profile.preferred_machine_id || f.machine_id,
        heparin_dose: profile.standing_anticoag_dose || f.heparin_dose,
      }));
    }
  };

  const handleSchedule = async () => {
    if (!selPat || !sf.machine_id) return;
    const res = await dial.scheduleSession({
      patient_id: selPat.id, session_date: date, shift: sf.shift,
      machine_id: sf.machine_id, dialysis_type: sf.dialysis_type, access_type: sf.access_type,
      pre_weight: sf.pre_weight ? parseFloat(sf.pre_weight) : null,
      pre_bp: sf.pre_bp || null, target_uf: sf.target_uf ? parseFloat(sf.target_uf) : null,
      blood_flow_rate: parseInt(sf.blood_flow_rate) || 300,
      dialysate_flow_rate: parseInt(sf.dialysate_flow_rate) || 500,
      duration_minutes: parseInt(sf.duration_minutes) || 240,
      dialyzer_type: sf.dialyzer_type, heparin_dose: sf.heparin_dose,
      doctor_id: sf.doctor_id || null, technician_id: sf.technician_id || null,
      is_emergency: sf.is_emergency,
    });
    if (res.success) { flash('Session scheduled'); setShowNew(false); setSelPat(null); }
    else flash('Error: ' + (res.error || ''));
  };

  const saveField = async (field: string, value: any) => {
    if (!selected) return;
    await dial.updateSession(selected.id, { [field]: value });
    setSelected(prev => prev ? { ...prev, [field]: value } : null);
  };

  // Monitoring for selected session
  const monitoring = useDialysisMonitoring(selected?.id || null);
  const [monForm, setMonForm] = useState({ bp_systolic: '', bp_diastolic: '', pulse: '', spo2: '', blood_flow_rate: '', venous_pressure: '', uf_removed: '', symptoms: '', patient_comfort: 'comfortable' });

  const addMonitoringCheck = async () => {
    if (!selected) return;
    const elapsed = selected.actual_start ? Math.round((Date.now() - new Date(selected.actual_start).getTime()) / 60000) : 0;
    await monitoring.addCheck(staffId, {
      minutes_elapsed: elapsed,
      bp_systolic: monForm.bp_systolic ? parseInt(monForm.bp_systolic) : null,
      bp_diastolic: monForm.bp_diastolic ? parseInt(monForm.bp_diastolic) : null,
      pulse: monForm.pulse ? parseInt(monForm.pulse) : null,
      spo2: monForm.spo2 ? parseFloat(monForm.spo2) : null,
      blood_flow_rate: monForm.blood_flow_rate ? parseInt(monForm.blood_flow_rate) : null,
      venous_pressure: monForm.venous_pressure ? parseInt(monForm.venous_pressure) : null,
      uf_removed: monForm.uf_removed ? parseFloat(monForm.uf_removed) : null,
      symptoms: monForm.symptoms || null, patient_comfort: monForm.patient_comfort,
    });
    setMonForm({ bp_systolic: '', bp_diastolic: '', pulse: '', spo2: '', blood_flow_rate: '', venous_pressure: '', uf_removed: '', symptoms: '', patient_comfort: 'comfortable' });
    flash('Check recorded');
  };

  return (
    <div className="max-w-7xl mx-auto space-y-4">
      {toast && <div className="fixed top-4 left-1/2 -translate-x-1/2 z-50 bg-emerald-600 text-white px-4 py-2 rounded-xl shadow-lg text-sm font-medium">{toast}</div>}

      <div className="flex items-center justify-between">
        <div><h1 className="text-xl font-bold">Dialysis Unit</h1><p className="text-xs text-gray-500">{dial.stats.machinesTotal} machines · {dial.stats.totalToday} sessions today</p></div>
        <div className="flex gap-2">
          <input type="date" value={date} onChange={e => setDate(e.target.value)} className="px-3 py-1.5 border rounded-lg text-xs" />
          <button onClick={() => setShowNew(true)} className="px-4 py-2 bg-teal-600 text-white text-xs rounded-lg font-medium hover:bg-teal-700">+ Schedule Session</button>
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-5 lg:grid-cols-10 gap-2">
        {[
          { l: 'Today', v: dial.stats.totalToday }, { l: 'Scheduled', v: dial.stats.scheduled },
          { l: 'Running', v: dial.stats.inProgress }, { l: 'Done', v: dial.stats.completed },
          { l: 'Free', v: dial.stats.machinesAvailable }, { l: 'Busy', v: dial.stats.machinesInUse },
          { l: 'Maint', v: dial.stats.machinesMaint }, { l: 'Total M/C', v: dial.stats.machinesTotal },
          { l: 'Avg URR', v: dial.stats.avgURR + '%' }, { l: 'Events', v: dial.stats.complications },
        ].map(k => <div key={k.l} className="bg-white rounded-xl border p-2 text-center"><div className="text-[9px] text-gray-500">{k.l}</div><div className="text-lg font-bold">{k.v}</div></div>)}
      </div>

      {/* Tabs */}
      <div className="flex gap-1">
        {(['sessions', 'machines', 'patients', 'analytics'] as Tab[]).map(t =>
          <button key={t} onClick={() => setTab(t)} className={`px-4 py-2 text-xs font-medium rounded-lg capitalize ${tab === t ? 'bg-teal-600 text-white' : 'bg-white border hover:bg-gray-50'}`}>
            {t === 'sessions' ? `Sessions (${dial.sessions.length})` : t === 'machines' ? `Machines (${dial.machines.length})` : t === 'patients' ? `Chronic Patients (${dialPatients.patients.length})` : 'Analytics'}
          </button>
        )}
      </div>

      {/* ═══ MACHINE GRID ═══ */}
      {tab === 'sessions' && <div className="grid grid-cols-4 lg:grid-cols-8 gap-2">
        {dial.machines.map(m => {
          const active = dial.sessions.find(s => s.machine_id === m.id && s.status === 'in_progress');
          const scheduled = dial.sessions.find(s => s.machine_id === m.id && s.status === 'scheduled');
          const bg = m.status === 'in_use' ? 'bg-amber-50 border-amber-300' : m.status === 'available' ? 'bg-green-50 border-green-300' : 'bg-red-50 border-red-300';
          return (
            <div key={m.id} className={`rounded-xl border-2 p-2 ${bg} cursor-pointer hover:shadow-sm`} onClick={() => { if (active) { setSelected(active); setDetailTab('monitoring'); } }}>
              <div className="flex items-center justify-between">
                <span className="text-sm font-bold">{m.machine_number}</span>
                <span className={`text-[8px] px-1 py-0.5 rounded font-medium ${m.status === 'available' ? 'bg-green-200 text-green-800' : m.status === 'in_use' ? 'bg-amber-200 text-amber-800' : 'bg-red-200 text-red-800'}`}>{m.status?.replace('_', ' ')}</span>
              </div>
              <div className="text-[9px] text-gray-500 mt-0.5">{m.brand}</div>
              {active && <div className="mt-1 text-[9px]"><span className="font-medium">{active.patient_name}</span><div className="text-gray-400">UF: {active.target_uf || '—'}ml · {active.duration_minutes}m</div></div>}
              {!active && scheduled && <div className="mt-1 text-[9px] text-blue-600">{scheduled.patient_name} ({scheduled.shift})</div>}
            </div>
          );
        })}
      </div>}

      {/* ═══ SESSIONS TABLE ═══ */}
      {tab === 'sessions' && (dial.loading ? <div className="animate-pulse h-48 bg-gray-200 rounded-xl" /> :
        dial.sessions.length === 0 ? <div className="text-center py-12 bg-white rounded-xl border text-gray-400 text-sm">No sessions on {date}</div> :
        <div className="bg-white rounded-xl border overflow-x-auto">
          <table className="w-full text-xs"><thead><tr className="bg-gray-50 border-b">
            <th className="p-2 text-left">Patient</th><th className="p-2">M/C</th><th className="p-2">Shift</th>
            <th className="p-2">Type</th><th className="p-2">Access</th><th className="p-2">Pre Wt</th>
            <th className="p-2">Target UF</th><th className="p-2">BFR/DFR</th><th className="p-2">Duration</th>
            <th className="p-2">URR</th><th className="p-2">Status</th><th className="p-2">Actions</th>
          </tr></thead><tbody>{dial.sessions.map(s => (
            <tr key={s.id} className={`border-b hover:bg-gray-50 cursor-pointer ${s.is_emergency ? 'border-l-4 border-l-red-500' : ''}`} onClick={() => { setSelected(s); setDetailTab('monitoring'); }}>
              <td className="p-2"><div className="font-medium">{s.patient_name}</div><div className="text-[10px] text-gray-400">{s.uhid} · {s.age}y {s.gender?.charAt(0).toUpperCase()}</div></td>
              <td className="p-2 text-center font-bold">{s.machine_number}</td>
              <td className="p-2 text-center"><span className={`text-[9px] px-1.5 py-0.5 rounded ${SHIFT_COLORS[s.shift] || 'bg-gray-100'}`}>{s.shift}</span></td>
              <td className="p-2 text-center"><span className="text-[9px] bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded font-bold uppercase">{s.dialysis_type}</span></td>
              <td className="p-2 text-center text-[10px]">{s.access_type.replace(/_/g, ' ')}</td>
              <td className="p-2 text-center">{s.pre_weight ? `${s.pre_weight}kg` : '—'}</td>
              <td className="p-2 text-center font-medium">{s.target_uf ? `${s.target_uf}ml` : '—'}</td>
              <td className="p-2 text-center text-[10px]">{s.blood_flow_rate}/{s.dialysate_flow_rate}</td>
              <td className="p-2 text-center">{s.duration_minutes}m</td>
              <td className="p-2 text-center">{s.urr ? <span className={`font-bold ${s.urr >= 65 ? 'text-green-600' : 'text-red-600'}`}>{s.urr}%</span> : '—'}</td>
              <td className="p-2 text-center"><span className={`px-1.5 py-0.5 rounded text-[9px] font-medium ${STATUS_COLORS[s.status]}`}>{s.status.replace('_', ' ')}</span></td>
              <td className="p-2" onClick={e => e.stopPropagation()}>
                {s.status === 'scheduled' && <button onClick={() => { dial.startSession(s.id); flash('Started'); }} className="px-2 py-1 bg-amber-100 text-amber-700 rounded text-[9px] font-medium">Start</button>}
                {s.status === 'in_progress' && <button onClick={() => { setSelected(s); setDetailTab('post'); }} className="px-2 py-1 bg-green-100 text-green-700 rounded text-[9px] font-medium">End</button>}
              </td>
            </tr>
          ))}</tbody></table>
        </div>
      )}

      {/* ═══ MACHINES TAB ═══ */}
      {tab === 'machines' && <div className="bg-white rounded-xl border overflow-hidden">
        <table className="w-full text-xs"><thead><tr className="bg-gray-50 border-b">
          <th className="p-2 text-left">Machine</th><th className="p-2">Brand/Model</th><th className="p-2">Serial</th>
          <th className="p-2">Status</th><th className="p-2">Sessions</th><th className="p-2">Last Maint</th><th className="p-2">Next Maint</th>
        </tr></thead><tbody>{dial.machines.map(m => {
          const nextMaint = m.next_maintenance_date ? new Date(m.next_maintenance_date) : null;
          const overdue = nextMaint && nextMaint < new Date();
          return (
            <tr key={m.id} className={`border-b ${overdue ? 'bg-red-50' : ''}`}>
              <td className="p-2 font-bold">{m.machine_number}</td>
              <td className="p-2">{m.brand} {m.model}</td>
              <td className="p-2 font-mono text-[10px]">{m.serial_number || '—'}</td>
              <td className="p-2 text-center"><span className={`text-[9px] px-1.5 py-0.5 rounded font-medium ${m.status === 'available' ? 'bg-green-100 text-green-700' : m.status === 'in_use' ? 'bg-amber-100 text-amber-700' : 'bg-red-100 text-red-700'}`}>{m.status?.replace('_', ' ')}</span></td>
              <td className="p-2 text-center font-bold">{m.total_sessions}</td>
              <td className="p-2 text-center text-[10px]">{m.last_maintenance_date ? new Date(m.last_maintenance_date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' }) : '—'}</td>
              <td className="p-2 text-center"><span className={overdue ? 'text-red-600 font-bold text-[10px]' : 'text-[10px]'}>{nextMaint ? nextMaint.toLocaleDateString('en-IN', { day: '2-digit', month: 'short' }) : '—'}{overdue ? ' OVERDUE' : ''}</span></td>
            </tr>
          );
        })}</tbody></table>
      </div>}

      {/* ═══ CHRONIC PATIENTS TAB ═══ */}
      {tab === 'patients' && (dialPatients.patients.length === 0
        ? <div className="text-center py-12 bg-white rounded-xl border text-gray-400 text-sm">No chronic dialysis patients registered</div>
        : <div className="bg-white rounded-xl border overflow-hidden">
          <table className="w-full text-xs"><thead><tr className="bg-gray-50 border-b">
            <th className="p-2 text-left">Patient</th><th className="p-2">CKD Stage</th><th className="p-2">Etiology</th>
            <th className="p-2">Access</th><th className="p-2">Schedule</th><th className="p-2">Dry Wt</th>
            <th className="p-2">Sessions</th><th className="p-2">Last Kt/V</th><th className="p-2">Last Hb</th>
          </tr></thead><tbody>{dialPatients.patients.map(p => (
            <tr key={p.id} className="border-b hover:bg-gray-50">
              <td className="p-2"><div className="font-medium">{p.patient_name}</div><div className="text-[10px] text-gray-400">{p.uhid} · Since {p.dialysis_start_date ? new Date(p.dialysis_start_date).toLocaleDateString('en-IN', { month: 'short', year: '2-digit' }) : '—'}</div></td>
              <td className="p-2 text-center font-bold">{p.ckd_stage || '—'}</td>
              <td className="p-2 text-center text-[10px]">{p.etiology || '—'}</td>
              <td className="p-2 text-center text-[10px]">{p.current_access_type?.replace(/_/g, ' ') || '—'}<div className="text-gray-400">{p.access_limb?.replace(/_/g, ' ')}</div></td>
              <td className="p-2 text-center"><span className="text-[9px] bg-blue-50 text-blue-700 px-1.5 py-0.5 rounded font-medium uppercase">{p.schedule_pattern}</span> <span className="text-[9px] text-gray-400">{p.preferred_shift}</span></td>
              <td className="p-2 text-center">{p.dry_weight ? `${p.dry_weight}kg` : '—'}</td>
              <td className="p-2 text-center font-bold">{p.total_sessions}</td>
              <td className="p-2 text-center">{p.last_kt_v ? <span className={p.last_kt_v >= 1.2 ? 'text-green-600' : 'text-red-600'}>{p.last_kt_v}</span> : '—'}</td>
              <td className="p-2 text-center">{p.last_hb ? <span className={p.last_hb >= 10 ? 'text-green-600' : 'text-red-600'}>{p.last_hb}</span> : '—'}</td>
            </tr>
          ))}</tbody></table>
        </div>
      )}

      {/* ═══ ANALYTICS TAB ═══ */}
      {tab === 'analytics' && <div className="grid grid-cols-2 gap-4">
        <div className="bg-white rounded-xl border p-5 space-y-3">
          <h3 className="text-sm font-bold">Session Summary</h3>
          <div className="text-xs space-y-2">
            <div className="flex justify-between"><span>Avg session duration</span><b>{dial.sessions.filter(s => s.status === 'completed').length > 0 ? Math.round(dial.sessions.filter(s => s.status === 'completed').reduce((sum, s) => sum + s.duration_minutes, 0) / dial.sessions.filter(s => s.status === 'completed').length) : '—'} min</b></div>
            <div className="flex justify-between"><span>Avg URR</span><b className={parseFloat(dial.stats.avgURR) >= 65 ? 'text-green-600' : 'text-red-600'}>{dial.stats.avgURR}%</b></div>
            <div className="flex justify-between"><span>Target URR</span><b>≥65%</b></div>
            <div className="flex justify-between"><span>Sessions with events</span><b>{dial.stats.complications}</b></div>
            <div className="flex justify-between"><span>Machine utilization</span><b>{dial.stats.machinesTotal > 0 ? Math.round(dial.stats.machinesInUse / dial.stats.machinesTotal * 100) : 0}%</b></div>
          </div>
        </div>
        <div className="bg-white rounded-xl border p-5 space-y-3">
          <h3 className="text-sm font-bold">By Dialysis Type</h3>
          {Object.entries(dial.sessions.reduce((a: Record<string, number>, s) => { a[s.dialysis_type] = (a[s.dialysis_type] || 0) + 1; return a; }, {})).map(([type, count]) => (
            <div key={type} className="flex items-center gap-3">
              <span className="text-xs w-12 uppercase font-bold">{type}</span>
              <div className="flex-1 h-3 bg-gray-100 rounded-full overflow-hidden"><div className="h-full bg-teal-500 rounded-full" style={{ width: `${(count as number / Math.max(1, dial.stats.totalToday)) * 100}%` }} /></div>
              <span className="text-xs font-bold w-6 text-right">{count as number}</span>
            </div>
          ))}
        </div>
      </div>}

      {/* ═══ SCHEDULE NEW MODAL ═══ */}
      {showNew && <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center" onClick={() => setShowNew(false)}>
        <div className="bg-white rounded-xl w-[600px] max-h-[90vh] overflow-y-auto p-5 space-y-4" onClick={e => e.stopPropagation()}>
          <div className="flex justify-between"><h3 className="font-bold text-sm">Schedule Dialysis Session</h3><button onClick={() => setShowNew(false)} className="text-gray-400 text-lg">×</button></div>

          {selPat ? <div className="flex items-center gap-3 bg-blue-50 rounded-lg p-3"><span className="font-medium text-sm">{selPat.first_name} {selPat.last_name}</span><span className="text-xs text-gray-500">{selPat.uhid}</span><button onClick={() => setSelPat(null)} className="ml-auto text-xs text-red-500">×</button></div>
          : <div className="relative"><input value={patSearch} onChange={e => setPatSearch(e.target.value)} className="w-full px-3 py-2 border rounded-lg text-sm" placeholder="Search patient..." autoFocus />
            {patResults.length > 0 && <div className="absolute z-10 mt-1 w-full bg-white border rounded-lg shadow-lg max-h-40 overflow-y-auto">{patResults.map(p => <button key={p.id} onClick={() => { setSelPat(p); setPatSearch(''); setPatResults([]); autoFillFromProfile(p.id); }} className="w-full text-left px-3 py-2 text-xs hover:bg-blue-50 border-b">{p.first_name} {p.last_name} · {p.uhid}</button>)}</div>}</div>}

          <div className="grid grid-cols-3 gap-3">
            <div><label className="text-[9px] text-gray-500">Machine *</label><select value={sf.machine_id} onChange={e => setSf(f => ({...f, machine_id: e.target.value}))} className="w-full px-2 py-1.5 border rounded text-xs">
              <option value="">Select</option>{dial.machines.filter(m => m.status === 'available').map(m => <option key={m.id} value={m.id}>{m.machine_number} ({m.brand})</option>)}</select></div>
            <div><label className="text-[9px] text-gray-500">Type</label><select value={sf.dialysis_type} onChange={e => setSf(f => ({...f, dialysis_type: e.target.value}))} className="w-full px-2 py-1.5 border rounded text-xs">
              {DIALYSIS_TYPES.map(t => <option key={t} value={t}>{t.toUpperCase()}</option>)}</select></div>
            <div><label className="text-[9px] text-gray-500">Shift</label><div className="flex gap-1 mt-0.5">{['morning', 'afternoon', 'evening'].map(s => <button key={s} onClick={() => setSf(f => ({...f, shift: s}))} className={`flex-1 py-1 rounded text-[9px] capitalize ${sf.shift === s ? 'bg-teal-600 text-white' : 'bg-gray-100'}`}>{s}</button>)}</div></div>
            <div><label className="text-[9px] text-gray-500">Access</label><select value={sf.access_type} onChange={e => setSf(f => ({...f, access_type: e.target.value}))} className="w-full px-2 py-1.5 border rounded text-xs">
              {ACCESS_TYPES.map(a => <option key={a} value={a}>{a.replace(/_/g, ' ')}</option>)}</select></div>
            <div><label className="text-[9px] text-gray-500">Pre Weight (kg)</label><input type="number" step="0.1" value={sf.pre_weight} onChange={e => setSf(f => ({...f, pre_weight: e.target.value}))} className="w-full px-2 py-1.5 border rounded text-xs" /></div>
            <div><label className="text-[9px] text-gray-500">Target UF (ml)</label><input type="number" value={sf.target_uf} onChange={e => setSf(f => ({...f, target_uf: e.target.value}))} className="w-full px-2 py-1.5 border rounded text-xs" /></div>
            <div><label className="text-[9px] text-gray-500">BFR (ml/min)</label><input type="number" value={sf.blood_flow_rate} onChange={e => setSf(f => ({...f, blood_flow_rate: e.target.value}))} className="w-full px-2 py-1.5 border rounded text-xs" /></div>
            <div><label className="text-[9px] text-gray-500">DFR (ml/min)</label><input type="number" value={sf.dialysate_flow_rate} onChange={e => setSf(f => ({...f, dialysate_flow_rate: e.target.value}))} className="w-full px-2 py-1.5 border rounded text-xs" /></div>
            <div><label className="text-[9px] text-gray-500">Duration (min)</label><input type="number" value={sf.duration_minutes} onChange={e => setSf(f => ({...f, duration_minutes: e.target.value}))} className="w-full px-2 py-1.5 border rounded text-xs" /></div>
            <div><label className="text-[9px] text-gray-500">Dialyzer</label><input value={sf.dialyzer_type} onChange={e => setSf(f => ({...f, dialyzer_type: e.target.value}))} className="w-full px-2 py-1.5 border rounded text-xs" placeholder="F60/FX80" /></div>
            <div><label className="text-[9px] text-gray-500">Heparin</label><input value={sf.heparin_dose} onChange={e => setSf(f => ({...f, heparin_dose: e.target.value}))} className="w-full px-2 py-1.5 border rounded text-xs" placeholder="5000 IU bolus" /></div>
            <div><label className="text-[9px] text-gray-500">Doctor</label><select value={sf.doctor_id} onChange={e => setSf(f => ({...f, doctor_id: e.target.value}))} className="w-full px-2 py-1.5 border rounded text-xs"><option value="">Select</option>{doctors.map(d => <option key={d.id} value={d.id}>{d.full_name}</option>)}</select></div>
          </div>
          <label className="flex items-center gap-2 text-xs"><input type="checkbox" checked={sf.is_emergency} onChange={e => setSf(f => ({...f, is_emergency: e.target.checked}))} className="rounded" /> Emergency dialysis</label>
          <button onClick={handleSchedule} disabled={!selPat || !sf.machine_id} className="w-full py-2.5 bg-teal-600 text-white text-sm rounded-lg font-medium disabled:opacity-40 hover:bg-teal-700">Schedule</button>
        </div>
      </div>}

      {/* ═══ SESSION DETAIL DRAWER ═══ */}
      {selected && <div className="fixed inset-0 bg-black/50 z-50 flex justify-end" onClick={() => setSelected(null)}>
        <div className="w-[580px] bg-white h-full overflow-y-auto shadow-xl p-5 space-y-4" onClick={e => e.stopPropagation()}>
          <div className="flex justify-between items-start">
            <div>
              <div className="flex items-center gap-2">
                <span className="text-[9px] bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded font-bold uppercase">{selected.dialysis_type}</span>
                <span className={`text-[9px] px-1.5 py-0.5 rounded font-medium ${STATUS_COLORS[selected.status]}`}>{selected.status.replace('_', ' ')}</span>
                <span className="font-bold">{selected.machine_number}</span>
              </div>
              <div className="font-bold text-lg mt-1">{selected.patient_name}</div>
              <div className="text-xs text-gray-500">{selected.uhid} · {selected.age}y · Access: {selected.access_type.replace(/_/g, ' ')}</div>
            </div>
            <button onClick={() => setSelected(null)} className="text-gray-400 text-lg">×</button>
          </div>

          <div className="flex gap-1">{(['pre', 'monitoring', 'post'] as const).map(t =>
            <button key={t} onClick={() => setDetailTab(t)} className={`px-4 py-1.5 text-[10px] font-medium rounded-lg capitalize ${detailTab === t ? 'bg-teal-600 text-white' : 'bg-white border'}`}>{t === 'pre' ? 'Pre-dialysis' : t === 'post' ? 'Post-dialysis' : 'Monitoring'}</button>
          )}</div>

          {/* PRE */}
          {detailTab === 'pre' && <div className="space-y-3">
            <h4 className="text-xs font-bold">Pre-dialysis assessment</h4>
            <div className="grid grid-cols-3 gap-3">
              {[['pre_weight','Weight','kg'],['pre_bp','BP','mmHg'],['pre_pulse','Pulse','bpm'],['pre_temp','Temp','°F'],['pre_bun','BUN','mg/dL'],['pre_creatinine','Creatinine','mg/dL'],['pre_potassium','K+','mEq/L'],['pre_hemoglobin','Hb','g/dL']].map(([key,label,unit]) => (
              <div key={key}><label className="text-[9px] text-gray-500">{label}</label>
                <div className="relative"><input type={key === 'pre_bp' ? 'text' : 'number'} step="any" className="w-full px-2 py-1.5 border rounded text-xs pr-10" defaultValue={(selected as any)[key] || ''} onBlur={e => { const v = key === 'pre_bp' ? e.target.value : (parseFloat(e.target.value) || null); saveField(key, v); }} placeholder={key === 'pre_bp' ? '120/80' : ''} />
                  <span className="absolute right-2 top-1/2 -translate-y-1/2 text-[9px] text-gray-400">{unit}</span></div></div>
            ))}
            </div>
            <h4 className="text-xs font-bold mt-3">Prescription</h4>
            <div className="grid grid-cols-3 gap-3">
              {[['target_uf','Target UF','ml'],['blood_flow_rate','BFR','ml/min'],['dialysate_flow_rate','DFR','ml/min'],['duration_minutes','Duration','min']].map(([key,label,unit]) => (
              <div key={key}><label className="text-[9px] text-gray-500">{label}</label>
                <div className="relative"><input type="number" className="w-full px-2 py-1.5 border rounded text-xs pr-10" defaultValue={(selected as any)[key] || ''} onBlur={e => saveField(key, parseFloat(e.target.value) || null)} />
                  <span className="absolute right-2 top-1/2 -translate-y-1/2 text-[9px] text-gray-400">{unit}</span></div></div>
            ))}
            </div>
            <div className="grid grid-cols-4 gap-2">
              {[['dialysate_sodium','Na+','mEq/L'],['dialysate_potassium','K+','mEq/L'],['dialysate_calcium','Ca++','mEq/L'],['dialysate_bicarb','HCO3-','mEq/L']].map(([key,label,unit]) => (
              <div key={key}><label className="text-[9px] text-gray-500">{label}</label>
                <input type="number" step="0.1" className="w-full px-2 py-1.5 border rounded text-xs" defaultValue={(selected as any)[key] || ''} onBlur={e => saveField(key, parseFloat(e.target.value) || null)} /></div>
            ))}
            </div>
          </div>}

          {/* MONITORING */}
          {detailTab === 'monitoring' && <div className="space-y-3">
            <h4 className="text-xs font-bold">Intra-dialytic monitoring ({monitoring.checks.length} checks)</h4>
            {monitoring.checks.length > 0 && <div className="bg-gray-50 rounded-lg overflow-x-auto">
              <table className="w-full text-[10px]"><thead><tr className="border-b">
                <th className="p-1.5">Time</th><th className="p-1.5">Min</th><th className="p-1.5">BP</th><th className="p-1.5">HR</th><th className="p-1.5">SpO2</th><th className="p-1.5">BFR</th><th className="p-1.5">VP</th><th className="p-1.5">UF</th><th className="p-1.5">Notes</th>
              </tr></thead><tbody>{monitoring.checks.map((c: any, i: number) => (
                <tr key={i} className="border-b">
                  <td className="p-1.5">{new Date(c.check_time).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}</td>
                  <td className="p-1.5">{c.minutes_elapsed}'</td>
                  <td className="p-1.5 font-medium">{c.bp_systolic}/{c.bp_diastolic}</td>
                  <td className="p-1.5">{c.pulse}</td>
                  <td className="p-1.5">{c.spo2 ? `${c.spo2}%` : ''}</td>
                  <td className="p-1.5">{c.blood_flow_rate}</td>
                  <td className="p-1.5">{c.venous_pressure}</td>
                  <td className="p-1.5">{c.uf_removed ? `${c.uf_removed}ml` : ''}</td>
                  <td className="p-1.5 text-gray-500">{c.symptoms || c.patient_comfort}</td>
                </tr>
              ))}</tbody></table>
            </div>}

            {selected.status === 'in_progress' && <div className="bg-amber-50 rounded-lg p-3 space-y-2">
              <div className="text-xs font-bold text-amber-700">Record check</div>
              <div className="grid grid-cols-4 gap-2">
                <div><label className="text-[9px] text-gray-500">Sys</label><input type="number" value={monForm.bp_systolic} onChange={e => setMonForm(f => ({...f, bp_systolic: e.target.value}))} className="w-full px-2 py-1 border rounded text-[10px]" placeholder="120" /></div>
                <div><label className="text-[9px] text-gray-500">Dia</label><input type="number" value={monForm.bp_diastolic} onChange={e => setMonForm(f => ({...f, bp_diastolic: e.target.value}))} className="w-full px-2 py-1 border rounded text-[10px]" placeholder="80" /></div>
                <div><label className="text-[9px] text-gray-500">HR</label><input type="number" value={monForm.pulse} onChange={e => setMonForm(f => ({...f, pulse: e.target.value}))} className="w-full px-2 py-1 border rounded text-[10px]" /></div>
                <div><label className="text-[9px] text-gray-500">SpO2</label><input type="number" value={monForm.spo2} onChange={e => setMonForm(f => ({...f, spo2: e.target.value}))} className="w-full px-2 py-1 border rounded text-[10px]" /></div>
                <div><label className="text-[9px] text-gray-500">BFR</label><input type="number" value={monForm.blood_flow_rate} onChange={e => setMonForm(f => ({...f, blood_flow_rate: e.target.value}))} className="w-full px-2 py-1 border rounded text-[10px]" /></div>
                <div><label className="text-[9px] text-gray-500">VP</label><input type="number" value={monForm.venous_pressure} onChange={e => setMonForm(f => ({...f, venous_pressure: e.target.value}))} className="w-full px-2 py-1 border rounded text-[10px]" /></div>
                <div><label className="text-[9px] text-gray-500">UF (ml)</label><input type="number" value={monForm.uf_removed} onChange={e => setMonForm(f => ({...f, uf_removed: e.target.value}))} className="w-full px-2 py-1 border rounded text-[10px]" /></div>
                <div><label className="text-[9px] text-gray-500">Comfort</label><select value={monForm.patient_comfort} onChange={e => setMonForm(f => ({...f, patient_comfort: e.target.value}))} className="w-full px-2 py-1 border rounded text-[10px]"><option value="comfortable">OK</option><option value="restless">Restless</option><option value="drowsy">Drowsy</option><option value="distressed">Distressed</option></select></div>
              </div>
              <input value={monForm.symptoms} onChange={e => setMonForm(f => ({...f, symptoms: e.target.value}))} className="w-full px-2 py-1.5 border rounded text-xs" placeholder="Symptoms / interventions..." />
              <button onClick={addMonitoringCheck} className="px-4 py-1.5 bg-amber-600 text-white text-xs rounded font-medium">Record Check</button>
            </div>}

            <h4 className="text-xs font-bold mt-2">Complications</h4>
            <div className="flex gap-1 flex-wrap">{COMPLICATIONS.map(c =>
              <button key={c} onClick={() => {
                const cur = selected.complications || [];
                const upd = c === 'none' ? ['none'] : cur.filter(x => x !== 'none').includes(c) ? cur.filter(x => x !== c) : [...cur.filter(x => x !== 'none'), c];
                saveField('complications', upd);
              }} className={`px-2 py-1 rounded text-[9px] capitalize ${(selected.complications || []).includes(c) ? (c === 'none' ? 'bg-green-600 text-white' : 'bg-red-600 text-white') : 'bg-gray-100 text-gray-500'}`}>{c.replace('_', ' ')}</button>
            )}</div>
          </div>}

          {/* POST */}
          {detailTab === 'post' && <div className="space-y-3">
            <h4 className="text-xs font-bold">Post-dialysis</h4>
            <div className="grid grid-cols-3 gap-3">
              {[['post_weight','Weight','kg'],['post_bp','BP','mmHg'],['post_pulse','Pulse','bpm'],['post_temp','Temp','°F'],['post_bun','BUN','mg/dL'],['post_creatinine','Creatinine','mg/dL'],['post_potassium','K+','mEq/L']].map(([key,label,unit]) => (
              <div key={key}><label className="text-[9px] text-gray-500">{label}</label>
                <div className="relative"><input type={key === 'post_bp' ? 'text' : 'number'} step="any" className="w-full px-2 py-1.5 border rounded text-xs pr-10" defaultValue={(selected as any)[key] || ''} onBlur={e => { const v = key === 'post_bp' ? e.target.value : (parseFloat(e.target.value) || null); saveField(key, v); }} placeholder={key === 'post_bp' ? '120/80' : ''} />
                  <span className="absolute right-2 top-1/2 -translate-y-1/2 text-[9px] text-gray-400">{unit}</span></div></div>
            ))}
            </div>
            {selected.pre_weight && selected.post_weight && <div className="bg-blue-50 rounded-lg p-3 text-xs">
              <div>Actual UF: <b>{Math.round((selected.pre_weight - selected.post_weight) * 1000)} ml</b> (target: {selected.target_uf || '—'} ml)</div>
              {selected.urr && <div>URR: <b className={selected.urr >= 65 ? 'text-green-600' : 'text-red-600'}>{selected.urr}%</b> {selected.urr >= 65 ? '(adequate)' : '(below target ≥65%)'}</div>}
            </div>}
            <div><label className="text-[9px] text-gray-500">Notes</label>
              <textarea className="w-full px-2 py-1.5 border rounded text-xs h-16 resize-none" defaultValue={selected.notes} onBlur={e => saveField('notes', e.target.value)} placeholder="Session notes..." /></div>
            {selected.status === 'in_progress' && <button onClick={async () => {
              const postW = (selected as any).post_weight;
              await dial.endSession(selected.id, { post_weight: postW });
              flash('Session completed');
              setSelected(null);
            }} className="w-full py-2.5 bg-green-600 text-white text-sm rounded-lg font-medium hover:bg-green-700">Complete Session</button>}
          </div>}
        </div>
      </div>}
    </div>
  );
}

export default function DialysisPage() { return <RoleGuard module="ipd"><DialysisInner /></RoleGuard>; }
