'use client';
import React, { useState, useEffect, useMemo } from 'react';
import { RoleGuard } from '@/components/ui/shared';
import { useAuthStore } from '@/lib/store/auth';
import { usePhysio, BODY_REGIONS, SPORTS, COMP_LEVELS, MODALITIES, SESSION_TYPES, PLAN_TYPES, RTS_PHASES, OUTCOME_MEASURES } from '@/lib/physiotherapy/physio-hooks';
import { sb } from '@/lib/supabase/browser';

const TYPE_COLORS: Record<string, string> = { therapeutic: 'bg-blue-100 text-blue-700', preventive: 'bg-green-100 text-green-700', sports_rehab: 'bg-red-100 text-red-700', post_surgical: 'bg-purple-100 text-purple-700', cardiac_rehab: 'bg-pink-100 text-pink-700', neuro_rehab: 'bg-indigo-100 text-indigo-700' };
const RTS_COLORS: Record<string, string> = { phase_1_protection: 'bg-red-100 text-red-700', phase_2_controlled_motion: 'bg-orange-100 text-orange-700', phase_3_strengthening: 'bg-amber-100 text-amber-700', phase_4_sport_specific: 'bg-blue-100 text-blue-700', phase_5_return_to_play: 'bg-green-100 text-green-700', cleared: 'bg-green-600 text-white' };

type Tab = 'sessions' | 'plans' | 'programs' | 'analytics';

function PhysioInner() {
  const { staff, activeCentreId } = useAuthStore();
  const centreId = activeCentreId || ''; const staffId = staff?.id || '';
  const physio = usePhysio(centreId);

  const [tab, setTab] = useState<Tab>('sessions');
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [toast, setToast] = useState('');
  const flash = (m: string) => { setToast(m); setTimeout(() => setToast(''), 3000); };

  const [showNewSession, setShowNewSession] = useState(false);
  const [showNewPlan, setShowNewPlan] = useState(false);
  const [selected, setSelected] = useState<any>(null);
  const [detailTab, setDetailTab] = useState<'treatment' | 'rom' | 'strength' | 'functional' | 'outcome'>('treatment');

  // Masters
  const [therapists, setTherapists] = useState<any[]>([]);
  const [doctors, setDoctors] = useState<any[]>([]);
  const [patSearch, setPatSearch] = useState('');
  const [patResults, setPatResults] = useState<any[]>([]);
  const [selPat, setSelPat] = useState<any>(null);

  useEffect(() => {
    if (!sb() || !centreId) return;
    sb().from('hmis_staff').select('id, full_name, staff_type, specialisation').eq('is_active', true).order('full_name')
      .then(({ data }: any) => {
        setTherapists((data || []).filter((s: any) => ['doctor', 'nurse', 'technician'].includes(s.staff_type)));
        setDoctors((data || []).filter((s: any) => s.staff_type === 'doctor'));
      });
  }, [centreId]);

  useEffect(() => {
    if (patSearch.length < 2 || !sb()) { setPatResults([]); return; }
    const t = setTimeout(async () => {
      const { data } = await sb().from('hmis_patients').select('id, uhid, first_name, last_name, age_years, gender')
        .or(`uhid.ilike.%${patSearch}%,first_name.ilike.%${patSearch}%,last_name.ilike.%${patSearch}%`).limit(8);
      setPatResults(data || []);
    }, 300);
    return () => clearTimeout(t);
  }, [patSearch]);

  useEffect(() => { physio.load(date); }, [date]);

  // Session form
  const [ssf, setSsf] = useState({ therapist_id: '', plan_id: '', session_type: 'treatment', treatment_area: 'knee', diagnosis: '', pain_score_before: '', duration_minutes: '30', modalities: [] as string[] });

  // Plan form
  const [pf, setPf] = useState({
    therapist_id: '', referring_doctor_id: '', plan_type: 'therapeutic', diagnosis: '',
    treatment_area: '', sport: '', competition_level: '', position_role: '',
    injury_mechanism: '', goals: '', treatment_plan: '',
    total_sessions_planned: '10', frequency: 'alternate',
    return_to_sport_phase: '', precautions: '',
  });

  const toggleModality = (m: string) => setSsf(f => ({ ...f, modalities: f.modalities.includes(m) ? f.modalities.filter(x => x !== m) : [...f.modalities, m] }));

  const handleCreateSession = async () => {
    if (!selPat || !ssf.therapist_id) return;
    const res = await physio.createSession({
      patient_id: selPat.id, therapist_id: ssf.therapist_id, plan_id: ssf.plan_id || null,
      session_type: ssf.session_type, treatment_area: ssf.treatment_area, diagnosis: ssf.diagnosis,
      pain_score_before: ssf.pain_score_before ? parseInt(ssf.pain_score_before) : null,
      duration_minutes: parseInt(ssf.duration_minutes) || 30, modalities: ssf.modalities,
    });
    if (res.success) { flash('Session created'); setShowNewSession(false); setSelPat(null); }
  };

  const handleCreatePlan = async () => {
    if (!selPat || !pf.therapist_id) return;
    const res = await physio.createPlan({
      patient_id: selPat.id, therapist_id: pf.therapist_id,
      referring_doctor_id: pf.referring_doctor_id || null,
      plan_type: pf.plan_type, diagnosis: pf.diagnosis,
      sport: pf.sport || null, competition_level: pf.competition_level || null,
      position_role: pf.position_role || null, injury_mechanism: pf.injury_mechanism || null,
      goals: pf.goals ? pf.goals.split(',').map(s => s.trim()) : [],
      treatment_plan: pf.treatment_plan,
      total_sessions_planned: parseInt(pf.total_sessions_planned) || 10,
      frequency: pf.frequency,
      return_to_sport_phase: pf.return_to_sport_phase || null,
      precautions: pf.precautions ? pf.precautions.split(',').map(s => s.trim()) : [],
    });
    if (res.success) { flash('Plan created'); setShowNewPlan(false); setSelPat(null); }
  };

  const saveSessionField = async (field: string, value: any) => {
    if (!selected) return;
    await physio.updateSession(selected.id, { [field]: value });
    setSelected((prev: any) => prev ? { ...prev, [field]: value } : null);
  };

  // Exercise form
  const [ef, setEf] = useState({ exercise: '', sets: '3', reps: '10', hold_sec: '', resistance: 'body_weight', side: '', notes: '' });
  const addExercise = async () => {
    if (!selected || !ef.exercise) return;
    const updated = [...(selected.exercise_prescription || []), { ...ef, sets: parseInt(ef.sets) || 3, reps: parseInt(ef.reps) || 10, hold_sec: ef.hold_sec ? parseInt(ef.hold_sec) : null }];
    await saveSessionField('exercise_prescription', updated);
    setEf({ exercise: '', sets: '3', reps: '10', hold_sec: '', resistance: 'body_weight', side: '', notes: '' });
  };

  // ROM form
  const [romf, setRomf] = useState({ joint: 'knee', side: 'left', movement: 'flexion', active: '', passive: '', normal: '', pain_at_end: false });
  const addROM = async () => {
    if (!selected || !romf.joint) return;
    const updated = [...(selected.rom_measurements || []), { ...romf, active: parseInt(romf.active) || null, passive: parseInt(romf.passive) || null, normal: parseInt(romf.normal) || null }];
    await saveSessionField('rom_measurements', updated);
    setRomf({ joint: 'knee', side: 'left', movement: 'flexion', active: '', passive: '', normal: '', pain_at_end: false });
  };

  // Strength form
  const [strf, setStrf] = useState({ muscle_group: '', side: 'left', grade: '5/5', method: 'mmt' });
  const addStrength = async () => {
    if (!selected || !strf.muscle_group) return;
    const updated = [...(selected.strength_measurements || []), { ...strf }];
    await saveSessionField('strength_measurements', updated);
    setStrf({ muscle_group: '', side: 'left', grade: '5/5', method: 'mmt' });
  };

  // Functional test form
  const [ftf, setFtf] = useState({ test: '', result: '', unit: '', side: '', target: '' });
  const addFunctionalTest = async () => {
    if (!selected || !ftf.test) return;
    const updated = [...(selected.functional_tests || []), { ...ftf }];
    await saveSessionField('functional_tests', updated);
    setFtf({ test: '', result: '', unit: '', side: '', target: '' });
  };

  const isSportsMode = useMemo(() => pf.plan_type === 'sports_rehab' || pf.plan_type === 'preventive', [pf.plan_type]);

  return (
    <div className="max-w-7xl mx-auto space-y-4">
      {toast && <div className="fixed top-4 left-1/2 -translate-x-1/2 z-50 bg-emerald-600 text-white px-4 py-2 rounded-xl shadow-lg text-sm font-medium">{toast}</div>}

      <div className="flex items-center justify-between">
        <div><h1 className="text-xl font-bold">Physiotherapy & Sports Medicine</h1>
          <p className="text-xs text-gray-500">{physio.stats.activePlans} active plans · {physio.stats.todaySessions} sessions today</p></div>
        <div className="flex gap-2">
          <input type="date" value={date} onChange={e => setDate(e.target.value)} className="px-3 py-1.5 border rounded-lg text-xs" />
          <button onClick={() => setShowNewPlan(true)} className="px-4 py-2 bg-white border text-xs rounded-lg hover:bg-gray-50">+ New Plan</button>
          <button onClick={() => setShowNewSession(true)} className="px-4 py-2 bg-teal-600 text-white text-xs rounded-lg font-medium hover:bg-teal-700">+ Session</button>
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-5 lg:grid-cols-10 gap-2">
        {[
          { l: 'Today', v: physio.stats.todaySessions }, { l: 'Done', v: physio.stats.completed },
          { l: 'Active Plans', v: physio.stats.activePlans }, { l: 'Sports Rehab', v: physio.stats.sportPlans },
          { l: 'Preventive', v: physio.stats.preventivePlans }, { l: 'Post-Surg', v: physio.stats.postSurgical },
          { l: 'RTS Cleared', v: physio.stats.rtsCleared }, { l: 'No Shows', v: physio.stats.noShows, warn: physio.stats.noShows > 0 },
          { l: 'Programs', v: physio.stats.programs }, { l: 'In Progress', v: physio.stats.inProgress },
        ].map(k => <div key={k.l} className={`${(k as any).warn ? 'bg-red-50' : 'bg-white'} rounded-xl border p-2 text-center`}><div className="text-[8px] text-gray-500 leading-tight">{k.l}</div><div className="text-lg font-bold">{k.v}</div></div>)}
      </div>

      <div className="flex gap-1">
        {(['sessions', 'plans', 'programs', 'analytics'] as Tab[]).map(t =>
          <button key={t} onClick={() => setTab(t)} className={`px-4 py-2 text-xs font-medium rounded-lg ${tab === t ? 'bg-teal-600 text-white' : 'bg-white border hover:bg-gray-50'}`}>
            {t === 'sessions' ? `Sessions (${physio.sessions.length})` : t === 'plans' ? `Plans (${physio.plans.length})` : t === 'programs' ? `Prevention Programs (${physio.programs.length})` : 'Analytics'}
          </button>
        )}
      </div>

      {/* ═══ SESSIONS TAB ═══ */}
      {tab === 'sessions' && (physio.sessions.length === 0
        ? <div className="text-center py-12 bg-white rounded-xl border text-gray-400 text-sm">No sessions on {date}</div>
        : <div className="space-y-2">{physio.sessions.map((s: any) => (
          <div key={s.id} className="bg-white rounded-xl border p-4 hover:shadow-md cursor-pointer" onClick={() => { setSelected(s); setDetailTab('treatment'); }}>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <span className={`text-[9px] px-1.5 py-0.5 rounded font-medium capitalize ${TYPE_COLORS[s.plan_type] || 'bg-gray-100 text-gray-600'}`}>{(s.session_type || 'treatment').replace('_', ' ')}</span>
                <span className="font-medium text-sm">{s.patient_name}</span>
                <span className="text-[10px] text-gray-400">{s.uhid} · {s.age}y</span>
              </div>
              <div className="flex items-center gap-2">
                {s.pain_score_before != null && <span className="text-[10px]">Pain: <b>{s.pain_score_before}</b>{s.pain_score_after != null ? ` → ${s.pain_score_after}` : ''}/10</span>}
                {s.plan_sport && <span className="text-[9px] bg-red-50 text-red-700 px-1.5 py-0.5 rounded capitalize">{s.plan_sport}</span>}
                <span className={`px-2 py-0.5 rounded text-[9px] font-medium ${s.status === 'completed' ? 'bg-green-100 text-green-700' : s.status === 'in_progress' ? 'bg-amber-100 text-amber-700' : 'bg-blue-100 text-blue-700'}`}>{s.status?.replace('_', ' ')}</span>
                {s.status === 'scheduled' && <button onClick={e => { e.stopPropagation(); physio.updateSession(s.id, { status: 'in_progress' }); flash('Started'); }} className="px-2 py-1 bg-amber-100 text-amber-700 rounded text-[9px] font-medium">Start</button>}
                {s.status === 'in_progress' && <button onClick={e => { e.stopPropagation(); physio.updateSession(s.id, { status: 'completed' }); flash('Completed'); }} className="px-2 py-1 bg-green-100 text-green-700 rounded text-[9px] font-medium">Done</button>}
              </div>
            </div>
            <div className="flex gap-4 mt-1 text-[10px] text-gray-500">
              <span>Area: {s.treatment_area?.replace('_', ' ')}</span>
              <span>{s.duration_minutes}min</span>
              <span>Therapist: {s.therapist_name}</span>
              {(s.modalities || []).length > 0 && <span className="uppercase">{s.modalities.join(', ')}</span>}
              {s.diagnosis && <span className="italic">{s.diagnosis}</span>}
            </div>
          </div>
        ))}</div>
      )}

      {/* ═══ PLANS TAB ═══ */}
      {tab === 'plans' && (physio.plans.length === 0
        ? <div className="text-center py-12 bg-white rounded-xl border text-gray-400 text-sm">No active plans</div>
        : <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">{physio.plans.map((p: any) => (
          <div key={p.id} className="bg-white rounded-xl border p-4">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <span className={`text-[9px] px-1.5 py-0.5 rounded font-medium capitalize ${TYPE_COLORS[p.plan_type] || 'bg-gray-100'}`}>{p.plan_type?.replace('_', ' ')}</span>
                {p.sport && <span className="text-[9px] bg-red-50 text-red-700 px-1.5 py-0.5 rounded capitalize">{p.sport}</span>}
                {p.competition_level && <span className="text-[9px] bg-amber-50 text-amber-700 px-1.5 py-0.5 rounded capitalize">{p.competition_level}</span>}
              </div>
              {p.return_to_sport_phase && <span className={`text-[8px] px-1.5 py-0.5 rounded font-medium ${RTS_COLORS[p.return_to_sport_phase] || 'bg-gray-100'}`}>{p.return_to_sport_phase.replace(/_/g, ' ').replace('phase ', 'P')}</span>}
            </div>
            <div className="font-bold">{p.patient_name} <span className="font-normal text-[10px] text-gray-400">{p.uhid} · {p.age}y {p.gender?.charAt(0).toUpperCase()}</span></div>
            <div className="text-xs text-gray-600 mt-1">{p.diagnosis}</div>
            {p.injury_mechanism && <div className="text-[10px] text-gray-500 italic">Mechanism: {p.injury_mechanism}</div>}
            {p.position_role && <div className="text-[10px] text-gray-500">{p.sport} — {p.position_role} ({p.competition_level})</div>}
            {(p.goals || []).length > 0 && <div className="flex gap-1 flex-wrap mt-2">{p.goals.map((g: string, i: number) => <span key={i} className="text-[8px] bg-blue-50 text-blue-700 px-1.5 py-0.5 rounded">{g}</span>)}</div>}
            {(p.precautions || []).length > 0 && <div className="flex gap-1 flex-wrap mt-1">{p.precautions.map((pr: string, i: number) => <span key={i} className="text-[8px] bg-red-50 text-red-600 px-1.5 py-0.5 rounded">⚠ {pr}</span>)}</div>}
            <div className="flex justify-between items-center mt-3">
              <span className="text-[10px] text-gray-400">Sessions: <b>{p.sessions_completed}/{p.total_sessions_planned}</b> · {p.frequency?.replace('_', ' ')} · {p.therapist_name}</span>
              {p.return_to_sport_phase && <select className="text-[9px] border rounded px-1.5 py-0.5" value={p.return_to_sport_phase} onChange={e => physio.updatePlan(p.id, { return_to_sport_phase: e.target.value })}>
                {RTS_PHASES.map(ph => <option key={ph} value={ph}>{ph.replace(/_/g, ' ')}</option>)}
              </select>}
            </div>
            <div className="h-1.5 bg-gray-100 rounded-full mt-2 overflow-hidden"><div className="h-full bg-teal-500 rounded-full" style={{ width: `${p.total_sessions_planned > 0 ? (p.sessions_completed / p.total_sessions_planned) * 100 : 0}%` }} /></div>
          </div>
        ))}</div>
      )}

      {/* ═══ PREVENTION PROGRAMS TAB ═══ */}
      {tab === 'programs' && <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
        {physio.programs.map((pr: any) => (
          <div key={pr.id} className="bg-white rounded-xl border p-4">
            <div className="flex items-center justify-between mb-2">
              <span className="font-bold text-sm">{pr.program_name}</span>
              <span className="text-[9px] bg-green-100 text-green-700 px-1.5 py-0.5 rounded capitalize">{pr.program_type?.replace('_', ' ')}</span>
            </div>
            <div className="text-xs text-gray-600">
              {pr.target_population?.replace(/_/g, ' ')} {pr.sport && `· ${pr.sport}`} · {pr.duration_weeks} weeks · {pr.sessions_per_week}x/week
            </div>
            {Array.isArray(pr.exercises) && <div className="mt-2 space-y-1">{pr.exercises.slice(0, 3).map((phase: any, i: number) => (
              <div key={i} className="bg-gray-50 rounded-lg p-2">
                <div className="text-[10px] font-bold text-gray-700">{phase.name || `Phase ${phase.phase || i + 1}`}</div>
                <div className="text-[9px] text-gray-500">{(phase.exercises || []).map((e: any) => e.name).join(', ')}</div>
              </div>
            ))}</div>}
            {pr.screening_protocol && <div className="mt-2 flex gap-1 flex-wrap">{Object.entries(pr.screening_protocol).filter(([, v]) => v).map(([k]) => (
              <span key={k} className="text-[8px] bg-indigo-50 text-indigo-700 px-1.5 py-0.5 rounded">{k.replace(/_/g, ' ')}</span>
            ))}</div>}
          </div>
        ))}
      </div>}

      {/* ═══ ANALYTICS TAB ═══ */}
      {tab === 'analytics' && <div className="grid grid-cols-2 gap-4">
        <div className="bg-white rounded-xl border p-5 space-y-2">
          <h3 className="text-sm font-bold">By body region</h3>
          {Object.entries(physio.stats.byArea).sort((a: any, b: any) => b[1] - a[1]).map(([area, count]) => (
            <div key={area} className="flex items-center gap-3"><span className="text-xs w-24 capitalize">{area.replace('_', ' ')}</span>
              <div className="flex-1 h-2.5 bg-gray-100 rounded-full overflow-hidden"><div className="h-full bg-teal-500 rounded-full" style={{ width: `${((count as number) / Math.max(1, physio.stats.todaySessions)) * 100}%` }} /></div>
              <span className="text-xs font-bold w-6 text-right">{count as number}</span></div>
          ))}
        </div>
        <div className="bg-white rounded-xl border p-5 space-y-2">
          <h3 className="text-sm font-bold">By sport (active plans)</h3>
          {Object.keys(physio.stats.bySport).length === 0 ? <p className="text-xs text-gray-400">No sport-specific plans</p> :
          Object.entries(physio.stats.bySport).sort((a: any, b: any) => b[1] - a[1]).map(([sport, count]) => (
            <div key={sport} className="flex items-center gap-3"><span className="text-xs w-24 capitalize">{sport.replace('_', ' ')}</span>
              <div className="flex-1 h-2.5 bg-gray-100 rounded-full overflow-hidden"><div className="h-full bg-red-500 rounded-full" style={{ width: `${((count as number) / Math.max(1, physio.stats.sportPlans)) * 100}%` }} /></div>
              <span className="text-xs font-bold w-6 text-right">{count as number}</span></div>
          ))}
        </div>
        <div className="bg-white rounded-xl border p-5 col-span-2 space-y-2">
          <h3 className="text-sm font-bold">Plan type distribution</h3>
          <div className="grid grid-cols-4 gap-3">
            {[['Therapeutic', physio.plans.filter(p => p.plan_type === 'therapeutic').length],
              ['Sports Rehab', physio.stats.sportPlans],
              ['Preventive', physio.stats.preventivePlans],
              ['Post-surgical', physio.stats.postSurgical]
            ].map(([label, count]) => (
              <div key={label as string} className="bg-gray-50 rounded-lg p-3 text-center">
                <div className="text-lg font-bold">{count as number}</div>
                <div className="text-[10px] text-gray-500">{label as string}</div>
              </div>
            ))}
          </div>
        </div>
      </div>}

      {/* ═══ NEW SESSION MODAL ═══ */}
      {showNewSession && <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center" onClick={() => setShowNewSession(false)}>
        <div className="bg-white rounded-xl w-[550px] max-h-[90vh] overflow-y-auto p-5 space-y-4" onClick={e => e.stopPropagation()}>
          <div className="flex justify-between"><h3 className="font-bold text-sm">New session</h3><button onClick={() => setShowNewSession(false)} className="text-gray-400 text-lg">×</button></div>

          {selPat ? <div className="flex items-center gap-3 bg-blue-50 rounded-lg p-3"><span className="font-medium">{selPat.first_name} {selPat.last_name}</span><span className="text-xs text-gray-500">{selPat.uhid}</span><button onClick={() => setSelPat(null)} className="ml-auto text-xs text-red-500">×</button></div>
          : <div className="relative"><input value={patSearch} onChange={e => setPatSearch(e.target.value)} className="w-full px-3 py-2 border rounded-lg text-sm" placeholder="Search patient..." autoFocus />
            {patResults.length > 0 && <div className="absolute z-10 mt-1 w-full bg-white border rounded-lg shadow-lg max-h-40 overflow-y-auto">{patResults.map(p => <button key={p.id} onClick={() => { setSelPat(p); setPatSearch(''); setPatResults([]); }} className="w-full text-left px-3 py-2 text-xs hover:bg-blue-50 border-b">{p.first_name} {p.last_name} · {p.uhid}</button>)}</div>}</div>}

          <div className="grid grid-cols-2 gap-3">
            <div><label className="text-[9px] text-gray-500">Therapist *</label><select value={ssf.therapist_id} onChange={e => setSsf(f => ({...f, therapist_id: e.target.value}))} className="w-full px-3 py-2 border rounded-lg text-sm"><option value="">Select</option>{therapists.map(t => <option key={t.id} value={t.id}>{t.full_name}</option>)}</select></div>
            <div><label className="text-[9px] text-gray-500">Session type</label><select value={ssf.session_type} onChange={e => setSsf(f => ({...f, session_type: e.target.value}))} className="w-full px-3 py-2 border rounded-lg text-sm">{SESSION_TYPES.map(t => <option key={t} value={t}>{t.replace('_', ' ')}</option>)}</select></div>
            <div><label className="text-[9px] text-gray-500">Linked plan</label><select value={ssf.plan_id} onChange={e => setSsf(f => ({...f, plan_id: e.target.value}))} className="w-full px-3 py-2 border rounded-lg text-sm"><option value="">No plan</option>{physio.plans.filter(p => selPat ? p.patient_id === selPat.id : true).map(p => <option key={p.id} value={p.id}>{p.diagnosis} ({p.plan_type})</option>)}</select></div>
            <div><label className="text-[9px] text-gray-500">Region</label><select value={ssf.treatment_area} onChange={e => setSsf(f => ({...f, treatment_area: e.target.value}))} className="w-full px-3 py-2 border rounded-lg text-sm">{BODY_REGIONS.map(a => <option key={a} value={a}>{a.replace('_', ' ')}</option>)}</select></div>
            <div><label className="text-[9px] text-gray-500">Pain (0-10)</label><input type="number" min="0" max="10" value={ssf.pain_score_before} onChange={e => setSsf(f => ({...f, pain_score_before: e.target.value}))} className="w-full px-3 py-2 border rounded-lg text-sm" /></div>
            <div><label className="text-[9px] text-gray-500">Duration</label><input type="number" value={ssf.duration_minutes} onChange={e => setSsf(f => ({...f, duration_minutes: e.target.value}))} className="w-full px-3 py-2 border rounded-lg text-sm" /></div>
          </div>
          <div><label className="text-[9px] text-gray-500">Modalities</label><div className="flex gap-1 mt-1 flex-wrap">{MODALITIES.map(m =>
            <button key={m} onClick={() => toggleModality(m)} className={`px-2 py-1 rounded text-[9px] uppercase ${ssf.modalities.includes(m) ? 'bg-teal-600 text-white' : 'bg-gray-100 text-gray-500'}`}>{m.replace('_', ' ')}</button>
          )}</div></div>
          <div><label className="text-[9px] text-gray-500">Diagnosis / reason</label><input value={ssf.diagnosis} onChange={e => setSsf(f => ({...f, diagnosis: e.target.value}))} className="w-full px-3 py-2 border rounded-lg text-sm" placeholder="e.g. Post ACL reconstruction — 6 weeks" /></div>
          <button onClick={handleCreateSession} disabled={!selPat || !ssf.therapist_id} className="w-full py-2.5 bg-teal-600 text-white text-sm rounded-lg font-medium disabled:opacity-40">Create Session</button>
        </div>
      </div>}

      {/* ═══ NEW PLAN MODAL ═══ */}
      {showNewPlan && <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center" onClick={() => setShowNewPlan(false)}>
        <div className="bg-white rounded-xl w-[600px] max-h-[90vh] overflow-y-auto p-5 space-y-4" onClick={e => e.stopPropagation()}>
          <div className="flex justify-between"><h3 className="font-bold text-sm">New treatment plan</h3><button onClick={() => setShowNewPlan(false)} className="text-gray-400 text-lg">×</button></div>

          {selPat ? <div className="flex items-center gap-3 bg-blue-50 rounded-lg p-3"><span className="font-medium">{selPat.first_name} {selPat.last_name}</span><span className="text-xs text-gray-500">{selPat.uhid} · {selPat.age_years}y {selPat.gender?.charAt(0)}</span><button onClick={() => setSelPat(null)} className="ml-auto text-xs text-red-500">×</button></div>
          : <div className="relative"><input value={patSearch} onChange={e => setPatSearch(e.target.value)} className="w-full px-3 py-2 border rounded-lg text-sm" placeholder="Search patient..." />
            {patResults.length > 0 && <div className="absolute z-10 mt-1 w-full bg-white border rounded-lg shadow-lg max-h-40 overflow-y-auto">{patResults.map(p => <button key={p.id} onClick={() => { setSelPat(p); setPatSearch(''); setPatResults([]); }} className="w-full text-left px-3 py-2 text-xs hover:bg-blue-50 border-b">{p.first_name} {p.last_name} · {p.uhid}</button>)}</div>}</div>}

          <div><label className="text-[9px] text-gray-500">Plan type</label><div className="flex gap-1 mt-1 flex-wrap">{PLAN_TYPES.map(t =>
            <button key={t} onClick={() => setPf(f => ({...f, plan_type: t}))} className={`px-2.5 py-1.5 rounded-lg text-[9px] font-medium capitalize ${pf.plan_type === t ? (TYPE_COLORS[t] || 'bg-teal-600 text-white') : 'bg-gray-100 text-gray-500'}`}>{t.replace('_', ' ')}</button>
          )}</div></div>

          <div className="grid grid-cols-2 gap-3">
            <div><label className="text-[9px] text-gray-500">Therapist *</label><select value={pf.therapist_id} onChange={e => setPf(f => ({...f, therapist_id: e.target.value}))} className="w-full px-3 py-2 border rounded-lg text-sm"><option value="">Select</option>{therapists.map(t => <option key={t.id} value={t.id}>{t.full_name}</option>)}</select></div>
            <div><label className="text-[9px] text-gray-500">Referring doctor</label><select value={pf.referring_doctor_id} onChange={e => setPf(f => ({...f, referring_doctor_id: e.target.value}))} className="w-full px-3 py-2 border rounded-lg text-sm"><option value="">None</option>{doctors.map(d => <option key={d.id} value={d.id}>{d.full_name}</option>)}</select></div>
            <div className="col-span-2"><label className="text-[9px] text-gray-500">Diagnosis *</label><input value={pf.diagnosis} onChange={e => setPf(f => ({...f, diagnosis: e.target.value}))} className="w-full px-3 py-2 border rounded-lg text-sm" placeholder="e.g. ACL tear left knee, Frozen shoulder, Lumbar disc herniation" /></div>
          </div>

          {/* Sports-specific fields */}
          {isSportsMode && <div className="bg-red-50 rounded-lg p-3 space-y-3">
            <h4 className="text-xs font-bold text-red-700">Sports medicine details</h4>
            <div className="grid grid-cols-3 gap-3">
              <div><label className="text-[9px] text-gray-500">Sport</label><select value={pf.sport} onChange={e => setPf(f => ({...f, sport: e.target.value}))} className="w-full px-2 py-1.5 border rounded text-xs"><option value="">Select</option>{SPORTS.map(s => <option key={s} value={s}>{s.replace('_', ' ')}</option>)}</select></div>
              <div><label className="text-[9px] text-gray-500">Competition level</label><select value={pf.competition_level} onChange={e => setPf(f => ({...f, competition_level: e.target.value}))} className="w-full px-2 py-1.5 border rounded text-xs"><option value="">Select</option>{COMP_LEVELS.map(c => <option key={c} value={c}>{c.replace('_', ' ')}</option>)}</select></div>
              <div><label className="text-[9px] text-gray-500">Position / role</label><input value={pf.position_role} onChange={e => setPf(f => ({...f, position_role: e.target.value}))} className="w-full px-2 py-1.5 border rounded text-xs" placeholder="e.g. Fast bowler, goalkeeper" /></div>
            </div>
            <div><label className="text-[9px] text-gray-500">Injury mechanism</label><input value={pf.injury_mechanism} onChange={e => setPf(f => ({...f, injury_mechanism: e.target.value}))} className="w-full px-2 py-1.5 border rounded text-xs" placeholder="e.g. Non-contact landing during match, overuse bowling" /></div>
            <div><label className="text-[9px] text-gray-500">Return-to-sport phase</label><select value={pf.return_to_sport_phase} onChange={e => setPf(f => ({...f, return_to_sport_phase: e.target.value}))} className="w-full px-2 py-1.5 border rounded text-xs"><option value="">N/A</option>{RTS_PHASES.map(p => <option key={p} value={p}>{p.replace(/_/g, ' ')}</option>)}</select></div>
          </div>}

          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2"><label className="text-[9px] text-gray-500">Goals (comma-separated)</label><input value={pf.goals} onChange={e => setPf(f => ({...f, goals: e.target.value}))} className="w-full px-3 py-2 border rounded-lg text-sm" placeholder="Pain reduction, Full ROM, Return to match fitness, Prevent recurrence" /></div>
            <div className="col-span-2"><label className="text-[9px] text-gray-500">Treatment plan</label><textarea value={pf.treatment_plan} onChange={e => setPf(f => ({...f, treatment_plan: e.target.value}))} className="w-full px-3 py-2 border rounded-lg text-sm h-16 resize-none" placeholder="Phase-wise rehabilitation protocol..." /></div>
            <div><label className="text-[9px] text-gray-500">Sessions planned</label><input type="number" value={pf.total_sessions_planned} onChange={e => setPf(f => ({...f, total_sessions_planned: e.target.value}))} className="w-full px-3 py-2 border rounded-lg text-sm" /></div>
            <div><label className="text-[9px] text-gray-500">Frequency</label><select value={pf.frequency} onChange={e => setPf(f => ({...f, frequency: e.target.value}))} className="w-full px-3 py-2 border rounded-lg text-sm">{['daily','alternate','twice_week','thrice_week','weekly'].map(f => <option key={f} value={f}>{f.replace('_', ' ')}</option>)}</select></div>
            <div className="col-span-2"><label className="text-[9px] text-gray-500">Precautions (comma-separated)</label><input value={pf.precautions} onChange={e => setPf(f => ({...f, precautions: e.target.value}))} className="w-full px-3 py-2 border rounded-lg text-sm" placeholder="e.g. No running for 6 weeks, Avoid deep flexion, No contact sport" /></div>
          </div>
          <button onClick={handleCreatePlan} disabled={!selPat || !pf.therapist_id || !pf.diagnosis} className="w-full py-2.5 bg-teal-600 text-white text-sm rounded-lg font-medium disabled:opacity-40">Create Plan</button>
        </div>
      </div>}

      {/* ═══ SESSION DETAIL DRAWER ═══ */}
      {selected && <div className="fixed inset-0 bg-black/50 z-50 flex justify-end" onClick={() => setSelected(null)}>
        <div className="w-[600px] bg-white h-full overflow-y-auto shadow-xl p-5 space-y-4" onClick={e => e.stopPropagation()}>
          <div className="flex justify-between items-start">
            <div>
              <div className="flex items-center gap-2"><span className={`text-[9px] px-1.5 py-0.5 rounded font-medium capitalize ${TYPE_COLORS[selected.plan_type] || 'bg-gray-100'}`}>{selected.session_type?.replace('_', ' ')}</span>
                <span className={`px-2 py-0.5 rounded text-[9px] font-medium ${selected.status === 'completed' ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700'}`}>{selected.status?.replace('_', ' ')}</span></div>
              <div className="font-bold text-lg mt-1">{selected.patient_name}</div>
              <div className="text-xs text-gray-500">{selected.uhid} · {selected.treatment_area?.replace('_', ' ')} · {selected.therapist_name}</div>
            </div>
            <button onClick={() => setSelected(null)} className="text-gray-400 text-lg">×</button>
          </div>

          <div className="flex gap-1 overflow-x-auto">{(['treatment', 'rom', 'strength', 'functional', 'outcome'] as const).map(t =>
            <button key={t} onClick={() => setDetailTab(t)} className={`flex-shrink-0 px-3 py-1.5 text-[10px] font-medium rounded-lg capitalize ${detailTab === t ? 'bg-teal-600 text-white' : 'bg-white border'}`}>{t === 'rom' ? 'ROM' : t === 'functional' ? 'Functional tests' : t}</button>
          )}</div>

          {/* TREATMENT */}
          {detailTab === 'treatment' && <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div><label className="text-[9px] text-gray-500">Pain before</label><input type="number" min="0" max="10" className="w-full px-2 py-1.5 border rounded text-xs" defaultValue={selected.pain_score_before || ''} onBlur={e => saveSessionField('pain_score_before', parseInt(e.target.value) || null)} /><span className="text-[9px] text-gray-400">/10</span></div>
              <div><label className="text-[9px] text-gray-500">Pain after</label><input type="number" min="0" max="10" className="w-full px-2 py-1.5 border rounded text-xs" defaultValue={selected.pain_score_after || ''} onBlur={e => saveSessionField('pain_score_after', parseInt(e.target.value) || null)} /><span className="text-[9px] text-gray-400">/10</span></div>
            </div>

            <h4 className="text-xs font-bold">Exercises ({(selected.exercise_prescription || []).length})</h4>
            {(selected.exercise_prescription || []).map((ex: any, i: number) => (
              <div key={i} className="bg-teal-50 rounded-lg p-2 text-xs flex items-center gap-2">
                <span className="font-bold">{ex.exercise}</span>
                <span>{ex.sets}×{ex.reps}{ex.hold_sec ? ` (${ex.hold_sec}s hold)` : ''}</span>
                {ex.resistance && ex.resistance !== 'body_weight' && <span className="text-gray-500">{ex.resistance}</span>}
                {ex.side && <span className="text-gray-400">{ex.side}</span>}
              </div>
            ))}
            <div className="bg-gray-50 rounded-lg p-3 space-y-2">
              <div className="grid grid-cols-5 gap-2">
                <div className="col-span-2"><label className="text-[9px] text-gray-500">Exercise</label><input value={ef.exercise} onChange={e => setEf(f => ({...f, exercise: e.target.value}))} className="w-full px-2 py-1 border rounded text-[10px]" placeholder="e.g. SLR, Wall slides" /></div>
                <div><label className="text-[9px] text-gray-500">Sets</label><input type="number" value={ef.sets} onChange={e => setEf(f => ({...f, sets: e.target.value}))} className="w-full px-2 py-1 border rounded text-[10px]" /></div>
                <div><label className="text-[9px] text-gray-500">Reps</label><input type="number" value={ef.reps} onChange={e => setEf(f => ({...f, reps: e.target.value}))} className="w-full px-2 py-1 border rounded text-[10px]" /></div>
                <div className="flex items-end"><button onClick={addExercise} disabled={!ef.exercise} className="w-full py-1 bg-teal-600 text-white text-[10px] rounded font-medium disabled:opacity-40">+ Add</button></div>
              </div>
              <div className="grid grid-cols-3 gap-2">
                <div><label className="text-[9px] text-gray-500">Hold (sec)</label><input type="number" value={ef.hold_sec} onChange={e => setEf(f => ({...f, hold_sec: e.target.value}))} className="w-full px-2 py-1 border rounded text-[10px]" /></div>
                <div><label className="text-[9px] text-gray-500">Resistance</label><select value={ef.resistance} onChange={e => setEf(f => ({...f, resistance: e.target.value}))} className="w-full px-2 py-1 border rounded text-[10px]"><option value="body_weight">Body weight</option><option value="theraband_yellow">Band (yellow)</option><option value="theraband_red">Band (red)</option><option value="theraband_green">Band (green)</option><option value="theraband_blue">Band (blue)</option><option value="theraband_black">Band (black)</option><option value="1kg">1 kg</option><option value="2kg">2 kg</option><option value="3kg">3 kg</option><option value="5kg">5 kg</option></select></div>
                <div><label className="text-[9px] text-gray-500">Side</label><select value={ef.side} onChange={e => setEf(f => ({...f, side: e.target.value}))} className="w-full px-2 py-1 border rounded text-[10px]"><option value="">Both</option><option value="left">Left</option><option value="right">Right</option></select></div>
              </div>
            </div>

            <div><label className="text-[9px] text-gray-500">Manual therapy / notes</label>
              <textarea className="w-full px-2 py-1.5 border rounded text-xs h-12 resize-none" defaultValue={selected.manual_therapy || ''} onBlur={e => saveSessionField('manual_therapy', e.target.value)} placeholder="e.g. Joint mobilization Gr III-IV, soft tissue release, dry needling trigger points" /></div>
            <div><label className="text-[9px] text-gray-500">Next session plan</label>
              <input className="w-full px-2 py-1.5 border rounded text-xs" defaultValue={selected.next_session_plan || ''} onBlur={e => saveSessionField('next_session_plan', e.target.value)} placeholder="Progress to closed chain exercises, add balance board" /></div>
          </div>}

          {/* ROM */}
          {detailTab === 'rom' && <div className="space-y-3">
            <h4 className="text-xs font-bold">ROM measurements ({(selected.rom_measurements || []).length})</h4>
            {(selected.rom_measurements || []).map((r: any, i: number) => (
              <div key={i} className="bg-blue-50 rounded-lg p-2 text-xs flex items-center gap-2">
                <span className="font-bold capitalize">{r.joint} {r.side}</span>
                <span>{r.movement}: A={r.active}° P={r.passive}°</span>
                {r.normal && <span className="text-gray-400">(normal: {r.normal}°)</span>}
                {r.pain_at_end && <span className="text-red-600">pain at end</span>}
              </div>
            ))}
            <div className="bg-gray-50 rounded-lg p-3 grid grid-cols-5 gap-2">
              <div><label className="text-[9px] text-gray-500">Joint</label><select value={romf.joint} onChange={e => setRomf(f => ({...f, joint: e.target.value}))} className="w-full px-2 py-1 border rounded text-[10px]">{['knee','shoulder','hip','ankle','wrist','elbow','cervical','lumbar','thoracic'].map(j => <option key={j}>{j}</option>)}</select></div>
              <div><label className="text-[9px] text-gray-500">Side</label><select value={romf.side} onChange={e => setRomf(f => ({...f, side: e.target.value}))} className="w-full px-2 py-1 border rounded text-[10px]"><option value="left">Left</option><option value="right">Right</option></select></div>
              <div><label className="text-[9px] text-gray-500">Movement</label><select value={romf.movement} onChange={e => setRomf(f => ({...f, movement: e.target.value}))} className="w-full px-2 py-1 border rounded text-[10px]">{['flexion','extension','abduction','adduction','internal_rotation','external_rotation','lateral_flexion','rotation'].map(m => <option key={m} value={m}>{m.replace('_', ' ')}</option>)}</select></div>
              <div><label className="text-[9px] text-gray-500">Active°</label><input type="number" value={romf.active} onChange={e => setRomf(f => ({...f, active: e.target.value}))} className="w-full px-2 py-1 border rounded text-[10px]" /></div>
              <div className="flex items-end"><button onClick={addROM} className="w-full py-1 bg-blue-600 text-white text-[10px] rounded font-medium">+ ROM</button></div>
              <div><label className="text-[9px] text-gray-500">Passive°</label><input type="number" value={romf.passive} onChange={e => setRomf(f => ({...f, passive: e.target.value}))} className="w-full px-2 py-1 border rounded text-[10px]" /></div>
              <div><label className="text-[9px] text-gray-500">Normal°</label><input type="number" value={romf.normal} onChange={e => setRomf(f => ({...f, normal: e.target.value}))} className="w-full px-2 py-1 border rounded text-[10px]" /></div>
              <div className="col-span-3"><label className="flex items-center gap-1 text-[10px]"><input type="checkbox" checked={romf.pain_at_end} onChange={e => setRomf(f => ({...f, pain_at_end: e.target.checked}))} className="rounded" /> Pain at end range</label></div>
            </div>
          </div>}

          {/* STRENGTH */}
          {detailTab === 'strength' && <div className="space-y-3">
            <h4 className="text-xs font-bold">Strength (MMT) ({(selected.strength_measurements || []).length})</h4>
            {(selected.strength_measurements || []).map((s: any, i: number) => (
              <div key={i} className="bg-purple-50 rounded-lg p-2 text-xs flex items-center gap-2">
                <span className="font-bold capitalize">{s.muscle_group} ({s.side})</span>
                <span className="font-bold text-purple-700">{s.grade}</span>
                <span className="text-gray-400">{s.method}</span>
              </div>
            ))}
            <div className="bg-gray-50 rounded-lg p-3 grid grid-cols-4 gap-2">
              <div><label className="text-[9px] text-gray-500">Muscle group</label><select value={strf.muscle_group} onChange={e => setStrf(f => ({...f, muscle_group: e.target.value}))} className="w-full px-2 py-1 border rounded text-[10px]"><option value="">Select</option>{['quadriceps','hamstrings','hip_flexors','hip_abductors','hip_adductors','glutes','calf','tibialis_anterior','deltoid','rotator_cuff','biceps','triceps','grip','core','trunk_flexors','trunk_extensors'].map(m => <option key={m} value={m}>{m.replace('_', ' ')}</option>)}</select></div>
              <div><label className="text-[9px] text-gray-500">Side</label><select value={strf.side} onChange={e => setStrf(f => ({...f, side: e.target.value}))} className="w-full px-2 py-1 border rounded text-[10px]"><option value="left">Left</option><option value="right">Right</option><option value="bilateral">Bilateral</option></select></div>
              <div><label className="text-[9px] text-gray-500">Grade</label><select value={strf.grade} onChange={e => setStrf(f => ({...f, grade: e.target.value}))} className="w-full px-2 py-1 border rounded text-[10px]">{['0/5','1/5','2-/5','2/5','2+/5','3-/5','3/5','3+/5','4-/5','4/5','4+/5','5/5'].map(g => <option key={g}>{g}</option>)}</select></div>
              <div className="flex items-end"><button onClick={addStrength} disabled={!strf.muscle_group} className="w-full py-1 bg-purple-600 text-white text-[10px] rounded font-medium disabled:opacity-40">+ Add</button></div>
            </div>
            <div><label className="text-[9px] text-gray-500">Special tests</label>
              <textarea className="w-full px-2 py-1.5 border rounded text-xs h-12 resize-none" defaultValue={JSON.stringify(selected.special_tests || [], null, 2)} placeholder='[{"test": "Lachman", "result": "positive"}]' /></div>
          </div>}

          {/* FUNCTIONAL TESTS */}
          {detailTab === 'functional' && <div className="space-y-3">
            <h4 className="text-xs font-bold">Functional tests ({(selected.functional_tests || []).length})</h4>
            {(selected.functional_tests || []).map((t: any, i: number) => (
              <div key={i} className="bg-amber-50 rounded-lg p-2 text-xs flex items-center gap-2">
                <span className="font-bold capitalize">{t.test?.replace(/_/g, ' ')}</span>
                <span className="font-bold text-amber-700">{t.result} {t.unit}</span>
                {t.side && <span className="text-gray-400">({t.side})</span>}
                {t.target && <span className="text-gray-500">target: {t.target}</span>}
              </div>
            ))}
            <div className="bg-gray-50 rounded-lg p-3 grid grid-cols-5 gap-2">
              <div><label className="text-[9px] text-gray-500">Test</label><select value={ftf.test} onChange={e => setFtf(f => ({...f, test: e.target.value}))} className="w-full px-2 py-1 border rounded text-[10px]"><option value="">Select</option>{['timed_up_and_go','single_leg_hop','y_balance_anterior','y_balance_pm','y_balance_pl','30sec_chair_stand','6min_walk','berg_balance','single_leg_squat','drop_jump','grip_strength','push_ups_1min','plank_hold'].map(t => <option key={t} value={t}>{t.replace(/_/g, ' ')}</option>)}</select></div>
              <div><label className="text-[9px] text-gray-500">Result</label><input value={ftf.result} onChange={e => setFtf(f => ({...f, result: e.target.value}))} className="w-full px-2 py-1 border rounded text-[10px]" /></div>
              <div><label className="text-[9px] text-gray-500">Unit</label><select value={ftf.unit} onChange={e => setFtf(f => ({...f, unit: e.target.value}))} className="w-full px-2 py-1 border rounded text-[10px]"><option value="">—</option><option value="seconds">sec</option><option value="cm">cm</option><option value="percent">%</option><option value="meters">m</option><option value="reps">reps</option><option value="kg">kg</option></select></div>
              <div><label className="text-[9px] text-gray-500">Side</label><select value={ftf.side} onChange={e => setFtf(f => ({...f, side: e.target.value}))} className="w-full px-2 py-1 border rounded text-[10px]"><option value="">N/A</option><option value="left">L</option><option value="right">R</option></select></div>
              <div className="flex items-end"><button onClick={addFunctionalTest} disabled={!ftf.test} className="w-full py-1 bg-amber-600 text-white text-[10px] rounded font-medium disabled:opacity-40">+ Test</button></div>
            </div>
            <div><label className="text-[9px] text-gray-500">Gait analysis</label>
              <textarea className="w-full px-2 py-1.5 border rounded text-xs h-12 resize-none" defaultValue={selected.gait_analysis ? JSON.stringify(selected.gait_analysis) : ''} placeholder="Pattern, aids, weight bearing, deviations..." /></div>
          </div>}

          {/* OUTCOME MEASURES */}
          {detailTab === 'outcome' && <div className="space-y-3">
            <h4 className="text-xs font-bold">Patient-reported</h4>
            <div className="grid grid-cols-3 gap-3">
              {[['pain_current','Pain now','/10'],['pain_worst','Worst pain','/10'],['confidence','Confidence','/10']].map(([key,label,unit]) => (
                <div key={key}><label className="text-[9px] text-gray-500">{label}</label>
                  <input type="number" min="0" max="10" className="w-full px-2 py-1.5 border rounded text-xs" defaultValue={selected.patient_reported?.[key] || ''} onBlur={e => {
                    const pr = { ...selected.patient_reported, [key]: parseInt(e.target.value) || null };
                    saveSessionField('patient_reported', pr);
                  }} /><span className="text-[9px] text-gray-400">{unit}</span></div>
              ))}
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div><label className="text-[9px] text-gray-500">Function level</label><select className="w-full px-2 py-1.5 border rounded text-xs" defaultValue={selected.patient_reported?.function_level || ''} onChange={e => saveSessionField('patient_reported', { ...selected.patient_reported, function_level: e.target.value })}>
                <option value="">—</option><option value="normal">Normal</option><option value="mild_difficulty">Mild difficulty</option><option value="moderate_difficulty">Moderate difficulty</option><option value="severe_difficulty">Severe difficulty</option><option value="unable">Unable</option></select></div>
              <div><label className="text-[9px] text-gray-500">Compliance</label><select className="w-full px-2 py-1.5 border rounded text-xs" defaultValue={selected.patient_reported?.compliance || ''} onChange={e => saveSessionField('patient_reported', { ...selected.patient_reported, compliance: e.target.value })}>
                <option value="">—</option><option value="excellent">Excellent</option><option value="good">Good</option><option value="fair">Fair</option><option value="poor">Poor</option></select></div>
            </div>

            <h4 className="text-xs font-bold mt-3">Home exercise program</h4>
            {(selected.home_exercise_program || []).map((ex: any, i: number) => (
              <div key={i} className="bg-green-50 rounded-lg p-2 text-xs">{ex.exercise} — {ex.sets}×{ex.reps} {ex.frequency}</div>
            ))}
          </div>}
        </div>
      </div>}
    </div>
  );
}

export default function PhysioPage() { return <RoleGuard module="ipd"><PhysioInner /></RoleGuard>; }
