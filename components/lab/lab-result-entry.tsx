// components/lab/lab-result-entry.tsx
// Result entry: order selector (left) + parameter table with validation (right)
'use client';
import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { TableSkeleton, printLabReport } from '@/components/ui/shared';
import { useResultEntry, type LabOrder } from '@/lib/lab/lims-hooks';

interface LabResultEntryProps {
  orders: LabOrder[];
  selectedOrder: LabOrder | null;
  onSelectOrder: (o: LabOrder) => void;
  staffId: string;
  onFlash: (msg: string) => void;
  onDone: () => void;
}

export default function LabResultEntry({ orders, selectedOrder, onSelectOrder, staffId, onFlash, onDone }: LabResultEntryProps) {
  const entry = useResultEntry(selectedOrder?.id || null);
  const [values, setValues] = useState<Record<string, string>>({});

  useEffect(() => {
    const map: Record<string, string> = {};
    entry.results.forEach((r: any) => { map[r.parameter_id || r.parameter_name] = r.result_value; });
    setValues(map);
  }, [entry.results]);

  const handleSave = async () => {
    if (!selectedOrder) return;
    const entries = entry.parameters.filter((p: any) => p.is_reportable).map((p: any) => {
      const val = values[p.id] || '';
      if (!val) return null;
      const v = entry.validateResult(p.id, val, selectedOrder.patientAge, selectedOrder.patientGender);
      return {
        parameterId: p.id, parameterName: p.parameter_name, value: val, unit: p.unit || '',
        isAbnormal: v.isAbnormal, isCritical: v.isCritical, deltaFlag: v.deltaFlag,
        deltaPrevious: v.deltaPrevious || null, deltaPercent: v.deltaPercent || null,
      };
    }).filter(Boolean);
    await entry.saveResults(entries as any, staffId);
    onFlash('Results saved' + (entries.some((e: any) => e?.isCritical) ? ' — CRITICAL VALUES DETECTED' : ''));
  };

  const handlePrint = () => {
    if (!selectedOrder) return;
    const resultsForPrint = entry.parameters.filter((p: any) => p.is_reportable && values[p.id]).map((p: any) => {
      const val = values[p.id]; const v = entry.validateResult(p.id, val, selectedOrder.patientAge, selectedOrder.patientGender);
      return { parameterName: p.parameter_name, value: val, unit: p.unit || '',
        refRange: p.ref_range_min != null && p.ref_range_max != null ? `${p.ref_range_min} — ${p.ref_range_max}` : p.ref_range_text || '—',
        flag: v?.isCritical ? 'CRITICAL' : v?.isAbnormal ? 'ABN' : '' };
    });
    printLabReport({ patientName: selectedOrder.patientName, uhid: selectedOrder.patientUhid || '', age: selectedOrder.patientAge || '', gender: selectedOrder.patientGender || '',
      testName: selectedOrder.testName, testCode: selectedOrder.testCode || '', barcode: selectedOrder.sampleBarcode || '', orderedBy: selectedOrder.orderedBy || '', results: resultsForPrint });
  };

  return (
    <div className="flex gap-3">
      {/* Order selector */}
      <div className="w-64 flex-shrink-0 space-y-1.5">
        <h3 className="text-h1-small font-semibold text-h1-text-secondary mb-2">Select order</h3>
        {orders.length === 0 ? (
          <div className="text-h1-small text-h1-text-muted text-center py-4">No orders awaiting results</div>
        ) : orders.map(o => (
          <button key={o.id} onClick={() => onSelectOrder(o)}
            className={`w-full text-left p-2.5 rounded-h1-sm border transition-colors cursor-pointer text-h1-small
              ${selectedOrder?.id === o.id ? 'border-h1-teal bg-h1-teal/5' : 'border-h1-border hover:bg-h1-navy/[0.02]'}`}>
            <div className="font-medium text-h1-text">
              {o.patientId ? <Link href={`/patients/${o.patientId}`} className="hover:text-h1-teal">{o.patientName}</Link> : o.patientName}
            </div>
            <div className="text-[10px] text-h1-text-muted">{o.testName} | {o.sampleBarcode || '—'}</div>
          </button>
        ))}
      </div>

      {/* Result form */}
      <div className="flex-1 min-w-0">
        {!selectedOrder ? (
          <div className="text-center py-12 bg-h1-card rounded-h1 border border-h1-border text-h1-text-muted text-h1-body">
            Select an order from the left to enter results
          </div>
        ) : entry.loading ? <TableSkeleton rows={5} cols={4} /> : (
          <div className="bg-h1-card rounded-h1 border border-h1-border p-4">
            <div className="flex items-center justify-between mb-3">
              <div>
                <div className="text-h1-card-title text-h1-navy">{selectedOrder.testName}</div>
                <div className="text-h1-small text-h1-text-muted">
                  {selectedOrder.patientName} | {selectedOrder.patientUhid} | {selectedOrder.patientAge}/{selectedOrder.patientGender?.charAt(0).toUpperCase()} | Barcode: {selectedOrder.sampleBarcode || '—'}
                </div>
              </div>
              <span className={`px-2 py-0.5 rounded-h1-sm text-h1-small font-medium
                ${selectedOrder.priority === 'stat' ? 'bg-h1-red/10 text-h1-red' : 'bg-h1-navy/5 text-h1-text-muted'}`}>
                {selectedOrder.priority.toUpperCase()}
              </span>
            </div>

            <div className="border border-h1-border rounded-h1-sm overflow-hidden mb-4">
              <table className="w-full text-h1-small">
                <thead><tr className="bg-h1-navy/[0.03] border-b border-h1-border">
                  <th className="text-left p-2 font-medium text-h1-text-secondary">Parameter</th>
                  <th className="text-left p-2 font-medium text-h1-text-secondary w-28">Result</th>
                  <th className="p-2 font-medium text-h1-text-secondary">Unit</th>
                  <th className="p-2 font-medium text-h1-text-secondary">Ref. Range</th>
                  <th className="p-2 font-medium text-h1-text-secondary">Flag</th>
                </tr></thead>
                <tbody>{entry.parameters.filter((p: any) => p.is_reportable).map((p: any) => {
                  const val = values[p.id] || '';
                  const v = val ? entry.validateResult(p.id, val, selectedOrder.patientAge, selectedOrder.patientGender) : null;
                  return (
                    <tr key={p.id} className={`border-b border-h1-border
                      ${v?.isCritical ? 'bg-h1-red/[0.05]' : v?.isAbnormal ? 'bg-h1-yellow/[0.05]' : ''}`}>
                      <td className="p-2 font-medium text-h1-text">{p.parameter_name}</td>
                      <td className="p-2">
                        <input type={p.data_type === 'numeric' ? 'number' : 'text'} value={val}
                          onChange={e => setValues(prev => ({ ...prev, [p.id]: e.target.value }))}
                          className={`w-full px-2 py-1 border rounded-h1-sm text-h1-body text-right
                            focus:outline-none focus:ring-1 focus:ring-h1-teal placeholder:text-h1-text-muted/40
                            ${v?.isCritical ? 'border-h1-red bg-h1-red/5 font-bold text-h1-red' : v?.isAbnormal ? 'border-h1-yellow bg-h1-yellow/5 font-bold' : 'border-h1-border'}`}
                          step="any" placeholder="—" />
                      </td>
                      <td className="p-2 text-center text-h1-text-muted">{p.unit || ''}</td>
                      <td className="p-2 text-center text-h1-text-muted">
                        {p.ref_range_min !== null && p.ref_range_max !== null ? `${p.ref_range_min} — ${p.ref_range_max}` : p.ref_range_text || '—'}
                      </td>
                      <td className="p-2 text-center">
                        {v?.isCritical && <span className="bg-h1-red text-white px-1.5 py-0.5 rounded-h1-sm text-[10px] font-bold">CRITICAL</span>}
                        {!v?.isCritical && v?.isAbnormal && <span className="bg-h1-yellow text-white px-1.5 py-0.5 rounded-h1-sm text-[10px]">ABN</span>}
                        {v?.deltaFlag && <span className="bg-h1-yellow/10 text-h1-yellow px-1 py-0.5 rounded text-[10px] ml-0.5">Δ{Math.round(v.deltaPercent || 0)}%</span>}
                      </td>
                    </tr>
                  );
                })}</tbody>
              </table>
            </div>

            <div className="flex gap-2">
              <button onClick={handleSave}
                className="px-4 py-2 bg-h1-success text-white text-h1-small font-medium rounded-h1-sm
                  hover:bg-h1-success/90 transition-colors cursor-pointer">Save Results</button>
              <button onClick={handlePrint}
                className="px-4 py-2 bg-h1-teal text-white text-h1-small font-medium rounded-h1-sm
                  hover:bg-h1-teal/90 transition-colors cursor-pointer">Print Report</button>
              <button onClick={onDone}
                className="px-4 py-2 bg-h1-navy/5 text-h1-text-secondary text-h1-small font-medium rounded-h1-sm
                  hover:bg-h1-navy/10 transition-colors cursor-pointer">Back to Worklist</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
