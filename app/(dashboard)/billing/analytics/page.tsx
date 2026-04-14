// @ts-nocheck
// HEALTH1 HMIS — BILLING ANALYTICS
'use client';
import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, TrendingUp, TrendingDown, BarChart3, PieChart, AlertTriangle, IndianRupee, Calendar, Download, RefreshCw, Bed, Users, Stethoscope, Activity } from 'lucide-react';

interface AnalyticsData {
  revenue_trend: Array<{ date: string; amount: number }>;
  arpob: { current: number; previous: number; change: number };
  payor_mix: Array<{ payor_type: string; amount: number; percentage: number }>;
  dept_revenue: Array<{ department: string; gross: number; net: number; items: number }>;
  doctor_revenue: Array<{ doctor_name: string; department: string; revenue: number; items: number }>;
  collection_efficiency: { billed: number; collected: number; ratio: number };
  leakage_items: Array<{ type: string; description: string; date: string; patient_id: string }>;
}

export default function BillingAnalyticsPage() {
  const router = useRouter();
  const [period, setPeriod] = useState<'today' | '7d' | '30d' | 'mtd' | 'ytd'>('mtd');
  const [data, setData] = useState<AnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeReport, setActiveReport] = useState<string>('overview');
  const centreId = 'CURRENT_CENTRE_ID';

  const loadData = useCallback(async () => {
    setLoading(true);
    try { const res = await fetch(`/api/billing/analytics?centre_id=${centreId}&period=${period}`); if (res.ok) setData(await res.json()); } catch {}
    setLoading(false);
  }, [centreId, period]);
  useEffect(() => { loadData(); }, [loadData]);

  const fmt = (n: number) => {
    if (n >= 10000000) return `₹${(n / 10000000).toFixed(1)} Cr`;
    if (n >= 100000) return `₹${(n / 100000).toFixed(1)}L`;
    if (n >= 1000) return `₹${(n / 1000).toFixed(1)}K`;
    return `₹${n.toLocaleString('en-IN')}`;
  };

  const reports = [
    { id: 'overview', label: 'Overview', icon: BarChart3 },
    { id: 'payor_mix', label: 'Payor Mix', icon: PieChart },
    { id: 'dept_pl', label: 'Department P&L', icon: TrendingUp },
    { id: 'doctor_rev', label: 'Doctor Revenue', icon: Stethoscope },
    { id: 'leakage', label: 'Revenue Leakage', icon: AlertTriangle },
  ];

  const payorColors: Record<string, string> = {
    SELF_PAY: 'bg-emerald-500', PMJAY: 'bg-amber-500', TPA: 'bg-blue-500',
    CORPORATE: 'bg-purple-500', CGHS: 'bg-teal-500', STAFF: 'bg-gray-500', OTHER_SCHEME: 'bg-pink-500',
  };

  return (
    <div className="min-h-screen bg-[#F8FAFC]">
      <div className="border-b border-gray-200 bg-white px-6 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button onClick={() => router.push('/billing')} className="p-1.5 rounded-lg hover:bg-gray-100"><ArrowLeft className="h-5 w-5 text-gray-600" /></button>
            <div><h1 className="text-lg font-bold text-[#0A2540] flex items-center gap-2"><TrendingUp className="h-5 w-5 text-emerald-500" /> Revenue Analytics</h1>
            <p className="text-xs text-gray-500">ARPOB, payor mix, department P&L, doctor revenue</p></div>
          </div>
          <div className="flex items-center gap-3">
            <div className="flex gap-0.5 bg-gray-100 rounded-lg p-0.5">
              {[{ id: 'today', label: 'Today' }, { id: '7d', label: '7 Days' }, { id: 'mtd', label: 'MTD' }, { id: 'ytd', label: 'YTD' }].map(p => (
                <button key={p.id} onClick={() => setPeriod(p.id as any)} className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${period === p.id ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500'}`}>{p.label}</button>
              ))}
            </div>
            <button className="inline-flex items-center gap-1.5 rounded-lg bg-[#0A2540] px-4 py-2 text-sm font-medium text-white"><Download className="h-4 w-4" /> Export</button>
          </div>
        </div>
      </div>

      <div className="px-6 py-5 space-y-5">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <div className="rounded-xl border border-gray-200 bg-white p-4">
            <p className="text-[10px] font-semibold text-gray-500 uppercase">Net Revenue</p>
            <p className="text-2xl font-bold font-mono text-gray-900 mt-1">{fmt(data?.collection_efficiency?.billed || 0)}</p>
            <p className="text-xs text-gray-500 mt-0.5">{period === 'mtd' ? 'This Month' : period}</p>
          </div>
          <div className="rounded-xl border border-gray-200 bg-white p-4">
            <p className="text-[10px] font-semibold text-gray-500 uppercase">Collected</p>
            <p className="text-2xl font-bold font-mono text-emerald-700 mt-1">{fmt(data?.collection_efficiency?.collected || 0)}</p>
            <p className="text-xs text-gray-500 mt-0.5">{((data?.collection_efficiency?.ratio || 0) * 100).toFixed(0)}% efficiency</p>
          </div>
          <div className="rounded-xl border border-gray-200 bg-white p-4">
            <div className="flex items-center justify-between">
              <p className="text-[10px] font-semibold text-gray-500 uppercase">ARPOB</p>
              {data?.arpob?.change !== 0 && <span className={`text-[10px] font-bold ${(data?.arpob?.change || 0) > 0 ? 'text-emerald-600' : 'text-red-600'}`}>{(data?.arpob?.change || 0) > 0 ? '↑' : '↓'}{Math.abs(data?.arpob?.change || 0).toFixed(1)}%</span>}
            </div>
            <p className="text-2xl font-bold font-mono text-gray-900 mt-1">{fmt(data?.arpob?.current || 0)}</p>
            <p className="text-xs text-gray-500 mt-0.5">vs {fmt(data?.arpob?.previous || 0)} prev</p>
          </div>
          <div className="rounded-xl border border-gray-200 bg-white p-4">
            <p className="text-[10px] font-semibold text-gray-500 uppercase">Revenue Leakage</p>
            <p className="text-2xl font-bold font-mono text-red-600 mt-1">{data?.leakage_items?.length || 0}</p>
            <p className="text-xs text-gray-500 mt-0.5">unbilled items detected</p>
          </div>
        </div>

        <div className="flex gap-1 bg-gray-100 rounded-lg p-1 w-fit">
          {reports.map(r => (
            <button key={r.id} onClick={() => setActiveReport(r.id)} className={`inline-flex items-center gap-1.5 px-4 py-2 rounded-md text-sm font-medium transition-colors ${activeReport === r.id ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}>
              <r.icon className="h-3.5 w-3.5" /> {r.label}
            </button>
          ))}
        </div>

        {activeReport === 'payor_mix' && (
          <div className="bg-white rounded-xl border border-gray-200 p-5">
            <h3 className="text-sm font-bold text-gray-900 mb-4">Revenue by Payor Type</h3>
            <div className="h-8 rounded-lg overflow-hidden flex mb-4">
              {(data?.payor_mix || []).filter(pm => pm.percentage > 0).map(pm => (
                <div key={pm.payor_type} className={`${payorColors[pm.payor_type] || 'bg-gray-400'} flex items-center justify-center`} style={{ width: `${pm.percentage}%` }}>
                  {pm.percentage > 8 && <span className="text-[10px] font-bold text-white">{pm.percentage.toFixed(0)}%</span>}
                </div>
              ))}
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {(data?.payor_mix || []).map(pm => (
                <div key={pm.payor_type} className="flex items-center gap-2">
                  <div className={`h-3 w-3 rounded-sm ${payorColors[pm.payor_type] || 'bg-gray-400'}`} />
                  <div><p className="text-xs font-medium text-gray-700">{pm.payor_type.replace(/_/g, ' ')}</p><p className="text-sm font-bold font-mono text-gray-900">{fmt(pm.amount)}</p></div>
                </div>
              ))}
            </div>
          </div>
        )}

        {activeReport === 'dept_pl' && (
          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
            <div className="px-5 py-3 border-b"><h3 className="text-sm font-bold text-gray-900">Department Revenue</h3></div>
            <table className="w-full">
              <thead><tr className="bg-gray-50/80"><th className="px-4 py-2.5 text-left text-[10px] font-semibold text-gray-500 uppercase">Department</th><th className="px-4 py-2.5 text-right text-[10px] font-semibold text-gray-500 uppercase">Gross</th><th className="px-4 py-2.5 text-right text-[10px] font-semibold text-gray-500 uppercase">Net</th><th className="px-4 py-2.5 text-right text-[10px] font-semibold text-gray-500 uppercase">Items</th></tr></thead>
              <tbody>
                {(data?.dept_revenue || []).sort((a, b) => b.net - a.net).map(d => (
                  <tr key={d.department} className="border-b border-gray-50 hover:bg-gray-50/50">
                    <td className="px-4 py-2.5 text-sm font-medium text-gray-900">{d.department}</td>
                    <td className="px-4 py-2.5 text-right text-xs font-mono text-gray-600">{fmt(d.gross)}</td>
                    <td className="px-4 py-2.5 text-right text-sm font-mono font-semibold text-gray-900">{fmt(d.net)}</td>
                    <td className="px-4 py-2.5 text-right text-xs font-mono text-gray-500">{d.items}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {activeReport === 'doctor_rev' && (
          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
            <div className="px-5 py-3 border-b"><h3 className="text-sm font-bold text-gray-900">Doctor-Wise Revenue</h3></div>
            <table className="w-full">
              <thead><tr className="bg-gray-50/80"><th className="px-4 py-2.5 text-left text-[10px] font-semibold text-gray-500 uppercase">Doctor</th><th className="px-4 py-2.5 text-left text-[10px] font-semibold text-gray-500 uppercase">Department</th><th className="px-4 py-2.5 text-right text-[10px] font-semibold text-gray-500 uppercase">Revenue</th><th className="px-4 py-2.5 text-right text-[10px] font-semibold text-gray-500 uppercase">Services</th></tr></thead>
              <tbody>
                {(data?.doctor_revenue || []).sort((a, b) => b.revenue - a.revenue).map((d, idx) => (
                  <tr key={idx} className="border-b border-gray-50 hover:bg-gray-50/50">
                    <td className="px-4 py-2.5 text-sm font-medium text-gray-900">{d.doctor_name}</td>
                    <td className="px-4 py-2.5 text-xs text-gray-600">{d.department}</td>
                    <td className="px-4 py-2.5 text-right text-sm font-mono font-bold text-gray-900">{fmt(d.revenue)}</td>
                    <td className="px-4 py-2.5 text-right text-xs font-mono text-gray-500">{d.items}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {activeReport === 'leakage' && (
          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
            <div className="px-5 py-3 border-b bg-red-50 flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-red-500" />
              <h3 className="text-sm font-bold text-red-800">Revenue Leakage Detection</h3>
            </div>
            {(data?.leakage_items || []).length > 0 ? (
              <table className="w-full">
                <thead><tr className="bg-gray-50/80"><th className="px-4 py-2.5 text-left text-[10px] font-semibold text-gray-500 uppercase">Type</th><th className="px-4 py-2.5 text-left text-[10px] font-semibold text-gray-500 uppercase">Description</th><th className="px-4 py-2.5 text-left text-[10px] font-semibold text-gray-500 uppercase">Date</th></tr></thead>
                <tbody>
                  {(data?.leakage_items || []).map((item, idx) => (
                    <tr key={idx} className="border-b border-gray-50">
                      <td className="px-4 py-2.5"><span className="text-[10px] font-medium bg-red-50 text-red-700 px-2 py-0.5 rounded">{item.type}</span></td>
                      <td className="px-4 py-2.5 text-sm text-gray-900">{item.description}</td>
                      <td className="px-4 py-2.5 text-xs text-gray-500">{item.date}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <div className="p-8 text-center">
                <Activity className="h-8 w-8 text-emerald-400 mx-auto mb-2" />
                <p className="text-sm font-medium text-emerald-700">No revenue leakage detected</p>
                <p className="text-xs text-gray-400 mt-1">All clinical orders have corresponding billing entries</p>
              </div>
            )}
          </div>
        )}

        {activeReport === 'overview' && (
          <div className="text-center text-gray-400 py-8">
            <BarChart3 className="h-10 w-10 mx-auto mb-3 text-gray-300" />
            <p className="text-sm font-medium text-gray-600">Select a report tab above</p>
            <p className="text-xs mt-1">Payor Mix, Department P&L, Doctor Revenue, or Revenue Leakage</p>
          </div>
        )}
      </div>
    </div>
  );
}
