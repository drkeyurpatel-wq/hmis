// @ts-nocheck
'use client';
import { useEffect, useState } from 'react';
export default function EquipmentLog() {
  const [usage, setUsage] = useState<any[]>([]);
  const centreId = 'c0000001-0000-0000-0000-000000000001';
  useEffect(() => { fetch(`/api/ot/equipment?centre_id=${centreId}`).then(r => r.json()).then(setUsage); }, []);
  const typeIcons: Record<string, string> = { ROBOT: '🤖', C_ARM: '📡', USG: '📺', NEURO_NAV: '🧭', LASER: '💥', MICROSCOPE: '🔬', ENDO_TOWER: '📹', OTHER: '⚙️' };
  return (
    <div className="p-6 space-y-6">
      <h1 className="text-2xl font-bold">Equipment & Robot Usage</h1>
      <p className="text-sm text-gray-500">Cuvis robot, C-arm, navigation — usage tracking and maintenance log</p>
      <div className="border rounded-lg divide-y">
        {usage.length === 0 && <div className="p-8 text-center text-gray-500">No equipment usage logged</div>}
        {usage.map(u => (
          <div key={u.id} className="p-3 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="text-xl">{typeIcons[u.equipment_type] || '⚙️'}</span>
              <div>
                <div className="text-sm font-medium">{u.equipment_name}</div>
                <div className="text-xs text-gray-500">{u.surgeon_name} • {u.procedure_name?.slice(0, 40)}</div>
              </div>
            </div>
            <div className="text-right text-xs text-gray-500">
              <div>{u.usage_minutes ? u.usage_minutes + ' min' : 'N/A'}</div>
              <div>{new Date(u.usage_date).toLocaleDateString()}</div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
