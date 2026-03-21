'use client';
import React from 'react';

interface ReactionsTabProps {
  transfusions: any[];
  groupColor: (g: string) => string;
}

export default function ReactionsTab({ transfusions, groupColor }: ReactionsTabProps) {
  const withReactions = transfusions.filter(t => t.has_reaction);

  return (
    <div>
      <h2 className="font-semibold text-sm mb-3">Transfusion Reactions</h2>
      {withReactions.length === 0 ? <div className="text-center py-8 bg-white rounded-xl border text-gray-400 text-sm">No transfusion reactions reported</div> :
      <div className="space-y-2">{withReactions.map((t: any) => (
        <div key={t.id} className="bg-red-50 rounded-xl border border-red-200 p-4">
          <div className="flex items-center gap-2 mb-2">
            <span className="text-red-600 text-lg">⚠️</span>
            <span className="font-medium">{t.patient?.first_name} {t.patient?.last_name}</span>
            <span className={`px-1.5 py-0.5 rounded text-[10px] ${groupColor(t.component?.blood_group || '')}`}>{t.component?.blood_group}</span>
            <span className="text-xs">{t.component?.component_type?.replace(/_/g, ' ')}</span>
          </div>
          <div className="text-xs text-red-700">Transfusion stopped — reaction reported</div>
          <div className="text-[10px] text-gray-500 mt-1">{new Date(t.issued_at).toLocaleString('en-IN')}</div>
        </div>
      ))}</div>}
    </div>
  );
}
