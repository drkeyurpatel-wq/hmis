// components/emr-v2/investigation-panel.tsx
// Investigation orders — lab + radiology with common quick-add panels
'use client';
import React, { useState } from 'react';

interface InvestigationEntry { name: string; type: 'lab' | 'radiology'; urgency: 'routine' | 'urgent' | 'stat'; notes: string; }

const COMMON_LAB = ['CBC', 'RFT (Creatinine, BUN)', 'LFT', 'Blood Sugar (FBS/PP)', 'HbA1c', 'Lipid Profile', 'Thyroid (TSH, T3, T4)', 'Electrolytes (Na, K, Cl)', 'PT/INR', 'D-Dimer', 'Troponin I', 'CRP', 'ESR', 'Urine Routine', 'Blood Culture', 'ABG', 'Procalcitonin', 'Serum Lactate'];
const COMMON_RAD = ['X-Ray Chest PA', 'CT Brain Plain', 'MRI Brain', 'USG Abdomen', 'HRCT Chest', 'CT Abdomen (CECT)', 'MRI LS Spine', 'MRI Knee', '2D Echocardiography', 'Carotid Doppler', 'CT Pulmonary Angio', 'X-Ray LS Spine'];

interface Props { investigations: InvestigationEntry[]; onChange: (inv: InvestigationEntry[]) => void; }

export default function InvestigationPanel({ investigations, onChange }: Props) {
  const [panel, setPanel] = useState<'lab' | 'radiology' | null>(null);

  const add = (name: string, type: 'lab' | 'radiology') => {
    if (investigations.find(i => i.name === name)) return;
    onChange([...investigations, { name, type, urgency: 'routine', notes: '' }]);
  };

  const remove = (idx: number) => onChange(investigations.filter((_, i) => i !== idx));
  const update = (idx: number, field: string, value: string) => {
    const updated = [...investigations]; (updated[idx] as any)[field] = value; onChange(updated);
  };

  const labCount = investigations.filter(i => i.type === 'lab').length;
  const radCount = investigations.filter(i => i.type === 'radiology').length;

  return (
    <div className="bg-white rounded-xl border p-4">
      <div className="flex items-center justify-between mb-2">
        <h2 className="font-bold text-sm">Investigations ({investigations.length})</h2>
        <div className="flex gap-1">
          <button onClick={() => setPanel(panel === 'lab' ? null : 'lab')} className={`px-2 py-1 text-[10px] rounded border ${panel === 'lab' ? 'bg-blue-600 text-white' : 'bg-white'}`}>Lab ({labCount})</button>
          <button onClick={() => setPanel(panel === 'radiology' ? null : 'radiology')} className={`px-2 py-1 text-[10px] rounded border ${panel === 'radiology' ? 'bg-purple-600 text-white' : 'bg-white'}`}>Radiology ({radCount})</button>
        </div>
      </div>

      {panel === 'lab' && <div className="bg-blue-50 rounded-lg p-3 mb-3">
        <div className="text-xs font-bold text-blue-700 mb-1.5">Quick Lab Orders</div>
        <div className="flex flex-wrap gap-1">{COMMON_LAB.map(t => {
          const added = investigations.find(i => i.name === t);
          return <button key={t} onClick={() => !added && add(t, 'lab')} className={`px-2 py-1 text-[10px] rounded border ${added ? 'bg-blue-200 text-blue-700 border-blue-300' : 'bg-white hover:bg-blue-100'}`}>{added ? '✓ ' : ''}{t}</button>;
        })}</div>
      </div>}

      {panel === 'radiology' && <div className="bg-purple-50 rounded-lg p-3 mb-3">
        <div className="text-xs font-bold text-purple-700 mb-1.5">Quick Radiology Orders</div>
        <div className="flex flex-wrap gap-1">{COMMON_RAD.map(t => {
          const added = investigations.find(i => i.name === t);
          return <button key={t} onClick={() => !added && add(t, 'radiology')} className={`px-2 py-1 text-[10px] rounded border ${added ? 'bg-purple-200 text-purple-700 border-purple-300' : 'bg-white hover:bg-purple-100'}`}>{added ? '✓ ' : ''}{t}</button>;
        })}</div>
      </div>}

      {investigations.length > 0 && <div className="space-y-1">{investigations.map((inv, i) => (
        <div key={i} className="flex items-center gap-2 bg-gray-50 rounded-lg px-3 py-1.5">
          <span className={`text-[9px] px-1 py-0.5 rounded ${inv.type === 'lab' ? 'bg-blue-100 text-blue-700' : 'bg-purple-100 text-purple-700'}`}>{inv.type === 'lab' ? 'LAB' : 'RAD'}</span>
          <span className="text-xs font-medium flex-1">{inv.name}</span>
          <select value={inv.urgency} onChange={e => update(i, 'urgency', e.target.value)} className={`px-1.5 py-0.5 border rounded text-[10px] ${inv.urgency === 'stat' ? 'bg-red-100 text-red-700' : inv.urgency === 'urgent' ? 'bg-amber-100 text-amber-700' : ''}`}>
            <option value="routine">Routine</option><option value="urgent">Urgent</option><option value="stat">STAT</option>
          </select>
          <button onClick={() => remove(i)} className="text-red-400 text-xs">✕</button>
        </div>
      ))}</div>}
    </div>
  );
}
