// components/radiology/patient-imaging-panel.tsx
// ============================================================
// EMBED THIS ANYWHERE: patient file, EMR, IPD, OPD
//
// Usage:
//   <PatientImagingPanel patientId={patient.id} />
//   <PatientImagingPanel patientId={patient.id} compact />
//   <PatientImagingPanel patientId={patient.id} admissionId={admission.id} />
// ============================================================
'use client';
import React, { useState, useMemo } from 'react';
import { usePatientImaging, useLinkStudy, type ImagingStudy } from '@/lib/radiology/radiology-hooks';
import { useAuthStore } from '@/lib/store/auth';

const MODALITY_COLORS: Record<string, string> = {
  XR: 'bg-blue-100 text-blue-700', CT: 'bg-purple-100 text-purple-700', MRI: 'bg-indigo-100 text-indigo-700',
  USG: 'bg-green-100 text-green-700', ECHO: 'bg-red-100 text-red-700', DEXA: 'bg-teal-100 text-teal-700',
  MAMMO: 'bg-pink-100 text-pink-700', FLUORO: 'bg-amber-100 text-amber-700',
};

const STATUS_BADGE: Record<string, string> = {
  ordered: 'bg-gray-100 text-gray-600',
  acquired: 'bg-amber-100 text-amber-700',
  reported: 'bg-blue-100 text-blue-700',
  verified: 'bg-green-100 text-green-700',
  amended: 'bg-orange-100 text-orange-700',
};

function ReportViewer({ study, onClose }: { study: ImagingStudy; onClose: () => void }) {
  const report = study.report;
  if (!report) return null;

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white rounded-xl max-w-3xl w-full max-h-[90vh] overflow-y-auto p-6" onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div className="flex items-start justify-between mb-4">
          <div>
            <h2 className="text-lg font-bold">{study.studyDescription}</h2>
            <div className="text-sm text-gray-500">
              <span className={`px-1.5 py-0.5 rounded text-[10px] mr-2 ${MODALITY_COLORS[study.modality] || ''}`}>{study.modality}</span>
              {study.studyDate} | Accession: {study.accessionNumber}
            </div>
          </div>
          <div className="flex items-center gap-2">
            {study.stradusStudyUrl && (
              <a href={study.stradusStudyUrl} target="_blank" rel="noopener noreferrer"
                className="px-3 py-1.5 bg-green-600 text-white text-xs rounded-lg">
                Open in Stradus
              </a>
            )}
            <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-xl px-2">×</button>
          </div>
        </div>

        {report.isCritical && (
          <div className="bg-red-50 border-2 border-red-300 rounded-lg px-4 py-3 mb-4">
            <div className="font-bold text-red-700 text-sm">CRITICAL FINDING</div>
            {report.criticalValue && <div className="text-sm text-red-600">{report.criticalValue}</div>}
          </div>
        )}

        {/* Report content */}
        <div className="space-y-4 text-sm">
          {report.technique && (
            <div><div className="text-xs font-semibold text-gray-500 uppercase mb-1">Technique</div>
              <div className="text-gray-700">{report.technique}</div></div>
          )}
          {report.clinicalHistory && (
            <div><div className="text-xs font-semibold text-gray-500 uppercase mb-1">Clinical History</div>
              <div className="text-gray-700">{report.clinicalHistory}</div></div>
          )}
          {report.comparison && (
            <div><div className="text-xs font-semibold text-gray-500 uppercase mb-1">Comparison</div>
              <div className="text-gray-700">{report.comparison}</div></div>
          )}
          <div className="border-t pt-3">
            <div className="text-xs font-semibold text-gray-500 uppercase mb-1">Findings</div>
            <div className="text-gray-900 whitespace-pre-wrap leading-relaxed">{report.findings}</div>
          </div>
          <div className="bg-blue-50 rounded-lg p-4 border border-blue-200">
            <div className="text-xs font-semibold text-blue-700 uppercase mb-1">Impression</div>
            <div className="text-blue-900 font-medium whitespace-pre-wrap">{report.impression}</div>
          </div>
        </div>

        {/* Authorship */}
        <div className="mt-4 pt-3 border-t text-xs text-gray-500 flex justify-between">
          <div>
            <span className="font-medium">Reported by:</span> {report.reportedBy || 'Unknown'}
            {report.reportedAt && <span className="ml-2">{new Date(report.reportedAt).toLocaleString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}</span>}
          </div>
          {report.verifiedBy && (
            <div>
              <span className="font-medium">Verified by:</span> {report.verifiedBy}
              {report.verifiedAt && <span className="ml-2">{new Date(report.verifiedAt).toLocaleString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}</span>}
            </div>
          )}
          <div><span className="font-medium">Source:</span> {report.source}</div>
        </div>
        {report.tatMinutes && (
          <div className="text-xs text-gray-400 mt-1">TAT: {report.tatMinutes >= 60 ? `${Math.floor(report.tatMinutes / 60)}h ${report.tatMinutes % 60}m` : `${report.tatMinutes}m`}</div>
        )}
      </div>
    </div>
  );
}

function LinkStudyForm({ patientId, centreId, onSuccess, onCancel }: {
  patientId: string; centreId: string; onSuccess: () => void; onCancel: () => void;
}) {
  const linker = useLinkStudy();
  const [form, setForm] = useState({
    modality: 'CT', studyDescription: '', studyDate: new Date().toISOString().split('T')[0],
    stradusUrl: '', accessionNumber: '',
  });
  const [error, setError] = useState('');

  const submit = async () => {
    setError('');
    if (!form.stradusUrl.trim()) { setError('Stradus URL is required'); return; }
    if (!form.studyDescription.trim()) { setError('Study description is required'); return; }
    if (!form.accessionNumber.trim()) {
      // Auto-generate accession
      const dateStr = new Date().toISOString().slice(2, 10).replace(/-/g, '');
      const seq = Math.floor(Math.random() * 9999).toString().padStart(4, '0');
      form.accessionNumber = `MAN-${dateStr}-${seq}`;
    }

    const result = await linker.link({
      centreId, patientId,
      accessionNumber: form.accessionNumber,
      modality: form.modality,
      studyDescription: form.studyDescription,
      studyDate: form.studyDate,
      stradusUrl: form.stradusUrl,
    });

    if (!result.success) { setError(result.error || 'Failed'); return; }
    onSuccess();
  };

  return (
    <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 space-y-3">
      <h4 className="text-sm font-bold text-blue-700">Link Stradus Study to Patient</h4>
      <div className="grid grid-cols-3 gap-3">
        <div><label className="text-[10px] text-gray-500">Stradus URL *</label>
          <input type="url" value={form.stradusUrl} onChange={e => setForm(f => ({ ...f, stradusUrl: e.target.value }))}
            className="w-full px-2 py-1.5 border rounded text-xs" placeholder="https://pacs.hospital.example.com/viewer?StudyInstanceUID=..." /></div>
        <div><label className="text-[10px] text-gray-500">Study Description *</label>
          <input type="text" value={form.studyDescription} onChange={e => setForm(f => ({ ...f, studyDescription: e.target.value }))}
            className="w-full px-2 py-1.5 border rounded text-xs" placeholder="MRI Brain, CT Abdomen..." /></div>
        <div><label className="text-[10px] text-gray-500">Modality</label>
          <select value={form.modality} onChange={e => setForm(f => ({ ...f, modality: e.target.value }))} className="w-full px-2 py-1.5 border rounded text-xs">
            {['XR', 'CT', 'MRI', 'USG', 'ECHO', 'DEXA', 'MAMMO', 'FLUORO', 'PET', 'NM'].map(m => <option key={m}>{m}</option>)}
          </select></div>
      </div>
      <div className="grid grid-cols-3 gap-3">
        <div><label className="text-[10px] text-gray-500">Study Date</label>
          <input type="date" value={form.studyDate} onChange={e => setForm(f => ({ ...f, studyDate: e.target.value }))}
            className="w-full px-2 py-1.5 border rounded text-xs" /></div>
        <div><label className="text-[10px] text-gray-500">Accession # (auto if blank)</label>
          <input type="text" value={form.accessionNumber} onChange={e => setForm(f => ({ ...f, accessionNumber: e.target.value }))}
            className="w-full px-2 py-1.5 border rounded text-xs" placeholder="Auto-generated" /></div>
        <div className="flex items-end gap-2">
          <button onClick={submit} disabled={linker.linking} className="px-3 py-1.5 bg-blue-600 text-white text-xs rounded disabled:opacity-40">
            {linker.linking ? 'Linking...' : 'Link Study'}
          </button>
          <button onClick={onCancel} className="px-3 py-1.5 bg-gray-200 text-xs rounded">Cancel</button>
        </div>
      </div>
      {error && <div className="text-xs text-red-700">{error}</div>}
    </div>
  );
}

// ============================================================
// MAIN COMPONENT
// ============================================================
interface Props {
  patientId: string;
  admissionId?: string;
  compact?: boolean;
  showLinkButton?: boolean;
}

export default function PatientImagingPanel({ patientId, admissionId, compact = false, showLinkButton = true }: Props) {
  const { activeCentreId } = useAuthStore();
  const centreId = activeCentreId || '';
  const { studies, loading, load, byModality, stats } = usePatientImaging(patientId);
  const timeline = studies; // studies are already sorted by date desc
  const count = stats.total;
  const [viewingStudy, setViewingStudy] = useState<ImagingStudy | null>(null);
  const [showLink, setShowLink] = useState(false);
  const [viewMode, setViewMode] = useState<'timeline' | 'modality'>('timeline');
  const [modalityFilter, setModalityFilter] = useState<string>('all');

  const filtered = useMemo(() => {
    let s = admissionId ? studies.filter(st => st.admissionId === admissionId) : studies;
    if (modalityFilter !== 'all') s = s.filter(st => st.modality === modalityFilter);
    return s;
  }, [studies, admissionId, modalityFilter]);

  const modalities = useMemo(() => [...new Set(studies.map(s => s.modality))].sort(), [studies]);

  if (loading) return <div className="animate-pulse"><div className="h-6 bg-gray-200 rounded w-32 mb-3" /><div className="space-y-2">{[1, 2, 3].map(i => <div key={i} className="h-12 bg-gray-100 rounded" />)}</div></div>;

  // ---- COMPACT MODE (sidebar, small panels) ----
  if (compact) {
    return (
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <h3 className="text-xs font-bold text-gray-700">Imaging ({count})</h3>
          {showLinkButton && <button onClick={() => setShowLink(true)} className="text-[10px] text-blue-600">+ Link</button>}
        </div>

        {showLink && <LinkStudyForm patientId={patientId} centreId={centreId}
          onSuccess={() => { setShowLink(false); load(); }} onCancel={() => setShowLink(false)} />}

        {filtered.length === 0 ? <div className="text-xs text-gray-400 text-center py-3">No imaging studies</div> :
          filtered.slice(0, 8).map(s => (
            <div key={s.orderId} className="flex items-center gap-2 bg-gray-50 rounded-lg px-2 py-1.5 hover:bg-blue-50 cursor-pointer" onClick={() => s.report ? setViewingStudy(s) : undefined}>
              <span className={`px-1 py-0.5 rounded text-[8px] ${MODALITY_COLORS[s.modality] || 'bg-gray-100'}`}>{s.modality}</span>
              <div className="flex-1 min-w-0">
                <div className="text-xs font-medium truncate">{s.studyDescription}</div>
                <div className="text-[9px] text-gray-400">{s.studyDate}</div>
              </div>
              <div className="flex items-center gap-1">
                {s.report?.isCritical && <span className="w-2 h-2 bg-red-500 rounded-full" title="Critical" />}
                {s.stradusStudyUrl ? (
                  <a href={s.stradusStudyUrl} target="_blank" rel="noopener noreferrer" onClick={e => e.stopPropagation()}
                    className="text-[9px] bg-green-100 text-green-700 px-1.5 py-0.5 rounded hover:bg-green-200">View</a>
                ) : null}
                {s.report && <span className="text-[9px] text-blue-600 cursor-pointer" onClick={e => { e.stopPropagation(); setViewingStudy(s); }}>Report</span>}
              </div>
            </div>
          ))}
        {filtered.length > 8 && <div className="text-[10px] text-gray-400 text-center">+ {filtered.length - 8} more</div>}
        {viewingStudy && <ReportViewer study={viewingStudy} onClose={() => setViewingStudy(null)} />}
      </div>
    );
  }

  // ---- FULL MODE ----
  return (
    <div className="space-y-3">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <h3 className="text-sm font-bold text-gray-700">Imaging Studies ({count})</h3>
          <div className="flex gap-0.5">
            <button onClick={() => setViewMode('timeline')} className={`px-2 py-0.5 rounded text-[10px] ${viewMode === 'timeline' ? 'bg-blue-600 text-white' : 'bg-gray-100'}`}>Timeline</button>
            <button onClick={() => setViewMode('modality')} className={`px-2 py-0.5 rounded text-[10px] ${viewMode === 'modality' ? 'bg-blue-600 text-white' : 'bg-gray-100'}`}>By Modality</button>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {modalities.length > 1 && <div className="flex gap-0.5">
            <button onClick={() => setModalityFilter('all')} className={`px-1.5 py-0.5 rounded text-[9px] ${modalityFilter === 'all' ? 'bg-blue-600 text-white' : 'bg-gray-100'}`}>All</button>
            {modalities.map(m => (
              <button key={m} onClick={() => setModalityFilter(m)} className={`px-1.5 py-0.5 rounded text-[9px] ${modalityFilter === m ? 'bg-blue-600 text-white' : MODALITY_COLORS[m] || 'bg-gray-100'}`}>{m}</button>
            ))}
          </div>}
          {showLinkButton && <button onClick={() => setShowLink(!showLink)} className="px-2 py-1 bg-blue-600 text-white text-[10px] rounded">+ Link Study</button>}
          <button onClick={load} className="px-2 py-1 bg-gray-100 text-[10px] rounded">Refresh</button>
        </div>
      </div>

      {showLink && <LinkStudyForm patientId={patientId} centreId={centreId}
        onSuccess={() => { setShowLink(false); load(); }} onCancel={() => setShowLink(false)} />}

      {/* Studies */}
      {filtered.length === 0 ? <div className="text-center py-6 bg-gray-50 rounded-xl text-gray-400 text-sm">No imaging studies{modalityFilter !== 'all' ? ` for ${modalityFilter}` : ''}</div> :

      viewMode === 'timeline' ? (
        // Timeline view
        <div className="space-y-1.5">
          {filtered.map(s => (
            <div key={s.orderId} className="bg-white rounded-xl border hover:border-blue-300 transition-colors">
              <div className="flex items-center px-4 py-3 gap-3">
                {/* Date column */}
                <div className="w-20 text-center flex-shrink-0">
                  <div className="text-xs font-bold text-gray-700">{new Date(s.studyDate || s.date || '').toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })}</div>
                  <div className="text-[9px] text-gray-400">{new Date(s.studyDate || s.date || '').getFullYear()}</div>
                </div>

                {/* Modality badge */}
                <span className={`px-2 py-1 rounded text-xs font-medium flex-shrink-0 ${MODALITY_COLORS[s.modality] || 'bg-gray-100'}`}>{s.modality}</span>

                {/* Study info */}
                <div className="flex-1 min-w-0">
                  <div className="font-medium text-sm truncate">{s.studyDescription}</div>
                  <div className="text-[10px] text-gray-500">
                    {s.bodyPart && <span className="mr-2">{s.bodyPart}</span>}
                    {s.isContrast && <span className="text-amber-600 mr-2">C+</span>}
                    {s.referringDoctorName && <span>Ref: {s.referringDoctorName}</span>}
                    {(s.seriesCount || 0) > 0 && <span className="ml-2">{s.seriesCount || 0} series • {s.imageCount || 0} images</span>}
                  </div>
                </div>

                {/* Status */}
                <span className={`px-2 py-0.5 rounded text-[9px] flex-shrink-0 ${STATUS_BADGE[s.status] || 'bg-gray-100'}`}>{s.status}</span>

                {/* Critical flag */}
                {s.report?.isCritical && <span className="bg-red-600 text-white px-1.5 py-0.5 rounded text-[9px] font-bold animate-pulse">CRITICAL</span>}

                {/* Actions */}
                <div className="flex items-center gap-1.5 flex-shrink-0">
                  {s.stradusStudyUrl ? (
                    <a href={s.stradusStudyUrl} target="_blank" rel="noopener noreferrer"
                      className="px-2.5 py-1.5 bg-green-600 text-white text-xs rounded-lg hover:bg-green-700 font-medium">
                      View Images
                    </a>
                  ) : s.stradusUrl || s.stradusStudyUrl ? (
                    <a href={s.stradusUrl || s.stradusStudyUrl} target="_blank" rel="noopener noreferrer"
                      className="px-2.5 py-1.5 bg-green-600 text-white text-xs rounded-lg hover:bg-green-700 font-medium">
                      View Images
                    </a>
                  ) : null}
                  {s.report ? (
                    <button onClick={() => setViewingStudy(s)} className="px-2.5 py-1.5 bg-blue-100 text-blue-700 text-xs rounded-lg hover:bg-blue-200 font-medium">Report</button>
                  ) : (
                    <span className="text-[10px] text-gray-400 px-2">No report</span>
                  )}
                </div>
              </div>

              {/* Impression preview (if reported) */}
              {s.report?.impression && (
                <div className="px-4 pb-3 -mt-1">
                  <div className={`text-xs ${s.report.isCritical ? 'text-red-700 bg-red-50' : 'text-gray-600 bg-gray-50'} rounded px-3 py-1.5`}>
                    <span className="font-medium">Impression: </span>{s.report.impression.substring(0, 200)}{s.report.impression.length > 200 ? '...' : ''}
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      ) : (
        // Modality grouped view
        <div className="space-y-4">
          {Array.from(byModality.entries()).filter(([m]) => modalityFilter === 'all' || m === modalityFilter).map(([mod, modStudies]) => (
            <div key={mod}>
              <div className="flex items-center gap-2 mb-2">
                <span className={`px-2 py-0.5 rounded text-xs font-medium ${MODALITY_COLORS[mod] || 'bg-gray-100'}`}>{mod}</span>
                <span className="text-xs text-gray-400">{modStudies.length} studies</span>
              </div>
              <div className="grid grid-cols-2 gap-2">
                {modStudies.map(s => (
                  <div key={s.orderId} className="bg-white rounded-lg border p-3 hover:border-blue-300">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-sm font-medium">{s.studyDescription}</span>
                      <span className="text-[10px] text-gray-400">{s.studyDate}</span>
                    </div>
                    {s.report?.impression && (
                      <div className="text-xs text-gray-600 mb-2 line-clamp-2">{s.report.impression}</div>
                    )}
                    <div className="flex items-center gap-1.5">
                      <span className={`px-1.5 py-0.5 rounded text-[9px] ${STATUS_BADGE[s.status] || ''}`}>{s.status}</span>
                      {s.report?.isCritical && <span className="bg-red-600 text-white px-1 py-0.5 rounded text-[9px]">CRITICAL</span>}
                      <div className="flex-1" />
                      {s.stradusStudyUrl && (
                        <a href={s.stradusStudyUrl} target="_blank" rel="noopener noreferrer" className="text-[10px] bg-green-100 text-green-700 px-2 py-0.5 rounded hover:bg-green-200">View</a>
                      )}
                      {s.report && <button onClick={() => setViewingStudy(s)} className="text-[10px] bg-blue-100 text-blue-700 px-2 py-0.5 rounded">Report</button>}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {viewingStudy && <ReportViewer study={viewingStudy} onClose={() => setViewingStudy(null)} />}
    </div>
  );
}
