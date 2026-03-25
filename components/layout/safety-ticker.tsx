// components/layout/safety-ticker.tsx
// Persistent clinical safety bar — shows critical items across the centre
// Visible at top of every dashboard page, auto-refreshes every 30s

'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useAuthStore } from '@/lib/store/auth';
import { useSafetyTicker, type TickerItem } from '@/lib/alerts/safety-ticker-hooks';
import { X, ChevronDown, ChevronUp } from 'lucide-react';

const TYPE_CONFIG: Record<string, { emoji: string; label: string; bg: string; text: string; pulse?: boolean }> = {
  critical_lab: { emoji: '🔴', label: 'Critical Labs', bg: 'bg-red-900/80', text: 'text-red-200', pulse: true },
  overdue_med: { emoji: '⚠️', label: 'Overdue Meds', bg: 'bg-amber-900/70', text: 'text-amber-200' },
  news2_high: { emoji: '📉', label: 'NEWS2 High', bg: 'bg-purple-900/70', text: 'text-purple-200', pulse: true },
  pending_discharge: { emoji: '🛏️', label: 'Pending Disch', bg: 'bg-teal-900/60', text: 'text-teal-200' },
  nurse_call: { emoji: '🔔', label: 'Nurse Calls', bg: 'bg-blue-900/60', text: 'text-blue-200' },
  vital_abnormal: { emoji: '💓', label: 'Vitals Alert', bg: 'bg-orange-900/70', text: 'text-orange-200', pulse: true },
};

function TickerItemRow({ item, onAcknowledge }: { item: TickerItem; onAcknowledge?: (id: string) => void }) {
  const config = TYPE_CONFIG[item.type] || { emoji: '⚡', label: item.type, bg: 'bg-gray-800', text: 'text-gray-200' };
  return (
    <div className="flex items-center gap-3 px-3 py-2 hover:bg-white/5 rounded-lg transition-colors">
      <Link href={item.action} className="flex items-center gap-3 flex-1 min-w-0">
        <span className="text-sm">{config.emoji}</span>
        <div className="flex-1 min-w-0">
          <span className="text-xs font-semibold text-white">{item.patientName}</span>
          {item.bedLabel && <span className="text-[10px] text-gray-400 ml-1.5">Bed {item.bedLabel}</span>}
          <div className="text-[10px] text-gray-400 truncate">{item.title} — {item.detail}</div>
        </div>
      </Link>
      <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded shrink-0 ${
        item.severity === 'critical' ? 'bg-red-600 text-white' : item.severity === 'high' ? 'bg-amber-600 text-white' : 'bg-gray-600 text-gray-200'
      }`}>{item.severity.toUpperCase()}</span>
      {onAcknowledge && item.id.startsWith('alert-') && (
        <button onClick={() => onAcknowledge(item.id.replace('alert-', ''))}
          className="text-[9px] px-2 py-1 bg-white/10 hover:bg-white/20 text-white rounded shrink-0 transition-colors">Ack</button>
      )}
    </div>
  );
}

export function SafetyTicker() {
  const { staff, activeCentreId } = useAuthStore();
  const { items, counts, loading, refresh } = useSafetyTicker(activeCentreId || null, staff?.staff_type || null);
  const [expanded, setExpanded] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  const handleAcknowledge = async (alertId: string) => {
    const { acknowledgeAlert } = await import('@/lib/bridge/clinical-event-bridge');
    await acknowledgeAlert(alertId, staff?.id || '');
    refresh();
  };

  // Don't show if no items or dismissed or loading
  if (dismissed || loading || counts.total === 0) return null;

  // Only show for clinical roles
  const clinicalRoles = ['doctor', 'consultant', 'nurse', 'admin'];
  if (staff?.staff_type && !clinicalRoles.includes(staff.staff_type)) return null;

  const criticalCount = items.filter(i => i.severity === 'critical').length;
  const hasCritical = criticalCount > 0;

  return (
    <div className={`${hasCritical ? 'bg-gradient-to-r from-red-950 via-red-900/90 to-red-950' : 'bg-gradient-to-r from-gray-900 via-gray-800 to-gray-900'} border-b ${hasCritical ? 'border-red-800' : 'border-gray-700'} relative`}>
      {/* Compact bar */}
      <div className="flex items-center gap-2 px-4 py-1.5 overflow-x-auto scrollbar-hide">
        {/* Pulse indicator */}
        {hasCritical && <div className="w-2 h-2 bg-red-500 rounded-full animate-pulse shrink-0" />}

        {/* Counts */}
        {counts.criticalLabs > 0 && (
          <button onClick={() => setExpanded(!expanded)} className="flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-red-900/80 text-red-200 text-[11px] font-semibold hover:bg-red-800/80 transition-colors shrink-0">
            <span>🔴</span> {counts.criticalLabs} Critical Lab{counts.criticalLabs > 1 ? 's' : ''}
          </button>
        )}
        {counts.overdueMeds > 0 && (
          <button onClick={() => setExpanded(!expanded)} className="flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-amber-900/70 text-amber-200 text-[11px] font-semibold hover:bg-amber-800/70 transition-colors shrink-0">
            <span>⚠️</span> {counts.overdueMeds} Overdue Med{counts.overdueMeds > 1 ? 's' : ''}
          </button>
        )}
        {counts.news2High > 0 && (
          <button onClick={() => setExpanded(!expanded)} className="flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-purple-900/70 text-purple-200 text-[11px] font-semibold hover:bg-purple-800/70 transition-colors shrink-0">
            <span>📉</span> {counts.news2High} NEWS2 &gt;7
          </button>
        )}
        {counts.nurseCalls > 0 && (
          <button onClick={() => setExpanded(!expanded)} className="flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-blue-900/60 text-blue-200 text-[11px] font-semibold hover:bg-blue-800/60 transition-colors shrink-0">
            <span>🔔</span> {counts.nurseCalls} Nurse Call{counts.nurseCalls > 1 ? 's' : ''}
          </button>
        )}
        {counts.pendingDischarge > 0 && (
          <button onClick={() => setExpanded(!expanded)} className="flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-teal-900/60 text-teal-200 text-[11px] font-semibold hover:bg-teal-800/60 transition-colors shrink-0">
            <span>🛏️</span> {counts.pendingDischarge} Disch Pending
          </button>
        )}

        {/* Spacer */}
        <div className="flex-1" />

        {/* Expand/collapse */}
        <button onClick={() => setExpanded(!expanded)} className="text-gray-400 hover:text-white p-1 transition-colors shrink-0">
          {expanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
        </button>
        <button onClick={() => setDismissed(true)} className="text-gray-500 hover:text-gray-300 p-1 transition-colors shrink-0" title="Dismiss (reappears on next refresh)">
          <X size={12} />
        </button>
      </div>

      {/* Expanded detail panel */}
      {expanded && (
        <div className="border-t border-white/10 max-h-[300px] overflow-y-auto">
          <div className="px-3 py-2 space-y-0.5">
            {items.slice(0, 20).map(item => <TickerItemRow key={item.id} item={item} onAcknowledge={handleAcknowledge} />)}
          </div>
        </div>
      )}
    </div>
  );
}
