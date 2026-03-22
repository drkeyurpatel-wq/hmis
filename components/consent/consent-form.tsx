// components/consent/consent-form.tsx
'use client';

import React, { useState, useRef } from 'react';
import { openPrintWindow } from '@/components/ui/shared';

interface Template {
  id: string; name: string; category: string;
  content_html: string; risks_json: string[]; alternatives_json: string[];
  version?: number;
}

interface Props {
  templates: Template[];
  patientName: string;
  patientId: string;
  admissionId?: string;
  admissionDx?: string;
  staffId: string;
  centreId?: string;
  onSign: (params: any) => Promise<any>;
  onFlash: (msg: string) => void;
  onClose: () => void;
}

// ============================================================
// Canvas Signature Pad
// ============================================================
function SignaturePad({ label, onSign }: { label: string; onSign: (dataUrl: string) => void }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [drawing, setDrawing] = useState(false);
  const [hasSign, setHasSign] = useState(false);

  const getPos = (e: React.MouseEvent | React.TouchEvent) => {
    const canvas = canvasRef.current; if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    if ('touches' in e) return { x: e.touches[0].clientX - rect.left, y: e.touches[0].clientY - rect.top };
    return { x: e.clientX - rect.left, y: e.clientY - rect.top };
  };

  const start = (e: React.MouseEvent | React.TouchEvent) => {
    e.preventDefault(); setDrawing(true);
    const ctx = canvasRef.current?.getContext('2d'); if (!ctx) return;
    const { x, y } = getPos(e);
    ctx.beginPath(); ctx.moveTo(x, y);
  };
  const draw = (e: React.MouseEvent | React.TouchEvent) => {
    if (!drawing) return; e.preventDefault();
    const ctx = canvasRef.current?.getContext('2d'); if (!ctx) return;
    const { x, y } = getPos(e);
    ctx.lineWidth = 2; ctx.lineCap = 'round'; ctx.strokeStyle = '#1a1a1a';
    ctx.lineTo(x, y); ctx.stroke(); setHasSign(true);
  };
  const end = () => { setDrawing(false); if (canvasRef.current && hasSign) onSign(canvasRef.current.toDataURL()); };
  const clear = () => {
    const ctx = canvasRef.current?.getContext('2d');
    if (ctx && canvasRef.current) { ctx.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height); setHasSign(false); onSign(''); }
  };

  return (
    <div>
      <div className="flex justify-between items-center mb-1">
        <label className="text-xs text-gray-500 font-medium">{label}</label>
        {hasSign && <button onClick={clear} className="text-[10px] text-red-500 hover:text-red-700">Clear</button>}
      </div>
      <canvas ref={canvasRef} width={300} height={80}
        className="border rounded-lg bg-gray-50 cursor-crosshair touch-none w-full"
        onMouseDown={start} onMouseMove={draw} onMouseUp={end} onMouseLeave={end}
        onTouchStart={start} onTouchMove={draw} onTouchEnd={end} />
    </div>
  );
}

export default function ConsentForm({ templates, patientName, patientId, admissionId, admissionDx, staffId, centreId, onSign, onFlash, onClose }: Props) {
  const [selectedTemplate, setSelectedTemplate] = useState<Template | null>(null);
  const [form, setForm] = useState({
    procedureName: '',
    selectedRisks: [] as string[],
    customRisks: '',
    selectedAlternatives: [] as string[],
    witnessName: '', witnessRelation: '', witnessPhone: '',
    patientSignature: '', witnessSignature: '', doctorSignature: '',
    consentLanguage: 'English',
    consentGiven: true,
  });

  const selectTemplate = (t: Template) => {
    const risks = Array.isArray(t.risks_json) ? t.risks_json : [];
    const alts = Array.isArray(t.alternatives_json) ? t.alternatives_json : [];
    setSelectedTemplate(t);
    setForm(f => ({
      ...f,
      procedureName: t.name,
      selectedRisks: [...risks],
      selectedAlternatives: [...alts],
    }));
  };

  const toggleRisk = (r: string) => setForm(f => ({
    ...f, selectedRisks: f.selectedRisks.includes(r) ? f.selectedRisks.filter(x => x !== r) : [...f.selectedRisks, r]
  }));
  const toggleAlt = (a: string) => setForm(f => ({
    ...f, selectedAlternatives: f.selectedAlternatives.includes(a) ? f.selectedAlternatives.filter(x => x !== a) : [...f.selectedAlternatives, a]
  }));

  const saveConsent = async () => {
    if (!form.patientSignature) { onFlash('Patient signature required'); return; }
    if (!form.witnessName) { onFlash('Witness name required'); return; }

    const allRisks = [...form.selectedRisks, ...(form.customRisks ? form.customRisks.split(',').map(r => r.trim()) : [])].filter(Boolean);

    await onSign({
      patientId,
      admissionId,
      templateId: selectedTemplate?.id,
      consentType: selectedTemplate?.category || 'general',
      procedureName: form.procedureName,
      consentHtml: selectedTemplate?.content_html || '',
      risksExplained: allRisks.join('; '),
      alternativesExplained: form.selectedAlternatives.join('; '),
      signatureData: form.patientSignature,
      witnessName: form.witnessName,
      witnessRelation: form.witnessRelation,
      witnessSignature: form.witnessSignature,
      doctorSignature: form.doctorSignature,
      consentLanguage: form.consentLanguage,
      obtainedBy: staffId,
      centreId,
    });
    onFlash('Consent recorded');
    onClose();
  };

  const printConsent = () => {
    if (!selectedTemplate) return;
    const risks = form.selectedRisks.map((r, i) => `<li>${i + 1}. ${r}</li>`).join('');
    const alts = form.selectedAlternatives.map((a, i) => `<li>${i + 1}. ${a}</li>`).join('');

    openPrintWindow(`<div style="max-width:700px;margin:0 auto;font-family:Segoe UI,Arial,sans-serif;font-size:11px">
      <div style="text-align:center;border-bottom:2px solid #0d9488;padding-bottom:8px;margin-bottom:12px">
        <div style="font-size:16px;font-weight:700;color:#0d9488">Health1 Super Speciality Hospital</div>
        <div style="font-size:9px;color:#666">Shilaj, Ahmedabad | NABH Accredited</div>
        <div style="font-size:14px;font-weight:700;margin-top:6px">${form.procedureName || 'INFORMED CONSENT FORM'}</div>
      </div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:4px;font-size:10px;padding:6px;border:1px solid #e5e7eb;border-radius:4px;margin-bottom:10px">
        <div><b>Patient:</b> ${patientName}</div><div><b>Date:</b> ${new Date().toLocaleDateString('en-IN')}</div>
        <div><b>Diagnosis:</b> ${admissionDx || '—'}</div><div><b>Language:</b> ${form.consentLanguage}</div>
      </div>
      <div style="margin-bottom:10px">${selectedTemplate.content_html}</div>
      ${risks ? `<div style="margin-bottom:10px"><b>Risks and Complications Explained:</b><ol style="margin-top:4px;padding-left:20px">${risks}</ol></div>` : ''}
      ${alts ? `<div style="margin-bottom:10px"><b>Alternatives Discussed:</b><ol style="margin-top:4px;padding-left:20px">${alts}</ol></div>` : ''}
      <div style="margin:15px 0;padding:10px;border:1px solid #d1d5db;border-radius:4px;font-size:10px">
        <p><b>Declaration:</b> I, the undersigned, confirm that:</p>
        <ul style="padding-left:16px;margin-top:6px">
          <li>The procedure, its risks, benefits, and alternatives have been explained to me in a language I understand (${form.consentLanguage}).</li>
          <li>I have had the opportunity to ask questions and all my questions have been answered satisfactorily.</li>
          <li>I understand that no guarantee has been given regarding the outcome.</li>
          <li>I ${form.consentGiven ? '<b>GIVE</b>' : '<b>DO NOT GIVE</b>'} my consent to proceed.</li>
        </ul>
      </div>
      <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:20px;margin-top:30px">
        <div style="text-align:center"><div style="height:60px;border-bottom:1px solid #333">${form.patientSignature ? `<img src="${form.patientSignature}" style="height:55px"/>` : ''}</div><div style="font-size:9px;margin-top:4px"><b>Patient / Representative</b><br/>Name: ${patientName}<br/>Date: ${new Date().toLocaleDateString('en-IN')}</div></div>
        <div style="text-align:center"><div style="height:60px;border-bottom:1px solid #333">${form.witnessSignature ? `<img src="${form.witnessSignature}" style="height:55px"/>` : ''}</div><div style="font-size:9px;margin-top:4px"><b>Witness</b><br/>Name: ${form.witnessName}<br/>Relation: ${form.witnessRelation}</div></div>
        <div style="text-align:center"><div style="height:60px;border-bottom:1px solid #333">${form.doctorSignature ? `<img src="${form.doctorSignature}" style="height:55px"/>` : ''}</div><div style="font-size:9px;margin-top:4px"><b>Doctor</b><br/>Date: ${new Date().toLocaleDateString('en-IN')}</div></div>
      </div>
      <div style="margin-top:15px;font-size:7px;color:#aaa;text-align:center">Health1 HMIS — Digital Consent Management</div>
    </div>`, `Consent — ${patientName} — ${form.procedureName}`);
  };

  // ============================================================
  // TEMPLATE SELECTION
  // ============================================================
  if (!selectedTemplate) {
    const categories = ['surgical', 'anesthesia', 'transfusion', 'procedure', 'general'] as const;
    const catLabels: Record<string, string> = {
      surgical: 'Surgical', anesthesia: 'Anesthesia', transfusion: 'Blood Transfusion',
      procedure: 'Procedures', general: 'General',
    };
    const catColors: Record<string, string> = {
      surgical: 'bg-red-50 border-red-200', anesthesia: 'bg-purple-50 border-purple-200',
      transfusion: 'bg-orange-50 border-orange-200', procedure: 'bg-blue-50 border-blue-200',
      general: 'bg-gray-50 border-gray-200',
    };

    return (
      <div className="bg-white rounded-xl border p-5">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-sm font-semibold">Select Consent Template</h3>
          <button onClick={onClose} className="text-xs text-gray-500 hover:text-gray-700">Cancel</button>
        </div>
        {categories.map(cat => {
          const catTemplates = templates.filter(t => t.category === cat);
          if (catTemplates.length === 0) return null;
          return (
            <div key={cat} className="mb-3">
              <div className="text-[10px] font-bold text-gray-400 uppercase mb-1.5">{catLabels[cat]}</div>
              <div className="grid grid-cols-2 gap-2">
                {catTemplates.map(t => (
                  <button key={t.id} onClick={() => selectTemplate(t)}
                    className={`text-left p-3 rounded-lg border hover:shadow-sm transition-shadow ${catColors[cat]}`}>
                    <div className="font-medium text-sm">{t.name}</div>
                    <div className="text-[10px] text-gray-400 mt-0.5">
                      {(Array.isArray(t.risks_json) ? t.risks_json.length : 0)} risks | v{t.version || 1}
                    </div>
                  </button>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    );
  }

  // ============================================================
  // CONSENT FORM
  // ============================================================
  const templateRisks = Array.isArray(selectedTemplate.risks_json) ? selectedTemplate.risks_json : [];
  const templateAlts = Array.isArray(selectedTemplate.alternatives_json) ? selectedTemplate.alternatives_json : [];

  return (
    <div className="bg-white rounded-xl border p-5 space-y-4">
      {/* Template header */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
        <div className="flex justify-between items-start">
          <div>
            <h3 className="font-semibold text-sm text-blue-800">{selectedTemplate.name}</h3>
            <div className="text-xs text-blue-600 mt-1" dangerouslySetInnerHTML={{ __html: selectedTemplate.content_html }} />
          </div>
          <button onClick={() => setSelectedTemplate(null)} className="text-[10px] text-blue-600 hover:text-blue-800">Change template</button>
        </div>
      </div>

      {/* Procedure name */}
      <div>
        <label className="text-xs text-gray-500 font-medium">Procedure / Consent For</label>
        <input type="text" value={form.procedureName} onChange={e => setForm(f => ({ ...f, procedureName: e.target.value }))}
          className="w-full mt-1 px-3 py-2 border rounded-lg text-sm" placeholder="e.g., Laparoscopic Cholecystectomy" />
      </div>

      {/* Risks */}
      <div>
        <label className="text-xs text-gray-500 font-medium mb-2 block">Risks & Complications (click to toggle)</label>
        <div className="flex flex-wrap gap-1.5">{templateRisks.map((r: string) => (
          <button key={r} onClick={() => toggleRisk(r)}
            className={`px-2.5 py-1 rounded-lg text-[11px] border ${form.selectedRisks.includes(r) ? 'bg-red-100 text-red-700 border-red-300' : 'bg-white text-gray-400 border-gray-200 line-through'}`}>{r}</button>
        ))}</div>
        <input type="text" value={form.customRisks} onChange={e => setForm(f => ({ ...f, customRisks: e.target.value }))}
          className="w-full mt-2 px-3 py-2 border rounded-lg text-xs" placeholder="Additional risks (comma-separated)..." />
      </div>

      {/* Alternatives */}
      <div>
        <label className="text-xs text-gray-500 font-medium mb-2 block">Alternatives Discussed</label>
        <div className="flex flex-wrap gap-1.5">{templateAlts.map((a: string) => (
          <button key={a} onClick={() => toggleAlt(a)}
            className={`px-2.5 py-1 rounded-lg text-[11px] border ${form.selectedAlternatives.includes(a) ? 'bg-blue-100 text-blue-700 border-blue-300' : 'bg-white text-gray-400 border-gray-200 line-through'}`}>{a}</button>
        ))}</div>
      </div>

      {/* Language */}
      <div>
        <label className="text-xs text-gray-500 font-medium">Consent explained in</label>
        <div className="flex gap-1.5 mt-1">{['English', 'Hindi', 'Gujarati', 'English + Gujarati', 'English + Hindi'].map(l => (
          <button key={l} onClick={() => setForm(f => ({ ...f, consentLanguage: l }))}
            className={`px-2.5 py-1 rounded-lg text-xs border ${form.consentLanguage === l ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-gray-500 border-gray-200'}`}>{l}</button>
        ))}</div>
      </div>

      {/* Witness */}
      <div className="grid grid-cols-3 gap-3">
        <div><label className="text-xs text-gray-500">Witness name *</label>
          <input type="text" value={form.witnessName} onChange={e => setForm(f => ({ ...f, witnessName: e.target.value }))}
            className="w-full px-3 py-2 border rounded-lg text-sm" /></div>
        <div><label className="text-xs text-gray-500">Relation *</label>
          <select value={form.witnessRelation} onChange={e => setForm(f => ({ ...f, witnessRelation: e.target.value }))}
            className="w-full px-3 py-2 border rounded-lg text-sm">
            <option value="">Select...</option>
            {['Spouse', 'Son', 'Daughter', 'Father', 'Mother', 'Brother', 'Sister', 'Friend', 'Other'].map(r => <option key={r}>{r}</option>)}
          </select></div>
        <div><label className="text-xs text-gray-500">Phone</label>
          <input type="text" value={form.witnessPhone} onChange={e => setForm(f => ({ ...f, witnessPhone: e.target.value }))}
            className="w-full px-3 py-2 border rounded-lg text-sm" /></div>
      </div>

      {/* Consent toggle */}
      <div className="flex items-center gap-3">
        <button onClick={() => setForm(f => ({ ...f, consentGiven: true }))}
          className={`px-4 py-2 rounded-lg text-sm font-medium border ${form.consentGiven ? 'bg-green-600 text-white border-green-600' : 'bg-white text-gray-500 border-gray-200'}`}>Consent GIVEN</button>
        <button onClick={() => setForm(f => ({ ...f, consentGiven: false }))}
          className={`px-4 py-2 rounded-lg text-sm font-medium border ${!form.consentGiven ? 'bg-red-600 text-white border-red-600' : 'bg-white text-gray-500 border-gray-200'}`}>Consent REFUSED</button>
      </div>

      {/* Signatures */}
      <div className="grid grid-cols-3 gap-3">
        <SignaturePad label="Patient / Representative *" onSign={url => setForm(f => ({ ...f, patientSignature: url }))} />
        <SignaturePad label="Witness Signature" onSign={url => setForm(f => ({ ...f, witnessSignature: url }))} />
        <SignaturePad label="Doctor Signature" onSign={url => setForm(f => ({ ...f, doctorSignature: url }))} />
      </div>

      {/* Actions */}
      <div className="flex gap-2">
        <button onClick={printConsent} className="px-4 py-2 bg-blue-600 text-white text-sm rounded-lg">Print Consent</button>
        <button onClick={saveConsent} className="px-4 py-2 bg-green-600 text-white text-sm rounded-lg">Sign & Submit</button>
        <button onClick={onClose} className="px-4 py-2 bg-gray-100 text-gray-600 text-sm rounded-lg">Cancel</button>
      </div>
    </div>
  );
}
