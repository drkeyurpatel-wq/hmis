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

    let q = sb()!.from('hmis_lab_orders')
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

  if (loading) return <div className="animate-pulse space-y-2">{[1,2,3].map(i => <div key={i} className="h-12 bg-h1-navy/10 rounded-h1-sm" />)}</div>;

  if (compact) return (
    <div className="bg-h1-card rounded-h1 border p-3">
      <div className="flex items-center justify-between mb-2">
        <h3 className="text-xs font-bold text-h1-text">Lab Results ({stats.total})</h3>
        <div className="flex gap-1">
          {stats.critical > 0 && <span className="text-[9px] bg-h1-red text-white px-1.5 py-0.5 rounded">{stats.critical} CRIT</span>}
          {stats.abnormal > 0 && <span className="text-[9px] bg-amber-500 text-white px-1.5 py-0.5 rounded">{stats.abnormal} ABN</span>}
          {stats.pending > 0 && <span className="text-[9px] bg-h1-teal/10 text-h1-teal px-1.5 py-0.5 rounded">{stats.pending} pending</span>}
        </div>
      </div>
      <div className="space-y-1">{filtered.slice(0, 6).map(o => (
        <div key={o.orderId} className={`flex items-center justify-between px-2 py-1.5 rounded text-xs ${o.results.some(r => r.isCritical) ? 'bg-h1-red/[0.04]' : o.results.some(r => r.isAbnormal) ? 'bg-amber-50' : 'bg-h1-navy/[0.03]'}`}>
          <span className="font-medium">{o.testName}</span>
          <div className="flex items-center gap-1">
            <span className={`text-[9px] px-1 py-0.5 rounded ${o.status === 'completed' ? 'bg-h1-success/10 text-h1-success' : 'bg-h1-navy/5 text-h1-text-secondary'}`}>{o.status}</span>
            <span className="text-[10px] text-h1-text-muted">{new Date(o.orderedDate).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })}</span>
          </div>
        </div>
      ))}</div>
      {orders.length > 6 && <div className="text-center text-[10px] text-h1-text-muted mt-1">+ {orders.length - 6} more</div>}
    </div>
  );

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h2 className="font-bold text-sm">Lab Results ({stats.total})</h2>
        <div className="flex gap-1">
          {['all', 'abnormal', 'critical'].map(f => (
            <button key={f} onClick={() => setFilter(f as any)}
              className={`px-2 py-1 text-[10px] rounded border ${filter === f ? 'bg-blue-600 text-white' : 'bg-h1-card'}`}>
              {f === 'all' ? `All (${stats.total})` : f === 'abnormal' ? `Abnormal (${stats.abnormal})` : `Critical (${stats.critical})`}
            </button>
          ))}
          <button onClick={load} className="px-2 py-1 text-[10px] bg-h1-navy/5 rounded">Refresh</button>
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-5 gap-2">
        <div className="bg-h1-card rounded-h1-sm border p-2 text-center"><div className="text-[9px] text-h1-text-secondary">Total</div><div className="text-lg font-bold">{stats.total}</div></div>
        <div className="bg-h1-success/[0.05] rounded-h1-sm border p-2 text-center"><div className="text-[9px] text-h1-text-secondary">Completed</div><div className="text-lg font-bold text-h1-success">{stats.completed}</div></div>
        <div className="bg-h1-teal/[0.05] rounded-h1-sm border p-2 text-center"><div className="text-[9px] text-h1-text-secondary">Pending</div><div className="text-lg font-bold text-h1-teal">{stats.pending}</div></div>
        <div className="bg-amber-50 rounded-h1-sm border p-2 text-center"><div className="text-[9px] text-h1-text-secondary">Abnormal</div><div className="text-lg font-bold text-amber-700">{stats.abnormal}</div></div>
        <div className="bg-h1-red/[0.04] rounded-h1-sm border p-2 text-center"><div className="text-[9px] text-h1-text-secondary">Critical</div><div className="text-lg font-bold text-h1-red">{stats.critical}</div></div>
      </div>

      {/* Orders */}
      {filtered.length === 0 ? <div className="text-center py-8 bg-h1-card rounded-h1 border text-h1-text-muted text-sm">No lab results found</div> :
      filtered.map(o => (
        <div key={o.orderId} className={`bg-h1-card rounded-h1 border overflow-hidden ${o.results.some(r => r.isCritical) ? 'border-h1-red/30' : ''}`}>
          <button onClick={() => setExpanded(expanded === o.orderId ? null : o.orderId)}
            className="w-full text-left px-4 py-3 flex items-center justify-between hover:bg-h1-navy/[0.03]">
            <div className="flex items-center gap-2">
              <span className="font-medium text-sm">{o.testName}</span>
              {o.testCode && <span className="text-[10px] font-mono text-h1-text-muted">{o.testCode}</span>}
              {o.results.some(r => r.isCritical) && <span className="text-[9px] bg-h1-red text-white px-1.5 py-0.5 rounded font-bold">CRITICAL</span>}
              {o.results.some(r => r.isAbnormal) && !o.results.some(r => r.isCritical) && <span className="text-[9px] bg-amber-500 text-white px-1.5 py-0.5 rounded">ABNORMAL</span>}
            </div>
            <div className="flex items-center gap-2">
              <span className={`text-[9px] px-1.5 py-0.5 rounded ${o.status === 'completed' ? 'bg-h1-success/10 text-h1-success' : o.status === 'processing' ? 'bg-h1-teal/10 text-h1-teal' : 'bg-h1-navy/5 text-h1-text-secondary'}`}>{o.status}</span>
              <span className="text-xs text-h1-text-muted">{new Date(o.orderedDate).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}</span>
              <span className="text-h1-text-muted">{expanded === o.orderId ? '▲' : '▼'}</span>
            </div>
          </button>

          {expanded === o.orderId && o.results.length > 0 && (
            <table className="w-full text-xs border-t"><thead><tr className="bg-h1-navy/[0.03]">
              <th className="p-2 text-left font-medium">Parameter</th>
              <th className="p-2 text-center font-medium">Result</th>
              <th className="p-2 text-center font-medium">Unit</th>
              <th className="p-2 text-center font-medium">Ref Range</th>
              <th className="p-2 text-center font-medium">Flag</th>
            </tr></thead><tbody>{o.results.map((r, i) => (
              <tr key={i} className={`border-b ${r.isCritical ? 'bg-h1-red/[0.04]' : r.isAbnormal ? 'bg-amber-50' : ''}`}>
                <td className="p-2 font-medium">{r.name}</td>
                <td className={`p-2 text-center font-bold ${r.isCritical ? 'text-h1-red' : r.isAbnormal ? 'text-amber-700' : ''}`}>{r.value}</td>
                <td className="p-2 text-center text-h1-text-secondary">{r.unit}</td>
                <td className="p-2 text-center text-h1-text-muted">{r.refRange}</td>
                <td className="p-2 text-center">{r.flag && <span className={`px-1.5 py-0.5 rounded text-[9px] font-bold ${r.isCritical ? 'bg-h1-red text-white' : 'bg-amber-500 text-white'}`}>{r.flag}</span>}</td>
              </tr>
            ))}</tbody></table>
          )}
          {expanded === o.orderId && o.results.length === 0 && (
            <div className="px-4 py-3 text-xs text-h1-text-muted border-t">{o.status === 'completed' ? 'No result parameters recorded' : 'Results pending'}</div>
          )}
        </div>
      ))}
    </div>
  );
}
