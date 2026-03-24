// components/patient/journey-timeline.tsx
// Visual timeline of every clinical event for a patient

'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePatientJourney, JOURNEY_TYPE_CONFIG, type JourneyEvent } from '@/lib/patient/journey-timeline-hooks';

function formatDate(ts: string) {
  const d = new Date(ts);
  return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
}

function formatTime(ts: string) {
  return new Date(ts).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });
}

function EventItem({ event, isLast }: { event: JourneyEvent; isLast: boolean }) {
  const config = JOURNEY_TYPE_CONFIG[event.type] || { color: '#64748b', emoji: '·' };
  const isGap = event.type === 'gap';
  const isCritical = event.severity === 'critical';

  return (
    <div className={`relative pl-8 pb-5 ${isLast ? '' : ''}`}>
      {/* Vertical line */}
      {!isLast && (
        <div className={`absolute left-[11px] top-6 bottom-0 w-[2px] ${isGap ? 'border-l-2 border-dashed border-amber-300' : 'bg-gray-200'}`} />
      )}

      {/* Dot */}
      <div
        className={`absolute left-0 top-1 w-6 h-6 rounded-full flex items-center justify-center text-[11px] ${
          isGap ? 'bg-amber-100 border-2 border-dashed border-amber-400' :
          isCritical ? 'bg-red-100 border-2 border-red-400 animate-pulse' :
          'bg-white border-2'
        }`}
        style={{ borderColor: isGap ? undefined : config.color }}
      >
        {config.emoji}
      </div>

      {/* Content */}
      <div className={`rounded-lg p-3 ${
        isGap ? 'bg-amber-50 border border-dashed border-amber-300' :
        isCritical ? 'bg-red-50 border border-red-200' :
        'bg-white border border-gray-100'
      }`}>
        <div className="flex items-center justify-between mb-0.5">
          <span className={`text-xs font-semibold ${
            isGap ? 'text-amber-700' : isCritical ? 'text-red-700' : 'text-gray-800'
          }`}>{event.title}</span>
          <span className="text-[10px] text-gray-400 shrink-0 ml-2">
            {formatTime(event.timestamp)}
          </span>
        </div>
        <p className={`text-[11px] ${isGap ? 'text-amber-600' : 'text-gray-500'} line-clamp-2`}>{event.detail}</p>
        {event.staffName && (
          <p className="text-[10px] text-gray-400 mt-1">by {event.staffName}</p>
        )}
      </div>
    </div>
  );
}

export function PatientJourneyTimeline({
  patientId,
  admissionId,
}: {
  patientId: string;
  admissionId?: string;
}) {
  const { events, loading, gapCount, load } = usePatientJourney(patientId);
  const [filter, setFilter] = useState<string>('all');

  useEffect(() => {
    load(admissionId);
  }, [patientId, admissionId, load]);

  const filtered = filter === 'all'
    ? events
    : filter === 'gaps'
    ? events.filter(e => e.type === 'gap')
    : events.filter(e => e.type === filter);

  // Group by date
  const grouped: Record<string, JourneyEvent[]> = {};
  filtered.forEach(e => {
    const date = formatDate(e.timestamp);
    if (!grouped[date]) grouped[date] = [];
    grouped[date].push(e);
  });

  const types = [...new Set(events.map(e => e.type))];

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="text-sm font-bold text-gray-800">Patient Journey Timeline</h3>
          <p className="text-[10px] text-gray-400">
            {events.length} events
            {gapCount > 0 && <span className="text-amber-600 font-semibold ml-1">· {gapCount} gap{gapCount > 1 ? 's' : ''} detected</span>}
          </p>
        </div>
        <button onClick={() => load(admissionId)} disabled={loading}
          className="px-3 py-1.5 text-[10px] font-medium bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors disabled:opacity-50">
          {loading ? 'Loading...' : '↻ Refresh'}
        </button>
      </div>

      {/* Filters */}
      <div className="flex gap-1.5 overflow-x-auto pb-2 mb-3 scrollbar-hide">
        <button onClick={() => setFilter('all')}
          className={`px-2.5 py-1 text-[10px] font-medium rounded-lg shrink-0 ${filter === 'all' ? 'bg-teal-600 text-white' : 'bg-gray-100 text-gray-500'}`}>
          All ({events.length})
        </button>
        {gapCount > 0 && (
          <button onClick={() => setFilter('gaps')}
            className={`px-2.5 py-1 text-[10px] font-medium rounded-lg shrink-0 ${filter === 'gaps' ? 'bg-amber-600 text-white' : 'bg-amber-50 text-amber-700'}`}>
            Gaps ({gapCount})
          </button>
        )}
        {types.filter(t => t !== 'gap').slice(0, 8).map(type => {
          const cfg = JOURNEY_TYPE_CONFIG[type];
          const count = events.filter(e => e.type === type).length;
          return (
            <button key={type} onClick={() => setFilter(filter === type ? 'all' : type)}
              className={`px-2.5 py-1 text-[10px] font-medium rounded-lg shrink-0 ${filter === type ? 'bg-teal-600 text-white' : 'bg-gray-100 text-gray-500'}`}>
              {cfg?.emoji} {type.replace(/_/g, ' ')} ({count})
            </button>
          );
        })}
      </div>

      {/* Timeline */}
      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3, 4].map(i => <div key={i} className="h-16 bg-gray-100 rounded-lg animate-pulse" />)}
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-12 bg-gray-50 rounded-xl text-sm text-gray-400">No events found</div>
      ) : (
        <div>
          {Object.entries(grouped).map(([date, dayEvents]) => (
            <div key={date} className="mb-4">
              <div className="sticky top-0 z-10 bg-gray-50/95 backdrop-blur-sm px-2 py-1 rounded-lg mb-2">
                <span className="text-[10px] font-bold text-gray-500 uppercase tracking-wider">{date}</span>
                <span className="text-[10px] text-gray-400 ml-2">{dayEvents.length} events</span>
              </div>
              {dayEvents.map((event, idx) => (
                <EventItem key={event.id} event={event} isLast={idx === dayEvents.length - 1} />
              ))}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
