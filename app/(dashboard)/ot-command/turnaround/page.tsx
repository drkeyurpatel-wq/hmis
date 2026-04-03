'use client';
import React, { useState, useEffect } from 'react';
import { RoleGuard } from '@/components/ui/shared';
import { useAuthStore } from '@/lib/store/auth';
import { useTurnaroundAnalysis } from '@/lib/ot/ot-command-hooks';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  ResponsiveContainer,
} from 'recharts';

const PHASE_COLORS: Record<string, string> = {
  cleaning: '#f59e0b',
  waiting: '#94a3b8',
  anaesSetup: '#8b5cf6',
  toIncision: '#3b82f6',
};

const PHASE_LABELS: Record<string, string> = {
  cleaning: 'Room Cleaning',
  waiting: 'Waiting for Patient',
  anaesSetup: 'Anaesthesia Setup',
  toIncision: 'To Incision',
};

function TurnaroundInner() {
  const { activeCentreId } = useAuthStore();
  const centreId = activeCentreId || '';
  const ta = useTurnaroundAnalysis(centreId);

  const today = new Date().toISOString().split('T')[0];
  const [dateFrom, setDateFrom] = useState(() => {
    const d = new Date(); d.setDate(d.getDate() - 30);
    return d.toISOString().split('T')[0];
  });
  const [dateTo, setDateTo] = useState(today);
  const [targetMin, setTargetMin] = useState(30);

  useEffect(() => { ta.load(dateFrom, dateTo); }, [dateFrom, dateTo, centreId, ta.load]);

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Link href="/ot-command" className="p-2 rounded-lg hover:bg-gray-100 cursor-pointer transition-colors duration-200">
          <ArrowLeft className="w-5 h-5 text-gray-600" />
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Turnaround Time Analysis</h1>
          <p className="text-sm text-gray-500 mt-0.5">Breakdown of time between consecutive OT cases</p>
        </div>
      </div>

      <div className="flex items-center gap-3 flex-wrap">
        <label className="text-sm text-gray-600">From</label>
        <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)}
          className="border rounded-lg px-3 py-1.5 text-sm" />
        <label className="text-sm text-gray-600">To</label>
        <input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)}
          className="border rounded-lg px-3 py-1.5 text-sm" />
        <label className="text-sm text-gray-600 ml-4">Target (min)</label>
        <input type="number" value={targetMin} onChange={e => setTargetMin(Number(e.target.value))}
          className="border rounded-lg px-3 py-1.5 text-sm w-20" min={10} max={120} />
      </div>

      {ta.loading ? (
        <div className="space-y-4">
          {[1, 2, 3].map(i => (
            <div key={i} className="bg-white rounded-xl border p-6 animate-pulse">
              <div className="h-5 bg-gray-200 rounded w-1/3 mb-4" />
              <div className="h-48 bg-gray-100 rounded" />
            </div>
          ))}
        </div>
      ) : (
        <>
          {/* Summary Cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="bg-white rounded-xl border shadow-sm p-4">
              <p className="text-xs text-gray-500">Total Turnovers</p>
              <p className="text-2xl font-bold text-gray-900">{ta.turnaroundPhases.length}</p>
            </div>
            <div className="bg-white rounded-xl border shadow-sm p-4">
              <p className="text-xs text-gray-500">Avg Turnaround</p>
              <p className="text-2xl font-bold text-gray-900">
                {ta.turnaroundPhases.length
                  ? Math.round(ta.turnaroundPhases.reduce((s, p) => s + p.total, 0) / ta.turnaroundPhases.length)
                  : 0} min
              </p>
            </div>
            <div className="bg-white rounded-xl border shadow-sm p-4">
              <p className="text-xs text-gray-500">Within Target</p>
              <p className="text-2xl font-bold text-green-700">
                {ta.turnaroundPhases.filter(p => p.total <= targetMin).length}
                <span className="text-sm font-normal text-gray-400">
                  {' '}/ {ta.turnaroundPhases.length}
                </span>
              </p>
            </div>
            <div className="bg-white rounded-xl border shadow-sm p-4">
              <p className="text-xs text-gray-500">Over Target</p>
              <p className="text-2xl font-bold text-red-600">
                {ta.turnaroundPhases.filter(p => p.total > targetMin).length}
              </p>
            </div>
          </div>

          {/* By Room — Stacked Bar Chart */}
          {ta.avgByRoom.length > 0 && (
            <div className="bg-white rounded-xl border shadow-sm p-5">
              <h3 className="font-semibold text-gray-900 mb-4">Average Turnaround by OT Room</h3>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={ta.avgByRoom}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                  <XAxis dataKey="roomName" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} unit=" min" />
                  <Tooltip contentStyle={{ fontSize: 11, borderRadius: 8 }} />
                  <Legend wrapperStyle={{ fontSize: 11 }} />
                  <Bar dataKey="avgCleaning" stackId="a" fill={PHASE_COLORS.cleaning} name={PHASE_LABELS.cleaning} radius={[0, 0, 0, 0]} />
                  <Bar dataKey="avgWaiting" stackId="a" fill={PHASE_COLORS.waiting} name={PHASE_LABELS.waiting} />
                  <Bar dataKey="avgAnaes" stackId="a" fill={PHASE_COLORS.anaesSetup} name={PHASE_LABELS.anaesSetup} />
                  <Bar dataKey="avgIncision" stackId="a" fill={PHASE_COLORS.toIncision} name={PHASE_LABELS.toIncision} radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
              <div className="mt-2 text-xs text-gray-400 text-center">
                Target turnaround: {targetMin} min
              </div>
            </div>
          )}

          {/* By Day of Week */}
          {ta.avgByDayOfWeek.length > 0 && (
            <div className="bg-white rounded-xl border shadow-sm p-5">
              <h3 className="font-semibold text-gray-900 mb-4">Average Turnaround by Day of Week</h3>
              <ResponsiveContainer width="100%" height={250}>
                <BarChart data={ta.avgByDayOfWeek}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                  <XAxis dataKey="day" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} unit=" min" />
                  <Tooltip contentStyle={{ fontSize: 11, borderRadius: 8 }}
                    formatter={(value: number) => [`${value} min`, 'Avg Turnaround']} />
                  <Bar dataKey="avg" fill="#3b82f6" radius={[4, 4, 0, 0]} name="Avg Turnaround">
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}

          {/* By Surgeon */}
          {ta.avgBySurgeon.length > 0 && (
            <div className="bg-white rounded-xl border shadow-sm p-5">
              <h3 className="font-semibold text-gray-900 mb-4">Average Turnaround by Surgeon</h3>
              <ResponsiveContainer width="100%" height={Math.max(200, ta.avgBySurgeon.length * 35)}>
                <BarChart data={ta.avgBySurgeon} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                  <XAxis type="number" tick={{ fontSize: 11 }} unit=" min" />
                  <YAxis type="category" dataKey="surgeonName" tick={{ fontSize: 10 }} width={140} />
                  <Tooltip contentStyle={{ fontSize: 11, borderRadius: 8 }}
                    formatter={(value: number) => [`${value} min`, 'Avg Turnaround']} />
                  <Bar dataKey="avg" fill="#8b5cf6" radius={[0, 4, 4, 0]} name="Avg Turnaround" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}

          {/* Detailed Phase Table */}
          {ta.turnaroundPhases.length > 0 && (
            <div className="bg-white rounded-xl border shadow-sm overflow-hidden">
              <div className="p-4 border-b flex items-center justify-between">
                <h3 className="font-semibold text-gray-900">Individual Turnaround Details</h3>
                <span className="text-xs text-gray-400">{ta.turnaroundPhases.length} turnovers</span>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-gray-50">
                      <th className="text-left p-3 font-medium text-gray-600">Date</th>
                      <th className="text-left p-3 font-medium text-gray-600">OT Room</th>
                      <th className="text-left p-3 font-medium text-gray-600">Surgeon</th>
                      <th className="text-right p-3 font-medium text-gray-600">Total (min)</th>
                      <th className="text-right p-3 font-medium text-gray-600">Cleaning</th>
                      <th className="text-right p-3 font-medium text-gray-600">Waiting</th>
                      <th className="text-right p-3 font-medium text-gray-600">Anaes Setup</th>
                      <th className="text-right p-3 font-medium text-gray-600">To Incision</th>
                      <th className="p-3 font-medium text-gray-600">Phase Breakdown</th>
                    </tr>
                  </thead>
                  <tbody>
                    {ta.turnaroundPhases.slice(0, 100).map((p, i) => {
                      const total = p.total || 1;
                      return (
                        <tr key={i} className={`border-t transition-colors duration-150 ${p.total > targetMin ? 'bg-red-50/50' : 'hover:bg-gray-50'}`}>
                          <td className="p-3 text-gray-600">{p.date}</td>
                          <td className="p-3 text-gray-900">{p.roomName}</td>
                          <td className="p-3 text-gray-700">{p.surgeonName}</td>
                          <td className="p-3 text-right font-medium">
                            <span className={p.total > targetMin ? 'text-red-600' : 'text-green-700'}>{p.total}</span>
                          </td>
                          <td className="p-3 text-right text-gray-500">{p.cleaning || '—'}</td>
                          <td className="p-3 text-right text-gray-500">{p.waiting || '—'}</td>
                          <td className="p-3 text-right text-gray-500">{p.anaesSetup || '—'}</td>
                          <td className="p-3 text-right text-gray-500">{p.toIncision || '—'}</td>
                          <td className="p-3">
                            <div className="flex h-4 rounded-full overflow-hidden bg-gray-100 min-w-[120px]">
                              {p.cleaning > 0 && (
                                <div style={{ width: `${(p.cleaning / total) * 100}%`, backgroundColor: PHASE_COLORS.cleaning }}
                                  title={`Cleaning: ${p.cleaning}min`} />
                              )}
                              {p.waiting > 0 && (
                                <div style={{ width: `${(p.waiting / total) * 100}%`, backgroundColor: PHASE_COLORS.waiting }}
                                  title={`Waiting: ${p.waiting}min`} />
                              )}
                              {p.anaesSetup > 0 && (
                                <div style={{ width: `${(p.anaesSetup / total) * 100}%`, backgroundColor: PHASE_COLORS.anaesSetup }}
                                  title={`Anaes: ${p.anaesSetup}min`} />
                              )}
                              {p.toIncision > 0 && (
                                <div style={{ width: `${(p.toIncision / total) * 100}%`, backgroundColor: PHASE_COLORS.toIncision }}
                                  title={`To Incision: ${p.toIncision}min`} />
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
                {ta.turnaroundPhases.length > 100 && (
                  <div className="p-3 text-center text-xs text-gray-400 border-t">
                    Showing 100 of {ta.turnaroundPhases.length} turnovers
                  </div>
                )}
              </div>
            </div>
          )}

          {!ta.turnaroundPhases.length && !ta.loading && (
            <div className="bg-white rounded-xl border shadow-sm p-12 text-center">
              <p className="text-gray-400">No turnaround data for selected period.</p>
              <p className="text-xs text-gray-300 mt-1">Turnaround phases require patient_in_time, patient_out_time, and other timestamps to be recorded on completed OT bookings.</p>
            </div>
          )}
        </>
      )}
    </div>
  );
}

export default function TurnaroundPage() {
  return <RoleGuard module="ot"><TurnaroundInner /></RoleGuard>;
}
