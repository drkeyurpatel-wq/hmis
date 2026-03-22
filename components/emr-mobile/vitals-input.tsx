// components/emr-mobile/vitals-input.tsx
// Touch-optimized vitals entry with large inputs and +/- buttons
'use client';
import React, { useState } from 'react';

interface VitalField { key: string; label: string; unit: string; min: number; max: number; step: number; default: number }

const FIELDS: VitalField[] = [
  { key: 'bp_sys', label: 'Systolic', unit: 'mmHg', min: 60, max: 250, step: 2, default: 120 },
  { key: 'bp_dia', label: 'Diastolic', unit: 'mmHg', min: 30, max: 150, step: 2, default: 80 },
  { key: 'hr', label: 'Heart Rate', unit: 'bpm', min: 30, max: 200, step: 1, default: 78 },
  { key: 'spo2', label: 'SpO₂', unit: '%', min: 50, max: 100, step: 1, default: 98 },
  { key: 'temp', label: 'Temp', unit: '°F', min: 90, max: 110, step: 0.1, default: 98.6 },
  { key: 'rr', label: 'Resp Rate', unit: '/min', min: 5, max: 50, step: 1, default: 16 },
];

interface Props {
  onSave: (vitals: Record<string, number>) => Promise<void>;
  onFlash: (msg: string) => void;
}

export default function VitalsInput({ onSave, onFlash }: Props) {
  const [values, setValues] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);

  const update = (key: string, val: string) => setValues(prev => ({ ...prev, [key]: val }));
  const adjust = (f: VitalField, dir: number) => {
    const cur = parseFloat(values[f.key] || '') || f.default;
    const next = Math.round((cur + dir * f.step) * 10) / 10;
    if (next >= f.min && next <= f.max) update(f.key, String(next));
  };

  const save = async () => {
    const filled = Object.entries(values).filter(([, v]) => v !== '');
    if (filled.length < 2) { onFlash('Enter at least 2 vital signs'); return; }
    setSaving(true);
    const vitals: Record<string, number> = {};
    for (const [k, v] of filled) vitals[k] = parseFloat(v);
    await onSave(vitals);
    onFlash('Vitals saved');
    setSaving(false);
  };

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-3">
        {FIELDS.map(f => (
          <div key={f.key} className="bg-white rounded-xl border p-3">
            <div className="text-[10px] text-gray-500 font-medium mb-1">{f.label} <span className="text-gray-300">({f.unit})</span></div>
            <div className="flex items-center gap-1">
              <button onClick={() => adjust(f, -1)} className="w-10 h-10 bg-gray-100 rounded-lg text-lg font-bold text-gray-600 active:bg-gray-200">−</button>
              <input type="number" value={values[f.key] || ''} onChange={e => update(f.key, e.target.value)}
                className="flex-1 text-center text-xl font-bold py-2 border rounded-lg" placeholder={String(f.default)} step={f.step} />
              <button onClick={() => adjust(f, 1)} className="w-10 h-10 bg-gray-100 rounded-lg text-lg font-bold text-gray-600 active:bg-gray-200">+</button>
            </div>
          </div>
        ))}
      </div>
      <button onClick={save} disabled={saving} className="w-full py-3 bg-teal-600 text-white rounded-xl font-semibold text-sm disabled:opacity-50">
        {saving ? 'Saving...' : 'Save Vitals'}
      </button>
    </div>
  );
}
