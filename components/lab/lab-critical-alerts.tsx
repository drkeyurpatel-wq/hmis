// components/lab/lab-critical-alerts.tsx
// Critical value alert management with proper modals
'use client';
import React, { useState } from 'react';
import { AlertTriangle } from 'lucide-react';
import { AcknowledgeModal } from './lab-modal';

interface CriticalAlert {
  id: string; parameter_name: string; result_value: string;
  critical_type: string; status: string;
  order?: { patient?: { first_name: string; last_name: string; uhid: string }; test?: { test_name: string } };
}

interface LabCriticalAlertsProps {
  alerts: CriticalAlert[];
  onNotify: (alertId: string, doctorId: string, staffId: string) => Promise<void>;
  onAcknowledge: (alertId: string, staffId: string, action: string) => Promise<void>;
  staffId: string;
  onFlash: (msg: string) => void;
}

export default function LabCriticalAlerts({ alerts, onNotify, onAcknowledge, staffId, onFlash }: LabCriticalAlertsProps) {
  const [ackTarget, setAckTarget] = useState<CriticalAlert | null>(null);

  return (
    <div>
      <h2 className="text-h1-card-title text-h1-navy mb-3">
        Critical Value Alerts <span className="text-h1-red">({alerts.length})</span>
      </h2>

      {alerts.length === 0 ? (
        <div className="text-center py-12 bg-h1-card rounded-h1 border border-h1-border text-h1-text-muted text-h1-body">
          No pending critical alerts
        </div>
      ) : (
        <div className="space-y-2">
          {alerts.map(a => (
            <div key={a.id} className="bg-h1-red/[0.04] rounded-h1 border border-h1-red/20 p-4">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <AlertTriangle className="w-5 h-5 text-h1-red" />
                  <span className="font-medium text-h1-body text-h1-text">
                    {a.order?.patient?.first_name} {a.order?.patient?.last_name}
                  </span>
                  <span className="text-h1-small text-h1-text-muted">{a.order?.patient?.uhid}</span>
                  <span className="text-h1-small bg-h1-red/10 text-h1-red px-1.5 py-0.5 rounded-h1-sm">
                    {a.order?.test?.test_name}
                  </span>
                </div>
                <span className={`px-2 py-0.5 rounded-h1-sm text-h1-small font-medium
                  ${a.status === 'pending' ? 'bg-h1-red/10 text-h1-red animate-pulse'
                    : a.status === 'notified' ? 'bg-h1-yellow/10 text-h1-yellow'
                    : 'bg-h1-success/10 text-h1-success'}`}>
                  {a.status}
                </span>
              </div>

              <div className="text-h1-body mb-3">
                <span className="font-medium text-h1-text">{a.parameter_name}:</span>{' '}
                <span className="text-h1-red font-bold text-lg">{a.result_value}</span>{' '}
                <span className="text-h1-small text-h1-text-muted">
                  ({a.critical_type === 'low' ? 'CRITICALLY LOW' : 'CRITICALLY HIGH'})
                </span>
              </div>

              <div className="flex gap-2">
                {a.status === 'pending' && (
                  <button onClick={async () => { await onNotify(a.id, '', staffId); onFlash('Doctor notified'); }}
                    className="px-3 py-1.5 bg-h1-yellow text-white text-h1-small font-medium rounded-h1-sm
                      hover:bg-h1-yellow/90 transition-colors cursor-pointer">
                    Mark Notified
                  </button>
                )}
                {(a.status === 'pending' || a.status === 'notified') && (
                  <button onClick={() => setAckTarget(a)}
                    className="px-3 py-1.5 bg-h1-success text-white text-h1-small font-medium rounded-h1-sm
                      hover:bg-h1-success/90 transition-colors cursor-pointer">
                    Acknowledge
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      <AcknowledgeModal
        open={!!ackTarget}
        onClose={() => setAckTarget(null)}
        onConfirm={async (action) => {
          if (ackTarget) {
            await onAcknowledge(ackTarget.id, staffId, action);
            onFlash('Critical value acknowledged');
          }
        }}
        parameterName={ackTarget?.parameter_name}
        value={ackTarget?.result_value}
      />
    </div>
  );
}
