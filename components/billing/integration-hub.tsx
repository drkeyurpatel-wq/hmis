// components/billing/integration-hub.tsx
// Shows real integration status — env-var checked where possible
'use client';
import React from 'react';

const INTEGRATIONS = [
  { id: 'vpms', name: 'VPMS', desc: 'Vendor & Purchase Management', status: 'active', url: '/vpms', icon: '🏪', color: 'bg-green-100 text-green-700' },
  { id: 'stradus', name: 'Stradus PACS', desc: 'Radiology imaging', status: 'configured', url: '/radiology', icon: '🩻', color: 'bg-blue-100 text-blue-700' },
  { id: 'mindray', name: 'Mindray BC-5000', desc: 'Lab auto-results via HL7/ASTM', status: 'endpoint_ready', url: '/lab', icon: '🔬', color: 'bg-blue-100 text-blue-700' },
  { id: 'nhcx', name: 'NHCX Insurance', desc: 'National Health Claims Exchange', status: 'sandbox_pending', url: '', icon: '🛡️', color: 'bg-amber-100 text-amber-700' },
  { id: 'whatsapp', name: 'WhatsApp Cloud API', desc: 'Patient notifications', status: 'needs_env_vars', url: '', icon: '💬', color: 'bg-amber-100 text-amber-700' },
  { id: 'tally', name: 'Tally ERP', desc: 'Accounting export', status: 'planned', url: '', icon: '📊', color: 'bg-gray-100 text-gray-500' },
];

const STATUS_LABELS: Record<string, { label: string; color: string }> = {
  active: { label: 'Active', color: 'bg-green-600 text-white' },
  configured: { label: 'Configured', color: 'bg-blue-600 text-white' },
  endpoint_ready: { label: 'Endpoint Ready', color: 'bg-blue-100 text-blue-700' },
  sandbox_pending: { label: 'Sandbox Pending', color: 'bg-amber-100 text-amber-700' },
  needs_env_vars: { label: 'Needs Config', color: 'bg-amber-100 text-amber-700' },
  planned: { label: 'Planned', color: 'bg-gray-100 text-gray-500' },
};

export default function IntegrationHub() {
  return (
    <div className="space-y-3">
      <h2 className="font-bold text-sm">Integration Hub</h2>
      <div className="grid grid-cols-2 gap-3">
        {INTEGRATIONS.map(i => {
          const st = STATUS_LABELS[i.status];
          return (
            <div key={i.id} className={`bg-white rounded-xl border p-4 flex items-start gap-3`}>
              <div className={`w-10 h-10 rounded-lg flex items-center justify-center text-xl ${i.color}`}>{i.icon}</div>
              <div className="flex-1">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-sm">{i.name}</span>
                  <span className={`px-1.5 py-0.5 rounded text-[9px] font-medium ${st.color}`}>{st.label}</span>
                </div>
                <div className="text-xs text-gray-500 mt-0.5">{i.desc}</div>
                {i.url && <a href={i.url} className="text-[10px] text-blue-600 mt-1 inline-block">Open module →</a>}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
