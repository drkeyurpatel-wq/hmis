'use client';
import React, { useState, useEffect, useMemo } from 'react';
import { RoleGuard } from '@/components/ui/shared';
import { useAuthStore } from '@/lib/store/auth';
import { useRadiologyTests, useRadiologyWorklist, useRadiologyReport, useRadiologyTemplates, usePACSConfig } from '@/lib/radiology/radiology-hooks';
import { createClient } from '@/lib/supabase/client';

let _sb: any = null;
function sb() { if (typeof window === 'undefined') return null as any; if (!_sb) { try { _sb = createClient(); } catch { return null; } } return _sb; }

type Tab = 'worklist'|'new_order'|'reporting'|'templates'|'tat'|'pacs';

const MODALITY_COLORS: Record<string, string> = {
  XR: 'bg-blue-100 text-blue-700', CT: 'bg-purple-100 text-purple-700', MRI: 'bg-indigo-100 text-indigo-700',
  USG: 'bg-green-100 text-green-700', ECHO: 'bg-red-100 text-red-700', DEXA: 'bg-teal-100 text-teal-700',
  MAMMO: 'bg-pink-100 text-pink-700', FLUORO: 'bg-amber-100 text-amber-700',
};
const urgColor = (u: string) => u === 'stat' ? 'bg-red-600 text-white' : u === 'urgent' ? 'bg-amber-500 text-white' : 'bg-gray-100 text-gray-600';
const stColor = (s: string) => s === 'verified' ? 'bg-green-100 text-green-700' : s === 'reported' ? 'bg-blue-100 text-blue-700' : s === 'in_progress' ? 'bg-purple-100 text-purple-700' : s === 'scheduled' ? 'bg-amber-100 text-amber-700' : 'bg-gray-100 text-gray-600';
const tatColor = (mins: number, expected: number) => mins <= expected ? 'text-green-700' : mins <= expected * 1.5 ? 'text-amber-700' : 'text-red-700 font-bold';
const fmtTat = (mins: number) => mins >= 60 ? `${Math.floor(mins / 60)}h ${mins % 60}m` : `${mins}m`;

function RadiologyInner() {
  const { staff, activeCentreId } = useAuthStore();
  const centreId = activeCentreId || '';
  const staffId = staff?.id || '';

  const testMaster = useRadiologyTests();
  const worklist = useRadiologyWorklist(centreId);
  const pacs = usePACSConfig(centreId);

  const [tab, setTab] = useState<Tab>('worklist');
  const [toast, setToast] = useState('');
  const [actionError, setActionError] = useState('');
  const flash = (m: string) => { setToast(m); setTimeout(() => setToast(''), 2500); };

  // Selected order for reporting
  const [selectedOrderId, setSelectedOrderId] = useState<string | null>(null);
  const selectedOrder = worklist.orders.find(o => o.id === selectedOrderId);
  const report = useRadiologyReport(selectedOrderId);
  const templates = useRadiologyTemplates(selectedOrder?.modality || selectedOrder?.test?.modality);

  // Report form
  const [reportForm, setReportForm] = useState({ technique: '', clinical_history: '', comparison: '', findings: '', impression: '', is_critical: false, template_used: '' });

  // New order form
  const [orderForm, setOrderForm] = useState({ test_id: '', patient_id: '', clinical_indication: '', urgency: 'routine', creatinine_value: '', contrast_allergy_checked: false, pregnancy_status: 'na' as string, ordered_by: '' });
  const [testSearch, setTestSearch] = useState('');
  const testResults = useMemo(() => testMaster.search(testSearch), [testSearch, testMaster]);
  const [patSearch, setPatSearch] = useState('');
  const [patResults, setPatResults] = useState<any[]>([]);
  const [selectedTest, setSelectedTest] = useState<any>(null);

  // Worklist filters
  const [statusFilter, setStatusFilter] = useState('all');
  const [modalityFilter, setModalityFilter] = useState('all');
  const [urgencyFilter, setUrgencyFilter] = useState('all');

  // Patient search
  useEffect(() => {
    if (patSearch.length < 2 || !sb()) { setPatResults([]); return; }
    const t = setTimeout(async () => {
      const { data } = await sb().from('hmis_patients').select('id, uhid, first_name, last_name, age_years, gender')
        .or(`uhid.ilike.%${patSearch}%,first_name.ilike.%${patSearch}%`).eq('is_active', true).limit(5);
      setPatResults(data || []);
    }, 300);
    return () => clearTimeout(t);
  }, [patSearch]);

  // Load report into form when selected
  useEffect(() => {
    if (report.report) {
      setReportForm({
        technique: report.report.technique || '', clinical_history: report.report.clinical_history || '',
        comparison: report.report.comparison || '', findings: report.report.findings || '',
        impression: report.report.impression || '', is_critical: report.report.is_critical || false,
        template_used: report.report.template_used || '',
      });
    } else {
      setReportForm({ technique: '', clinical_history: '', comparison: '', findings: '', impression: '', is_critical: false, template_used: '' });
    }
  }, [report.report]);

  const applyTemplate = (tmpl: any) => {
    setReportForm(f => ({
      ...f,
      technique: tmpl.technique_text || f.technique,
      findings: tmpl.findings_template || f.findings,
      impression: tmpl.impression_template || f.impression,
      template_used: tmpl.template_name,
    }));
    flash('Template applied: ' + tmpl.template_name);
  };

  const tabs: [Tab, string, string][] = [
    ['worklist', 'Worklist', 'work'], ['new_order', 'New Order', 'order'], ['reporting', 'Reporting', 'report'],
    ['templates', 'Templates', 'tmpl'], ['tat', 'TAT Analytics', 'tat'], ['pacs', 'PACS Config', 'pacs'],
  ];

  return (
    <div className="max-w-7xl mx-auto space-y-4">
      {toast && <div className="fixed top-4 left-1/2 -translate-x-1/2 z-50 bg-green-600 text-white px-4 py-2 rounded-lg shadow-lg text-sm">{toast}</div>}
      <div className="flex items-center justify-between">
        <div><h1 className="text-xl font-bold text-gray-900">Radiology</h1><p className="text-xs text-gray-500">RIS + PACS Integration | {testMaster.tests.length} tests | {testMaster.modalities.length} modalities</p></div>
        <div className="flex gap-2">
          {pacs.config && <span className="text-[10px] bg-green-100 text-green-700 px-2 py-1 rounded">PACS: {pacs.config.pacs_vendor} connected</span>}
          <button onClick={() => setTab('new_order')} className="px-4 py-2 bg-blue-600 text-white text-sm rounded-lg">+ New Order</button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-8 gap-2">
        {[['Ordered', worklist.stats.ordered, 'text-gray-700', 'bg-gray-50'],
          ['Scheduled', worklist.stats.scheduled, 'text-amber-700', 'bg-amber-50'],
          ['In Progress', worklist.stats.inProgress, 'text-purple-700', 'bg-purple-50'],
          ['Reported', worklist.stats.reported, 'text-blue-700', 'bg-blue-50'],
          ['Verified', worklist.stats.verified, 'text-green-700', 'bg-green-50'],
          ['STAT', worklist.stats.stat, worklist.stats.stat > 0 ? 'text-red-700' : 'text-gray-500', worklist.stats.stat > 0 ? 'bg-red-50' : 'bg-white'],
          ['Critical', worklist.stats.critical, worklist.stats.critical > 0 ? 'text-red-700' : 'text-gray-500', worklist.stats.critical > 0 ? 'bg-red-50' : 'bg-white'],
          ['Avg TAT', worklist.stats.avgTat > 0 ? fmtTat(worklist.stats.avgTat) : '—', 'text-gray-700', 'bg-white'],
        ].map(([l, v, tc, bg], i) => (
          <div key={i} className={'rounded-xl border p-2 text-center ' + bg}><div className="text-[9px] text-gray-500 uppercase">{l as string}</div><div className={'text-lg font-bold ' + tc}>{v}</div></div>
        ))}
      </div>

      <div className="flex gap-0.5 border-b pb-px overflow-x-auto">
        {tabs.map(([k, l]) => <button key={k} onClick={() => setTab(k)}
          className={`px-3 py-2 text-xs font-medium whitespace-nowrap border-b-2 -mb-px ${tab === k ? 'border-blue-600 text-blue-700' : 'border-transparent text-gray-500'}`}>{l}</button>)}
      </div>

      {/* ===== WORKLIST ===== */}
      {tab === 'worklist' && <div className="space-y-3">
        <div className="flex gap-1.5 flex-wrap">
          {['all', 'ordered', 'scheduled', 'in_progress', 'reported', 'verified'].map(s => (
            <button key={s} onClick={() => { setStatusFilter(s); worklist.load({ status: s, modality: modalityFilter, urgency: urgencyFilter }); }}
              className={`px-2 py-1 rounded text-[10px] border ${statusFilter === s ? 'bg-blue-600 text-white' : 'bg-white'}`}>{s === 'all' ? 'All' : s.replace('_', ' ')}</button>
          ))}
          <span className="border-l border-gray-200 mx-1" />
          {['all', ...testMaster.modalities].map(m => (
            <button key={m} onClick={() => { setModalityFilter(m); worklist.load({ status: statusFilter, modality: m, urgency: urgencyFilter }); }}
              className={`px-2 py-1 rounded text-[10px] border ${modalityFilter === m ? 'bg-blue-600 text-white' : 'bg-white'}`}>{m === 'all' ? 'All Mod' : m}</button>
          ))}
          <span className="border-l border-gray-200 mx-1" />
          {['all', 'stat', 'urgent', 'routine'].map(u => (
            <button key={u} onClick={() => { setUrgencyFilter(u); worklist.load({ status: statusFilter, modality: modalityFilter, urgency: u }); }}
              className={`px-2 py-1 rounded text-[10px] border ${urgencyFilter === u ? 'bg-blue-600 text-white' : 'bg-white'}`}>{u === 'all' ? 'All Urg' : u.toUpperCase()}</button>
          ))}
        </div>

        {worklist.loading ? <div className="text-center py-8 text-gray-400 text-sm animate-pulse">Loading worklist...</div> :
        worklist.orders.length === 0 ? <div className="text-center py-8 bg-white rounded-xl border text-gray-400 text-sm">No radiology orders found</div> :
        <div className="bg-white rounded-xl border overflow-hidden">
          <table className="w-full text-xs"><thead><tr className="bg-gray-50 border-b text-gray-500">
            <th className="p-2 text-left font-medium">Accession</th>
            <th className="p-2 text-left font-medium">Patient</th>
            <th className="p-2 font-medium">Test</th>
            <th className="p-2 font-medium">Modality</th>
            <th className="p-2 font-medium">Urgency</th>
            <th className="p-2 font-medium">Status</th>
            <th className="p-2 font-medium">Ordered</th>
            <th className="p-2 font-medium">TAT</th>
            <th className="p-2 font-medium">Actions</th>
          </tr></thead><tbody>{worklist.orders.map(o => {
            const tat = o.tat_minutes || (o.status !== 'verified' && o.status !== 'reported' ? Math.round((Date.now() - new Date(o.created_at).getTime()) / 60000) : 0);
            const expectedTat = (o.test?.tat_hours || 24) * 60;
            const hasPacs = !!(o.pacs_study_uid || o.pacs_accession || o.accession_number);
            return (
              <tr key={o.id} className={`border-b hover:bg-blue-50 ${o.urgency === 'stat' ? 'bg-red-50' : ''} ${o.report?.[0]?.is_critical ? 'bg-red-50' : ''}`}>
                <td className="p-2 font-mono text-[10px]">{o.accession_number || '—'}</td>
                <td className="p-2"><span className="font-medium">{o.patient?.first_name} {o.patient?.last_name}</span><span className="text-[10px] text-gray-400 ml-1">{o.patient?.uhid}</span><br/><span className="text-[10px] text-gray-400">{o.patient?.age_years}y {o.patient?.gender}</span></td>
                <td className="p-2 text-center">{o.test?.test_name || '—'}{o.is_contrast && <span className="ml-1 text-[9px] bg-amber-100 text-amber-700 px-1 rounded">C+</span>}</td>
                <td className="p-2 text-center"><span className={`px-1.5 py-0.5 rounded text-[9px] ${MODALITY_COLORS[o.modality || o.test?.modality] || 'bg-gray-100'}`}>{o.modality || o.test?.modality}</span></td>
                <td className="p-2 text-center"><span className={`px-1.5 py-0.5 rounded text-[9px] ${urgColor(o.urgency)}`}>{o.urgency?.toUpperCase()}</span></td>
                <td className="p-2 text-center"><span className={`px-1.5 py-0.5 rounded text-[9px] ${stColor(o.status)}`}>{o.status?.replace('_', ' ')}</span>{o.report?.[0]?.is_critical && <span className="ml-1 text-[9px] bg-red-600 text-white px-1 rounded">CRITICAL</span>}</td>
                <td className="p-2 text-center text-[10px] text-gray-400">{new Date(o.created_at).toLocaleString('en-IN', { hour: '2-digit', minute: '2-digit', day: '2-digit', month: 'short' })}</td>
                <td className="p-2 text-center"><span className={tat > 0 ? tatColor(tat, expectedTat) : 'text-gray-400'}>{tat > 0 ? fmtTat(tat) : '—'}</span></td>
                <td className="p-2 text-center space-x-1">
                  {o.status === 'ordered' && <button onClick={async () => { await worklist.updateStatus(o.id, 'in_progress'); flash('Started'); }} className="px-1.5 py-0.5 bg-purple-100 text-purple-700 rounded text-[9px]">Start</button>}
                  {(o.status === 'in_progress' || o.status === 'ordered') && <button onClick={() => { setSelectedOrderId(o.id); setTab('reporting'); }} className="px-1.5 py-0.5 bg-blue-100 text-blue-700 rounded text-[9px]">Report</button>}
                  {hasPacs && pacs.config && <button onClick={() => { const url = pacs.getViewerUrl(o.pacs_study_uid, o.accession_number); if (url) window.open(url, '_blank'); }} className="px-1.5 py-0.5 bg-green-100 text-green-700 rounded text-[9px]">View</button>}
                </td>
              </tr>
            );
          })}</tbody></table>
        </div>}
      </div>}

      {/* ===== NEW ORDER ===== */}
      {tab === 'new_order' && <div className="bg-white rounded-xl border p-5 space-y-4">
        <h2 className="font-bold text-sm">Create Radiology Order</h2>
        <div className="grid grid-cols-3 gap-3">
          <div className="relative"><label className="text-xs text-gray-500">Test *</label>
            {selectedTest ? (
              <div className="bg-blue-50 rounded-lg px-3 py-2 flex justify-between"><span className="text-sm"><span className={`px-1 py-0.5 rounded text-[9px] mr-1 ${MODALITY_COLORS[selectedTest.modality] || ''}`}>{selectedTest.modality}</span>{selectedTest.test_name}</span><button onClick={() => { setSelectedTest(null); setOrderForm(f => ({...f, test_id: ''})); }} className="text-xs text-red-500">Change</button></div>
            ) : (
              <><input type="text" value={testSearch} onChange={e => setTestSearch(e.target.value)} className="w-full px-3 py-2 border rounded-lg text-sm" placeholder="Search test (CT Brain, MRI Knee...)" />
              {testResults.length > 0 && <div className="absolute top-full left-0 right-0 mt-1 bg-white border rounded-lg shadow-lg z-10 max-h-48 overflow-y-auto">{testResults.map(t => (
                <button key={t.id} onClick={() => { setSelectedTest(t); setOrderForm(f => ({...f, test_id: t.id})); setTestSearch(''); }}
                  className="w-full text-left px-3 py-2 text-xs hover:bg-blue-50 border-b">
                  <span className={`px-1 py-0.5 rounded text-[9px] mr-1 ${MODALITY_COLORS[t.modality] || ''}`}>{t.modality}</span>{t.test_name} — {t.body_part}{t.is_contrast && <span className="ml-1 text-amber-600">(Contrast)</span>}
                </button>
              ))}</div>}</>
            )}</div>
          <div className="relative"><label className="text-xs text-gray-500">Patient *</label>
            {orderForm.patient_id ? <div className="bg-blue-50 rounded-lg px-3 py-2 flex justify-between"><span className="text-sm font-medium">Selected</span><button onClick={() => setOrderForm(f => ({...f, patient_id: ''}))} className="text-xs text-red-500">Change</button></div> :
            <><input type="text" value={patSearch} onChange={e => setPatSearch(e.target.value)} className="w-full px-3 py-2 border rounded-lg text-sm" placeholder="UHID / name" />
            {patResults.length > 0 && <div className="absolute top-full left-0 right-0 mt-1 bg-white border rounded-lg shadow-lg z-10">{patResults.map(p => (
              <button key={p.id} onClick={() => { setOrderForm(f => ({...f, patient_id: p.id})); setPatSearch(p.first_name + ' ' + p.last_name); setPatResults([]); }}
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
              <input type="number" step="0.1" value={orderForm.creatinine_value} onChange={e => setOrderForm(f => ({...f, creatinine_value: e.target.value}))} className="w-full px-3 py-2 border rounded-lg text-sm" placeholder="e.g., 0.9" /></div>
            <div><label className="text-xs text-gray-500">Contrast allergy checked *</label>
              <label className="flex items-center gap-2 mt-2"><input type="checkbox" checked={orderForm.contrast_allergy_checked} onChange={e => setOrderForm(f => ({...f, contrast_allergy_checked: e.target.checked}))} className="rounded" /><span className="text-sm">Allergy checked — no known allergy</span></label></div>
          </>}
          {selectedTest && ['CT', 'FLUORO'].includes(selectedTest.modality) && <div><label className="text-xs text-gray-500">Pregnancy status</label>
            <div className="flex gap-1 mt-1">{['na', 'not_pregnant', 'pregnant', 'unknown'].map(p => (
              <button key={p} onClick={() => setOrderForm(f => ({...f, pregnancy_status: p}))} className={`flex-1 py-1.5 rounded text-[10px] border ${orderForm.pregnancy_status === p ? 'bg-blue-600 text-white' : 'bg-white'}`}>{p === 'na' ? 'N/A' : p.replace('_', ' ')}</button>
            ))}</div></div>}
        </div>
        {actionError && <div className="bg-red-50 border border-red-200 rounded-lg px-4 py-2 text-sm text-red-700">{actionError}</div>}
        <button onClick={async () => {
          setActionError('');
          const result = await worklist.createOrder({ ...orderForm, ordered_by: staffId });
          if (!result.success) { setActionError(result.error || 'Failed'); return; }
          flash('Order created: ' + result.order?.accession_number);
          setTab('worklist'); setOrderForm({ test_id: '', patient_id: '', clinical_indication: '', urgency: 'routine', creatinine_value: '', contrast_allergy_checked: false, pregnancy_status: 'na', ordered_by: '' }); setSelectedTest(null);
        }} disabled={!orderForm.test_id || !orderForm.patient_id}
          className="px-6 py-2.5 bg-green-600 text-white text-sm rounded-lg font-medium disabled:opacity-40">Create Order</button>
      </div>}

      {/* ===== REPORTING ===== */}
      {tab === 'reporting' && <div className="space-y-4">
        {!selectedOrder ? <div className="text-center py-8 bg-white rounded-xl border text-gray-400 text-sm">Select an order from the worklist to start reporting</div> :
        <div className="grid grid-cols-3 gap-4">
          {/* Left: order info + template picker */}
          <div className="space-y-3">
            <div className="bg-white rounded-xl border p-4">
              <div className="font-bold text-sm mb-2">{selectedOrder.test?.test_name}</div>
              <div className="text-xs space-y-1">
                <div><span className="text-gray-500">Patient:</span> <span className="font-medium">{selectedOrder.patient?.first_name} {selectedOrder.patient?.last_name}</span> ({selectedOrder.patient?.uhid})</div>
                <div><span className="text-gray-500">Age/Sex:</span> {selectedOrder.patient?.age_years}y {selectedOrder.patient?.gender}</div>
                <div><span className="text-gray-500">Ordered by:</span> {selectedOrder.ordered_by_doc?.full_name}</div>
                <div><span className="text-gray-500">Indication:</span> {selectedOrder.clinical_indication || '—'}</div>
                <div><span className="text-gray-500">Accession:</span> <span className="font-mono">{selectedOrder.accession_number}</span></div>
                {selectedOrder.is_contrast && <div className="bg-amber-50 rounded px-2 py-1 text-amber-700">Contrast study | Cr: {selectedOrder.creatinine_value}</div>}
              </div>
              {pacs.config && <button onClick={() => { const url = pacs.getViewerUrl(selectedOrder.pacs_study_uid, selectedOrder.accession_number); if (url) window.open(url, '_blank'); else flash('No PACS study linked'); }}
                className="mt-2 w-full px-3 py-2 bg-green-600 text-white text-xs rounded-lg">Open in PACS Viewer</button>}
            </div>
            {/* Templates */}
            <div className="bg-white rounded-xl border p-4">
              <h4 className="text-xs font-bold text-gray-500 mb-2">Report Templates</h4>
              {templates.templates.length === 0 ? <div className="text-xs text-gray-400">No templates for {selectedOrder.modality || selectedOrder.test?.modality}</div> :
              <div className="space-y-1">{templates.templates.map(t => (
                <button key={t.id} onClick={() => applyTemplate(t)} className="w-full text-left px-3 py-2 text-xs bg-gray-50 rounded-lg hover:bg-blue-50">
                  <span className="font-medium">{t.template_name}</span>
                  {t.is_normal && <span className="ml-1 text-[9px] bg-green-100 text-green-700 px-1 rounded">Normal</span>}
                </button>
              ))}</div>}
            </div>
          </div>

          {/* Right: report form */}
          <div className="col-span-2 bg-white rounded-xl border p-5 space-y-3">
            <h3 className="font-bold text-sm">Radiology Report</h3>
            <div className="grid grid-cols-2 gap-3">
              <div><label className="text-xs text-gray-500">Technique</label>
                <textarea value={reportForm.technique} onChange={e => setReportForm(f => ({...f, technique: e.target.value}))} rows={2} className="w-full px-3 py-2 border rounded-lg text-sm" /></div>
              <div><label className="text-xs text-gray-500">Clinical History</label>
                <textarea value={reportForm.clinical_history} onChange={e => setReportForm(f => ({...f, clinical_history: e.target.value}))} rows={2} className="w-full px-3 py-2 border rounded-lg text-sm" /></div>
            </div>
            <div><label className="text-xs text-gray-500">Comparison</label>
              <input type="text" value={reportForm.comparison} onChange={e => setReportForm(f => ({...f, comparison: e.target.value}))} className="w-full px-3 py-2 border rounded-lg text-sm" placeholder="Compared with prior study dated..." /></div>
            <div><label className="text-xs text-gray-500">Findings *</label>
              <textarea value={reportForm.findings} onChange={e => setReportForm(f => ({...f, findings: e.target.value}))} rows={8} className="w-full px-3 py-2 border rounded-lg text-sm" placeholder="Describe findings..." /></div>
            <div><label className="text-xs text-gray-500">Impression *</label>
              <textarea value={reportForm.impression} onChange={e => setReportForm(f => ({...f, impression: e.target.value}))} rows={3} className="w-full px-3 py-2 border rounded-lg text-sm font-medium" placeholder="Conclusion / diagnosis..." /></div>
            <label className="flex items-center gap-2 text-xs bg-red-50 rounded-lg px-3 py-2">
              <input type="checkbox" checked={reportForm.is_critical} onChange={e => setReportForm(f => ({...f, is_critical: e.target.checked}))} className="rounded" />
              <span className="text-red-700 font-medium">CRITICAL finding — requires immediate notification to ordering physician</span>
            </label>
            {actionError && <div className="bg-red-50 border border-red-200 rounded-lg px-4 py-2 text-sm text-red-700">{actionError}</div>}
            <div className="flex gap-2">
              <button onClick={async () => {
                setActionError('');
                const result = await report.save({ ...reportForm, status: 'draft' }, staffId);
                if (!result.success) { setActionError(result.error || 'Failed'); return; }
                flash('Draft saved');
              }} className="px-4 py-2 bg-gray-200 text-sm rounded-lg">Save Draft</button>
              <button onClick={async () => {
                setActionError('');
                const result = await report.save({ ...reportForm, status: 'finalized' }, staffId);
                if (!result.success) { setActionError(result.error || 'Failed'); return; }
                await worklist.updateStatus(selectedOrderId!, 'reported');
                flash('Report finalized'); setSelectedOrderId(null); setTab('worklist');
              }} disabled={!reportForm.findings.trim() || !reportForm.impression.trim()}
                className="px-6 py-2 bg-blue-600 text-white text-sm rounded-lg disabled:opacity-40">Finalize Report</button>
              {report.report?.status === 'finalized' && <button onClick={async () => {
                const result = await report.verify(staffId);
                if (!result.success) { setActionError(result.error || ''); return; }
                await worklist.updateStatus(selectedOrderId!, 'verified');
                flash('Report verified'); setSelectedOrderId(null); setTab('worklist');
              }} className="px-4 py-2 bg-green-600 text-white text-sm rounded-lg">Verify Report</button>}
            </div>
          </div>
        </div>}
      </div>}

      {/* ===== TEMPLATES ===== */}
      {tab === 'templates' && <div className="space-y-3">
        <h2 className="font-bold text-sm">Report Templates ({templates.templates.length})</h2>
        <div className="grid grid-cols-2 gap-3">{templates.templates.map(t => (
          <div key={t.id} className="bg-white rounded-xl border p-4">
            <div className="flex items-center justify-between mb-2">
              <span className="font-semibold text-sm">{t.template_name}</span>
              <div className="flex gap-1">
                <span className={`px-1.5 py-0.5 rounded text-[9px] ${MODALITY_COLORS[t.modality] || 'bg-gray-100'}`}>{t.modality}</span>
                {t.is_normal && <span className="text-[9px] bg-green-100 text-green-700 px-1 rounded">Normal</span>}
              </div>
            </div>
            <div className="text-xs text-gray-500 space-y-1">
              {t.technique_text && <div><span className="font-medium">Technique:</span> {t.technique_text.substring(0, 80)}...</div>}
              <div><span className="font-medium">Findings:</span> {t.findings_template.substring(0, 120)}...</div>
              {t.impression_template && <div><span className="font-medium">Impression:</span> {t.impression_template.substring(0, 80)}...</div>}
            </div>
          </div>
        ))}</div>
      </div>}

      {/* ===== TAT ===== */}
      {tab === 'tat' && <div className="space-y-4">
        <h2 className="font-bold text-sm">Turnaround Time Analytics</h2>
        <div className="grid grid-cols-4 gap-3">
          <div className="bg-white rounded-xl border p-4 text-center"><div className="text-[10px] text-gray-500">Average TAT</div><div className="text-2xl font-bold">{worklist.stats.avgTat > 0 ? fmtTat(worklist.stats.avgTat) : '—'}</div></div>
          {Object.entries(worklist.stats.byModality).sort((a, b) => b[1] - a[1]).slice(0, 3).map(([mod, count]) => (
            <div key={mod} className="bg-white rounded-xl border p-4 text-center"><div className={`text-[10px] ${MODALITY_COLORS[mod] || ''} px-2 py-0.5 rounded inline-block mb-1`}>{mod}</div><div className="text-2xl font-bold">{count}</div><div className="text-[10px] text-gray-400">studies</div></div>
          ))}
        </div>
        {/* TAT by order */}
        <div className="bg-white rounded-xl border overflow-hidden">
          <table className="w-full text-xs"><thead><tr className="bg-gray-50 border-b"><th className="p-2 text-left">Test</th><th className="p-2">Patient</th><th className="p-2">Ordered</th><th className="p-2">Reported</th><th className="p-2">TAT</th><th className="p-2">Expected</th><th className="p-2">Status</th></tr></thead>
          <tbody>{worklist.orders.filter(o => o.tat_minutes).sort((a, b) => b.tat_minutes - a.tat_minutes).slice(0, 20).map(o => {
            const expected = (o.test?.tat_hours || 24) * 60;
            return (
              <tr key={o.id} className="border-b"><td className="p-2 font-medium">{o.test?.test_name}</td><td className="p-2 text-center">{o.patient?.first_name} {o.patient?.last_name}</td>
                <td className="p-2 text-center text-[10px]">{new Date(o.created_at).toLocaleString('en-IN', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}</td>
                <td className="p-2 text-center text-[10px]">{o.reported_at ? new Date(o.reported_at).toLocaleString('en-IN', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }) : '—'}</td>
                <td className={`p-2 text-center font-bold ${tatColor(o.tat_minutes, expected)}`}>{fmtTat(o.tat_minutes)}</td>
                <td className="p-2 text-center text-gray-400">{fmtTat(expected)}</td>
                <td className="p-2 text-center">{o.tat_minutes <= expected ? <span className="bg-green-100 text-green-700 px-1 py-0.5 rounded text-[9px]">On Time</span> : <span className="bg-red-100 text-red-700 px-1 py-0.5 rounded text-[9px]">Delayed</span>}</td>
              </tr>
            );
          })}</tbody></table>
        </div>
      </div>}

      {/* ===== PACS CONFIG ===== */}
      {tab === 'pacs' && <div className="space-y-4">
        <h2 className="font-bold text-sm">PACS Integration — Stradus</h2>
        {pacs.config ? (
          <div className="bg-white rounded-xl border p-5">
            <div className="flex items-center gap-2 mb-3"><span className="w-3 h-3 bg-green-500 rounded-full" /><span className="font-semibold text-green-700">Connected</span></div>
            <div className="grid grid-cols-3 gap-3 text-xs">
              <div><span className="text-gray-500">Vendor:</span> <span className="font-semibold">{pacs.config.pacs_vendor}</span></div>
              <div><span className="text-gray-500">URL:</span> <span className="font-mono">{pacs.config.pacs_url}</span></div>
              <div><span className="text-gray-500">Viewer:</span> <span className="font-mono">{pacs.config.viewer_url || '—'}</span></div>
              <div><span className="text-gray-500">DICOM AE:</span> <span className="font-mono">{pacs.config.dicom_ae_title || '—'}</span></div>
              <div><span className="text-gray-500">DICOM IP:</span> <span className="font-mono">{pacs.config.dicom_ip || '—'}:{pacs.config.dicom_port || 104}</span></div>
              <div><span className="text-gray-500">HL7 Port:</span> <span className="font-mono">{pacs.config.hl7_ip || '—'}:{pacs.config.hl7_port || 2575}</span></div>
            </div>
          </div>
        ) : (
          <div className="bg-white rounded-xl border p-8 text-center">
            <div className="text-lg font-semibold text-gray-700 mb-2">PACS Not Configured</div>
            <div className="text-sm text-gray-500 mb-4">Add Stradus PACS configuration in the hmis_pacs_config table to enable:</div>
            <div className="text-xs text-gray-500 space-y-1 max-w-md mx-auto text-left">
              <div>1. One-click image viewing from worklist (opens Stradus web viewer)</div>
              <div>2. HL7 ORM order messages sent to Stradus when orders are placed</div>
              <div>3. Study UID auto-linking when images are acquired</div>
              <div>4. HL7 ORU report sync from Stradus back to HMIS</div>
            </div>
          </div>
        )}
      </div>}
    </div>
  );
}

export default function RadiologyPage() { return <RoleGuard module="radiology"><RadiologyInner /></RoleGuard>; }
