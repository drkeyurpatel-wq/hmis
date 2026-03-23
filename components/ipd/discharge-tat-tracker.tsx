'use client';
// components/ipd/discharge-tat-tracker.tsx
// Shows discharge time analysis — identifies bottlenecks (billing, pharmacy, doctor sign-off)

import React, { useState, useEffect } from 'react';
import { sb } from '@/lib/supabase/browser';
import { Clock, AlertTriangle, TrendingDown, TrendingUp } from 'lucide-react';

interface DischargeTAT {
  id: string; ipdNumber: string; patientName: string; payorType: string;
  admissionDate: string; dischargeDate: string;
  totalHours: number; // From doctor's discharge order to actual discharge
}

interface Props { centreId: string; dateFrom: string; dateTo: string; }

export default function DischargeTATTracker({ centreId, dateFrom, dateTo }: Props) {
  const [data, setData] = useState<DischargeTAT[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!centreId || !sb()) return;
    setLoading(true);
    sb()!.from('hmis_admissions')
      .select('id, ipd_number, admission_date, actual_discharge, discharge_type, payor_type, patient:hmis_patients!inner(first_name, last_name)')
      .eq('centre_id', centreId).eq('status', 'discharged')
      .gte('actual_discharge', dateFrom).lte('actual_discharge', dateTo)
      .order('actual_discharge', { ascending: false }).limit(200)
      .then(({ data: adms }) => {
        const results: DischargeTAT[] = (adms || []).map((a: any) => {
          const admDate = new Date(a.admission_date);
          const dischDate = new Date(a.actual_discharge);
          const totalHours = (dischDate.getTime() - admDate.getTime()) / 3600000;
          const pt = a.patient as any;
          return {
            id: a.id, ipdNumber: a.ipd_number,
            patientName: `${pt?.first_name || ''} ${pt?.last_name || ''}`,
            payorType: a.payor_type || 'self',
            admissionDate: a.admission_date, dischargeDate: a.actual_discharge,
            totalHours: Math.round(totalHours * 10) / 10,
          };
        });
        setData(results);
        setLoading(false);
      });
  }, [centreId, dateFrom, dateTo]);

  if (loading) return <div className="text-center py-8 text-gray-400 text-sm">Loading TAT data...</div>;

  // Calculate stats
  const total = data.length;
  if (total === 0) return <div className="text-center py-8 text-gray-400 text-sm">No discharges in period</div>;

  const hours = data.map(d => d.totalHours).sort((a, b) => a - b);
  const median = hours[Math.floor(total / 2)];
  const mean = hours.reduce((s, h) => s + h, 0) / total;
  const p90 = hours[Math.floor(total * 0.9)];

  // By payor type
  const byPayor: Record<string, { count: number; totalH: number; items: DischargeTAT[] }> = {};
  for (const d of data) {
    if (!byPayor[d.payorType]) byPayor[d.payorType] = { count: 0, totalH: 0, items: [] };
    byPayor[d.payorType].count++;
    byPayor[d.payorType].totalH += d.totalHours;
    byPayor[d.payorType].items.push(d);
  }

  // Slowest discharges
  const slowest = [...data].sort((a, b) => b.totalHours - a.totalHours).slice(0, 10);

  const fmtH = (h: number) => h < 24 ? `${h.toFixed(1)}h` : `${(h / 24).toFixed(1)}d`;

  return (
    <div className="space-y-4">
      {/* Summary cards */}
      <div className="grid grid-cols-4 gap-3">
        <div className="bg-white rounded-xl border p-3">
          <div className="text-xs text-gray-500">Total Discharges</div>
          <div className="text-2xl font-bold">{total}</div>
        </div>
        <div className="bg-white rounded-xl border p-3">
          <div className="text-xs text-gray-500">Median TAT</div>
          <div className={`text-2xl font-bold ${median > 4 ? 'text-red-600' : median > 2 ? 'text-amber-600' : 'text-green-600'}`}>{fmtH(median)}</div>
        </div>
        <div className="bg-white rounded-xl border p-3">
          <div className="text-xs text-gray-500">Mean TAT</div>
          <div className={`text-2xl font-bold ${mean > 6 ? 'text-red-600' : mean > 3 ? 'text-amber-600' : 'text-green-600'}`}>{fmtH(mean)}</div>
        </div>
        <div className="bg-white rounded-xl border p-3">
          <div className="text-xs text-gray-500">P90 TAT</div>
          <div className={`text-2xl font-bold ${p90 > 12 ? 'text-red-600' : 'text-amber-600'}`}>{fmtH(p90)}</div>
        </div>
      </div>

      {/* By payor type */}
      <div className="bg-white rounded-xl border p-4">
        <h3 className="font-semibold text-sm mb-3">TAT by Payor Type</h3>
        <div className="space-y-2">
          {Object.entries(byPayor).sort((a, b) => (b[1].totalH / b[1].count) - (a[1].totalH / a[1].count)).map(([payor, stats]) => {
            const avg = stats.totalH / stats.count;
            const maxW = 100;
            const barW = Math.min(maxW, (avg / Math.max(mean * 2, 1)) * maxW);
            return (
              <div key={payor} className="flex items-center gap-3">
                <span className="text-xs font-semibold uppercase w-24">{payor}</span>
                <div className="flex-1 h-6 bg-gray-100 rounded-full overflow-hidden">
                  <div className={`h-full rounded-full ${avg > mean * 1.5 ? 'bg-red-500' : avg > mean ? 'bg-amber-500' : 'bg-green-500'}`}
                    style={{ width: `${barW}%` }} />
                </div>
                <span className="text-xs font-mono w-16 text-right">{fmtH(avg)}</span>
                <span className="text-[10px] text-gray-400 w-12 text-right">n={stats.count}</span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Slowest discharges */}
      <div className="bg-white rounded-xl border p-4">
        <h3 className="font-semibold text-sm mb-3 flex items-center gap-1"><AlertTriangle size={14} className="text-red-500" /> Slowest Discharges</h3>
        <table className="w-full text-xs">
          <thead><tr className="text-gray-500 border-b"><th className="py-1.5 text-left">IPD</th><th className="text-left">Patient</th><th className="text-left">Payor</th><th className="text-right">TAT</th></tr></thead>
          <tbody>{slowest.map(d => (
            <tr key={d.id} className="border-b last:border-0">
              <td className="py-1.5 font-mono">{d.ipdNumber}</td>
              <td>{d.patientName}</td>
              <td className="uppercase">{d.payorType}</td>
              <td className={`text-right font-bold ${d.totalHours > 24 ? 'text-red-600' : d.totalHours > 8 ? 'text-amber-600' : ''}`}>{fmtH(d.totalHours)}</td>
            </tr>
          ))}</tbody>
        </table>
      </div>
    </div>
  );
}
