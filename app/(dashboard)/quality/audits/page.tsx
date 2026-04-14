// @ts-nocheck
'use client';
import { useEffect, useState } from 'react';

export default function AuditsPage() {
  const [templates, setTemplates] = useState<any[]>([]);
  const [runs, setRuns] = useState<any[]>([]);
  const centreId = 'c0000001-0000-0000-0000-000000000001';

  useEffect(() => {
    Promise.all([
      fetch(`/api/quality/audits/templates?centre_id=${centreId}`).then(r => r.json()),
      fetch(`/api/quality/audits/runs?centre_id=${centreId}`).then(r => r.json()),
    ]).then(([t, r]) => { setTemplates(t); setRuns(r); });
  }, []);

  const startAudit = async (templateId: string) => {
    const res = await fetch('/api/quality/audits/runs', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ centre_id: centreId, template_id: templateId, audit_date: new Date().toISOString().split('T')[0] }),
    });
    if (res.ok) { const r = await res.json(); setRuns(prev => [r, ...prev]); }
  };

  return (
    <div className="p-6 space-y-6">
      <h1 className="text-2xl font-bold">Clinical Audits</h1>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {templates.map((t: any) => (
          <div key={t.id} className="border rounded-lg p-4">
            <h3 className="font-semibold text-sm">{t.template_name}</h3>
            <p className="text-xs text-gray-500 mt-1">{t.description}</p>
            <div className="text-xs text-gray-400 mt-1">{t.items?.length || 0} items • {t.frequency}</div>
            <button onClick={() => startAudit(t.id)} className="mt-3 text-xs px-3 py-1.5 bg-blue-600 text-white rounded hover:bg-blue-700">Start Audit</button>
          </div>
        ))}
      </div>
      <div className="border rounded-lg">
        <div className="bg-gray-50 dark:bg-gray-800 px-4 py-2 font-semibold text-sm">Recent Audit Runs</div>
        <div className="divide-y">
          {runs.length === 0 && <div className="p-6 text-center text-gray-500">No audits completed yet</div>}
          {runs.map((r: any) => (
            <div key={r.id} className="px-4 py-3 flex items-center justify-between">
              <div>
                <div className="font-medium text-sm">{r.template?.template_name}</div>
                <div className="text-xs text-gray-500">{new Date(r.audit_date).toLocaleDateString()} • {r.status}</div>
              </div>
              {r.compliance_pct !== null && (
                <div className={`text-lg font-bold ${r.compliance_pct >= 80 ? 'text-green-600' : 'text-red-600'}`}>{r.compliance_pct}%</div>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
