// components/emr-v2/diagnosis-builder.tsx
// ICD-10 diagnosis search with primary/secondary, type classification
'use client';
import React, { useState, useMemo } from 'react';
import { searchDiagnoses } from '@/lib/cdss/diagnoses';

interface DiagnosisEntry { code: string; name: string; type: 'primary' | 'secondary' | 'differential'; notes: string; }

interface Props { diagnoses: DiagnosisEntry[]; onChange: (d: DiagnosisEntry[]) => void; }

export default function DiagnosisBuilder({ diagnoses, onChange }: Props) {
  const [search, setSearch] = useState('');
  const results = useMemo(() => search.length >= 2 ? searchDiagnoses(search).slice(0, 8) : [], [search]);

  const add = (dx: any) => {
    const type = diagnoses.length === 0 ? 'primary' : 'secondary';
    const name = typeof dx === 'string' ? dx : (dx.label || dx.name || dx.code || String(dx));
    if (diagnoses.some(d => d.code === dx.code && dx.code)) return; // dedup by code
    onChange([...diagnoses, { code: dx.code || '', name, type, notes: '' }]);
    setSearch('');
  };

  const update = (idx: number, field: string, value: string) => {
    const updated = [...diagnoses]; (updated[idx] as any)[field] = value; onChange(updated);
  };

  const remove = (idx: number) => onChange(diagnoses.filter((_, i) => i !== idx));

  return (
    <div className="bg-white rounded-xl border p-4">
      <h2 className="font-bold text-sm mb-2">Diagnosis ({diagnoses.length})</h2>
      
      <div className="relative mb-2">
        <input type="text" value={search} onChange={e => setSearch(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter' && search.trim()) add(search.trim()); }}
          className="w-full px-3 py-2 border rounded-lg text-sm" placeholder="Search ICD-10: fever, pneumonia, MI, diabetes..." />
        {results.length > 0 && <div className="absolute top-full left-0 right-0 mt-1 bg-white border rounded-lg shadow-lg z-10 max-h-48 overflow-y-auto">
          {results.map((dx: any, i: number) => (
            <button key={i} onClick={() => add(dx)} className="w-full text-left px-3 py-2 text-xs hover:bg-blue-50 border-b">
              <span className="font-mono text-blue-600 mr-2">{dx.code}</span><span>{dx.label || dx.name}</span>
            </button>
          ))}
        </div>}
      </div>

      {diagnoses.length > 0 && <div className="space-y-1.5">{diagnoses.map((dx, i) => (
        <div key={i} className={`flex items-center gap-2 rounded-lg px-3 py-2 ${dx.type === 'primary' ? 'bg-blue-50' : dx.type === 'differential' ? 'bg-amber-50' : 'bg-gray-50'}`}>
          <span className="font-mono text-[10px] text-blue-600 w-14">{dx.code || '—'}</span>
          <span className="text-xs font-medium flex-1">{dx.name}</span>
          <select value={dx.type} onChange={e => update(i, 'type', e.target.value)} className="px-1.5 py-0.5 border rounded text-[10px]">
            <option value="primary">Primary</option><option value="secondary">Secondary</option><option value="differential">Differential</option>
          </select>
          <button onClick={() => remove(i)} className="text-red-400 text-xs">✕</button>
        </div>
      ))}</div>}
    </div>
  );
}
