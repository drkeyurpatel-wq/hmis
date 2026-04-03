'use client';
import React, { useState, useEffect, useMemo } from 'react';
import { RoleGuard } from '@/components/ui/shared';
import { useAuthStore } from '@/lib/store/auth';
import { useOTGaps } from '@/lib/ot/ot-command-hooks';
import Link from 'next/link';
import { ArrowLeft, AlertTriangle } from 'lucide-react';

const HOUR_START = 7; // 7 AM
const HOUR_END = 21;  // 9 PM
const TOTAL_HOURS = HOUR_END - HOUR_START;
const SURGEON_COLORS = ['#3b82f6', '#8b5cf6', '#f59e0b', '#ef4444', '#06b6d4', '#ec4899', '#10b981', '#f97316', '#6366f1', '#14b8a6'];

function TomorrowInner() {
  const { activeCentreId } = useAuthStore();
  const centreId = activeCentreId || '';
  const { gaps, scheduleBookings, loading, load } = useOTGaps(centreId);

  const tomorrow = new Date(Date.now() + 86400000).toISOString().split('T')[0];
  const [targetDate, setTargetDate] = useState(tomorrow);

  useEffect(() => { load(targetDate); }, [targetDate, centreId, load]);

  // Build surgeon color map
  const surgeonColorMap = useMemo(() => {
    const map = new Map<string, string>();
    const surgeons = [...new Set(scheduleBookings.map(b => b.surgeon_id).filter(Boolean))];
    surgeons.forEach((id, i) => map.set(id, SURGEON_COLORS[i % SURGEON_COLORS.length]));
    return map;
  }, [scheduleBookings]);

  // Group bookings by room for gantt
  const roomBookings = useMemo(() => {
    const map = new Map<string, { roomName: string; bookings: any[] }>();
    gaps.forEach(g => {
      if (!map.has(g.ot_room_id)) map.set(g.ot_room_id, { roomName: g.ot_room_name, bookings: [] });
    });
    scheduleBookings.forEach(b => {
      const entry = map.get(b.ot_room_id);
      if (entry) entry.bookings.push(b);
    });
    return Array.from(map.entries());
  }, [gaps, scheduleBookings]);

  // Convert time string "HH:MM" to percentage offset on the timeline
  const timeToPercent = (time: string) => {
    if (!time) return 0;
    const [h, m] = time.split(':').map(Number);
    const hours = h + m / 60 - HOUR_START;
    return Math.max(0, Math.min(100, (hours / TOTAL_HOURS) * 100));
  };

  const durationToPercent = (minutes: number) => {
    return Math.max(0.5, (minutes / 60 / TOTAL_HOURS) * 100);
  };

  // Gap alerts
  const gapAlerts = gaps.filter(g => g.has_gap_over_60 || g.gap_minutes > 120);

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Link href="/ot-command" className="p-2 rounded-lg hover:bg-gray-100 cursor-pointer transition-colors duration-200">
          <ArrowLeft className="w-5 h-5 text-gray-600" />
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Schedule &amp; Gap Analysis</h1>
          <p className="text-sm text-gray-500 mt-0.5">Visual timeline with idle slot detection</p>
        </div>
      </div>

      <div className="flex items-center gap-3 flex-wrap">
        <label className="text-sm text-gray-600">Date</label>
        <input type="date" value={targetDate} onChange={e => setTargetDate(e.target.value)}
          className="border rounded-lg px-3 py-1.5 text-sm" />
        <button onClick={() => setTargetDate(tomorrow)}
          className="px-3 py-1.5 text-sm bg-blue-50 text-blue-700 rounded-lg cursor-pointer hover:bg-blue-100 transition-colors duration-200">
          Tomorrow
        </button>
        <button onClick={() => setTargetDate(new Date().toISOString().split('T')[0])}
          className="px-3 py-1.5 text-sm bg-gray-100 text-gray-700 rounded-lg cursor-pointer hover:bg-gray-200 transition-colors duration-200">
          Today
        </button>
      </div>

      {/* Gap Alerts */}
      {gapAlerts.length > 0 && (
        <div className="space-y-2">
          {gapAlerts.map(g => (
            <div key={g.ot_room_id} className="flex items-start gap-3 bg-amber-50 border border-amber-200 rounded-xl p-4">
              <AlertTriangle className="w-5 h-5 text-amber-600 mt-0.5 shrink-0" />
              <div className="flex-1">
                <p className="text-sm font-medium text-amber-800">
                  {g.ot_room_name} has {Math.floor(g.gap_minutes / 60)}h {g.gap_minutes % 60}m of idle time
                  ({g.gap_pct}% unused)
                </p>
                <p className="text-xs text-amber-600 mt-0.5">
                  {g.scheduled_cases} cases scheduled ({g.total_scheduled_minutes} min).
                  {g.first_case_time && ` First case: ${g.first_case_time}.`}
                  {g.has_gap_over_60 && ' Contains gap over 60 minutes between cases.'}
                </p>
              </div>
              <Link href="/ot" className="text-xs text-blue-600 hover:text-blue-800 cursor-pointer whitespace-nowrap">
                Schedule Case
              </Link>
            </div>
          ))}
        </div>
      )}

      {/* Summary Cards */}
      {loading ? (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map(i => (
            <div key={i} className="bg-white rounded-xl border p-4 animate-pulse">
              <div className="h-4 bg-gray-200 rounded w-1/2 mb-2" />
              <div className="h-6 bg-gray-100 rounded w-1/3" />
            </div>
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="bg-white rounded-xl border shadow-sm p-4">
            <p className="text-xs text-gray-500">Total Cases</p>
            <p className="text-2xl font-bold text-gray-900">{gaps.reduce((s, g) => s + g.scheduled_cases, 0)}</p>
          </div>
          <div className="bg-white rounded-xl border shadow-sm p-4">
            <p className="text-xs text-gray-500">Active OT Rooms</p>
            <p className="text-2xl font-bold text-gray-900">{gaps.filter(g => g.scheduled_cases > 0).length} / {gaps.length}</p>
          </div>
          <div className="bg-white rounded-xl border shadow-sm p-4">
            <p className="text-xs text-gray-500">Total Gap Time</p>
            <p className="text-2xl font-bold text-amber-600">{Math.round(gaps.reduce((s, g) => s + g.gap_minutes, 0) / 60)}h</p>
          </div>
          <div className="bg-white rounded-xl border shadow-sm p-4">
            <p className="text-xs text-gray-500">Rooms with &gt;60m Gap</p>
            <p className="text-2xl font-bold text-red-600">{gaps.filter(g => g.has_gap_over_60).length}</p>
          </div>
        </div>
      )}

      {/* Gantt Timeline */}
      <div className="bg-white rounded-xl border shadow-sm p-5">
        <h3 className="font-semibold text-gray-900 mb-4">Visual Timeline</h3>
        <div className="overflow-x-auto">
          <div className="min-w-[800px]">
            {/* Time axis */}
            <div className="flex items-center mb-2 ml-28">
              {Array.from({ length: TOTAL_HOURS + 1 }, (_, i) => i + HOUR_START).map(h => (
                <div key={h} className="text-xs text-gray-400" style={{ width: `${100 / TOTAL_HOURS}%` }}>
                  {h <= 12 ? `${h}AM` : h === 12 ? '12PM' : `${h - 12}PM`}
                </div>
              ))}
            </div>

            {/* Room rows */}
            {roomBookings.map(([roomId, data]) => {
              const gapData = gaps.find(g => g.ot_room_id === roomId);
              return (
                <div key={roomId} className="flex items-center mb-2 group">
                  <div className="w-28 shrink-0 text-xs font-medium text-gray-700 pr-2 truncate" title={data.roomName}>
                    {data.roomName}
                  </div>
                  <div className="flex-1 h-10 bg-gray-50 rounded relative border border-gray-100">
                    {/* Grid lines */}
                    {Array.from({ length: TOTAL_HOURS }, (_, i) => (
                      <div key={i} className="absolute top-0 bottom-0 border-l border-gray-100"
                        style={{ left: `${((i + 1) / TOTAL_HOURS) * 100}%` }} />
                    ))}

                    {/* Case blocks */}
                    {data.bookings.map((b: any) => {
                      const left = timeToPercent(b.scheduled_start);
                      const width = durationToPercent(b.estimated_duration_min || 60);
                      const color = surgeonColorMap.get(b.surgeon_id) || '#94a3b8';
                      const patientName = b.patient?.patient
                        ? `${b.patient.patient.first_name} ${b.patient.patient.last_name}`
                        : '';
                      return (
                        <div key={b.id}
                          className="absolute top-1 bottom-1 rounded cursor-pointer transition-opacity duration-150 hover:opacity-80 overflow-hidden"
                          style={{ left: `${left}%`, width: `${width}%`, backgroundColor: color }}
                          title={`${b.scheduled_start} — ${b.procedure_name}\n${b.surgeon?.full_name || ''}\n${patientName}\n${b.estimated_duration_min}min`}>
                          <span className="text-[9px] text-white font-medium px-1 leading-tight block truncate mt-0.5">
                            {b.procedure_name}
                          </span>
                          <span className="text-[8px] text-white/80 px-1 block truncate">
                            {b.surgeon?.full_name || ''}
                          </span>
                        </div>
                      );
                    })}

                    {/* No cases placeholder */}
                    {data.bookings.length === 0 && (
                      <div className="absolute inset-0 flex items-center justify-center text-xs text-gray-300">
                        No cases scheduled
                      </div>
                    )}
                  </div>
                  <div className="w-16 shrink-0 text-right text-xs text-gray-500 pl-2">
                    {gapData ? `${gapData.gap_pct}% gap` : ''}
                  </div>
                </div>
              );
            })}

            {!roomBookings.length && !loading && (
              <p className="text-sm text-gray-400 text-center py-8">No OT rooms found for this centre</p>
            )}
          </div>
        </div>

        {/* Surgeon Legend */}
        {scheduleBookings.length > 0 && (
          <div className="flex flex-wrap gap-3 mt-4 pt-3 border-t">
            {[...new Map(scheduleBookings.map(b => [b.surgeon_id, b.surgeon?.full_name || 'Unknown']))].map(([id, name]) => (
              <span key={id} className="inline-flex items-center gap-1.5 text-xs text-gray-600">
                <span className="w-3 h-3 rounded" style={{ backgroundColor: surgeonColorMap.get(id) || '#94a3b8' }} />
                {name}
              </span>
            ))}
          </div>
        )}
      </div>

      {/* Room Gap Details Table */}
      <div className="bg-white rounded-xl border shadow-sm overflow-hidden">
        <div className="p-4 border-b">
          <h3 className="font-semibold text-gray-900">Room Gap Details</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50">
                <th className="text-left p-3 font-medium text-gray-600">OT Room</th>
                <th className="text-right p-3 font-medium text-gray-600">Cases</th>
                <th className="text-right p-3 font-medium text-gray-600">Scheduled (min)</th>
                <th className="text-right p-3 font-medium text-gray-600">Available (min)</th>
                <th className="text-right p-3 font-medium text-gray-600">Gap (min)</th>
                <th className="text-right p-3 font-medium text-gray-600">Gap %</th>
                <th className="text-right p-3 font-medium text-gray-600">First Case</th>
                <th className="text-right p-3 font-medium text-gray-600">Last End</th>
                <th className="text-center p-3 font-medium text-gray-600">&gt;60m Gap</th>
              </tr>
            </thead>
            <tbody>
              {gaps.map((g: any) => (
                <tr key={g.ot_room_id} className="border-t hover:bg-gray-50 transition-colors duration-150">
                  <td className="p-3 font-medium text-gray-900">{g.ot_room_name}</td>
                  <td className="p-3 text-right">{g.scheduled_cases}</td>
                  <td className="p-3 text-right">{g.total_scheduled_minutes}</td>
                  <td className="p-3 text-right">{g.available_minutes}</td>
                  <td className="p-3 text-right">
                    <span className={g.gap_minutes > 120 ? 'text-red-600 font-medium' : g.gap_minutes > 60 ? 'text-amber-600' : 'text-green-700'}>
                      {g.gap_minutes}
                    </span>
                  </td>
                  <td className="p-3 text-right">{g.gap_pct}%</td>
                  <td className="p-3 text-right text-gray-500">{g.first_case_time || '—'}</td>
                  <td className="p-3 text-right text-gray-500">{g.last_case_end_time || '—'}</td>
                  <td className="p-3 text-center">
                    {g.has_gap_over_60
                      ? <span className="text-red-600 font-medium">Yes</span>
                      : <span className="text-green-700">No</span>}
                  </td>
                </tr>
              ))}
              {!gaps.length && (
                <tr><td colSpan={9} className="p-8 text-center text-gray-400">No data available</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

export default function TomorrowPage() {
  return <RoleGuard module="ot"><TomorrowInner /></RoleGuard>;
}
