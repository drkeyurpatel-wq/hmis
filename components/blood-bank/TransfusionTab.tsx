'use client';
import React from 'react';

interface TransfusionTabProps {
  transfusions: any[];
  startTransfusion: (transfusionId: string, staffId: string, vitals: { temp: number; pulse: number; bpSys: number; bpDia: number }) => Promise<void>;
  completeTransfusion: (transfusionId: string, componentId: string, volumeMl: number, vitals: { temp: number; pulse: number; bpSys: number; bpDia: number }) => Promise<void>;
  reportReaction: (transfusionId: string, patientId: string, reactionType: string, severity: string, symptoms: string, actions: string, staffId: string) => Promise<void>;
  staffId: string;
  groupColor: (g: string) => string;
}

export default function TransfusionTab({ transfusions, startTransfusion, completeTransfusion, reportReaction, staffId, groupColor }: TransfusionTabProps) {
  return (
    <div>
      <h2 className="font-semibold text-sm mb-3">Transfusion Records</h2>
      {transfusions.length === 0 ? <div className="text-center py-8 bg-white rounded-xl border text-gray-400 text-sm">No transfusion records. Issue blood from Requests or Crossmatch.</div> :
      <div className="space-y-2">{transfusions.map((t: any) => (
        <div key={t.id} className={`bg-white rounded-lg border p-3 ${t.has_reaction ? 'border-red-300 bg-red-50/30' : ''}`}>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="font-medium text-sm">{t.patient?.first_name} {t.patient?.last_name}</span>
              <span className={`px-1.5 py-0.5 rounded text-[10px] ${groupColor(t.component?.blood_group || '')}`}>{t.component?.blood_group}</span>
              <span className="text-xs">{t.component?.component_type?.replace(/_/g, ' ')}</span>
              {t.has_reaction && <span className="bg-red-600 text-white px-1.5 py-0.5 rounded text-[10px] font-bold">REACTION</span>}
            </div>
            <span className={`px-1.5 py-0.5 rounded text-[10px] ${t.status === 'completed' ? 'bg-green-100 text-green-700' : t.status === 'in_progress' ? 'bg-blue-100 text-blue-700 animate-pulse' : t.status === 'stopped' ? 'bg-red-100 text-red-700' : 'bg-yellow-100 text-yellow-700'}`}>{t.status}</span>
          </div>
          <div className="flex gap-2 mt-2">
            {t.status === 'issued' && <button onClick={() => startTransfusion(t.id, staffId, { temp: 98.6, pulse: 78, bpSys: 120, bpDia: 80 })} className="px-2 py-1 bg-blue-50 text-blue-700 text-[10px] rounded">Start Transfusion</button>}
            {t.status === 'in_progress' && <button onClick={() => completeTransfusion(t.id, t.component_id, t.component?.volume_ml || 280, { temp: 98.8, pulse: 82, bpSys: 118, bpDia: 78 })} className="px-2 py-1 bg-green-50 text-green-700 text-[10px] rounded">Complete</button>}
            {t.status === 'in_progress' && <button onClick={() => { const type = prompt('Reaction type: febrile/allergic_mild/allergic_severe/anaphylaxis/hemolytic_acute/taco/trali'); const symptoms = prompt('Symptoms:'); if (type && symptoms) reportReaction(t.id, t.patient_id, type, 'moderate', symptoms, 'Transfusion stopped', staffId); }} className="px-2 py-1 bg-red-50 text-red-700 text-[10px] rounded">Report Reaction</button>}
          </div>
        </div>
      ))}</div>}
    </div>
  );
}
