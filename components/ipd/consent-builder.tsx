// components/ipd/consent-builder.tsx
'use client';

import React, { useState, useRef, useEffect } from 'react';
import { openPrintWindow } from '@/components/ui/shared';

interface Props {
  consents: any[]; patientId: string; patientName: string; admissionId: string;
  admissionDx: string; staffId: string;
  onSave: (consent: any, staffId: string) => Promise<void>;
  onFlash: (m: string) => void;
}

interface ConsentTemplate {
  type: string; title: string; description: string;
  risks: string[]; alternatives: string[];
  additionalInfo?: string;
}

const TEMPLATES: ConsentTemplate[] = [
  { type: 'general', title: 'General Consent for Treatment', description: 'I consent to the general medical treatment, nursing care, diagnostic procedures, and routine hospital services during my stay at Hospital.',
    risks: ['Allergic reactions to medications','Infection','Pain or discomfort','Unexpected complications'], alternatives: ['Refusal of treatment','Alternative therapies'] },
  { type: 'surgical', title: 'Informed Consent for Surgery', description: 'I consent to undergo the surgical procedure as explained by my surgeon, including any additional procedures that may become necessary during the operation.',
    risks: ['Bleeding requiring transfusion','Infection (wound/deep)','Anesthesia complications','Injury to surrounding structures','Blood clots (DVT/PE)','Need for ICU admission','Conversion to open surgery','Need for re-operation','Scarring','Chronic pain','Death (rare)'], alternatives: ['Conservative management','Alternative surgical approach','Observation and monitoring'] },
  { type: 'anesthesia', title: 'Consent for Anesthesia', description: 'I consent to the administration of anesthesia (general/regional/local/sedation) as deemed appropriate by the anesthesiologist.',
    risks: ['Nausea and vomiting','Sore throat (if intubated)','Allergic reaction','Aspiration pneumonia','Nerve injury','Awareness under anesthesia','Cardiac arrest','Malignant hyperthermia','Dental damage','Post-dural puncture headache (if spinal)'], alternatives: ['Local anesthesia','Regional block','Conscious sedation'] },
  { type: 'blood_transfusion', title: 'Consent for Blood Transfusion', description: 'I consent to receive blood and/or blood products (packed red cells, plasma, platelets, cryoprecipitate) as deemed medically necessary.',
    risks: ['Febrile reaction (fever, chills)','Allergic reaction (mild to severe)','Hemolytic reaction','TACO (fluid overload)','TRALI (lung injury)','Transfusion-transmitted infection (very rare)','Iron overload (with multiple transfusions)'], alternatives: ['Iron supplementation','Erythropoietin','Cell salvage','Observation'] },
  { type: 'high_risk', title: 'High-Risk Procedure Consent', description: 'I understand that this procedure carries a higher than average risk of complications, and I consent to proceed after thorough explanation.',
    risks: ['Significant bleeding','Organ injury','ICU admission','Prolonged hospital stay','Disability','Death'], alternatives: ['Conservative management','Second opinion','Transfer to higher centre'] },
  { type: 'tkr', title: 'Consent for Total Knee Replacement', description: 'I consent to undergo Total Knee Replacement surgery (with/without robotic assistance — Cuvis Joint Replacement Robot) on the specified knee.',
    risks: ['Infection (superficial or deep prosthetic)','Blood clots (DVT/PE)','Implant loosening or failure','Leg length discrepancy','Stiffness (arthrofibrosis)','Nerve or vascular injury','Fracture around prosthesis','Persistent pain','Need for revision surgery','Dislocation','Allergic reaction to implant'], alternatives: ['Conservative management (physio, injections, braces)','Partial knee replacement','Osteotomy','Pain management clinic'] },
  { type: 'ptca', title: 'Consent for Coronary Angioplasty (PTCA/PCI)', description: 'I consent to undergo Percutaneous Coronary Intervention (PCI/PTCA) with stent placement as explained by my cardiologist.',
    risks: ['Bleeding at access site','Coronary artery dissection','Stent thrombosis','Contrast allergy/nephropathy','Arrhythmias','Need for emergency CABG','Stroke','Heart attack (peri-procedural)','Death (rare)','Restenosis (in-stent narrowing)'], alternatives: ['Medical management (medications only)','Coronary artery bypass grafting (CABG)','Lifestyle modification'] },
  { type: 'lap_chole', title: 'Consent for Laparoscopic Cholecystectomy', description: 'I consent to undergo laparoscopic removal of the gallbladder (with/without robotic assistance — SSI Mantra 3.0).',
    risks: ['Bile duct injury','Bleeding','Infection','Conversion to open surgery','Retained stones in CBD','Port-site hernia','Bowel injury','Post-cholecystectomy syndrome','Bile leak'], alternatives: ['Medical management (ursodeoxycholic acid)','Open cholecystectomy','ERCP for CBD stones'] },
  { type: 'ama_lama', title: 'Discharge Against Medical Advice (LAMA/AMA)', description: 'I wish to leave the hospital against the medical advice of my treating doctors. I understand the risks of leaving prematurely.',
    risks: ['Worsening of current condition','Need for emergency readmission','Permanent disability','Death','Incomplete treatment'], alternatives: ['Continue recommended treatment','Discuss concerns with treating doctor','Seek second opinion within hospital'] },
  { type: 'dnr', title: 'Do Not Resuscitate (DNR) Order', description: 'I request that no cardiopulmonary resuscitation (CPR), defibrillation, intubation, or vasopressors be administered in the event of cardiac or respiratory arrest.',
    risks: ['Death in event of cardiac/respiratory arrest','No reversal once implemented at time of event'], alternatives: ['Full code (all resuscitation measures)','Limited code (specify interventions)','Comfort measures only'] },
];

// Signature Canvas Component
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
    e.preventDefault();
    setDrawing(true);
    const ctx = canvasRef.current?.getContext('2d'); if (!ctx) return;
    const { x, y } = getPos(e);
    ctx.beginPath(); ctx.moveTo(x, y);
  };

  const draw = (e: React.MouseEvent | React.TouchEvent) => {
    if (!drawing) return; e.preventDefault();
    const ctx = canvasRef.current?.getContext('2d'); if (!ctx) return;
    const { x, y } = getPos(e);
    ctx.lineWidth = 2; ctx.lineCap = 'round'; ctx.strokeStyle = '#1a1a1a';
    ctx.lineTo(x, y); ctx.stroke();
    setHasSign(true);
  };

  const end = () => { setDrawing(false); if (canvasRef.current && hasSign) onSign(canvasRef.current.toDataURL()); };
  const clear = () => { const ctx = canvasRef.current?.getContext('2d'); if (ctx && canvasRef.current) { ctx.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height); setHasSign(false); onSign(''); } };

  return (
    <div>
      <div className="flex justify-between items-center mb-1"><label className="text-xs text-gray-500 font-medium">{label}</label>
        {hasSign && <button onClick={clear} className="text-[10px] text-red-500 hover:text-red-700">Clear</button>}</div>
      <canvas ref={canvasRef} width={300} height={80} className="border rounded-lg bg-gray-50 cursor-crosshair touch-none w-full"
        onMouseDown={start} onMouseMove={draw} onMouseUp={end} onMouseLeave={end}
        onTouchStart={start} onTouchMove={draw} onTouchEnd={end} />
    </div>
  );
}

export default function ConsentBuilder({ consents, patientId, patientName, admissionId, admissionDx, staffId, onSave, onFlash }: Props) {
  const [showForm, setShowForm] = useState(false);
  const [selectedTemplate, setSelectedTemplate] = useState<ConsentTemplate | null>(null);
  const [form, setForm] = useState({
    consentType: '', procedureName: '', customDescription: '',
    selectedRisks: [] as string[], customRisks: '',
    selectedAlternatives: [] as string[], customAlternatives: '',
    witnessName: '', witnessRelation: '', witnessPhone: '',
    patientSignature: '', witnessSignature: '', doctorSignature: '',
    consentLanguage: 'English',
    consentGiven: true,
  });

  const selectTemplate = (t: ConsentTemplate) => {
    setSelectedTemplate(t);
    setForm(f => ({
      ...f, consentType: t.type, procedureName: t.title,
      selectedRisks: [...t.risks], selectedAlternatives: [...t.alternatives],
      customDescription: t.description,
    }));
  };

  const toggleRisk = (r: string) => setForm(f => ({ ...f, selectedRisks: f.selectedRisks.includes(r) ? f.selectedRisks.filter(x => x !== r) : [...f.selectedRisks, r] }));
  const toggleAlt = (a: string) => setForm(f => ({ ...f, selectedAlternatives: f.selectedAlternatives.includes(a) ? f.selectedAlternatives.filter(x => x !== a) : [...f.selectedAlternatives, a] }));

  const saveConsent = async () => {
    const allRisks = [...form.selectedRisks, ...(form.customRisks ? form.customRisks.split(',').map(r => r.trim()) : [])].filter(Boolean);
    await onSave({
      patientId, consentType: form.consentType, procedureName: form.procedureName,
      risksExplained: allRisks.join('; '),
      witnessName: form.witnessName, witnessRelation: form.witnessRelation,
      consentGiven: form.consentGiven,
    }, staffId);
    setShowForm(false); setSelectedTemplate(null);
    onFlash('Consent recorded');
  };

  const printConsent = () => {
    const risks = form.selectedRisks.map((r, i) => `<li>${i+1}. ${r}</li>`).join('');
    const alts = form.selectedAlternatives.map((a, i) => `<li>${i+1}. ${a}</li>`).join('');

    openPrintWindow(`<div style="max-width:700px;margin:0 auto;font-family:Segoe UI,Arial,sans-serif;font-size:11px">
      <div style="text-align:center;border-bottom:2px solid #1e40af;padding-bottom:8px;margin-bottom:12px">
        <div style="font-size:16px;font-weight:700;color:#1e40af">Health1 Super Speciality Hospitals</div>
        <div style="font-size:9px;color:#666">Shilaj, Ahmedabad | NABH Accredited</div>
        <div style="font-size:14px;font-weight:700;margin-top:6px">${form.procedureName || 'INFORMED CONSENT FORM'}</div>
      </div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:4px;font-size:10px;padding:6px;border:1px solid #e5e7eb;border-radius:4px;margin-bottom:10px">
        <div><b>Patient Name:</b> ${patientName}</div><div><b>Date:</b> ${new Date().toLocaleDateString('en-IN')}</div>
        <div><b>IPD No:</b> ${admissionDx ? '—' : '—'}</div><div><b>Language:</b> ${form.consentLanguage}</div>
      </div>
      <p style="margin-bottom:10px">${form.customDescription}</p>
      ${risks ? `<div style="margin-bottom:10px"><b>Risks and Complications Explained:</b><ol style="margin-top:4px;padding-left:20px">${risks}</ol></div>` : ''}
      ${alts ? `<div style="margin-bottom:10px"><b>Alternatives Discussed:</b><ol style="margin-top:4px;padding-left:20px">${alts}</ol></div>` : ''}
      <div style="margin:15px 0;padding:10px;border:1px solid #d1d5db;border-radius:4px;font-size:10px">
        <p><b>Declaration:</b> I, the undersigned, confirm that:</p>
        <ul style="padding-left:16px;margin-top:6px">
          <li>The procedure, its risks, benefits, and alternatives have been explained to me in a language I understand (${form.consentLanguage}).</li>
          <li>I have had the opportunity to ask questions and all my questions have been answered satisfactorily.</li>
          <li>I understand that no guarantee has been given regarding the outcome of the procedure.</li>
          <li>I ${form.consentGiven ? 'GIVE' : 'DO NOT GIVE'} my consent to proceed.</li>
        </ul>
      </div>
      <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:20px;margin-top:30px">
        <div style="text-align:center"><div style="height:60px;border-bottom:1px solid #333">${form.patientSignature ? `<img alt="" src="${form.patientSignature}" style="height:55px"/>` : ''}</div><div style="font-size:9px;margin-top:4px"><b>Patient / Authorized Representative</b><br/>Name: ${patientName}<br/> Date: ${new Date().toLocaleDateString('en-IN')}</div></div>
        <div style="text-align:center"><div style="height:60px;border-bottom:1px solid #333">${form.witnessSignature ? `<img alt="" src="${form.witnessSignature}" style="height:55px"/>` : ''}</div><div style="font-size:9px;margin-top:4px"><b>Witness</b><br/>Name: ${form.witnessName}<br/> Relation: ${form.witnessRelation}</div></div>
        <div style="text-align:center"><div style="height:60px;border-bottom:1px solid #333">${form.doctorSignature ? `<img alt="" src="${form.doctorSignature}" style="height:55px"/>` : ''}</div><div style="font-size:9px;margin-top:4px"><b>Doctor / Counselor</b><br/> Date: ${new Date().toLocaleDateString('en-IN')}</div></div>
      </div>
    </div>`, `Consent — ${patientName} — ${form.consentType}`);
  };

  return (
    <div>
      <div className="flex justify-between items-center mb-3">
        <h2 className="font-semibold text-sm">Consent Forms</h2>
        <button onClick={() => { setShowForm(!showForm); setSelectedTemplate(null); }} className="px-3 py-1.5 bg-blue-600 text-white text-xs rounded-lg">{showForm ? 'Cancel' : '+ New Consent'}</button>
      </div>

      {showForm && !selectedTemplate && <div className="bg-white rounded-xl border p-5 mb-4">
        <h3 className="text-sm font-medium mb-3">Select Consent Template</h3>
        <div className="grid grid-cols-2 gap-2">{TEMPLATES.map(t => (
          <button key={t.type} onClick={() => selectTemplate(t)}
            className="text-left p-3 rounded-lg border hover:border-blue-300 hover:bg-blue-50 transition-colors">
            <div className="font-medium text-sm">{t.title}</div>
            <div className="text-[10px] text-gray-400 mt-0.5">{t.risks.length} risks | {t.alternatives.length} alternatives</div>
          </button>
        ))}</div>
      </div>}

      {showForm && selectedTemplate && <div className="bg-white rounded-xl border p-5 mb-4 space-y-4">
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
          <h3 className="font-semibold text-sm text-blue-800">{selectedTemplate.title}</h3>
          <p className="text-xs text-blue-700 mt-1">{selectedTemplate.description}</p>
        </div>

        {/* Risks — toggle checkboxes */}
        <div>
          <label className="text-xs text-gray-500 font-medium mb-2 block">Risks & Complications Explained (click to toggle)</label>
          <div className="flex flex-wrap gap-1.5">{selectedTemplate.risks.map(r => (
            <button key={r} onClick={() => toggleRisk(r)}
              className={`px-2.5 py-1 rounded-lg text-[11px] border ${form.selectedRisks.includes(r) ? 'bg-red-100 text-red-700 border-red-300' : 'bg-white text-gray-400 border-gray-200 line-through'}`}>{r}</button>
          ))}</div>
          <input type="text" value={form.customRisks} onChange={e => setForm(f => ({...f, customRisks: e.target.value}))} className="w-full mt-2 px-3 py-2 border rounded-lg text-xs" placeholder="Additional risks (comma-separated)..." />
        </div>

        {/* Alternatives */}
        <div>
          <label className="text-xs text-gray-500 font-medium mb-2 block">Alternatives Discussed</label>
          <div className="flex flex-wrap gap-1.5">{selectedTemplate.alternatives.map(a => (
            <button key={a} onClick={() => toggleAlt(a)}
              className={`px-2.5 py-1 rounded-lg text-[11px] border ${form.selectedAlternatives.includes(a) ? 'bg-blue-100 text-blue-700 border-blue-300' : 'bg-white text-gray-400 border-gray-200 line-through'}`}>{a}</button>
          ))}</div>
        </div>

        {/* Language */}
        <div><label className="text-xs text-gray-500 font-medium">Consent explained in</label>
          <div className="flex gap-1.5 mt-1">{['English','Hindi','Gujarati','English + Gujarati','English + Hindi'].map(l => (
            <button key={l} onClick={() => setForm(f => ({...f, consentLanguage: l}))}
              className={`px-2.5 py-1 rounded-lg text-xs border ${form.consentLanguage === l ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-gray-500 border-gray-200'}`}>{l}</button>
          ))}</div></div>

        {/* Witness */}
        <div className="grid grid-cols-3 gap-3">
          <div><label className="text-xs text-gray-500">Witness name *</label>
            <input type="text" value={form.witnessName} onChange={e => setForm(f => ({...f, witnessName: e.target.value}))} className="w-full px-3 py-2 border rounded-lg text-sm" /></div>
          <div><label className="text-xs text-gray-500">Relation *</label>
            <select value={form.witnessRelation} onChange={e => setForm(f => ({...f, witnessRelation: e.target.value}))} className="w-full px-3 py-2 border rounded-lg text-sm">
              <option value="">Select...</option>{['Spouse','Son','Daughter','Father','Mother','Brother','Sister','Friend','Other'].map(r => <option key={r}>{r}</option>)}</select></div>
          <div><label className="text-xs text-gray-500">Witness phone</label>
            <input type="text" value={form.witnessPhone} onChange={e => setForm(f => ({...f, witnessPhone: e.target.value}))} className="w-full px-3 py-2 border rounded-lg text-sm" /></div>
        </div>

        {/* Consent given toggle */}
        <div className="flex items-center gap-3">
          <button onClick={() => setForm(f => ({...f, consentGiven: true}))}
            className={`px-4 py-2 rounded-lg text-sm font-medium border ${form.consentGiven ? 'bg-green-600 text-white border-green-600' : 'bg-white text-gray-500 border-gray-200'}`}>Consent GIVEN</button>
          <button onClick={() => setForm(f => ({...f, consentGiven: false}))}
            className={`px-4 py-2 rounded-lg text-sm font-medium border ${!form.consentGiven ? 'bg-red-600 text-white border-red-600' : 'bg-white text-gray-500 border-gray-200'}`}>Consent REFUSED</button>
        </div>

        {/* Signatures */}
        <div className="grid grid-cols-3 gap-3">
          <SignaturePad label="Patient / Representative Signature" onSign={url => setForm(f => ({...f, patientSignature: url}))} />
          <SignaturePad label="Witness Signature" onSign={url => setForm(f => ({...f, witnessSignature: url}))} />
          <SignaturePad label="Doctor Signature" onSign={url => setForm(f => ({...f, doctorSignature: url}))} />
        </div>

        <div className="flex gap-2">
          <button onClick={printConsent} className="px-4 py-2 bg-blue-600 text-white text-sm rounded-lg">Print Consent</button>
          <button onClick={saveConsent} className="px-4 py-2 bg-green-600 text-white text-sm rounded-lg">Save Consent</button>
          <button onClick={() => { setShowForm(false); setSelectedTemplate(null); }} className="px-4 py-2 bg-gray-100 text-gray-600 text-sm rounded-lg">Cancel</button>
        </div>
      </div>}

      {/* Consent history */}
      {consents.length === 0 ? <div className="text-center py-8 bg-white rounded-xl border text-gray-400 text-sm">No consent forms</div> :
      <div className="space-y-2">{consents.map((c: any) => (
        <div key={c.id} className="bg-white rounded-lg border p-3 flex items-center justify-between">
          <div>
            <span className="font-medium text-sm">{c.consent_type?.replace(/_/g,' ').toUpperCase()}</span>
            {c.procedure_name && <span className="text-xs text-gray-500 ml-2">— {c.procedure_name}</span>}
            {c.risks_explained && <div className="text-[10px] text-gray-400 mt-0.5 max-w-[500px] truncate">{c.risks_explained}</div>}
            <div className="text-[10px] text-gray-400 mt-0.5">
              {new Date(c.consent_date || c.created_at).toLocaleDateString('en-IN')} | {c.staff?.full_name}
              {c.witness_name && <span> | Witness: {c.witness_name} ({c.witness_relation})</span>}
            </div>
          </div>
          <span className={`px-2 py-0.5 rounded text-xs font-medium ${c.consent_given ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>{c.consent_given ? 'Obtained' : 'Refused'}</span>
        </div>
      ))}</div>}
    </div>
  );
}
