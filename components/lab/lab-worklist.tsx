// components/lab/lab-worklist.tsx
// Lab worklist: table on desktop, card view on mobile
'use client';
import React from 'react';
import Link from 'next/link';
import { TableSkeleton } from '@/components/ui/shared';
import type { LabOrder } from '@/lib/lab/lims-hooks';

interface LabWorklistProps {
  orders: LabOrder[];
  loading: boolean;
  statusFilter: string;
  onStatusFilter: (s: string) => void;
  onCollect: (order: LabOrder) => void;
  onResults: (order: LabOrder) => void;
  onVerify: (order: LabOrder) => void;
  onPrint: (order: LabOrder) => void;
  onWhatsApp: (order: LabOrder) => void;
  onOutsource: (order: LabOrder) => void;
}

const FILTERS: [string, string][] = [
  ['all', 'All'], ['ordered', 'Pending'], ['sample_collected', 'Collected'],
  ['processing', 'Processing'], ['completed', 'Completed'],
];

function priorityClass(p: string) {
  if (p === 'stat') return 'bg-h1-red/10 text-h1-red font-bold animate-pulse';
  if (p === 'urgent') return 'bg-h1-yellow/10 text-h1-yellow';
  return 'bg-h1-navy/5 text-h1-text-muted';
}

function statusClass(s: string) {
  if (s === 'ordered') return 'bg-h1-yellow/10 text-h1-yellow';
  if (s === 'sample_collected') return 'bg-h1-teal/10 text-h1-teal';
  if (s === 'processing') return 'bg-purple-50 text-purple-700';
  if (s === 'completed') return 'bg-h1-success/10 text-h1-success';
  return 'bg-h1-navy/5 text-h1-text-muted';
}

export default function LabWorklist({
  orders, loading, statusFilter, onStatusFilter,
  onCollect, onResults, onVerify, onPrint, onWhatsApp, onOutsource,
}: LabWorklistProps) {
  return (
    <div>
      {/* Filters */}
      <div className="flex gap-1.5 mb-3 flex-wrap">
        {FILTERS.map(([k, l]) => (
          <button key={k} onClick={() => onStatusFilter(k)}
            className={`px-3 py-1.5 text-h1-small font-medium rounded-h1-sm border transition-colors cursor-pointer
              ${statusFilter === k
                ? 'bg-h1-teal text-white border-h1-teal'
                : 'bg-h1-card border-h1-border text-h1-text-secondary hover:bg-h1-navy/5'}`}>
            {l}
          </button>
        ))}
      </div>

      {loading ? <TableSkeleton rows={8} cols={6} /> :
      orders.length === 0 ? (
        <div className="text-center py-12 bg-h1-card rounded-h1 border border-h1-border text-h1-text-muted text-h1-body">
          No lab orders for this date
        </div>
      ) : (
        <>
          {/* Desktop table */}
          <div className="hidden md:block bg-h1-card rounded-h1 border border-h1-border overflow-x-auto">
            <table className="w-full text-h1-small">
              <thead>
                <tr className="bg-h1-navy/[0.03] border-b border-h1-border">
                  <th className="text-left p-2.5 font-medium text-h1-text-secondary">Patient</th>
                  <th className="text-left p-2.5 font-medium text-h1-text-secondary">Test</th>
                  <th className="p-2.5 font-medium text-h1-text-secondary">Priority</th>
                  <th className="text-left p-2.5 font-medium text-h1-text-secondary">Barcode</th>
                  <th className="p-2.5 font-medium text-h1-text-secondary">Status</th>
                  <th className="p-2.5 font-medium text-h1-text-secondary">TAT</th>
                  <th className="p-2.5 font-medium text-h1-text-secondary">Actions</th>
                </tr>
              </thead>
              <tbody>
                {orders.map(o => (
                  <tr key={o.id} className={`border-b border-h1-border hover:bg-h1-navy/[0.02] transition-colors
                    ${o.priority === 'stat' ? 'bg-h1-red/[0.03]' : ''}`}>
                    <td className="p-2.5">
                      <div className="font-medium text-h1-text">
                        {o.patientId ? <Link href={`/patients/${o.patientId}`} className="hover:text-h1-teal hover:underline">{o.patientName}</Link> : o.patientName}
                      </div>
                      <div className="text-[10px] text-h1-text-muted">{o.patientUhid} | {o.patientAge}/{o.patientGender?.charAt(0).toUpperCase()}</div>
                    </td>
                    <td className="p-2.5">
                      <div className="font-medium text-h1-text">{o.testName}</div>
                      <div className="text-[10px] text-h1-text-muted">{o.testCode} | {o.category}</div>
                    </td>
                    <td className="p-2.5 text-center">
                      <span className={`px-1.5 py-0.5 rounded-h1-sm text-[10px] ${priorityClass(o.priority)}`}>
                        {o.priority.toUpperCase()}
                      </span>
                    </td>
                    <td className="p-2.5 font-mono text-[10px] text-h1-text-secondary">
                      {o.sampleBarcode || <span className="text-h1-text-muted">—</span>}
                    </td>
                    <td className="p-2.5 text-center">
                      <span className={`px-1.5 py-0.5 rounded-h1-sm text-[10px] ${statusClass(o.status)}`}>
                        {o.status.replace('_', ' ')}
                      </span>
                    </td>
                    <td className="p-2.5 text-center">
                      {o.tatDeadline ? (
                        new Date(o.tatDeadline) < new Date() && o.status !== 'completed'
                          ? <span className="text-h1-red font-bold text-[10px]">BREACHED</span>
                          : <span className="text-h1-success text-[10px]">OK</span>
                      ) : <span className="text-h1-text-muted">—</span>}
                    </td>
                    <td className="p-2.5 text-center">
                      <div className="flex gap-1 justify-center flex-wrap">
                        {o.status === 'ordered' && (
                          <>
                            <ActionBtn label="Collect" color="teal" onClick={() => onCollect(o)} />
                            <ActionBtn label="Outsource" color="yellow" onClick={() => onOutsource(o)} />
                          </>
                        )}
                        {(o.status === 'sample_collected' || o.status === 'processing') && (
                          <ActionBtn label="Results" color="purple" onClick={() => onResults(o)} />
                        )}
                        {o.status === 'processing' && (
                          <ActionBtn label="Verify" color="green" onClick={() => onVerify(o)} />
                        )}
                        {o.status === 'completed' && (
                          <>
                            <ActionBtn label="Print" color="teal" onClick={() => onPrint(o)} />
                            <ActionBtn label="WhatsApp" color="green" onClick={() => onWhatsApp(o)} />
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Mobile card view */}
          <div className="md:hidden space-y-2">
            {orders.map(o => (
              <div key={o.id} className={`bg-h1-card rounded-h1 border border-h1-border p-3
                ${o.priority === 'stat' ? 'border-l-4 border-l-h1-red' : ''}`}>
                <div className="flex items-start justify-between mb-1.5">
                  <div>
                    <div className="font-medium text-h1-body text-h1-text">{o.patientName}</div>
                    <div className="text-[10px] text-h1-text-muted">{o.patientUhid} | {o.patientAge}/{o.patientGender?.charAt(0).toUpperCase()}</div>
                  </div>
                  <span className={`px-1.5 py-0.5 rounded-h1-sm text-[10px] ${statusClass(o.status)}`}>
                    {o.status.replace('_', ' ')}
                  </span>
                </div>
                <div className="text-h1-small font-medium text-h1-text mb-2">{o.testName}
                  <span className={`ml-2 px-1 py-0.5 rounded text-[9px] ${priorityClass(o.priority)}`}>
                    {o.priority.toUpperCase()}
                  </span>
                </div>
                <div className="flex gap-1.5 flex-wrap">
                  {o.status === 'ordered' && <ActionBtn label="Collect" color="teal" onClick={() => onCollect(o)} />}
                  {o.status === 'ordered' && <ActionBtn label="Outsource" color="yellow" onClick={() => onOutsource(o)} />}
                  {(o.status === 'sample_collected' || o.status === 'processing') && <ActionBtn label="Results" color="purple" onClick={() => onResults(o)} />}
                  {o.status === 'processing' && <ActionBtn label="Verify" color="green" onClick={() => onVerify(o)} />}
                  {o.status === 'completed' && <ActionBtn label="Print" color="teal" onClick={() => onPrint(o)} />}
                  {o.status === 'completed' && <ActionBtn label="WhatsApp" color="green" onClick={() => onWhatsApp(o)} />}
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

function ActionBtn({ label, color, onClick }: { label: string; color: string; onClick: () => void }) {
  const colorMap: Record<string, string> = {
    teal: 'bg-h1-teal/10 text-h1-teal hover:bg-h1-teal/20',
    green: 'bg-h1-success/10 text-h1-success hover:bg-h1-success/20',
    purple: 'bg-purple-50 text-purple-700 hover:bg-purple-100',
    yellow: 'bg-h1-yellow/10 text-h1-yellow hover:bg-h1-yellow/20',
    red: 'bg-h1-red/10 text-h1-red hover:bg-h1-red/20',
  };
  return (
    <button onClick={onClick}
      className={`px-2 py-0.5 rounded-h1-sm text-[10px] font-medium transition-colors cursor-pointer ${colorMap[color] || colorMap.teal}`}>
      {label}
    </button>
  );
}
