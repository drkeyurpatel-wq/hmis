// components/lab/patient-lab-history.tsx
// Embeddable: <PatientLabHistory patientId={id} />
// Shows all lab results for a patient — cumulative, with trends, critical flags
'use client';
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { sb } from '@/lib/supabase/browser';

interface LabResult {
  orderId: string; testName: string; testCode: string; department: string;
  status: string; orderedDate: string; results: ResultParam[];
}
interface ResultParam {
  name: string; value: string; unit: string; refRange: string;
  isAbnormal: boolean; isCritical: boolean; flag: string;
}

interface Props { patientId: string; compact?: boolean; admissionId?: string; }

export default function PatientLabHistory({ patientId, compact = false, admissionId }: Props) {
  const [orders, setOrders] = useState<LabResult[]>([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [filter, setFilter] = useState<'all' | 'abnormal' | 'critical'>('all');

  const load = useCallback(async () => {
    if (!patientId || !sb()) { setLoading(false); return; }
    setLoading(true);

    let q = sb().from('hmis_lab_orders')
      .select(`id, status, created_at, test:hmis_lab_test_master(test_name, test_code, department),
        results:hmis_lab_results(id, parameter_name, result_value, unit, reference_range, is_abnormal, is_critical, flag)`)
      .eq('patient_id', patientId)
      .order('created_at', { ascending: false }).limit(100);

    if (admissionId) q = q.eq('admission_id', admissionId);

    const { data } = await q;

    setOrders((data || []).map((o: any) => ({
      orderId: o.id, testName: o.test?.test_name || 'Unknown', testCode: o.test?.test_code || '',
      department: o.test?.department || '', status: o.status, orderedDate: o.created_at,
      results: (o.results || []).map((r: any) => ({
        name: r.parameter_name, value: r.result_value, unit: r.unit || '',
        refRange: r.reference_range || '', isAbnormal: r.is_abnormal, isCritical: r.is_critical,
        flag: r.is_critical ? 'CRIT' : r.is_abnormal ? 'ABN' : '',
      })),
    })));
    setLoading(false);
  }, [patientId, admissionId]);

  useEffect(() => { load(); }, [load]);

  const stats = useMemo(() => ({
    total: orders.length,
    completed: orders.filter(o => o.status === 'completed').length,
    pending: orders.filter(o => ['ordered', 'sample_collected', 'processing'].includes(o.status)).length,
    abnormal: orders.filter(o => o.results.some(r => r.isAbnormal)).length,
    critical: orders.filter(o => o.results.some(r => r.isCritical)).length,
  }), [orders]);

  const filtered = useMemo(() => {
    if (filter === 'abnormal') return orders.filter(o => o.results.some(r => r.isAbnormal));
    if (filter === 'critical') return orders.filter(o => o.results.some(r => r.isCritical));
    return orders;
  }, [orders, filter]);

  if (loading) return <div className="animate-pulse space-y-2">{[1,2,3].map(i => <div key={i} className="h-12 bg-gray-200 rounded-lg" />)}</div>;

  if (compact) return (
    <div className="bg-white rounded-xl border p-3">
      <div className="flex items-center justify-between mb-2">
        <h3 className="text-xs font-bold text-gray-700">Lab Results ({stats.total})</h3>
        <div className="flex gap-1">
          {stats.critical > 0 && <span className="text-[9px] bg-red-600 text-white px-1.5 py-0.5 rounded">{stats.critical} CRIT</span>}
          {stats.abnormal > 0 && <span className="text-[9px] bg-amber-500 text-white px-1.5 py-0.5 rounded">{stats.abnormal} ABN</span>}
          {stats.pending > 0 && <span className="text-[9px] bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded">{stats.pending} pending</span>}
        </div>
      </div>
      <div className="space-y-1">{filtered.slice(0, 6).map(o => (
        <div key={o.orderId} className={`flex items-center justify-between px-2 py-1.5 rounded text-xs ${o.results.some(r => r.isCritical) ? 'bg-red-50' : o.results.some(r => r.isAbnormal) ? 'bg-amber-50' : 'bg-gray-50'}`}>
          <span className="font-medium">{o.testName}</span>
          <div className="flex items-center gap-1">
            <span className={`text-[9px] px-1 py-0.5 rounded ${o.status === 'completed' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>{o.status}</span>
            <span className="text-[10px] text-gray-400">{new Date(o.orderedDate).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })}</span>
          </div>
        </div>
      ))}</div>
      {orders.length > 6 && <div className="text-center text-[10px] text-gray-400 mt-1">+ {orders.length - 6} more</div>}
    </div>
  );

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h2 className="font-bold text-sm">Lab Results ({stats.total})</h2>
        <div className="flex gap-1">
          {['all', 'abnormal', 'critical'].map(f => (
            <button key={f} onClick={() => setFilter(f as any)}
              className={`px-2 py-1 text-[10px] rounded border ${filter === f ? 'bg-blue-600 text-white' : 'bg-white'}`}>
              {f === 'all' ? `All (${stats.total})` : f === 'abnormal' ? `Abnormal (${stats.abnormal})` : `Critical (${stats.critical})`}
            </button>
          ))}
          <button onClick={load} className="px-2 py-1 text-[10px] bg-gray-100 rounded">Refresh</button>
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-5 gap-2">
        <div className="bg-white rounded-lg border p-2 text-center"><div className="text-[9px] text-gray-500">Total</div><div className="text-lg font-bold">{stats.total}</div></div>
        <div className="bg-green-50 rounded-lg border p-2 text-center"><div className="text-[9px] text-gray-500">Completed</div><div className="text-lg font-bold text-green-700">{stats.completed}</div></div>
        <div className="bg-blue-50 rounded-lg border p-2 text-center"><div className="text-[9px] text-gray-500">Pending</div><div className="text-lg font-bold text-blue-700">{stats.pending}</div></div>
        <div className="bg-amber-50 rounded-lg border p-2 text-center"><div className="text-[9px] text-gray-500">Abnormal</div><div className="text-lg font-bold text-amber-700">{stats.abnormal}</div></div>
        <div className="bg-red-50 rounded-lg border p-2 text-center"><div className="text-[9px] text-gray-500">Critical</div><div className="text-lg font-bold text-red-700">{stats.critical}</div></div>
      </div>

      {/* Orders */}
      {filtered.length === 0 ? <div className="text-center py-8 bg-white rounded-xl border text-gray-400 text-sm">No lab results found</div> :
      filtered.map(o => (
        <div key={o.orderId} className={`bg-white rounded-xl border overflow-hidden ${o.results.some(r => r.isCritical) ? 'border-red-300' : ''}`}>
          <button onClick={() => setExpanded(expanded === o.orderId ? null : o.orderId)}
            className="w-full text-left px-4 py-3 flex items-center justify-between hover:bg-gray-50">
            <div className="flex items-center gap-2">
              <span className="font-medium text-sm">{o.testName}</span>
              {o.testCode && <span className="text-[10px] font-mono text-gray-400">{o.testCode}</span>}
              {o.results.some(r => r.isCritical) && <span className="text-[9px] bg-red-600 text-white px-1.5 py-0.5 rounded font-bold">CRITICAL</span>}
              {o.results.some(r => r.isAbnormal) && !o.results.some(r => r.isCritical) && <span className="text-[9px] bg-amber-500 text-white px-1.5 py-0.5 rounded">ABNORMAL</span>}
            </div>
            <div className="flex items-center gap-2">
              <span className={`text-[9px] px-1.5 py-0.5 rounded ${o.status === 'completed' ? 'bg-green-100 text-green-700' : o.status === 'processing' ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-500'}`}>{o.status}</span>
              <span className="text-xs text-gray-400">{new Date(o.orderedDate).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}</span>
              <span className="text-gray-300">{expanded === o.orderId ? '▲' : '▼'}</span>
            </div>
          </button>

          {expanded === o.orderId && o.results.length > 0 && (
            <table className="w-full text-xs border-t"><thead><tr className="bg-gray-50">
              <th className="p-2 text-left font-medium">Parameter</th>
              <th className="p-2 text-center font-medium">Result</th>
              <th className="p-2 text-center font-medium">Unit</th>
              <th className="p-2 text-center font-medium">Ref Range</th>
              <th className="p-2 text-center font-medium">Flag</th>
            </tr></thead><tbody>{o.results.map((r, i) => (
              <tr key={i} className={`border-b ${r.isCritical ? 'bg-red-50' : r.isAbnormal ? 'bg-amber-50' : ''}`}>
                <td className="p-2 font-medium">{r.name}</td>
                <td className={`p-2 text-center font-bold ${r.isCritical ? 'text-red-700' : r.isAbnormal ? 'text-amber-700' : ''}`}>{r.value}</td>
                <td className="p-2 text-center text-gray-500">{r.unit}</td>
                <td className="p-2 text-center text-gray-400">{r.refRange}</td>
                <td className="p-2 text-center">{r.flag && <span className={`px-1.5 py-0.5 rounded text-[9px] font-bold ${r.isCritical ? 'bg-red-600 text-white' : 'bg-amber-500 text-white'}`}>{r.flag}</span>}</td>
              </tr>
            ))}</tbody></table>
          )}
          {expanded === o.orderId && o.results.length === 0 && (
            <div className="px-4 py-3 text-xs text-gray-400 border-t">{o.status === 'completed' ? 'No result parameters recorded' : 'Results pending'}</div>
          )}
        </div>
      ))}
    </div>
  );
}
