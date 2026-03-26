// components/lab/lab-verify.tsx
// Verify results + print report + WhatsApp delivery
'use client';
import React, { useState } from 'react';
import Link from 'next/link';
import { TableSkeleton, printLabReport } from '@/components/ui/shared';
import { useResultEntry, type LabOrder } from '@/lib/lab/lims-hooks';
import { sendLabReportWhatsApp, generateResultSummary } from '@/lib/lab/report-templates';
import { PhoneModal } from './lab-modal';

interface LabVerifyProps {
  orders: LabOrder[];
  selectedOrder: LabOrder | null;
  onSelectOrder: (o: LabOrder) => void;
  staffId: string;
  onFlash: (msg: string) => void;
  onDone: () => void;
}

export default function LabVerify({ orders, selectedOrder, onSelectOrder, staffId, onFlash, onDone }: LabVerifyProps) {
  const entry = useResultEntry(selectedOrder?.id || null);
  const [showPhone, setShowPhone] = useState(false);

  const handleVerify = async () => {
    await entry.verifyResults(staffId);
    onFlash('Results verified & reported');
    onDone();
  };

  const handlePrint = () => {
    if (!selectedOrder) return;
    printLabReport({
      patientName: selectedOrder.patientName, uhid: selectedOrder.patientUhid || '',
      age: selectedOrder.patientAge || '', gender: selectedOrder.patientGender || '',
      testName: selectedOrder.testName, testCode: selectedOrder.testCode || '',
      barcode: selectedOrder.sampleBarcode || '', orderedBy: selectedOrder.orderedBy || '',
      results: entry.results.map((r: any) => ({
        parameterName: r.parameter_name, value: r.result_value, unit: r.unit || '',
        refRange: r.normal_range_min != null && r.normal_range_max != null ? `${r.normal_range_min} — ${r.normal_range_max}` : '—',
        flag: r.is_critical ? 'CRITICAL' : r.is_abnormal ? 'ABN' : '',
      })),
    });
  };

  const handleWhatsApp = (phone: string) => {
    if (!selectedOrder) return;
    const results = entry.results.map((r: any) => ({
      parameterName: r.parameter_name, value: r.result_value, unit: r.unit || '',
      flag: r.is_critical ? 'CRITICAL' : r.is_abnormal ? 'ABN' : '',
    }));
    const summary = generateResultSummary(results);
    sendLabReportWhatsApp(phone, {
      patientName: selectedOrder.patientName, uhid: selectedOrder.patientUhid,
      testName: selectedOrder.testName, resultSummary: summary,
    });
    onFlash('WhatsApp message sent');
  };

  return (
    <div className="flex gap-3">
      <div className="w-64 flex-shrink-0 space-y-1.5">
        <h3 className="text-h1-small font-semibold text-h1-text-secondary mb-2">Awaiting verification</h3>
        {orders.length === 0 ? (
          <div className="text-h1-small text-h1-text-muted text-center py-4">No orders awaiting verification</div>
        ) : orders.map(o => (
          <button key={o.id} onClick={() => onSelectOrder(o)}
            className={`w-full text-left p-2.5 rounded-h1-sm border transition-colors cursor-pointer text-h1-small
              ${selectedOrder?.id === o.id ? 'border-h1-success bg-h1-success/5' : 'border-h1-border hover:bg-h1-navy/[0.02]'}`}>
            <div className="font-medium text-h1-text">
              {o.patientId ? <Link href={`/patients/${o.patientId}`} className="hover:text-h1-teal">{o.patientName}</Link> : o.patientName}
            </div>
            <div className="text-[10px] text-h1-text-muted">{o.testName}</div>
          </button>
        ))}
      </div>

      <div className="flex-1 min-w-0">
        {!selectedOrder ? (
          <div className="text-center py-12 bg-h1-card rounded-h1 border border-h1-border text-h1-text-muted text-h1-body">
            Select an order to verify
          </div>
        ) : (
          <div className="bg-h1-card rounded-h1 border border-h1-border p-4">
            <div className="mb-3">
              <div className="text-h1-card-title text-h1-navy">{selectedOrder.testName}</div>
              <div className="text-h1-small text-h1-text-muted">
                {selectedOrder.patientName} | {selectedOrder.patientUhid} | Barcode: {selectedOrder.sampleBarcode}
              </div>
            </div>

            <div className="border border-h1-border rounded-h1-sm overflow-hidden mb-4">
              <table className="w-full text-h1-small">
                <thead><tr className="bg-h1-navy/[0.03] border-b border-h1-border">
                  <th className="text-left p-2 font-medium text-h1-text-secondary">Parameter</th>
                  <th className="p-2 font-medium text-h1-text-secondary">Result</th>
                  <th className="p-2 font-medium text-h1-text-secondary">Unit</th>
                  <th className="p-2 font-medium text-h1-text-secondary">Ref. Range</th>
                  <th className="p-2 font-medium text-h1-text-secondary">Flag</th>
                </tr></thead>
                <tbody>{entry.results.map((r: any) => (
                  <tr key={r.id} className={`border-b border-h1-border
                    ${r.is_critical ? 'bg-h1-red/[0.05]' : r.is_abnormal ? 'bg-h1-yellow/[0.05]' : ''}`}>
                    <td className="p-2 font-medium text-h1-text">{r.parameter_name}</td>
                    <td className={`p-2 text-center font-bold ${r.is_critical ? 'text-h1-red' : r.is_abnormal ? 'text-h1-yellow' : 'text-h1-text'}`}>
                      {r.result_value}
                    </td>
                    <td className="p-2 text-center text-h1-text-muted">{r.unit}</td>
                    <td className="p-2 text-center text-h1-text-muted">
                      {r.normal_range_min && r.normal_range_max ? `${r.normal_range_min} — ${r.normal_range_max}` : '—'}
                    </td>
                    <td className="p-2 text-center">
                      {r.is_critical && <span className="bg-h1-red text-white px-1.5 py-0.5 rounded-h1-sm text-[10px] font-bold">CRIT</span>}
                      {!r.is_critical && r.is_abnormal && <span className="bg-h1-yellow text-white px-1.5 py-0.5 rounded-h1-sm text-[10px]">ABN</span>}
                      {r.delta_flag && <span className="bg-h1-yellow/10 text-h1-yellow px-1 py-0.5 rounded text-[10px] ml-0.5">Δ</span>}
                    </td>
                  </tr>
                ))}</tbody>
              </table>
            </div>

            <div className="flex gap-2">
              <button onClick={handleVerify}
                className="px-4 py-2 bg-h1-success text-white text-h1-small font-medium rounded-h1-sm
                  hover:bg-h1-success/90 transition-colors cursor-pointer">Verify &amp; Report</button>
              <button onClick={handlePrint}
                className="px-4 py-2 bg-h1-teal text-white text-h1-small font-medium rounded-h1-sm
                  hover:bg-h1-teal/90 transition-colors cursor-pointer">Print Report</button>
              <button onClick={() => setShowPhone(true)}
                className="px-4 py-2 bg-h1-success/10 text-h1-success text-h1-small font-medium rounded-h1-sm
                  hover:bg-h1-success/20 transition-colors cursor-pointer">WhatsApp</button>
              <button onClick={onDone}
                className="px-4 py-2 bg-h1-navy/5 text-h1-text-secondary text-h1-small font-medium rounded-h1-sm
                  hover:bg-h1-navy/10 transition-colors cursor-pointer">Back</button>
            </div>
          </div>
        )}
      </div>

      <PhoneModal open={showPhone} onClose={() => setShowPhone(false)}
        onConfirm={handleWhatsApp} patientName={selectedOrder?.patientName} />
    </div>
  );
}
