// components/emr-v2/complaint-builder.tsx
// Smart complaint entry with CDSS templates, duration, severity
'use client';
import React, { useState, useMemo } from 'react';
import { searchComplaints, COMPLAINT_TEMPLATES } from '@/lib/cdss/complaints';

interface ComplaintEntry { complaint: string; duration: string; severity: string; notes: string; }

const SEVERITIES = ['mild', 'moderate', 'severe'];
const DURATIONS = ['Today', '1 day', '2 days', '3 days', '5 days', '1 week', '2 weeks', '1 month', '2 months', '3 months', '6 months', '1 year', 'Chronic'];

interface Props { complaints: ComplaintEntry[]; onChange: (c: ComplaintEntry[]) => void; }

export default function ComplaintBuilder({ complaints, onChange }: Props) {
  const [search, setSearch] = useState('');
  const [expanded, setExpanded] = useState<number | null>(null);
  const results = useMemo(() => search.length >= 2 ? searchComplaints(search).slice(0, 8) : [], [search]);

  const add = (text: string) => {
    onChange([...complaints, { complaint: text, duration: '', severity: 'moderate', notes: '' }]);
    setSearch('');
    setExpanded(complaints.length);
  };

  const update = (idx: number, field: string, value: string) => {
    const updated = [...complaints];
    (updated[idx] as any)[field] = value;
    onChange(updated);
  };

  const remove = (idx: number) => { onChange(complaints.filter((_, i) => i !== idx)); if (expanded === idx) setExpanded(null); };

  return (
    <div className="bg-white rounded-xl border p-4">
      <h2 className="font-bold text-sm mb-2">Chief Complaints ({complaints.length})</h2>
      
      <div className="relative mb-2">
        <input type="text" value={search} onChange={e => setSearch(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter' && search.trim()) { add(search.trim()); } }}
          className="w-full px-3 py-2 border rounded-lg text-sm" placeholder="Type complaint or search templates..." />
        {results.length > 0 && <div className="absolute top-full left-0 right-0 mt-1 bg-white border rounded-lg shadow-lg z-10 max-h-48 overflow-y-auto">
          {results.map((c: any, i: number) => (
            <button key={i} onClick={() => add(c.label || String(c))}
              className="w-full text-left px-3 py-2 text-xs hover:bg-blue-50 border-b">{c.label || String(c)}</button>
          ))}
        </div>}
      </div>

      {/* Common complaints quick-add */}
      <div className="flex flex-wrap gap-1 mb-3">
        {['Fever', 'Headache', 'Chest pain', 'Abdominal pain', 'Breathlessness', 'Cough', 'Vomiting', 'Diarrhea', 'Body ache', 'Weakness', 'Dizziness', 'Swelling'].map(c => (
          <button key={c} onClick={() => add(c)} className="px-2 py-0.5 text-[10px] bg-gray-50 border rounded hover:bg-blue-50 hover:border-blue-200">{c}</button>
        ))}
      </div>

      {/* Complaints list */}
      <div className="space-y-1.5">{complaints.map((c, i) => (
        <div key={i} className="bg-gray-50 rounded-lg px-3 py-2">
          <div className="flex items-center justify-between">
            <button onClick={() => setExpanded(expanded === i ? null : i)} className="flex items-center gap-2 text-sm font-medium text-left flex-1">
              <span>{c.complaint}</span>
              {c.duration && <span className="text-[10px] text-gray-400">({c.duration})</span>}
              <span className={`text-[9px] px-1 py-0.5 rounded ${c.severity === 'severe' ? 'bg-red-100 text-red-700' : c.severity === 'mild' ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700'}`}>{c.severity}</span>
            </button>
            <button onClick={() => remove(i)} className="text-red-400 text-xs hover:text-red-600 px-1">✕</button>
          </div>
          {expanded === i && (
            <div className="grid grid-cols-3 gap-2 mt-2">
              <div><label className="text-[9px] text-gray-500">Duration</label>
                <select value={c.duration} onChange={e => update(i, 'duration', e.target.value)} className="w-full px-2 py-1 border rounded text-xs">
                  <option value="">Select</option>{DURATIONS.map(d => <option key={d}>{d}</option>)}</select></div>
              <div><label className="text-[9px] text-gray-500">Severity</label>
                <div className="flex gap-1 mt-0.5">{SEVERITIES.map(s => (
                  <button key={s} onClick={() => update(i, 'severity', s)} className={`flex-1 py-1 rounded text-[10px] border ${c.severity === s ? s === 'severe' ? 'bg-red-600 text-white' : s === 'mild' ? 'bg-green-600 text-white' : 'bg-amber-500 text-white' : 'bg-white'}`}>{s}</button>
                ))}</div></div>
              <div><label className="text-[9px] text-gray-500">Notes</label>
                <input type="text" value={c.notes} onChange={e => update(i, 'notes', e.target.value)} className="w-full px-2 py-1 border rounded text-xs" placeholder="Details..." /></div>
            </div>
          )}
        </div>
      ))}</div>
    </div>
  );
}
