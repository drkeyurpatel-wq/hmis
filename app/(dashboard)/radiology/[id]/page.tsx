// app/(dashboard)/radiology/[id]/page.tsx
'use client';
import React, { useState, useMemo } from 'react';
import { useParams } from 'next/navigation';
import { useStudyDetail, usePatientImaging, useRadiologyTemplates, type ImagingStudy } from '@/lib/radiology/radiology-hooks';
import { useAuthStore } from '@/lib/store/auth';
import { createClient } from '@/lib/supabase/client';
import Link from 'next/link';

let _sb: any = null;
function sb() { if (typeof window === 'undefined') return null as any; if (!_sb) { try { _sb = createClient(); } catch { return null; } } return _sb; }

const MOD_CLR: Record<string, string> = {
  XR: 'bg-blue-100 text-blue-700', CT: 'bg-purple-100 text-purple-700', MRI: 'bg-indigo-100 text-indigo-700',
  USG: 'bg-green-100 text-green-700', ECHO: 'bg-red-100 text-red-700', DEXA: 'bg-teal-100 text-teal-700',
};

export default function StudyDetailPage() {
  const { id } = useParams();
  const studyId = id as string;
  const { staff, activeCentreId } = useAuthStore();
  const staffId = staff?.id || '';
  const { study, loading, load } = useStudyDetail(studyId);
  const [toast, setToast] = useState('');
  const [actionError, setActionError] = useState('');
  const flash = (m: string) => { setToast(m); setTimeout(() => setToast(''), 2500); };

  // Related studies for same patient
  const patientImaging = usePatientImaging(study?.patientId || null);
  const relatedStudies = useMemo(() =>
    patientImaging.studies.filter(s => s.id !== studyId).slice(0, 10)
  , [patientImaging.studies, studyId]);

  // Templates for manual reporting
  const templates = useRadiologyTemplates(study?.modality);

  // Manual report form (fallback when Stradus doesn't send report)
  const [showManualReport, setShowManualReport] = useState(false);
  const [reportForm, setReportForm] = useState({ technique: '', clinical_history: '', comparison: '', findings: '', impression: '', is_critical: false });

  const saveManualReport = async () => {
    if (!study || !sb()) return;
    if (!reportForm.findings.trim() || !reportForm.impression.trim()) { setActionError('Findings and Impression required'); return; }
    setActionError('');

    const { error } = await sb().from('hmis_imaging_reports').insert({
      study_id: study.id, centre_id: study.centreId,
      report_status: 'final', source: 'manual',
      reported_by_id: staffId, reported_by_name: staff?.full_name,
      reported_at: new Date().toISOString(),
      ...reportForm,
    });
    if (error) { setActionError(error.message); return; }

    await sb().from('hmis_imaging_studies').update({ status: 'reported', updated_at: new Date().toISOString() }).eq('id', study.id);
    if (study.orderId) {
      await sb().from('hmis_radiology_orders').update({ status: 'reported', reported_at: new Date().toISOString() }).eq('id', study.orderId);
    }

    flash('Report saved');
    setShowManualReport(false);
    load();
  };

  const verifyReport = async (reportId: string) => {
    if (!sb()) return;
    const { error } = await sb().from('hmis_imaging_reports').update({
      report_status: 'verified', verified_by_id: staffId, verified_by_name: staff?.full_name,
      verified_at: new Date().toISOString(),
    }).eq('id', reportId);
    if (error) { setActionError(error.message); return; }
    await sb().from('hmis_imaging_studies').update({ status: 'verified', updated_at: new Date().toISOString() }).eq('id', study!.id);
    flash('Report verified'); load();
  };

  if (loading || !study) return <div className="max-w-5xl mx-auto animate-pulse space-y-4"><div className="h-8 bg-gray-200 rounded w-1/3" /><div className="h-48 bg-gray-200 rounded-xl" /></div>;

  const report = study.report;
  const allReports = study.reports || [];

  return (
    <div className="max-w-5xl mx-auto space-y-4">
      {toast && <div className="fixed top-4 left-1/2 -translate-x-1/2 z-50 bg-green-600 text-white px-4 py-2 rounded-lg shadow-lg text-sm">{toast}</div>}

      {/* Study Header */}
      <div className="bg-white rounded-xl border p-5">
        <div className="flex items-start justify-between mb-3">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className={`px-2 py-0.5 rounded text-xs font-medium ${MOD_CLR[study.modality] || 'bg-gray-100'}`}>{study.modality}</span>
              <h1 className="text-lg font-bold">{study.studyDescription}</h1>
              {study.isContrast && <span className="text-xs bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded">Contrast</span>}
            </div>
            <div className="text-sm text-gray-600">
              <span className="font-medium">{study.patientName}</span>
              <span className="text-gray-400 ml-2">{study.patientUhid}</span>
              <span className="text-gray-400 mx-2">|</span>{study.patientAge}y {study.patientGender}
            </div>
          </div>
          <div className="flex items-center gap-2">
            {(study.stradusStudyUrl || study.pacsViewerUrl) && (
              <a href={study.stradusStudyUrl || study.pacsViewerUrl || ''} target="_blank" rel="noopener noreferrer"
                className="px-4 py-2 bg-green-600 text-white text-sm rounded-lg font-medium hover:bg-green-700">
                Open in Stradus
              </a>
            )}
            <Link href="/radiology" className="text-xs text-gray-500 hover:text-blue-600">Back</Link>
          </div>
        </div>

        <div className="grid grid-cols-5 gap-3 bg-gray-50 rounded-lg p-3 text-xs">
          <div><span className="text-gray-500 block">Date</span><span className="font-semibold">{study.studyDate}</span></div>
          <div><span className="text-gray-500 block">Accession</span><span className="font-mono font-semibold">{study.accessionNumber}</span></div>
          <div><span className="text-gray-500 block">Referring Dr</span><span className="font-semibold">{study.referringDoctorName || '—'}</span></div>
          <div><span className="text-gray-500 block">Images</span><span className="font-semibold">{study.seriesCount} series / {study.imageCount} images</span></div>
          <div><span className="text-gray-500 block">Status</span><span className={`px-2 py-0.5 rounded text-xs font-medium ${study.status === 'verified' ? 'bg-green-100 text-green-700' : study.status === 'reported' ? 'bg-blue-100 text-blue-700' : 'bg-amber-100 text-amber-700'}`}>{study.status}</span></div>
        </div>

        {/* Stradus URL display */}
        {study.stradusStudyUrl && (
          <div className="mt-3 bg-green-50 rounded-lg px-4 py-2 flex items-center justify-between">
            <div className="text-xs"><span className="font-medium text-green-700">Stradus Link:</span> <span className="font-mono text-green-600">{study.stradusStudyUrl.substring(0, 80)}{study.stradusStudyUrl.length > 80 ? '...' : ''}</span></div>
            <a href={study.stradusStudyUrl} target="_blank" rel="noopener noreferrer" className="text-xs text-green-700 underline">Open →</a>
          </div>
        )}
      </div>

      {/* Report(s) */}
      {allReports.length > 0 ? allReports.map((r, idx) => (
        <div key={r.id} className={`bg-white rounded-xl border p-5 ${r.isCritical ? 'border-red-300 bg-red-50' : ''}`}>
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-bold text-sm">{idx === 0 ? 'Report' : `Report (${r.reportStatus})`}
              <span className={`ml-2 px-2 py-0.5 rounded text-[10px] ${r.reportStatus === 'verified' ? 'bg-green-100 text-green-700' : r.reportStatus === 'final' ? 'bg-blue-100 text-blue-700' : 'bg-amber-100 text-amber-700'}`}>{r.reportStatus}</span>
              <span className="ml-2 px-2 py-0.5 rounded text-[10px] bg-gray-100 text-gray-600">via {r.source}</span>
            </h3>
            <div className="flex gap-2">
              {r.reportStatus === 'final' && !r.verifiedByName && (
                <button onClick={() => verifyReport(r.id)} className="px-3 py-1.5 bg-green-600 text-white text-xs rounded-lg">Verify</button>
              )}
              {r.tatMinutes && <span className="text-xs text-gray-400">TAT: {r.tatMinutes >= 60 ? `${Math.floor(r.tatMinutes / 60)}h ${r.tatMinutes % 60}m` : `${r.tatMinutes}m`}</span>}
            </div>
          </div>

          {r.isCritical && <div className="bg-red-100 border border-red-300 rounded-lg px-4 py-2 mb-3 font-bold text-red-700 text-sm">CRITICAL FINDING{r.criticalValue ? `: ${r.criticalValue}` : ''}</div>}

          <div className="space-y-3 text-sm">
            {r.technique && <div><div className="text-xs font-semibold text-gray-500 uppercase">Technique</div><div>{r.technique}</div></div>}
            {r.clinicalHistory && <div><div className="text-xs font-semibold text-gray-500 uppercase">Clinical History</div><div>{r.clinicalHistory}</div></div>}
            {r.comparison && <div><div className="text-xs font-semibold text-gray-500 uppercase">Comparison</div><div>{r.comparison}</div></div>}
            <div className="border-t pt-3"><div className="text-xs font-semibold text-gray-500 uppercase">Findings</div><div className="whitespace-pre-wrap leading-relaxed">{r.findings}</div></div>
            <div className="bg-blue-50 rounded-lg p-4 border border-blue-200"><div className="text-xs font-semibold text-blue-700 uppercase mb-1">Impression</div><div className="text-blue-900 font-medium whitespace-pre-wrap">{r.impression}</div></div>
          </div>

          <div className="mt-3 pt-2 border-t text-xs text-gray-500 flex justify-between">
            <div>Reported: {r.reportedByName} {r.reportedAt && `(${new Date(r.reportedAt).toLocaleString('en-IN')})`}</div>
            {r.verifiedByName && <div>Verified: {r.verifiedByName} {r.verifiedAt && `(${new Date(r.verifiedAt).toLocaleString('en-IN')})`}</div>}
          </div>
        </div>
      )) : (
        <div className="bg-white rounded-xl border p-5">
          <div className="text-center text-gray-400 text-sm mb-3">No report received from Stradus yet</div>
          {!showManualReport && (
            <div className="text-center">
              <button onClick={() => setShowManualReport(true)} className="px-4 py-2 bg-blue-600 text-white text-sm rounded-lg">Enter Report Manually (Fallback)</button>
            </div>
          )}
        </div>
      )}

      {/* Manual report form */}
      {showManualReport && <div className="bg-white rounded-xl border p-5 space-y-3">
        <div className="flex items-center justify-between"><h3 className="font-bold text-sm">Manual Report Entry</h3>
          {templates.templates.length > 0 && <div className="flex gap-1">{templates.templates.slice(0, 4).map(t => (
            <button key={t.id} onClick={() => setReportForm(f => ({ ...f, technique: t.technique_text || f.technique, findings: t.findings_template, impression: t.impression_template || f.impression }))}
              className="px-2 py-0.5 bg-gray-100 text-[10px] rounded hover:bg-blue-100">{t.template_name}</button>
          ))}</div>}
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div><label className="text-xs text-gray-500">Technique</label><textarea value={reportForm.technique} onChange={e => setReportForm(f => ({...f, technique: e.target.value}))} rows={2} className="w-full px-3 py-2 border rounded-lg text-sm" /></div>
          <div><label className="text-xs text-gray-500">Clinical History</label><textarea value={reportForm.clinical_history} onChange={e => setReportForm(f => ({...f, clinical_history: e.target.value}))} rows={2} className="w-full px-3 py-2 border rounded-lg text-sm" /></div>
        </div>
        <div><label className="text-xs text-gray-500">Findings *</label><textarea value={reportForm.findings} onChange={e => setReportForm(f => ({...f, findings: e.target.value}))} rows={6} className="w-full px-3 py-2 border rounded-lg text-sm" /></div>
        <div><label className="text-xs text-gray-500">Impression *</label><textarea value={reportForm.impression} onChange={e => setReportForm(f => ({...f, impression: e.target.value}))} rows={3} className="w-full px-3 py-2 border rounded-lg text-sm font-medium" /></div>
        <label className="flex items-center gap-2 text-xs text-red-700"><input type="checkbox" checked={reportForm.is_critical} onChange={e => setReportForm(f => ({...f, is_critical: e.target.checked}))} className="rounded" />Critical finding</label>
        {actionError && <div className="text-sm text-red-700">{actionError}</div>}
        <div className="flex gap-2"><button onClick={saveManualReport} disabled={!reportForm.findings.trim() || !reportForm.impression.trim()} className="px-6 py-2 bg-green-600 text-white text-sm rounded-lg disabled:opacity-40">Save Report</button>
          <button onClick={() => setShowManualReport(false)} className="px-4 py-2 bg-gray-200 text-sm rounded-lg">Cancel</button></div>
      </div>}

      {/* Related studies for same patient */}
      {relatedStudies.length > 0 && <div className="bg-white rounded-xl border p-4">
        <h3 className="text-xs font-bold text-gray-500 mb-2">Other Studies for This Patient ({relatedStudies.length})</h3>
        <div className="space-y-1">{relatedStudies.map(s => (
          <Link key={s.id} href={`/radiology/${s.id}`} className="flex items-center gap-2 px-2 py-1.5 rounded hover:bg-blue-50 text-xs">
            <span className={`px-1.5 py-0.5 rounded text-[9px] ${MOD_CLR[s.modality] || 'bg-gray-100'}`}>{s.modality}</span>
            <span className="font-medium flex-1">{s.studyDescription}</span>
            <span className="text-gray-400">{s.studyDate}</span>
            <span className={`px-1.5 py-0.5 rounded text-[9px] ${s.status === 'verified' ? 'bg-green-100 text-green-700' : s.status === 'reported' ? 'bg-blue-100 text-blue-700' : 'bg-gray-100'}`}>{s.status}</span>
            {s.stradusStudyUrl && <a href={s.stradusStudyUrl} target="_blank" rel="noopener noreferrer" onClick={e => e.stopPropagation()} className="text-[9px] bg-green-100 text-green-700 px-1.5 py-0.5 rounded">View</a>}
          </Link>
        ))}</div>
      </div>}
    </div>
  );
}
