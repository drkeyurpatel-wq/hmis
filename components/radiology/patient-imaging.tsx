// components/radiology/patient-imaging.tsx
// THE key component: shows all imaging for a patient in their EMR file.
// Each study has a clickable Stradus link → opens PACS viewer directly.
// Reports from Stradus are displayed inline.
'use client';
import React, { useState } from 'react';
import { usePatientImaging, usePACSConfig, type PatientStudy } from '@/lib/radiology/radiology-hooks';
import { useAuthStore } from '@/lib/store/auth';

const MOD_COLORS: Record<string, string> = {
  XR: 'bg-blue-100 text-blue-700 border-blue-200', CT: 'bg-purple-100 text-purple-700 border-purple-200',
  MRI: 'bg-indigo-100 text-indigo-700 border-indigo-200', USG: 'bg-green-100 text-green-700 border-green-200',
  ECHO: 'bg-red-100 text-red-700 border-red-200', DEXA: 'bg-teal-100 text-teal-700 border-teal-200',
  MAMMO: 'bg-pink-100 text-pink-700 border-pink-200', FLUORO: 'bg-amber-100 text-amber-700 border-amber-200',
};

const MOD_ICONS: Record<string, string> = {
  XR: '🩻', CT: '🔬', MRI: '🧲', USG: '📡', ECHO: '❤️', DEXA: '🦴', MAMMO: '🩺', FLUORO: '📸',
};

function StudyCard({ study, pacsConfig, onExpand }: { study: PatientStudy; pacsConfig: any; onExpand: () => void }) {
  const modCfg = MOD_COLORS[study.modality] || 'bg-gray-100 text-gray-700 border-gray-200';
  const icon = MOD_ICONS[study.modality] || '📋';
  const date = new Date(study.date);
  const dateStr = date.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
  const timeStr = date.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });

  // Build Stradus URL: prefer stored link, fallback to computed
  const stradusUrl = study.stradusUrl ||
    (pacsConfig?.viewer_url && study.pacsStudyUid ? `${pacsConfig.viewer_url}?StudyInstanceUID=${study.pacsStudyUid}` : null) ||
    (pacsConfig?.viewer_url && study.accessionNumber ? `${pacsConfig.viewer_url}?AccessionNumber=${study.accessionNumber}` : null);

  return (
    <div className={`rounded-xl border-2 ${study.isCritical ? 'border-red-400 bg-red-50' : 'border-gray-200 bg-white'} overflow-hidden`}>
      {/* Header */}
      <div className="px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <span className="text-xl">{icon}</span>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-semibold text-sm">{study.testName}</span>
              <span className={`px-1.5 py-0.5 rounded text-[9px] border ${modCfg}`}>{study.modality}</span>
              {study.isContrast && <span className="px-1.5 py-0.5 rounded text-[9px] bg-amber-100 text-amber-700 border border-amber-200">C+</span>}
              {study.urgency === 'stat' && <span className="px-1.5 py-0.5 rounded text-[9px] bg-red-600 text-white">STAT</span>}
              {study.isCritical && <span className="px-1.5 py-0.5 rounded text-[9px] bg-red-600 text-white animate-pulse">CRITICAL</span>}
            </div>
            <div className="text-[10px] text-gray-400 mt-0.5">{dateStr} at {timeStr} | ACC: {study.accessionNumber}</div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* Report status */}
          {study.hasReport ? (
            <span className={`px-2 py-1 rounded text-[10px] ${
              study.reportStatus === 'verified' ? 'bg-green-100 text-green-700' :
              study.reportStatus === 'finalized' ? 'bg-blue-100 text-blue-700' :
              'bg-gray-100 text-gray-600'
            }`}>{study.reportStatus === 'verified' ? '✓ Verified' : study.reportStatus === 'finalized' ? 'Reported' : study.reportStatus}</span>
          ) : (
            <span className="px-2 py-1 rounded text-[10px] bg-amber-100 text-amber-700">Awaiting Report</span>
          )}

          {/* STRADUS VIEWER LINK — the key button */}
          {stradusUrl ? (
            <a href={stradusUrl} target="_blank" rel="noopener noreferrer"
              className="px-3 py-1.5 bg-gradient-to-r from-blue-600 to-blue-700 text-white text-xs rounded-lg font-medium hover:from-blue-700 hover:to-blue-800 shadow-sm flex items-center gap-1.5 transition-all">
              <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M15 3h6v6M9 21H3v-6M21 3l-7 7M3 21l7-7"/></svg>
              View Images
            </a>
          ) : (
            <span className="px-3 py-1.5 bg-gray-100 text-gray-400 text-xs rounded-lg">No Images Linked</span>
          )}

          {/* Expand button */}
          <button onClick={onExpand} className="px-2 py-1.5 text-gray-400 hover:text-blue-600 text-xs">Details</button>
        </div>
      </div>

      {/* Report preview — always show impression if available */}
      {study.hasReport && study.impression && (
        <div className={`px-4 py-2 border-t ${study.isCritical ? 'border-red-300 bg-red-50' : 'border-gray-100 bg-gray-50'}`}>
          <div className="text-[10px] text-gray-500 mb-0.5">Impression</div>
          <div className={`text-xs ${study.isCritical ? 'text-red-800 font-medium' : 'text-gray-700'}`}>{study.impression}</div>
          <div className="text-[9px] text-gray-400 mt-1">
            {study.reportedBy && <>Reported by: {study.reportedBy}</>}
            {study.verifiedBy && <> | Verified by: {study.verifiedBy}</>}
          </div>
        </div>
      )}
    </div>
  );
}

function StudyDetail({ study, pacsConfig, onClose }: { study: PatientStudy; pacsConfig: any; onClose: () => void }) {
  const [reportData, setReportData] = useState<any>(null);
  const [loadingReport, setLoadingReport] = useState(false);

  // Load full report
  React.useEffect(() => {
    if (!study.hasReport) return;
    setLoadingReport(true);
    const fetchReport = async () => {
      const sb = (await import('@/lib/supabase/client')).createClient();
      const { data } = await sb.from('hmis_radiology_reports')
        .select('*, reporter:hmis_staff!hmis_radiology_reports_reported_by_fkey(full_name), verifier:hmis_staff!hmis_radiology_reports_verified_by_fkey(full_name)')
        .eq('radiology_order_id', study.orderId).order('created_at', { ascending: false });
      setReportData(data || []);
      setLoadingReport(false);
    };
    fetchReport();
  }, [study]);

  const stradusUrl = study.stradusUrl ||
    (pacsConfig?.viewer_url && study.pacsStudyUid ? `${pacsConfig.viewer_url}?StudyInstanceUID=${study.pacsStudyUid}` : null) ||
    (pacsConfig?.viewer_url && study.accessionNumber ? `${pacsConfig.viewer_url}?AccessionNumber=${study.accessionNumber}` : null);

  const mainReport = reportData?.[0];
  const addendums = reportData?.filter((r: any) => r.is_addendum) || [];

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex justify-end">
      <div className="w-[700px] h-full bg-white shadow-2xl overflow-y-auto">
        {/* Header */}
        <div className="sticky top-0 bg-white border-b px-6 py-4 z-10">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-bold">{study.testName}</h2>
              <div className="text-xs text-gray-500">{new Date(study.date).toLocaleDateString('en-IN', { day: '2-digit', month: 'long', year: 'numeric' })} | ACC: {study.accessionNumber}</div>
            </div>
            <div className="flex items-center gap-2">
              {stradusUrl && (
                <a href={stradusUrl} target="_blank" rel="noopener noreferrer"
                  className="px-4 py-2 bg-blue-600 text-white text-sm rounded-lg font-medium hover:bg-blue-700 flex items-center gap-2">
                  <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M15 3h6v6M9 21H3v-6M21 3l-7 7M3 21l7-7"/></svg>
                  Open in Stradus
                </a>
              )}
              <button onClick={onClose} className="px-3 py-2 text-gray-400 hover:text-gray-600 text-lg">✕</button>
            </div>
          </div>
        </div>

        <div className="px-6 py-4 space-y-4">
          {/* Study info */}
          <div className="grid grid-cols-3 gap-3 bg-gray-50 rounded-xl p-4 text-xs">
            <div><span className="text-gray-500 block">Modality</span><span className="font-semibold">{study.modality}</span></div>
            <div><span className="text-gray-500 block">Body Part</span><span className="font-semibold">{study.bodyPart}</span></div>
            <div><span className="text-gray-500 block">Urgency</span><span className={`font-semibold ${study.urgency === 'stat' ? 'text-red-700' : ''}`}>{study.urgency.toUpperCase()}</span></div>
            <div><span className="text-gray-500 block">Status</span><span className="font-semibold">{study.status}</span></div>
            <div><span className="text-gray-500 block">Contrast</span><span className="font-semibold">{study.isContrast ? 'Yes' : 'No'}</span></div>
            <div><span className="text-gray-500 block">PACS Study UID</span><span className="font-mono text-[10px]">{study.pacsStudyUid || 'Not linked'}</span></div>
          </div>

          {/* Stradus link display */}
          {stradusUrl && (
            <div className="bg-blue-50 rounded-xl p-4 border border-blue-200">
              <div className="text-xs text-blue-600 font-medium mb-1">Stradus PACS Link</div>
              <a href={stradusUrl} target="_blank" rel="noopener noreferrer" className="text-sm text-blue-700 hover:underline break-all">{stradusUrl}</a>
            </div>
          )}

          {/* Report */}
          {loadingReport ? <div className="py-4 text-center text-gray-400 animate-pulse">Loading report...</div> :
          !study.hasReport ? (
            <div className="bg-amber-50 rounded-xl p-6 text-center border border-amber-200">
              <div className="text-amber-700 font-medium mb-1">Report Pending</div>
              <div className="text-xs text-amber-600">This study has not been reported yet in Stradus RIS. The report will appear here automatically once finalized.</div>
            </div>
          ) : mainReport ? (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="font-bold text-sm">Radiology Report</h3>
                <div className="flex items-center gap-2">
                  {mainReport.is_critical && <span className="bg-red-600 text-white px-2 py-0.5 rounded text-[10px]">CRITICAL FINDING</span>}
                  <span className={`px-2 py-0.5 rounded text-[10px] ${
                    mainReport.status === 'verified' ? 'bg-green-100 text-green-700' : 'bg-blue-100 text-blue-700'
                  }`}>{mainReport.status}</span>
                </div>
              </div>

              {mainReport.technique && <div className="bg-gray-50 rounded-lg p-3">
                <div className="text-[10px] text-gray-500 font-medium mb-1">TECHNIQUE</div>
                <div className="text-xs text-gray-700">{mainReport.technique}</div>
              </div>}

              {mainReport.clinical_history && <div className="bg-gray-50 rounded-lg p-3">
                <div className="text-[10px] text-gray-500 font-medium mb-1">CLINICAL HISTORY</div>
                <div className="text-xs text-gray-700">{mainReport.clinical_history}</div>
              </div>}

              {mainReport.comparison && <div className="bg-gray-50 rounded-lg p-3">
                <div className="text-[10px] text-gray-500 font-medium mb-1">COMPARISON</div>
                <div className="text-xs text-gray-700">{mainReport.comparison}</div>
              </div>}

              <div className="bg-white rounded-lg p-4 border">
                <div className="text-[10px] text-gray-500 font-medium mb-1">FINDINGS</div>
                <div className="text-sm text-gray-800 whitespace-pre-wrap leading-relaxed">{mainReport.findings}</div>
              </div>

              <div className={`rounded-lg p-4 border-2 ${mainReport.is_critical ? 'bg-red-50 border-red-300' : 'bg-blue-50 border-blue-200'}`}>
                <div className={`text-[10px] font-medium mb-1 ${mainReport.is_critical ? 'text-red-600' : 'text-blue-600'}`}>IMPRESSION</div>
                <div className={`text-sm font-medium whitespace-pre-wrap leading-relaxed ${mainReport.is_critical ? 'text-red-800' : 'text-blue-800'}`}>{mainReport.impression}</div>
              </div>

              {/* Report metadata */}
              <div className="flex items-center justify-between text-[10px] text-gray-400 bg-gray-50 rounded-lg px-4 py-2">
                <div>Reported by: <span className="text-gray-600 font-medium">{mainReport.reporter?.full_name || 'Stradus RIS'}</span></div>
                {mainReport.verifier && <div>Verified by: <span className="text-gray-600 font-medium">{mainReport.verifier.full_name}</span></div>}
                <div>{new Date(mainReport.created_at).toLocaleString('en-IN')}</div>
              </div>

              {mainReport.is_critical && mainReport.critical_notified && (
                <div className="bg-red-50 rounded-lg p-3 text-xs text-red-700 border border-red-200">
                  <span className="font-medium">Critical finding notified to:</span> {mainReport.critical_notified_to} at {new Date(mainReport.critical_notified_at).toLocaleString('en-IN')}
                </div>
              )}

              {/* Addendums */}
              {addendums.length > 0 && <div className="space-y-2">
                <h4 className="text-xs font-bold text-gray-500">Addendums ({addendums.length})</h4>
                {addendums.map((add: any) => (
                  <div key={add.id} className="bg-amber-50 rounded-lg p-3 border border-amber-200">
                    <div className="text-[10px] text-amber-600 mb-1">Addendum — {new Date(add.created_at).toLocaleString('en-IN')}</div>
                    <div className="text-xs text-gray-700">{add.findings}</div>
                    {add.impression && <div className="text-xs text-gray-800 font-medium mt-1">Impression: {add.impression}</div>}
                  </div>
                ))}
              </div>}
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}

// ============================================================
// MAIN EXPORT — Patient Imaging Tab for EMR
// ============================================================
interface PatientImagingProps {
  patientId: string;
  patientUhid?: string;
}

export default function PatientImaging({ patientId, patientUhid }: PatientImagingProps) {
  const { activeCentreId } = useAuthStore();
  const { studies, loading, stats, byModality } = usePatientImaging(patientId);
  const pacs = usePACSConfig(activeCentreId);
  const [expandedStudy, setExpandedStudy] = useState<PatientStudy | null>(null);
  const [filterMod, setFilterMod] = useState<string>('all');
  const [viewMode, setViewMode] = useState<'timeline' | 'modality'>('timeline');

  if (loading) return (
    <div className="space-y-3 animate-pulse">
      <div className="h-8 bg-gray-200 rounded w-40" />
      {Array.from({ length: 3 }).map((_, i) => <div key={i} className="h-24 bg-gray-200 rounded-xl" />)}
    </div>
  );

  const filtered = filterMod === 'all' ? studies : studies.filter(s => s.modality === filterMod);

  return (
    <div className="space-y-4">
      {expandedStudy && <StudyDetail study={expandedStudy} pacsConfig={pacs.config} onClose={() => setExpandedStudy(null)} />}

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-bold text-gray-900">Imaging History</h3>
          <p className="text-[10px] text-gray-500">{stats.total} studies | {stats.withImages} with images | {stats.withReports} reported</p>
        </div>
        <div className="flex items-center gap-2">
          {/* View all images in Stradus */}
          {patientUhid && pacs.config && pacs.getPatientViewerUrl(patientUhid) && (
            <a href={pacs.getPatientViewerUrl(patientUhid)!} target="_blank" rel="noopener noreferrer"
              className="px-3 py-1.5 bg-blue-600 text-white text-xs rounded-lg flex items-center gap-1.5">
              <svg className="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M15 3h6v6M9 21H3v-6M21 3l-7 7M3 21l7-7"/></svg>
              All Images in Stradus
            </a>
          )}
          <button onClick={() => setViewMode(viewMode === 'timeline' ? 'modality' : 'timeline')}
            className="px-2 py-1 text-xs border rounded">{viewMode === 'timeline' ? 'By Modality' : 'Timeline'}</button>
        </div>
      </div>

      {/* Quick stats */}
      {stats.total > 0 && <div className="flex gap-2">
        <div className="bg-blue-50 rounded-lg px-3 py-1.5 text-center"><div className="text-lg font-bold text-blue-700">{stats.total}</div><div className="text-[9px] text-gray-500">Total</div></div>
        <div className="bg-green-50 rounded-lg px-3 py-1.5 text-center"><div className="text-lg font-bold text-green-700">{stats.withReports}</div><div className="text-[9px] text-gray-500">Reported</div></div>
        {stats.pending > 0 && <div className="bg-amber-50 rounded-lg px-3 py-1.5 text-center"><div className="text-lg font-bold text-amber-700">{stats.pending}</div><div className="text-[9px] text-gray-500">Pending</div></div>}
        {stats.critical > 0 && <div className="bg-red-50 rounded-lg px-3 py-1.5 text-center"><div className="text-lg font-bold text-red-700">{stats.critical}</div><div className="text-[9px] text-gray-500">Critical</div></div>}
      </div>}

      {/* Modality filter */}
      {studies.length > 0 && <div className="flex gap-1 flex-wrap">
        <button onClick={() => setFilterMod('all')}
          className={`px-2 py-1 rounded text-[10px] border ${filterMod === 'all' ? 'bg-blue-600 text-white' : 'bg-white'}`}>All ({stats.total})</button>
        {Array.from(byModality.entries()).map(([mod, arr]) => (
          <button key={mod} onClick={() => setFilterMod(mod)}
            className={`px-2 py-1 rounded text-[10px] border ${filterMod === mod ? 'bg-blue-600 text-white' : MOD_COLORS[mod] || 'bg-white'}`}>
            {MOD_ICONS[mod] || ''} {mod} ({arr.length})
          </button>
        ))}
      </div>}

      {/* Studies list */}
      {studies.length === 0 ? (
        <div className="bg-gray-50 rounded-xl p-8 text-center text-gray-400 text-sm">No imaging studies found for this patient</div>
      ) : viewMode === 'timeline' ? (
        <div className="space-y-2">
          {filtered.map(s => <StudyCard key={s.orderId} study={s} pacsConfig={pacs.config} onExpand={() => setExpandedStudy(s)} />)}
        </div>
      ) : (
        <div className="space-y-4">
          {Array.from(byModality.entries())
            .filter(([mod]) => filterMod === 'all' || mod === filterMod)
            .map(([mod, arr]) => (
              <div key={mod}>
                <h4 className="text-xs font-bold text-gray-500 mb-2 flex items-center gap-1">
                  <span>{MOD_ICONS[mod]}</span> <span>{mod}</span> <span className="text-gray-400 font-normal">({arr.length})</span>
                </h4>
                <div className="space-y-2">
                  {arr.map(s => <StudyCard key={s.orderId} study={s} pacsConfig={pacs.config} onExpand={() => setExpandedStudy(s)} />)}
                </div>
              </div>
            ))}
        </div>
      )}
    </div>
  );
}

// ============================================================
// COMPACT VERSION — for embedding in patient sidebar or IPD summary
// ============================================================
export function PatientImagingCompact({ patientId, patientUhid }: PatientImagingProps) {
  const { activeCentreId } = useAuthStore();
  const { studies, stats } = usePatientImaging(patientId);
  const pacs = usePACSConfig(activeCentreId);

  if (studies.length === 0) return null;

  return (
    <div className="bg-white rounded-xl border p-3">
      <div className="flex items-center justify-between mb-2">
        <h4 className="text-xs font-bold text-gray-700">Imaging ({stats.total})</h4>
        {patientUhid && pacs.config && pacs.getPatientViewerUrl(patientUhid) && (
          <a href={pacs.getPatientViewerUrl(patientUhid)!} target="_blank" rel="noopener noreferrer"
            className="text-[10px] text-blue-600 hover:underline">All in PACS →</a>
        )}
      </div>
      <div className="space-y-1">
        {studies.slice(0, 5).map(s => {
          const stradusUrl = s.stradusUrl || (pacs.config?.viewer_url && s.pacsStudyUid ? `${pacs.config.viewer_url}?StudyInstanceUID=${s.pacsStudyUid}` : null);
          return (
            <div key={s.orderId} className="flex items-center justify-between text-xs py-1 border-b border-gray-50 last:border-0">
              <div className="flex items-center gap-1.5">
                <span className={`px-1 py-0.5 rounded text-[8px] ${MOD_COLORS[s.modality] || 'bg-gray-100'}`}>{s.modality}</span>
                <span className="text-gray-700">{s.testName}</span>
                <span className="text-[9px] text-gray-400">{new Date(s.date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })}</span>
              </div>
              <div className="flex items-center gap-1">
                {s.hasReport && <span className="text-[8px] bg-green-100 text-green-700 px-1 rounded">R</span>}
                {s.isCritical && <span className="text-[8px] bg-red-100 text-red-700 px-1 rounded">!</span>}
                {stradusUrl ? (
                  <a href={stradusUrl} target="_blank" rel="noopener noreferrer"
                    className="text-[9px] text-blue-600 hover:underline">View</a>
                ) : (
                  <span className="text-[9px] text-gray-300">—</span>
                )}
              </div>
            </div>
          );
        })}
        {studies.length > 5 && <div className="text-[10px] text-gray-400 text-center">+ {studies.length - 5} more</div>}
      </div>
    </div>
  );
}
