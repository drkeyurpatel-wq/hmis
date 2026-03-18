'use client';
import React, { useState, useEffect, useMemo } from 'react';
import { RoleGuard } from '@/components/ui/shared';
import { useAuthStore } from '@/lib/store/auth';
import {
  useRadiologyWorklist, useRadiologyOrders, useRadiologyTests,
  useRadiologyTemplates, useRadiologyProtocols, useCriticalFindings,
  usePACSConfig, useStradusLog, useLinkStudy, type ImagingStudy,
} from '@/lib/radiology/radiology-hooks';
import PatientImagingPanel from '@/components/radiology/patient-imaging-panel';
import Link from 'next/link';

const MOD_CLR: Record<string, string> = {
  XR: 'bg-blue-100 text-blue-700', CT: 'bg-purple-100 text-purple-700', MRI: 'bg-indigo-100 text-indigo-700',
  USG: 'bg-green-100 text-green-700', ECHO: 'bg-red-100 text-red-700', DEXA: 'bg-teal-100 text-teal-700',
  MAMMO: 'bg-pink-100 text-pink-700', FLUORO: 'bg-amber-100 text-amber-700',
};
const ST_CLR: Record<string, string> = { ordered: 'bg-gray-100 text-gray-600', acquired: 'bg-amber-100 text-amber-700', reported: 'bg-blue-100 text-blue-700', verified: 'bg-green-100 text-green-700', amended: 'bg-orange-100 text-orange-700' };
const fmtTat = (m: number) => m >= 60 ? `${Math.floor(m / 60)}h ${m % 60}m` : `${m}m`;

type Tab = 'worklist' | 'new_order' | 'critical' | 'tat' | 'protocols' | 'templates' | 'sync_log' | 'pacs';

function RadiologyInner() {
  const { staff, activeCentreId } = useAuthStore();
  const centreId = activeCentreId || '';
  const staffId = staff?.id || '';

  const worklist = useRadiologyWorklist(centreId);
  const orders = useRadiologyOrders(centreId);
  const tests = useRadiologyTests();
  const critical = useCriticalFindings(centreId);
  const pacs = usePACSConfig(centreId);
  const syncLog = useStradusLog();
  const templates = useRadiologyTemplates();
  const protocols = useRadiologyProtocols();

  const [tab, setTab] = useState<Tab>('worklist');
  const [toast, setToast] = useState('');
  const [actionError, setActionError] = useState('');
  const flash = (m: string) => { setToast(m); setTimeout(() => setToast(''), 2500); };

  // Filters
  const [statusFilter, setStatusFilter] = useState('all');
  const [modalityFilter, setModalityFilter] = useState('all');
  const [dateFilter, setDateFilter] = useState(new Date().toISOString().split('T')[0]);

  // New order form
  const [orderForm, setOrderForm] = useState({ test_id: '', patient_id: '', clinical_indication: '', urgency: 'routine', creatinine_value: '', contrast_allergy_checked: false, pregnancy_status: 'na' });
  const [testSearch, setTestSearch] = useState('');
  const testResults = useMemo(() => tests.search(testSearch), [testSearch, tests]);
  const [patSearch, setPatSearch] = useState('');
  const [patResults, setPatResults] = useState<any[]>([]);
  const [selectedTest, setSelectedTest] = useState<any>(null);

  // Patient search for orders
  useEffect(() => {
    if (patSearch.length < 2) { setPatResults([]); return; }
    const t = setTimeout(async () => {
      const { createClient } = await import('@/lib/supabase/client');
      const db = createClient();
      const { data } = await db.from('hmis_patients').select('id, uhid, first_name, last_name, age_years, gender')
        .or(`uhid.ilike.%${patSearch}%,first_name.ilike.%${patSearch}%,phone_primary.ilike.%${patSearch}%`)
        .eq('is_active', true).limit(5);
      setPatResults(data || []);
    }, 300);
    return () => clearTimeout(t);
  }, [patSearch]);

  // Report viewer
  const [viewingStudy, setViewingStudy] = useState<ImagingStudy | null>(null);

  // Critical acknowledge form
  const [ackForm, setAckForm] = useState({ id: '', action: '' });

  const tabs: [Tab, string, number?][] = [
    ['worklist', 'Imaging Worklist'],
    ['new_order', 'New Order'],
    ['critical', 'Critical Findings', critical.unacknowledged.length],
    ['tat', 'TAT Analytics'],
    ['protocols', 'Protocols'],
    ['templates', 'Report Templates'],
    ['sync_log', 'Stradus Sync Log'],
    ['pacs', 'PACS Config'],
  ];

  return (
    <div className="max-w-7xl mx-auto space-y-4">
      {toast && <div className="fixed top-4 left-1/2 -translate-x-1/2 z-50 bg-green-600 text-white px-4 py-2 rounded-lg shadow-lg text-sm">{toast}</div>}

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Radiology</h1>
          <p className="text-xs text-gray-500">RIS + Stradus PACS | {tests.tests.length} tests configured | {tests.modalities.length} modalities</p>
        </div>
        <div className="flex items-center gap-2">
          {pacs.config && <span className="text-[10px] bg-green-100 text-green-700 px-2 py-1 rounded-lg">Stradus Connected</span>}
          {critical.unacknowledged.length > 0 && <span className="text-[10px] bg-red-600 text-white px-2 py-1 rounded-lg animate-pulse">{critical.unacknowledged.length} Critical</span>}
          <button onClick={() => setTab('new_order')} className="px-4 py-2 bg-blue-600 text-white text-sm rounded-lg">+ New Order</button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-8 gap-2">
        {[['Total', worklist.stats.total, 'text-gray-700', 'bg-white'],
          ['Unreported', worklist.stats.unreported, worklist.stats.unreported > 0 ? 'text-amber-700' : 'text-gray-500', 'bg-amber-50'],
          ['Acquired', worklist.stats.acquired, 'text-purple-700', 'bg-purple-50'],
          ['Reported', worklist.stats.reported, 'text-blue-700', 'bg-blue-50'],
          ['Verified', worklist.stats.verified, 'text-green-700', 'bg-green-50'],
          ['Critical', worklist.stats.critical, worklist.stats.critical > 0 ? 'text-red-700' : 'text-gray-500', worklist.stats.critical > 0 ? 'bg-red-50' : 'bg-white'],
          ['Avg TAT', worklist.stats.avgTat > 0 ? fmtTat(worklist.stats.avgTat) : '—', 'text-gray-700', 'bg-white'],
          ['Modalities', Object.keys(worklist.stats.byModality).length, 'text-gray-700', 'bg-white'],
        ].map(([l, v, tc, bg], i) => (
          <div key={i} className={'rounded-xl border p-2 text-center ' + bg}><div className="text-[9px] text-gray-500 uppercase">{l as string}</div><div className={'text-lg font-bold ' + tc}>{v}</div></div>
        ))}
      </div>

      {/* Tabs */}
      <div className="flex gap-0.5 border-b pb-px overflow-x-auto">
        {tabs.map(([k, l, badge]) => <button key={k} onClick={() => setTab(k)}
          className={`px-3 py-2 text-xs font-medium whitespace-nowrap border-b-2 -mb-px relative ${tab === k ? 'border-blue-600 text-blue-700' : 'border-transparent text-gray-500'}`}>
          {l}
          {badge && badge > 0 && <span className="ml-1 bg-red-600 text-white text-[9px] px-1 py-0.5 rounded-full">{badge}</span>}
        </button>)}
      </div>

      {/* ===== WORKLIST ===== */}
      {tab === 'worklist' && <div className="space-y-3">
        <div className="flex gap-1.5 flex-wrap items-center">
          <input type="date" value={dateFilter} onChange={e => { setDateFilter(e.target.value); worklist.load({ date: e.target.value, status: statusFilter, modality: modalityFilter }); }}
            className="px-2 py-1 border rounded text-xs" />
          <span className="border-l mx-1 h-4" />
          {['all', 'ordered', 'acquired', 'reported', 'verified'].map(s => (
            <button key={s} onClick={() => { setStatusFilter(s); worklist.load({ date: dateFilter, status: s, modality: modalityFilter }); }}
              className={`px-2 py-1 rounded text-[10px] border ${statusFilter === s ? 'bg-blue-600 text-white' : 'bg-white'}`}>{s === 'all' ? 'All Status' : s}</button>
          ))}
          <span className="border-l mx-1 h-4" />
          {['all', ...tests.modalities].map(m => (
            <button key={m} onClick={() => { setModalityFilter(m); worklist.load({ date: dateFilter, status: statusFilter, modality: m }); }}
              className={`px-2 py-1 rounded text-[10px] border ${modalityFilter === m ? 'bg-blue-600 text-white' : 'bg-white'}`}>{m === 'all' ? 'All' : m}</button>
          ))}
          <div className="flex-1" />
          <button onClick={() => worklist.load({ date: dateFilter, status: statusFilter, modality: modalityFilter })} className="px-2 py-1 bg-gray-100 text-[10px] rounded">Refresh</button>
        </div>

        {worklist.loading ? <div className="text-center py-8 text-gray-400 animate-pulse">Loading...</div> :
        worklist.studies.length === 0 ? <div className="text-center py-8 bg-white rounded-xl border text-gray-400 text-sm">No imaging studies for selected filters</div> :
        <div className="bg-white rounded-xl border overflow-hidden">
          <table className="w-full text-xs"><thead><tr className="bg-gray-50 border-b text-gray-500">
            <th className="p-2 text-left font-medium">Accession</th>
            <th className="p-2 text-left font-medium">Patient</th>
            <th className="p-2 font-medium">Study</th>
            <th className="p-2 font-medium">Mod</th>
            <th className="p-2 font-medium">Date</th>
            <th className="p-2 font-medium">Status</th>
            <th className="p-2 font-medium">Report</th>
            <th className="p-2 font-medium">TAT</th>
            <th className="p-2 font-medium">Actions</th>
          </tr></thead><tbody>{worklist.studies.map(s => (
            <tr key={s.id} className={`border-b hover:bg-blue-50 ${s.report?.isCritical ? 'bg-red-50' : ''}`}>
              <td className="p-2 font-mono text-[10px]">{s.accessionNumber}</td>
              <td className="p-2"><span className="font-medium">{s.patientName}</span><br/><span className="text-[10px] text-gray-400">{s.patientUhid} • {s.patientAge}y {s.patientGender}</span></td>
              <td className="p-2 text-center">{s.studyDescription}{s.isContrast && <span className="ml-1 text-[9px] bg-amber-100 text-amber-700 px-1 rounded">C+</span>}</td>
              <td className="p-2 text-center"><span className={`px-1.5 py-0.5 rounded text-[9px] ${MOD_CLR[s.modality] || 'bg-gray-100'}`}>{s.modality}</span></td>
              <td className="p-2 text-center text-[10px]">{s.studyDate}</td>
              <td className="p-2 text-center"><span className={`px-1.5 py-0.5 rounded text-[9px] ${ST_CLR[s.status] || ''}`}>{s.status}</span>{s.report?.isCritical && <span className="ml-1 text-[9px] bg-red-600 text-white px-1 rounded">CRIT</span>}</td>
              <td className="p-2 text-center">
                {s.report ? <button onClick={() => setViewingStudy(s)} className="text-blue-600 underline text-[10px]">{s.report.reportStatus}</button> : <span className="text-gray-300">—</span>}
              </td>
              <td className="p-2 text-center text-[10px]">{s.report?.tatMinutes ? fmtTat(s.report.tatMinutes) : '—'}</td>
              <td className="p-2 text-center">
                {(s.stradusStudyUrl || s.pacsViewerUrl) && (
                  <a href={s.stradusStudyUrl || s.pacsViewerUrl || ''} target="_blank" rel="noopener noreferrer"
                    className="px-2 py-0.5 bg-green-600 text-white rounded text-[9px] hover:bg-green-700">View</a>
                )}
                <Link href={`/radiology/${s.id}`} className="ml-1 px-2 py-0.5 bg-gray-100 rounded text-[9px]">Detail</Link>
              </td>
            </tr>
          ))}</tbody></table>
        </div>}
      </div>}

      {/* ===== NEW ORDER ===== */}
      {tab === 'new_order' && <div className="bg-white rounded-xl border p-5 space-y-4">
        <h2 className="font-bold text-sm">Create Radiology Order</h2>
        <div className="grid grid-cols-3 gap-3">
          <div className="relative"><label className="text-xs text-gray-500">Test *</label>
            {selectedTest ? (
              <div className="bg-blue-50 rounded-lg px-3 py-2 flex justify-between"><span className="text-sm"><span className={`px-1 py-0.5 rounded text-[9px] mr-1 ${MOD_CLR[selectedTest.modality] || ''}`}>{selectedTest.modality}</span>{selectedTest.test_name}{selectedTest.is_contrast && <span className="ml-1 text-amber-600 text-[10px]">(Contrast)</span>}</span><button onClick={() => { setSelectedTest(null); setOrderForm(f => ({...f, test_id: ''})); }} className="text-xs text-red-500">Change</button></div>
            ) : (
              <><input type="text" value={testSearch} onChange={e => setTestSearch(e.target.value)} className="w-full px-3 py-2 border rounded-lg text-sm" placeholder="Search (CT Brain, MRI Knee...)" />
              {testResults.length > 0 && <div className="absolute top-full left-0 right-0 mt-1 bg-white border rounded-lg shadow-lg z-10 max-h-48 overflow-y-auto">{testResults.map(t => (
                <button key={t.id} onClick={() => { setSelectedTest(t); setOrderForm(f => ({...f, test_id: t.id})); setTestSearch(''); }}
                  className="w-full text-left px-3 py-2 text-xs hover:bg-blue-50 border-b">
                  <span className={`px-1 py-0.5 rounded text-[9px] mr-1 ${MOD_CLR[t.modality] || ''}`}>{t.modality}</span>{t.test_name} — {t.body_part}{t.is_contrast && <span className="ml-1 text-amber-600">(Contrast)</span>}
                </button>
              ))}</div>}</>
            )}</div>
          <div className="relative"><label className="text-xs text-gray-500">Patient *</label>
            {orderForm.patient_id ? <div className="bg-blue-50 rounded-lg px-3 py-2 flex justify-between"><span className="text-sm font-medium">{patSearch}</span><button onClick={() => { setOrderForm(f => ({...f, patient_id: ''})); setPatSearch(''); }} className="text-xs text-red-500">Change</button></div> :
            <><input type="text" value={patSearch} onChange={e => setPatSearch(e.target.value)} className="w-full px-3 py-2 border rounded-lg text-sm" placeholder="UHID / name / phone" />
            {patResults.length > 0 && <div className="absolute top-full left-0 right-0 mt-1 bg-white border rounded-lg shadow-lg z-10">{patResults.map(p => (
              <button key={p.id} onClick={() => { setOrderForm(f => ({...f, patient_id: p.id})); setPatSearch(`${p.first_name} ${p.last_name} (${p.uhid})`); setPatResults([]); }}
                className="w-full text-left px-3 py-2 text-sm hover:bg-blue-50 border-b">{p.first_name} {p.last_name} — {p.uhid} — {p.age_years}y {p.gender}</button>
            ))}</div>}</>}</div>
          <div><label className="text-xs text-gray-500">Clinical Indication</label>
            <input type="text" value={orderForm.clinical_indication} onChange={e => setOrderForm(f => ({...f, clinical_indication: e.target.value}))} className="w-full px-3 py-2 border rounded-lg text-sm" placeholder="R/O fracture, evaluate mass..." /></div>
        </div>
        <div className="grid grid-cols-4 gap-3">
          <div><label className="text-xs text-gray-500">Urgency</label>
            <div className="flex gap-1 mt-1">{['routine', 'urgent', 'stat'].map(u => (
              <button key={u} onClick={() => setOrderForm(f => ({...f, urgency: u}))} className={`flex-1 py-1.5 rounded text-xs border ${orderForm.urgency === u ? u === 'stat' ? 'bg-red-600 text-white' : u === 'urgent' ? 'bg-amber-500 text-white' : 'bg-blue-600 text-white' : 'bg-white'}`}>{u.toUpperCase()}</button>
            ))}</div></div>
          {selectedTest?.is_contrast && <>
            <div><label className="text-xs text-gray-500">Creatinine (mg/dL) *</label>
              <input type="number" step="0.1" value={orderForm.creatinine_value} onChange={e => setOrderForm(f => ({...f, creatinine_value: e.target.value}))} className="w-full px-3 py-2 border rounded-lg text-sm" placeholder="0.9" /></div>
            <div className="pt-5"><label className="flex items-center gap-2"><input type="checkbox" checked={orderForm.contrast_allergy_checked} onChange={e => setOrderForm(f => ({...f, contrast_allergy_checked: e.target.checked}))} className="rounded" /><span className="text-xs">No contrast allergy</span></label></div>
          </>}
          {selectedTest && ['CT', 'FLUORO'].includes(selectedTest.modality) && <div><label className="text-xs text-gray-500">Pregnancy</label>
            <div className="flex gap-1 mt-1">{['na', 'not_pregnant', 'pregnant'].map(p => (
              <button key={p} onClick={() => setOrderForm(f => ({...f, pregnancy_status: p}))} className={`flex-1 py-1.5 rounded text-[10px] border ${orderForm.pregnancy_status === p ? 'bg-blue-600 text-white' : 'bg-white'}`}>{p === 'na' ? 'N/A' : p.replace('_', ' ')}</button>
            ))}</div></div>}
        </div>
        {/* Protocol info */}
        {selectedTest && <ProtocolPreview modality={selectedTest.modality} bodyPart={selectedTest.body_part} />}
        {actionError && <div className="bg-red-50 border border-red-200 rounded-lg px-4 py-2 text-sm text-red-700">{actionError}</div>}
        <button onClick={async () => {
          setActionError('');
          const result = await orders.createOrder({ ...orderForm, ordered_by: staffId });
          if (!result.success) { setActionError(result.error || 'Failed'); return; }
          flash('Order created: ' + result.order?.accession_number);
          setTab('worklist'); setOrderForm({ test_id: '', patient_id: '', clinical_indication: '', urgency: 'routine', creatinine_value: '', contrast_allergy_checked: false, pregnancy_status: 'na' }); setSelectedTest(null); setPatSearch('');
        }} disabled={!orderForm.test_id || !orderForm.patient_id}
          className="px-6 py-2.5 bg-green-600 text-white text-sm rounded-lg font-medium disabled:opacity-40">Create Order</button>
      </div>}

      {/* ===== CRITICAL FINDINGS ===== */}
      {tab === 'critical' && <div className="space-y-3">
        <h2 className="font-bold text-sm">Critical & Urgent Findings</h2>
        {critical.unacknowledged.length > 0 && <div className="bg-red-50 border-2 border-red-300 rounded-xl p-4">
          <h3 className="font-bold text-red-700 text-sm mb-2">Unacknowledged ({critical.unacknowledged.length})</h3>
          {critical.unacknowledged.map((f: any) => (
            <div key={f.id} className="bg-white rounded-lg border border-red-200 p-3 mb-2">
              <div className="flex items-start justify-between">
                <div>
                  <div className="font-semibold text-sm text-red-700">{f.finding_text}</div>
                  <div className="text-xs text-gray-500">{f.study?.patient?.first_name} {f.study?.patient?.last_name} ({f.study?.patient?.uhid}) — {f.study?.modality} {f.study?.study_description}</div>
                  <div className="text-[10px] text-gray-400">{new Date(f.created_at).toLocaleString('en-IN')}</div>
                </div>
                <div className="flex flex-col gap-1">
                  {f.study?.stradus_study_url && <a href={f.study.stradus_study_url} target="_blank" rel="noopener noreferrer" className="px-2 py-1 bg-green-600 text-white text-[10px] rounded">View Images</a>}
                  <button onClick={() => setAckForm({ id: f.id, action: '' })} className="px-2 py-1 bg-blue-600 text-white text-[10px] rounded">Acknowledge</button>
                </div>
              </div>
              {ackForm.id === f.id && <div className="mt-2 flex gap-2 items-end">
                <input type="text" value={ackForm.action} onChange={e => setAckForm(a => ({...a, action: e.target.value}))} className="flex-1 px-3 py-1.5 border rounded text-xs" placeholder="Action taken..." />
                <button onClick={async () => {
                  await critical.acknowledge(f.id, staff?.full_name || 'Unknown', ackForm.action);
                  flash('Acknowledged'); setAckForm({ id: '', action: '' });
                }} className="px-3 py-1.5 bg-green-600 text-white text-xs rounded">Confirm</button>
              </div>}
            </div>
          ))}
        </div>}
        {critical.findings.filter(f => f.acknowledged).length > 0 && <div>
          <h3 className="text-xs font-medium text-gray-500 mb-2">Previously Acknowledged</h3>
          {critical.findings.filter((f: any) => f.acknowledged).slice(0, 20).map((f: any) => (
            <div key={f.id} className="bg-white rounded-lg border p-2 mb-1 flex items-center justify-between">
              <div><span className="text-xs font-medium">{f.finding_text?.substring(0, 80)}</span><span className="text-[10px] text-gray-400 ml-2">{f.study?.patient?.first_name} {f.study?.patient?.last_name}</span></div>
              <div className="text-[10px] text-gray-400"><span className="text-green-600">Ack by {f.acknowledged_by}</span> {f.action_taken && <span className="ml-1">| {f.action_taken}</span>}</div>
            </div>
          ))}
        </div>}
      </div>}

      {/* ===== TAT ===== */}
      {tab === 'tat' && <div className="space-y-4">
        <h2 className="font-bold text-sm">Turnaround Time Analytics</h2>
        <div className="grid grid-cols-4 gap-3">
          <div className="bg-white rounded-xl border p-4 text-center"><div className="text-[10px] text-gray-500">Avg TAT</div><div className="text-2xl font-bold">{worklist.stats.avgTat > 0 ? fmtTat(worklist.stats.avgTat) : '—'}</div></div>
          {Object.entries(worklist.stats.byModality).sort((a, b) => b[1] - a[1]).slice(0, 3).map(([mod, count]) => (
            <div key={mod} className="bg-white rounded-xl border p-4 text-center"><div className={`text-[10px] ${MOD_CLR[mod] || ''} px-2 py-0.5 rounded inline-block mb-1`}>{mod}</div><div className="text-2xl font-bold">{count}</div><div className="text-[10px] text-gray-400">studies</div></div>
          ))}
        </div>
        <div className="bg-white rounded-xl border overflow-hidden">
          <table className="w-full text-xs"><thead><tr className="bg-gray-50 border-b"><th className="p-2 text-left">Study</th><th className="p-2">Patient</th><th className="p-2">Modality</th><th className="p-2">Acquired</th><th className="p-2">Reported</th><th className="p-2">TAT</th></tr></thead>
          <tbody>{worklist.studies.filter(s => s.report?.tatMinutes).sort((a, b) => (b.report?.tatMinutes || 0) - (a.report?.tatMinutes || 0)).slice(0, 30).map(s => (
            <tr key={s.id} className="border-b"><td className="p-2 font-medium">{s.studyDescription}</td><td className="p-2 text-center">{s.patientName}</td>
              <td className="p-2 text-center"><span className={`px-1.5 py-0.5 rounded text-[9px] ${MOD_CLR[s.modality] || ''}`}>{s.modality}</span></td>
              <td className="p-2 text-center text-[10px]">{s.studyDate}</td>
              <td className="p-2 text-center text-[10px]">{s.report?.reportedAt ? new Date(s.report.reportedAt).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' }) : '—'}</td>
              <td className="p-2 text-center font-bold">{fmtTat(s.report!.tatMinutes!)}</td>
            </tr>
          ))}</tbody></table>
        </div>
      </div>}

      {/* ===== PROTOCOLS ===== */}
      {tab === 'protocols' && <div className="space-y-3">
        <h2 className="font-bold text-sm">Radiology Protocols &amp; Prep Instructions</h2>
        <div className="grid grid-cols-2 gap-3">{protocols.protocols.map((p: any) => (
          <div key={p.id} className="bg-white rounded-xl border p-4">
            <div className="flex items-center gap-2 mb-2"><span className={`px-1.5 py-0.5 rounded text-[9px] ${MOD_CLR[p.modality] || 'bg-gray-100'}`}>{p.modality}</span><span className="font-semibold text-sm">{p.protocol_name}</span></div>
            <div className="text-xs space-y-1.5">
              {p.prep_instructions && <div><span className="font-medium text-gray-500">Prep:</span> {p.prep_instructions}</div>}
              {p.patient_instructions && <div><span className="font-medium text-gray-500">Patient:</span> {p.patient_instructions}</div>}
              <div className="flex gap-3 text-[10px] text-gray-400">
                {p.fasting_hours > 0 && <span>Fasting: {p.fasting_hours}h</span>}
                {p.estimated_duration_min && <span>Duration: {p.estimated_duration_min}min</span>}
                {p.radiation_dose_msv > 0 && <span>Dose: {p.radiation_dose_msv} mSv</span>}
                {p.contrast_required && <span className="text-amber-600">Contrast required</span>}
              </div>
            </div>
          </div>
        ))}</div>
      </div>}

      {/* ===== TEMPLATES ===== */}
      {tab === 'templates' && <div className="space-y-3">
        <h2 className="font-bold text-sm">Report Templates ({templates.templates.length})</h2>
        <div className="grid grid-cols-2 gap-3">{templates.templates.map((t: any) => (
          <div key={t.id} className="bg-white rounded-xl border p-4">
            <div className="flex items-center justify-between mb-2">
              <span className="font-semibold text-sm">{t.template_name}</span>
              <div className="flex gap-1"><span className={`px-1.5 py-0.5 rounded text-[9px] ${MOD_CLR[t.modality] || 'bg-gray-100'}`}>{t.modality}</span>{t.is_normal && <span className="text-[9px] bg-green-100 text-green-700 px-1 rounded">Normal</span>}</div>
            </div>
            <div className="text-xs text-gray-500 space-y-1">
              <div className="line-clamp-2"><span className="font-medium">Findings:</span> {t.findings_template}</div>
              {t.impression_template && <div className="line-clamp-1"><span className="font-medium">Impression:</span> {t.impression_template}</div>}
            </div>
          </div>
        ))}</div>
      </div>}

      {/* ===== SYNC LOG ===== */}
      {tab === 'sync_log' && <div className="space-y-3">
        <h2 className="font-bold text-sm">Stradus Sync Log</h2>
        {syncLog.logs.length === 0 ? <div className="text-center py-8 bg-white rounded-xl border text-gray-400 text-sm">No sync messages yet. Configure Stradus webhook to: <span className="font-mono">https://hmis-brown.vercel.app/api/radiology/stradus-webhook</span></div> :
        <div className="bg-white rounded-xl border overflow-hidden">
          <table className="w-full text-xs"><thead><tr className="bg-gray-50 border-b"><th className="p-2 text-left">Time</th><th className="p-2">Direction</th><th className="p-2">Type</th><th className="p-2">Accession</th><th className="p-2">Patient</th><th className="p-2">Status</th></tr></thead>
          <tbody>{syncLog.logs.map((l: any) => (
            <tr key={l.id} className="border-b"><td className="p-2 text-[10px]">{new Date(l.created_at).toLocaleString('en-IN')}</td>
              <td className="p-2 text-center"><span className={`px-1.5 py-0.5 rounded text-[9px] ${l.direction === 'inbound' ? 'bg-green-100 text-green-700' : 'bg-blue-100 text-blue-700'}`}>{l.direction}</span></td>
              <td className="p-2 text-center font-mono text-[10px]">{l.message_type}</td>
              <td className="p-2 text-center font-mono text-[10px]">{l.accession_number}</td>
              <td className="p-2 text-center">{l.patient_uhid || '—'}</td>
              <td className="p-2 text-center"><span className={`px-1.5 py-0.5 rounded text-[9px] ${l.processed ? 'bg-green-100 text-green-700' : l.error_message ? 'bg-red-100 text-red-700' : 'bg-gray-100'}`}>{l.processed ? 'OK' : l.error_message ? 'Error' : 'Pending'}</span></td>
            </tr>
          ))}</tbody></table>
        </div>}
      </div>}

      {/* ===== PACS CONFIG ===== */}
      {tab === 'pacs' && <div className="space-y-4">
        <h2 className="font-bold text-sm">PACS Integration — Stradus</h2>
        {pacs.config ? (
          <div className="bg-white rounded-xl border p-5">
            <div className="flex items-center gap-2 mb-4"><span className="w-3 h-3 bg-green-500 rounded-full" /><span className="font-semibold text-green-700">Connected</span></div>
            <div className="grid grid-cols-3 gap-4 text-xs">
              <div><span className="text-gray-500">Vendor</span><div className="font-semibold">{pacs.config.pacs_vendor}</div></div>
              <div><span className="text-gray-500">PACS URL</span><div className="font-mono">{pacs.config.pacs_url}</div></div>
              <div><span className="text-gray-500">Viewer URL</span><div className="font-mono">{pacs.config.viewer_url || '—'}</div></div>
              <div><span className="text-gray-500">DICOM AE Title</span><div className="font-mono">{pacs.config.dicom_ae_title || '—'}</div></div>
              <div><span className="text-gray-500">DICOM Endpoint</span><div className="font-mono">{pacs.config.dicom_ip || '—'}:{pacs.config.dicom_port || 104}</div></div>
              <div><span className="text-gray-500">HL7 Endpoint</span><div className="font-mono">{pacs.config.hl7_ip || '—'}:{pacs.config.hl7_port || 2575}</div></div>
            </div>
            <div className="mt-4 bg-blue-50 rounded-lg p-3 text-xs">
              <div className="font-semibold text-blue-700 mb-1">Integration Flow</div>
              <div className="text-blue-600 space-y-0.5">
                <div>1. HMIS creates order → POST to Stradus API (or queued for HL7 MLLP)</div>
                <div>2. Technician acquires images in Stradus → Stradus POSTs study data to HMIS webhook</div>
                <div>3. Stradus study URL saved to patient file → clickable "View Images" in HMIS</div>
                <div>4. Radiologist reports in Stradus → Stradus POSTs report to HMIS webhook</div>
                <div>5. Report stored in HMIS → visible in patient file, worklist, EMR</div>
              </div>
              <div className="mt-2 font-mono text-[10px] text-blue-500">Webhook: POST https://hmis-brown.vercel.app/api/radiology/stradus-webhook</div>
            </div>
          </div>
        ) : (
          <div className="bg-white rounded-xl border p-8 text-center space-y-3">
            <div className="text-lg font-semibold text-gray-700">PACS Not Configured</div>
            <div className="text-sm text-gray-500">Insert a row into hmis_pacs_config to connect Stradus:</div>
            <div className="bg-gray-50 rounded-lg p-4 text-left text-xs font-mono max-w-lg mx-auto">
              INSERT INTO hmis_pacs_config (centre_id, pacs_vendor, pacs_url, viewer_url)<br/>
              VALUES ({'<'}shilaj_centre_id{'>'}, 'stradus', 'https://stradus.health1.in', 'https://stradus.health1.in/viewer');
            </div>
          </div>
        )}
      </div>}

      {/* Report modal */}
      {viewingStudy && viewingStudy.report && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={() => setViewingStudy(null)}>
          <div className="bg-white rounded-xl max-w-3xl w-full max-h-[90vh] overflow-y-auto p-6" onClick={e => e.stopPropagation()}>
            <div className="flex items-start justify-between mb-4">
              <div><h2 className="text-lg font-bold">{viewingStudy.studyDescription}</h2><div className="text-sm text-gray-500">{viewingStudy.patientName} ({viewingStudy.patientUhid}) • {viewingStudy.studyDate}</div></div>
              <div className="flex gap-2">{viewingStudy.stradusStudyUrl && <a href={viewingStudy.stradusStudyUrl} target="_blank" rel="noopener noreferrer" className="px-3 py-1.5 bg-green-600 text-white text-xs rounded-lg">View in Stradus</a>}<button onClick={() => setViewingStudy(null)} className="text-xl px-2">×</button></div>
            </div>
            {viewingStudy.report.isCritical && <div className="bg-red-50 border-2 border-red-300 rounded-lg px-4 py-3 mb-4 font-bold text-red-700">CRITICAL FINDING{viewingStudy.report.criticalValue && `: ${viewingStudy.report.criticalValue}`}</div>}
            <div className="space-y-3 text-sm">
              {viewingStudy.report.technique && <div><div className="text-xs font-semibold text-gray-500 uppercase">Technique</div><div>{viewingStudy.report.technique}</div></div>}
              <div className="border-t pt-3"><div className="text-xs font-semibold text-gray-500 uppercase">Findings</div><div className="whitespace-pre-wrap">{viewingStudy.report.findings}</div></div>
              <div className="bg-blue-50 rounded-lg p-4 border border-blue-200"><div className="text-xs font-semibold text-blue-700 uppercase">Impression</div><div className="text-blue-900 font-medium whitespace-pre-wrap">{viewingStudy.report.impression}</div></div>
            </div>
            <div className="mt-4 pt-3 border-t text-xs text-gray-500 flex justify-between">
              <div>Reported: {viewingStudy.report.reportedByName} {viewingStudy.report.reportedAt && `(${new Date(viewingStudy.report.reportedAt).toLocaleString('en-IN')})`}</div>
              {viewingStudy.report.verifiedByName && <div>Verified: {viewingStudy.report.verifiedByName}</div>}
              <div>Source: {viewingStudy.report.source}</div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function ProtocolPreview({ modality, bodyPart }: { modality: string; bodyPart?: string }) {
  const { protocols } = useRadiologyProtocols(modality, bodyPart);
  if (protocols.length === 0) return null;
  const p = protocols[0];
  return (
    <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-xs">
      <div className="font-semibold text-amber-700 mb-1">Protocol: {p.protocol_name}</div>
      {p.prep_instructions && <div className="text-amber-600"><span className="font-medium">Prep:</span> {p.prep_instructions}</div>}
      {p.patient_instructions && <div className="text-amber-600"><span className="font-medium">Patient:</span> {p.patient_instructions}</div>}
      <div className="flex gap-3 text-[10px] text-amber-500 mt-1">
        {p.fasting_hours > 0 && <span>Fasting: {p.fasting_hours}h</span>}
        {p.estimated_duration_min && <span>~{p.estimated_duration_min}min</span>}
        {p.radiation_dose_msv > 0 && <span>{p.radiation_dose_msv} mSv</span>}
      </div>
    </div>
  );
}

export default function RadiologyPage() { return <RoleGuard module="radiology"><RadiologyInner /></RoleGuard>; }
