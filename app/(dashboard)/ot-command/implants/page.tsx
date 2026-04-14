// @ts-nocheck
'use client';
import { useEffect, useState } from 'react';
export default function ImplantRegistry() {
  const [implants, setImplants] = useState<any[]>([]);
  const centreId = 'c0000001-0000-0000-0000-000000000001';
  useEffect(() => { fetch(`/api/ot/implants?centre_id=${centreId}`).then(r => r.json()).then(setImplants); }, []);
  return (
    <div className="p-6 space-y-6">
      <h1 className="text-2xl font-bold">Implant Registry</h1>
      <p className="text-sm text-gray-500">Barcode tracking, cost, manufacturer, expiry</p>
      <div className="border rounded-lg divide-y">
        {implants.length === 0 && <div className="p-8 text-center text-gray-500">No implants logged yet</div>}
        {implants.map(i => (
          <div key={i.id} className="p-3 flex items-center justify-between text-sm">
            <div><span className="font-medium">{i.implant_name || 'Unknown'}</span><div className="text-xs text-gray-500">{i.manufacturer} • {i.barcode || 'No barcode'}</div></div>
            <div className="text-right text-xs text-gray-500">{i.patient_name || 'N/A'} • {new Date(i.created_at).toLocaleDateString()}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
