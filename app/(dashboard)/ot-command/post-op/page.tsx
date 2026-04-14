// @ts-nocheck
'use client';
import { useEffect, useState } from 'react';
export default function PostOpMonitor() {
  const [patients, setPatients] = useState<any[]>([]);
  const centreId = 'c0000001-0000-0000-0000-000000000001';
  useEffect(() => { fetch(`/api/ot/post-op?centre_id=${centreId}`).then(r => r.json()).then(setPatients); }, []);
  const statusColors: Record<string, string> = { IN_OT: 'bg-red-100 text-red-800', IN_PACU: 'bg-amber-100 text-amber-800', IN_WARD: 'bg-green-100 text-green-800', ICU_TRANSFER: 'bg-purple-100 text-purple-800' };
  return (
    <div className="p-6 space-y-6">
      <h1 className="text-2xl font-bold">Post-Op Monitoring (PACU)</h1>
      <p className="text-sm text-gray-500">Aldrete scoring, vitals, recovery tracking</p>
      <div className="border rounded-lg divide-y">
        {patients.length === 0 && <div className="p-8 text-center text-gray-500">No post-op patients currently</div>}
        {patients.map(p => (
          <div key={p.id} className="p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <span className={`text-xs px-2 py-1 rounded font-medium ${statusColors[p.status] || 'bg-gray-100'}`}>{p.status?.replace(/_/g, ' ')}</span>
                <div>
                  <div className="text-sm font-medium">Aldrete: {p.aldrete_total || 0}/10</div>
                  {p.blood_loss_ml && <div className="text-xs text-gray-500">Blood loss: {p.blood_loss_ml}ml</div>}
                </div>
              </div>
              <div className="text-right text-xs text-gray-500">
                {p.ot_out_time && <div>OT out: {new Date(p.ot_out_time).toLocaleTimeString()}</div>}
                {p.complications?.length > 0 && <div className="text-red-600 font-medium">⚠️ {p.complications.join(', ')}</div>}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
