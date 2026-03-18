// components/radiology/report-viewer.tsx
// View full radiology report with addendums, critical alerts, print
'use client';
import React, { useRef } from 'react';
import { useRadiologyReport } from '@/lib/radiology/radiology-hooks';

interface Props {
  order: any;
  staffId: string;
  pacsConfig?: any;
  onFlash: (msg: string) => void;
  onClose: () => void;
}

export default function ReportViewer({ order, staffId, pacsConfig, onFlash, onClose }: Props) {
  const { reports, latestReport, addendums, loading, verify, markCritical } = useRadiologyReport(order.id);
  const printRef = useRef<HTMLDivElement>(null);
  const [critNotifyTo, setCritNotifyTo] = React.useState('');
  const [showCritForm, setShowCritForm] = React.useState(false);
  const [error, setError] = React.useState('');

  const stradusUrl = order.stradus_viewer_url ||
    (pacsConfig?.viewer_url && order.pacs_study_uid ? `${pacsConfig.viewer_url}?StudyInstanceUID=${order.pacs_study_uid}` : null);

  const handlePrint = () => {
    if (!printRef.current) return;
    const w = window.open('', '_blank');
    if (!w) return;
    w.document.write(`<html><head><title>Radiology Report — ${order.accession_number}</title><style>body{font-family:Arial;padding:20px;font-size:12px}h1{font-size:16px}h2{font-size:14px;color:#333;margin-top:16px}.section{background:#f9f9f9;padding:12px;margin:8px 0;border-radius:4px}.impression{background:#eef2ff;padding:12px;border:2px solid #6366f1;border-radius:4px;font-weight:600}.critical{background:#fef2f2;border-color:#dc2626}.meta{color:#888;font-size:10px}</style></head><body>${printRef.current.innerHTML}</body></html>`);
    w.document.close();
    w.print();
  };

  const patientName = `${order.patient?.first_name || ''} ${order.patient?.last_name || ''}`;

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex justify-end">
      <div className="w-[750px] h-full bg-white shadow-2xl overflow-y-auto">
        <div className="sticky top-0 bg-white border-b px-6 py-4 z-10 flex items-center justify-between">
          <div>
            <h2 className="text-lg font-bold">{order.test?.test_name}</h2>
            <div className="text-xs text-gray-500">{patientName} ({order.patient?.uhid}) | ACC: {order.accession_number}</div>
          </div>
          <div className="flex items-center gap-2">
            {stradusUrl && <a href={stradusUrl} target="_blank" rel="noopener noreferrer" className="px-3 py-1.5 bg-blue-600 text-white text-xs rounded-lg">View Images</a>}
            {latestReport && <button onClick={handlePrint} className="px-3 py-1.5 bg-gray-100 text-xs rounded-lg">Print</button>}
            <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-lg px-2">✕</button>
          </div>
        </div>

        <div ref={printRef} className="px-6 py-4 space-y-4">
          {/* Patient & study info */}
          <div className="grid grid-cols-4 gap-2 bg-gray-50 rounded-xl p-3 text-xs">
            <div><span className="text-gray-500 block">Patient</span><span className="font-semibold">{patientName}</span></div>
            <div><span className="text-gray-500 block">UHID</span><span className="font-semibold">{order.patient?.uhid}</span></div>
            <div><span className="text-gray-500 block">Age/Sex</span><span className="font-semibold">{order.patient?.age_years}y {order.patient?.gender}</span></div>
            <div><span className="text-gray-500 block">Referring Dr</span><span className="font-semibold">{order.ordered_by_doc?.full_name || '—'}</span></div>
            <div><span className="text-gray-500 block">Test</span><span className="font-semibold">{order.test?.test_name}</span></div>
            <div><span className="text-gray-500 block">Modality</span><span className="font-semibold">{order.modality}</span></div>
            <div><span className="text-gray-500 block">Date</span><span className="font-semibold">{new Date(order.created_at).toLocaleDateString('en-IN')}</span></div>
            <div><span className="text-gray-500 block">Accession</span><span className="font-mono font-semibold">{order.accession_number}</span></div>
          </div>

          {loading ? <div className="py-8 text-center text-gray-400 animate-pulse">Loading report...</div> :
          !latestReport ? (
            <div className="bg-amber-50 rounded-xl p-6 text-center border border-amber-200">
              <div className="text-amber-700 font-medium text-lg mb-1">Report Pending</div>
              <div className="text-xs text-amber-600 mb-3">The report will appear here automatically once the radiologist finalizes it in Stradus RIS.</div>
              <div className="text-[10px] text-gray-400">Stradus sends reports to HMIS via webhook at: <span className="font-mono">/api/radiology/stradus-webhook</span></div>
            </div>
          ) : (
            <>
              {/* Report header */}
              <div className="flex items-center justify-between">
                <h3 className="font-bold text-sm">Radiology Report</h3>
                <div className="flex items-center gap-2">
                  {latestReport.is_critical && <span className="bg-red-600 text-white px-2 py-0.5 rounded text-[10px] animate-pulse">CRITICAL FINDING</span>}
                  <span className={`px-2 py-0.5 rounded text-[10px] ${latestReport.status === 'verified' ? 'bg-green-100 text-green-700' : latestReport.status === 'finalized' ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-600'}`}>{latestReport.status}</span>
                </div>
              </div>

              {latestReport.technique && <div className="section bg-gray-50 rounded-lg p-3"><div className="text-[10px] text-gray-500 font-medium mb-1">TECHNIQUE</div><div className="text-xs">{latestReport.technique}</div></div>}
              {latestReport.clinical_history && <div className="section bg-gray-50 rounded-lg p-3"><div className="text-[10px] text-gray-500 font-medium mb-1">CLINICAL HISTORY</div><div className="text-xs">{latestReport.clinical_history}</div></div>}
              {latestReport.comparison && <div className="section bg-gray-50 rounded-lg p-3"><div className="text-[10px] text-gray-500 font-medium mb-1">COMPARISON</div><div className="text-xs">{latestReport.comparison}</div></div>}

              <div className="bg-white rounded-lg p-4 border">
                <div className="text-[10px] text-gray-500 font-medium mb-1">FINDINGS</div>
                <div className="text-sm whitespace-pre-wrap leading-relaxed">{latestReport.findings}</div>
              </div>

              <div className={`rounded-lg p-4 border-2 ${latestReport.is_critical ? 'bg-red-50 border-red-300' : 'bg-blue-50 border-blue-200'}`}>
                <div className={`text-[10px] font-medium mb-1 ${latestReport.is_critical ? 'text-red-600' : 'text-blue-600'}`}>IMPRESSION</div>
                <div className={`text-sm font-medium whitespace-pre-wrap leading-relaxed ${latestReport.is_critical ? 'text-red-800' : 'text-blue-800'}`}>{latestReport.impression}</div>
              </div>

              {/* Metadata */}
              <div className="flex items-center justify-between text-[10px] text-gray-400 bg-gray-50 rounded-lg px-4 py-2">
                <div>Reported: <span className="text-gray-600 font-medium">{latestReport.reporter?.full_name || 'Stradus RIS'}</span></div>
                {latestReport.verifier && <div>Verified: <span className="text-gray-600 font-medium">{latestReport.verifier.full_name}</span></div>}
                <div>{new Date(latestReport.created_at).toLocaleString('en-IN')}</div>
              </div>

              {/* Addendums */}
              {addendums.length > 0 && <div className="space-y-2">
                <h4 className="text-xs font-bold text-amber-700">Addendums ({addendums.length})</h4>
                {addendums.map((a: any) => (
                  <div key={a.id} className="bg-amber-50 border border-amber-200 rounded-lg p-3">
                    <div className="text-[10px] text-amber-600 mb-1">Addendum — {new Date(a.created_at).toLocaleString('en-IN')} — {a.reporter?.full_name}</div>
                    <div className="text-xs whitespace-pre-wrap">{a.findings}</div>
                    {a.impression && <div className="text-xs font-medium mt-1">{a.impression}</div>}
                  </div>
                ))}
              </div>}
            </>
          )}
        </div>

        {/* Actions */}
        {latestReport && <div className="sticky bottom-0 bg-white border-t px-6 py-3 flex gap-2">
          {latestReport.status === 'finalized' && latestReport.reported_by !== staffId && (
            <button onClick={async () => {
              const r = await verify(staffId);
              if (!r.success) { setError(r.error || ''); return; }
              onFlash('Report verified');
            }} className="px-4 py-2 bg-green-600 text-white text-sm rounded-lg">Verify Report</button>
          )}
          {!latestReport.is_critical && (
            <button onClick={() => setShowCritForm(!showCritForm)} className="px-4 py-2 bg-red-100 text-red-700 text-sm rounded-lg">Mark Critical</button>
          )}
          {latestReport.is_critical && !latestReport.critical_notified && showCritForm && (
            <div className="flex gap-2 items-center">
              <input type="text" value={critNotifyTo} onChange={e => setCritNotifyTo(e.target.value)} className="px-3 py-2 border rounded-lg text-sm" placeholder="Notified to (doctor name)" />
              <button onClick={async () => {
                if (!critNotifyTo.trim()) return;
                const r = await markCritical(critNotifyTo);
                if (!r.success) { setError(r.error || ''); return; }
                onFlash('Critical notification recorded'); setShowCritForm(false);
              }} className="px-3 py-2 bg-red-600 text-white text-sm rounded-lg">Confirm Notification</button>
            </div>
          )}
          {error && <span className="text-xs text-red-600 self-center">{error}</span>}
        </div>}
      </div>
    </div>
  );
}
