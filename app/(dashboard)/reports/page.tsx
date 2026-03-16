'use client';
import React, { useState, useEffect } from 'react';
import { useReports } from '@/lib/revenue/phase2-hooks';
import { RoleGuard, TableSkeleton, StatusBadge } from '@/components/ui/shared';
import { useAuthStore } from '@/lib/store/auth';

function ReportsPageInner() {
  const { activeCentreId } = useAuthStore();
  const centreId = activeCentreId || '';
  const { loading, getRevenueReport, getOPDReport, getPharmacyReport, getLabReport, getIPDReport } = useReports(centreId);
  const [activeReport, setActiveReport] = useState('revenue');
  const [dateFrom, setDateFrom] = useState(new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0]);
  const [dateTo, setDateTo] = useState(new Date().toISOString().split('T')[0]);
  const [data, setData] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(false);

  const loadReport = async (type: string) => {
    setActiveReport(type);
    setIsLoading(true);
    try {
      if (type === 'revenue') setData(await getRevenueReport(dateFrom, dateTo));
      else if (type === 'opd') setData(await getOPDReport(dateFrom, dateTo));
      else if (type === 'pharmacy') setData(await getPharmacyReport(dateFrom, dateTo));
      else if (type === 'lab') setData(await getLabReport(dateFrom, dateTo));
      else if (type === 'ipd') setData(await getIPDReport(dateFrom, dateTo));
    } catch (e) { console.error('Report error:', e); }
    setIsLoading(false);
  };

  useEffect(() => { loadReport('revenue'); }, []);

  const BarViz = ({ value, max, color = 'bg-blue-500' }: { value: number; max: number; color?: string }) => (
    <div className="w-28 h-2 bg-gray-100 rounded-full overflow-hidden inline-block align-middle ml-2">
      <div className={`h-full ${color} rounded-full`} style={{ width: `${max > 0 ? (value / max) * 100 : 0}%` }} />
    </div>
  );

  return (
    <div className="max-w-6xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div><h1 className="text-2xl font-bold text-gray-900">Reports & MIS</h1><p className="text-sm text-gray-500">Operational analytics and management information</p></div>
        <div className="flex gap-2 items-center">
          <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} className="text-sm border rounded-lg px-2 py-1.5" />
          <span className="text-gray-400 text-sm">to</span>
          <input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)} className="text-sm border rounded-lg px-2 py-1.5" />
          <button onClick={() => loadReport(activeReport)} className="px-3 py-1.5 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700">Generate</button>
        </div>
      </div>

      <div className="flex gap-1.5 mb-6 flex-wrap">{[['revenue','Revenue'],['opd','OPD'],['pharmacy','Pharmacy'],['lab','Laboratory'],['ipd','IPD']].map(([k,l]) =>
        <button key={k} onClick={() => loadReport(k)} className={`px-4 py-2 text-sm rounded-lg border ${activeReport === k ? 'bg-blue-600 text-white border-blue-600' : 'bg-white border-gray-200 hover:border-blue-300'}`}>{l}</button>
      )}</div>

      {isLoading ? <TableSkeleton rows={6} cols={5} /> : !data ? <div className="text-center py-12 text-gray-400 text-sm">Select a report and click Generate</div> : <>

        {/* ===== REVENUE ===== */}
        {activeReport === 'revenue' && <>
          <div className="grid grid-cols-4 gap-4 mb-6">
            <div className="bg-green-50 rounded-xl p-4"><div className="text-xs text-gray-500">Total revenue</div><div className="text-2xl font-bold text-green-700">Rs.{Math.round(data.total).toLocaleString('en-IN')}</div></div>
            <div className="bg-blue-50 rounded-xl p-4"><div className="text-xs text-gray-500">Total bills</div><div className="text-2xl font-bold text-blue-700">{data.daily.reduce((s: number, d: any) => s + d.count, 0)}</div></div>
            <div className="bg-purple-50 rounded-xl p-4"><div className="text-xs text-gray-500">Avg daily</div><div className="text-2xl font-bold text-purple-700">Rs.{data.daily.length > 0 ? Math.round(data.total / data.daily.length).toLocaleString('en-IN') : '0'}</div></div>
            <div className="bg-orange-50 rounded-xl p-4"><div className="text-xs text-gray-500">Collection rate</div><div className="text-2xl font-bold text-orange-700">{data.total > 0 ? Math.round(data.daily.reduce((s: number, d: any) => s + d.collected, 0) / data.total * 100) : 0}%</div></div>
          </div>
          <div className="grid grid-cols-2 gap-6">
            <div className="bg-white rounded-xl border p-5"><h3 className="font-semibold text-sm mb-3">Daily revenue</h3>
              {data.daily.length === 0 ? <p className="text-sm text-gray-400">No data</p> :
              <div className="space-y-1">{data.daily.map((d: any) => (
                <div key={d.date} className="flex items-center justify-between py-1.5 border-b last:border-0 text-sm">
                  <span>{d.date}</span>
                  <div><span className="font-medium">Rs.{Math.round(d.gross).toLocaleString('en-IN')}</span>
                    <span className="text-xs text-green-600 ml-2">({Math.round(d.collected).toLocaleString('en-IN')} collected)</span>
                    <span className="text-xs text-gray-400 ml-1">{d.count} bills</span></div>
                </div>
              ))}</div>}
            </div>
            <div className="space-y-4">
              <div className="bg-white rounded-xl border p-5"><h3 className="font-semibold text-sm mb-3">By bill type</h3>
                {data.byType.map((t: any) => <div key={t.type} className="flex items-center justify-between py-1 text-sm">
                  <span className="uppercase text-xs">{t.type}</span><span className="font-medium">Rs.{Math.round(t.amount).toLocaleString('en-IN')}</span><BarViz value={t.amount} max={data.total} /></div>)}</div>
              <div className="bg-white rounded-xl border p-5"><h3 className="font-semibold text-sm mb-3">By payor</h3>
                {data.byPayor.map((p: any) => <div key={p.payor} className="flex items-center justify-between py-1 text-sm">
                  <span>{p.payor}</span><span className="font-medium">Rs.{Math.round(p.amount).toLocaleString('en-IN')}</span><BarViz value={p.amount} max={data.total} color="bg-teal-500" /></div>)}</div>
            </div>
          </div>
        </>}

        {/* ===== OPD ===== */}
        {activeReport === 'opd' && <>
          <div className="grid grid-cols-3 gap-4 mb-6">
            <div className="bg-blue-50 rounded-xl p-4"><div className="text-xs text-gray-500">Total OPD visits</div><div className="text-2xl font-bold text-blue-700">{data.total}</div></div>
            <div className="bg-green-50 rounded-xl p-4"><div className="text-xs text-gray-500">Avg daily</div><div className="text-2xl font-bold text-green-700">{data.daily.length > 0 ? Math.round(data.total / data.daily.length) : 0}</div></div>
            <div className="bg-purple-50 rounded-xl p-4"><div className="text-xs text-gray-500">Doctors active</div><div className="text-2xl font-bold text-purple-700">{data.byDoctor.length}</div></div>
          </div>
          <div className="grid grid-cols-2 gap-6">
            <div className="bg-white rounded-xl border p-5"><h3 className="font-semibold text-sm mb-3">Daily OPD count</h3>
              {data.daily.map((d: any) => <div key={d.date} className="flex items-center justify-between py-1.5 border-b last:border-0 text-sm"><span>{d.date}</span><span className="font-medium">{d.count}</span></div>)}</div>
            <div className="bg-white rounded-xl border p-5"><h3 className="font-semibold text-sm mb-3">By doctor</h3>
              {data.byDoctor.map((d: any) => <div key={d.doctor} className="flex items-center justify-between py-1.5 border-b last:border-0 text-sm">
                <span>{d.doctor}</span><span className="font-medium">{d.count}</span><BarViz value={d.count} max={data.total} color="bg-purple-500" /></div>)}</div>
          </div>
        </>}

        {/* ===== PHARMACY ===== */}
        {activeReport === 'pharmacy' && <>
          <div className="grid grid-cols-4 gap-4 mb-6">
            <div className="bg-green-50 rounded-xl p-4"><div className="text-xs text-gray-500">Total Rx revenue</div><div className="text-2xl font-bold text-green-700">Rs.{Math.round(data.totalAmount).toLocaleString('en-IN')}</div></div>
            <div className="bg-blue-50 rounded-xl p-4"><div className="text-xs text-gray-500">Total orders</div><div className="text-2xl font-bold text-blue-700">{data.totalOrders}</div></div>
            <div className="bg-purple-50 rounded-xl p-4"><div className="text-xs text-gray-500">Dispensed</div><div className="text-2xl font-bold text-purple-700">{data.dispensed}</div></div>
            <div className="bg-yellow-50 rounded-xl p-4"><div className="text-xs text-gray-500">Pending</div><div className="text-2xl font-bold text-yellow-700">{data.pending}</div></div>
          </div>
          {data.orders.length === 0 ? <div className="text-center py-8 text-gray-400 text-sm">No pharmacy orders in this period</div> :
          <div className="bg-white rounded-xl border overflow-hidden"><table className="w-full text-sm"><thead><tr className="bg-gray-50 border-b">
            <th className="text-left p-3 font-medium text-gray-500">Patient</th><th className="text-left p-3 font-medium text-gray-500">Date</th>
            <th className="text-right p-3 font-medium text-gray-500">Amount</th><th className="text-left p-3 font-medium text-gray-500">Status</th>
          </tr></thead><tbody>{data.orders.slice(0, 50).map((o: any, i: number) => (
            <tr key={i} className="border-b hover:bg-gray-50"><td className="p-3">{o.name}</td><td className="p-3 text-xs">{o.date}</td>
              <td className="p-3 text-right font-medium">{o.amount > 0 ? 'Rs.' + Math.round(o.amount).toLocaleString('en-IN') : '--'}</td>
              <td className="p-3"><StatusBadge status={o.status} /></td></tr>
          ))}</tbody></table></div>}
        </>}

        {/* ===== LAB ===== */}
        {activeReport === 'lab' && <>
          <div className="grid grid-cols-4 gap-4 mb-6">
            <div className="bg-blue-50 rounded-xl p-4"><div className="text-xs text-gray-500">Total tests ordered</div><div className="text-2xl font-bold text-blue-700">{data.totalTests}</div></div>
            <div className="bg-green-50 rounded-xl p-4"><div className="text-xs text-gray-500">Results entered</div><div className="text-2xl font-bold text-green-700">{data.completed}</div></div>
            <div className="bg-yellow-50 rounded-xl p-4"><div className="text-xs text-gray-500">Pending</div><div className="text-2xl font-bold text-yellow-700">{data.pending}</div></div>
            <div className="bg-purple-50 rounded-xl p-4"><div className="text-xs text-gray-500">Completion rate</div><div className="text-2xl font-bold text-purple-700">{data.totalTests > 0 ? Math.round(data.completed / data.totalTests * 100) : 0}%</div></div>
          </div>
          {data.encounters.length === 0 ? <div className="text-center py-8 text-gray-400 text-sm">No lab orders in this period</div> :
          <div className="bg-white rounded-xl border overflow-hidden"><table className="w-full text-sm"><thead><tr className="bg-gray-50 border-b">
            <th className="text-left p-3 font-medium text-gray-500">Patient</th><th className="text-left p-3 font-medium text-gray-500">Doctor</th>
            <th className="text-left p-3 font-medium text-gray-500">Date</th><th className="text-center p-3 font-medium text-gray-500">Tests</th>
            <th className="text-center p-3 font-medium text-gray-500">Done</th><th className="text-center p-3 font-medium text-gray-500">Progress</th>
          </tr></thead><tbody>{data.encounters.slice(0, 50).map((e: any, i: number) => (
            <tr key={i} className="border-b hover:bg-gray-50">
              <td className="p-3">{e.patient}</td><td className="p-3 text-xs">{e.doctor}</td><td className="p-3 text-xs">{e.date}</td>
              <td className="p-3 text-center">{e.tests}</td><td className="p-3 text-center text-green-600">{e.done}</td>
              <td className="p-3 text-center"><div className="w-20 h-2 bg-gray-100 rounded-full overflow-hidden mx-auto"><div className="h-full bg-green-500 rounded-full" style={{ width: `${e.tests > 0 ? (e.done / e.tests) * 100 : 0}%` }} /></div></td>
            </tr>
          ))}</tbody></table></div>}
        </>}

        {/* ===== IPD ===== */}
        {activeReport === 'ipd' && <>
          <div className="grid grid-cols-5 gap-4 mb-6">
            <div className="bg-blue-50 rounded-xl p-4"><div className="text-xs text-gray-500">Total admissions</div><div className="text-2xl font-bold text-blue-700">{data.total}</div></div>
            <div className="bg-green-50 rounded-xl p-4"><div className="text-xs text-gray-500">Active</div><div className="text-2xl font-bold text-green-700">{data.active}</div></div>
            <div className="bg-purple-50 rounded-xl p-4"><div className="text-xs text-gray-500">Discharged</div><div className="text-2xl font-bold text-purple-700">{data.discharged}</div></div>
            <div className="bg-orange-50 rounded-xl p-4"><div className="text-xs text-gray-500">Avg LOS</div><div className="text-2xl font-bold text-orange-700">{data.avgLOS} days</div></div>
            <div className="bg-gray-50 rounded-xl p-4"><div className="text-xs text-gray-500">Departments</div><div className="text-2xl font-bold">{data.byDept.length}</div></div>
          </div>
          <div className="grid grid-cols-2 gap-6 mb-6">
            <div className="bg-white rounded-xl border p-5"><h3 className="font-semibold text-sm mb-3">By department</h3>
              {data.byDept.map((d: any) => <div key={d.dept} className="flex items-center justify-between py-1.5 border-b last:border-0 text-sm">
                <span>{d.dept}</span><span className="font-medium">{d.count}</span><BarViz value={d.count} max={data.total} /></div>)}</div>
            <div className="bg-white rounded-xl border p-5"><h3 className="font-semibold text-sm mb-3">By payor</h3>
              {data.byPayor.map((p: any) => <div key={p.payor} className="flex items-center justify-between py-1.5 border-b last:border-0 text-sm">
                <span>{p.payor}</span><span className="font-medium">{p.count}</span><BarViz value={p.count} max={data.total} color="bg-teal-500" /></div>)}</div>
          </div>
          {data.admissions.length > 0 && <div className="bg-white rounded-xl border overflow-hidden"><table className="w-full text-sm"><thead><tr className="bg-gray-50 border-b">
            <th className="text-left p-3 font-medium text-gray-500">Patient</th><th className="text-left p-3 font-medium text-gray-500">Dept</th>
            <th className="text-left p-3 font-medium text-gray-500">Type</th><th className="text-left p-3 font-medium text-gray-500">Payor</th>
            <th className="text-left p-3 font-medium text-gray-500">Date</th><th className="text-left p-3 font-medium text-gray-500">Status</th>
          </tr></thead><tbody>{data.admissions.slice(0, 50).map((a: any, i: number) => (
            <tr key={i} className="border-b hover:bg-gray-50"><td className="p-3">{a.patient}</td><td className="p-3 text-xs">{a.dept}</td>
              <td className="p-3 text-xs">{a.type}</td><td className="p-3 text-xs">{a.payor}</td><td className="p-3 text-xs">{a.date}</td>
              <td className="p-3"><StatusBadge status={a.status} /></td></tr>
          ))}</tbody></table></div>}
        </>}
      </>}
    </div>
  );
}

export default function ReportsPage() { return <RoleGuard module="reports"><ReportsPageInner /></RoleGuard>; }
