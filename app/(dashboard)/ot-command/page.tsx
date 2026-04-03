'use client';
import React, { useState, useEffect, useMemo } from 'react';
import { RoleGuard } from '@/components/ui/shared';
import { useAuthStore } from '@/lib/store/auth';
import { useOTLiveStatus, useOTCommandDashboard } from '@/lib/ot/ot-command-hooks';
import Link from 'next/link';
import {
  BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid,
  Tooltip, Legend, ResponsiveContainer, PieChart, Pie, Cell,
} from 'recharts';
import {
  AlertTriangle, CheckCircle, Clock, XCircle,
  TrendingUp, Calendar, RefreshCw,
} from 'lucide-react';

const STATUS_COLORS: Record<string, string> = {
  in_use: '#ef4444', ready: '#22c55e', cleaning: '#eab308', not_scheduled: '#9ca3af',
};
const STATUS_LABELS: Record<string, string> = {
  in_use: 'In Use', ready: 'Ready', cleaning: 'Cleaning', not_scheduled: 'Not Scheduled',
};
const CHART_COLORS = ['#3b82f6', '#8b5cf6', '#f59e0b', '#ef4444', '#06b6d4', '#ec4899', '#10b981', '#f97316'];

const DELAY_LABELS: Record<string, string> = {
  surgeon_late: 'Surgeon Late', patient_not_ready: 'Patient Not Ready',
  anaesthesia_delay: 'Anaesthesia Delay', equipment_issue: 'Equipment Issue',
  previous_case_overrun: 'Previous Overrun', consent_pending: 'Consent Pending',
  lab_pending: 'Lab Pending', blood_not_ready: 'Blood Not Ready',
  ot_cleaning: 'OT Cleaning', emergency_bumped: 'Emergency Bumped',
  patient_cancelled: 'Patient Cancelled', other: 'Other', unknown: 'Unknown',
};

function getUtilColor(pct: number) {
  if (pct >= 80) return '#22c55e';
  if (pct >= 60) return '#84cc16';
  if (pct >= 40) return '#eab308';
  return '#ef4444';
}

function OTCommandInner() {
  const { staff, activeCentreId } = useAuthStore();
  const centreId = activeCentreId || '';
  const live = useOTLiveStatus(centreId);
  const dash = useOTCommandDashboard(centreId);

  const today = new Date().toISOString().split('T')[0];
  const [dateFrom, setDateFrom] = useState(() => {
    const d = new Date(); d.setDate(d.getDate() - 30);
    return d.toISOString().split('T')[0];
  });
  const [dateTo, setDateTo] = useState(today);
  const [activeTab, setActiveTab] = useState<'live' | 'analytics'>('live');

  useEffect(() => {
    dash.loadAll(dateFrom, dateTo);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dateFrom, dateTo, centreId]);

  // Room names for trend chart
  const roomNames = useMemo(() => {
    if (!dash.trendData.length) return [];
    const sample = dash.trendData[0];
    return Object.keys(sample).filter(k => k !== 'date');
  }, [dash.trendData]);

  // Heatmap grouped by room
  const heatmapByRoom = useMemo(() => {
    const map = new Map<string, { roomName: string; days: { date: string; utilization: number; cases: number }[] }>();
    dash.dashData.forEach(d => {
      if (!map.has(d.ot_room_id)) map.set(d.ot_room_id, { roomName: d.ot_room_name, days: [] });
    });
    dash.heatmapData.forEach(h => {
      const room = map.get(h.roomId);
      if (room) room.days.push({ date: h.date, utilization: h.utilization, cases: h.cases });
    });
    return Array.from(map.values());
  }, [dash.dashData, dash.heatmapData]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">OT Command Centre</h1>
          <p className="text-sm text-gray-500 mt-1">Real-time OT utilization, analytics and optimization</p>
        </div>
        <div className="flex items-center gap-2">
          <Link href="/ot" className="text-sm text-blue-600 hover:text-blue-800 cursor-pointer">
            OT Schedule
          </Link>
          <span className="text-gray-300">|</span>
          <Link href="/ot-command/surgeons" className="text-sm text-blue-600 hover:text-blue-800 cursor-pointer">
            Surgeons
          </Link>
          <span className="text-gray-300">|</span>
          <Link href="/ot-command/tomorrow" className="text-sm text-blue-600 hover:text-blue-800 cursor-pointer">
            Tomorrow
          </Link>
          <span className="text-gray-300">|</span>
          <Link href="/ot-command/turnaround" className="text-sm text-blue-600 hover:text-blue-800 cursor-pointer">
            Turnaround
          </Link>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-gray-100 p-1 rounded-lg w-fit">
        {(['live', 'analytics'] as const).map(t => (
          <button key={t} onClick={() => setActiveTab(t)}
            className={`px-4 py-2 text-sm font-medium rounded-md cursor-pointer transition-colors duration-200 ${
              activeTab === t ? 'bg-white shadow text-gray-900' : 'text-gray-600 hover:text-gray-900'
            }`}>
            {t === 'live' ? 'Live Status' : 'Period Analytics'}
          </button>
        ))}
      </div>

      {activeTab === 'live' && (
        <>
          {/* Live OT Room Cards */}
          <div className="flex items-center gap-2 mb-2">
            <h2 className="text-lg font-semibold text-gray-800">OT Rooms — Today</h2>
            <button onClick={live.reload} className="p-1 rounded hover:bg-gray-100 cursor-pointer transition-colors duration-200"
              title="Refresh">
              <RefreshCw className="w-4 h-4 text-gray-500" />
            </button>
            <span className="text-xs text-gray-400 ml-auto">Auto-refreshes every 60s</span>
          </div>

          {live.loading && !live.roomStatus.length ? (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
              {[1, 2, 3].map(i => (
                <div key={i} className="bg-white rounded-xl border p-5 animate-pulse">
                  <div className="h-5 bg-gray-200 rounded w-1/2 mb-3" />
                  <div className="h-4 bg-gray-100 rounded w-3/4 mb-2" />
                  <div className="h-4 bg-gray-100 rounded w-1/2 mb-4" />
                  <div className="h-3 bg-gray-100 rounded-full w-full" />
                </div>
              ))}
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
              {live.roomStatus.map(room => (
                <div key={room.id} className="bg-white rounded-xl border shadow-sm p-5 hover:shadow-md transition-shadow duration-200">
                  <div className="flex items-center justify-between mb-3">
                    <div>
                      <h3 className="font-semibold text-gray-900">{room.name}</h3>
                      <span className="text-xs text-gray-500">{room.type || 'General'}</span>
                    </div>
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium"
                      style={{ backgroundColor: `${STATUS_COLORS[room.status]}15`, color: STATUS_COLORS[room.status] }}>
                      <span className="w-2 h-2 rounded-full" style={{ backgroundColor: STATUS_COLORS[room.status] }} />
                      {STATUS_LABELS[room.status]}
                    </span>
                  </div>

                  {room.inProgress && (
                    <div className="text-sm text-gray-700 mb-2">
                      <span className="font-medium">{room.inProgress.surgeon?.full_name}</span>
                      {' — '}{room.inProgress.procedure_name}
                      {room.inProgress.actual_start && (
                        <span className="text-gray-500">
                          {' '}(started {new Date(room.inProgress.actual_start).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true })})
                        </span>
                      )}
                      {room.estCompletion && (
                        <div className="text-xs text-gray-500">Est. completion: {room.estCompletion}</div>
                      )}
                    </div>
                  )}

                  {!room.inProgress && room.nextCase && (
                    <div className="text-sm text-gray-700 mb-2">
                      <span className="text-gray-500">Next:</span>{' '}
                      <span className="font-medium">{room.nextCase.surgeon?.full_name}</span>
                      {' — '}{room.nextCase.procedure_name}
                      {room.nextCase.scheduled_start && (
                        <span className="text-gray-500"> — {room.nextCase.scheduled_start}</span>
                      )}
                    </div>
                  )}

                  <div className="text-sm text-gray-600 mb-3">
                    Today: {room.completed} done / {room.totalScheduled} scheduled
                    {room.cancelled > 0 && <span className="text-red-500 ml-1">({room.cancelled} cancelled)</span>}
                  </div>

                  {/* Utilization bar */}
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-gray-500 w-20">Utilization:</span>
                    <div className="flex-1 h-3 bg-gray-100 rounded-full overflow-hidden">
                      <div className="h-full rounded-full transition-all duration-500"
                        style={{ width: `${room.utilizationPct}%`, backgroundColor: getUtilColor(room.utilizationPct) }} />
                    </div>
                    <span className="text-xs font-medium w-10 text-right">{room.utilizationPct}%</span>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Today's KPI Cards */}
          <h2 className="text-lg font-semibold text-gray-800 mt-8">Today&apos;s KPIs</h2>
          <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-4">
            <KPICard icon={<Calendar className="w-5 h-5" />} label="Total Cases"
              value={`${live.todayKPIs.completed} / ${live.todayKPIs.totalScheduled}`}
              sub={`${live.todayKPIs.remaining} remaining`} color="blue" />
            <KPICard icon={<TrendingUp className="w-5 h-5" />} label="Overall Utilization"
              value={live.roomStatus.length
                ? `${Math.round(live.roomStatus.reduce((s, r) => s + r.utilizationPct, 0) / live.roomStatus.length)}%`
                : '—'}
              sub="Target: 80%" color="green" />
            <KPICard icon={<Clock className="w-5 h-5" />} label="Avg Turnaround"
              value={`${live.todayKPIs.avgTurnaroundMin} min`}
              sub="Between cases" color="purple" />
            <KPICard icon={<CheckCircle className="w-5 h-5" />} label="First Case On Time"
              value={`${live.todayKPIs.firstCaseOnTime.filter(Boolean).length} / ${live.todayKPIs.firstCaseOnTime.length}`}
              sub="Within 15 min" color="teal" />
            <KPICard icon={<XCircle className="w-5 h-5" />} label="Cancellations"
              value={String(live.todayKPIs.cancelled)}
              sub={Object.entries(live.todayKPIs.cancelReasons).map(([r, c]) => `${DELAY_LABELS[r] || r}: ${c}`).join(', ') || 'None'}
              color="red" />
            <KPICard icon={<AlertTriangle className="w-5 h-5" />} label="Delays"
              value={String(live.todayKPIs.delays)}
              sub={`Avg ${live.todayKPIs.avgDelayMin} min`} color="amber" />
          </div>
        </>
      )}

      {activeTab === 'analytics' && (
        <>
          {/* Date Range */}
          <div className="flex items-center gap-3 flex-wrap">
            <label className="text-sm text-gray-600">From</label>
            <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)}
              className="border rounded-lg px-3 py-1.5 text-sm" />
            <label className="text-sm text-gray-600">To</label>
            <input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)}
              className="border rounded-lg px-3 py-1.5 text-sm" />
          </div>

          {/* Room Summary Table */}
          {dash.loading ? (
            <div className="bg-white rounded-xl border p-6 animate-pulse">
              <div className="h-6 bg-gray-200 rounded w-1/4 mb-4" />
              {[1, 2, 3].map(i => <div key={i} className="h-4 bg-gray-100 rounded w-full mb-2" />)}
            </div>
          ) : (
            <div className="bg-white rounded-xl border shadow-sm overflow-hidden">
              <div className="p-4 border-b">
                <h3 className="font-semibold text-gray-900">Room-wise Summary</h3>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-gray-50">
                      <th className="text-left p-3 font-medium text-gray-600">OT Room</th>
                      <th className="text-right p-3 font-medium text-gray-600">Cases</th>
                      <th className="text-right p-3 font-medium text-gray-600">Completed</th>
                      <th className="text-right p-3 font-medium text-gray-600">Cancelled</th>
                      <th className="text-right p-3 font-medium text-gray-600">Avg Util %</th>
                      <th className="text-right p-3 font-medium text-gray-600">Avg Turnaround</th>
                      <th className="text-right p-3 font-medium text-gray-600">Avg Delay</th>
                      <th className="text-right p-3 font-medium text-gray-600">1st Case On-Time</th>
                      <th className="text-right p-3 font-medium text-gray-600">OT Hours</th>
                    </tr>
                  </thead>
                  <tbody>
                    {dash.dashData.map((r: any) => (
                      <tr key={r.ot_room_id} className="border-t hover:bg-gray-50 transition-colors duration-150">
                        <td className="p-3 font-medium text-gray-900">{r.ot_room_name}</td>
                        <td className="p-3 text-right">{r.total_cases}</td>
                        <td className="p-3 text-right text-green-700">{r.completed_cases}</td>
                        <td className="p-3 text-right text-red-600">{r.cancelled_cases}</td>
                        <td className="p-3 text-right">
                          <span className="inline-flex items-center gap-1">
                            <span className="w-2 h-2 rounded-full" style={{ backgroundColor: getUtilColor(Number(r.avg_utilization)) }} />
                            {r.avg_utilization}%
                          </span>
                        </td>
                        <td className="p-3 text-right">{r.avg_turnaround} min</td>
                        <td className="p-3 text-right">{r.avg_delay} min</td>
                        <td className="p-3 text-right">{r.first_case_on_time_pct}%</td>
                        <td className="p-3 text-right">{r.total_ot_hours}h</td>
                      </tr>
                    ))}
                    {!dash.dashData.length && (
                      <tr><td colSpan={9} className="p-8 text-center text-gray-400">No data for selected period. Run the daily stats generator to populate analytics.</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Utilization Heatmap */}
          {heatmapByRoom.length > 0 && (
            <div className="bg-white rounded-xl border shadow-sm p-5">
              <h3 className="font-semibold text-gray-900 mb-4">Utilization Heatmap</h3>
              <div className="overflow-x-auto">
                <div className="space-y-2 min-w-[600px]">
                  {heatmapByRoom.map(room => (
                    <div key={room.roomName} className="flex items-center gap-2">
                      <span className="text-xs text-gray-600 w-20 shrink-0 truncate">{room.roomName}</span>
                      <div className="flex gap-0.5 flex-1">
                        {[...room.days].sort((a, b) => a.date.localeCompare(b.date)).map(d => (
                          <div key={d.date}
                            className="w-5 h-5 rounded-sm cursor-pointer transition-transform duration-150 hover:scale-125"
                            style={{ backgroundColor: getUtilColor(d.utilization), opacity: d.utilization > 0 ? 0.3 + (d.utilization / 100) * 0.7 : 0.1 }}
                            title={`${d.date}: ${d.utilization}% (${d.cases} cases)`} />
                        ))}
                      </div>
                    </div>
                  ))}
                  <div className="flex items-center gap-3 mt-3 text-xs text-gray-500">
                    <span>Legend:</span>
                    <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-sm" style={{ backgroundColor: '#ef4444' }} /> &lt;40%</span>
                    <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-sm" style={{ backgroundColor: '#eab308' }} /> 40-60%</span>
                    <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-sm" style={{ backgroundColor: '#84cc16' }} /> 60-80%</span>
                    <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-sm" style={{ backgroundColor: '#22c55e' }} /> &gt;80%</span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Utilization Trend */}
          {dash.trendData.length > 0 && (
            <div className="bg-white rounded-xl border shadow-sm p-5">
              <h3 className="font-semibold text-gray-900 mb-4">Utilization Trend</h3>
              <ResponsiveContainer width="100%" height={300}>
                <LineChart data={dash.trendData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                  <XAxis dataKey="date" tick={{ fontSize: 10 }} angle={-45} textAnchor="end" height={60} />
                  <YAxis tick={{ fontSize: 11 }} domain={[0, 100]} unit="%" />
                  <Tooltip contentStyle={{ fontSize: 11, borderRadius: 8 }} />
                  <Legend wrapperStyle={{ fontSize: 11 }} />
                  {/* Benchmark line at 80% */}
                  <Line type="monotone" dataKey={() => 80} stroke="#d1d5db" strokeDasharray="5 5" name="Target (80%)" dot={false} />
                  {roomNames.map((name, i) => (
                    <Line key={name} type="monotone" dataKey={name}
                      stroke={CHART_COLORS[i % CHART_COLORS.length]} strokeWidth={2}
                      dot={{ r: 2 }} activeDot={{ r: 4 }} />
                  ))}
                </LineChart>
              </ResponsiveContainer>
            </div>
          )}

          {/* Cancellation & Delay Analysis */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Cancellation Donut */}
            <div className="bg-white rounded-xl border shadow-sm p-5">
              <h3 className="font-semibold text-gray-900 mb-4">Cancellation Reasons</h3>
              {dash.cancelAnalysis.reasons.length > 0 ? (
                <ResponsiveContainer width="100%" height={250}>
                  <PieChart>
                    <Pie data={dash.cancelAnalysis.reasons} dataKey="count" nameKey="reason"
                      cx="50%" cy="50%" innerRadius={50} outerRadius={90} paddingAngle={2}
                      label={({ reason, count }) => `${DELAY_LABELS[reason] || reason}: ${count}`}>
                      {dash.cancelAnalysis.reasons.map((_, i) => (
                        <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip formatter={(value: number, name: string) => [value, DELAY_LABELS[name] || name]} />
                  </PieChart>
                </ResponsiveContainer>
              ) : (
                <p className="text-sm text-gray-400 text-center py-12">No cancellations in selected period</p>
              )}
            </div>

            {/* Delay Bar Chart */}
            <div className="bg-white rounded-xl border shadow-sm p-5">
              <h3 className="font-semibold text-gray-900 mb-4">Delay Reasons</h3>
              {dash.delayAnalysis.length > 0 ? (
                <ResponsiveContainer width="100%" height={250}>
                  <BarChart data={dash.delayAnalysis.map(d => ({ ...d, label: DELAY_LABELS[d.reason] || d.reason }))} layout="vertical">
                    <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                    <XAxis type="number" tick={{ fontSize: 11 }} />
                    <YAxis type="category" dataKey="label" tick={{ fontSize: 10 }} width={120} />
                    <Tooltip contentStyle={{ fontSize: 11, borderRadius: 8 }} />
                    <Bar dataKey="count" fill="#f59e0b" radius={[0, 4, 4, 0]} name="Count" />
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <p className="text-sm text-gray-400 text-center py-12">No delays in selected period</p>
              )}
            </div>
          </div>

          {/* Cancellation Rate Trend */}
          {dash.cancelAnalysis.trend.length > 0 && (
            <div className="bg-white rounded-xl border shadow-sm p-5">
              <h3 className="font-semibold text-gray-900 mb-4">Cancellation Rate Over Time</h3>
              <ResponsiveContainer width="100%" height={250}>
                <LineChart data={dash.cancelAnalysis.trend.map(t => ({
                  ...t, rate: t.total > 0 ? Math.round((t.cancelled / t.total) * 100) : 0,
                }))}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                  <XAxis dataKey="date" tick={{ fontSize: 10 }} angle={-45} textAnchor="end" height={60} />
                  <YAxis tick={{ fontSize: 11 }} unit="%" domain={[0, 'auto']} />
                  <Tooltip contentStyle={{ fontSize: 11, borderRadius: 8 }}
                    formatter={(value: number) => [`${value}%`, 'Cancellation Rate']} />
                  <Line type="monotone" dataKey="rate" stroke="#ef4444" strokeWidth={2} dot={{ r: 2 }} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          )}
        </>
      )}
    </div>
  );
}

function KPICard({ icon, label, value, sub, color }: { icon: React.ReactNode; label: string; value: string; sub: string; color: string }) {
  const colorMap: Record<string, string> = {
    blue: 'bg-blue-50 text-blue-600',
    green: 'bg-green-50 text-green-600',
    purple: 'bg-purple-50 text-purple-600',
    teal: 'bg-teal-50 text-teal-600',
    red: 'bg-red-50 text-red-600',
    amber: 'bg-amber-50 text-amber-600',
  };
  return (
    <div className="bg-white rounded-xl border shadow-sm p-4">
      <div className={`w-9 h-9 rounded-lg flex items-center justify-center mb-2 ${colorMap[color] || colorMap.blue}`}>
        {icon}
      </div>
      <p className="text-xs text-gray-500 mb-1">{label}</p>
      <p className="text-xl font-bold text-gray-900">{value}</p>
      <p className="text-xs text-gray-400 mt-1 truncate" title={sub}>{sub}</p>
    </div>
  );
}

export default function OTCommandPage() {
  return <RoleGuard module="ot"><OTCommandInner /></RoleGuard>;
}
