'use client';
import React, { useState, useEffect, useMemo } from 'react';
import { RoleGuard } from '@/components/ui/shared';
import { useAuthStore } from '@/lib/store/auth';
import { useEndoscopy, useDecontamination, type EndoProcedure } from '@/lib/endoscopy/endoscopy-hooks';
import { sb } from '@/lib/supabase/browser';
import { CalendarOff, ShieldAlert } from 'lucide-react';

const TYPE_COLORS: Record<string, string> = { ogd: 'bg-blue-600', colonoscopy: 'bg-purple-600', ercp: 'bg-amber-600', eus: 'bg-teal-600', bronchoscopy: 'bg-indigo-600', sigmoidoscopy: 'bg-pink-600' };
const STATUS_COLORS: Record<string, string> = { scheduled: 'bg-blue-100 text-blue-700', in_progress: 'bg-amber-100 text-amber-700', completed: 'bg-green-100 text-green-700', cancelled: 'bg-red-100 text-red-700' };
const PROC_TYPES = ['ogd', 'colonoscopy', 'ercp', 'eus', 'bronchoscopy', 'sigmoidoscopy'];
const COMPLICATIONS = ['none', 'bleeding', 'perforation', 'aspiration', 'cardiopulmonary', 'infection', 'pancreatitis', 'pain', 'adverse_sedation'];
const OGD_REGIONS = ['esophagus_upper', 'esophagus_mid', 'esophagus_lower', 'gej', 'fundus', 'body', 'antrum', 'pylorus', 'duodenum_d1', 'duodenum_d2', 'ampulla'];
const COLON_REGIONS = ['rectum', 'sigmoid', 'descending', 'splenic_flexure', 'transverse', 'hepatic_flexure', 'ascending', 'cecum', 'terminal_ileum'];
const FINDINGS_LIST = ['normal', 'erosion', 'ulcer', 'polyp', 'mass', 'stricture', 'varices', 'inflammation', 'diverticulum', 'hiatal_hernia', 'barretts', 'candidiasis', 'foreign_body', 'bleeding', 'angiodysplasia'];

type Tab = 'schedule' | 'scopes' | 'decontamination' | 'analytics';

function EndoInner() {
  const { staff, activeCentreId } = useAuthStore();
  const centreId = activeCentreId || '';
  const staffId = staff?.id || '';
  const endo = useEndoscopy(centreId);
  const decon = useDecontamination(centreId);

  const [tab, setTab] = useState<Tab>('schedule');
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [toast, setToast] = useState('');
  const flash = (m: string) => { setToast(m); setTimeout(() => setToast(''), 3000); };

  const [showNew, setShowNew] = useState(false);
  const [selected, setSelected] = useState<EndoProcedure | null>(null);
  const [detailTab, setDetailTab] = useState<'findings' | 'biopsy' | 'therapy' | 'report'>('findings');

  const [doctors, setDoctors] = useState<any[]>([]);
  const [patSearch, setPatSearch] = useState('');
  const [patResults, setPatResults] = useState<any[]>([]);
  const [selPat, setSelPat] = useState<any>(null);

  useEffect(() => {
    if (!sb() || !centreId) return;
    sb().from('hmis_staff').select('id, full_name, specialisation').eq('staff_type', 'doctor').eq('is_active', true).order('full_name').then(({ data }: any) => setDoctors(data || []));
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

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { endo.load(date); }, [date]);

  const [sf, setSf] = useState({ procedure_type: 'ogd', indication: '', sedation_type: 'conscious', scope_id: '', endoscopist_id: '', scheduled_time: '09:00', is_emergency: false, asa_class: 'II' });

  const handleSchedule = async () => {
    if (!selPat || !sf.endoscopist_id) return;
    const res = await endo.schedule({
      patient_id: selPat.id, procedure_date: date, procedure_type: sf.procedure_type,
      indication: sf.indication, sedation_type: sf.sedation_type, scope_id: sf.scope_id,
      endoscopist_id: sf.endoscopist_id, scheduled_time: sf.scheduled_time + ':00',
      is_emergency: sf.is_emergency, asa_class: sf.asa_class,
    });
    if (res.success) { flash('Scheduled'); setShowNew(false); setSelPat(null); } else { flash(res.error || 'Operation failed'); }
  };

  const saveField = async (field: string, value: any) => {
    if (!selected) return;
    await endo.updateProcedure(selected.id, { [field]: value });
    setSelected(prev => prev ? { ...prev, [field]: value } : null);
  };

  // Finding form
  const [ff, setFf] = useState({ region: '', finding: 'normal', severity: 'mild', classification: '', notes: '' });
  const addFinding = async () => {
    if (!selected || !ff.region) return;
    const updated = [...(selected.structured_findings || []), { ...ff }];
    await saveField('structured_findings', updated);
    setFf({ region: '', finding: 'normal', severity: 'mild', classification: '', notes: '' });
  };

  // Biopsy form
  const [bf, setBf] = useState({ site: '', count: '1', technique: 'forceps', purpose: '' });
  const addBiopsy = async () => {
    if (!selected || !bf.site) return;
    const updated = [...(selected.biopsies || []), { ...bf, count: parseInt(bf.count) || 1 }];
    await saveField('biopsies', updated);
    await saveField('biopsy_taken', true);
    setBf({ site: '', count: '1', technique: 'forceps', purpose: '' });
    flash('Biopsy recorded');
  };

  // Polyp form
  const [pf, setPf] = useState({ location: '', size_mm: '', morphology: 'sessile', paris: '', removed: true, technique: 'snare' });
  const addPolyp = async () => {
    if (!selected || !pf.location) return;
    const updated = [...(selected.polyps_found || []), { ...pf, size_mm: parseInt(pf.size_mm) || 0 }];
    await saveField('polyps_found', updated);
    setPf({ location: '', size_mm: '', morphology: 'sessile', paris: '', removed: true, technique: 'snare' });
  };

  // Decontamination form
  const [df, setDf] = useState({ scope_id: '', scope_type: 'gastroscope', decontamination_method: 'aer', leak_test: 'pass', detergent_used: '', disinfectant_used: 'Cidex OPA' });

  const regions = useMemo(() => {
    if (!selected) return [];
    if (['colonoscopy', 'sigmoidoscopy'].includes(selected.procedure_type)) return COLON_REGIONS;
    return OGD_REGIONS;
  }, [selected]);

  return (
    <div className="max-w-7xl mx-auto space-y-4">
      {toast && <div className="fixed top-4 left-1/2 -translate-x-1/2 z-50 bg-emerald-600 text-white px-4 py-2 rounded-xl shadow-lg text-sm font-medium">{toast}</div>}

      <div className="flex items-center justify-between">
        <div><h1 className="text-xl font-bold">Endoscopy Unit</h1><p className="text-xs text-gray-500">Scope tracking, findings, decontamination chain</p></div>
        <div className="flex gap-2">
          <input type="date" value={date} onChange={e => setDate(e.target.value)} className="px-3 py-1.5 border rounded-lg text-xs" />
          <button onClick={() => setShowNew(true)} className="px-4 py-2 bg-teal-600 text-white text-xs rounded-lg font-medium hover:bg-teal-700">+ Schedule</button>
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-5 lg:grid-cols-10 gap-2">
        {[
          { l: 'Total', v: endo.stats.total }, { l: 'Done', v: endo.stats.completed },
          ...Object.entries(endo.stats.byType).slice(0, 4).map(([t, c]) => ({ l: t.toUpperCase(), v: c })),
          { l: 'Biopsy %', v: endo.stats.biopsyRate + '%' },
          { l: 'Therapy %', v: endo.stats.therapeuticRate + '%' },
          { l: 'Cecal %', v: endo.stats.cecalRate + '%' },
          { l: 'Scopes', v: `${endo.stats.scopesAvailable}/${endo.stats.scopesTotal}` },
        ].map(k => <div key={k.l} className="bg-white rounded-xl border p-2 text-center"><div className="text-[9px] text-gray-500">{k.l}</div><div className="text-lg font-bold">{k.v}</div></div>)}
      </div>

      <div className="flex gap-1">
        {(['schedule', 'scopes', 'decontamination', 'analytics'] as Tab[]).map(t =>
          <button key={t} onClick={() => setTab(t)} className={`px-4 py-2 text-xs font-medium rounded-lg capitalize ${tab === t ? 'bg-teal-600 text-white' : 'bg-white border hover:bg-gray-50'}`}>
            {t === 'schedule' ? `Today (${endo.procedures.length})` : t === 'scopes' ? `Scopes (${endo.scopes.length})` : t === 'decontamination' ? `Decontam (${decon.logs.length})` : 'Quality'}
          </button>
        )}
      </div>

      {/* ═══ SCHEDULE TAB ═══ */}
      {tab === 'schedule' && (endo.loading ? <div className="animate-pulse h-48 bg-gray-200 rounded-xl" /> :
        endo.procedures.length === 0 ? <div className="flex flex-col items-center py-12 bg-white rounded-xl border text-center"><CalendarOff className="w-8 h-8 text-gray-300 mb-2" aria-hidden="true" /><p className="text-sm font-medium text-gray-700">No endoscopy procedures scheduled</p><p className="text-xs text-gray-400 mt-1 max-w-sm">Register endoscopes in equipment settings to begin scheduling.</p></div> :
        <div className="space-y-2">
          {endo.procedures.map(p => (
            <div key={p.id} className={`bg-white rounded-xl border p-4 hover:shadow-md cursor-pointer ${p.is_emergency ? 'border-l-4 border-l-red-500' : ''}`} onClick={() => { setSelected(p); setDetailTab('findings'); }}>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  {p.scheduled_time && <span className="text-xs font-mono text-gray-500 w-14">{p.scheduled_time.slice(0, 5)}</span>}
                  <span className={`px-2 py-0.5 rounded text-[10px] text-white font-bold uppercase ${TYPE_COLORS[p.procedure_type] || 'bg-gray-600'}`}>{p.procedure_type}</span>
                  <div>
                    <span className="font-medium text-sm">{p.patient_name}</span>
                    <span className="text-[10px] text-gray-400 ml-2">{p.uhid} · {p.age}y {p.gender?.charAt(0).toUpperCase()}</span>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {p.biopsy_taken && <span className="text-[9px] bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded font-medium">Bx</span>}
                  {p.therapeutic_intervention && <span className="text-[9px] bg-purple-100 text-purple-700 px-1.5 py-0.5 rounded font-medium">Rx</span>}
                  {p.polyps_found.length > 0 && <span className="text-[9px] bg-red-100 text-red-700 px-1.5 py-0.5 rounded font-medium">{p.polyps_found.length} polyp{p.polyps_found.length > 1 ? 's' : ''}</span>}
                  <span className="text-[9px] text-gray-400">{p.scope_code || '—'}</span>
                  <span className={`px-2 py-0.5 rounded text-[9px] font-medium ${STATUS_COLORS[p.status]}`}>{p.status.replace('_', ' ')}</span>
                  {p.status === 'scheduled' && <button onClick={e => { e.stopPropagation(); endo.startProcedure(p.id); flash('Started'); }} className="px-2 py-1 bg-amber-100 text-amber-700 rounded text-[9px] font-medium hover:bg-amber-200">Start</button>}
                  {p.status === 'in_progress' && <button onClick={e => { e.stopPropagation(); endo.completeProcedure(p.id); flash('Completed'); }} className="px-2 py-1 bg-green-100 text-green-700 rounded text-[9px] font-medium hover:bg-green-200">Complete</button>}
                </div>
              </div>
              <div className="flex items-center gap-4 mt-1.5 text-[10px] text-gray-500">
                <span>{p.indication || '—'}</span>
                <span>Sedation: {p.sedation_type}</span>
                <span>Op: {p.endoscopist_name}</span>
                {p.structured_findings.length > 0 && <span className="text-red-600">{p.structured_findings.filter(f => f.finding !== 'normal').map(f => `${f.region}: ${f.finding}`).join(', ')}</span>}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ═══ SCOPES TAB ═══ */}
      {tab === 'scopes' && (endo.scopes.length === 0
        ? <div className="text-center py-12 bg-white rounded-xl border text-gray-400 text-sm">No scopes registered. Add via SQL or admin panel.</div>
        : <div className="grid grid-cols-3 gap-3">
          {endo.scopes.map(s => {
            const nextSvc = s.next_service_date ? new Date(s.next_service_date) : null;
            const overdue = nextSvc && nextSvc < new Date();
            return (
              <div key={s.id} className={`bg-white rounded-xl border p-4 ${s.status !== 'available' ? 'opacity-70' : ''} ${overdue ? 'border-red-300' : ''}`}>
                <div className="flex items-center justify-between mb-2">
                  <span className="font-bold text-sm">{s.scope_code}</span>
                  <span className={`text-[9px] px-1.5 py-0.5 rounded font-medium ${s.status === 'available' ? 'bg-green-100 text-green-700' : s.status === 'in_use' ? 'bg-amber-100 text-amber-700' : s.status === 'decontamination' ? 'bg-blue-100 text-blue-700' : 'bg-red-100 text-red-700'}`}>{s.status.replace('_', ' ')}</span>
                </div>
                <div className="text-xs text-gray-500">{s.scope_type.replace(/_/g, ' ')} · {s.brand} {s.model}</div>
                <div className="text-[10px] text-gray-400 mt-1">Serial: {s.serial_number}</div>
                <div className="flex justify-between mt-2 text-[10px]">
                  <span>Procedures: <b>{s.total_procedures}</b></span>
                  <span className={overdue ? 'text-red-600 font-bold' : ''}>Next svc: {nextSvc ? nextSvc.toLocaleDateString('en-IN', { day: '2-digit', month: 'short' }) : '—'}{overdue ? ' OVERDUE' : ''}</span>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ═══ DECONTAMINATION TAB ═══ */}
      {tab === 'decontamination' && <div className="space-y-4">
        <div className="bg-white rounded-xl border p-4 space-y-3">
          <h3 className="text-sm font-bold">Log Decontamination</h3>
          <div className="grid grid-cols-6 gap-2">
            <div><label className="text-[9px] text-gray-500">Scope ID</label><select value={df.scope_id} onChange={e => setDf(f => ({...f, scope_id: e.target.value}))} className="w-full px-2 py-1.5 border rounded text-xs">
              <option value="">Select</option>{endo.scopes.map(s => <option key={s.id} value={s.scope_code}>{s.scope_code} ({s.scope_type})</option>)}</select></div>
            <div><label className="text-[9px] text-gray-500">Method</label><select value={df.decontamination_method} onChange={e => setDf(f => ({...f, decontamination_method: e.target.value}))} className="w-full px-2 py-1.5 border rounded text-xs">
              <option value="aer">AER</option><option value="manual">Manual</option><option value="cidex">Cidex soak</option></select></div>
            <div><label className="text-[9px] text-gray-500">Leak test</label><select value={df.leak_test} onChange={e => setDf(f => ({...f, leak_test: e.target.value}))} className="w-full px-2 py-1.5 border rounded text-xs">
              <option value="pass">Pass</option><option value="fail">Fail</option></select></div>
            <div><label className="text-[9px] text-gray-500">Disinfectant</label><input value={df.disinfectant_used} onChange={e => setDf(f => ({...f, disinfectant_used: e.target.value}))} className="w-full px-2 py-1.5 border rounded text-xs" placeholder="Cidex OPA" /></div>
            <div><label className="text-[9px] text-gray-500">Detergent</label><input value={df.detergent_used} onChange={e => setDf(f => ({...f, detergent_used: e.target.value}))} className="w-full px-2 py-1.5 border rounded text-xs" /></div>
            <div className="flex items-end"><button onClick={async () => {
              if (!df.scope_id) return;
              const res = await decon.addLog({ scope_id: df.scope_id, scope_type: df.scope_type, decontamination_method: df.decontamination_method, leak_test: df.leak_test, disinfectant_used: df.disinfectant_used, detergent_used: df.detergent_used, performed_by: staffId, start_time: new Date().toISOString(), status: 'completed' });
              if (res.success) flash('Logged');
              else flash(res.error || 'Operation failed');
            }} className="w-full py-1.5 bg-teal-600 text-white text-xs rounded font-medium">Log</button></div>
          </div>
        </div>
        {decon.logs.length === 0 && <div className="flex flex-col items-center py-12 bg-white rounded-xl border text-center"><ShieldAlert className="w-8 h-8 text-gray-300 mb-2" aria-hidden="true" /><p className="text-sm font-medium text-gray-700">No decontamination logs</p><p className="text-xs text-gray-400 mt-1 max-w-sm">Log scope cleaning after each procedure for infection control compliance.</p></div>}
        {decon.logs.length > 0 && <div className="bg-white rounded-xl border overflow-hidden">
          <table className="w-full text-xs"><thead><tr className="bg-gray-50 border-b">
            <th className="p-2">Time</th><th className="p-2">Scope</th><th className="p-2">Type</th><th className="p-2">Method</th>
            <th className="p-2">Leak</th><th className="p-2">Disinfectant</th><th className="p-2">Culture</th><th className="p-2">By</th>
          </tr></thead><tbody>{decon.logs.map(l => (
            <tr key={l.id} className={`border-b ${l.leak_test === 'fail' ? 'bg-red-50' : ''}`}>
              <td className="p-2 text-[10px]">{new Date(l.created_at).toLocaleString('en-IN', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}</td>
              <td className="p-2 font-bold">{l.scope_id}</td>
              <td className="p-2 text-[10px]">{l.scope_type}</td>
              <td className="p-2 text-[10px] uppercase">{l.decontamination_method}</td>
              <td className="p-2"><span className={`text-[9px] px-1.5 py-0.5 rounded font-medium ${l.leak_test === 'pass' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>{l.leak_test}</span></td>
              <td className="p-2 text-[10px]">{l.disinfectant_used || '—'}</td>
              <td className="p-2"><span className={`text-[9px] px-1.5 py-0.5 rounded ${l.culture_result === 'negative' ? 'bg-green-100 text-green-700' : l.culture_result === 'positive' ? 'bg-red-100 text-red-700' : 'bg-gray-100 text-gray-500'}`}>{l.culture_result || 'pending'}</span></td>
              <td className="p-2 text-[10px]">{l.performed?.full_name || '—'}</td>
            </tr>
          ))}</tbody></table>
        </div>}
      </div>}

      {/* ═══ QUALITY/ANALYTICS TAB ═══ */}
      {tab === 'analytics' && <div className="grid grid-cols-2 gap-4">
        <div className="bg-white rounded-xl border p-5 space-y-3">
          <h3 className="text-sm font-bold">Quality indicators</h3>
          <div className="text-xs space-y-2">
            <div className="flex justify-between"><span>Cecal intubation rate (colonoscopy)</span><b className={endo.stats.cecalRate >= 95 ? 'text-green-600' : endo.stats.cecalRate >= 90 ? 'text-amber-600' : 'text-red-600'}>{endo.stats.cecalRate}%</b></div>
            <div className="flex justify-between text-[10px] text-gray-400"><span>Target: ≥95% (ASGE benchmark)</span><span /></div>
            <div className="flex justify-between"><span>Mean withdrawal time</span><b className={parseFloat(endo.stats.avgWithdrawal) >= 6 ? 'text-green-600' : 'text-red-600'}>{endo.stats.avgWithdrawal} min</b></div>
            <div className="flex justify-between text-[10px] text-gray-400"><span>Target: ≥6 min (ASGE)</span><span /></div>
            <div className="flex justify-between"><span>Complication rate</span><b className={parseFloat(endo.stats.complicationRate) <= 1 ? 'text-green-600' : 'text-red-600'}>{endo.stats.complicationRate}%</b></div>
            <div className="flex justify-between"><span>Biopsy rate</span><b>{endo.stats.biopsyRate}%</b></div>
            <div className="flex justify-between"><span>Therapeutic rate</span><b>{endo.stats.therapeuticRate}%</b></div>
          </div>
        </div>
        <div className="bg-white rounded-xl border p-5 space-y-3">
          <h3 className="text-sm font-bold">Procedure mix</h3>
          {Object.entries(endo.stats.byType).sort((a: any, b: any) => b[1] - a[1]).map(([type, count]) => (
            <div key={type} className="flex items-center gap-3">
              <span className="text-xs w-24 uppercase font-bold">{type}</span>
              <div className="flex-1 h-3 bg-gray-100 rounded-full overflow-hidden"><div className={`h-full rounded-full ${TYPE_COLORS[type] || 'bg-gray-500'}`} style={{ width: `${((count as number) / Math.max(1, endo.stats.total)) * 100}%` }} /></div>
              <span className="text-xs font-bold w-6 text-right">{count as number}</span>
            </div>
          ))}
        </div>
      </div>}

      {/* ═══ SCHEDULE MODAL ═══ */}
      {showNew && <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center" onClick={() => setShowNew(false)}>
        <div className="bg-white rounded-xl w-[550px] max-h-[90vh] overflow-y-auto p-5 space-y-4" onClick={e => e.stopPropagation()}>
          <div className="flex justify-between"><h3 className="font-bold text-sm">Schedule Endoscopy</h3><button onClick={() => setShowNew(false)} className="text-gray-400 text-lg">×</button></div>

          {selPat ? <div className="flex items-center gap-3 bg-blue-50 rounded-lg p-3"><span className="font-medium">{selPat.first_name} {selPat.last_name}</span><span className="text-xs text-gray-500">{selPat.uhid}</span><button onClick={() => setSelPat(null)} className="ml-auto text-xs text-red-500">×</button></div>
          : <div className="relative"><input value={patSearch} onChange={e => setPatSearch(e.target.value)} className="w-full px-3 py-2 border rounded-lg text-sm" placeholder="Search patient..." autoFocus />
            {patResults.length > 0 && <div className="absolute z-10 mt-1 w-full bg-white border rounded-lg shadow-lg max-h-40 overflow-y-auto">{patResults.map(p => <button key={p.id} onClick={() => { setSelPat(p); setPatSearch(''); setPatResults([]); }} className="w-full text-left px-3 py-2 text-xs hover:bg-blue-50 border-b">{p.first_name} {p.last_name} · {p.uhid}</button>)}</div>}</div>}

          <div>
            <label className="text-[9px] text-gray-500">Procedure</label>
            <div className="flex gap-1 mt-1 flex-wrap">{PROC_TYPES.map(t =>
              <button key={t} onClick={() => setSf(f => ({...f, procedure_type: t}))} className={`px-3 py-1.5 rounded-lg text-[10px] font-bold uppercase ${sf.procedure_type === t ? (TYPE_COLORS[t] || 'bg-gray-600') + ' text-white' : 'bg-gray-100 text-gray-500'}`}>{t}</button>
            )}</div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div><label className="text-[9px] text-gray-500">Indication</label><input value={sf.indication} onChange={e => setSf(f => ({...f, indication: e.target.value}))} className="w-full px-3 py-2 border rounded-lg text-sm" placeholder="GERD, screening, dysphagia..." /></div>
            <div><label className="text-[9px] text-gray-500">Sedation</label><select value={sf.sedation_type} onChange={e => setSf(f => ({...f, sedation_type: e.target.value}))} className="w-full px-3 py-2 border rounded-lg text-sm">
              <option value="local">Local</option><option value="conscious">Conscious</option><option value="deep">Deep</option><option value="ga">GA</option></select></div>
            <div><label className="text-[9px] text-gray-500">Endoscopist *</label><select value={sf.endoscopist_id} onChange={e => setSf(f => ({...f, endoscopist_id: e.target.value}))} className="w-full px-3 py-2 border rounded-lg text-sm">
              <option value="">Select</option>{doctors.map(d => <option key={d.id} value={d.id}>{d.full_name}</option>)}</select></div>
            <div><label className="text-[9px] text-gray-500">Time</label><input type="time" value={sf.scheduled_time} onChange={e => setSf(f => ({...f, scheduled_time: e.target.value}))} className="w-full px-3 py-2 border rounded-lg text-sm" /></div>
            <div><label className="text-[9px] text-gray-500">Scope</label><select value={sf.scope_id} onChange={e => setSf(f => ({...f, scope_id: e.target.value}))} className="w-full px-3 py-2 border rounded-lg text-sm">
              <option value="">Select</option>{endo.scopes.filter(s => s.status === 'available').map(s => <option key={s.id} value={s.scope_code}>{s.scope_code} ({s.scope_type})</option>)}</select></div>
            <div><label className="text-[9px] text-gray-500">ASA Class</label><select value={sf.asa_class} onChange={e => setSf(f => ({...f, asa_class: e.target.value}))} className="w-full px-3 py-2 border rounded-lg text-sm">
              {['I','II','III','IV'].map(c => <option key={c} value={c}>ASA {c}</option>)}</select></div>
          </div>
          <label className="flex items-center gap-2 text-xs"><input type="checkbox" checked={sf.is_emergency} onChange={e => setSf(f => ({...f, is_emergency: e.target.checked}))} className="rounded" /> Emergency</label>
          <button onClick={handleSchedule} disabled={!selPat || !sf.endoscopist_id} className="w-full py-2.5 bg-teal-600 text-white text-sm rounded-lg font-medium disabled:opacity-40 hover:bg-teal-700">Schedule</button>
        </div>
      </div>}

      {/* ═══ DETAIL DRAWER ═══ */}
      {selected && <div className="fixed inset-0 bg-black/50 z-50 flex justify-end" onClick={() => setSelected(null)}>
        <div className="w-[600px] bg-white h-full overflow-y-auto shadow-xl p-5 space-y-4" onClick={e => e.stopPropagation()}>
          <div className="flex justify-between items-start">
            <div>
              <div className="flex items-center gap-2">
                <span className={`px-2 py-0.5 rounded text-[10px] text-white font-bold uppercase ${TYPE_COLORS[selected.procedure_type] || 'bg-gray-600'}`}>{selected.procedure_type}</span>
                <span className={`px-2 py-0.5 rounded text-[9px] font-medium ${STATUS_COLORS[selected.status]}`}>{selected.status.replace('_', ' ')}</span>
              </div>
              <div className="font-bold text-lg mt-1">{selected.patient_name}</div>
              <div className="text-xs text-gray-500">{selected.uhid} · {selected.age}y · Scope: {selected.scope_code || '—'} · {selected.endoscopist_name}</div>
            </div>
            <button onClick={() => setSelected(null)} className="text-gray-400 text-lg">×</button>
          </div>

          <div className="flex gap-1">{(['findings', 'biopsy', 'therapy', 'report'] as const).map(t =>
            <button key={t} onClick={() => setDetailTab(t)} className={`px-3 py-1.5 text-[10px] font-medium rounded-lg capitalize ${detailTab === t ? 'bg-teal-600 text-white' : 'bg-white border'}`}>{t === 'biopsy' ? 'Biopsy/Polyps' : t}</button>
          )}</div>

          {/* FINDINGS */}
          {detailTab === 'findings' && <div className="space-y-3">
            {/* Prep quality for colonoscopy */}
            {['colonoscopy', 'sigmoidoscopy'].includes(selected.procedure_type) && <div className="grid grid-cols-3 gap-3">
              <div><label className="text-[9px] text-gray-500">Prep quality</label><select className="w-full px-2 py-1.5 border rounded text-xs" defaultValue={selected.prep_quality} onChange={e => saveField('prep_quality', e.target.value)}>
                <option value="">—</option>{['excellent','good','fair','poor','inadequate'].map(q => <option key={q}>{q}</option>)}</select></div>
              <div><label className="text-[9px] text-gray-500">Boston score (0-9)</label><input type="number" min="0" max="9" className="w-full px-2 py-1.5 border rounded text-xs" defaultValue={selected.boston_bowel_prep_score || ''} onBlur={e => saveField('boston_bowel_prep_score', parseInt(e.target.value) || null)} /></div>
              <div><label className="text-[9px] text-gray-500">Cecal intubation</label><div className="flex gap-1 mt-0.5">{[{v:true,l:'Yes'},{v:false,l:'No'}].map(o =>
                <button key={String(o.v)} onClick={() => saveField('cecal_intubation', o.v)} className={`flex-1 py-1 rounded text-[10px] ${selected.cecal_intubation === o.v ? (o.v ? 'bg-green-600 text-white' : 'bg-red-600 text-white') : 'bg-gray-100'}`}>{o.l}</button>
              )}</div></div>
            </div>}

            {selected.procedure_type === 'colonoscopy' && <div>
              <label className="text-[9px] text-gray-500">Withdrawal time (min)</label>
              <input type="number" step="0.5" className="w-32 px-2 py-1.5 border rounded text-xs" defaultValue={selected.withdrawal_time_min || ''} onBlur={e => saveField('withdrawal_time_min', parseFloat(e.target.value) || null)} />
            </div>}

            <div><label className="text-[9px] text-gray-500">Findings (free text)</label>
              <textarea className="w-full px-2 py-1.5 border rounded text-xs h-16 resize-none" defaultValue={selected.findings} onBlur={e => saveField('findings', e.target.value)} placeholder="Describe findings..." /></div>

            <h4 className="text-xs font-bold">Structured findings ({selected.structured_findings.length})</h4>
            {selected.structured_findings.map((f, i) => (
              <div key={i} className={`rounded-lg p-2 text-xs flex items-center gap-2 ${f.finding === 'normal' ? 'bg-green-50' : 'bg-red-50'}`}>
                <span className="font-bold">{f.region?.replace(/_/g, ' ')}</span>
                <span className={f.finding === 'normal' ? 'text-green-700' : 'text-red-700'}>{f.finding?.replace(/_/g, ' ')}</span>
                {f.classification && <span className="text-gray-500">({f.classification})</span>}
                {f.severity && f.finding !== 'normal' && <span className="text-gray-400">{f.severity}</span>}
              </div>
            ))}

            <div className="bg-gray-50 rounded-lg p-3 space-y-2">
              <div className="grid grid-cols-3 gap-2">
                <div><label className="text-[9px] text-gray-500">Region</label><select value={ff.region} onChange={e => setFf(f => ({...f, region: e.target.value}))} className="w-full px-2 py-1 border rounded text-[10px]">
                  <option value="">Select</option>{regions.map(r => <option key={r} value={r}>{r.replace(/_/g, ' ')}</option>)}</select></div>
                <div><label className="text-[9px] text-gray-500">Finding</label><select value={ff.finding} onChange={e => setFf(f => ({...f, finding: e.target.value}))} className="w-full px-2 py-1 border rounded text-[10px]">
                  {FINDINGS_LIST.map(f => <option key={f} value={f}>{f.replace(/_/g, ' ')}</option>)}</select></div>
                <div><label className="text-[9px] text-gray-500">Severity</label><select value={ff.severity} onChange={e => setFf(f => ({...f, severity: e.target.value}))} className="w-full px-2 py-1 border rounded text-[10px]">
                  <option value="mild">Mild</option><option value="moderate">Moderate</option><option value="severe">Severe</option></select></div>
              </div>
              <input value={ff.classification} onChange={e => setFf(f => ({...f, classification: e.target.value}))} className="w-full px-2 py-1 border rounded text-[10px]" placeholder="Classification (e.g. LA Grade B, Forrest IIa, Zargar Grade 2)" />
              <button onClick={addFinding} disabled={!ff.region} className="px-3 py-1.5 bg-teal-600 text-white text-[10px] rounded font-medium disabled:opacity-40">+ Add finding</button>
            </div>

            <h4 className="text-xs font-bold">Complications</h4>
            <div className="flex gap-1 flex-wrap">{COMPLICATIONS.map(c =>
              <button key={c} onClick={() => {
                const cur = selected.complications || [];
                const upd = c === 'none' ? ['none'] : cur.filter(x => x !== 'none').includes(c) ? cur.filter(x => x !== c) : [...cur.filter(x => x !== 'none'), c];
                saveField('complications', upd);
              }} className={`px-2 py-1 rounded text-[9px] capitalize ${(selected.complications || []).includes(c) ? (c === 'none' ? 'bg-green-600 text-white' : 'bg-red-600 text-white') : 'bg-gray-100 text-gray-500'}`}>{c.replace('_', ' ')}</button>
            )}</div>
          </div>}

          {/* BIOPSY / POLYPS */}
          {detailTab === 'biopsy' && <div className="space-y-3">
            <h4 className="text-xs font-bold">Biopsies ({selected.biopsies.length})</h4>
            {selected.biopsies.map((b, i) => (
              <div key={i} className="bg-amber-50 rounded-lg p-2 text-xs"><span className="font-bold">{b.site}</span> — {b.count}x {b.technique} <span className="text-gray-500">({b.purpose || 'histology'})</span></div>
            ))}
            <div className="bg-gray-50 rounded-lg p-3 grid grid-cols-4 gap-2">
              <div><label className="text-[9px] text-gray-500">Site</label><select value={bf.site} onChange={e => setBf(f => ({...f, site: e.target.value}))} className="w-full px-2 py-1 border rounded text-[10px]">
                <option value="">Select</option>{regions.map(r => <option key={r}>{r.replace(/_/g, ' ')}</option>)}</select></div>
              <div><label className="text-[9px] text-gray-500">Count</label><input type="number" min="1" value={bf.count} onChange={e => setBf(f => ({...f, count: e.target.value}))} className="w-full px-2 py-1 border rounded text-[10px]" /></div>
              <div><label className="text-[9px] text-gray-500">Technique</label><select value={bf.technique} onChange={e => setBf(f => ({...f, technique: e.target.value}))} className="w-full px-2 py-1 border rounded text-[10px]">
                <option value="forceps">Forceps</option><option value="snare">Snare</option><option value="bite_on_bite">Bite-on-bite</option></select></div>
              <div className="flex items-end"><button onClick={addBiopsy} disabled={!bf.site} className="w-full py-1 bg-amber-600 text-white text-[10px] rounded font-bold disabled:opacity-40">+ Bx</button></div>
            </div>
            <input value={bf.purpose} onChange={e => setBf(f => ({...f, purpose: e.target.value}))} className="w-full px-2 py-1.5 border rounded text-xs" placeholder="Purpose: H.pylori CLO, histology, Barrett's surveillance..." />

            <h4 className="text-xs font-bold mt-4">Polyps ({selected.polyps_found.length})</h4>
            {selected.polyps_found.map((p, i) => (
              <div key={i} className="bg-red-50 rounded-lg p-2 text-xs"><span className="font-bold">{p.location?.replace(/_/g, ' ')}</span> — {p.size_mm}mm {p.morphology} {p.paris && `(Paris ${p.paris})`} {p.removed ? <span className="text-green-600">removed ({p.technique})</span> : <span className="text-red-600">not removed</span>}</div>
            ))}
            <div className="bg-gray-50 rounded-lg p-3 grid grid-cols-5 gap-2">
              <div><label className="text-[9px] text-gray-500">Location</label><select value={pf.location} onChange={e => setPf(f => ({...f, location: e.target.value}))} className="w-full px-2 py-1 border rounded text-[10px]">
                <option value="">Select</option>{regions.map(r => <option key={r} value={r}>{r.replace(/_/g, ' ')}</option>)}</select></div>
              <div><label className="text-[9px] text-gray-500">Size mm</label><input type="number" value={pf.size_mm} onChange={e => setPf(f => ({...f, size_mm: e.target.value}))} className="w-full px-2 py-1 border rounded text-[10px]" /></div>
              <div><label className="text-[9px] text-gray-500">Morphology</label><select value={pf.morphology} onChange={e => setPf(f => ({...f, morphology: e.target.value}))} className="w-full px-2 py-1 border rounded text-[10px]">
                {['sessile','pedunculated','flat','depressed'].map(m => <option key={m}>{m}</option>)}</select></div>
              <div><label className="text-[9px] text-gray-500">Paris</label><select value={pf.paris} onChange={e => setPf(f => ({...f, paris: e.target.value}))} className="w-full px-2 py-1 border rounded text-[10px]">
                <option value="">—</option>{['0-Ip','0-Is','0-IIa','0-IIb','0-IIc','0-III'].map(p => <option key={p}>{p}</option>)}</select></div>
              <div className="flex items-end"><button onClick={addPolyp} disabled={!pf.location} className="w-full py-1 bg-red-600 text-white text-[10px] rounded font-bold disabled:opacity-40">+ Polyp</button></div>
            </div>
          </div>}

          {/* THERAPY */}
          {detailTab === 'therapy' && <div className="space-y-3">
            <div><label className="text-[9px] text-gray-500">Therapeutic intervention</label>
              <input className="w-full px-2 py-1.5 border rounded text-xs" defaultValue={selected.therapeutic_intervention} onBlur={e => saveField('therapeutic_intervention', e.target.value)} placeholder="e.g. Polypectomy, EVL, balloon dilatation, stenting" /></div>

            {selected.procedure_type === 'ercp' && <div className="space-y-2">
              <h4 className="text-xs font-bold">ERCP details</h4>
              <div className="grid grid-cols-3 gap-2">
                {['sphincterotomy','stone_extraction','stent_placed','balloon_sweep'].map(k => {
                  const val = selected.therapeutic_details?.[k];
                  return <label key={k} className="flex items-center gap-2 text-xs bg-gray-50 rounded px-2 py-1.5 cursor-pointer">
                    <input type="checkbox" checked={!!val} onChange={() => {
                      const td = { ...selected.therapeutic_details, [k]: !val };
                      saveField('therapeutic_details', td);
                    }} className="rounded" />{k.replace(/_/g, ' ')}</label>;
                })}
              </div>
            </div>}

            {selected.procedure_type === 'ogd' && <div className="space-y-2">
              <h4 className="text-xs font-bold">OGD therapeutic</h4>
              <div className="grid grid-cols-2 gap-2">
                {['evl_banding','sclerotherapy','apc','hemoclip','dilatation','foreign_body_removal'].map(k => {
                  const val = selected.therapeutic_details?.[k];
                  return <label key={k} className="flex items-center gap-2 text-xs bg-gray-50 rounded px-2 py-1.5 cursor-pointer">
                    <input type="checkbox" checked={!!val} onChange={() => {
                      const td = { ...selected.therapeutic_details, [k]: !val };
                      saveField('therapeutic_details', td);
                    }} className="rounded" />{k.replace(/_/g, ' ').toUpperCase()}</label>;
                })}
              </div>
              {selected.therapeutic_details?.evl_banding && <div>
                <label className="text-[9px] text-gray-500">Varices grade / bands placed</label>
                <div className="flex gap-2">
                  <select className="px-2 py-1.5 border rounded text-xs" defaultValue={selected.therapeutic_details?.varices_grade || ''} onChange={e => saveField('therapeutic_details', { ...selected.therapeutic_details, varices_grade: e.target.value })}>
                    <option value="">Grade</option>{['I','II','III','IV'].map(g => <option key={g}>{g}</option>)}</select>
                  <input type="number" className="w-20 px-2 py-1.5 border rounded text-xs" placeholder="Bands" defaultValue={selected.therapeutic_details?.bands_placed || ''} onBlur={e => saveField('therapeutic_details', { ...selected.therapeutic_details, bands_placed: parseInt(e.target.value) || 0 })} />
                </div>
              </div>}
            </div>}

            <label className="flex items-center gap-2 text-xs"><input type="checkbox" checked={selected.photo_documentation} onChange={() => saveField('photo_documentation', !selected.photo_documentation)} className="rounded" /> Photo documentation done</label>
          </div>}

          {/* REPORT */}
          {detailTab === 'report' && <div className="space-y-3">
            <div><label className="text-[9px] text-gray-500">Final report</label>
              <textarea className="w-full px-2 py-1.5 border rounded text-xs h-32 resize-none" defaultValue={selected.report} onBlur={e => saveField('report', e.target.value)} placeholder="Endoscopy report..." /></div>
            <div><label className="text-[9px] text-gray-500">Recovery notes</label>
              <textarea className="w-full px-2 py-1.5 border rounded text-xs h-16 resize-none" defaultValue={selected.recovery_notes} onBlur={e => saveField('recovery_notes', e.target.value)} placeholder="Post-procedure recovery..." /></div>
            <div><label className="text-[9px] text-gray-500">Follow-up plan</label>
              <input className="w-full px-2 py-1.5 border rounded text-xs" defaultValue={selected.follow_up_plan} onBlur={e => saveField('follow_up_plan', e.target.value)} placeholder="e.g. Repeat OGD in 6 weeks, histology follow-up" /></div>
          </div>}
        </div>
      </div>}
    </div>
  );
}

export default function EndoscopyPage() { return <RoleGuard module="ot"><EndoInner /></RoleGuard>; }
