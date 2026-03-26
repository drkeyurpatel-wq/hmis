// components/lab/lab-antibiogram.tsx
// Cumulative antibiogram matrix: organisms × antibiotics with susceptibility %
'use client';
import React from 'react';
import { useAntibiogram } from '@/lib/lab/micro-hooks';

interface LabAntibiogramProps {
  centreId: string;
  onFlash: (msg: string) => void;
}

export default function LabAntibiogram({ centreId, onFlash }: LabAntibiogramProps) {
  const antibiogram = useAntibiogram(centreId);

  const handleGenerate = () => {
    const now = new Date();
    const start = new Date(now.getFullYear(), 0, 1).toISOString().split('T')[0];
    const end = now.toISOString().split('T')[0];
    antibiogram.generate(start, end);
    onFlash('Antibiogram generated for ' + now.getFullYear());
  };

  // Build matrix
  const orgMap = new Map<string, { name: string; data: Map<string, { total: number; pct: number }> }>();
  const abxSet = new Map<string, string>();

  antibiogram.data.forEach((d: any) => {
    const orgName = d.organism?.organism_name || '?';
    const abxCode = d.antibiotic?.antibiotic_code || '?';
    const abxName = d.antibiotic?.antibiotic_name || '?';
    if (!orgMap.has(orgName)) orgMap.set(orgName, { name: orgName, data: new Map() });
    orgMap.get(orgName)!.data.set(abxCode, { total: d.total_isolates, pct: parseFloat(d.susceptibility_percent) });
    abxSet.set(abxCode, abxName);
  });

  const abxList = [...abxSet.entries()];
  const orgList = [...orgMap.entries()];

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-h1-card-title text-h1-navy">Cumulative Antibiogram</h2>
        <button onClick={handleGenerate}
          className="px-3 py-1.5 bg-purple-600 text-white text-h1-small font-medium rounded-h1-sm
            hover:bg-purple-700 transition-colors cursor-pointer">
          Generate (This Year)
        </button>
      </div>

      {antibiogram.data.length === 0 ? (
        <div className="text-center py-12 bg-h1-card rounded-h1 border border-h1-border text-h1-text-muted text-h1-body">
          No antibiogram data. Generate from cumulative sensitivity data.
        </div>
      ) : (
        <>
          <div className="bg-h1-card rounded-h1 border border-h1-border overflow-x-auto">
            <table className="text-[10px] whitespace-nowrap">
              <thead>
                <tr className="bg-h1-navy/[0.03] border-b border-h1-border">
                  <th className="p-2 text-left font-medium text-h1-text-secondary sticky left-0 bg-h1-navy/[0.03] min-w-[180px]">Organism</th>
                  <th className="p-2 text-center font-medium text-h1-text-secondary">n</th>
                  {abxList.map(([code, name]) => (
                    <th key={code} className="p-1.5 text-center font-medium text-h1-text-secondary max-w-[40px]" title={name}>{code}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {orgList.map(([orgName, org]) => (
                  <tr key={orgName} className="border-b border-h1-border">
                    <td className="p-2 font-medium text-h1-text sticky left-0 bg-h1-card">{orgName}</td>
                    <td className="p-2 text-center text-h1-text-muted">{[...org.data.values()][0]?.total || '—'}</td>
                    {abxList.map(([code]) => {
                      const d = org.data.get(code);
                      if (!d) return <td key={code} className="p-1.5 text-center text-h1-text-muted/30">—</td>;
                      const bg = d.pct >= 80 ? 'bg-h1-success/10 text-h1-success'
                        : d.pct >= 50 ? 'bg-h1-yellow/10 text-h1-yellow'
                        : 'bg-h1-red/10 text-h1-red';
                      return <td key={code} className={`p-1.5 text-center font-medium ${bg}`}>{Math.round(d.pct)}%</td>;
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="flex gap-3 mt-2 text-[10px] text-h1-text-muted">
            <span className="flex items-center gap-1"><span className="w-3 h-3 bg-h1-success/10 rounded" />≥80% susceptible</span>
            <span className="flex items-center gap-1"><span className="w-3 h-3 bg-h1-yellow/10 rounded" />50–79%</span>
            <span className="flex items-center gap-1"><span className="w-3 h-3 bg-h1-red/10 rounded" />&lt;50%</span>
          </div>
        </>
      )}
    </div>
  );
}
