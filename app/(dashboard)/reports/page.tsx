'use client';
import React, { useState, useEffect } from 'react';
import { useReports } from '@/lib/revenue/phase2-hooks';
import { useAuthStore } from '@/lib/store/auth';

export default function ReportsPage() {
  const { activeCentreId } = useAuthStore();
  const centreId = activeCentreId || '';
  const { loading, getRevenueReport, getOPDReport } = useReports(centreId);
  const [activeReport, setActiveReport] = useState('revenue');
  const [dateFrom, setDateFrom] = useState(new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0]);
  const [dateTo, setDateTo] = useState(new Date().toISOString().split('T')[0]);
  const [revenueData, setRevenueData] = useState<any>(null);
  const [opdData, setOpdData] = useState<any>(null);

  const loadReport = async (type: string) => {
    setActiveReport(type);
    if (type === 'revenue') { const d = await getRevenueReport(dateFrom, dateTo); setRevenueData(d); }
    if (type === 'opd') { const d = await getOPDReport(dateFrom, dateTo); setOpdData(d); }
  };

  useEffect(() => { loadReport('revenue'); }, [dateFrom, dateTo]);

  return (
    <div className="max-w-6xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div><h1 className="text-2xl font-bold text-gray-900">Reports & MIS</h1><p className="text-sm text-gray-500">Operational analytics and management information</p></div>
        <div className="flex gap-2 items-center"><input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} className="text-sm border rounded-lg px-2 py-1.5" />
          <span className="text-gray-400">to</span><input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)} className="text-sm border rounded-lg px-2 py-1.5" />
          <button onClick={() => loadReport(activeReport)} className="px-3 py-1.5 bg-blue-600 text-white text-sm rounded-lg">Generate</button></div>
      </div>

      <div className="flex gap-2 mb-6">{[['revenue','Revenue Report'],['opd','OPD Report']].map(([k,l]) =>
        <button key={k} onClick={() => loadReport(k)} className={`px-4 py-2 text-sm rounded-lg border ${activeReport === k ? 'bg-blue-600 text-white border-blue-600' : 'bg-white border-gray-200'}`}>{l}</button>
      )}</div>

      {activeReport === 'revenue' && revenueData && <>
        <div className="grid grid-cols-4 gap-4 mb-6">
          <div className="bg-green-50 rounded-xl p-4"><div className="text-xs text-gray-500">Total revenue</div><div className="text-2xl font-bold text-green-700">Rs.{Math.round(revenueData.total).toLocaleString('en-IN')}</div></div>
          <div className="bg-blue-50 rounded-xl p-4"><div className="text-xs text-gray-500">Total bills</div><div className="text-2xl font-bold text-blue-700">{revenueData.daily.reduce((s: number, d: any) => s + d.count, 0)}</div></div>
          <div className="bg-purple-50 rounded-xl p-4"><div className="text-xs text-gray-500">Avg daily</div><div className="text-2xl font-bold text-purple-700">Rs.{revenueData.daily.length > 0 ? Math.round(revenueData.total / revenueData.daily.length).toLocaleString('en-IN') : '0'}</div></div>
          <div className="bg-orange-50 rounded-xl p-4"><div className="text-xs text-gray-500">Collection rate</div><div className="text-2xl font-bold text-orange-700">{revenueData.total > 0 ? Math.round(revenueData.daily.reduce((s: number, d: any) => s + d.collected, 0) / revenueData.total * 100) : 0}%</div></div>
        </div>

        <div className="grid grid-cols-2 gap-6 mb-6">
          {/* Daily breakdown */}
          <div className="bg-white rounded-xl border p-5"><h3 className="font-semibold text-sm mb-3">Daily revenue</h3>
            {revenueData.daily.length === 0 ? <p className="text-sm text-gray-400">No data</p> :
            <div className="space-y-1">{revenueData.daily.map((d: any) => (
              <div key={d.date} className="flex items-center justify-between py-1.5 border-b last:border-0">
                <span className="text-sm">{d.date}</span>
                <div className="text-right"><span className="text-sm font-medium">Rs.{Math.round(d.gross).toLocaleString('en-IN')}</span>
                  <span className="text-xs text-green-600 ml-2">(Rs.{Math.round(d.collected).toLocaleString('en-IN')} collected)</span>
                  <span className="text-xs text-gray-400 ml-2">{d.count} bills</span></div>
              </div>
            ))}</div>}
          </div>

          {/* By type + payor */}
          <div className="space-y-6">
            <div className="bg-white rounded-xl border p-5"><h3 className="font-semibold text-sm mb-3">By bill type</h3>
              {revenueData.byType.length === 0 ? <p className="text-sm text-gray-400">No data</p> :
              <div className="space-y-2">{revenueData.byType.map((t: any) => (
                <div key={t.type} className="flex items-center justify-between">
                  <span className="text-sm uppercase">{t.type}</span>
                  <div className="flex items-center gap-2"><div className="w-32 h-2 bg-gray-100 rounded-full overflow-hidden"><div className="h-full bg-blue-500 rounded-full" style={{ width: `${(t.amount / revenueData.total) * 100}%` }} /></div>
                    <span className="text-sm font-medium w-24 text-right">Rs.{Math.round(t.amount).toLocaleString('en-IN')}</span></div>
                </div>
              ))}</div>}
            </div>
            <div className="bg-white rounded-xl border p-5"><h3 className="font-semibold text-sm mb-3">By payor</h3>
              {revenueData.byPayor.length === 0 ? <p className="text-sm text-gray-400">No data</p> :
              <div className="space-y-2">{revenueData.byPayor.map((p: any) => (
                <div key={p.payor} className="flex items-center justify-between">
                  <span className="text-sm">{p.payor}</span>
                  <span className="text-sm font-medium">Rs.{Math.round(p.amount).toLocaleString('en-IN')}</span>
                </div>
              ))}</div>}
            </div>
          </div>
        </div>
      </>}

      {activeReport === 'opd' && opdData && <>
        <div className="grid grid-cols-3 gap-4 mb-6">
          <div className="bg-blue-50 rounded-xl p-4"><div className="text-xs text-gray-500">Total OPD visits</div><div className="text-2xl font-bold text-blue-700">{opdData.total}</div></div>
          <div className="bg-green-50 rounded-xl p-4"><div className="text-xs text-gray-500">Avg daily</div><div className="text-2xl font-bold text-green-700">{opdData.daily.length > 0 ? Math.round(opdData.total / opdData.daily.length) : 0}</div></div>
          <div className="bg-purple-50 rounded-xl p-4"><div className="text-xs text-gray-500">Doctors active</div><div className="text-2xl font-bold text-purple-700">{opdData.byDoctor.length}</div></div>
        </div>

        <div className="grid grid-cols-2 gap-6">
          <div className="bg-white rounded-xl border p-5"><h3 className="font-semibold text-sm mb-3">Daily OPD count</h3>
            {opdData.daily.map((d: any) => (
              <div key={d.date} className="flex items-center justify-between py-1.5 border-b last:border-0">
                <span className="text-sm">{d.date}</span><span className="text-sm font-medium">{d.count} visits</span></div>
            ))}
          </div>
          <div className="bg-white rounded-xl border p-5"><h3 className="font-semibold text-sm mb-3">By doctor</h3>
            {opdData.byDoctor.map((d: any) => (
              <div key={d.doctor} className="flex items-center justify-between py-1.5 border-b last:border-0">
                <span className="text-sm">{d.doctor}</span>
                <div className="flex items-center gap-2"><div className="w-24 h-2 bg-gray-100 rounded-full overflow-hidden"><div className="h-full bg-purple-500 rounded-full" style={{ width: `${(d.count / opdData.total) * 100}%` }} /></div>
                  <span className="text-sm font-medium">{d.count}</span></div>
              </div>
            ))}
          </div>
        </div>
      </>}
    </div>
  );
}
