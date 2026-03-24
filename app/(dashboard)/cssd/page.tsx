'use client';
import React, { useState, useMemo } from 'react';
import { RoleGuard } from '@/components/ui/shared';
import { useAuthStore } from '@/lib/store/auth';
import { useCssd, type InstrumentSet, type SterilizationCycle, type IssueReturn } from '@/lib/cssd/cssd-hooks';

const STATUS_COLORS: Record<string, string> = { available: 'bg-green-100 text-green-700', in_use: 'bg-amber-100 text-amber-700', sterilizing: 'bg-blue-100 text-blue-700', maintenance: 'bg-red-100 text-red-700' };
const CYCLE_STATUS: Record<string, string> = { in_progress: 'bg-blue-100 text-blue-700', completed: 'bg-green-100 text-green-700', failed: 'bg-red-600 text-white', recalled: 'bg-red-100 text-red-700' };
const BI_COLORS: Record<string, string> = { pass: 'bg-green-100 text-green-700', fail: 'bg-red-600 text-white', pending: 'bg-amber-100 text-amber-700', positive: 'bg-red-600 text-white', negative: 'bg-green-100 text-green-700' };
const DEPARTMENTS = ['General Surgery', 'Orthopaedics', 'Neurosurgery', 'Cardiology', 'CTVS', 'Urology', 'Gynaecology', 'ENT', 'Ophthalmology', 'Dental', 'ER', 'ICU', 'Labour Room'];
const LOCATIONS = ['OT-1', 'OT-2', 'OT-3', 'OT-4', 'OT-5', 'OT-6', 'ER', 'ICU', 'Labour Room', 'Procedure Room', 'Ward'];
const CATEGORIES = ['surgical', 'minor_procedure', 'delivery', 'dressing', 'special', 'implant'];

type Tab = 'sets' | 'cycles' | 'issue_return' | 'autoclaves' | 'analytics';

function CssdInner() {
  const { staff, activeCentreId } = useAuthStore();
  const centreId = activeCentreId || ''; const staffId = staff?.id || '';
  const cssd = useCssd(centreId);

  const [tab, setTab] = useState<Tab>('sets');
  const [toast, setToast] = useState('');
  const flash = (m: string) => { setToast(m); setTimeout(() => setToast(''), 3000); };
  const [statusFilter, setStatusFilter] = useState('all');

  // Modals
  const [showNewSet, setShowNewSet] = useState(false);
  const [showNewCycle, setShowNewCycle] = useState(false);
  const [showIssue, setShowIssue] = useState<InstrumentSet | null>(null);
  const [showReturn, setShowReturn] = useState<IssueReturn | null>(null);
  const [showCycleDetail, setShowCycleDetail] = useState<SterilizationCycle | null>(null);

  // Set form
  const [sf, setSf] = useState({ set_name: '', set_code: '', department: '', category: 'surgical', total_instruments: '', max_cycles: '500', pack_type: 'wrapped', sterility_expiry_hours: '72', barcode: '' });

  // Cycle form
  const [cf, setCf] = useState({ autoclave_number: '', cycle_type: 'prevacuum', temperature: '134', pressure: '2.1', duration_minutes: '20', exposure_time_min: '4', dry_time_min: '10', bowie_dick_result: 'na', selectedSets: [] as string[] });

  // Issue form
  const [isf, setIsf] = useState({ issued_to: '', issued_to_location: '', surgery_name: '' });

  // Return form
  const [rf, setRf] = useState({ condition: 'good', missing_items: '', instrument_count_verified: true, sharps_count_match: true, contamination_level: 'minimal', return_wash_done: false });

  const toggleSetInCycle = (id: string) => setCf(f => ({ ...f, selectedSets: f.selectedSets.includes(id) ? f.selectedSets.filter(x => x !== id) : [...f.selectedSets, id] }));

  const handleCreateSet = async () => {
    if (!sf.set_name) return;
    const res = await cssd.createSet({ set_name: sf.set_name, set_code: sf.set_code || `SET-${Date.now().toString(36).toUpperCase()}`, department: sf.department, category: sf.category, total_instruments: parseInt(sf.total_instruments) || 0, max_cycles: parseInt(sf.max_cycles) || 500, pack_type: sf.pack_type, sterility_expiry_hours: parseInt(sf.sterility_expiry_hours) || 72, barcode: sf.barcode });
    if (res.success) { flash('Set created'); setShowNewSet(false); } else { flash(res.error || 'Operation failed'); }
  };

  const handleStartCycle = async () => {
    if (cf.selectedSets.length === 0) return;
    const loadItems = cf.selectedSets.map(id => { const s = cssd.sets.find(x => x.id === id); return { set_id: id, set_name: s?.set_name || '', set_code: s?.set_code || '' }; });
    const res = await cssd.startCycle({ autoclave_number: cf.autoclave_number, cycle_type: cf.cycle_type, temperature: parseFloat(cf.temperature), pressure: parseFloat(cf.pressure), duration_minutes: parseInt(cf.duration_minutes) || 20, exposure_time_min: parseInt(cf.exposure_time_min) || 4, dry_time_min: parseInt(cf.dry_time_min) || 10, bowie_dick_result: cf.bowie_dick_result, load_items: loadItems }, staffId);
    if (res.success) { flash('Cycle started'); setShowNewCycle(false); setCf(c => ({ ...c, selectedSets: [] })); } else { flash(res.error || 'Operation failed'); }
  };

  const handleIssue = async () => {
    if (!showIssue || !isf.issued_to_location) return;
    const res = await cssd.issueSet({ set_id: showIssue.id, issued_to: isf.issued_to, issued_to_location: isf.issued_to_location, surgery_name: isf.surgery_name, staffId });
    if (res.success) { flash(`${showIssue.set_name} issued to ${isf.issued_to_location}`); setShowIssue(null); } else { flash(res.error || 'Operation failed'); }
  };

  const handleReturn = async () => {
    if (!showReturn) return;
    const res = await cssd.returnSet(showReturn.id, showReturn.set_id, staffId, { condition: rf.condition, missing_items: rf.missing_items ? rf.missing_items.split(',').map(s => s.trim()).filter(Boolean) : [], instrument_count_verified: rf.instrument_count_verified, sharps_count_match: rf.sharps_count_match, contamination_level: rf.contamination_level, return_wash_done: rf.return_wash_done });
    if (res.success) { flash('Set returned'); setShowReturn(null); } else { flash(res.error || 'Operation failed'); }
  };

  const filteredSets = useMemo(() => {
    if (statusFilter === 'all') return cssd.sets;
    if (statusFilter === 'expired') return cssd.sets.filter(s => s.isExpired);
    return cssd.sets.filter(s => s.status === statusFilter);
  }, [cssd.sets, statusFilter]);

  const pendingReturns = useMemo(() => cssd.issues.filter(i => !i.returned_at), [cssd.issues]);

  return (
    <div className="max-w-7xl mx-auto space-y-4">
      {toast && <div className="fixed top-4 left-1/2 -translate-x-1/2 z-50 bg-emerald-600 text-white px-4 py-2 rounded-xl shadow-lg text-sm font-medium">{toast}</div>}

      <div className="flex items-center justify-between">
        <div><h1 className="text-xl font-bold">CSSD</h1><p className="text-xs text-gray-500">Central Sterile Supply Department — instrument lifecycle, sterilization, issue/return</p></div>
        <div className="flex gap-2">
          <button onClick={() => setShowNewCycle(true)} className="px-4 py-2 bg-blue-600 text-white text-xs rounded-lg font-medium hover:bg-blue-700">+ Start Cycle</button>
          <button onClick={() => setShowNewSet(true)} className="px-4 py-2 bg-teal-600 text-white text-xs rounded-lg font-medium hover:bg-teal-700">+ New Set</button>
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-6 lg:grid-cols-12 gap-2">
        {[
          { l: 'Total Sets', v: cssd.stats.totalSets }, { l: 'Available', v: cssd.stats.available },
          { l: 'In Use', v: cssd.stats.inUse }, { l: 'Sterilizing', v: cssd.stats.sterilizing },
          { l: 'Expired', v: cssd.stats.expired, warn: cssd.stats.expired > 0 },
          { l: 'Expiring <12h', v: cssd.stats.expiringSoon, warn: cssd.stats.expiringSoon > 0 },
          { l: 'Cycles Today', v: cssd.stats.cyclesToday },
          { l: 'Failed', v: cssd.stats.failedCycles, warn: cssd.stats.failedCycles > 0 },
          { l: 'Recalled', v: cssd.stats.recalledCycles, warn: cssd.stats.recalledCycles > 0 },
          { l: 'Pending Return', v: cssd.stats.pendingReturn, warn: cssd.stats.pendingReturn > 0 },
          { l: 'High Cycle Life', v: cssd.stats.highCycleLife, warn: cssd.stats.highCycleLife > 0 },
          { l: 'Autoclaves', v: `${cssd.stats.autoclavesBusy}/${cssd.stats.autoclaves}` },
        ].map(k => <div key={k.l} className={`${k.warn ? 'bg-red-50' : 'bg-white'} rounded-xl border p-2 text-center`}><div className="text-[8px] text-gray-500 leading-tight">{k.l}</div><div className={`text-lg font-bold ${k.warn ? 'text-red-600' : ''}`}>{k.v}</div></div>)}
      </div>

      <div className="flex gap-1">
        {(['sets', 'cycles', 'issue_return', 'autoclaves', 'analytics'] as Tab[]).map(t =>
          <button key={t} onClick={() => setTab(t)} className={`px-4 py-2 text-xs font-medium rounded-lg ${tab === t ? 'bg-teal-600 text-white' : 'bg-white border hover:bg-gray-50'}`}>
            {t === 'sets' ? `Sets (${cssd.sets.length})` : t === 'cycles' ? `Cycles (${cssd.cycles.length})` : t === 'issue_return' ? `Issue/Return (${pendingReturns.length} pending)` : t === 'autoclaves' ? `Autoclaves (${cssd.autoclaves.length})` : 'Analytics'}
          </button>
        )}
      </div>

      {/* ═══ SETS TAB ═══ */}
      {tab === 'sets' && <>
        <div className="flex gap-1">{['all', 'available', 'in_use', 'sterilizing', 'expired'].map(s =>
          <button key={s} onClick={() => setStatusFilter(s)} className={`px-2 py-1 text-[10px] rounded-lg ${statusFilter === s ? 'bg-teal-100 text-teal-700 font-bold' : 'bg-white border text-gray-500'}`}>{s === 'all' ? 'All' : s.replace('_', ' ')}</button>
        )}</div>
        {filteredSets.length === 0 ? <div className="text-center py-12 bg-white rounded-xl border text-gray-400 text-sm">No sets found</div> :
        <div className="bg-white rounded-xl border overflow-x-auto">
          <table className="w-full text-xs"><thead><tr className="bg-gray-50 border-b">
            <th className="p-2 text-left">Code</th><th className="p-2 text-left">Name</th><th className="p-2">Dept</th>
            <th className="p-2">Category</th><th className="p-2">Pack</th><th className="p-2">Instruments</th>
            <th className="p-2">Status</th><th className="p-2">Last Sterile</th><th className="p-2">Expiry</th>
            <th className="p-2">Cycle Life</th><th className="p-2">Actions</th>
          </tr></thead><tbody>{filteredSets.map(s => (
            <tr key={s.id} className={`border-b hover:bg-gray-50 ${s.isExpired && s.status === 'available' ? 'bg-red-50/50' : ''}`}>
              <td className="p-2 font-mono text-[10px]">{s.set_code || '—'}</td>
              <td className="p-2 font-medium">{s.set_name}</td>
              <td className="p-2 text-center text-[10px]">{s.department || '—'}</td>
              <td className="p-2 text-center"><span className="text-[9px] bg-gray-100 px-1.5 py-0.5 rounded capitalize">{s.category || '—'}</span></td>
              <td className="p-2 text-center text-[10px] capitalize">{s.pack_type}</td>
              <td className="p-2 text-center font-bold">{s.total_instruments}</td>
              <td className="p-2 text-center"><span className={`text-[9px] px-1.5 py-0.5 rounded font-medium ${STATUS_COLORS[s.status] || 'bg-gray-100'}`}>{s.status.replace('_', ' ')}</span></td>
              <td className="p-2 text-center text-[10px]">{s.last_sterilized_at ? new Date(s.last_sterilized_at).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }) : 'Never'}</td>
              <td className="p-2 text-center">{s.status === 'available' && s.sterility_expires_at ? (
                s.isExpired ? <span className="text-[9px] bg-red-600 text-white px-1.5 py-0.5 rounded font-bold">EXPIRED</span>
                : s.hoursUntilExpiry !== null && s.hoursUntilExpiry <= 12 ? <span className="text-[9px] bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded font-medium">{s.hoursUntilExpiry}h left</span>
                : <span className="text-[10px] text-green-600">{s.hoursUntilExpiry}h</span>
              ) : '—'}</td>
              <td className="p-2 text-center"><div className="w-12 h-2 bg-gray-200 rounded-full overflow-hidden inline-block"><div className={`h-full rounded-full ${s.cycleLifePct >= 90 ? 'bg-red-500' : s.cycleLifePct >= 70 ? 'bg-amber-500' : 'bg-green-500'}`} style={{ width: `${s.cycleLifePct}%` }} /></div>
                <div className="text-[9px] text-gray-400">{s.sterilization_count}/{s.max_cycles}</div></td>
              <td className="p-2">
                <div className="flex gap-0.5">
                  {s.status === 'available' && !s.isExpired && <button onClick={() => { setShowIssue(s); setIsf({ issued_to: '', issued_to_location: '', surgery_name: '' }); }} className="px-2 py-1 bg-amber-50 text-amber-700 rounded text-[9px] font-medium hover:bg-amber-100">Issue</button>}
                  {s.isExpired && s.status === 'available' && <span className="px-2 py-1 bg-red-50 text-red-600 rounded text-[9px]">Re-sterilize</span>}
                </div>
              </td>
            </tr>
          ))}</tbody></table>
        </div>}
      </>}

      {/* ═══ CYCLES TAB ═══ */}
      {tab === 'cycles' && (cssd.cycles.length === 0 ? <div className="text-center py-12 bg-white rounded-xl border text-gray-400 text-sm">No cycles — start one</div> :
        <div className="bg-white rounded-xl border overflow-x-auto">
          <table className="w-full text-xs"><thead><tr className="bg-gray-50 border-b">
            <th className="p-2">Cycle #</th><th className="p-2">Autoclave</th><th className="p-2">Type</th>
            <th className="p-2 text-left">Sets</th><th className="p-2">Temp/Press</th>
            <th className="p-2">B-D Test</th><th className="p-2">BI Result</th><th className="p-2">BI 24h</th>
            <th className="p-2">Printout</th><th className="p-2">Operator</th><th className="p-2">Status</th><th className="p-2">Actions</th>
          </tr></thead><tbody>{cssd.cycles.map(c => (
            <tr key={c.id} className={`border-b hover:bg-gray-50 ${c.recalled ? 'bg-red-50/50' : c.status === 'failed' ? 'bg-red-50/30' : ''}`}>
              <td className="p-2 font-mono text-[10px]">{c.cycle_number}</td>
              <td className="p-2 text-center">{c.autoclave_number || '—'}</td>
              <td className="p-2 text-center"><span className="text-[9px] bg-gray-100 px-1.5 py-0.5 rounded capitalize">{c.cycle_type}</span></td>
              <td className="p-2 text-[10px]">{c.load_items.map((i: any) => i.set_name || i.set_code).join(', ')}</td>
              <td className="p-2 text-center text-[10px]">{c.temperature}°C / {c.pressure}bar</td>
              <td className="p-2 text-center"><span className={`text-[9px] px-1.5 py-0.5 rounded font-medium ${BI_COLORS[c.bowie_dick_result] || 'bg-gray-100'}`}>{c.bowie_dick_result === 'na' ? 'N/A' : c.bowie_dick_result}</span></td>
              <td className="p-2 text-center"><span className={`text-[9px] px-1.5 py-0.5 rounded font-medium ${BI_COLORS[c.bi_test_result]}`}>{c.bi_test_result}</span></td>
              <td className="p-2 text-center"><span className={`text-[9px] px-1.5 py-0.5 rounded ${BI_COLORS[c.bi_reading_24h]}`}>{c.bi_reading_24h}</span></td>
              <td className="p-2 text-center">{c.printout_attached ? <span className="text-green-600">✓</span> : <span className="text-gray-300">—</span>}</td>
              <td className="p-2 text-[10px]">{c.operator_name}</td>
              <td className="p-2 text-center">
                <span className={`text-[9px] px-1.5 py-0.5 rounded font-medium ${CYCLE_STATUS[c.status] || 'bg-gray-100'}`}>{c.status}</span>
                {c.recalled && <div className="text-[8px] text-red-600 font-bold mt-0.5">RECALLED</div>}
              </td>
              <td className="p-2">
                <div className="flex gap-0.5 flex-wrap">
                  {c.status === 'in_progress' && <>
                    <button onClick={() => { cssd.completeCycle(c.id, 'pass'); flash('Cycle passed'); }} className="px-1.5 py-0.5 bg-green-100 text-green-700 rounded text-[9px] font-medium">Pass</button>
                    <button onClick={() => { cssd.completeCycle(c.id, 'fail'); flash('FAILED — sets need re-sterilization'); }} className="px-1.5 py-0.5 bg-red-100 text-red-700 rounded text-[9px] font-medium">Fail</button>
                  </>}
                  {c.status === 'completed' && !c.recalled && <button onClick={() => { cssd.recallCycle(c.id, 'BI test positive at 24h', staffId); flash('RECALL initiated'); }} className="px-1.5 py-0.5 bg-red-50 text-red-600 rounded text-[9px]">Recall</button>}
                  <button onClick={() => setShowCycleDetail(c)} className="px-1.5 py-0.5 bg-gray-100 rounded text-[9px]">Detail</button>
                </div>
              </td>
            </tr>
          ))}</tbody></table>
        </div>
      )}

      {/* ═══ ISSUE/RETURN TAB ═══ */}
      {tab === 'issue_return' && <div className="space-y-4">
        {pendingReturns.length > 0 && <div className="bg-amber-50 rounded-xl border border-amber-200 p-4">
          <h3 className="text-sm font-bold text-amber-800 mb-2">Pending Returns ({pendingReturns.length})</h3>
          <div className="space-y-1">{pendingReturns.map(i => (
            <div key={i.id} className="flex items-center justify-between bg-white rounded-lg p-2">
              <div className="text-xs"><span className="font-bold">{i.set_name}</span> <span className="text-gray-400">{i.set_code}</span> → {i.issued_to_location} {i.surgery_name && <span className="text-gray-500">({i.surgery_name})</span>}</div>
              <div className="flex items-center gap-2">
                <span className="text-[10px] text-gray-400">{new Date(i.issued_at).toLocaleString('en-IN', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}</span>
                <button onClick={() => { setShowReturn(i); setRf({ condition: 'good', missing_items: '', instrument_count_verified: true, sharps_count_match: true, contamination_level: 'minimal', return_wash_done: false }); }} className="px-2 py-1 bg-teal-600 text-white rounded text-[9px] font-medium">Return</button>
              </div>
            </div>
          ))}</div>
        </div>}

        <div className="bg-white rounded-xl border overflow-x-auto">
          <table className="w-full text-xs"><thead><tr className="bg-gray-50 border-b">
            <th className="p-2 text-left">Set</th><th className="p-2">Location</th><th className="p-2">Surgery</th>
            <th className="p-2">Patient</th><th className="p-2">Pack</th><th className="p-2">CI</th>
            <th className="p-2">Issued</th><th className="p-2">Returned</th><th className="p-2">Condition</th>
            <th className="p-2">Sharps ✓</th>
          </tr></thead><tbody>{cssd.issues.slice(0, 50).map(i => (
            <tr key={i.id} className={`border-b ${!i.returned_at ? 'bg-amber-50/30' : ''}`}>
              <td className="p-2"><span className="font-medium">{i.set_name}</span> <span className="text-[10px] text-gray-400">{i.set_code}</span></td>
              <td className="p-2 text-center text-[10px]">{i.issued_to_location}</td>
              <td className="p-2 text-[10px]">{i.surgery_name || '—'}</td>
              <td className="p-2 text-[10px]">{i.patient_name || '—'}</td>
              <td className="p-2 text-center"><span className={`text-[9px] px-1 py-0.5 rounded ${i.pack_integrity === 'intact' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>{i.pack_integrity}</span></td>
              <td className="p-2 text-center"><span className={`text-[9px] px-1 py-0.5 rounded ${i.ci_indicator === 'changed' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>{i.ci_indicator}</span></td>
              <td className="p-2 text-[10px]">{new Date(i.issued_at).toLocaleString('en-IN', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}</td>
              <td className="p-2 text-[10px]">{i.returned_at ? new Date(i.returned_at).toLocaleString('en-IN', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }) : <span className="text-amber-600 font-medium">Pending</span>}</td>
              <td className="p-2 text-center text-[10px]">{i.condition_on_return || '—'}</td>
              <td className="p-2 text-center">{i.sharps_count_match === true ? <span className="text-green-600">✓</span> : i.sharps_count_match === false ? <span className="text-red-600 font-bold">✗</span> : '—'}</td>
            </tr>
          ))}</tbody></table>
        </div>
      </div>}

      {/* ═══ AUTOCLAVES TAB ═══ */}
      {tab === 'autoclaves' && (cssd.autoclaves.length === 0
        ? <div className="text-center py-12 bg-white rounded-xl border text-gray-400 text-sm">No autoclaves registered. Add via SQL or admin panel.</div>
        : <div className="grid grid-cols-3 gap-3">
          {cssd.autoclaves.map((a: any) => {
            const nextMaint = a.next_maintenance_date ? new Date(a.next_maintenance_date) : null;
            const overdue = nextMaint && nextMaint < new Date();
            return (
              <div key={a.id} className={`bg-white rounded-xl border p-4 ${overdue ? 'border-red-300' : ''}`}>
                <div className="flex items-center justify-between mb-2">
                  <span className="font-bold text-lg">{a.autoclave_number}</span>
                  <span className={`text-[9px] px-1.5 py-0.5 rounded font-medium ${a.status === 'available' ? 'bg-green-100 text-green-700' : a.status === 'running' ? 'bg-blue-100 text-blue-700' : 'bg-red-100 text-red-700'}`}>{a.status}</span>
                </div>
                <div className="text-xs text-gray-500">{a.brand} {a.model} · {a.chamber_size || 'standard'}</div>
                <div className="text-[10px] text-gray-400 mt-1">Serial: {a.serial_number || '—'} · Cycles: {a.total_cycles}</div>
                <div className="flex justify-between mt-2 text-[10px]">
                  <span>Last maint: {a.last_maintenance_date ? new Date(a.last_maintenance_date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' }) : '—'}</span>
                  <span className={overdue ? 'text-red-600 font-bold' : ''}>{nextMaint ? nextMaint.toLocaleDateString('en-IN', { day: '2-digit', month: 'short' }) : '—'}{overdue ? ' OVERDUE' : ''}</span>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ═══ ANALYTICS TAB ═══ */}
      {tab === 'analytics' && <div className="grid grid-cols-2 gap-4">
        <div className="bg-white rounded-xl border p-5 space-y-2">
          <h3 className="text-sm font-bold">Set status breakdown</h3>
          {[['Available', cssd.stats.available, 'bg-green-500'], ['In use', cssd.stats.inUse, 'bg-amber-500'], ['Sterilizing', cssd.stats.sterilizing, 'bg-blue-500'], ['Expired sterility', cssd.stats.expired, 'bg-red-500']].map(([l, v, c]) => (
            <div key={l as string} className="flex items-center gap-3"><span className="text-xs w-24">{l as string}</span>
              <div className="flex-1 h-3 bg-gray-100 rounded-full overflow-hidden"><div className={`h-full ${c} rounded-full`} style={{ width: `${((v as number) / Math.max(1, cssd.stats.totalSets)) * 100}%` }} /></div>
              <span className="text-xs font-bold w-6 text-right">{v as number}</span></div>
          ))}
        </div>
        <div className="bg-white rounded-xl border p-5 space-y-2">
          <h3 className="text-sm font-bold">Quality metrics</h3>
          <div className="text-xs space-y-2">
            <div className="flex justify-between"><span>Total cycles</span><b>{cssd.cycles.length}</b></div>
            <div className="flex justify-between"><span>Failed cycles</span><b className={cssd.stats.failedCycles > 0 ? 'text-red-600' : ''}>{cssd.stats.failedCycles}</b></div>
            <div className="flex justify-between"><span>Recall events</span><b className={cssd.stats.recalledCycles > 0 ? 'text-red-600' : ''}>{cssd.stats.recalledCycles}</b></div>
            <div className="flex justify-between"><span>Pass rate</span><b className="text-green-600">{cssd.cycles.length > 0 ? Math.round(cssd.cycles.filter(c => c.status === 'completed' && !c.recalled).length / cssd.cycles.length * 100) : 100}%</b></div>
            <div className="flex justify-between"><span>Sets at ≥90% cycle life</span><b className={cssd.stats.highCycleLife > 0 ? 'text-red-600' : ''}>{cssd.stats.highCycleLife}</b></div>
          </div>
        </div>
      </div>}

      {/* ═══ NEW SET MODAL ═══ */}
      {showNewSet && <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center" onClick={() => setShowNewSet(false)}>
        <div className="bg-white rounded-xl w-[500px] p-5 space-y-4" onClick={e => e.stopPropagation()}>
          <div className="flex justify-between"><h3 className="font-bold text-sm">New instrument set</h3><button onClick={() => setShowNewSet(false)} className="text-gray-400 text-lg">×</button></div>
          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2"><label className="text-[9px] text-gray-500">Set name *</label><input value={sf.set_name} onChange={e => setSf(f => ({...f, set_name: e.target.value}))} className="w-full px-3 py-2 border rounded-lg text-sm" placeholder="Major laparotomy set" /></div>
            <div><label className="text-[9px] text-gray-500">Set code</label><input value={sf.set_code} onChange={e => setSf(f => ({...f, set_code: e.target.value}))} className="w-full px-3 py-2 border rounded-lg text-sm" placeholder="MLS-001" /></div>
            <div><label className="text-[9px] text-gray-500">Department</label><select value={sf.department} onChange={e => setSf(f => ({...f, department: e.target.value}))} className="w-full px-3 py-2 border rounded-lg text-sm"><option value="">Select</option>{DEPARTMENTS.map(d => <option key={d}>{d}</option>)}</select></div>
            <div><label className="text-[9px] text-gray-500">Category</label><select value={sf.category} onChange={e => setSf(f => ({...f, category: e.target.value}))} className="w-full px-3 py-2 border rounded-lg text-sm">{CATEGORIES.map(c => <option key={c} value={c}>{c.replace('_', ' ')}</option>)}</select></div>
            <div><label className="text-[9px] text-gray-500">Instruments count</label><input type="number" value={sf.total_instruments} onChange={e => setSf(f => ({...f, total_instruments: e.target.value}))} className="w-full px-3 py-2 border rounded-lg text-sm" /></div>
            <div><label className="text-[9px] text-gray-500">Pack type</label><select value={sf.pack_type} onChange={e => setSf(f => ({...f, pack_type: e.target.value}))} className="w-full px-3 py-2 border rounded-lg text-sm"><option value="wrapped">Wrapped</option><option value="container">Container</option><option value="pouch">Pouch</option><option value="peel_pack">Peel pack</option></select></div>
            <div><label className="text-[9px] text-gray-500">Max cycles</label><input type="number" value={sf.max_cycles} onChange={e => setSf(f => ({...f, max_cycles: e.target.value}))} className="w-full px-3 py-2 border rounded-lg text-sm" /></div>
            <div><label className="text-[9px] text-gray-500">Sterility expiry (hours)</label><input type="number" value={sf.sterility_expiry_hours} onChange={e => setSf(f => ({...f, sterility_expiry_hours: e.target.value}))} className="w-full px-3 py-2 border rounded-lg text-sm" /></div>
          </div>
          <button onClick={handleCreateSet} disabled={!sf.set_name} className="w-full py-2.5 bg-teal-600 text-white text-sm rounded-lg font-medium disabled:opacity-40">Create Set</button>
        </div>
      </div>}

      {/* ═══ START CYCLE MODAL ═══ */}
      {showNewCycle && <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center" onClick={() => setShowNewCycle(false)}>
        <div className="bg-white rounded-xl w-[500px] max-h-[90vh] overflow-y-auto p-5 space-y-4" onClick={e => e.stopPropagation()}>
          <div className="flex justify-between"><h3 className="font-bold text-sm">Start sterilization cycle</h3><button onClick={() => setShowNewCycle(false)} className="text-gray-400 text-lg">×</button></div>
          <div><label className="text-[9px] text-gray-500">Select sets to sterilize *</label>
            <div className="mt-1 space-y-1 max-h-40 overflow-y-auto border rounded-lg p-2">
              {cssd.sets.filter(s => s.status === 'available' || s.isExpired).map(s => (
                <label key={s.id} className={`flex items-center gap-2 px-2 py-1.5 rounded-lg cursor-pointer text-xs ${cf.selectedSets.includes(s.id) ? 'bg-teal-50' : 'hover:bg-gray-50'}`}>
                  <input type="checkbox" checked={cf.selectedSets.includes(s.id)} onChange={() => toggleSetInCycle(s.id)} className="rounded" />
                  <span className="font-medium">{s.set_name}</span>
                  <span className="text-[10px] text-gray-400 ml-auto">{s.set_code}</span>
                  {s.isExpired && <span className="text-[8px] bg-red-100 text-red-600 px-1 rounded">expired</span>}
                </label>
              ))}
            </div>
            <div className="text-[10px] text-teal-600 mt-1">{cf.selectedSets.length} selected</div>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div><label className="text-[9px] text-gray-500">Autoclave</label><select value={cf.autoclave_number} onChange={e => setCf(f => ({...f, autoclave_number: e.target.value}))} className="w-full px-2 py-1.5 border rounded text-xs">
              <option value="">Select</option>{cssd.autoclaves.filter(a => a.status === 'available').map(a => <option key={a.id} value={a.autoclave_number}>{a.autoclave_number}</option>)}<option value="manual">Manual entry</option></select></div>
            <div><label className="text-[9px] text-gray-500">Cycle type</label><select value={cf.cycle_type} onChange={e => setCf(f => ({...f, cycle_type: e.target.value}))} className="w-full px-2 py-1.5 border rounded text-xs">
              {['prevacuum', 'gravity', 'flash', 'eto'].map(t => <option key={t}>{t}</option>)}</select></div>
            <div><label className="text-[9px] text-gray-500">Bowie-Dick</label><select value={cf.bowie_dick_result} onChange={e => setCf(f => ({...f, bowie_dick_result: e.target.value}))} className="w-full px-2 py-1.5 border rounded text-xs">
              <option value="na">N/A</option><option value="pass">Pass</option><option value="fail">Fail</option></select></div>
            <div><label className="text-[9px] text-gray-500">Temp (°C)</label><input type="number" value={cf.temperature} onChange={e => setCf(f => ({...f, temperature: e.target.value}))} className="w-full px-2 py-1.5 border rounded text-xs" /></div>
            <div><label className="text-[9px] text-gray-500">Pressure (bar)</label><input type="number" step="0.1" value={cf.pressure} onChange={e => setCf(f => ({...f, pressure: e.target.value}))} className="w-full px-2 py-1.5 border rounded text-xs" /></div>
            <div><label className="text-[9px] text-gray-500">Duration (min)</label><input type="number" value={cf.duration_minutes} onChange={e => setCf(f => ({...f, duration_minutes: e.target.value}))} className="w-full px-2 py-1.5 border rounded text-xs" /></div>
            <div><label className="text-[9px] text-gray-500">Exposure (min)</label><input type="number" value={cf.exposure_time_min} onChange={e => setCf(f => ({...f, exposure_time_min: e.target.value}))} className="w-full px-2 py-1.5 border rounded text-xs" /></div>
            <div><label className="text-[9px] text-gray-500">Dry time (min)</label><input type="number" value={cf.dry_time_min} onChange={e => setCf(f => ({...f, dry_time_min: e.target.value}))} className="w-full px-2 py-1.5 border rounded text-xs" /></div>
          </div>
          <button onClick={handleStartCycle} disabled={cf.selectedSets.length === 0} className="w-full py-2.5 bg-blue-600 text-white text-sm rounded-lg font-medium disabled:opacity-40">Start Cycle ({cf.selectedSets.length} sets)</button>
        </div>
      </div>}

      {/* ═══ ISSUE MODAL ═══ */}
      {showIssue && <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center" onClick={() => setShowIssue(null)}>
        <div className="bg-white rounded-xl w-[400px] p-5 space-y-4" onClick={e => e.stopPropagation()}>
          <h3 className="font-bold text-sm">Issue: {showIssue.set_name}</h3>
          <div className="bg-gray-50 rounded-lg p-3 text-xs"><span className="font-mono">{showIssue.set_code}</span> · {showIssue.total_instruments} instruments · {showIssue.department}</div>
          <div className="grid grid-cols-2 gap-3">
            <div><label className="text-[9px] text-gray-500">Issue to *</label><select value={isf.issued_to_location} onChange={e => setIsf(f => ({...f, issued_to_location: e.target.value, issued_to: e.target.value}))} className="w-full px-3 py-2 border rounded-lg text-sm">
              <option value="">Select location</option>{LOCATIONS.map(l => <option key={l}>{l}</option>)}</select></div>
            <div><label className="text-[9px] text-gray-500">Surgery</label><input value={isf.surgery_name} onChange={e => setIsf(f => ({...f, surgery_name: e.target.value}))} className="w-full px-3 py-2 border rounded-lg text-sm" placeholder="e.g. Lap Chole" /></div>
          </div>
          <button onClick={handleIssue} disabled={!isf.issued_to_location} className="w-full py-2.5 bg-amber-600 text-white text-sm rounded-lg font-medium disabled:opacity-40">Issue Set</button>
        </div>
      </div>}

      {/* ═══ RETURN MODAL ═══ */}
      {showReturn && <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center" onClick={() => setShowReturn(null)}>
        <div className="bg-white rounded-xl w-[450px] p-5 space-y-4" onClick={e => e.stopPropagation()}>
          <h3 className="font-bold text-sm">Return: {showReturn.set_name}</h3>
          <div className="bg-gray-50 rounded-lg p-3 text-xs">From: {showReturn.issued_to_location} · {showReturn.surgery_name || 'No surgery recorded'}</div>
          <div className="grid grid-cols-2 gap-3">
            <div><label className="text-[9px] text-gray-500">Condition</label><select value={rf.condition} onChange={e => setRf(f => ({...f, condition: e.target.value}))} className="w-full px-3 py-2 border rounded-lg text-sm">
              <option value="good">Good</option><option value="damaged">Damaged</option><option value="missing_items">Missing items</option></select></div>
            <div><label className="text-[9px] text-gray-500">Contamination level</label><select value={rf.contamination_level} onChange={e => setRf(f => ({...f, contamination_level: e.target.value}))} className="w-full px-3 py-2 border rounded-lg text-sm">
              <option value="minimal">Minimal</option><option value="moderate">Moderate</option><option value="heavy">Heavy</option><option value="biohazard">Biohazard</option></select></div>
          </div>
          <div className="space-y-2">
            <label className="flex items-center gap-2 text-xs"><input type="checkbox" checked={rf.instrument_count_verified} onChange={e => setRf(f => ({...f, instrument_count_verified: e.target.checked}))} className="rounded" /> Instrument count verified</label>
            <label className="flex items-center gap-2 text-xs"><input type="checkbox" checked={rf.sharps_count_match} onChange={e => setRf(f => ({...f, sharps_count_match: e.target.checked}))} className="rounded" /> Sharps count matches</label>
            <label className="flex items-center gap-2 text-xs"><input type="checkbox" checked={rf.return_wash_done} onChange={e => setRf(f => ({...f, return_wash_done: e.target.checked}))} className="rounded" /> Pre-wash done at point of use</label>
          </div>
          {rf.condition === 'missing_items' && <div><label className="text-[9px] text-gray-500">Missing items (comma-separated)</label><input value={rf.missing_items} onChange={e => setRf(f => ({...f, missing_items: e.target.value}))} className="w-full px-3 py-2 border rounded-lg text-sm" placeholder="e.g. Kocher forceps, needle holder" /></div>}
          <button onClick={handleReturn} className="w-full py-2.5 bg-teal-600 text-white text-sm rounded-lg font-medium">Return Set</button>
        </div>
      </div>}

      {/* ═══ CYCLE DETAIL MODAL ═══ */}
      {showCycleDetail && <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center" onClick={() => setShowCycleDetail(null)}>
        <div className="bg-white rounded-xl w-[500px] max-h-[90vh] overflow-y-auto p-5 space-y-3" onClick={e => e.stopPropagation()}>
          <div className="flex justify-between"><h3 className="font-bold text-sm">Cycle {showCycleDetail.cycle_number}</h3><button onClick={() => setShowCycleDetail(null)} className="text-gray-400 text-lg">×</button></div>
          <div className="grid grid-cols-2 gap-2 text-xs">
            {[
              ['Autoclave', showCycleDetail.autoclave_number], ['Type', showCycleDetail.cycle_type],
              ['Temperature', showCycleDetail.temperature + '°C'], ['Pressure', showCycleDetail.pressure + ' bar'],
              ['Duration', showCycleDetail.duration_minutes + ' min'], ['Exposure', (showCycleDetail.exposure_time_min || '—') + ' min'],
              ['Dry time', (showCycleDetail.dry_time_min || '—') + ' min'], ['Status', showCycleDetail.status],
              ['Bowie-Dick', showCycleDetail.bowie_dick_result], ['BI result', showCycleDetail.bi_test_result],
              ['BI 24h', showCycleDetail.bi_reading_24h], ['BI 48h', showCycleDetail.bi_reading_48h],
              ['Printout', showCycleDetail.printout_attached ? 'Yes' : 'No'], ['Operator', showCycleDetail.operator_name],
              ['Start', showCycleDetail.start_time ? new Date(showCycleDetail.start_time).toLocaleString('en-IN') : '—'],
              ['End', showCycleDetail.end_time ? new Date(showCycleDetail.end_time).toLocaleString('en-IN') : '—'],
            ].map(([k, v]) => <div key={k as string}><span className="text-gray-400">{k}:</span> <span className="font-medium">{v}</span></div>)}
          </div>
          <div><label className="text-[9px] text-gray-500">Sets in load</label>
            <div className="space-y-1 mt-1">{showCycleDetail.load_items.map((i: any, idx: number) => (
              <div key={idx} className="text-xs bg-gray-50 rounded px-2 py-1">{i.set_name} <span className="text-gray-400">{i.set_code}</span></div>
            ))}</div></div>
          {showCycleDetail.status === 'completed' && <div className="space-y-2">
            <h4 className="text-xs font-bold">Update BI readings</h4>
            <div className="grid grid-cols-2 gap-2">
              <div><label className="text-[9px] text-gray-500">BI 24h reading</label><select className="w-full px-2 py-1.5 border rounded text-xs" defaultValue={showCycleDetail.bi_reading_24h} onChange={e => { cssd.updateCycle(showCycleDetail.id, { bi_reading_24h: e.target.value }); setShowCycleDetail({ ...showCycleDetail, bi_reading_24h: e.target.value }); flash('Updated'); }}>
                <option value="pending">Pending</option><option value="negative">Negative (pass)</option><option value="positive">Positive (fail)</option></select></div>
              <div><label className="text-[9px] text-gray-500">BI 48h reading</label><select className="w-full px-2 py-1.5 border rounded text-xs" defaultValue={showCycleDetail.bi_reading_48h} onChange={e => { cssd.updateCycle(showCycleDetail.id, { bi_reading_48h: e.target.value }); setShowCycleDetail({ ...showCycleDetail, bi_reading_48h: e.target.value }); flash('Updated'); }}>
                <option value="pending">Pending</option><option value="negative">Negative (pass)</option><option value="positive">Positive (fail)</option></select></div>
            </div>
            <label className="flex items-center gap-2 text-xs"><input type="checkbox" checked={showCycleDetail.printout_attached} onChange={() => { cssd.updateCycle(showCycleDetail.id, { printout_attached: !showCycleDetail.printout_attached }); setShowCycleDetail({ ...showCycleDetail, printout_attached: !showCycleDetail.printout_attached }); }} className="rounded" /> Printout attached to log</label>
          </div>}
          {showCycleDetail.recalled && <div className="bg-red-50 rounded-lg p-3 text-xs text-red-700"><span className="font-bold">RECALLED:</span> {showCycleDetail.recall_reason}</div>}
        </div>
      </div>}
    </div>
  );
}

export default function CssdPage() { return <RoleGuard module="ot"><CssdInner /></RoleGuard>; }
