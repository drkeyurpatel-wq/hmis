'use client';

import React, { useState, useEffect } from 'react';
import { useAuthStore } from '@/lib/store/auth';
import { sb } from '@/lib/supabase/browser';
import {
  BarChart3, TrendingUp, Clock, IndianRupee, Building2,
  AlertTriangle, CheckCircle, XCircle, ArrowUpRight, RefreshCw,
} from 'lucide-react';

const INR = (n: number | null) => !n ? '₹0' : n >= 100000 ? `₹${(n/100000).toFixed(1)}L` : `₹${Math.round(n).toLocaleString('en-IN')}`;

export default function ClaimsMISPage() {
  const { activeCentreId } = useAuthStore();
  const [aging, setAging] = useState<any[]>([]);
  const [scorecard, setScorecard] = useState<any[]>([]);
  const [statusBreakdown, setStatusBreakdown] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState<'aging' | 'scorecard' | 'status'>('aging');

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      const s = sb();

      // Aging from view
      const { data: a } = await s.from('clm_v_aging').select('*');
      setAging(a || []);

      // Payer scorecard from view
      const { data: sc } = await s.from('clm_v_payer_scorecard').select('*').order('total_claims', { ascending: false });
      setScorecard(sc || []);

      // Status breakdown
      const { data: claims } = await s.from('clm_claims').select('status, claimed_amount, settled_amount, centre_id');
      const breakdown: Record<string, { count: number; amount: number }> = {};
      (claims || []).forEach((c: any) => {
        if (!breakdown[c.status]) breakdown[c.status] = { count: 0, amount: 0 };
        breakdown[c.status].count++;
        breakdown[c.status].amount += c.claimed_amount || c.settled_amount || 0;
      });
      setStatusBreakdown(Object.entries(breakdown).map(([status, data]) => ({ status, ...data })));

      setLoading(false);
    };
    load();
  }, []);

  // Aging buckets aggregation
  const agingBuckets = ['0-30', '31-60', '61-90', '91-120', '120+'];
  const agingAgg = agingBuckets.map(bucket => {
    const items = aging.filter(a => a.aging_bucket === bucket);
    return {
      bucket,
      count: items.length,
      amount: items.reduce((s, a) => s + (a.claimed_amount || 0), 0),
    };
  });
  const totalOutstanding = aging.reduce((s, a) => s + (a.claimed_amount || 0), 0);

  return (
    <div className="min-h-screen">
      <div className="bg-white border-b px-6 py-4">
        <h1 className="text-xl font-bold text-gray-900">Claims MIS</h1>
        <p className="text-sm text-gray-500">Group-level credit cycle analytics across all centres</p>

        <div className="flex gap-2 mt-4">
          {[
            { key: 'aging', label: 'Aging Analysis', icon: Clock },
            { key: 'scorecard', label: 'Payer Scorecard', icon: Building2 },
            { key: 'status', label: 'Status Breakdown', icon: BarChart3 },
          ].map(t => (
            <button key={t.key} onClick={() => setView(t.key as any)}
              className={`px-4 py-1.5 text-sm font-medium rounded-lg flex items-center gap-1.5 ${
                view === t.key ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}>
              <t.icon className="w-3.5 h-3.5" /> {t.label}
            </button>
          ))}
        </div>
      </div>

      <div className="px-6 py-4">
        {loading ? (
          <div className="text-center py-20 text-gray-400">Loading MIS data...</div>
        ) : view === 'aging' ? (
          <div>
            {/* Aging Summary Cards */}
            <div className="grid grid-cols-6 gap-3 mb-6">
              <div className="bg-purple-50 rounded-xl p-4 col-span-1">
                <p className="text-xs text-gray-500">Total Outstanding</p>
                <p className="text-xl font-bold text-purple-700">{INR(totalOutstanding)}</p>
                <p className="text-xs text-gray-500 mt-1">{aging.length} claims</p>
              </div>
              {agingAgg.map(b => {
                const isRed = b.bucket === '120+' || b.bucket === '91-120';
                const isAmber = b.bucket === '61-90';
                return (
                  <div key={b.bucket} className={`rounded-xl p-4 ${isRed ? 'bg-red-50' : isAmber ? 'bg-amber-50' : 'bg-gray-50'}`}>
                    <p className="text-xs text-gray-500">{b.bucket} days</p>
                    <p className={`text-lg font-bold ${isRed ? 'text-red-700' : isAmber ? 'text-amber-700' : 'text-gray-700'}`}>{b.count}</p>
                    <p className={`text-xs font-medium ${isRed ? 'text-red-600' : isAmber ? 'text-amber-600' : 'text-gray-500'}`}>{INR(b.amount)}</p>
                  </div>
                );
              })}
            </div>

            {/* Aging bar chart (simple CSS bars) */}
            <div className="bg-white rounded-xl border p-5 mb-6">
              <h3 className="text-sm font-semibold text-gray-900 mb-4">Aging Distribution</h3>
              <div className="space-y-3">
                {agingAgg.map(b => {
                  const pct = totalOutstanding > 0 ? (b.amount / totalOutstanding) * 100 : 0;
                  const isRed = b.bucket === '120+' || b.bucket === '91-120';
                  return (
                    <div key={b.bucket} className="flex items-center gap-3">
                      <span className="text-xs font-medium text-gray-500 w-16 text-right">{b.bucket}d</span>
                      <div className="flex-1 bg-gray-100 rounded-full h-6 overflow-hidden">
                        <div className={`h-full rounded-full ${isRed ? 'bg-red-500' : b.bucket === '61-90' ? 'bg-amber-500' : 'bg-blue-500'}`}
                          style={{ width: `${Math.max(pct, 1)}%` }} />
                      </div>
                      <span className="text-xs font-medium text-gray-700 w-20 text-right">{INR(b.amount)}</span>
                      <span className="text-xs text-gray-400 w-12 text-right">{b.count}</span>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Aging detail table */}
            {aging.length > 0 && (
              <div className="bg-white rounded-xl border p-5">
                <h3 className="text-sm font-semibold text-gray-900 mb-3">Claims by Aging ({aging.length})</h3>
                <div className="overflow-x-auto max-h-96">
                  <table className="w-full text-xs">
                    <thead className="sticky top-0 bg-gray-50">
                      <tr className="border-b">
                        <th className="text-left py-2 px-2 font-medium">Claim</th>
                        <th className="text-left py-2 px-2 font-medium">Patient</th>
                        <th className="text-left py-2 px-2 font-medium">Payer</th>
                        <th className="text-right py-2 px-2 font-medium">Amount</th>
                        <th className="text-right py-2 px-2 font-medium">Days</th>
                        <th className="text-left py-2 px-2 font-medium">Bucket</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y">
                      {aging.sort((a, b) => (b.days_pending || 0) - (a.days_pending || 0)).map(a => (
                        <tr key={a.claim_id} className="hover:bg-gray-50">
                          <td className="py-1.5 px-2 font-mono text-blue-600">{a.claim_number}</td>
                          <td className="py-1.5 px-2">{a.patient_name}</td>
                          <td className="py-1.5 px-2 text-gray-500">{a.payer_name}</td>
                          <td className="py-1.5 px-2 text-right font-medium">{INR(a.claimed_amount)}</td>
                          <td className={`py-1.5 px-2 text-right font-bold ${a.days_pending > 90 ? 'text-red-600' : a.days_pending > 60 ? 'text-amber-600' : 'text-gray-700'}`}>
                            {a.days_pending}
                          </td>
                          <td className="py-1.5 px-2">{a.aging_bucket}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        ) : view === 'scorecard' ? (
          <div className="bg-white rounded-xl border p-5">
            <h3 className="text-sm font-semibold text-gray-900 mb-4">Payer Performance Scorecard</h3>
            {scorecard.length === 0 ? (
              <p className="text-center py-10 text-gray-400">No data yet — claims need to be processed first</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b bg-gray-50">
                      <th className="text-left py-2.5 px-3 font-medium text-gray-500">Payer</th>
                      <th className="text-left py-2.5 px-3 font-medium text-gray-500">Type</th>
                      <th className="text-right py-2.5 px-3 font-medium text-gray-500">Claims</th>
                      <th className="text-right py-2.5 px-3 font-medium text-gray-500">Settled</th>
                      <th className="text-right py-2.5 px-3 font-medium text-gray-500">Rejected</th>
                      <th className="text-right py-2.5 px-3 font-medium text-gray-500">Queries</th>
                      <th className="text-right py-2.5 px-3 font-medium text-gray-500">Avg Days</th>
                      <th className="text-right py-2.5 px-3 font-medium text-gray-500">Rejection %</th>
                      <th className="text-right py-2.5 px-3 font-medium text-gray-500">Claimed</th>
                      <th className="text-right py-2.5 px-3 font-medium text-gray-500">Settled</th>
                      <th className="text-right py-2.5 px-3 font-medium text-gray-500">Deductions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {scorecard.filter(s => s.total_claims > 0).map(s => (
                      <tr key={s.payer_id} className="hover:bg-gray-50">
                        <td className="py-2.5 px-3 font-medium">{s.payer_name}</td>
                        <td className="py-2.5 px-3 text-xs text-gray-500">{s.payer_type}</td>
                        <td className="py-2.5 px-3 text-right">{s.total_claims}</td>
                        <td className="py-2.5 px-3 text-right text-emerald-700 font-medium">{s.settled_count}</td>
                        <td className="py-2.5 px-3 text-right text-red-600">{s.rejected_count}</td>
                        <td className="py-2.5 px-3 text-right text-orange-600">{s.pending_queries}</td>
                        <td className={`py-2.5 px-3 text-right font-medium ${(s.avg_settlement_days || 0) > 60 ? 'text-red-600' : (s.avg_settlement_days || 0) > 30 ? 'text-amber-600' : 'text-green-600'}`}>
                          {s.avg_settlement_days || '—'}
                        </td>
                        <td className={`py-2.5 px-3 text-right ${(s.rejection_rate_pct || 0) > 10 ? 'text-red-600 font-medium' : 'text-gray-600'}`}>
                          {s.rejection_rate_pct || 0}%
                        </td>
                        <td className="py-2.5 px-3 text-right">{INR(s.total_claimed)}</td>
                        <td className="py-2.5 px-3 text-right text-emerald-700">{INR(s.total_settled)}</td>
                        <td className="py-2.5 px-3 text-right text-red-600">{INR(s.total_deductions)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        ) : (
          /* Status Breakdown */
          <div className="bg-white rounded-xl border p-5">
            <h3 className="text-sm font-semibold text-gray-900 mb-4">Claims by Status</h3>
            {statusBreakdown.length === 0 ? (
              <p className="text-center py-10 text-gray-400">No claims yet</p>
            ) : (
              <div className="space-y-2">
                {statusBreakdown.sort((a, b) => b.count - a.count).map(s => {
                  const total = statusBreakdown.reduce((sum, x) => sum + x.count, 0);
                  const pct = total > 0 ? (s.count / total) * 100 : 0;
                  return (
                    <div key={s.status} className="flex items-center gap-3">
                      <span className="text-xs font-medium text-gray-600 w-40 truncate">{s.status.replace(/_/g, ' ')}</span>
                      <div className="flex-1 bg-gray-100 rounded-full h-5 overflow-hidden">
                        <div className="h-full bg-blue-500 rounded-full" style={{ width: `${Math.max(pct, 2)}%` }} />
                      </div>
                      <span className="text-xs font-bold text-gray-700 w-10 text-right">{s.count}</span>
                      <span className="text-xs text-gray-500 w-20 text-right">{INR(s.amount)}</span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
