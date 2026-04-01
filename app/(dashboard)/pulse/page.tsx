'use client';

import { useState, useEffect, useCallback } from 'react';
import { useAuthStore } from '@/lib/store/auth';
import {
  usePulse, useCentres,
  formatLakhs, formatARPOB, formatDate,
  pctChange, trendDirection,
  PulseSnapshot, PulseTrendPoint,
} from '@/lib/pulse/pulse-hooks';
import { StatsSkeleton, CardSkeleton } from '@/components/ui/shared';
import {
  AreaChart, Area, LineChart, Line,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  ResponsiveContainer,
} from 'recharts';
import {
  Activity, CalendarDays, RefreshCw, Copy, Check,
  TrendingUp, TrendingDown, Minus, Filter,
  FileText, PenLine, History,
} from 'lucide-react';
import Link from 'next/link';

// ═══ HELPERS ═══

function yesterday(): string {
  const d = new Date();
  d.setDate(d.getDate() - 1);
  return d.toISOString().split('T')[0];
}

function TrendArrow({ current, previous, invert }: { current: number; previous: number; invert?: boolean }) {
  const dir = trendDirection(current, previous);
  const pct = Math.abs(pctChange(current, previous));
  const isGood = invert ? dir === 'down' : dir === 'up';

  if (dir === 'flat') return <span className="text-gray-400 text-xs flex items-center gap-0.5"><Minus size={12} /> —</span>;
  return (
    <span className={`text-xs font-semibold flex items-center gap-0.5 ${isGood ? 'text-emerald-600' : 'text-red-600'}`}>
      {dir === 'up' ? <TrendingUp size={12} /> : <TrendingDown size={12} />}
      {pct > 0 ? `${pct.toFixed(1)}%` : ''}
    </span>
  );
}

function OccupancyBadge({ pct }: { pct: number }) {
  const color = pct >= 80 ? 'bg-emerald-100 text-emerald-700 border-emerald-200'
    : pct >= 60 ? 'bg-amber-100 text-amber-700 border-amber-200'
    : 'bg-red-100 text-red-700 border-red-200';
  return <span className={`text-xs font-bold px-2 py-0.5 rounded-full border ${color}`}>{pct.toFixed(1)}%</span>;
}

const CENTRE_COLORS = ['#0D9488', '#3B82F6', '#8B5CF6', '#F59E0B', '#EF4444', '#EC4899', '#06B6D4'];

// ═══ MAIN PAGE ═══

export default function PulseDashboardPage() {
  const { staff } = useAuthStore();
  const pulse = usePulse();
  const { centres } = useCentres();

  const [date, setDate] = useState(yesterday);
  const [centreFilter, setCentreFilter] = useState<string>('');
  const [copied, setCopied] = useState(false);
  const [trendData, setTrendData] = useState<PulseTrendPoint[]>([]);
  const [chartMode, setChartMode] = useState<'revenue' | 'ops'>('revenue');
  const [opsMetric, setOpsMetric] = useState<'opd_count' | 'new_admissions' | 'surgeries' | 'occupancy_pct'>('opd_count');
  const [toast, setToast] = useState('');

  const flash = (m: string) => { setToast(m); setTimeout(() => setToast(''), 3000); };

  // Load data
  const loadData = useCallback(async () => {
    await Promise.all([
      pulse.getDashboard(date, centreFilter || undefined),
      pulse.getWhatsAppText(date),
    ]);
  }, [date, centreFilter, pulse]);

  const loadTrend = useCallback(async () => {
    const data = await pulse.getTrend(centreFilter || undefined, 30);
    setTrendData(data);
  }, [centreFilter, pulse]);

  useEffect(() => { loadData(); }, [date, centreFilter]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { loadTrend(); }, [centreFilter]); // eslint-disable-line react-hooks/exhaustive-deps

  // Generate snapshot
  const handleGenerate = async () => {
    const result = await pulse.generateAllSnapshots(date);
    if (result !== null) {
      flash('Snapshots generated for all centres');
      loadData();
      loadTrend();
    }
  };

  // Copy WhatsApp
  const handleCopyWhatsApp = async () => {
    let text = pulse.whatsappText;
    if (!text) text = await pulse.getWhatsAppText(date);
    if (text) {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      flash('Copied to clipboard');
      setTimeout(() => setCopied(false), 2000);
    }
  };

  // Aggregated summary
  const data = pulse.dashboard;
  const totals = data.reduce((acc, s) => ({
    opd: acc.opd + (s.opd_count || 0),
    admissions: acc.admissions + (s.new_admissions || 0),
    discharges: acc.discharges + (s.discharges || 0),
    surgeries: acc.surgeries + (s.surgeries || 0),
    billing: acc.billing + (s.billing_amount || 0),
    collection: acc.collection + (s.collection_amount || 0),
    bedsTotal: acc.bedsTotal + (s.beds_total || 0),
    bedsOccupied: acc.bedsOccupied + (s.beds_occupied || 0),
    prevOpd: acc.prevOpd + (s.prev_opd_count || 0),
    prevAdmissions: acc.prevAdmissions + (s.prev_new_admissions || 0),
    prevDischarges: acc.prevDischarges + (s.prev_discharges || 0),
    prevSurgeries: acc.prevSurgeries + (s.prev_surgeries || 0),
    prevBilling: acc.prevBilling + (s.prev_billing_amount || 0),
    prevCollection: acc.prevCollection + (s.prev_collection_amount || 0),
    prevOccupied: acc.prevOccupied + (s.prev_occupancy_pct ? (s.beds_total || 0) * s.prev_occupancy_pct / 100 : 0),
  }), {
    opd: 0, admissions: 0, discharges: 0, surgeries: 0,
    billing: 0, collection: 0, bedsTotal: 0, bedsOccupied: 0,
    prevOpd: 0, prevAdmissions: 0, prevDischarges: 0, prevSurgeries: 0,
    prevBilling: 0, prevCollection: 0, prevOccupied: 0,
  });

  const groupOccupancy = totals.bedsTotal > 0 ? (totals.bedsOccupied / totals.bedsTotal) * 100 : 0;
  const prevGroupOccupancy = totals.bedsTotal > 0 ? (totals.prevOccupied / totals.bedsTotal) * 100 : 0;

  // Trend chart data
  const trendChartData = (() => {
    const byDate: Record<string, Record<string, number>> = {};
    trendData.forEach(p => {
      if (!byDate[p.snapshot_date]) byDate[p.snapshot_date] = { date: 0 };
      const key = p.centre_code || p.centre_name;
      if (chartMode === 'revenue') {
        byDate[p.snapshot_date][`billing_${key}`] = p.billing_amount;
        byDate[p.snapshot_date]['total_collection'] = (byDate[p.snapshot_date]['total_collection'] || 0) + p.collection_amount;
      } else {
        byDate[p.snapshot_date][key] = p[opsMetric] || 0;
      }
    });
    return Object.entries(byDate)
      .map(([d, vals]) => ({ date: d, ...vals }))
      .sort((a, b) => a.date.localeCompare(b.date));
  })();

  const uniqueCentres = [...new Set(trendData.map(p => p.centre_code || p.centre_name))];

  // Check allowed roles
  const role = staff?.staff_type || '';
  const allowed = ['admin', 'md', 'ceo', 'coo', 'centre_head'].includes(role);
  if (!allowed && role) {
    return (
      <div className="max-w-7xl mx-auto py-12 text-center">
        <Activity size={48} className="mx-auto text-gray-300 mb-4" />
        <h2 className="text-lg font-semibold text-gray-700">Access Restricted</h2>
        <p className="text-sm text-gray-500 mt-1">Pulse MIS is available to leadership roles only.</p>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      {/* Toast */}
      {toast && (
        <div className="fixed top-4 left-1/2 -translate-x-1/2 z-50 bg-emerald-600 text-white px-4 py-2 rounded-xl shadow-lg text-sm">
          {toast}
        </div>
      )}

      {/* ═══ HEADER BAR ═══ */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-gray-900 flex items-center gap-2">
            <Activity size={22} className="text-teal-600" />
            Daily MIS
          </h1>
          <p className="text-sm text-gray-500">{formatDate(date)}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <input
            type="date"
            value={date}
            onChange={e => setDate(e.target.value)}
            className="border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:ring-2 focus:ring-teal-500 focus:border-teal-500 outline-none"
          />
          <select
            value={centreFilter}
            onChange={e => setCentreFilter(e.target.value)}
            className="border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:ring-2 focus:ring-teal-500 focus:border-teal-500 outline-none cursor-pointer"
          >
            <option value="">All Centres</option>
            {centres.map(c => (
              <option key={c.id} value={c.id}>{c.name.replace('Health1 Super Speciality Hospitals — ', '').replace('Health1 ', '')}</option>
            ))}
          </select>
          <button
            onClick={handleGenerate}
            disabled={pulse.generating}
            className="flex items-center gap-1.5 bg-teal-600 text-white px-3 py-1.5 rounded-lg text-sm font-medium hover:bg-teal-700 transition-colors disabled:opacity-50 cursor-pointer"
          >
            <RefreshCw size={14} className={pulse.generating ? 'animate-spin' : ''} />
            {pulse.generating ? 'Generating...' : 'Generate Snapshot'}
          </button>
          <button
            onClick={handleCopyWhatsApp}
            className="flex items-center gap-1.5 bg-green-600 text-white px-3 py-1.5 rounded-lg text-sm font-medium hover:bg-green-700 transition-colors cursor-pointer"
          >
            {copied ? <Check size={14} /> : <Copy size={14} />}
            {copied ? 'Copied' : 'Copy for WhatsApp'}
          </button>
          <Link href="/pulse/entry" className="flex items-center gap-1.5 border border-gray-300 text-gray-700 px-3 py-1.5 rounded-lg text-sm font-medium hover:bg-gray-50 transition-colors cursor-pointer">
            <PenLine size={14} /> Manual Entry
          </Link>
          <Link href="/pulse/history" className="flex items-center gap-1.5 border border-gray-300 text-gray-700 px-3 py-1.5 rounded-lg text-sm font-medium hover:bg-gray-50 transition-colors cursor-pointer">
            <History size={14} /> History
          </Link>
        </div>
      </div>

      {/* Error */}
      {pulse.error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">
          {pulse.error}
        </div>
      )}

      {/* ═══ SECTION A: GROUP SUMMARY CARDS ═══ */}
      {pulse.loading ? (
        <StatsSkeleton count={6} />
      ) : data.length === 0 ? (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-6 text-center">
          <FileText size={32} className="mx-auto text-amber-400 mb-2" />
          <p className="font-medium text-amber-800">No snapshot data for {formatDate(date)}</p>
          <p className="text-sm text-amber-600 mt-1">Click &quot;Generate Snapshot&quot; to create today&apos;s data, or use Manual Entry.</p>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
            {[
              { label: 'Total OPD', value: totals.opd, prev: totals.prevOpd, format: (n: number) => n.toLocaleString('en-IN') },
              { label: 'Admit / Discharge', value: totals.admissions, prev: totals.prevAdmissions, format: (n: number) => `${totals.admissions} in / ${totals.discharges} out` },
              { label: 'Surgeries', value: totals.surgeries, prev: totals.prevSurgeries, format: (n: number) => n.toLocaleString('en-IN') },
              { label: 'Billing', value: totals.billing, prev: totals.prevBilling, format: formatLakhs },
              { label: 'Collections', value: totals.collection, prev: totals.prevCollection, format: formatLakhs },
              { label: 'Group Occupancy', value: groupOccupancy, prev: prevGroupOccupancy, format: (n: number) => `${n.toFixed(1)}%`, isOccupancy: true },
            ].map(card => (
              <div key={card.label} className="bg-white rounded-xl border border-gray-200 p-4 shadow-sm hover:shadow-md transition-shadow">
                <div className="text-xs text-gray-500 font-medium uppercase tracking-wide">{card.label}</div>
                <div className="text-2xl font-bold text-gray-900 mt-1">{card.format(card.value)}</div>
                {(card as any).isOccupancy ? (
                  <div className="mt-2">
                    <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all duration-500 ${
                          card.value >= 80 ? 'bg-emerald-500' : card.value >= 60 ? 'bg-amber-500' : 'bg-red-500'
                        }`}
                        style={{ width: `${Math.min(100, card.value)}%` }}
                      />
                    </div>
                    <div className="mt-1">
                      <TrendArrow current={card.value} previous={card.prev} />
                    </div>
                  </div>
                ) : (
                  <div className="mt-1">
                    <TrendArrow current={card.value} previous={card.prev} />
                  </div>
                )}
              </div>
            ))}
          </div>

          {/* ═══ SECTION B: CENTRE-WISE GRID ═══ */}
          <div>
            <h2 className="text-sm font-semibold text-gray-700 uppercase tracking-wide mb-3">Centre Performance</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
              {data.map(s => (
                <div key={s.centre_id} className="bg-white rounded-xl border border-gray-200 shadow-sm hover:shadow-md transition-shadow overflow-hidden">
                  {/* Header */}
                  <div className="flex items-center justify-between px-4 py-3 bg-gray-50 border-b border-gray-100">
                    <span className="font-bold text-sm text-gray-900 uppercase tracking-wide">
                      {(s.centre_name || '').replace('Health1 Super Speciality Hospitals — ', '').replace('Health1 ', '') || s.centre_code}
                    </span>
                    <OccupancyBadge pct={s.occupancy_pct || 0} />
                  </div>
                  {/* Operations */}
                  <div className="px-4 py-3 grid grid-cols-3 gap-x-4 gap-y-1 text-sm border-b border-gray-50">
                    <div><span className="text-gray-500">OPD:</span> <span className="font-semibold">{s.opd_count || 0}</span></div>
                    <div><span className="text-gray-500">ER:</span> <span className="font-semibold">{s.emergency_count || 0}</span></div>
                    <div><span className="text-gray-500">OT:</span> <span className="font-semibold">{s.surgeries || 0}</span></div>
                    <div><span className="text-gray-500">Admit:</span> <span className="font-semibold">{s.new_admissions || 0}</span></div>
                    <div><span className="text-gray-500">DC:</span> <span className="font-semibold">{s.discharges || 0}</span></div>
                    <div><span className="text-gray-500">Census:</span> <span className="font-semibold">{s.ipd_census || 0}</span></div>
                  </div>
                  {/* Revenue */}
                  <div className="px-4 py-3 space-y-1.5 text-sm border-b border-gray-50">
                    <div className="flex items-center justify-between">
                      <span className="text-gray-500">Billing:</span>
                      <span className="font-semibold flex items-center gap-2">
                        {formatLakhs(s.billing_amount || 0)}
                        <TrendArrow current={s.billing_amount || 0} previous={s.prev_billing_amount || 0} />
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-gray-500">Collection:</span>
                      <span className="font-semibold flex items-center gap-2">
                        {formatLakhs(s.collection_amount || 0)}
                        <TrendArrow current={s.collection_amount || 0} previous={s.prev_collection_amount || 0} />
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-gray-500">Pharmacy:</span>
                      <span className="font-semibold">{formatLakhs(s.pharmacy_sales || 0)}</span>
                    </div>
                  </div>
                  {/* Footer metrics */}
                  <div className="px-4 py-2.5 flex items-center justify-between text-xs text-gray-600 bg-gray-50/50">
                    <span>ARPOB: <span className="font-semibold text-gray-900">{formatARPOB(s.arpob || 0)}</span></span>
                    <span>Claims: <span className="font-semibold">{s.claims_new || 0} new, {s.claims_settled || 0} settled</span></span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* ═══ SECTION C: TREND CHARTS ═══ */}
          <div>
            <h2 className="text-sm font-semibold text-gray-700 uppercase tracking-wide mb-3">30-Day Trends</h2>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {/* Revenue & Collections */}
              <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-4">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-sm font-semibold text-gray-800">Revenue &amp; Collections</h3>
                </div>
                <div className="h-[280px]">
                  {trendChartData.length > 0 ? (
                    <ResponsiveContainer width="100%" height="100%">
                      <AreaChart data={trendChartData}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                        <XAxis dataKey="date" tick={{ fontSize: 10 }} tickFormatter={d => { const dt = new Date(d + 'T00:00:00'); return `${dt.getDate()}/${dt.getMonth() + 1}`; }} />
                        <YAxis tick={{ fontSize: 10 }} tickFormatter={v => v >= 100000 ? `${(v / 100000).toFixed(0)}L` : `${v}`} />
                        <Tooltip
                          formatter={(value: number, name: string) => [formatLakhs(value), name.replace('billing_', '').replace('total_collection', 'Collections')]}
                          labelFormatter={l => formatDate(l as string)}
                        />
                        <Legend wrapperStyle={{ fontSize: 11 }} />
                        {uniqueCentres.map((c, i) => (
                          <Area
                            key={c}
                            type="monotone"
                            dataKey={`billing_${c}`}
                            name={c}
                            stackId="billing"
                            fill={CENTRE_COLORS[i % CENTRE_COLORS.length]}
                            stroke={CENTRE_COLORS[i % CENTRE_COLORS.length]}
                            fillOpacity={0.3}
                          />
                        ))}
                        <Line type="monotone" dataKey="total_collection" name="Collections" stroke="#DC2626" strokeWidth={2} dot={false} />
                      </AreaChart>
                    </ResponsiveContainer>
                  ) : (
                    <div className="h-full flex items-center justify-center text-gray-400 text-sm">No trend data available</div>
                  )}
                </div>
              </div>

              {/* Operational Trend */}
              <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-4">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-sm font-semibold text-gray-800">Operational Trend</h3>
                  <select
                    value={opsMetric}
                    onChange={e => setOpsMetric(e.target.value as typeof opsMetric)}
                    className="text-xs border border-gray-200 rounded px-2 py-1 cursor-pointer focus:ring-1 focus:ring-teal-500 outline-none"
                  >
                    <option value="opd_count">OPD</option>
                    <option value="new_admissions">Admissions</option>
                    <option value="surgeries">Surgeries</option>
                    <option value="occupancy_pct">Occupancy %</option>
                  </select>
                </div>
                <div className="h-[280px]">
                  {trendChartData.length > 0 ? (
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={(() => {
                        // Rebuild for ops view
                        const byDate: Record<string, Record<string, number>> = {};
                        trendData.forEach(p => {
                          if (!byDate[p.snapshot_date]) byDate[p.snapshot_date] = {};
                          const key = p.centre_code || p.centre_name;
                          byDate[p.snapshot_date][key] = p[opsMetric] || 0;
                        });
                        return Object.entries(byDate)
                          .map(([d, vals]) => ({ date: d, ...vals }))
                          .sort((a, b) => a.date.localeCompare(b.date));
                      })()}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                        <XAxis dataKey="date" tick={{ fontSize: 10 }} tickFormatter={d => { const dt = new Date(d + 'T00:00:00'); return `${dt.getDate()}/${dt.getMonth() + 1}`; }} />
                        <YAxis tick={{ fontSize: 10 }} />
                        <Tooltip labelFormatter={l => formatDate(l as string)} />
                        <Legend wrapperStyle={{ fontSize: 11 }} />
                        {uniqueCentres.map((c, i) => (
                          <Line
                            key={c}
                            type="monotone"
                            dataKey={c}
                            name={c}
                            stroke={CENTRE_COLORS[i % CENTRE_COLORS.length]}
                            strokeWidth={2}
                            dot={false}
                          />
                        ))}
                      </LineChart>
                    </ResponsiveContainer>
                  ) : (
                    <div className="h-full flex items-center justify-center text-gray-400 text-sm">No trend data available</div>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* ═══ SECTION D: WHATSAPP PREVIEW ═══ */}
          <div>
            <h2 className="text-sm font-semibold text-gray-700 uppercase tracking-wide mb-3">WhatsApp Summary</h2>
            <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-4">
              <div className="flex items-center justify-between mb-3">
                <span className="text-xs text-gray-500">Preview — copy and share to leadership WhatsApp group</span>
                <button
                  onClick={handleCopyWhatsApp}
                  className="flex items-center gap-1.5 text-sm text-green-700 bg-green-50 px-3 py-1 rounded-lg hover:bg-green-100 transition-colors cursor-pointer font-medium"
                >
                  {copied ? <Check size={14} /> : <Copy size={14} />}
                  {copied ? 'Copied' : 'Copy to Clipboard'}
                </button>
              </div>
              <div className="bg-[#DCF8C6] rounded-xl p-4 max-w-2xl shadow-sm border border-green-200">
                <pre className="text-[13px] text-gray-800 whitespace-pre-wrap font-[system-ui] leading-relaxed">
                  {pulse.whatsappText || 'No WhatsApp summary available. Generate a snapshot first.'}
                </pre>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
