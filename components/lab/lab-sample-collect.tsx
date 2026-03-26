// components/lab/lab-sample-collect.tsx
// Pending sample collection + recently collected list
'use client';
import React, { useState } from 'react';
import Link from 'next/link';
import type { LabOrder } from '@/lib/lab/lims-hooks';
import { printBarcodeLabel } from '@/components/lab/barcode-label';
import { RejectSampleModal } from './lab-modal';

interface LabSampleCollectProps {
  orders: LabOrder[];
  onCollect: (orderId: string, sampleType: string) => Promise<{ barcode: string } | null>;
  onReject: (orderId: string, reason: string) => Promise<void>;
  onFlash: (msg: string) => void;
}

const SAMPLE_TYPES = ['blood', 'serum', 'plasma', 'urine', 'stool', 'csf', 'sputum', 'swab', 'fluid', 'tissue'];

function priorityClass(p: string) {
  if (p === 'stat') return 'border-h1-red bg-h1-red/[0.03]';
  return '';
}

export default function LabSampleCollect({ orders, onCollect, onReject, onFlash }: LabSampleCollectProps) {
  const pending = orders.filter(o => o.status === 'ordered');
  const collected = orders.filter(o => o.status === 'sample_collected');
  const [rejectTarget, setRejectTarget] = useState<LabOrder | null>(null);
  const [sampleTypes, setSampleTypes] = useState<Record<string, string>>({});

  const handleCollect = async (order: LabOrder) => {
    const sType = sampleTypes[order.id] || 'blood';
    const result = await onCollect(order.id, sType);
    if (result?.barcode) {
      onFlash('Collected! Barcode: ' + result.barcode);
      printBarcodeLabel({
        barcode: result.barcode, patientName: order.patientName, uhid: order.patientUhid || '',
        age: String(order.patientAge || ''), gender: order.patientGender || '', testName: order.testName,
        testCode: order.testCode || '', sampleType: sType, priority: order.priority,
        collectedAt: new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }),
      });
    }
  };

  return (
    <div>
      <h2 className="text-h1-card-title text-h1-navy mb-3">Pending Sample Collection</h2>

      {pending.length === 0 ? (
        <div className="text-center py-12 bg-h1-card rounded-h1 border border-h1-border text-h1-text-muted text-h1-body">
          All samples collected
        </div>
      ) : (
        <div className="space-y-2 mb-6">
          {pending.map(o => (
            <div key={o.id} className={`bg-h1-card rounded-h1 border border-h1-border p-3 ${priorityClass(o.priority)}`}>
              <div className="flex items-center justify-between mb-2">
                <div>
                  <div className="font-medium text-h1-body text-h1-text">
                    {o.patientId ? <Link href={`/patients/${o.patientId}`} className="hover:text-h1-teal hover:underline">{o.patientName}</Link> : o.patientName}
                    <span className="text-h1-text-muted text-h1-small ml-2">({o.patientUhid})</span>
                  </div>
                  <div className="text-h1-small text-h1-text-secondary">{o.testName} ({o.testCode}) | Dr. {o.orderedBy}</div>
                  {o.clinicalInfo && <div className="text-[10px] text-h1-teal mt-0.5">Clinical: {o.clinicalInfo}</div>}
                </div>
                <span className={`px-2 py-0.5 rounded-h1-sm text-[10px] font-medium
                  ${o.priority === 'stat' ? 'bg-h1-red/10 text-h1-red font-bold animate-pulse' : o.priority === 'urgent' ? 'bg-h1-yellow/10 text-h1-yellow' : 'bg-h1-navy/5 text-h1-text-muted'}`}>
                  {o.priority.toUpperCase()}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <select
                  value={sampleTypes[o.id] || 'blood'}
                  onChange={e => setSampleTypes(prev => ({ ...prev, [o.id]: e.target.value }))}
                  className="text-h1-small border border-h1-border rounded-h1-sm px-2 py-1.5
                    focus:outline-none focus:ring-1 focus:ring-h1-teal"
                >
                  {SAMPLE_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                </select>
                <button onClick={() => handleCollect(o)}
                  className="px-3 py-1.5 bg-h1-teal text-white text-h1-small font-medium rounded-h1-sm
                    hover:bg-h1-teal/90 transition-colors cursor-pointer">
                  Collect &amp; Label
                </button>
                <button onClick={() => setRejectTarget(o)}
                  className="px-3 py-1.5 bg-h1-red/10 text-h1-red text-h1-small font-medium rounded-h1-sm
                    hover:bg-h1-red/20 transition-colors cursor-pointer">
                  Reject
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Recently collected */}
      {collected.length > 0 && (
        <div>
          <h3 className="text-h1-small font-semibold text-h1-text-secondary mb-2">
            Recently Collected ({collected.length})
          </h3>
          <div className="bg-h1-card rounded-h1 border border-h1-border overflow-hidden">
            <table className="w-full text-h1-small">
              <thead>
                <tr className="bg-h1-navy/[0.03] border-b border-h1-border">
                  <th className="text-left p-2 font-medium text-h1-text-secondary">Patient</th>
                  <th className="text-left p-2 font-medium text-h1-text-secondary">Test</th>
                  <th className="p-2 font-medium text-h1-text-secondary">Barcode</th>
                  <th className="p-2 font-medium text-h1-text-secondary">Priority</th>
                </tr>
              </thead>
              <tbody>
                {collected.map(o => (
                  <tr key={o.id} className="border-b border-h1-border hover:bg-h1-navy/[0.02]">
                    <td className="p-2 text-h1-text">
                      {o.patientName} <span className="text-h1-text-muted">({o.patientUhid})</span>
                    </td>
                    <td className="p-2 text-h1-text">{o.testName}</td>
                    <td className="p-2 text-center font-mono text-h1-teal">{o.sampleBarcode || '—'}</td>
                    <td className="p-2 text-center">
                      <span className={`px-1.5 py-0.5 rounded-h1-sm text-[10px]
                        ${o.priority === 'stat' ? 'bg-h1-red/10 text-h1-red' : 'bg-h1-navy/5 text-h1-text-muted'}`}>
                        {o.priority}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Reject modal */}
      <RejectSampleModal
        open={!!rejectTarget}
        onClose={() => setRejectTarget(null)}
        onConfirm={async (reason) => {
          if (rejectTarget) {
            await onReject(rejectTarget.id, reason);
            onFlash('Sample rejected');
          }
        }}
        patientName={rejectTarget?.patientName}
        testName={rejectTarget?.testName}
      />
    </div>
  );
}
