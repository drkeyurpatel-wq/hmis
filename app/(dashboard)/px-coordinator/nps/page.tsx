'use client';
import { useEffect, useState } from 'react';

export default function NPSDashboard() {
  const [monthly, setMonthly] = useState<any[]>([]);
  const [depts, setDepts] = useState<any[]>([]);
  const [recent, setRecent] = useState<any[]>([]);
  const centreId = 'c0000001-0000-0000-0000-000000000001';

  useEffect(() => {
    Promise.all([
      fetch(`/api/px/nps?centre_id=${centreId}&view=dashboard`).then(r => r.json()),
      fetch(`/api/px/nps?centre_id=${centreId}&view=department`).then(r => r.json()),
      fetch(`/api/px/nps?centre_id=${centreId}&view=recent`).then(r => r.json()),
    ]).then(([m, d, r]) => { setMonthly(m); setDepts(d); setRecent(r); });
  }, []);

  const catColors: Record<string, string> = { PROMOTER: 'bg-green-100 text-green-800', PASSIVE: 'bg-yellow-100 text-yellow-800', DETRACTOR: 'bg-red-100 text-red-800' };

  return (
    <div className="p-6 space-y-6">
      <h1 className="text-2xl font-bold">Net Promoter Score Dashboard</h1>
      <p className="text-sm text-gray-500">NPS = % Promoters (9-10) minus % Detractors (0-6). World-class: 70+. Good: 50+. Needs work: below 0.</p>

      {monthly.length > 0 && (
        <div className="border rounded-lg p-4">
          <h3 className="font-semibold mb-3">Monthly NPS Trend</h3>
          <div className="grid grid-cols-6 gap-2 text-center text-sm">
            {monthly.slice(0, 6).reverse().map((m: any) => (
              <div key={m.period} className="border rounded p-2">
                <div className="text-xs text-gray-500">{m.period}</div>
                <div className={`text-2xl font-bold ${m.nps_score >= 50 ? 'text-green-600' : m.nps_score >= 0 ? 'text-yellow-600' : 'text-red-600'}`}>{m.nps_score}</div>
                <div className="text-xs">{m.total_responses} resp</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {monthly.length > 0 && monthly[0] && (
        <div className="border rounded-lg p-4">
          <h3 className="font-semibold mb-3">Dimension Scores (Latest Month — avg out of 5)</h3>
          <div className="grid grid-cols-4 gap-3 text-sm">
            {[
              { label: 'Clinical Care', val: monthly[0].avg_clinical },
              { label: 'Nursing', val: monthly[0].avg_nursing },
              { label: 'Food', val: monthly[0].avg_food },
              { label: 'Cleanliness', val: monthly[0].avg_cleanliness },
              { label: 'Communication', val: monthly[0].avg_communication },
              { label: 'Billing', val: monthly[0].avg_billing },
              { label: 'Overall', val: monthly[0].avg_overall },
            ].map(d => (
              <div key={d.label} className="text-center border rounded p-2">
                <div className={`text-xl font-bold ${(d.val || 0) >= 4 ? 'text-green-600' : (d.val || 0) >= 3 ? 'text-yellow-600' : 'text-red-600'}`}>{d.val || '-'}</div>
                <div className="text-xs text-gray-500">{d.label}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {depts.length > 0 && (
        <div className="border rounded-lg p-4">
          <h3 className="font-semibold mb-3">NPS by Department</h3>
          <div className="space-y-2">
            {depts.map((d: any) => (
              <div key={d.department} className="flex items-center justify-between text-sm">
                <span className="font-medium">{d.department}</span>
                <div className="flex items-center gap-3">
                  <span className="text-xs text-gray-500">{d.total} responses</span>
                  <span className={`text-lg font-bold ${d.nps_val >= 50 ? 'text-green-600' : d.nps_val >= 0 ? 'text-yellow-600' : 'text-red-600'}`}>{d.nps_val}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="border rounded-lg">
        <div className="bg-gray-50 dark:bg-gray-800 px-4 py-2 font-semibold text-sm">Recent Responses ({recent.length})</div>
        <div className="divide-y">{recent.length === 0 ? <div className="p-4 text-sm text-gray-500">No NPS responses yet</div> :
          recent.slice(0, 15).map((r: any) => (
            <div key={r.id} className="px-4 py-2 flex items-center justify-between">
              <div>
                <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${catColors[r.nps_category]}`}>{r.nps_category}</span>
                <span className="text-sm ml-2">{r.department || 'N/A'}</span>
                {r.what_can_improve && <p className="text-xs text-gray-500 mt-0.5 italic">"{r.what_can_improve.slice(0, 80)}"</p>}
              </div>
              <div className="text-right">
                <div className="text-xl font-bold">{r.nps_score}</div>
                <div className="text-xs text-gray-500">{new Date(r.created_at).toLocaleDateString()}</div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
