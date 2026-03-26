// components/lab/lab-tat.tsx
// TAT performance dashboard with compliance stats and breach list
'use client';
import React from 'react';
import Link from 'next/link';
import { Clock, AlertTriangle, CheckCircle, XCircle } from 'lucide-react';
import type { LabOrder } from '@/lib/lab/lims-hooks';

interface LabTATProps {
  orders: LabOrder[];
  stats: { tatBreached: number };
}

export default function LabTAT({ orders, stats }: LabTATProps) {
  const completed = orders.filter(o => o.status === 'completed');
  const met = completed.filter(o => o.tatMet === true).length;
  const breached = completed.filter(o => o.tatMet === false).length;
  const pct = completed.length > 0 ? Math.round(met / completed.length * 100) : 0;

  const pctColor = pct >= 90 ? 'text-h1-success' : pct >= 70 ? 'text-h1-yellow' : 'text-h1-red';
  const pctBg = pct >= 90 ? 'bg-h1-success/10' : pct >= 70 ? 'bg-h1-yellow/10' : 'bg-h1-red/10';

  const currentlyBreaching = orders.filter(o =>
    o.tatDeadline && new Date(o.tatDeadline) < new Date() && o.status !== 'completed'
  );

  return (
    <div>
      <h2 className="text-h1-card-title text-h1-navy mb-3">TAT Performance</h2>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
        <div className="bg-h1-navy/5 rounded-h1 p-4">
          <div className="flex items-center gap-1.5 text-h1-small text-h1-text-secondary mb-1">
            <Clock className="w-3.5 h-3.5" /> Completed
          </div>
          <div className="text-xl font-bold text-h1-navy">{completed.length}</div>
        </div>
        <div className="bg-h1-success/10 rounded-h1 p-4">
          <div className="flex items-center gap-1.5 text-h1-small text-h1-text-secondary mb-1">
            <CheckCircle className="w-3.5 h-3.5 text-h1-success" /> TAT Met
          </div>
          <div className="text-xl font-bold text-h1-success">{met}</div>
        </div>
        <div className="bg-h1-red/10 rounded-h1 p-4">
          <div className="flex items-center gap-1.5 text-h1-small text-h1-text-secondary mb-1">
            <XCircle className="w-3.5 h-3.5 text-h1-red" /> TAT Breached
          </div>
          <div className="text-xl font-bold text-h1-red">{breached}</div>
        </div>
        <div className={`${pctBg} rounded-h1 p-4`}>
          <div className="text-h1-small text-h1-text-secondary mb-1">Compliance</div>
          <div className={`text-xl font-bold ${pctColor}`}>{pct}%</div>
        </div>
      </div>

      {/* Currently breaching */}
      {currentlyBreaching.length > 0 && (
        <div className="bg-h1-red/[0.04] rounded-h1 border border-h1-red/20 p-4">
          <h3 className="text-h1-body font-semibold text-h1-red mb-2 flex items-center gap-1.5">
            <AlertTriangle className="w-4 h-4" />
            Currently Breaching TAT ({currentlyBreaching.length})
          </h3>
          {currentlyBreaching.map(o => (
            <div key={o.id} className="flex items-center justify-between py-1.5 border-b border-h1-red/10 last:border-0 text-h1-small">
              <span className="text-h1-text">
                {o.patientId ? <Link href={`/patients/${o.patientId}`} className="hover:text-h1-teal hover:underline">{o.patientName}</Link> : o.patientName}
                {' — '}{o.testName}
              </span>
              <span className="text-h1-red font-medium">
                Overdue by {Math.round((Date.now() - new Date(o.tatDeadline!).getTime()) / 60000)} min
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
