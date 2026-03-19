// components/emr-v2/exam-builder.tsx
'use client';
import React, { useState } from 'react';
import { EXAM_SYSTEMS, type ExamSystem } from '@/lib/cdss/exam-templates';

interface ExamEntry { system: string; findings: string; isAbnormal: boolean; }
interface Props { examEntries: ExamEntry[]; onChange: (e: ExamEntry[]) => void; }

export default function ExamBuilder({ examEntries, onChange }: Props) {
  const [activeSystem, setActiveSystem] = useState<string | null>(null);

  const toggleSystem = (sys: ExamSystem) => {
    if (examEntries.find(e => e.system === sys.label)) {
      setActiveSystem(activeSystem === sys.label ? null : sys.label);
    } else {
      const normalText = sys.findings.map(f => `${f.label}: ${f.normal}`).join('. ');
      onChange([...examEntries, { system: sys.label, findings: normalText, isAbnormal: false }]);
      setActiveSystem(sys.label);
    }
  };

  const update = (system: string, field: string, value: any) => {
    onChange(examEntries.map(e => e.system === system ? { ...e, [field]: value } : e));
  };

  const remove = (system: string) => {
    onChange(examEntries.filter(e => e.system !== system));
    if (activeSystem === system) setActiveSystem(null);
  };

  return (
    <div className="bg-white rounded-xl border p-4">
      <h2 className="font-bold text-sm mb-2">Examination ({examEntries.length} systems)</h2>

      <div className="flex flex-wrap gap-1.5 mb-3">
        {EXAM_SYSTEMS.map((sys: ExamSystem) => {
          const entry = examEntries.find(e => e.system === sys.label);
          return (
            <button key={sys.key} onClick={() => toggleSystem(sys)}
              className={`px-2.5 py-1.5 rounded-lg text-[10px] border transition-all ${
                entry ? (entry.isAbnormal ? 'bg-red-100 border-red-300 text-red-700' : 'bg-green-100 border-green-300 text-green-700')
                : 'bg-white border-gray-200 text-gray-600 hover:border-blue-200 hover:bg-blue-50'
              } ${activeSystem === sys.label ? 'ring-2 ring-blue-300' : ''}`}>
              {sys.icon} {sys.label} {entry ? (entry.isAbnormal ? '⚠' : '✓') : ''}
            </button>
          );
        })}
      </div>

      {activeSystem && examEntries.find(e => e.system === activeSystem) && (() => {
        const entry = examEntries.find(e => e.system === activeSystem)!;
        const sys = EXAM_SYSTEMS.find((s: ExamSystem) => s.label === activeSystem);
        return (
          <div className="bg-gray-50 rounded-lg p-3 space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="font-semibold text-sm">{activeSystem}</span>
                <label className="flex items-center gap-1 text-xs">
                  <input type="checkbox" checked={entry.isAbnormal} onChange={e => update(activeSystem, 'isAbnormal', e.target.checked)} className="rounded" />
                  <span className={entry.isAbnormal ? 'text-red-700 font-medium' : 'text-gray-500'}>Abnormal</span>
                </label>
              </div>
              <button onClick={() => remove(activeSystem)} className="text-red-400 text-xs">Remove</button>
            </div>
            {sys && <div className="flex gap-1 flex-wrap">
              <button onClick={() => { update(activeSystem, 'findings', sys.findings.map(f => `${f.label}: ${f.normal}`).join('. ')); update(activeSystem, 'isAbnormal', false); }}
                className="px-2 py-0.5 text-[9px] bg-green-50 border border-green-200 rounded hover:bg-green-100">All Normal</button>
              {sys.findings.flatMap(f => f.abnormalOptions.slice(0, 2).map(opt => (
                <button key={f.label + opt} onClick={() => { update(activeSystem, 'findings', entry.findings + `. ${f.label}: ${opt}`); update(activeSystem, 'isAbnormal', true); }}
                  className="px-2 py-0.5 text-[9px] bg-red-50 border border-red-200 rounded hover:bg-red-100">{f.label}: {opt.substring(0, 25)}</button>
              )))}
            </div>}
            <textarea value={entry.findings} onChange={e => update(activeSystem, 'findings', e.target.value)}
              rows={3} className="w-full px-3 py-2 border rounded-lg text-sm" />
          </div>
        );
      })()}

      {examEntries.length > 0 && !activeSystem && (
        <div className="space-y-1">{examEntries.map(e => (
          <div key={e.system} onClick={() => setActiveSystem(e.system)}
            className={`px-3 py-1.5 rounded-lg cursor-pointer text-xs ${e.isAbnormal ? 'bg-red-50 hover:bg-red-100' : 'bg-green-50 hover:bg-green-100'}`}>
            <span className="font-medium">{e.system}:</span> <span className="text-gray-600">{e.findings.substring(0, 80)}{e.findings.length > 80 ? '...' : ''}</span>
          </div>
        ))}</div>
      )}
    </div>
  );
}
