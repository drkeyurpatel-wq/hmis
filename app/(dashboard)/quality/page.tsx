'use client';
import React, { useState } from 'react';
import { RoleGuard } from '@/components/ui/shared';
import { useAuthStore } from '@/lib/store/auth';
import { useIncidentReporting, useQualityIndicators, useAuditTrail, NABH_INDICATORS } from '@/lib/quality/quality-hooks';

type Tab = 'dashboard' | 'incidents' | 'indicators' | 'audit_trail';

const SEVERITY_COLORS: Record<string, string> = {
  near_miss: 'bg-gray-100 text-gray-700', minor: 'bg-blue-100 text-blue-700',
  moderate: 'bg-amber-100 text-amber-700', serious: 'bg-orange-100 text-orange-700',
  sentinel: 'bg-red-600 text-white',
};
const STATUS_COLORS: Record<string, string> = {
  reported: 'bg-blue-100 text-blue-700', investigating: 'bg-amber-100 text-amber-700',
  action_taken: 'bg-green-100 text-green-700', closed: 'bg-gray-100 text-gray-500',
};
const CAT_LABELS: Record<string, string> = {
  medication_error: 'Medication Error', fall: 'Patient Fall', infection: 'Infection',
  surgical: 'Surgical', transfusion: 'Transfusion', equipment: 'Equipment',
  documentation: 'Documentation', communication: 'Communication', delay: 'Delay in Care',
  needle_stick: 'Needle Stick', fire_safety: 'Fire Safety', other: 'Other',
};
const ACTION_LABELS: Record<string, string> = {
  create: 'Created', update: 'Updated', delete: 'Deleted', view: 'Viewed',
  print: 'Printed', sign: 'Signed', cancel: 'Cancelled', approve: 'Approved', reject: 'Rejected',
};

function QualityInner() {
  const { staff, activeCentreId } = useAuthStore();
  const centreId = activeCentreId || '';
  const staffId = staff?.id || '';
  const incidents = useIncidentReporting(centreId);
  const qi = useQualityIndicators(centreId);
  const audit = useAuditTrail(centreId);

  const [tab, setTab] = useState<Tab>('dashboard');
  const [toast, setToast] = useState('');
  const flash = (m: string) => { setToast(m); setTimeout(() => setToast(''), 2500); };

  // Incident form
  const [showNewInc, setShowNewInc] = useState(false);
  const [incForm, setIncForm] = useState({ category: 'medication_error', severity: 'minor', description: '', location: '', immediateAction: '' });

  // QI form
  const [showNewQI, setShowNewQI] = useState(false);
  const [qiForm, setQiForm] = useState({ code: 'QI-01', period: new Date().toISOString().slice(0, 7), value: '', numerator: '', denominator: '' });

  // Audit filters
  const [auditFilter, setAuditFilter] = useState({ entityType: '', dateFrom: '', dateTo: '' });

  const submitIncident = async () => {
    if (!incForm.description) return;
    const result = await incidents.reportIncident({
      category: incForm.category, severity: incForm.severity,
      description: incForm.description, location: incForm.location,
      immediateAction: incForm.immediateAction, reportedBy: staffId,
    });
    if (result.success) {
      flash(`Incident reported: ${result.incidentNumber}`);
      setIncForm({ category: 'medication_error', severity: 'minor', description: '', location: '', immediateAction: '' });
      setShowNewInc(false);
    }
  };

  const submitQI = async () => {
    if (!qiForm.value) return;
    await qi.submitEntry(qiForm.code, qiForm.period, parseFloat(qiForm.value),
      qiForm.numerator ? parseInt(qiForm.numerator) : undefined,
      qiForm.denominator ? parseInt(qiForm.denominator) : undefined, staffId);
    flash('Indicator submitted');
    setQiForm({ code: 'QI-01', period: new Date().toISOString().slice(0, 7), value: '', numerator: '', denominator: '' });
    setShowNewQI(false);
  };

  // Group QI entries by indicator
  const qiByCode = NABH_INDICATORS.map(ind => {
    const latest = qi.entries.find((e: any) => e.indicator_code === ind.code);
    return { ...ind, latest: latest ? parseFloat(latest.value) : null, metTarget: latest?.met_target };
  });

  return (
    <div className="max-w-7xl mx-auto space-y-4">
      {toast && <div className="fixed top-4 left-1/2 -translate-x-1/2 z-50 bg-green-600 text-white px-4 py-2 rounded-lg shadow-lg text-sm">{toast}</div>}

      <div className="flex items-center justify-between">
        <div><h1 className="text-xl font-bold">Quality & NABH Compliance</h1><p className="text-xs text-gray-500">Incident reporting, quality indicators, audit trail</p></div>
      </div>

      <div className="flex gap-1 border-b">{(['dashboard', 'incidents', 'indicators', 'audit_trail'] as Tab[]).map(t =>
        <button key={t} onClick={() => { setTab(t); if (t === 'audit_trail') audit.load(auditFilter.entityType ? auditFilter : undefined); }}
          className={`px-4 py-2 text-xs font-medium border-b-2 -mb-px capitalize ${tab === t ? 'border-blue-600 text-blue-700' : 'border-transparent text-gray-500'}`}>
          {t === 'dashboard' ? 'Dashboard' : t === 'incidents' ? `Incidents (${incidents.stats.open})` : t === 'indicators' ? 'NABH Indicators' : 'Audit Trail'}
        </button>
      )}</div>

      {/* ===== DASHBOARD ===== */}
      {tab === 'dashboard' && <div className="space-y-4">
        <div className="grid grid-cols-5 gap-2">
          <div className="bg-white rounded-xl border p-3 text-center"><div className="text-[9px] text-gray-500">Open Incidents</div><div className={`text-xl font-bold ${incidents.stats.open > 0 ? 'text-amber-700' : 'text-green-700'}`}>{incidents.stats.open}</div></div>
          <div className={`rounded-xl border p-3 text-center ${incidents.stats.critical > 0 ? 'bg-red-50' : 'bg-green-50'}`}><div className="text-[9px] text-gray-500">Critical/Sentinel</div><div className={`text-xl font-bold ${incidents.stats.critical > 0 ? 'text-red-700 animate-pulse' : 'text-green-700'}`}>{incidents.stats.critical}</div></div>
          <div className="bg-white rounded-xl border p-3 text-center"><div className="text-[9px] text-gray-500">Total Incidents</div><div className="text-xl font-bold">{incidents.stats.total}</div></div>
          <div className="bg-white rounded-xl border p-3 text-center"><div className="text-[9px] text-gray-500">KPIs Meeting Target</div><div className="text-xl font-bold text-green-700">{qiByCode.filter(q => q.metTarget === true).length}/{qiByCode.filter(q => q.latest !== null).length}</div></div>
          <div className="bg-white rounded-xl border p-3 text-center"><div className="text-[9px] text-gray-500">Audit Entries</div><div className="text-xl font-bold">{audit.logs.length}</div></div>
        </div>

        {/* Quick NABH scorecard */}
        <div className="bg-white rounded-xl border p-4">
          <h3 className="text-xs font-bold text-gray-500 mb-3">NABH Quality Scorecard</h3>
          <div className="grid grid-cols-5 gap-2">
            {qiByCode.slice(0, 10).map(q => (
              <div key={q.code} className={`rounded-lg border p-2 ${q.latest === null ? 'bg-gray-50' : q.metTarget ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200'}`}>
                <div className="text-[8px] text-gray-400">{q.code}</div>
                <div className="text-[10px] font-medium truncate">{q.name}</div>
                <div className="flex items-baseline justify-between mt-1">
                  <span className={`text-sm font-bold ${q.latest === null ? 'text-gray-300' : q.metTarget ? 'text-green-700' : 'text-red-700'}`}>{q.latest !== null ? q.latest : '—'}</span>
                  <span className="text-[8px] text-gray-400">target: {q.target}{q.unit === '%' ? '%' : ''}</span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Incident by category */}
        {incidents.stats.total > 0 && <div className="bg-white rounded-xl border p-4">
          <h3 className="text-xs font-bold text-gray-500 mb-2">Incidents by Category</h3>
          <div className="flex flex-wrap gap-2">{Object.entries(incidents.stats.byCategory).sort((a: any, b: any) => b[1] - a[1]).map(([cat, count]) => (
            <span key={cat} className="px-2.5 py-1.5 bg-gray-100 rounded-lg text-xs">{CAT_LABELS[cat] || cat} <span className="font-bold">{count as number}</span></span>
          ))}</div>
        </div>}
      </div>}

      {/* ===== INCIDENTS ===== */}
      {tab === 'incidents' && <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex gap-1">{['all', 'reported', 'investigating', 'action_taken', 'closed'].map(s =>
            <button key={s} onClick={() => incidents.load({ status: s })} className="px-2 py-1 text-[10px] rounded border bg-white hover:bg-blue-50">{s === 'all' ? 'All' : s.replace('_', ' ')}</button>
          )}</div>
          <button onClick={() => setShowNewInc(!showNewInc)} className="px-4 py-2 bg-red-600 text-white text-xs rounded-lg">{showNewInc ? 'Cancel' : '+ Report Incident'}</button>
        </div>

        {showNewInc && <div className="bg-white rounded-xl border p-5 space-y-3">
          <h3 className="font-bold text-sm text-red-700">Report Incident</h3>
          <div className="grid grid-cols-3 gap-3">
            <div><label className="text-xs text-gray-500">Category *</label>
              <select value={incForm.category} onChange={e => setIncForm(f => ({ ...f, category: e.target.value }))} className="w-full px-3 py-2 border rounded-lg text-xs">
                {Object.entries(CAT_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </select></div>
            <div><label className="text-xs text-gray-500">Severity *</label>
              <select value={incForm.severity} onChange={e => setIncForm(f => ({ ...f, severity: e.target.value }))} className="w-full px-3 py-2 border rounded-lg text-xs">
                {['near_miss', 'minor', 'moderate', 'serious', 'sentinel'].map(s => <option key={s} value={s}>{s.replace('_', ' ')}</option>)}
              </select></div>
            <div><label className="text-xs text-gray-500">Location</label>
              <input type="text" value={incForm.location} onChange={e => setIncForm(f => ({ ...f, location: e.target.value }))} className="w-full px-3 py-2 border rounded-lg text-xs" placeholder="Ward / OT / OPD / Pharmacy..." /></div>
          </div>
          <div><label className="text-xs text-gray-500">Description *</label>
            <textarea value={incForm.description} onChange={e => setIncForm(f => ({ ...f, description: e.target.value }))} rows={3} className="w-full px-3 py-2 border rounded-lg text-sm" placeholder="What happened? When? Who was involved?" /></div>
          <div><label className="text-xs text-gray-500">Immediate Action Taken</label>
            <input type="text" value={incForm.immediateAction} onChange={e => setIncForm(f => ({ ...f, immediateAction: e.target.value }))} className="w-full px-3 py-2 border rounded-lg text-xs" placeholder="What was done immediately?" /></div>
          <button onClick={submitIncident} disabled={!incForm.description} className="px-6 py-2 bg-red-600 text-white text-sm rounded-lg disabled:opacity-40">Submit Incident Report</button>
        </div>}

        {incidents.loading ? <div className="animate-pulse h-48 bg-gray-200 rounded-xl" /> :
        incidents.incidents.length === 0 ? <div className="text-center py-12 bg-white rounded-xl border text-gray-400 text-sm">No incidents reported</div> :
        <div className="space-y-2">{incidents.incidents.map((inc: any) => (
          <div key={inc.id} className={`bg-white rounded-xl border p-4 ${inc.severity === 'sentinel' ? 'border-red-300 bg-red-50/30' : ''}`}>
            <div className="flex items-center justify-between mb-1">
              <div className="flex items-center gap-2">
                <span className="font-mono text-[10px] text-gray-400">{inc.incident_number}</span>
                <span className={`px-1.5 py-0.5 rounded text-[9px] ${SEVERITY_COLORS[inc.severity]}`}>{inc.severity?.replace('_', ' ')}</span>
                <span className="text-[10px] text-gray-500">{CAT_LABELS[inc.category] || inc.category}</span>
              </div>
              <div className="flex items-center gap-2">
                <span className={`px-1.5 py-0.5 rounded text-[9px] ${STATUS_COLORS[inc.status]}`}>{inc.status?.replace('_', ' ')}</span>
                <span className="text-[10px] text-gray-400">{new Date(inc.created_at).toLocaleDateString('en-IN')}</span>
              </div>
            </div>
            <div className="text-xs">{inc.description}</div>
            <div className="flex items-center gap-3 mt-2 text-[10px] text-gray-400">
              {inc.location && <span>📍 {inc.location}</span>}
              <span>Reported by: {inc.reporter?.full_name}</span>
              {inc.patient && <span>Patient: {inc.patient.first_name} {inc.patient.last_name}</span>}
            </div>
            {inc.immediate_action && <div className="text-[10px] text-green-700 mt-1">Immediate action: {inc.immediate_action}</div>}
            {['reported', 'investigating'].includes(inc.status) && (
              <div className="flex gap-1 mt-2">
                {inc.status === 'reported' && <button onClick={() => incidents.updateIncident(inc.id, { status: 'investigating', assigned_to: staffId })} className="px-2 py-1 bg-amber-100 text-amber-700 rounded text-[9px]">Start Investigation</button>}
                {inc.status === 'investigating' && <button onClick={() => incidents.updateIncident(inc.id, { status: 'action_taken' })} className="px-2 py-1 bg-green-100 text-green-700 rounded text-[9px]">Mark Action Taken</button>}
                <button onClick={() => incidents.updateIncident(inc.id, { status: 'closed', closed_at: new Date().toISOString() })} className="px-2 py-1 bg-gray-100 text-gray-600 rounded text-[9px]">Close</button>
              </div>
            )}
          </div>
        ))}</div>}
      </div>}

      {/* ===== NABH INDICATORS ===== */}
      {tab === 'indicators' && <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="font-bold text-sm">NABH Quality Indicators (20 KPIs)</h2>
          <button onClick={() => setShowNewQI(!showNewQI)} className="px-4 py-2 bg-blue-600 text-white text-xs rounded-lg">{showNewQI ? 'Cancel' : '+ Submit Data'}</button>
        </div>

        {showNewQI && <div className="bg-white rounded-xl border p-4 space-y-3">
          <div className="grid grid-cols-5 gap-3">
            <div><label className="text-[9px] text-gray-500">Indicator</label>
              <select value={qiForm.code} onChange={e => setQiForm(f => ({ ...f, code: e.target.value }))} className="w-full px-2 py-1.5 border rounded text-xs">
                {NABH_INDICATORS.map(i => <option key={i.code} value={i.code}>{i.code}: {i.name}</option>)}
              </select></div>
            <div><label className="text-[9px] text-gray-500">Period</label>
              <input type="month" value={qiForm.period} onChange={e => setQiForm(f => ({ ...f, period: e.target.value }))} className="w-full px-2 py-1.5 border rounded text-xs" /></div>
            <div><label className="text-[9px] text-gray-500">Value *</label>
              <input type="number" value={qiForm.value} onChange={e => setQiForm(f => ({ ...f, value: e.target.value }))} className="w-full px-2 py-1.5 border rounded text-xs" step="0.01" /></div>
            <div><label className="text-[9px] text-gray-500">Numerator</label>
              <input type="number" value={qiForm.numerator} onChange={e => setQiForm(f => ({ ...f, numerator: e.target.value }))} className="w-full px-2 py-1.5 border rounded text-xs" /></div>
            <div className="flex items-end"><button onClick={submitQI} disabled={!qiForm.value} className="w-full py-1.5 bg-blue-600 text-white text-xs rounded disabled:opacity-40">Submit</button></div>
          </div>
        </div>}

        {/* Indicator cards grouped by category */}
        {['infection_control', 'patient_safety', 'clinical', 'operational', 'diagnostics', 'patient_experience'].map(cat => {
          const catIndicators = qiByCode.filter(q => q.category === cat);
          if (!catIndicators.length) return null;
          return (
            <div key={cat}>
              <h3 className="text-xs font-bold text-gray-500 mb-2 capitalize">{cat.replace('_', ' ')}</h3>
              <div className="grid grid-cols-4 gap-2">
                {catIndicators.map(q => (
                  <div key={q.code} className={`bg-white rounded-lg border p-3 ${q.latest === null ? '' : q.metTarget ? 'border-green-200' : 'border-red-200'}`}>
                    <div className="flex justify-between"><span className="text-[9px] text-gray-400">{q.code}</span>
                      {q.latest !== null && <span className={`text-[8px] px-1 py-0.5 rounded font-bold ${q.metTarget ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>{q.metTarget ? 'MET' : 'NOT MET'}</span>}
                    </div>
                    <div className="text-[10px] font-medium mt-1">{q.name}</div>
                    <div className="flex items-baseline justify-between mt-2">
                      <span className={`text-lg font-bold ${q.latest === null ? 'text-gray-300' : q.metTarget ? 'text-green-700' : 'text-red-700'}`}>{q.latest !== null ? q.latest : '—'}</span>
                      <span className="text-[9px] text-gray-400">/ {q.target} {q.unit}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>}

      {/* ===== AUDIT TRAIL ===== */}
      {tab === 'audit_trail' && <div className="space-y-4">
        <div className="flex gap-2 flex-wrap bg-white rounded-xl border p-3">
          <select value={auditFilter.entityType} onChange={e => { setAuditFilter(f => ({ ...f, entityType: e.target.value })); audit.load({ entityType: e.target.value || undefined }); }} className="px-2 py-1 border rounded text-xs">
            <option value="">All Entity Types</option>
            {['patient','encounter','admission','bill','prescription','lab_order','radiology_order','appointment','refund','credit_note','discharge','vitals','medication'].map(t => <option key={t} value={t}>{t.replace('_', ' ')}</option>)}
          </select>
          <input type="date" value={auditFilter.dateFrom} onChange={e => setAuditFilter(f => ({ ...f, dateFrom: e.target.value }))} className="px-2 py-1 border rounded text-xs" />
          <span className="text-xs text-gray-400 self-center">to</span>
          <input type="date" value={auditFilter.dateTo} onChange={e => setAuditFilter(f => ({ ...f, dateTo: e.target.value }))} className="px-2 py-1 border rounded text-xs" />
          <button onClick={() => audit.load(auditFilter.entityType || auditFilter.dateFrom ? auditFilter : undefined)} className="px-3 py-1 bg-blue-600 text-white text-xs rounded">Filter</button>
        </div>

        {audit.loading ? <div className="animate-pulse h-48 bg-gray-200 rounded-xl" /> :
        audit.logs.length === 0 ? <div className="text-center py-12 bg-white rounded-xl border text-gray-400 text-sm">No audit entries. Audit trail records will appear as clinical actions are performed.</div> :
        <div className="bg-white rounded-xl border overflow-hidden">
          <table className="w-full text-xs"><thead><tr className="bg-gray-50 border-b">
            <th className="p-2 text-left">Time</th><th className="p-2">User</th><th className="p-2">Action</th><th className="p-2 text-left">Entity</th><th className="p-2 text-left">Details</th>
          </tr></thead><tbody>{audit.logs.slice(0, 100).map((log: any) => (
            <tr key={log.id} className="border-b hover:bg-gray-50">
              <td className="p-2 text-gray-400 text-[10px] whitespace-nowrap">{new Date(log.created_at).toLocaleString('en-IN', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}</td>
              <td className="p-2 font-medium">{log.user?.full_name}</td>
              <td className="p-2 text-center"><span className={`px-1.5 py-0.5 rounded text-[9px] ${log.action === 'delete' || log.action === 'cancel' ? 'bg-red-100 text-red-700' : log.action === 'create' ? 'bg-green-100 text-green-700' : log.action === 'sign' || log.action === 'approve' ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-600'}`}>{ACTION_LABELS[log.action] || log.action}</span></td>
              <td className="p-2"><span className="text-gray-500">{log.entity_type?.replace('_', ' ')}</span>{log.entity_label && <span className="ml-1 text-[10px] text-gray-400">{log.entity_label}</span>}</td>
              <td className="p-2 text-[10px] text-gray-400 max-w-xs truncate">{log.changes ? JSON.stringify(log.changes).substring(0, 80) : '—'}</td>
            </tr>
          ))}</tbody></table>
        </div>}
      </div>}
    </div>
  );
}

export default function QualityPage() { return <RoleGuard module="mis"><QualityInner /></RoleGuard>; }
