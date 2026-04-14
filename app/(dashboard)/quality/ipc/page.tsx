// @ts-nocheck
'use client';
import { useEffect, useState } from 'react';

export default function IPCDashboard() {
  const [bundles, setBundles] = useState<any[]>([]);
  const [checks, setChecks] = useState<any[]>([]);
  const [surveillance, setSurveillance] = useState<any[]>([]);
  const centreId = 'c0000001-0000-0000-0000-000000000001';

  useEffect(() => {
    Promise.all([
      fetch(`/api/quality/ipc/bundles?centre_id=${centreId}`).then(r => r.json()),
      fetch(`/api/quality/ipc/checks?centre_id=${centreId}`).then(r => r.json()),
      fetch(`/api/quality/ipc/surveillance?centre_id=${centreId}`).then(r => r.json()),
    ]).then(([b, c, s]) => { setBundles(b); setChecks(c); setSurveillance(s); });
  }, []);

  const bundleTypeLabels: Record<string, string> = { CENTRAL_LINE: 'Central Line (CLABSI)', VENTILATOR: 'Ventilator (VAP)', URINARY_CATHETER: 'Urinary Catheter (CAUTI)', SSI_PREVENTION: 'SSI Prevention' };

  return (
    <div className="p-6 space-y-6">
      <h1 className="text-2xl font-bold">Infection Prevention & Control</h1>
      <p className="text-sm text-gray-500">IPC Chapter — NABH 6th Edition (replaced HIC from 5th Edition)</p>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {bundles.map((b: any) => {
          const bundleChecks = checks.filter(c => c.bundle_id === b.id);
          const compliant = bundleChecks.filter(c => c.all_compliant).length;
          const rate = bundleChecks.length > 0 ? Math.round(compliant / bundleChecks.length * 100) : 0;
          return (
            <div key={b.id} className="border rounded-lg p-4">
              <div className="text-sm font-semibold">{bundleTypeLabels[b.bundle_type] || b.bundle_name}</div>
              <div className="text-3xl font-bold mt-2">{rate}%</div>
              <div className="text-xs text-gray-500">{compliant}/{bundleChecks.length} compliant checks</div>
              <div className="text-xs text-gray-400 mt-1">{(b.checklist_items || []).length} checklist items</div>
            </div>
          );
        })}
      </div>

      <div className="border rounded-lg p-4">
        <h3 className="font-semibold mb-3">HAI Surveillance ({surveillance.length} events)</h3>
        {surveillance.length === 0 ? <p className="text-sm text-gray-500">No HAI events recorded</p> : (
          <div className="divide-y">
            {surveillance.slice(0, 10).map((s: any) => (
              <div key={s.id} className="py-2 flex justify-between text-sm">
                <div><span className="font-medium">{s.infection_type}</span> — {s.organism || 'Pending'}</div>
                <div className="text-gray-500">{s.ward} • {new Date(s.onset_date).toLocaleDateString()}</div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
