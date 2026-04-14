// @ts-nocheck
'use client';
import { useEffect, useState } from 'react';
export default function PreferenceCards() {
  const [prefs, setPrefs] = useState<any[]>([]);
  const centreId = 'c0000001-0000-0000-0000-000000000001';
  useEffect(() => { fetch(`/api/ot/surgeon-preferences?centre_id=${centreId}`).then(r => r.json()).then(setPrefs); }, []);
  return (
    <div className="p-6 space-y-6">
      <h1 className="text-2xl font-bold">Surgeon Preference Cards</h1>
      <p className="text-sm text-gray-500">Per-surgeon, per-procedure preferences — instruments, sutures, implants, position, anaesthesia</p>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {prefs.length === 0 && <div className="col-span-2 border rounded-lg p-8 text-center text-gray-500">No preference cards created yet. Add your first surgeon preference card.</div>}
        {prefs.map(p => (
          <div key={p.id} className="border rounded-lg p-4">
            <div className="flex items-center justify-between">
              <div className="font-semibold text-sm">{p.surgeon_name}</div>
              <span className="text-xs px-2 py-0.5 rounded bg-blue-100 text-blue-800">{p.procedure_category || 'General'}</span>
            </div>
            <div className="text-sm mt-1 font-medium text-gray-700">{p.procedure_name}</div>
            <div className="grid grid-cols-2 gap-1 mt-2 text-xs text-gray-500">
              <div>Position: {p.preferred_position || 'N/A'}</div>
              <div>Anaesthesia: {p.preferred_anaesthesia || 'N/A'}</div>
              <div>Glove: {p.glove_size || 'N/A'}</div>
              <div>Est. time: {p.estimated_duration_minutes || 'N/A'}min</div>
            </div>
            {p.special_equipment?.length > 0 && <div className="text-xs mt-1 text-purple-600">Equipment: {p.special_equipment.join(', ')}</div>}
          </div>
        ))}
      </div>
    </div>
  );
}
