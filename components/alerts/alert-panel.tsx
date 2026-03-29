// components/alerts/alert-panel.tsx
// Full alert list with filtering, acknowledge, resolve
'use client';

import React, { useState } from 'react';
import Link from 'next/link';

interface Props {
  alerts: any[];
  loading: boolean;
  onAcknowledge: (alertId: string) => void;
  onResolve: (alertId: string, note: string) => void;
  onRefresh: () => void;
}

const SEV_COLORS: Record<string, string> = {
  emergency: 'bg-red-600 text-white',
  critical: 'bg-red-100 text-red-700',
  warning: 'bg-amber-100 text-amber-700',
  info: 'bg-blue-100 text-blue-700',
};
const SEV_BORDER: Record<string, string> = {
  emergency: 'border-red-400 bg-red-50/50',
  critical: 'border-red-200',
  warning: 'border-amber-200',
  info: 'border-blue-200',
};
const TYPE_LABELS: Record<string, string> = {
  news2_high: 'NEWS2',
  critical_lab: 'Critical Lab',
  vital_abnormal: 'Vital Alert',
  overdue_med: 'Overdue Med',
  deteriorating: 'Deteriorating',
};
const TYPE_ICONS: Record<string, string> = {
  news2_high: '●',
  critical_lab: '',
  vital_abnormal: '',
  overdue_med: '',
  deteriorating: '',
};

export default function AlertPanel({ alerts, loading, onAcknowledge, onResolve, onRefresh }: Props) {
  const [filter, setFilter] = useState<string>('all');
  const [resolveId, setResolveId] = useState<string | null>(null);
  const [resolveNote, setResolveNote] = useState('');

  const filtered = filter === 'all' ? alerts : alerts.filter(a => a.severity === filter || a.alert_type === filter);

  const handleResolve = () => {
    if (!resolveId) return;
    onResolve(resolveId, resolveNote);
    setResolveId(null);
    setResolveNote('');
  };

  if (loading) return <div className="text-center py-8 text-gray-400 text-sm">Loading alerts...</div>;

  return (
    <div className="space-y-3">
      {/* Filter bar */}
      <div className="flex items-center justify-between">
        <div className="flex gap-1">
          {[
            ['all', 'All'],
            ['emergency', 'Emergency'],
            ['critical', 'Critical'],
            ['warning', 'Warning'],
            ['news2_high', 'NEWS2'],
            ['overdue_med', 'Overdue Meds'],
            ['deteriorating', 'Deteriorating'],
          ].map(([k, l]) => (
            <button key={k} onClick={() => setFilter(k)}
              className={`px-2 py-1 text-[10px] rounded border ${filter === k ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-gray-500 border-gray-200'}`}>{l}
              {k !== 'all' && <span className="ml-1 font-bold">{alerts.filter(a => k.includes('_') ? a.alert_type === k : a.severity === k).length || ''}</span>}
            </button>
          ))}
        </div>
        <button onClick={onRefresh} className="px-2 py-1 text-[10px] bg-gray-100 rounded hover:bg-gray-200">Refresh</button>
      </div>

      {/* Resolve modal */}
      {resolveId && (
        <div className="bg-green-50 border border-green-200 rounded-xl p-4">
          <h4 className="text-sm font-semibold text-green-700 mb-2">Resolve Alert</h4>
          <textarea value={resolveNote} onChange={e => setResolveNote(e.target.value)}
            className="w-full px-3 py-2 border border-green-200 rounded-lg text-sm mb-2" rows={2}
            placeholder="Resolution note (optional)..." />
          <div className="flex gap-2">
            <button onClick={handleResolve} className="px-3 py-1.5 bg-green-600 text-white text-xs rounded-lg">Confirm Resolve</button>
            <button onClick={() => { setResolveId(null); setResolveNote(''); }} className="px-3 py-1.5 bg-gray-100 text-gray-600 text-xs rounded-lg">Cancel</button>
          </div>
        </div>
      )}

      {/* Alert list */}
      {filtered.length === 0 ? (
        <div className="text-center py-12 bg-white rounded-xl border text-gray-400 text-sm">No active alerts</div>
      ) : (
        <div className="space-y-2">
          {filtered.map(a => {
            const pt = a.patient;
            const name = pt ? `${pt.first_name} ${pt.last_name || ''}`.trim() : '';
            const age = new Date(a.created_at);
            const minsAgo = Math.round((Date.now() - age.getTime()) / 60000);
            const timeLabel = minsAgo < 60 ? `${minsAgo}m ago` : minsAgo < 1440 ? `${Math.round(minsAgo / 60)}h ago` : `${Math.round(minsAgo / 1440)}d ago`;

            return (
              <div key={a.id} className={`bg-white rounded-xl border p-3 ${SEV_BORDER[a.severity] || ''} ${a.severity === 'emergency' ? 'animate-pulse-subtle' : ''}`}>
                <div className="flex items-start justify-between">
                  <div className="flex items-start gap-2.5 flex-1">
                    <span className="text-xl mt-0.5">{TYPE_ICONS[a.alert_type] || '!'}</span>
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-0.5">
                        <span className={`px-1.5 py-0.5 rounded text-[9px] font-bold ${SEV_COLORS[a.severity]}`}>{a.severity.toUpperCase()}</span>
                        <span className="px-1.5 py-0.5 rounded text-[9px] bg-gray-100 text-gray-600">{TYPE_LABELS[a.alert_type] || a.alert_type}</span>
                        <span className="text-[10px] text-gray-400">{timeLabel}</span>
                      </div>
                      <div className="text-sm font-semibold text-gray-900">{a.title}</div>
                      <div className="text-xs text-gray-500 mt-0.5">{a.description}</div>
                      {name && <div className="text-[10px] text-gray-400 mt-1">{name} ({pt?.uhid})</div>}
                      {a.ack_staff?.full_name && <div className="text-[10px] text-green-600 mt-0.5">Acknowledged by {a.ack_staff.full_name}</div>}
                    </div>
                  </div>
                  <div className="flex flex-col gap-1 ml-2">
                    {a.admission_id && <Link href={`/ipd/${a.admission_id}`} className="px-2 py-1 text-[10px] bg-blue-50 text-blue-700 rounded hover:bg-blue-100 text-center">Chart</Link>}
                    {a.status === 'active' && (
                      <button onClick={() => onAcknowledge(a.id)} className="px-2 py-1 text-[10px] bg-amber-100 text-amber-700 rounded hover:bg-amber-200 font-medium">Ack</button>
                    )}
                    <button onClick={() => setResolveId(a.id)} className="px-2 py-1 text-[10px] bg-green-100 text-green-700 rounded hover:bg-green-200">Resolve</button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
