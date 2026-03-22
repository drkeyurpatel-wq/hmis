'use client';
import React from 'react';

interface WoundCareTabProps {
  selectedEnrollId: string | null;
  records: any[];
}

export default function WoundCareTab({ selectedEnrollId, records }: WoundCareTabProps) {
  return (
    <div>
      <h2 className="font-semibold text-sm mb-3">Wound Care Log</h2>
      {!selectedEnrollId ? <div className="text-center py-8 bg-white rounded-xl border text-gray-400 text-sm">Select a patient from Patients tab first</div> :
      records.length === 0 ? <div className="text-center py-8 bg-white rounded-xl border text-gray-400 text-sm">No wound care records. Document during visit checkout.</div> :
      <div className="space-y-3">{records.map((w: any) => (
        <div key={w.id} className="bg-white rounded-xl border p-4">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <span className="font-medium text-sm">{w.wound_location}</span>
              <span className="bg-gray-100 text-gray-600 px-1.5 py-0.5 rounded text-[10px]">{w.wound_type?.replace(/_/g,' ')}</span>
              {w.healing_progress && <span className={`text-[10px] font-medium ${w.healing_progress === 'improving' ? 'text-green-600' : w.healing_progress === 'worsening' ? 'text-red-600' : 'text-yellow-600'}`}>{w.healing_progress}</span>}
            </div>
            <span className="text-xs text-gray-400">{new Date(w.created_at).toLocaleDateString('en-IN')}</span>
          </div>
          <div className="grid grid-cols-4 gap-2 text-xs">
            {w.length_cm && <div><span className="text-gray-500">Size:</span> {w.length_cm}x{w.width_cm}x{w.depth_cm} cm</div>}
            {w.wound_bed && <div><span className="text-gray-500">Bed:</span> {w.wound_bed}</div>}
            {w.exudate_amount && <div><span className="text-gray-500">Exudate:</span> {w.exudate_amount} ({w.exudate_type})</div>}
            {w.dressing_type && <div><span className="text-gray-500">Dressing:</span> {w.dressing_type}</div>}
          </div>
          {w.infection_signs && <div className="text-xs text-red-600 mt-1 font-medium">Signs of infection present</div>}
          {w.notes && <div className="text-xs text-gray-500 mt-1">{w.notes}</div>}
        </div>
      ))}</div>}
    </div>
  );
}
