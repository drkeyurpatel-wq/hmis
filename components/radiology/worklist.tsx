// components/radiology/worklist.tsx
// Main radiology worklist — filterable, sortable, with radiologist assignment,
// inline report writing, critical flags, verify button, TAT display
'use client';
import React, { useState, useEffect, useCallback } from 'react';
import { useRadiologyWorklist, useRadiologyReport, type RadiologyOrder, type WorklistFilters } from '@/lib/radiology/radiology-hooks';
import { sb } from '@/lib/supabase/browser';

const MOD_COLORS: Record<string, string> = { XR: 'bg-blue-100 text-blue-700', CT: 'bg-purple-100 text-purple-700', MRI: 'bg-indigo-100 text-indigo-700', USG: 'bg-green-100 text-green-700', ECHO: 'bg-red-100 text-red-700', DEXA: 'bg-teal-100 text-teal-700', MAMMO: 'bg-pink-100 text-pink-700', FLUORO: 'bg-amber-100 text-amber-700' };
const urgColor = (u: string) => u === 'stat' ? 'bg-red-600 text-white' : u === 'urgent' ? 'bg-amber-500 text-white' : 'bg-gray-100 text-gray-600';
const stColor = (s: string) => s === 'verified' ? 'bg-green-100 text-green-700' : s === 'reported' ? 'bg-blue-100 text-blue-700' : s === 'in_progress' ? 'bg-purple-100 text-purple-700' : s === 'scheduled' ? 'bg-amber-100 text-amber-700' : 'bg-gray-100 text-gray-600';
const fmtTat = (mins: number) => mins >= 60 ? `${Math.floor(mins / 60)}h ${mins % 60}m` : `${mins}m`;

// TAT color: green <2h, amber 2-4h, red >4h
const tatColorFixed = (mins: number) => mins <= 120 ? 'text-green-700' : mins <= 240 ? 'text-amber-700 font-medium' : 'text-red-700 font-bold';

const REPORT_TEMPLATES: { label: string; findings: string; impression: string }[] = [
  { label: '-- Select Template --', findings: '', impression: '' },
  { label: 'Normal Chest X-Ray', findings: 'The lungs are clear bilaterally. No consolidation, effusion, or pneumothorax. Heart size is normal. Mediastinal contours are unremarkable. Bony structures are intact.', impression: 'Normal chest radiograph. No acute cardiopulmonary abnormality.' },
  { label: 'Normal CT Head', findings: 'No intracranial hemorrhage, mass, or midline shift. Ventricles and sulci are normal in size and configuration. Gray-white matter differentiation is preserved. No extra-axial collection.', impression: 'Normal non-contrast CT head. No acute intracranial abnormality.' },
  { label: 'Normal Abdomen USG', findings: 'Liver is normal in size and echotexture. No focal hepatic lesion. Gallbladder is normal, no stones. CBD is not dilated. Pancreas, spleen, and kidneys are normal. No ascites.', impression: 'Normal abdominal ultrasound.' },
  { label: 'Normal MRI Brain', findings: 'No restricted diffusion to suggest acute infarct. No intracranial mass or hemorrhage. Ventricles and sulci are normal. White matter signal is normal. No abnormal enhancement.', impression: 'Normal MRI brain. No acute intracranial pathology.' },
];

interface Props {
  centreId: string;
  modalities: string[];
  staffId: string;
  onSelectOrder: (order: RadiologyOrder) => void;
  onLinkStudy: (order: RadiologyOrder) => void;
  onFlash: (msg: string) => void;
  pacsConfig?: any;
}

export default function RadiologyWorklist({ centreId, modalities, staffId, onSelectOrder, onLinkStudy, onFlash, pacsConfig }: Props) {
  const worklist = useRadiologyWorklist(centreId);
  const [searchText, setSearchText] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [modalityFilter, setModalityFilter] = useState('all');
  const [urgencyFilter, setUrgencyFilter] = useState('all');
  const [dateFilter, setDateFilter] = useState(new Date().toISOString().split('T')[0]);

  // Expanded row for inline report writing
  const [expandedOrderId, setExpandedOrderId] = useState<string | null>(null);

  const applyFilters = (overrides?: Partial<WorklistFilters>) => {
    const f: WorklistFilters = {
      status: overrides?.status ?? statusFilter,
      modality: overrides?.modality ?? modalityFilter,
      urgency: overrides?.urgency ?? urgencyFilter,
      dateFrom: dateFilter,
      dateTo: dateFilter,
      search: searchText,
      ...overrides,
    };
    worklist.load(f);
  };

  // Technician list for assignment
  const [technicians, setTechnicians] = useState<any[]>([]);
  // Radiologist list for assignment
  const [radiologists, setRadiologists] = useState<any[]>([]);

  useEffect(() => {
    if (!sb()) return;
    sb().from('hmis_staff').select('id, full_name').eq('is_active', true)
      .ilike('designation', '%technician%').order('full_name').limit(50)
      .then(({ data }: any) => setTechnicians(data || []));
    // Query radiologists: staff_type = 'doctor' and specialisation contains 'radiol'
    sb().from('hmis_staff').select('id, full_name').eq('is_active', true)
      .eq('staff_type', 'doctor').ilike('specialisation', '%radiol%')
      .order('full_name').limit(50)
      .then(({ data }: any) => setRadiologists(data || []));
  }, []);

  return (
    <div className="space-y-3">
      {/* Search + Date + Filters */}
      <div className="flex gap-2 flex-wrap items-center">
        <input type="text" value={searchText} onChange={e => setSearchText(e.target.value)} onKeyDown={e => e.key === 'Enter' && applyFilters({ search: searchText })}
          placeholder="Search patient, UHID, accession..." className="px-3 py-1.5 border rounded-lg text-xs w-56" />
        <input type="date" value={dateFilter} onChange={e => { setDateFilter(e.target.value); applyFilters({ dateFrom: e.target.value, dateTo: e.target.value }); }}
          className="px-3 py-1.5 border rounded-lg text-xs" />
        <button onClick={() => { setDateFilter(''); applyFilters({ dateFrom: undefined, dateTo: undefined }); }}
          className="px-2 py-1.5 border rounded-lg text-xs bg-gray-50">All Dates</button>
        <button onClick={() => applyFilters()} className="px-3 py-1.5 bg-blue-600 text-white rounded-lg text-xs">Refresh</button>
      </div>

      {/* Status / modality / urgency filter chips */}
      <div className="flex gap-1 flex-wrap">
        {['all', 'ordered', 'scheduled', 'in_progress', 'reported', 'verified'].map(s => (
          <button key={s} onClick={() => { setStatusFilter(s); applyFilters({ status: s }); }}
            className={`px-2 py-1 rounded text-[10px] border ${statusFilter === s ? 'bg-blue-600 text-white' : 'bg-white'}`}>{s === 'all' ? 'All Status' : s.replace('_', ' ')}</button>
        ))}
        <span className="border-l mx-1" />
        {['all', ...modalities].map(m => (
          <button key={m} onClick={() => { setModalityFilter(m); applyFilters({ modality: m }); }}
            className={`px-2 py-1 rounded text-[10px] border ${modalityFilter === m ? 'bg-blue-600 text-white' : m !== 'all' ? MOD_COLORS[m] || 'bg-white' : 'bg-white'}`}>{m === 'all' ? 'All Mod' : m}</button>
        ))}
        <span className="border-l mx-1" />
        {['all', 'stat', 'urgent', 'routine'].map(u => (
          <button key={u} onClick={() => { setUrgencyFilter(u); applyFilters({ urgency: u }); }}
            className={`px-2 py-1 rounded text-[10px] border ${urgencyFilter === u ? 'bg-blue-600 text-white' : 'bg-white'}`}>{u === 'all' ? 'All Urg' : u.toUpperCase()}</button>
        ))}
      </div>

      {/* Table */}
      {worklist.loading ? <div className="py-8 text-center text-gray-400 animate-pulse">Loading worklist...</div> :
      worklist.orders.length === 0 ? <div className="py-8 bg-white rounded-xl border text-center text-gray-400 text-sm">No orders found</div> :
      <div className="bg-white rounded-xl border overflow-hidden overflow-x-auto">
        <table className="w-full text-xs min-w-[1100px]"><thead><tr className="bg-gray-50 border-b text-gray-500">
          <th className="p-2 text-left font-medium w-24">Accession</th>
          <th className="p-2 text-left font-medium">Patient</th>
          <th className="p-2 font-medium">Test</th>
          <th className="p-2 font-medium w-14">Mod</th>
          <th className="p-2 font-medium w-14">Urg</th>
          <th className="p-2 font-medium w-20">Status</th>
          <th className="p-2 font-medium w-28">Assigned To</th>
          <th className="p-2 font-medium w-16">Images</th>
          <th className="p-2 font-medium w-16">Report</th>
          <th className="p-2 font-medium w-20">TAT</th>
          <th className="p-2 font-medium w-44">Actions</th>
        </tr></thead><tbody>{worklist.orders.map(o => {
          // TAT: use reported TAT if available, otherwise compute live elapsed
          const reportedAt = o.reported_at ? new Date(o.reported_at).getTime() : 0;
          const orderedAt = new Date(o.created_at).getTime();
          const tat = o.tat_minutes || (reportedAt > 0 ? Math.round((reportedAt - orderedAt) / 60000) : (['ordered', 'scheduled', 'in_progress'].includes(o.status) ? Math.round((Date.now() - orderedAt) / 60000) : 0));
          const hasStradus = !!(o.stradus_viewer_url || o.pacs_study_uid);
          const hasReport = o.report && o.report.length > 0;
          const isCritical = o.report?.[0]?.is_critical === true;
          const stradusUrl = o.stradus_viewer_url || (pacsConfig?.viewer_url && o.pacs_study_uid ? `${pacsConfig.viewer_url}?StudyInstanceUID=${o.pacs_study_uid}` : null);
          const isExpanded = expandedOrderId === o.id;

          return (
            <React.Fragment key={o.id}>
              <tr className={`border-b hover:bg-blue-50 cursor-pointer ${o.urgency === 'stat' ? 'bg-red-50/50' : ''} ${isCritical ? 'bg-red-50/70' : ''} ${isExpanded ? 'bg-blue-50' : ''}`}>
                <td className="p-2 font-mono text-[10px] text-gray-500">
                  {isCritical && <span className="inline-block w-2 h-2 bg-red-600 rounded-full mr-1 animate-pulse" title="Critical Finding" />}
                  {o.accession_number || '\u2014'}
                </td>
                <td className="p-2">
                  <div className="font-medium">{o.patient?.first_name} {o.patient?.last_name}</div>
                  <div className="text-[10px] text-gray-400">{o.patient?.uhid} | {o.patient?.age_years}y {o.patient?.gender}</div>
                </td>
                <td className="p-2 text-center">{o.test?.test_name}{o.is_contrast && <span className="ml-1 text-[8px] bg-amber-100 text-amber-700 px-0.5 rounded">C+</span>}</td>
                <td className="p-2 text-center"><span className={`px-1 py-0.5 rounded text-[9px] ${MOD_COLORS[o.modality] || 'bg-gray-100'}`}>{o.modality}</span></td>
                <td className="p-2 text-center"><span className={`px-1 py-0.5 rounded text-[9px] ${urgColor(o.urgency)}`}>{o.urgency?.toUpperCase()}</span></td>
                <td className="p-2 text-center"><span className={`px-1.5 py-0.5 rounded text-[9px] ${stColor(o.status)}`}>{o.status?.replace('_', ' ')}</span></td>
                {/* Radiologist assignment dropdown */}
                <td className="p-2 text-center" onClick={e => e.stopPropagation()}>
                  <select
                    value={o.assigned_to || ''}
                    onChange={async (e) => {
                      const res = await worklist.assignRadiologist(o.id, e.target.value);
                      if (res.success) onFlash('Radiologist assigned');
                      else onFlash(res.error || 'Failed to assign');
                    }}
                    className="text-[10px] border rounded px-1 py-0.5 w-full max-w-[110px] bg-white"
                  >
                    <option value="">Unassigned</option>
                    {radiologists.map(r => <option key={r.id} value={r.id}>{r.full_name}</option>)}
                  </select>
                </td>
                <td className="p-2 text-center">
                  {stradusUrl ? (
                    <a href={stradusUrl} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline text-[10px]">View</a>
                  ) : (
                    <button onClick={(e) => { e.stopPropagation(); onLinkStudy(o); }} className="text-[10px] text-amber-600 hover:underline">Link</button>
                  )}
                </td>
                <td className="p-2 text-center">
                  {hasReport ? <span className={`text-[9px] px-1 py-0.5 rounded ${isCritical ? 'bg-red-600 text-white animate-pulse' : o.report?.[0]?.status === 'verified' ? 'bg-green-100 text-green-700' : 'bg-blue-100 text-blue-700'}`}>{isCritical ? 'CRITICAL' : o.report?.[0]?.status === 'verified' ? 'Verified' : 'Reported'}</span> : <span className="text-[10px] text-gray-300">{'\u2014'}</span>}
                </td>
                {/* TAT display with color coding: green <2h, amber 2-4h, red >4h */}
                <td className="p-2 text-center">{tat > 0 ? <span className={tatColorFixed(tat)}>{fmtTat(tat)}</span> : '\u2014'}</td>
                <td className="p-2 text-center space-x-1" onClick={e => e.stopPropagation()}>
                  {o.status === 'ordered' && <button onClick={async () => { await worklist.updateStatus(o.id, 'in_progress'); onFlash('Started'); }} className="px-1.5 py-0.5 bg-purple-100 text-purple-700 rounded text-[9px]">Start</button>}
                  {['ordered', 'in_progress'].includes(o.status) && <button onClick={() => onLinkStudy(o)} className="px-1.5 py-0.5 bg-amber-100 text-amber-700 rounded text-[9px]">Link</button>}
                  {/* Report button — opens inline report panel */}
                  {['in_progress', 'ordered'].includes(o.status) && (
                    <button onClick={() => setExpandedOrderId(isExpanded ? null : o.id)} className="px-1.5 py-0.5 bg-blue-100 text-blue-700 rounded text-[9px]">
                      {isExpanded ? 'Close' : 'Report'}
                    </button>
                  )}
                  {/* Verify button — only when status is 'reported' */}
                  {o.status === 'reported' && (
                    <button onClick={async () => {
                      const res = await worklist.updateStatus(o.id, 'verified');
                      if (res.success) onFlash('Study verified');
                      else onFlash(res.error || 'Verification failed');
                    }} className="px-1.5 py-0.5 bg-green-600 text-white rounded text-[9px]">
                      Verify
                    </button>
                  )}
                  <button onClick={() => onSelectOrder(o)} className="px-1.5 py-0.5 bg-gray-100 text-gray-600 rounded text-[9px]">Detail</button>
                </td>
              </tr>
              {/* Inline report writing panel */}
              {isExpanded && (
                <tr><td colSpan={11} className="p-0">
                  <InlineReportPanel
                    order={o}
                    staffId={staffId}
                    onFlash={onFlash}
                    onDone={() => { setExpandedOrderId(null); worklist.load(); }}
                  />
                </td></tr>
              )}
            </React.Fragment>
          );
        })}</tbody></table>
      </div>}
    </div>
  );
}

// ============================================================
// INLINE REPORT PANEL — expands below the worklist row
// ============================================================
function InlineReportPanel({ order, staffId, onFlash, onDone }: {
  order: RadiologyOrder;
  staffId: string;
  onFlash: (msg: string) => void;
  onDone: () => void;
}) {
  const report = useRadiologyReport(order.id);
  const [findings, setFindings] = useState('');
  const [impression, setImpression] = useState('');
  const [recommendations, setRecommendations] = useState('');
  const [technique, setTechnique] = useState('');
  const [isCritical, setIsCritical] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  // Populate from existing report if any
  useEffect(() => {
    if (report.latestReport) {
      setFindings(report.latestReport.findings || '');
      setImpression(report.latestReport.impression || '');
      setTechnique(report.latestReport.technique || '');
      setIsCritical(report.latestReport.is_critical || false);
    }
  }, [report.latestReport]);

  const applyTemplate = (idx: number) => {
    if (idx <= 0) return;
    const t = REPORT_TEMPLATES[idx];
    if (t) {
      setFindings(t.findings);
      setImpression(t.impression);
    }
  };

  const handleSave = async (finalize: boolean) => {
    if (!findings.trim()) { setError('Findings are required'); return; }
    if (!impression.trim()) { setError('Impression are required'); return; }
    setError('');
    setSaving(true);

    const data: any = {
      findings: findings.trim(),
      impression: impression.trim(),
      technique: technique.trim() || undefined,
      is_critical: isCritical,
      status: finalize ? 'finalized' : 'draft',
    };
    if (recommendations.trim()) {
      data.findings = data.findings + '\n\nRecommendations:\n' + recommendations.trim();
    }

    const res = await report.save(data, staffId);
    if (!res.success) { setError(res.error || 'Save failed'); setSaving(false); return; }

    // Update order status to reported if finalizing
    if (finalize) {
      if (!sb()) { setSaving(false); return; }
      await sb().from('hmis_radiology_orders').update({
        status: 'reported',
        reported_at: new Date().toISOString(),
        tat_minutes: Math.round((Date.now() - new Date(order.created_at).getTime()) / 60000),
        updated_at: new Date().toISOString(),
      }).eq('id', order.id);

      // If critical, also update order-level flag
      if (isCritical) {
        await sb().from('hmis_radiology_reports')
          .update({ is_critical: true })
          .eq('radiology_order_id', order.id)
          .is('is_addendum', false);
      }
    }

    setSaving(false);
    onFlash(finalize ? 'Report finalized' : 'Draft saved');
    if (finalize) onDone();
  };

  const handleMarkCritical = async () => {
    setIsCritical(!isCritical);
    // If there is already an existing report, also update it in DB
    if (report.latestReport?.id) {
      const newCritical = !isCritical;
      await sb()?.from('hmis_radiology_reports').update({ is_critical: newCritical }).eq('id', report.latestReport.id);
      report.load();
      onFlash(newCritical ? 'Marked as critical' : 'Critical flag removed');
    }
  };

  return (
    <div className="bg-blue-50/50 border-t border-b-2 border-blue-200 px-4 py-3 space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <h4 className="text-sm font-bold text-gray-800">Write Report</h4>
          <span className="text-[10px] text-gray-500">
            {order.patient?.first_name} {order.patient?.last_name} &mdash; {order.test?.test_name} ({order.modality})
          </span>
        </div>
        <div className="flex items-center gap-2">
          {/* Critical finding checkbox */}
          <label className={`flex items-center gap-1 px-2 py-1 rounded text-[10px] cursor-pointer border ${isCritical ? 'bg-red-100 border-red-300 text-red-700' : 'bg-white border-gray-200 text-gray-500'}`}>
            <input type="checkbox" checked={isCritical} onChange={handleMarkCritical} className="w-3 h-3" />
            Critical Finding
          </label>
          <button onClick={() => onDone()} className="text-gray-400 hover:text-gray-600 text-sm px-1">Close</button>
        </div>
      </div>

      {/* Template selector */}
      <div>
        <select onChange={e => applyTemplate(parseInt(e.target.value))} defaultValue="0"
          className="text-xs border rounded-lg px-2 py-1.5 bg-white w-64">
          {REPORT_TEMPLATES.map((t, i) => <option key={i} value={i}>{t.label}</option>)}
        </select>
      </div>

      <div className="grid grid-cols-2 gap-3">
        {/* Technique */}
        <div>
          <label className="text-[10px] text-gray-500 font-medium block mb-0.5">Technique</label>
          <input type="text" value={technique} onChange={e => setTechnique(e.target.value)}
            placeholder="e.g. Non-contrast CT, PA and lateral views..."
            className="w-full px-2 py-1.5 border rounded-lg text-xs" />
        </div>
        <div />

        {/* Findings */}
        <div>
          <label className="text-[10px] text-gray-500 font-medium block mb-0.5">Findings *</label>
          <textarea value={findings} onChange={e => setFindings(e.target.value)}
            rows={5} placeholder="Describe the findings..."
            className="w-full px-2 py-1.5 border rounded-lg text-xs resize-y" />
        </div>

        {/* Impression */}
        <div>
          <label className="text-[10px] text-gray-500 font-medium block mb-0.5">Impression *</label>
          <textarea value={impression} onChange={e => setImpression(e.target.value)}
            rows={3} placeholder="Summary / diagnosis..."
            className="w-full px-2 py-1.5 border rounded-lg text-xs resize-y" />

          <label className="text-[10px] text-gray-500 font-medium block mt-2 mb-0.5">Recommendations</label>
          <textarea value={recommendations} onChange={e => setRecommendations(e.target.value)}
            rows={2} placeholder="Follow-up, additional studies..."
            className="w-full px-2 py-1.5 border rounded-lg text-xs resize-y" />
        </div>
      </div>

      {error && <div className="text-xs text-red-600 bg-red-50 px-3 py-1.5 rounded">{error}</div>}

      <div className="flex items-center gap-2 pt-1">
        <button onClick={() => handleSave(false)} disabled={saving}
          className="px-3 py-1.5 bg-gray-100 text-gray-700 text-xs rounded-lg hover:bg-gray-200 disabled:opacity-50">
          {saving ? 'Saving...' : 'Save Draft'}
        </button>
        <button onClick={() => handleSave(true)} disabled={saving}
          className="px-4 py-1.5 bg-blue-600 text-white text-xs rounded-lg hover:bg-blue-700 disabled:opacity-50">
          {saving ? 'Saving...' : 'Finalize Report'}
        </button>
        {isCritical && (
          <span className="text-[10px] text-red-600 bg-red-50 px-2 py-1 rounded border border-red-200 animate-pulse">
            This will be flagged as a CRITICAL FINDING
          </span>
        )}
      </div>
    </div>
  );
}
