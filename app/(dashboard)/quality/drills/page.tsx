'use client';
import { useEffect, useState } from 'react';
export default function DrillsPage() {
  const [drills, setDrills] = useState<any[]>([]);
  const centreId = 'c0000001-0000-0000-0000-000000000001';
  useEffect(() => { fetch(`/api/quality/drills?centre_id=${centreId}`).then(r => r.json()).then(setDrills); }, []);
  const typeIcons: Record<string, string> = { FIRE: '🔥', CODE_BLUE: '🔵', DISASTER: '🌊', BOMB_THREAT: '💣', CHEMICAL_SPILL: '⚗️', MASS_CASUALTY: '🏥', OTHER: '📋' };
  return (
    <div className="p-6 space-y-6">
      <h1 className="text-2xl font-bold">FMS Compliance — Safety Drills</h1>
      <p className="text-sm text-gray-500">FMS.1-7 — Fire, Code Blue, Disaster preparedness</p>
      <div className="border rounded-lg divide-y">
        {drills.length === 0 && <div className="p-8 text-center text-gray-500">No safety drills recorded. Schedule your first drill!</div>}
        {drills.map(d => (
          <div key={d.id} className="p-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <span className="text-2xl">{typeIcons[d.drill_type] || '📋'}</span>
              <div>
                <div className="font-medium text-sm">{d.drill_type.replace(/_/g, ' ')}</div>
                <div className="text-xs text-gray-500">{d.location} • {new Date(d.drill_date).toLocaleDateString()}</div>
                {d.response_time_seconds && <div className="text-xs mt-0.5">Response: {d.response_time_seconds}s (target: {d.target_response_seconds}s)</div>}
              </div>
            </div>
            {d.met_target !== null && (
              <span className={`text-xs px-2 py-1 rounded-full font-medium ${d.met_target ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
                {d.met_target ? '✅ Target Met' : '❌ Below Target'}
              </span>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
