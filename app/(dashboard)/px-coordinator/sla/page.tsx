// @ts-nocheck
'use client';
import { useEffect, useState } from 'react';

export default function SLAMonitor() {
  const [breaches, setBreaches] = useState<any[]>([]);
  const [configs, setConfigs] = useState<any[]>([]);
  const centreId = 'c0000001-0000-0000-0000-000000000001';

  useEffect(() => {
    Promise.all([
      fetch(`/api/px/sla?centre_id=${centreId}&status=OPEN`).then(r => r.json()),
      fetch(`/api/px/sla?centre_id=${centreId}&status=RESOLVED`).then(r => r.json()),
    ]).then(([open, resolved]) => { setBreaches([...open, ...resolved]); });
  }, []);

  const openBreaches = breaches.filter(b => b.status === 'OPEN');
  const resolvedBreaches = breaches.filter(b => b.status === 'RESOLVED');

  const resolve = async (id: string, mins: number) => {
    await fetch('/api/px/sla', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id, status: 'RESOLVED', actual_minutes: mins }) });
    setBreaches(prev => prev.map(b => b.id === id ? { ...b, status: 'RESOLVED', actual_minutes: mins } : b));
  };

  return (
    <div className="p-6 space-y-6">
      <h1 className="text-2xl font-bold">SLA Breach Monitor</h1>
      <p className="text-sm text-gray-500">Real-time tracking: Nurse calls, food orders, complaints, housekeeping</p>

      <div className="grid grid-cols-4 gap-4">
        {['NURSE_CALL', 'FOOD_ORDER', 'COMPLAINT', 'HOUSEKEEPING'].map(cat => {
          const catBreaches = openBreaches.filter(b => b.category === cat);
          return (
            <div key={cat} className={`border rounded-lg p-4 ${catBreaches.length > 0 ? 'border-red-400 bg-red-50 dark:bg-red-950' : 'border-green-200 bg-green-50 dark:bg-green-950'}`}>
              <div className="text-2xl font-bold">{catBreaches.length}</div>
              <div className="text-sm font-semibold">{cat.replace(/_/g, ' ')}</div>
              <div className="text-xs text-gray-500">Open breaches</div>
            </div>
          );
        })}
      </div>

      {openBreaches.length > 0 && (
        <div className="border border-red-300 rounded-lg">
          <div className="bg-red-50 dark:bg-red-950 px-4 py-2 font-semibold text-sm text-red-800">🔴 Active Breaches ({openBreaches.length})</div>
          <div className="divide-y">{openBreaches.map(b => {
            const elapsed = Math.round((Date.now() - new Date(b.requested_at).getTime()) / 60000);
            return (
              <div key={b.id} className="px-4 py-3 flex items-center justify-between">
                <div>
                  <span className="text-xs font-bold px-2 py-0.5 rounded bg-red-100 text-red-800">{b.category.replace(/_/g, ' ')}</span>
                  <span className="text-sm ml-2">{b.ward} {b.bed ? `• Bed ${b.bed}` : ''}</span>
                  <div className="text-xs text-gray-500 mt-0.5">Target: {b.target_minutes}min | Elapsed: {elapsed}min | Overdue by {elapsed - b.target_minutes}min</div>
                </div>
                <button onClick={() => resolve(b.id, elapsed)} className="text-xs px-3 py-1 bg-green-600 text-white rounded hover:bg-green-700">Resolve</button>
              </div>
            );
          })}</div>
        </div>
      )}

      <div className="border rounded-lg">
        <div className="bg-gray-50 dark:bg-gray-800 px-4 py-2 font-semibold text-sm">Recently Resolved ({resolvedBreaches.length})</div>
        <div className="divide-y">{resolvedBreaches.length === 0 ? <div className="p-4 text-sm text-gray-500">No resolved breaches</div> :
          resolvedBreaches.slice(0, 20).map(b => (
            <div key={b.id} className="px-4 py-2 flex items-center justify-between text-sm">
              <div>
                <span className="text-xs px-2 py-0.5 rounded bg-gray-100">{b.category.replace(/_/g, ' ')}</span>
                <span className="ml-2">{b.ward}</span>
              </div>
              <div className="text-right">
                <span className={`font-bold ${(b.actual_minutes || 0) <= b.target_minutes ? 'text-green-600' : 'text-red-600'}`}>{b.actual_minutes || '?'}min</span>
                <span className="text-xs text-gray-500 ml-1">/ {b.target_minutes}min</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
