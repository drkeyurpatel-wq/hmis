// components/emr/vitals-compact.tsx
// Compact horizontal vitals bar with auto NEWS2 + BMI calculation
'use client';
import React, { useMemo } from 'react';
import { Activity, AlertTriangle } from 'lucide-react';
import { calculateNEWS2 } from '@/lib/cdss/news2';

export interface VitalValues {
  systolic: string;
  diastolic: string;
  heartRate: string;
  spo2: string;
  temperature: string;
  weight: string;
  height: string;
  respiratoryRate: string;
  isAlert: boolean;
  onO2: boolean;
}

interface VitalsCompactProps {
  vitals: VitalValues;
  onChange: (vitals: VitalValues) => void;
}

interface VitalFieldConfig {
  key: keyof VitalValues;
  label: string;
  unit: string;
  placeholder: string;
  min?: number;
  max?: number;
  /** Width class */
  width?: string;
}

const VITAL_FIELDS: VitalFieldConfig[] = [
  { key: 'systolic', label: 'SBP', unit: 'mmHg', placeholder: '120', min: 50, max: 300, width: 'w-14' },
  { key: 'diastolic', label: 'DBP', unit: '', placeholder: '80', min: 30, max: 200, width: 'w-14' },
  { key: 'heartRate', label: 'HR', unit: 'bpm', placeholder: '72', min: 20, max: 250, width: 'w-14' },
  { key: 'respiratoryRate', label: 'RR', unit: '/min', placeholder: '16', min: 4, max: 60, width: 'w-14' },
  { key: 'spo2', label: 'SpO₂', unit: '%', placeholder: '98', min: 50, max: 100, width: 'w-14' },
  { key: 'temperature', label: 'Temp', unit: '°F', placeholder: '98.6', min: 90, max: 110, width: 'w-16' },
  { key: 'weight', label: 'Wt', unit: 'kg', placeholder: '70', min: 1, max: 300, width: 'w-14' },
  { key: 'height', label: 'Ht', unit: 'cm', placeholder: '170', min: 30, max: 250, width: 'w-14' },
];

function getVitalAlertColor(key: string, val: number): string {
  // Simple range coloring
  switch (key) {
    case 'systolic':
      if (val < 90 || val > 180) return 'border-h1-red text-h1-red bg-h1-red/5';
      if (val < 100 || val > 140) return 'border-h1-yellow text-h1-yellow bg-h1-yellow/5';
      return '';
    case 'diastolic':
      if (val < 50 || val > 120) return 'border-h1-red text-h1-red bg-h1-red/5';
      if (val < 60 || val > 90) return 'border-h1-yellow text-h1-yellow bg-h1-yellow/5';
      return '';
    case 'heartRate':
      if (val < 40 || val > 150) return 'border-h1-red text-h1-red bg-h1-red/5';
      if (val < 50 || val > 100) return 'border-h1-yellow text-h1-yellow bg-h1-yellow/5';
      return '';
    case 'spo2':
      if (val < 92) return 'border-h1-red text-h1-red bg-h1-red/5';
      if (val < 95) return 'border-h1-yellow text-h1-yellow bg-h1-yellow/5';
      return '';
    case 'temperature':
      if (val > 103 || val < 95) return 'border-h1-red text-h1-red bg-h1-red/5';
      if (val > 100) return 'border-h1-yellow text-h1-yellow bg-h1-yellow/5';
      return '';
    case 'respiratoryRate':
      if (val < 8 || val > 30) return 'border-h1-red text-h1-red bg-h1-red/5';
      if (val < 12 || val > 20) return 'border-h1-yellow text-h1-yellow bg-h1-yellow/5';
      return '';
    default:
      return '';
  }
}

export default function VitalsCompact({ vitals, onChange }: VitalsCompactProps) {
  const handleChange = (key: keyof VitalValues, value: string) => {
    onChange({ ...vitals, [key]: value });
  };

  // NEWS2 calculation
  const news2 = useMemo(() => {
    const sys = parseFloat(vitals.systolic);
    const hr = parseFloat(vitals.heartRate);
    const rr = parseFloat(vitals.respiratoryRate);
    const spo2 = parseFloat(vitals.spo2);
    const temp = parseFloat(vitals.temperature);

    // Need at least 3 vitals to calculate
    const filled = [sys, hr, rr, spo2, temp].filter(v => !isNaN(v)).length;
    if (filled < 3) return null;

    try {
      return calculateNEWS2({
        respiratoryRate: isNaN(rr) ? 16 : rr,
        spo2: isNaN(spo2) ? 98 : spo2,
        onO2: vitals.onO2,
        systolic: isNaN(sys) ? 120 : sys,
        heartRate: isNaN(hr) ? 72 : hr,
        consciousness: vitals.isAlert ? 'A' : 'V',
        temperature: isNaN(temp) ? 98.6 : ((temp - 32) * 5 / 9), // Convert F to C for NEWS2
      });
    } catch {
      return null;
    }
  }, [vitals]);

  // BMI calculation
  const bmi = useMemo(() => {
    const wt = parseFloat(vitals.weight);
    const ht = parseFloat(vitals.height);
    if (!wt || !ht || ht < 50) return null;
    const htM = ht / 100;
    return (wt / (htM * htM)).toFixed(1);
  }, [vitals.weight, vitals.height]);

  const news2Color = !news2 ? '' :
    news2.total >= 7 ? 'bg-h1-red text-white' :
    news2.total >= 5 ? 'bg-h1-red/80 text-white' :
    news2.total >= 3 ? 'bg-h1-yellow text-h1-navy' :
    'bg-h1-success/10 text-h1-success';

  const bmiColor = !bmi ? '' :
    parseFloat(bmi) >= 30 ? 'text-h1-red' :
    parseFloat(bmi) >= 25 ? 'text-h1-yellow' :
    parseFloat(bmi) < 18.5 ? 'text-h1-yellow' :
    'text-h1-success';

  return (
    <div className="bg-h1-card rounded-h1 border border-h1-border shadow-h1-card p-3">
      <div className="flex items-center gap-2 mb-2">
        <Activity className="w-4 h-4 text-h1-teal" />
        <span className="text-h1-small font-semibold text-h1-text">Vitals</span>

        {/* NEWS2 badge */}
        {news2 && (
          <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${news2Color}`}
            title={`NEWS2 Score: ${news2.total} — ${news2.risk}`}>
            NEWS2: {news2.total}
          </span>
        )}

        {/* BMI badge */}
        {bmi && (
          <span className={`text-[10px] font-medium ${bmiColor}`} title="Body Mass Index">
            BMI: {bmi}
          </span>
        )}

        {/* O2 and Alert toggles */}
        <div className="ml-auto flex items-center gap-2">
          <label className="flex items-center gap-1 text-[10px] text-h1-text-secondary cursor-pointer">
            <input
              type="checkbox"
              checked={vitals.onO2}
              onChange={e => handleChange('onO2' as any, e.target.checked as any)}
              className="w-3 h-3 accent-h1-teal"
            />
            On O₂
          </label>
          <label className="flex items-center gap-1 text-[10px] text-h1-text-secondary cursor-pointer">
            <input
              type="checkbox"
              checked={vitals.isAlert}
              onChange={e => handleChange('isAlert' as any, e.target.checked as any)}
              className="w-3 h-3 accent-h1-teal"
            />
            Alert
          </label>
        </div>
      </div>

      {/* Vitals grid — horizontal on desktop, 2-col on mobile */}
      <div className="flex flex-wrap items-end gap-2">
        {VITAL_FIELDS.map((field) => {
          const numVal = parseFloat(vitals[field.key] as string);
          const alertClass = !isNaN(numVal) ? getVitalAlertColor(field.key, numVal) : '';
          const isBP = field.key === 'systolic' || field.key === 'diastolic';

          return (
            <div key={field.key} className="flex flex-col">
              <label className="text-[9px] text-h1-text-muted font-medium mb-0.5">
                {field.label}
                {field.unit && <span className="text-h1-text-muted/60 ml-0.5">{field.unit}</span>}
              </label>
              <div className="flex items-center">
                <input
                  type="number"
                  inputMode="decimal"
                  value={vitals[field.key] as string}
                  onChange={e => handleChange(field.key, e.target.value)}
                  placeholder={field.placeholder}
                  min={field.min}
                  max={field.max}
                  className={`${field.width || 'w-14'} px-1.5 py-1 text-xs text-center
                    border rounded-h1-sm transition-colors duration-h1-fast
                    focus:outline-none focus:ring-1 focus:ring-h1-teal focus:border-h1-teal
                    placeholder:text-h1-text-muted/40
                    ${alertClass || 'border-h1-border'}`}
                />
                {isBP && field.key === 'systolic' && (
                  <span className="text-h1-text-muted mx-0.5 text-xs">/</span>
                )}
              </div>
            </div>
          );
        })}

        {/* Warning icon for abnormal vitals */}
        {news2 && news2.total >= 5 && (
          <div className="flex items-center gap-1 text-h1-red ml-2">
            <AlertTriangle className="w-4 h-4" />
            <span className="text-[10px] font-semibold">{news2.risk}</span>
          </div>
        )}
      </div>
    </div>
  );
}
