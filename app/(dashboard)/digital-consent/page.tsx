'use client';
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { RoleGuard } from '@/components/ui/shared';
import { useAuthStore } from '@/lib/store/auth';
import { useDigitalConsent, type DigitalConsent, type ConsentAudit } from '@/lib/digital-consent/digital-consent-hooks';
import { sb } from '@/lib/supabase/browser';

const TYPE_COLORS: Record<string, string> = { surgical: 'bg-red-100 text-red-700', anaesthesia: 'bg-purple-100 text-purple-700', blood_transfusion: 'bg-amber-100 text-amber-700', procedure: 'bg-blue-100 text-blue-700', admission: 'bg-green-100 text-green-700', general: 'bg-gray-100 text-gray-600' };
const LANGS: Record<string, string> = { en: 'English', hi: 'हिंदी', gu: 'ગુજરાતી' };

type Tab = 'consents' | 'new' | 'templates' | 'detail';

// Signature pad component
function SignaturePad({ onSave, label }: { onSave: (data: string) => void; label: string }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [drawing, setDrawing] = useState(false);
  const [hasContent, setHasContent] = useState(false);

  const getCtx = () => canvasRef.current?.getContext('2d');

  const startDraw = (e: React.MouseEvent | React.TouchEvent) => {
    const ctx = getCtx(); if (!ctx) return;
    setDrawing(true);
    const rect = canvasRef.current!.getBoundingClientRect();
    const pt = 'touches' in e ? e.touches[0] : e;
    ctx.beginPath();
    ctx.moveTo(pt.clientX - rect.left, pt.clientY - rect.top);
  };

  const draw = (e: React.MouseEvent | React.TouchEvent) => {
    if (!drawing) return;
    const ctx = getCtx(); if (!ctx) return;
    const rect = canvasRef.current!.getBoundingClientRect();
    const pt = 'touches' in e ? e.touches[0] : e;
    ctx.lineWidth = 2; ctx.lineCap = 'round'; ctx.strokeStyle = '#1e293b';
    ctx.lineTo(pt.clientX - rect.left, pt.clientY - rect.top);
    ctx.stroke();
    setHasContent(true);
  };

  const stopDraw = () => setDrawing(false);
  const clear = () => { const ctx = getCtx(); if (ctx && canvasRef.current) { ctx.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height); setHasContent(false); } };
  const save = () => { if (canvasRef.current && hasContent) onSave(canvasRef.current.toDataURL('image/png')); };

  return (
    <div className="border rounded p-3">
      <div className="text-xs text-gray-500 mb-1">{label}</div>
      <canvas ref={canvasRef} width={400} height={150} className="border rounded bg-white cursor-crosshair w-full touch-none"
        onMouseDown={startDraw} onMouseMove={draw} onMouseUp={stopDraw} onMouseLeave={stopDraw}
        onTouchStart={startDraw} onTouchMove={draw} onTouchEnd={stopDraw} />
      <div className="flex gap-2 mt-2">
        <button onClick={save} disabled={!hasContent} className="bg-blue-600 text-white px-3 py-1 rounded text-xs disabled:opacity-50 cursor-pointer">Capture</button>
        <button onClick={clear} className="text-xs text-gray-500 cursor-pointer">Clear</button>
      </div>
    </div>
  );
}

function Inner() {
  const { staff, activeCentreId } = useAuthStore();
  const centreId = activeCentreId || '';
  const staffId = staff?.id || '';
  const dc = useDigitalConsent(centreId);

  const [tab, setTab] = useState<Tab>('consents');
  const [toast, setToast] = useState('');
  const flash = (m: string) => { setToast(m); setTimeout(() => setToast(''), 3000); };

  // Detail view
  const [selected, setSelected] = useState<DigitalConsent | null>(null);
  const [audit, setAudit] = useState<ConsentAudit[]>([]);

  // New consent form
  const [nf, setNf] = useState({ patient_search: '', patient_id: '', admission_id: '', template_id: '', procedure_name: '', language: 'en' });
  const [patientResults, setPatientResults] = useState<any[]>([]);

  // Template form
  const [showTplForm, setShowTplForm] = useState(false);
  const [tf, setTf] = useState({ template_name: '', consent_type: 'surgical', procedure_type: '', content_en: '', content_hi: '', content_gu: '', risks_en: '', benefits_en: '', alternatives_en: '', requires_witness: true });

  // Staff
  const [staffList, setStaffList] = useState<{ id: string; full_name: string }[]>([]);
  useEffect(() => {
    if (!centreId || !sb()) return;
    sb().from('hmis_staff').select('id, full_name').eq('is_active', true).order('full_name').then(({ data }) => setStaffList(data || []));
  }, [centreId]);

  // Patient search
  useEffect(() => {
    if (nf.patient_search.length < 2 || !sb()) { setPatientResults([]); return; }
    const t = setTimeout(async () => {
      const { data } = await sb().from('hmis_patients')
        .select('id, uhid, first_name, last_name')
        .or(`uhid.ilike.%${nf.patient_search}%,first_name.ilike.%${nf.patient_search}%,last_name.ilike.%${nf.patient_search}%`)
        .limit(5);
      setPatientResults(data || []);
    }, 300);
    return () => clearTimeout(t);
  }, [nf.patient_search]);

  const handleCreate = async () => {
    if (!nf.patient_id || !nf.template_id || !nf.procedure_name) { flash('Fill patient, template, procedure'); return; }
    const consent = await dc.createConsent({ patient_id: nf.patient_id, admission_id: nf.admission_id || undefined, template_id: nf.template_id, procedure_name: nf.procedure_name, language: nf.language, obtained_by: staffId });
    if (consent) {
      flash('Consent created — proceed to collect signatures');
      dc.loadConsents();
      // Open detail
      const full = dc.consents.find(c => c.id === consent.id);
      if (full) { setSelected(full); setTab('detail'); }
      else { setTab('consents'); }
    }
  };

  const openDetail = async (c: DigitalConsent) => {
    setSelected(c);
    const auditData = await dc.loadAudit(c.id);
    setAudit(auditData);
    setTab('detail');
  };

  const handleSaveTemplate = async () => {
    if (!tf.template_name || !tf.content_en) { flash('Fill template name and content'); return; }
    await dc.saveTemplate({ ...tf, requires_witness: tf.requires_witness }, staffId);
    flash('Template saved');
    setShowTplForm(false);
    setTf({ template_name: '', consent_type: 'surgical', procedure_type: '', content_en: '', content_hi: '', content_gu: '', risks_en: '', benefits_en: '', alternatives_en: '', requires_witness: true });
    dc.loadTemplates();
  };

  return (
    <div className="p-4 md:p-6 max-w-[1400px] mx-auto">
      {toast && <div className="fixed top-4 right-4 z-50 bg-gray-900 text-white px-4 py-2 rounded shadow-lg text-sm">{toast}</div>}

      <div className="flex items-center justify-between mb-6 flex-wrap gap-2">
        <h1 className="text-2xl font-bold">Digital Consent</h1>
        <div className="flex gap-1">
          {(['consents','new','templates'] as Tab[]).map(t => (
            <button key={t} onClick={() => { setTab(t); setSelected(null); }} className={`px-3 py-1.5 rounded text-sm font-medium ${tab === t ? 'bg-blue-600 text-white' : 'bg-gray-100'} cursor-pointer`}>
              {t === 'consents' ? 'Consents' : t === 'new' ? '+ New' : 'Templates'}
            </button>
          ))}
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
        {[
          { label: 'Total', value: dc.stats.total, color: 'text-gray-900' },
          { label: 'Signed', value: dc.stats.signed, color: 'text-green-600' },
          { label: 'Pending', value: dc.stats.pending, color: 'text-amber-600' },
          { label: 'Withdrawn', value: dc.stats.revoked, color: 'text-red-600' },
        ].map(s => (
          <div key={s.label} className="bg-white border rounded-lg p-4">
            <div className={`text-2xl font-bold ${s.color}`}>{s.value}</div>
            <div className="text-xs text-gray-500 mt-1">{s.label}</div>
          </div>
        ))}
      </div>

      {/* Consents List */}
      {tab === 'consents' && (
        <div className="overflow-x-auto bg-white border rounded-lg">
          {dc.consents.length === 0 ? <p className="p-4 text-gray-500 text-sm">No consents. Create one from a template.</p> : (
            <table className="w-full text-sm">
              <thead className="bg-gray-50"><tr>
                <th className="text-left p-3">Patient</th><th className="text-left p-3">Procedure</th><th className="text-center p-3">Type</th>
                <th className="text-center p-3">Language</th><th className="text-center p-3">Status</th><th className="text-left p-3">Date</th>
              </tr></thead>
              <tbody>
                {dc.consents.map(c => (
                  <tr key={c.id} className="border-t hover:bg-gray-50 cursor-pointer" onClick={() => openDetail(c)}>
                    <td className="p-3 font-medium">{(c.patient as Record<string, any> | undefined)?.first_name} {(c.patient as Record<string, any> | undefined)?.last_name}<br /><span className="text-xs text-gray-400">{(c.patient as Record<string, any> | undefined)?.uhid}</span></td>
                    <td className="p-3">{c.procedure_name}</td>
                    <td className="p-3 text-center"><span className={`px-2 py-0.5 rounded text-xs font-medium ${TYPE_COLORS[c.consent_type] || 'bg-gray-100'}`}>{c.consent_type}</span></td>
                    <td className="p-3 text-center">{LANGS[c.language] || c.language}</td>
                    <td className="p-3 text-center">
                      {c.revoked ? <span className="text-red-600 font-medium">Withdrawn</span> :
                       c.consent_given ? <span className="text-green-600 font-medium">✓ Signed</span> :
                       <span className="text-amber-600">Pending</span>}
                    </td>
                    <td className="p-3 text-xs text-gray-500">{c.consent_date ? new Date(c.consent_date).toLocaleDateString() : '-'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      {/* New Consent */}
      {tab === 'new' && (
        <div className="bg-white border rounded-lg p-6">
          <h2 className="text-lg font-semibold mb-4">Create New Consent</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
            <div className="relative">
              <label className="text-xs text-gray-500">Patient *</label>
              <input className="w-full border rounded px-3 py-2 text-sm" placeholder="Search patient..." value={nf.patient_search}
                onChange={e => setNf(p => ({ ...p, patient_search: e.target.value, patient_id: '' }))} />
              {patientResults.length > 0 && !nf.patient_id && (
                <div className="absolute z-10 w-full bg-white border rounded shadow mt-1 max-h-40 overflow-y-auto">
                  {patientResults.map(p => (
                    <div key={p.id} className="px-3 py-2 text-sm hover:bg-blue-50 cursor-pointer"
                      onClick={() => setNf(prev => ({ ...prev, patient_id: p.id, patient_search: `${p.first_name} ${p.last_name} (${p.uhid})` }))}>
                      {p.first_name} {p.last_name} ({p.uhid})
                    </div>
                  ))}
                </div>
              )}
            </div>
            <div>
              <label className="text-xs text-gray-500">Template *</label>
              <select className="w-full border rounded px-3 py-2 text-sm" value={nf.template_id} onChange={e => {
                const tpl = dc.templates.find(t => t.id === e.target.value);
                setNf(p => ({ ...p, template_id: e.target.value, procedure_name: tpl?.procedure_type || p.procedure_name }));
              }}>
                <option value="">Select template...</option>
                {dc.templates.map(t => <option key={t.id} value={t.id}>{t.template_name} ({t.consent_type}) v{t.version}</option>)}
              </select>
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
            <div><label className="text-xs text-gray-500">Procedure *</label><input className="w-full border rounded px-3 py-2 text-sm" value={nf.procedure_name} onChange={e => setNf(p => ({ ...p, procedure_name: e.target.value }))} /></div>
            <div><label className="text-xs text-gray-500">Language</label>
              <select className="w-full border rounded px-3 py-2 text-sm" value={nf.language} onChange={e => setNf(p => ({ ...p, language: e.target.value }))}>
                <option value="en">English</option><option value="hi">हिंदी</option><option value="gu">ગુજરાતી</option>
              </select>
            </div>
          </div>
          <button onClick={handleCreate} disabled={!nf.patient_id || !nf.template_id} className="bg-blue-600 text-white px-4 py-2 rounded text-sm font-medium disabled:opacity-50 cursor-pointer">Create Consent</button>
        </div>
      )}

      {/* Detail View */}
      {tab === 'detail' && selected && (
        <div>
          <button onClick={() => { setTab('consents'); setSelected(null); }} className="text-sm text-blue-600 mb-4 cursor-pointer">← Back</button>
          <div className="bg-white border rounded-lg p-6">
            <div className="flex items-start justify-between mb-4">
              <div>
                <h2 className="text-xl font-bold">{selected.procedure_name}</h2>
                <p className="text-gray-600">{(selected.patient as Record<string, any> | undefined)?.first_name} {(selected.patient as Record<string, any> | undefined)?.last_name} ({(selected.patient as Record<string, any> | undefined)?.uhid})</p>
                <p className="text-sm text-gray-400">{selected.consent_type} · {LANGS[selected.language]} · v{selected.template_version}</p>
              </div>
              <div>
                {selected.revoked ? <span className="px-3 py-1 rounded bg-red-100 text-red-700 font-medium">Withdrawn</span> :
                 selected.consent_given ? <span className="px-3 py-1 rounded bg-green-100 text-green-700 font-medium">✓ Consent Obtained</span> :
                 <span className="px-3 py-1 rounded bg-amber-100 text-amber-700 font-medium">Pending Signatures</span>}
              </div>
            </div>

            {/* Content shown */}
            {selected.content_shown && (
              <div className="bg-gray-50 border rounded p-4 mb-4 max-h-40 overflow-y-auto">
                <div className="text-xs text-gray-400 mb-1">Consent Content</div>
                <div className="text-sm whitespace-pre-wrap">{selected.content_shown}</div>
              </div>
            )}

            {/* Risks / Alternatives */}
            {(selected.risks_explained || selected.alternatives_explained) && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-4">
                {selected.risks_explained && <div className="bg-red-50 border rounded p-3"><div className="text-xs text-red-600 font-semibold mb-1">Risks</div><div className="text-sm">{selected.risks_explained}</div></div>}
                {selected.alternatives_explained && <div className="bg-blue-50 border rounded p-3"><div className="text-xs text-blue-600 font-semibold mb-1">Alternatives</div><div className="text-sm">{selected.alternatives_explained}</div></div>}
              </div>
            )}

            {/* Pre-op checklist */}
            {!selected.consent_given && !selected.revoked && (
              <div className="border rounded p-4 mb-4">
                <h3 className="text-sm font-semibold mb-2">Pre-Consent Checklist</h3>
                <div className="space-y-2">
                  {[
                    { key: 'identity_verified', label: 'Patient identity verified' },
                    { key: 'procedure_explained', label: 'Procedure explained to patient' },
                    { key: 'questions_answered', label: 'Patient questions answered' },
                    { key: 'education_shown', label: 'Education material shown' },
                  ].map(item => (
                    <label key={item.key} className="flex items-center gap-2 cursor-pointer">
                      <input type="checkbox" checked={(selected as any)[item.key] || false} onChange={async (e) => {
                        if (item.key === 'education_shown') {
                          await dc.markEducationShown(selected.id, staffId);
                        } else {
                          await dc.updateChecklist(selected.id, { [item.key]: e.target.checked });
                        }
                        setSelected(prev => prev ? { ...prev, [item.key]: e.target.checked } : null);
                      }} className="rounded" />
                      <span className="text-sm">{item.label}</span>
                    </label>
                  ))}
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input type="checkbox" checked={selected.interpreter_used} onChange={async (e) => {
                      await dc.updateChecklist(selected.id, { interpreter_used: e.target.checked });
                      setSelected(prev => prev ? { ...prev, interpreter_used: e.target.checked } : null);
                    }} className="rounded" />
                    <span className="text-sm">Interpreter used</span>
                    {selected.interpreter_used && (
                      <input className="border rounded px-2 py-1 text-sm ml-2" placeholder="Interpreter name" value={selected.interpreter_name || ''}
                        onChange={async (e) => {
                          await dc.updateChecklist(selected.id, { interpreter_name: e.target.value });
                          setSelected(prev => prev ? { ...prev, interpreter_name: e.target.value } : null);
                        }} />
                    )}
                  </label>
                </div>
              </div>
            )}

            {/* Signatures */}
            {!selected.consent_given && !selected.revoked && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                <div>
                  {selected.patient_signature_data ? (
                    <div className="border rounded p-3"><div className="text-xs text-green-600 font-semibold mb-1">Patient Signature ✓</div><img src={selected.patient_signature_data} alt="signature" className="max-h-24" /> </div>
                  ) : (
                    <SignaturePad label="Patient Signature" onSave={async (data) => {
                      await dc.capturePatientSignature(selected.id, data, staffId);
                      setSelected(prev => prev ? { ...prev, patient_signature_data: data } : null);
                      flash('Patient signature captured');
                    }} />
                  )}
                </div>
                <div>
                  {selected.witness_signature_data ? (
                    <div className="border rounded p-3"><div className="text-xs text-green-600 font-semibold mb-1">Witness Signature ✓</div><div className="text-xs text-gray-400">{selected.witness_name}</div><img src={selected.witness_signature_data} alt="witness" className="max-h-24" /> </div>
                  ) : (
                    <SignaturePad label="Witness / Staff Signature" onSave={async (data) => {
                      const name = staff?.full_name || 'Staff';
                      await dc.captureWitnessSignature(selected.id, data, staffId, name, 'Staff');
                      setSelected(prev => prev ? { ...prev, witness_signature_data: data, witness_name: name } : null);
                      flash('Witness signature captured');
                    }} />
                  )}
                </div>
              </div>
            )}

            {/* Existing signatures display */}
            {selected.consent_given && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                {selected.patient_signature_data && <div className="border rounded p-3"><div className="text-xs text-gray-500 mb-1">Patient Signature</div><img src={selected.patient_signature_data} alt="Patient signature" className="max-h-24" /> </div>}
                {selected.witness_signature_data && <div className="border rounded p-3"><div className="text-xs text-gray-500 mb-1">Witness: {selected.witness_name}</div><img src={selected.witness_signature_data} alt="witness" className="max-h-24" /> </div>}
              </div>
            )}

            {/* Actions */}
            <div className="flex gap-2 pt-4 border-t">
              {!selected.consent_given && !selected.revoked && selected.patient_signature_data && (
                <button onClick={async () => { await dc.finalizeConsent(selected.id, staffId); flash('Consent obtained ✓'); dc.loadConsents(); setSelected(prev => prev ? { ...prev, consent_given: true } : null); const a = await dc.loadAudit(selected.id); setAudit(a); }}
                  className="bg-green-600 text-white px-4 py-2 rounded text-sm font-medium cursor-pointer">Finalize Consent ✓</button>
              )}
              {selected.consent_given && !selected.revoked && (
                <button onClick={async () => { const reason = prompt('Withdrawal reason?'); if (reason) { await dc.withdrawConsent(selected.id, staffId, reason); flash('Consent withdrawn'); dc.loadConsents(); setSelected(prev => prev ? { ...prev, revoked: true, withdrawal_reason: reason } : null); const a = await dc.loadAudit(selected.id); setAudit(a); } }}
                  className="bg-red-600 text-white px-3 py-2 rounded text-sm cursor-pointer">Withdraw Consent</button>
              )}
            </div>

            {selected.withdrawal_reason && (
              <div className="mt-3 text-sm bg-red-50 border border-red-200 p-3 rounded">Withdrawal reason: {selected.withdrawal_reason}</div>
            )}

            {/* Audit trail */}
            {audit.length > 0 && (
              <div className="mt-6">
                <h3 className="text-sm font-semibold mb-2">Audit Trail</h3>
                <div className="space-y-1">
                  {audit.map(a => (
                    <div key={a.id} className="flex gap-3 text-xs text-gray-500 p-1.5 bg-gray-50 rounded">
                      <span className="text-gray-400 whitespace-nowrap">{new Date(a.created_at).toLocaleString()}</span>
                      <span className="font-medium text-gray-700">{a.action}</span>
                      <span>{a.details}</span>
                      <span className="text-gray-400">{(a.performer as Record<string, any> | undefined)?.full_name}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Templates Tab */}
      {tab === 'templates' && (
        <div>
          <button onClick={() => setShowTplForm(!showTplForm)} className="mb-4 bg-blue-600 text-white px-3 py-1.5 rounded text-sm font-medium cursor-pointer">
            {showTplForm ? 'Cancel' : '+ New Template'}
          </button>
          {showTplForm && (
            <div className="bg-white border rounded-lg p-6 mb-4">
              <h3 className="font-semibold mb-3">New Consent Template</h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-3">
                <input className="border rounded px-3 py-2 text-sm" placeholder="Template name *" value={tf.template_name} onChange={e => setTf(p => ({ ...p, template_name: e.target.value }))} />
                <select className="border rounded px-3 py-2 text-sm" value={tf.consent_type} onChange={e => setTf(p => ({ ...p, consent_type: e.target.value }))}>
                  <option value="surgical">Surgical</option><option value="anaesthesia">Anaesthesia</option><option value="blood_transfusion">Blood Transfusion</option>
                  <option value="procedure">Procedure</option><option value="admission">Admission</option><option value="general">General</option>
                </select>
                <input className="border rounded px-3 py-2 text-sm" placeholder="Procedure type" value={tf.procedure_type} onChange={e => setTf(p => ({ ...p, procedure_type: e.target.value }))} />
              </div>
              <div className="mb-3"><label className="text-xs text-gray-500">Content (English) *</label><textarea className="w-full border rounded px-3 py-2 text-sm" rows={4} value={tf.content_en} onChange={e => setTf(p => ({ ...p, content_en: e.target.value }))} /></div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-3">
                <div><label className="text-xs text-gray-500">Content (Hindi)</label><textarea className="w-full border rounded px-3 py-2 text-sm" rows={3} value={tf.content_hi} onChange={e => setTf(p => ({ ...p, content_hi: e.target.value }))} /></div>
                <div><label className="text-xs text-gray-500">Content (Gujarati)</label><textarea className="w-full border rounded px-3 py-2 text-sm" rows={3} value={tf.content_gu} onChange={e => setTf(p => ({ ...p, content_gu: e.target.value }))} /></div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-3">
                <div><label className="text-xs text-gray-500">Risks</label><textarea className="w-full border rounded px-3 py-2 text-sm" rows={2} value={tf.risks_en} onChange={e => setTf(p => ({ ...p, risks_en: e.target.value }))} /></div>
                <div><label className="text-xs text-gray-500">Benefits</label><textarea className="w-full border rounded px-3 py-2 text-sm" rows={2} value={tf.benefits_en} onChange={e => setTf(p => ({ ...p, benefits_en: e.target.value }))} /></div>
                <div><label className="text-xs text-gray-500">Alternatives</label><textarea className="w-full border rounded px-3 py-2 text-sm" rows={2} value={tf.alternatives_en} onChange={e => setTf(p => ({ ...p, alternatives_en: e.target.value }))} /></div>
              </div>
              <button onClick={handleSaveTemplate} className="bg-blue-600 text-white px-4 py-2 rounded text-sm font-medium cursor-pointer">Save Template</button>
            </div>
          )}
          <div className="overflow-x-auto bg-white border rounded-lg">
            <table className="w-full text-sm">
              <thead className="bg-gray-50"><tr>
                <th className="text-left p-3">Template</th><th className="text-center p-3">Type</th><th className="text-center p-3">Version</th><th className="text-center p-3">Languages</th>
              </tr></thead>
              <tbody>
                {dc.templates.map(t => (
                  <tr key={t.id} className="border-t">
                    <td className="p-3 font-medium">{t.template_name}<br /><span className="text-xs text-gray-400">{t.procedure_type}</span></td>
                    <td className="p-3 text-center"><span className={`px-2 py-0.5 rounded text-xs font-medium ${TYPE_COLORS[t.consent_type] || 'bg-gray-100'}`}>{t.consent_type}</span></td>
                    <td className="p-3 text-center">v{t.version}</td>
                    <td className="p-3 text-center text-xs">EN{t.content_hi ? ' · HI' : ''}{t.content_gu ? ' · GU' : ''}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {dc.templates.length === 0 && <p className="p-4 text-gray-500 text-sm">No templates. Create one to get started.</p>}
          </div>
        </div>
      )}
    </div>
  );
}

export default function DigitalConsentPage() {
  return <RoleGuard module="ot"><Inner /></RoleGuard>;
}
