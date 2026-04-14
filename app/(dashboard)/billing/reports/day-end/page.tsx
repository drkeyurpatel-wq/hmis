// @ts-nocheck
// HEALTH1 HMIS — DAY-END REPORT
'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import {
  ArrowLeft, Calendar, Download, Printer, RefreshCw, IndianRupee,
  Banknote, CreditCard, Smartphone, Building2, FileText,
} from 'lucide-react';
import { PAYMENT_MODE_LABELS } from '@/lib/billing/billing-v2-types';
import type { PaymentMode } from '@/lib/billing/billing-v2-types';

interface DayEndSummary {
  total_collection: number;
  total_refunds: number;
  net_collection: number;
  bills_generated: number;
  encounters_created: number;
  mode_breakup: Array<{ payment_mode: PaymentMode; count: number; amount: number; }>;
  department_breakup: Array<{ department: string; gross_revenue: number; discounts: number; net_revenue: number; items: number; }>;
  payor_breakup: Array<{ payor_type: string; count: number; amount: number; }>;
}

const MODE_ICONS: Record<string, any> = {
  CASH: Banknote, CARD: CreditCard, UPI: Smartphone,
  NEFT: Building2, RTGS: Building2, CHEQUE: FileText, ONLINE: Smartphone,
};

export default function DayEndReportPage() {
  const router = useRouter();
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [summary, setSummary] = useState<DayEndSummary | null>(null);
  const [loading, setLoading] = useState(false);
  const centreId = 'CURRENT_CENTRE_ID';

  const loadReport = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/billing/reports/day-end?centre_id=${centreId}&date=${date}`);
      if (res.ok) setSummary(await res.json());
    } catch { /* ignore */ }
    setLoading(false);
  }, [centreId, date]);

  useEffect(() => { loadReport(); }, [loadReport]);
  const fmt = (n: number) => `₹${n.toLocaleString('en-IN', { minimumFractionDigits: 0 })}`;

  return (
    <div className="min-h-screen bg-[#F8FAFC]">
      <div className="border-b border-gray-200 bg-white px-6 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button onClick={() => router.push('/billing')} className="p-1.5 rounded-lg hover:bg-gray-100">
              <ArrowLeft className="h-5 w-5 text-gray-600" />
            </button>
            <div>
              <h1 className="text-lg font-bold text-[#0A2540]">Day-End Report</h1>
              <p className="text-xs text-gray-500">Daily collection summary & reconciliation</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2 rounded-lg border border-gray-200 px-3 py-1.5">
              <Calendar className="h-4 w-4 text-gray-400" />
              <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="text-sm border-0 focus:outline-none" />
            </div>
            <button onClick={loadReport} className="inline-flex items-center gap-1.5 rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-600 hover:bg-gray-50">
              <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
            </button>
            <button className="inline-flex items-center gap-1.5 rounded-lg bg-[#0A2540] px-4 py-2 text-sm font-medium text-white hover:bg-[#0A2540]/90">
              <Download className="h-4 w-4" /> Export PDF
            </button>
          </div>
        </div>
      </div>

      <div className="px-6 py-5 space-y-5">
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          {[
            { label: 'Total Collection', value: summary?.total_collection || 0, color: 'border-l-emerald-400' },
            { label: 'Refunds', value: summary?.total_refunds || 0, color: 'border-l-red-400' },
            { label: 'Net Collection', value: summary?.net_collection || 0, color: 'border-l-blue-400' },
            { label: 'Bills Generated', value: summary?.bills_generated || 0, color: 'border-l-purple-400', isCount: true },
            { label: 'Encounters', value: summary?.encounters_created || 0, color: 'border-l-amber-400', isCount: true },
          ].map(card => (
            <div key={card.label} className={`rounded-lg border border-gray-200 bg-white p-3.5 border-l-4 ${card.color}`}>
              <p className="text-[10px] font-semibold text-gray-500 uppercase tracking-wider">{card.label}</p>
              <p className="mt-1 text-xl font-bold font-mono tabular-nums text-gray-900">
                {(card as any).isCount ? card.value : fmt(card.value as number)}
              </p>
            </div>
          ))}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
            <div className="px-5 py-3 border-b border-gray-100">
              <h3 className="text-sm font-bold text-gray-900">Collection by Payment Mode</h3>
            </div>
            <div className="p-5 space-y-3">
              {(summary?.mode_breakup || []).map(mb => {
                const ModeIcon = MODE_ICONS[mb.payment_mode] || IndianRupee;
                const pct = summary?.total_collection ? Math.round(mb.amount / summary.total_collection * 100) : 0;
                return (
                  <div key={mb.payment_mode} className="flex items-center gap-3">
                    <ModeIcon className="h-4 w-4 text-gray-400 flex-shrink-0" />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-xs font-medium text-gray-700">{PAYMENT_MODE_LABELS[mb.payment_mode] || mb.payment_mode}</span>
                        <span className="text-sm font-bold font-mono text-gray-900">{fmt(mb.amount)}</span>
                      </div>
                      <div className="h-1.5 rounded-full bg-gray-100 overflow-hidden">
                        <div className="h-full rounded-full bg-[#00B4D8]" style={{ width: `${pct}%` }} />
                      </div>
                      <div className="flex items-center justify-between mt-0.5">
                        <span className="text-[10px] text-gray-400">{mb.count} transactions</span>
                        <span className="text-[10px] text-gray-400">{pct}%</span>
                      </div>
                    </div>
                  </div>
                );
              })}
              {(!summary?.mode_breakup || summary.mode_breakup.length === 0) && (
                <p className="text-sm text-gray-400 text-center py-4">No transactions today</p>
              )}
            </div>
          </div>

          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
            <div className="px-5 py-3 border-b border-gray-100">
              <h3 className="text-sm font-bold text-gray-900">Revenue by Department</h3>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="bg-gray-50/80">
                    <th className="px-4 py-2 text-left text-[10px] font-semibold text-gray-500 uppercase">Dept</th>
                    <th className="px-4 py-2 text-right text-[10px] font-semibold text-gray-500 uppercase">Gross</th>
                    <th className="px-4 py-2 text-right text-[10px] font-semibold text-gray-500 uppercase">Disc</th>
                    <th className="px-4 py-2 text-right text-[10px] font-semibold text-gray-500 uppercase">Net</th>
                  </tr>
                </thead>
                <tbody>
                  {(summary?.department_breakup || []).map(db => (
                    <tr key={db.department} className="border-b border-gray-50">
                      <td className="px-4 py-2"><span className="text-xs font-medium text-gray-700">{db.department}</span><span className="text-[10px] text-gray-400 ml-1">({db.items})</span></td>
                      <td className="px-4 py-2 text-right text-xs font-mono text-gray-600">{fmt(db.gross_revenue)}</td>
                      <td className="px-4 py-2 text-right text-xs font-mono text-orange-600">{db.discounts > 0 ? `-${fmt(db.discounts)}` : '—'}</td>
                      <td className="px-4 py-2 text-right text-xs font-mono font-semibold text-gray-900">{fmt(db.net_revenue)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <div className="px-5 py-3 border-b border-gray-100">
            <h3 className="text-sm font-bold text-gray-900">Payor Mix</h3>
          </div>
          <div className="p-5">
            <div className="flex gap-4 flex-wrap">
              {(summary?.payor_breakup || []).map(pb => {
                const pct = summary?.net_collection ? Math.round(pb.amount / summary.net_collection * 100) : 0;
                return (
                  <div key={pb.payor_type} className="rounded-lg border border-gray-100 p-3 min-w-[140px]">
                    <p className="text-[10px] font-semibold text-gray-500 uppercase">{pb.payor_type.replace(/_/g, ' ')}</p>
                    <p className="text-lg font-bold font-mono text-gray-900 mt-0.5">{fmt(pb.amount)}</p>
                    <p className="text-[10px] text-gray-400">{pb.count} encounters - {pct}%</p>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
