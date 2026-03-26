// components/lab/lab-outsourced.tsx
// Outsourced lab tracking with proper modal for dispatching
'use client';
import React from 'react';
import { StatusBadge } from '@/components/ui/shared';

interface LabOutsourcedProps {
  outsourced: any[];
  onUpdateStatus: (id: string, status: string) => Promise<void>;
  onFlash: (msg: string) => void;
}

const STATUS_OPTIONS = [
  { value: 'in_transit', label: 'In Transit' },
  { value: 'received_by_lab', label: 'Received by Lab' },
  { value: 'processing', label: 'Processing' },
  { value: 'reported', label: 'Reported' },
  { value: 'received_back', label: 'Received Back' },
];

export default function LabOutsourced({ outsourced, onUpdateStatus, onFlash }: LabOutsourcedProps) {
  return (
    <div>
      <h2 className="text-h1-card-title text-h1-navy mb-3">Outsourced Lab Tracking</h2>

      {outsourced.length === 0 ? (
        <div className="text-center py-12 bg-h1-card rounded-h1 border border-h1-border text-h1-text-muted text-h1-body">
          No outsourced tests
        </div>
      ) : (
        <div className="bg-h1-card rounded-h1 border border-h1-border overflow-hidden">
          <table className="w-full text-h1-small">
            <thead>
              <tr className="bg-h1-navy/[0.03] border-b border-h1-border">
                <th className="text-left p-2.5 font-medium text-h1-text-secondary">Test</th>
                <th className="text-left p-2.5 font-medium text-h1-text-secondary">Patient</th>
                <th className="text-left p-2.5 font-medium text-h1-text-secondary">External Lab</th>
                <th className="p-2.5 font-medium text-h1-text-secondary">Dispatched</th>
                <th className="p-2.5 font-medium text-h1-text-secondary">Expected</th>
                <th className="p-2.5 font-medium text-h1-text-secondary">Status</th>
                <th className="p-2.5 font-medium text-h1-text-secondary">Actions</th>
              </tr>
            </thead>
            <tbody>
              {outsourced.map((o: any) => (
                <tr key={o.id} className="border-b border-h1-border hover:bg-h1-navy/[0.02]">
                  <td className="p-2.5 text-h1-text">{o.order?.test?.test_name}</td>
                  <td className="p-2.5 text-h1-text">
                    {o.order?.patient?.first_name} {o.order?.patient?.last_name}
                    <span className="text-h1-text-muted ml-1">({o.order?.patient?.uhid})</span>
                  </td>
                  <td className="p-2.5 font-medium text-h1-text">{o.external_lab_name}</td>
                  <td className="p-2.5 text-center text-h1-text-secondary">{o.dispatch_date}</td>
                  <td className="p-2.5 text-center text-h1-text-secondary">{o.expected_return || '—'}</td>
                  <td className="p-2.5 text-center"><StatusBadge status={o.status} /></td>
                  <td className="p-2.5 text-center">
                    {o.status !== 'received_back' && (
                      <select
                        onChange={async e => {
                          if (e.target.value) {
                            await onUpdateStatus(o.id, e.target.value);
                            onFlash('Status updated');
                            e.target.value = '';
                          }
                        }}
                        className="text-[10px] border border-h1-border rounded-h1-sm px-1.5 py-1
                          focus:outline-none focus:ring-1 focus:ring-h1-teal"
                        defaultValue=""
                      >
                        <option value="" disabled>Update...</option>
                        {STATUS_OPTIONS.map(s => (
                          <option key={s.value} value={s.value}>{s.label}</option>
                        ))}
                      </select>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
