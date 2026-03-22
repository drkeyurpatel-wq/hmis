// components/alerts/alert-banner.tsx
// Fixed top banner that shows when there are active critical/emergency alerts
'use client';

import React, { useState } from 'react';
import Link from 'next/link';

interface Props {
  alerts: any[];
  onAcknowledge: (alertId: string) => void;
}

export default function AlertBanner({ alerts, onAcknowledge }: Props) {
  const [expanded, setExpanded] = useState(false);
  const [dismissed, setDismissed] = useState<Set<string>>(new Set());

  const emergencies = alerts.filter(a => a.severity === 'emergency' && !dismissed.has(a.id));
  const criticals = alerts.filter(a => a.severity === 'critical' && !dismissed.has(a.id));
  const visible = [...emergencies, ...criticals].slice(0, 5);

  if (visible.length === 0) return null;

  const hasEmergency = emergencies.length > 0;

  return (
    <div className={`fixed top-0 left-0 right-0 z-[100] ${hasEmergency ? 'bg-red-600' : 'bg-amber-500'}`}>
      {/* Compact bar */}
      <div className="max-w-7xl mx-auto px-4 py-2 flex items-center justify-between">
        <button onClick={() => setExpanded(!expanded)} className="flex items-center gap-2 text-white">
          <span className={`relative flex h-3 w-3 ${hasEmergency ? 'animate-ping-slow' : ''}`}>
            <span className={`absolute inline-flex h-full w-full rounded-full ${hasEmergency ? 'bg-white animate-ping' : 'bg-amber-200 animate-ping'} opacity-75`} />
            <span className={`relative inline-flex rounded-full h-3 w-3 ${hasEmergency ? 'bg-white' : 'bg-amber-200'}`} />
          </span>
          <span className="text-sm font-bold">
            {emergencies.length > 0 && `${emergencies.length} EMERGENCY`}
            {emergencies.length > 0 && criticals.length > 0 && ' + '}
            {criticals.length > 0 && `${criticals.length} Critical`}
            {' '} Alert{visible.length !== 1 ? 's' : ''}
          </span>
          <span className="text-white/70 text-xs ml-2">
            {visible[0]?.title}
            {visible.length > 1 && ` (+${visible.length - 1} more)`}
          </span>
        </button>
        <div className="flex items-center gap-2">
          <Link href="/nursing-station" className="text-white/90 text-xs hover:text-white underline">View All</Link>
          <button onClick={() => setExpanded(!expanded)} className="text-white/80 text-xs px-2 py-0.5 rounded bg-white/20 hover:bg-white/30">
            {expanded ? 'Collapse' : 'Details'}
          </button>
        </div>
      </div>

      {/* Expanded details */}
      {expanded && (
        <div className={`border-t ${hasEmergency ? 'border-red-500 bg-red-700/90' : 'border-amber-400 bg-amber-600/90'} max-h-60 overflow-y-auto`}>
          <div className="max-w-7xl mx-auto px-4 py-2 space-y-1.5">
            {visible.map(a => {
              const pt = a.patient;
              const name = pt ? `${pt.first_name} ${pt.last_name || ''}`.trim() : '';
              return (
                <div key={a.id} className="flex items-center justify-between bg-white/10 rounded-lg px-3 py-2">
                  <div className="flex items-center gap-3 flex-1">
                    <span className={`px-1.5 py-0.5 rounded text-[9px] font-bold ${a.severity === 'emergency' ? 'bg-white text-red-700' : 'bg-amber-100 text-amber-800'}`}>
                      {a.severity.toUpperCase()}
                    </span>
                    <div>
                      <div className="text-white text-xs font-semibold">{a.title}</div>
                      <div className="text-white/70 text-[10px]">
                        {name && <span>{name} ({pt?.uhid}) — </span>}
                        {a.description?.substring(0, 100)}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="text-white/50 text-[10px]">{new Date(a.created_at).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}</span>
                    {a.admission_id && <Link href={`/ipd/${a.admission_id}`} className="px-2 py-0.5 bg-white/20 text-white text-[10px] rounded hover:bg-white/30">Open</Link>}
                    <button onClick={() => { onAcknowledge(a.id); setDismissed(prev => new Set([...prev, a.id])); }}
                      className="px-2 py-0.5 bg-white text-red-700 text-[10px] rounded font-medium hover:bg-gray-100">Ack</button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
