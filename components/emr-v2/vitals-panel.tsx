// components/emr-v2/vitals-panel.tsx
// Vitals with NEWS2 auto-calculation, visual indicators, quick-entry
'use client';
import React, { useMemo } from 'react';
import { calculateNEWS2, fahToCel } from '@/lib/cdss/news2';

interface VitalValues {
  systolic: string; diastolic: string; heartRate: string; spo2: string;
  temperature: string; weight: string; height: string; respiratoryRate: string;
  isAlert: boolean; onO2: boolean;
}

const RANGES: Record<string, { low: number; high: number; unit: string; label: string }> = {
  systolic: { low: 90, high: 140, unit: 'mmHg', label: 'Systolic BP' },
  diastolic: { low: 60, high: 90, unit: 'mmHg', label: 'Diastolic BP' },
  heartRate: { low: 60, high: 100, unit: 'bpm', label: 'Heart Rate' },
  spo2: { low: 94, high: 100, unit: '%', label: 'SpO₂' },
  temperature: { low: 36.1, high: 37.5, unit: '°F', label: 'Temperature' },
  respiratoryRate: { low: 12, high: 20, unit: '/min', label: 'Resp Rate' },
};

function VitalInput({ name, value, onChange, vitals }: { name: string; value: string; onChange: (v: string) => void; vitals: VitalValues }) {
  const cfg = RANGES[name];
  if (!cfg) return null;
  const num = parseFloat(value);
  const isAbnormal = !isNaN(num) && (num < cfg.low || num > cfg.high);
  const isCritical = !isNaN(num) && (
    (name === 'systolic' && (num < 70 || num > 180)) ||
    (name === 'heartRate' && (num < 40 || num > 130)) ||
    (name === 'spo2' && num < 90) ||
    (name === 'respiratoryRate' && (num < 8 || num > 30))
  );

  return (
    <div className={`rounded-lg border p-2 ${isCritical ? 'bg-red-50 border-red-300' : isAbnormal ? 'bg-amber-50 border-amber-200' : 'bg-white'}`}>
      <label className="text-[9px] text-gray-500 block">{cfg.label}</label>
      <div className="flex items-baseline gap-1">
        <input type="number" value={value} onChange={e => onChange(e.target.value)}
          className={`w-full text-lg font-bold bg-transparent outline-none ${isCritical ? 'text-red-700' : isAbnormal ? 'text-amber-700' : 'text-gray-900'}`}
          placeholder="—" />
        <span className="text-[9px] text-gray-400">{cfg.unit}</span>
      </div>
      {isCritical && <div className="text-[8px] text-red-600 font-bold mt-0.5">CRITICAL</div>}
    </div>
  );
}

interface Props { vitals: VitalValues; onChange: (v: VitalValues) => void; }

export default function VitalsPanel({ vitals, onChange }: Props) {
  const update = (field: string, value: string | boolean) => onChange({ ...vitals, [field]: value });

  const news2 = useMemo(() => {
    const sys = parseInt(vitals.systolic); const hr = parseInt(vitals.heartRate);
    const rr = parseInt(vitals.respiratoryRate); const spo2 = parseInt(vitals.spo2);
    const temp = parseFloat(vitals.temperature);
    if (isNaN(sys) || isNaN(hr) || isNaN(rr) || isNaN(spo2)) return null;
    return calculateNEWS2({
      systolic: sys, heartRate: hr, respiratoryRate: rr, spo2,
      temperature: temp ? (temp > 50 ? fahToCel(temp) : temp) : 37,
      isAlert: vitals.isAlert, onSupplementalO2: vitals.onO2,
    });
  }, [vitals]);

  const bmi = useMemo(() => {
    const w = parseFloat(vitals.weight); const h = parseFloat(vitals.height);
    if (!w || !h || h < 30) return null;
    const hm = h > 3 ? h / 100 : h;
    return (w / (hm * hm)).toFixed(1);
  }, [vitals.weight, vitals.height]);

  return (
    <div className="bg-white rounded-xl border p-4">
      <div className="flex items-center justify-between mb-3">
        <h2 className="font-bold text-sm">Vitals</h2>
        {news2 && (
          <div className={`flex items-center gap-2 px-3 py-1 rounded-lg text-xs font-bold ${
            news2.total >= 7 ? 'bg-red-600 text-white' : news2.total >= 5 ? 'bg-orange-500 text-white' :
            news2.total >= 3 ? 'bg-amber-400 text-white' : 'bg-green-100 text-green-700'
          }`}>
            NEWS2: {news2.total} — {news2.risk}
            {news2.total >= 5 && <span className="animate-pulse">⚠</span>}
          </div>
        )}
      </div>

      <div className="grid grid-cols-8 gap-2">
        <div className="col-span-2">
          <label className="text-[9px] text-gray-500">Blood Pressure</label>
          <div className="flex items-center gap-1">
            <input type="number" value={vitals.systolic} onChange={e => update('systolic', e.target.value)}
              className="w-16 text-lg font-bold text-center border rounded-lg px-1 py-1" placeholder="120" />
            <span className="text-gray-400">/</span>
            <input type="number" value={vitals.diastolic} onChange={e => update('diastolic', e.target.value)}
              className="w-16 text-lg font-bold text-center border rounded-lg px-1 py-1" placeholder="80" />
            <span className="text-[9px] text-gray-400">mmHg</span>
          </div>
        </div>
        <VitalInput name="heartRate" value={vitals.heartRate} onChange={v => update('heartRate', v)} vitals={vitals} />
        <VitalInput name="spo2" value={vitals.spo2} onChange={v => update('spo2', v)} vitals={vitals} />
        <VitalInput name="temperature" value={vitals.temperature} onChange={v => update('temperature', v)} vitals={vitals} />
        <VitalInput name="respiratoryRate" value={vitals.respiratoryRate} onChange={v => update('respiratoryRate', v)} vitals={vitals} />
        <div className="rounded-lg border p-2 bg-white">
          <label className="text-[9px] text-gray-500">Weight</label>
          <div className="flex items-baseline gap-1"><input type="number" value={vitals.weight} onChange={e => update('weight', e.target.value)} className="w-full text-lg font-bold bg-transparent outline-none" placeholder="—" /><span className="text-[9px] text-gray-400">kg</span></div>
        </div>
        <div className="rounded-lg border p-2 bg-white">
          <label className="text-[9px] text-gray-500">Height</label>
          <div className="flex items-baseline gap-1"><input type="number" value={vitals.height} onChange={e => update('height', e.target.value)} className="w-full text-lg font-bold bg-transparent outline-none" placeholder="—" /><span className="text-[9px] text-gray-400">cm</span></div>
        </div>
      </div>

      <div className="flex items-center gap-4 mt-2">
        <label className="flex items-center gap-1.5 text-xs"><input type="checkbox" checked={vitals.onO2} onChange={e => update('onO2', e.target.checked)} className="rounded" /><span>On O₂</span></label>
        <label className="flex items-center gap-1.5 text-xs"><input type="checkbox" checked={vitals.isAlert} onChange={e => update('isAlert', e.target.checked)} className="rounded" /><span>Alert (AVPU)</span></label>
        {bmi && <span className={`text-xs px-2 py-0.5 rounded ${parseFloat(bmi) < 18.5 ? 'bg-amber-100 text-amber-700' : parseFloat(bmi) > 30 ? 'bg-red-100 text-red-700' : 'bg-green-100 text-green-700'}`}>BMI: {bmi}</span>}
      </div>
    </div>
  );
}
