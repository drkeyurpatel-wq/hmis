// components/lab/audit-panel.tsx
'use client';

import React, { useState, useEffect } from 'react';
import { useAuditLog, useNCR, useReflexRules } from '@/lib/lab/histo-hooks';

interface Props { centreId: string; staffId: string; onFlash: (m: string) => void; }

export default function AuditPanel({ centreId, staffId, onFlash }: Props) {
  const audit = useAuditLog();
  const ncr = useNCR();
  const reflex = useReflexRules();
  const [subTab, setSubTab] = useState<'audit' | 'ncr' | 'reflex'>('audit');
  const [entityFilter, setEntityFilter] = useState('');
  const [showNewNCR, setShowNewNCR] = useState(false);
  const [ncrForm, setNcrForm] = useState({ ncrType: 'non_conformance', title: '', description: '', severity: 'minor' });

  useEffect(() => { audit.load(entityFilter || undefined); }, [entityFilter]);

  const actionColor = (a: string) => a === 'create' ? 'bg-h1-success/10 text-h1-success' : a === 'verify' ? 'bg-h1-teal/10 text-h1-teal' : a === 'reject' ? 'bg-h1-red/10 text-h1-red' : a === 'update' ? 'bg-h1-yellow/10 text-h1-yellow' : a === 'print' ? 'bg-purple-50 text-purple-700' : a === 'amend' ? 'bg-h1-yellow/10 text-h1-yellow' : 'bg-h1-navy/5 text-h1-text-secondary';
  const severityColor = (s: string) => s === 'critical' ? 'bg-h1-red/10 text-h1-red' : s === 'major' ? 'bg-h1-yellow/10 text-h1-yellow' : 'bg-h1-yellow/10 text-h1-yellow';

  return (
    <div className="space-y-4">
      <div className="flex gap-2">
        {([['audit', 'Audit Trail'], ['ncr', `NCR/CAPA (${ncr.ncrs.filter(n => n.status !== 'closed').length})`], ['reflex', `Reflex Rules (${reflex.rules.length})`]] as [string, string][]).map(([k, l]) =>
          <button key={k} onClick={() => setSubTab(k as any)} className={`px-3 py-1.5 text-xs rounded-h1-sm ${subTab === k ? 'bg-blue-600 text-white' : 'bg-h1-navy/5'}`}>{l}</button>
        )}
      </div>

      {/* ===== AUDIT TRAIL ===== */}
      {subTab === 'audit' && <>
        <div className="flex items-center gap-2 mb-2">
          <select value={entityFilter} onChange={e => setEntityFilter(e.target.value)} className="text-sm border rounded-h1-sm px-3 py-1.5">
            <option value="">All entities</option>
            {['order','result','sample','culture','sensitivity','qc_result','histo_case','cyto_case','report','critical_alert','outsourced'].map(e =>
              <option key={e} value={e}>{e.replace('_', ' ')}</option>
            )}
          </select>
          <button onClick={() => audit.load(entityFilter || undefined)} className="px-3 py-1.5 bg-h1-navy/5 text-sm rounded-h1-sm">Refresh</button>
          <span className="text-xs text-h1-text-muted">{audit.logs.length} entries</span>
        </div>

        {audit.loading ? <div className="text-center py-8 text-h1-text-muted">Loading...</div> :
        audit.logs.length === 0 ? <div className="text-center py-8 bg-h1-card rounded-h1 border text-h1-text-muted text-sm">No audit entries. Actions will be logged as they occur.</div> :
        <div className="bg-h1-card rounded-h1 border overflow-hidden">
          <table className="w-full text-xs">
            <thead><tr className="bg-h1-navy/[0.03] border-b">
              <th className="text-left p-2.5 font-medium text-h1-text-secondary">Timestamp</th>
              <th className="p-2.5 font-medium text-h1-text-secondary">Action</th>
              <th className="text-left p-2.5 font-medium text-h1-text-secondary">Entity</th>
              <th className="text-left p-2.5 font-medium text-h1-text-secondary">Field</th>
              <th className="text-left p-2.5 font-medium text-h1-text-secondary">Old → New</th>
              <th className="text-left p-2.5 font-medium text-h1-text-secondary">By</th>
              <th className="text-left p-2.5 font-medium text-h1-text-secondary">Reason</th>
            </tr></thead>
            <tbody>{audit.logs.map((l: any) => (
              <tr key={l.id} className="border-b hover:bg-h1-navy/[0.03]">
                <td className="p-2.5 text-h1-text-secondary whitespace-nowrap">{new Date(l.performed_at).toLocaleString('en-IN', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit', second: '2-digit' })}</td>
                <td className="p-2.5 text-center"><span className={`px-1.5 py-0.5 rounded text-[10px] ${actionColor(l.action)}`}>{l.action}</span></td>
                <td className="p-2.5"><span className="bg-h1-navy/5 px-1.5 py-0.5 rounded text-[10px]">{l.entity_type}</span></td>
                <td className="p-2.5 text-h1-text-secondary">{l.field_name || '—'}</td>
                <td className="p-2.5">
                  {l.old_value && <span className="text-red-500 line-through text-[10px]">{l.old_value?.substring(0, 30)}</span>}
                  {l.old_value && l.new_value && <span className="text-h1-text-muted"> → </span>}
                  {l.new_value && <span className="text-h1-success text-[10px]">{l.new_value?.substring(0, 30)}</span>}
                </td>
                <td className="p-2.5">{l.staff?.full_name || '—'}</td>
                <td className="p-2.5 text-h1-text-muted max-w-[150px] truncate">{l.reason || ''}</td>
              </tr>
            ))}</tbody>
          </table>
        </div>}
      </>}

      {/* ===== NCR / CAPA ===== */}
      {subTab === 'ncr' && <>
        <div className="flex justify-between items-center mb-2">
          <h3 className="text-sm font-medium">Non-Conformance / CAPA Register</h3>
          <button onClick={() => setShowNewNCR(!showNewNCR)} className="px-3 py-1.5 bg-blue-600 text-white text-xs rounded-h1-sm">{showNewNCR ? 'Cancel' : '+ New NCR'}</button>
        </div>

        {showNewNCR && <div className="bg-h1-card rounded-h1 border p-5 mb-4 space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div><label className="text-xs text-h1-text-secondary">Type *</label>
              <select value={ncrForm.ncrType} onChange={e => setNcrForm(f => ({...f, ncrType: e.target.value}))} className="w-full px-3 py-2 border rounded-h1-sm text-sm">
                {['non_conformance','complaint','incident','capa','preventive_action'].map(t => <option key={t} value={t}>{t.replace('_',' ')}</option>)}</select></div>
            <div><label className="text-xs text-h1-text-secondary">Severity</label>
              <select value={ncrForm.severity} onChange={e => setNcrForm(f => ({...f, severity: e.target.value}))} className="w-full px-3 py-2 border rounded-h1-sm text-sm">
                {['minor','major','critical'].map(s => <option key={s}>{s}</option>)}</select></div>
          </div>
          <div><label className="text-xs text-h1-text-secondary">Title *</label>
            <input type="text" value={ncrForm.title} onChange={e => setNcrForm(f => ({...f, title: e.target.value}))} className="w-full px-3 py-2 border rounded-h1-sm text-sm" placeholder="e.g., Sample mix-up in hematology section" /></div>
          <div><label className="text-xs text-h1-text-secondary">Description *</label>
            <textarea value={ncrForm.description} onChange={e => setNcrForm(f => ({...f, description: e.target.value}))} rows={3} className="w-full px-3 py-2 border rounded-h1-sm text-sm" /></div>
          <button onClick={async () => { await ncr.create(ncrForm, staffId); setShowNewNCR(false); onFlash('NCR created'); setNcrForm({ ncrType: 'non_conformance', title: '', description: '', severity: 'minor' }); }} className="px-4 py-2 bg-green-600 text-white text-sm rounded-h1-sm">Submit NCR</button>
        </div>}

        {ncr.ncrs.length === 0 ? <div className="text-center py-8 bg-h1-card rounded-h1 border text-h1-text-muted text-sm">No NCR/CAPA records</div> :
        <div className="space-y-2">{ncr.ncrs.map((n: any) => (
          <div key={n.id} className={`bg-h1-card rounded-h1-sm border p-3 ${n.status === 'open' ? 'border-h1-red/20' : n.status === 'closed' ? 'border-green-200' : ''}`}>
            <div className="flex items-center justify-between mb-1">
              <div className="flex items-center gap-2">
                <span className="font-mono text-xs text-purple-600">{n.ncr_number}</span>
                <span className={`px-1.5 py-0.5 rounded text-[10px] ${severityColor(n.severity)}`}>{n.severity}</span>
                <span className={`px-1.5 py-0.5 rounded text-[10px] ${n.status === 'closed' ? 'bg-h1-success/10 text-h1-success' : n.status === 'open' ? 'bg-h1-red/10 text-h1-red' : 'bg-h1-yellow/10 text-h1-yellow'}`}>{n.status}</span>
                <span className="text-[10px] bg-h1-navy/5 px-1.5 py-0.5 rounded">{n.ncr_type.replace('_', ' ')}</span>
              </div>
              {n.status !== 'closed' && <select onChange={e => { if (e.target.value) { ncr.update(n.id, { status: e.target.value, ...(e.target.value === 'closed' ? { closed_date: new Date().toISOString().split('T')[0], closed_by: staffId } : {}) }); e.target.value = ''; } }} className="text-[10px] border rounded px-1 py-0.5" defaultValue="">
                <option value="" disabled>Update...</option>
                <option value="investigating">Investigating</option><option value="action_taken">Action Taken</option><option value="closed">Close</option>
              </select>}
            </div>
            <div className="font-medium text-sm">{n.title}</div>
            <div className="text-xs text-h1-text-secondary mt-0.5">{n.description?.substring(0, 150)}</div>
            <div className="text-[10px] text-h1-text-muted mt-1">Reported by: {n.reporter?.full_name} | {new Date(n.created_at).toLocaleDateString('en-IN')}</div>
          </div>
        ))}</div>}
      </>}

      {/* ===== REFLEX RULES ===== */}
      {subTab === 'reflex' && <>
        <h3 className="text-sm font-medium mb-2">Active Reflex Testing Rules</h3>
        {reflex.rules.length === 0 ? <div className="text-center py-8 bg-h1-card rounded-h1 border text-h1-text-muted text-sm">No reflex rules configured. Run the SQL migration to seed default rules.</div> :
        <div className="bg-h1-card rounded-h1 border overflow-hidden">
          <table className="w-full text-xs">
            <thead><tr className="bg-h1-navy/[0.03] border-b">
              <th className="text-left p-2.5 font-medium text-h1-text-secondary">Rule</th>
              <th className="text-left p-2.5 font-medium text-h1-text-secondary">Trigger</th>
              <th className="p-2.5 font-medium text-h1-text-secondary">Condition</th>
              <th className="text-left p-2.5 font-medium text-h1-text-secondary">Auto-order</th>
              <th className="p-2.5 font-medium text-h1-text-secondary">Approval</th>
            </tr></thead>
            <tbody>{reflex.rules.map((r: any) => (
              <tr key={r.id} className="border-b hover:bg-h1-navy/[0.03]">
                <td className="p-2.5 font-medium">{r.rule_name}</td>
                <td className="p-2.5">{r.trigger_test?.test_name} ({r.trigger_test?.test_code})</td>
                <td className="p-2.5 text-center font-mono">{r.trigger_condition} {r.trigger_value_1}{r.trigger_value_2 ? ` — ${r.trigger_value_2}` : ''}</td>
                <td className="p-2.5"><span className="bg-h1-teal/[0.05] text-h1-teal px-1.5 py-0.5 rounded text-[10px]">{r.reflex_test?.test_name}</span></td>
                <td className="p-2.5 text-center">{r.requires_approval ? <span className="text-orange-600">Required</span> : <span className="text-h1-success">Auto</span>}</td>
              </tr>
            ))}</tbody>
          </table>
        </div>}
        <div className="text-xs text-h1-text-muted mt-2">Reflex rules auto-trigger when result values meet conditions. Seeded rules: TSH→FT3/FT4, FBS→HbA1c, Low Hb→Reticulocyte, INR→D-Dimer</div>
      </>}
    </div>
  );
}
