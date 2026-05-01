'use client';
import { useEffect, useState } from 'react';

export default function DischargeSurveys() {
  const [surveys, setSurveys] = useState<any[]>([]);
  const centreId = 'c0000001-0000-0000-0000-000000000001';
  useEffect(() => { fetch(`/api/px/discharge-survey?centre_id=${centreId}`).then(r => r.json()).then(setSurveys); }, []);

  const yesNo = (val: boolean | null) => val === true ? '✅' : val === false ? '❌' : '—';

  const metrics = surveys.length > 0 ? {
    total: surveys.length,
    diagnosisInformed: surveys.filter(s => s.informed_about_diagnosis).length,
    medsInformed: surveys.filter(s => s.informed_about_medications).length,
    summaryGiven: surveys.filter(s => s.discharge_summary_given).length,
    billingExplained: surveys.filter(s => s.billing_explained).length,
    wouldReturn: surveys.filter(s => s.would_return).length,
  } : null;

  return (
    <div className="p-6 space-y-6">
      <h1 className="text-2xl font-bold">Discharge Surveys</h1>
      <p className="text-sm text-gray-500">Structured exit feedback — NABH PRE.5 compliance</p>

      {metrics && (
        <div className="grid grid-cols-5 gap-3">
          {[
            { label: 'Diagnosis Explained', pct: Math.round(metrics.diagnosisInformed / metrics.total * 100) },
            { label: 'Meds Explained', pct: Math.round(metrics.medsInformed / metrics.total * 100) },
            { label: 'Summary Given', pct: Math.round(metrics.summaryGiven / metrics.total * 100) },
            { label: 'Billing Explained', pct: Math.round(metrics.billingExplained / metrics.total * 100) },
            { label: 'Would Return', pct: Math.round(metrics.wouldReturn / metrics.total * 100) },
          ].map(m => (
            <div key={m.label} className="border rounded-lg p-3 text-center">
              <div className={`text-2xl font-bold ${m.pct >= 80 ? 'text-green-600' : 'text-red-600'}`}>{m.pct}%</div>
              <div className="text-xs text-gray-500">{m.label}</div>
            </div>
          ))}
        </div>
      )}

      <div className="border rounded-lg divide-y">
        {surveys.length === 0 && <div className="p-8 text-center text-gray-500">No discharge surveys collected yet</div>}
        {surveys.map(s => (
          <div key={s.id} className="p-3">
            <div className="flex items-center justify-between">
              <div className="text-sm">{s.department || 'N/A'} • {new Date(s.discharge_date).toLocaleDateString()}</div>
              <div className="flex gap-1 text-xs">
                <span title="Diagnosis">{yesNo(s.informed_about_diagnosis)}</span>
                <span title="Meds">{yesNo(s.informed_about_medications)}</span>
                <span title="Follow-up">{yesNo(s.informed_about_follow_up)}</span>
                <span title="Summary">{yesNo(s.discharge_summary_given)}</span>
              </div>
            </div>
            {s.suggestions && <p className="text-xs text-gray-500 mt-1 italic">"{s.suggestions.slice(0, 100)}"</p>}
            {s.nps?.nps_score !== undefined && <span className={`text-xs px-1.5 py-0.5 rounded mt-1 inline-block ${s.nps.nps_category === 'PROMOTER' ? 'bg-green-100 text-green-800' : s.nps.nps_category === 'DETRACTOR' ? 'bg-red-100 text-red-800' : 'bg-yellow-100'}`}>NPS: {s.nps.nps_score}</span>}
          </div>
        ))}
      </div>
    </div>
  );
}
