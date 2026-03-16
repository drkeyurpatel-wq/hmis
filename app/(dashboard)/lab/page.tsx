'use client';
import React, { useState, useEffect, useCallback } from 'react';
import { RoleGuard, TableSkeleton, StatusBadge } from '@/components/ui/shared';
import { useAuthStore } from '@/lib/store/auth';
import { useLabWorklist, useSamples, useResultEntry, useCriticalAlerts, useOutsourcedLab, type LabOrder } from '@/lib/lab/lims-hooks';

type LabTab = 'worklist' | 'collect' | 'results' | 'verify' | 'critical' | 'outsourced' | 'tat';

function LabPageInner() {
  const { staff, activeCentreId } = useAuthStore();
  const centreId = activeCentreId || '';
  const staffId = staff?.id || '';
  const { orders, loading, stats, load } = useLabWorklist(centreId);
  const samples = useSamples(centreId);
  const criticalAlerts = useCriticalAlerts(centreId);
  const outsourced = useOutsourcedLab();

  const [tab, setTab] = useState<LabTab>('worklist');
  const [statusFilter, setStatusFilter] = useState('all');
  const [dateFilter, setDateFilter] = useState(new Date().toISOString().split('T')[0]);
  const [selectedOrder, setSelectedOrder] = useState<LabOrder | null>(null);
  const [toast, setToast] = useState('');
  const flash = (m: string) => { setToast(m); setTimeout(() => setToast(''), 2500); };

  useEffect(() => { load(statusFilter, dateFilter); }, [statusFilter, dateFilter, load]);

  const priorityColor = (p: string) => p === 'stat' ? 'bg-red-100 text-red-700 font-bold animate-pulse' : p === 'urgent' ? 'bg-orange-100 text-orange-700' : 'bg-gray-100 text-gray-600';
  const statusColor = (s: string) => s === 'ordered' ? 'bg-yellow-100 text-yellow-800' : s === 'sample_collected' ? 'bg-blue-100 text-blue-800' : s === 'processing' ? 'bg-purple-100 text-purple-800' : s === 'completed' ? 'bg-green-100 text-green-800' : 'bg-gray-100';

  return (
    <div className="max-w-6xl mx-auto">
      {toast && <div className="fixed top-4 left-1/2 -translate-x-1/2 z-50 bg-green-600 text-white px-4 py-2 rounded-lg shadow-lg text-sm">{toast}</div>}

      <div className="flex items-center justify-between mb-4">
        <div><h1 className="text-2xl font-bold text-gray-900">Laboratory (LIMS)</h1><p className="text-sm text-gray-500">Sample management, result entry, validation</p></div>
        <div className="flex gap-2 items-center">
          <input type="date" value={dateFilter} onChange={e => setDateFilter(e.target.value)} className="text-sm border rounded-lg px-2 py-1.5" />
          <button onClick={() => load(statusFilter, dateFilter)} className="px-3 py-1.5 bg-gray-100 text-sm rounded-lg hover:bg-gray-200">Refresh</button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-6 gap-3 mb-4">
        <div className="bg-gray-50 rounded-xl p-3"><div className="text-[10px] text-gray-500">Total</div><div className="text-xl font-bold">{stats.total}</div></div>
        <div className="bg-yellow-50 rounded-xl p-3 cursor-pointer hover:ring-2 ring-yellow-300" onClick={() => setStatusFilter('ordered')}><div className="text-[10px] text-gray-500">Pending</div><div className="text-xl font-bold text-yellow-700">{stats.pending}</div></div>
        <div className="bg-blue-50 rounded-xl p-3 cursor-pointer hover:ring-2 ring-blue-300" onClick={() => setStatusFilter('sample_collected')}><div className="text-[10px] text-gray-500">Collected</div><div className="text-xl font-bold text-blue-700">{stats.collected}</div></div>
        <div className="bg-purple-50 rounded-xl p-3 cursor-pointer hover:ring-2 ring-purple-300" onClick={() => setStatusFilter('processing')}><div className="text-[10px] text-gray-500">Processing</div><div className="text-xl font-bold text-purple-700">{stats.processing}</div></div>
        <div className="bg-green-50 rounded-xl p-3 cursor-pointer hover:ring-2 ring-green-300" onClick={() => setStatusFilter('completed')}><div className="text-[10px] text-gray-500">Completed</div><div className="text-xl font-bold text-green-700">{stats.completed}</div></div>
        <div className={`rounded-xl p-3 ${stats.tatBreached > 0 ? 'bg-red-50' : 'bg-gray-50'}`}><div className="text-[10px] text-gray-500">TAT Breached</div><div className={`text-xl font-bold ${stats.tatBreached > 0 ? 'text-red-700' : 'text-gray-400'}`}>{stats.tatBreached}</div></div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 mb-4 border-b pb-px overflow-x-auto">
        {([['worklist','Worklist'],['collect','Sample Collection'],['results','Result Entry'],['verify','Verify & Report'],['critical','Critical Alerts'],['outsourced','Outsourced'],['tat','TAT Dashboard']] as [LabTab,string][]).map(([k,l]) =>
          <button key={k} onClick={() => setTab(k)} className={`px-3 py-2 text-xs font-medium whitespace-nowrap border-b-2 -mb-px ${tab === k ? 'border-blue-600 text-blue-700' : 'border-transparent text-gray-500 hover:text-gray-700'}`}>
            {l} {k === 'critical' && criticalAlerts.alerts.length > 0 ? <span className="ml-1 bg-red-500 text-white text-[10px] px-1.5 py-0.5 rounded-full">{criticalAlerts.alerts.length}</span> : ''}</button>
        )}
      </div>

      {/* ===== WORKLIST ===== */}
      {tab === 'worklist' && <>
        <div className="flex gap-2 mb-3">{[['all','All'],['ordered','Pending'],['sample_collected','Collected'],['processing','Processing'],['completed','Completed']].map(([k,l]) =>
          <button key={k} onClick={() => setStatusFilter(k)} className={`px-3 py-1 text-xs rounded-lg border ${statusFilter === k ? 'bg-blue-600 text-white border-blue-600' : 'bg-white border-gray-200'}`}>{l}</button>
        )}</div>
        {loading ? <TableSkeleton rows={8} cols={6} /> :
        orders.length === 0 ? <div className="text-center py-12 bg-white rounded-xl border text-gray-400 text-sm">No lab orders for this date</div> :
        <div className="bg-white rounded-xl border overflow-x-auto"><table className="w-full text-xs"><thead><tr className="bg-gray-50 border-b">
          <th className="text-left p-2.5 font-medium text-gray-500">Patient</th>
          <th className="text-left p-2.5 font-medium text-gray-500">Test</th>
          <th className="p-2.5 font-medium text-gray-500">Priority</th>
          <th className="text-left p-2.5 font-medium text-gray-500">Barcode</th>
          <th className="p-2.5 font-medium text-gray-500">Status</th>
          <th className="p-2.5 font-medium text-gray-500">TAT</th>
          <th className="p-2.5 font-medium text-gray-500">Actions</th>
        </tr></thead><tbody>{orders.map(o => (
          <tr key={o.id} className={`border-b hover:bg-gray-50 ${o.priority === 'stat' ? 'bg-red-50/30' : ''}`}>
            <td className="p-2.5"><div className="font-medium">{o.patientName}</div><div className="text-[10px] text-gray-400">{o.patientUhid} | {o.patientAge}/{o.patientGender?.charAt(0).toUpperCase()}</div></td>
            <td className="p-2.5"><div className="font-medium">{o.testName}</div><div className="text-[10px] text-gray-400">{o.testCode} | {o.category}</div></td>
            <td className="p-2.5 text-center"><span className={`px-1.5 py-0.5 rounded text-[10px] ${priorityColor(o.priority)}`}>{o.priority.toUpperCase()}</span></td>
            <td className="p-2.5 font-mono text-[10px]">{o.sampleBarcode || <span className="text-gray-300">—</span>}</td>
            <td className="p-2.5 text-center"><span className={`px-1.5 py-0.5 rounded text-[10px] ${statusColor(o.status)}`}>{o.status.replace('_', ' ')}</span></td>
            <td className="p-2.5 text-center">{o.tatDeadline ? (
              new Date(o.tatDeadline) < new Date() && o.status !== 'completed' ? <span className="text-red-600 font-bold text-[10px]">BREACHED</span> : <span className="text-green-600 text-[10px]">OK</span>
            ) : <span className="text-gray-300">—</span>}</td>
            <td className="p-2.5 text-center">
              <div className="flex gap-1 justify-center">
                {o.status === 'ordered' && <button onClick={async () => { const r = await samples.collectSample(o.id, 'blood', staffId, o.testCode); if (r?.barcode) flash('Sample collected: ' + r.barcode); load(statusFilter, dateFilter); }} className="px-2 py-0.5 bg-blue-50 text-blue-700 rounded text-[10px] hover:bg-blue-100">Collect</button>}
                {(o.status === 'sample_collected' || o.status === 'processing') && <button onClick={() => { setSelectedOrder(o); setTab('results'); }} className="px-2 py-0.5 bg-purple-50 text-purple-700 rounded text-[10px] hover:bg-purple-100">Enter Results</button>}
                {o.status === 'processing' && <button onClick={() => { setSelectedOrder(o); setTab('verify'); }} className="px-2 py-0.5 bg-green-50 text-green-700 rounded text-[10px] hover:bg-green-100">Verify</button>}
              </div>
            </td>
          </tr>
        ))}</tbody></table></div>}
      </>}

      {/* ===== SAMPLE COLLECTION ===== */}
      {tab === 'collect' && <>
        <h2 className="font-semibold text-sm mb-3">Pending Sample Collection</h2>
        {(() => { const pending = orders.filter(o => o.status === 'ordered'); return pending.length === 0 ? <div className="text-center py-12 bg-white rounded-xl border text-gray-400 text-sm">All samples collected</div> :
        <div className="space-y-2">{pending.map(o => (
          <div key={o.id} className={`bg-white rounded-lg border p-3 flex items-center justify-between ${o.priority === 'stat' ? 'border-red-300 bg-red-50/30' : ''}`}>
            <div>
              <div className="font-medium text-sm">{o.patientName} <span className="text-gray-400 text-xs">({o.patientUhid})</span></div>
              <div className="text-xs text-gray-500">{o.testName} ({o.testCode}) | Dr. {o.orderedBy}</div>
              {o.clinicalInfo && <div className="text-[10px] text-blue-600 mt-0.5">Clinical: {o.clinicalInfo}</div>}
            </div>
            <div className="flex items-center gap-2">
              <span className={`px-2 py-0.5 rounded text-[10px] ${priorityColor(o.priority)}`}>{o.priority.toUpperCase()}</span>
              <button onClick={async () => { const r = await samples.collectSample(o.id, 'blood', staffId, o.testCode); if (r?.barcode) { flash('Collected! Barcode: ' + r.barcode); load(statusFilter, dateFilter); } }}
                className="px-3 py-1.5 bg-blue-600 text-white text-xs rounded-lg hover:bg-blue-700">Collect & Label</button>
            </div>
          </div>
        ))}</div>; })()}
      </>}

      {/* ===== RESULT ENTRY ===== */}
      {tab === 'results' && <ResultEntryPanel order={selectedOrder} staffId={staffId} onFlash={flash} onDone={() => { setTab('worklist'); load(statusFilter, dateFilter); }} onSelectOrder={setSelectedOrder} orders={orders.filter(o => o.status === 'sample_collected' || o.status === 'processing')} />}

      {/* ===== VERIFY & REPORT ===== */}
      {tab === 'verify' && <VerifyPanel order={selectedOrder} staffId={staffId} onFlash={flash} onDone={() => { setTab('worklist'); load(statusFilter, dateFilter); }} onSelectOrder={setSelectedOrder} orders={orders.filter(o => o.status === 'processing')} />}

      {/* ===== CRITICAL ALERTS ===== */}
      {tab === 'critical' && <>
        <h2 className="font-semibold text-sm mb-3">Critical Value Alerts <span className="text-red-600">({criticalAlerts.alerts.length})</span></h2>
        {criticalAlerts.alerts.length === 0 ? <div className="text-center py-12 bg-white rounded-xl border text-gray-400 text-sm">No pending critical alerts</div> :
        <div className="space-y-2">{criticalAlerts.alerts.map((a: any) => (
          <div key={a.id} className="bg-red-50 rounded-xl border border-red-200 p-4">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <span className="text-red-600 text-lg font-bold">!</span>
                <span className="font-medium">{a.order?.patient?.first_name} {a.order?.patient?.last_name}</span>
                <span className="text-xs text-gray-400">{a.order?.patient?.uhid}</span>
                <span className="text-xs bg-red-100 text-red-700 px-1.5 py-0.5 rounded">{a.order?.test?.test_name}</span>
              </div>
              <span className={`px-2 py-0.5 rounded text-xs ${a.status === 'pending' ? 'bg-red-100 text-red-700 animate-pulse' : 'bg-yellow-100 text-yellow-700'}`}>{a.status}</span>
            </div>
            <div className="text-sm"><span className="font-medium">{a.parameter_name}:</span> <span className="text-red-700 font-bold text-lg">{a.result_value}</span> <span className="text-xs text-gray-500">({a.critical_type === 'low' ? 'CRITICALLY LOW' : 'CRITICALLY HIGH'})</span></div>
            <div className="flex gap-2 mt-2">
              {a.status === 'pending' && <button onClick={() => criticalAlerts.notify(a.id, '', staffId)} className="px-3 py-1 bg-orange-600 text-white text-xs rounded-lg">Mark Notified</button>}
              {(a.status === 'pending' || a.status === 'notified') && <button onClick={() => { const action = prompt('Action taken by doctor:'); if (action) criticalAlerts.acknowledge(a.id, staffId, action); }} className="px-3 py-1 bg-green-600 text-white text-xs rounded-lg">Acknowledge</button>}
            </div>
          </div>
        ))}</div>}
      </>}

      {/* ===== OUTSOURCED ===== */}
      {tab === 'outsourced' && <>
        <h2 className="font-semibold text-sm mb-3">Outsourced Lab Tracking</h2>
        {outsourced.outsourced.length === 0 ? <div className="text-center py-12 bg-white rounded-xl border text-gray-400 text-sm">No outsourced tests</div> :
        <div className="bg-white rounded-xl border overflow-hidden"><table className="w-full text-xs"><thead><tr className="bg-gray-50 border-b">
          <th className="text-left p-2.5">Test</th><th className="text-left p-2.5">Patient</th><th className="text-left p-2.5">External Lab</th>
          <th className="p-2.5">Dispatched</th><th className="p-2.5">Expected</th><th className="p-2.5">Status</th><th className="p-2.5">Actions</th>
        </tr></thead><tbody>{outsourced.outsourced.map((o: any) => (
          <tr key={o.id} className="border-b hover:bg-gray-50">
            <td className="p-2.5">{o.order?.test?.test_name}</td>
            <td className="p-2.5">{o.order?.patient?.first_name} {o.order?.patient?.last_name} <span className="text-gray-400">({o.order?.patient?.uhid})</span></td>
            <td className="p-2.5 font-medium">{o.external_lab_name}</td>
            <td className="p-2.5 text-center">{o.dispatch_date}</td>
            <td className="p-2.5 text-center">{o.expected_return || '—'}</td>
            <td className="p-2.5 text-center"><StatusBadge status={o.status} /></td>
            <td className="p-2.5 text-center">
              {o.status !== 'received_back' && <select onChange={e => { if (e.target.value) outsourced.updateStatus(o.id, e.target.value); e.target.value = ''; }} className="text-[10px] border rounded px-1 py-0.5" defaultValue="">
                <option value="" disabled>Update...</option>
                <option value="in_transit">In Transit</option><option value="received_by_lab">Received by Lab</option>
                <option value="processing">Processing</option><option value="reported">Reported</option><option value="received_back">Received Back</option>
              </select>}
            </td>
          </tr>
        ))}</tbody></table></div>}
      </>}

      {/* ===== TAT DASHBOARD ===== */}
      {tab === 'tat' && <>
        <h2 className="font-semibold text-sm mb-3">TAT Performance</h2>
        {(() => {
          const completed = orders.filter(o => o.status === 'completed');
          const met = completed.filter(o => o.tatMet === true).length;
          const breached = completed.filter(o => o.tatMet === false).length;
          const unknown = completed.filter(o => o.tatMet === null).length;
          const pct = completed.length > 0 ? Math.round(met / completed.length * 100) : 0;
          return <>
            <div className="grid grid-cols-4 gap-4 mb-4">
              <div className="bg-gray-50 rounded-xl p-4"><div className="text-xs text-gray-500">Completed</div><div className="text-2xl font-bold">{completed.length}</div></div>
              <div className="bg-green-50 rounded-xl p-4"><div className="text-xs text-gray-500">TAT Met</div><div className="text-2xl font-bold text-green-700">{met}</div></div>
              <div className="bg-red-50 rounded-xl p-4"><div className="text-xs text-gray-500">TAT Breached</div><div className="text-2xl font-bold text-red-700">{breached}</div></div>
              <div className={`rounded-xl p-4 ${pct >= 90 ? 'bg-green-50' : pct >= 70 ? 'bg-yellow-50' : 'bg-red-50'}`}><div className="text-xs text-gray-500">Compliance</div><div className={`text-2xl font-bold ${pct >= 90 ? 'text-green-700' : pct >= 70 ? 'text-yellow-700' : 'text-red-700'}`}>{pct}%</div></div>
            </div>
            {stats.tatBreached > 0 && <div className="bg-red-50 rounded-xl border border-red-200 p-4 mb-4">
              <h3 className="font-semibold text-sm text-red-800 mb-2">Currently Breaching TAT ({stats.tatBreached})</h3>
              {orders.filter(o => o.tatDeadline && new Date(o.tatDeadline) < new Date() && o.status !== 'completed').map(o => (
                <div key={o.id} className="flex items-center justify-between py-1.5 border-b border-red-100 last:border-0 text-xs">
                  <span>{o.patientName} — {o.testName}</span>
                  <span className="text-red-600">Overdue by {Math.round((Date.now() - new Date(o.tatDeadline!).getTime()) / 60000)} min</span>
                </div>
              ))}
            </div>}
          </>;
        })()}
      </>}
    </div>
  );
}

// ============================================================
// RESULT ENTRY SUB-PANEL
// ============================================================
function ResultEntryPanel({ order, staffId, onFlash, onDone, onSelectOrder, orders }: {
  order: LabOrder | null; staffId: string; onFlash: (m: string) => void;
  onDone: () => void; onSelectOrder: (o: LabOrder) => void; orders: LabOrder[];
}) {
  const entry = useResultEntry(order?.id || null);
  const [values, setValues] = useState<Record<string, string>>({});

  useEffect(() => {
    // Pre-fill from existing results
    const map: Record<string, string> = {};
    entry.results.forEach((r: any) => { map[r.parameter_id || r.parameter_name] = r.result_value; });
    setValues(map);
  }, [entry.results]);

  const handleSave = async () => {
    if (!order) return;
    const entries = entry.parameters.filter((p: any) => p.is_reportable).map((p: any) => {
      const val = values[p.id] || '';
      if (!val) return null;
      const v = entry.validateResult(p.id, val, order.patientAge, order.patientGender);
      return {
        parameterId: p.id, parameterName: p.parameter_name, value: val, unit: p.unit || '',
        isAbnormal: v.isAbnormal, isCritical: v.isCritical, deltaFlag: v.deltaFlag,
        deltaPrevious: v.deltaPrevious || null, deltaPercent: v.deltaPercent || null,
      };
    }).filter(Boolean);
    await entry.saveResults(entries as any, staffId);
    onFlash('Results saved' + (entries.some((e: any) => e?.isCritical) ? ' — CRITICAL VALUES DETECTED' : ''));
  };

  return (
    <div className="flex gap-4">
      {/* Order selector */}
      <div className="w-1/4 space-y-1.5">
        <h3 className="text-xs font-medium text-gray-500 mb-2">Select order</h3>
        {orders.length === 0 ? <div className="text-xs text-gray-400 text-center py-4">No orders awaiting results</div> :
        orders.map(o => (
          <button key={o.id} onClick={() => onSelectOrder(o)}
            className={`w-full text-left p-2 rounded-lg border text-xs ${order?.id === o.id ? 'border-blue-500 bg-blue-50' : 'hover:bg-gray-50'}`}>
            <div className="font-medium">{o.patientName}</div>
            <div className="text-[10px] text-gray-400">{o.testName} | {o.sampleBarcode || '—'}</div>
          </button>
        ))}
      </div>

      {/* Result entry form */}
      <div className="flex-1">
        {!order ? <div className="text-center py-12 bg-white rounded-xl border text-gray-400 text-sm">Select an order from the left to enter results</div> : entry.loading ? <TableSkeleton rows={5} cols={4} /> : (
          <div className="bg-white rounded-xl border p-5">
            <div className="flex items-center justify-between mb-4">
              <div><div className="font-semibold">{order.testName}</div>
                <div className="text-xs text-gray-400">{order.patientName} | {order.patientUhid} | {order.patientAge}/{order.patientGender?.charAt(0).toUpperCase()} | Barcode: {order.sampleBarcode || '—'}</div></div>
              <span className={`px-2 py-0.5 rounded text-xs ${order.priority === 'stat' ? 'bg-red-100 text-red-700' : 'bg-gray-100 text-gray-600'}`}>{order.priority.toUpperCase()}</span>
            </div>

            {/* Parameter table */}
            <div className="border rounded-lg overflow-hidden mb-4">
              <table className="w-full text-xs">
                <thead><tr className="bg-gray-50 border-b">
                  <th className="text-left p-2 font-medium text-gray-500">Parameter</th>
                  <th className="text-left p-2 font-medium text-gray-500 w-28">Result</th>
                  <th className="p-2 font-medium text-gray-500">Unit</th>
                  <th className="p-2 font-medium text-gray-500">Ref. Range</th>
                  <th className="p-2 font-medium text-gray-500">Flag</th>
                </tr></thead>
                <tbody>{entry.parameters.filter((p: any) => p.is_reportable).map((p: any) => {
                  const val = values[p.id] || '';
                  const v = val ? entry.validateResult(p.id, val, order.patientAge, order.patientGender) : null;
                  return (
                    <tr key={p.id} className={`border-b ${v?.isCritical ? 'bg-red-50' : v?.isAbnormal ? 'bg-yellow-50' : ''}`}>
                      <td className="p-2 font-medium">{p.parameter_name}</td>
                      <td className="p-2"><input type={p.data_type === 'numeric' ? 'number' : 'text'} value={val}
                        onChange={e => setValues(prev => ({ ...prev, [p.id]: e.target.value }))}
                        className={`w-full px-2 py-1 border rounded text-sm text-right ${v?.isCritical ? 'border-red-500 bg-red-50 font-bold text-red-700' : v?.isAbnormal ? 'border-yellow-500 bg-yellow-50 font-bold' : ''}`}
                        step="any" placeholder="—" /></td>
                      <td className="p-2 text-center text-gray-500">{p.unit || ''}</td>
                      <td className="p-2 text-center text-gray-400">{p.ref_range_min !== null && p.ref_range_max !== null ? `${p.ref_range_min} — ${p.ref_range_max}` : p.ref_range_text || '—'}</td>
                      <td className="p-2 text-center">
                        {v?.isCritical && <span className="bg-red-600 text-white px-1.5 py-0.5 rounded text-[10px] font-bold">CRITICAL</span>}
                        {!v?.isCritical && v?.isAbnormal && <span className="bg-yellow-500 text-white px-1.5 py-0.5 rounded text-[10px]">ABN</span>}
                        {v?.deltaFlag && <span className="bg-orange-100 text-orange-700 px-1 py-0.5 rounded text-[10px] ml-0.5">Δ{Math.round(v.deltaPercent || 0)}%</span>}
                      </td>
                    </tr>
                  );
                })}</tbody>
              </table>
            </div>

            <div className="flex gap-2">
              <button onClick={handleSave} className="px-4 py-2 bg-green-600 text-white text-sm rounded-lg hover:bg-green-700">Save Results</button>
              <button onClick={onDone} className="px-4 py-2 bg-gray-100 text-gray-600 text-sm rounded-lg">Back to Worklist</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ============================================================
// VERIFY SUB-PANEL
// ============================================================
function VerifyPanel({ order, staffId, onFlash, onDone, onSelectOrder, orders }: {
  order: LabOrder | null; staffId: string; onFlash: (m: string) => void;
  onDone: () => void; onSelectOrder: (o: LabOrder) => void; orders: LabOrder[];
}) {
  const entry = useResultEntry(order?.id || null);

  return (
    <div className="flex gap-4">
      <div className="w-1/4 space-y-1.5">
        <h3 className="text-xs font-medium text-gray-500 mb-2">Awaiting verification</h3>
        {orders.length === 0 ? <div className="text-xs text-gray-400 text-center py-4">No orders awaiting verification</div> :
        orders.map(o => (
          <button key={o.id} onClick={() => onSelectOrder(o)}
            className={`w-full text-left p-2 rounded-lg border text-xs ${order?.id === o.id ? 'border-green-500 bg-green-50' : 'hover:bg-gray-50'}`}>
            <div className="font-medium">{o.patientName}</div>
            <div className="text-[10px] text-gray-400">{o.testName}</div>
          </button>
        ))}
      </div>

      <div className="flex-1">
        {!order ? <div className="text-center py-12 bg-white rounded-xl border text-gray-400 text-sm">Select an order to verify</div> : (
          <div className="bg-white rounded-xl border p-5">
            <div className="mb-4"><div className="font-semibold">{order.testName}</div>
              <div className="text-xs text-gray-400">{order.patientName} | {order.patientUhid} | Barcode: {order.sampleBarcode}</div></div>

            <div className="border rounded-lg overflow-hidden mb-4">
              <table className="w-full text-xs"><thead><tr className="bg-gray-50 border-b">
                <th className="text-left p-2 font-medium text-gray-500">Parameter</th>
                <th className="p-2 font-medium text-gray-500">Result</th>
                <th className="p-2 font-medium text-gray-500">Unit</th>
                <th className="p-2 font-medium text-gray-500">Ref. Range</th>
                <th className="p-2 font-medium text-gray-500">Flag</th>
              </tr></thead><tbody>{entry.results.map((r: any) => (
                <tr key={r.id} className={`border-b ${r.is_critical ? 'bg-red-50' : r.is_abnormal ? 'bg-yellow-50' : ''}`}>
                  <td className="p-2 font-medium">{r.parameter_name}</td>
                  <td className={`p-2 text-center font-bold ${r.is_critical ? 'text-red-700' : r.is_abnormal ? 'text-yellow-700' : ''}`}>{r.result_value}</td>
                  <td className="p-2 text-center text-gray-500">{r.unit}</td>
                  <td className="p-2 text-center text-gray-400">{r.normal_range_min && r.normal_range_max ? `${r.normal_range_min} — ${r.normal_range_max}` : '—'}</td>
                  <td className="p-2 text-center">
                    {r.is_critical && <span className="bg-red-600 text-white px-1.5 py-0.5 rounded text-[10px] font-bold">CRIT</span>}
                    {!r.is_critical && r.is_abnormal && <span className="bg-yellow-500 text-white px-1.5 py-0.5 rounded text-[10px]">ABN</span>}
                    {r.delta_flag && <span className="bg-orange-100 text-orange-700 px-1 py-0.5 rounded text-[10px] ml-0.5">Δ</span>}
                  </td>
                </tr>
              ))}</tbody></table>
            </div>

            <div className="flex gap-2">
              <button onClick={async () => { await entry.verifyResults(staffId); onFlash('Results verified & reported'); onDone(); }}
                className="px-4 py-2 bg-green-600 text-white text-sm rounded-lg hover:bg-green-700 font-medium">Verify & Report</button>
              <button onClick={onDone} className="px-4 py-2 bg-gray-100 text-gray-600 text-sm rounded-lg">Back</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default function LabPage() { return <RoleGuard module="lab"><LabPageInner /></RoleGuard>; }
