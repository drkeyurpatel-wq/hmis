// @ts-nocheck
'use client';
import { useEffect, useState } from 'react';
export default function MedicationSafetyPage() {
  const [reports, setReports] = useState<any[]>([]);
  const [approvals, setApprovals] = useState<any[]>([]);
  const centreId = 'c0000001-0000-0000-0000-000000000001';
  useEffect(() => {
    Promise.all([
      fetch(`/api/quality/medication-safety?centre_id=${centreId}`).then(r => r.json()),
      fetch(`/api/quality/antibiotics/approvals?centre_id=${centreId}`).then(r => r.json()),
    ]).then(([r, a]) => { setReports(r); setApprovals(a); });
  }, []);
  return (
    <div className="p-6 space-y-6">
      <h1 className="text-2xl font-bold">Medication Safety & Antibiotic Stewardship</h1>
      <p className="text-sm text-gray-500">MOM Chapter — MSO (Medication Safety Officer) per MOM.1.a</p>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="border rounded-lg">
          <div className="bg-gray-50 dark:bg-gray-800 px-4 py-2 font-semibold text-sm">Medication Safety Reports ({reports.length})</div>
          <div className="divide-y">{reports.length === 0 ? <div className="p-4 text-sm text-gray-500">No reports</div> : reports.slice(0,10).map((r:any) => (
            <div key={r.id} className="p-3 text-sm"><span className="font-medium">{r.report_type}</span> — {r.medication_name || 'N/A'}<div className="text-xs text-gray-500 mt-0.5">{r.stage} • {new Date(r.report_date).toLocaleDateString()}</div></div>
          ))}</div>
        </div>
        <div className="border rounded-lg">
          <div className="bg-gray-50 dark:bg-gray-800 px-4 py-2 font-semibold text-sm">Antibiotic Approvals ({approvals.length})</div>
          <div className="divide-y">{approvals.length === 0 ? <div className="p-4 text-sm text-gray-500">No pending approvals</div> : approvals.slice(0,10).map((a:any) => (
            <div key={a.id} className="p-3 text-sm"><span className="font-medium">{a.antibiotic_name}</span> — {a.indication?.slice(0,60)}<div className="text-xs text-gray-500 mt-0.5">{a.approval_status} • Dr. {a.requesting_doctor_name || 'N/A'}</div></div>
          ))}</div>
        </div>
      </div>
    </div>
  );
}
