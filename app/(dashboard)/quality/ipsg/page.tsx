// @ts-nocheck
'use client';
import { useEffect, useState } from 'react';
const GOALS = [
  { code: 'IPSG1', name: 'Identify Patients Correctly', desc: 'Use 2 identifiers, wristband compliance' },
  { code: 'IPSG2', name: 'Improve Effective Communication', desc: 'Read-back, SBAR, critical value reporting' },
  { code: 'IPSG3', name: 'Improve Safety of High-Alert Medications', desc: 'LASA storage, concentrated electrolytes' },
  { code: 'IPSG4', name: 'Ensure Correct-Site Surgery', desc: 'WHO checklist, site marking, time-out' },
  { code: 'IPSG5', name: 'Reduce Risk of HAI', desc: 'Hand hygiene, bundle compliance' },
  { code: 'IPSG6', name: 'Reduce Risk of Patient Harm from Falls', desc: 'Fall risk assessment, interventions' },
];
export default function IPSGPage() {
  const [data, setData] = useState<any[]>([]);
  const centreId = 'c0000001-0000-0000-0000-000000000001';
  useEffect(() => { fetch(`/api/quality/ipsg?centre_id=${centreId}`).then(r => r.json()).then(setData); }, []);
  const latest = (goal: string) => data.find(d => d.goal === goal);
  return (
    <div className="p-6 space-y-6">
      <h1 className="text-2xl font-bold">International Patient Safety Goals</h1>
      <p className="text-sm text-gray-500">6 WHO Patient Safety Goals — NABH PSQ.4</p>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {GOALS.map(g => {
          const d = latest(g.code);
          return (
            <div key={g.code} className="border rounded-lg p-4">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold px-2 py-0.5 rounded bg-blue-100 text-blue-800">{g.code}</span>
                {d && <span className={`text-lg font-bold ${(d.compliance_pct || 0) >= 95 ? 'text-green-600' : 'text-red-600'}`}>{d.compliance_pct}%</span>}
              </div>
              <h3 className="font-semibold mt-2">{g.name}</h3>
              <p className="text-xs text-gray-500 mt-1">{g.desc}</p>
              {d && <div className="text-xs text-gray-400 mt-2">{d.numerator}/{d.denominator} • Target: {d.target_pct}%</div>}
            </div>
          );
        })}
      </div>
    </div>
  );
}
