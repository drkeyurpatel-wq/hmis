// components/ipd/smart-procedures.tsx
'use client';

import React, { useState } from 'react';

interface Props {
  procedures: any[]; admissionId: string; staffId: string;
  onSave: (proc: any, staffId: string) => Promise<void>;
  onFlash: (m: string) => void;
}

interface ProcTemplate {
  type: string; label: string; icon: string;
  defaultIndications: string[];
  sites: string[];
  techniqueSteps: string[];
  commonFindings: string[];
  commonComplications: string[];
  checklistItems?: string[];
  specimenFields?: boolean;
}

const TEMPLATES: ProcTemplate[] = [
  { type: 'central_line', label: 'Central Line (CVC)', icon: '🩸',
    defaultIndications: ['IV access for vasopressors','TPN administration','HD access','Poor peripheral access','CVP monitoring'],
    sites: ['Right IJV','Left IJV','Right subclavian','Left subclavian','Right femoral','Left femoral'],
    techniqueSteps: ['Consent obtained','Timeout performed','Sterile draping done','USG-guided puncture','Guidewire inserted under fluoroscopy','Dilator and catheter advanced','Position confirmed by aspiration','Secured and dressed','CXR for tip confirmation'],
    commonFindings: ['Smooth catheter placement','Good blood return from all ports','CVP waveform obtained'],
    commonComplications: ['None','Arterial puncture','Pneumothorax','Hematoma','Malposition','Air embolism'],
    checklistItems: ['Hand hygiene','Sterile barrier precautions','Chlorhexidine skin prep','Optimal site selection','Daily review of line necessity'], },
  { type: 'intubation', label: 'Endotracheal Intubation', icon: '🫁',
    defaultIndications: ['Respiratory failure','Airway protection (low GCS)','Pre-operative','Status epilepticus','Severe sepsis'],
    sites: ['Oral','Nasal'],
    techniqueSteps: ['Pre-oxygenation with 100% O2','Induction: Propofol/Etomidate','Paralysis: Succinylcholine/Rocuronium','Direct/Video laryngoscopy','Cormack-Lehane Grade noted','ETT passed through cords','Cuff inflated','Position confirmed: auscultation + EtCO2 + CXR','ETT secured at cm mark'],
    commonFindings: ['Cormack-Lehane Grade I','Bilateral air entry','EtCO2 confirmed','No desaturation'],
    commonComplications: ['None','Difficult airway','Desaturation','Esophageal intubation (corrected)','Dental injury','Aspiration','Bronchospasm','Failed intubation'],
    checklistItems: ['Suction ready','Bougie available','Backup airway plan','Monitoring attached'], },
  { type: 'chest_tube', label: 'Intercostal Drain (ICD)', icon: '🫀',
    defaultIndications: ['Pneumothorax','Pleural effusion','Hemothorax','Empyema','Post-thoracotomy'],
    sites: ['Right 5th ICS mid-axillary','Left 5th ICS mid-axillary','Right 2nd ICS mid-clavicular','Left 2nd ICS mid-clavicular'],
    techniqueSteps: ['Local anesthesia infiltrated','Incision at safe triangle','Blunt dissection through intercostals','Pleura breached with finger sweep','Drain inserted and directed','Drain secured with suture','Connected to underwater seal','Drainage noted','CXR for position confirmation'],
    commonFindings: ['Immediate drainage of fluid/air','Drain swinging with respiration','Lung re-expansion on CXR'],
    commonComplications: ['None','Bleeding','Subcutaneous emphysema','Drain malposition','Organ injury','Infection','Re-expansion pulmonary edema'], },
  { type: 'lumbar_puncture', label: 'Lumbar Puncture', icon: '💉',
    defaultIndications: ['Meningitis workup','SAH evaluation','CSF pressure measurement','Intrathecal therapy','GBS workup'],
    sites: ['L3-L4 interspace','L4-L5 interspace'],
    techniqueSteps: ['Patient in lateral decubitus/sitting','Sterile prep and drape','Local anesthesia','Spinal needle inserted with stylet','CSF flow obtained','Opening pressure measured','CSF samples collected (tube 1-4)','Needle removed, dressing applied'],
    commonFindings: ['Clear CSF','Opening pressure normal (10-20 cmH2O)','4 tubes collected','No traumatic tap'],
    commonComplications: ['None','Post-LP headache','Traumatic tap','Back pain','Infection','Nerve root irritation','Epidural hematoma'], },
  { type: 'paracentesis', label: 'Paracentesis', icon: '💧',
    defaultIndications: ['Diagnostic (new-onset ascites)','Therapeutic (tense ascites)','SBP evaluation','Refractory ascites'],
    sites: ['Left iliac fossa','Right iliac fossa','Infraumbilical midline'],
    techniqueSteps: ['USG-guided site marking','Sterile prep','Local anesthesia','Z-track technique needle insertion','Free-flowing ascitic fluid','Samples collected','Drain connected (if therapeutic)','Volume drained recorded','Albumin replacement if >5L'],
    commonFindings: ['Clear straw-colored fluid','Fluid sent for: cell count, albumin, protein, culture','Volume drained: ___L'],
    commonComplications: ['None','Persistent leak','Bowel perforation','Bleeding','Infection','Hypotension (large volume)'],
    specimenFields: true, },
  { type: 'thoracentesis', label: 'Thoracentesis', icon: '🫁',
    defaultIndications: ['Diagnostic (new pleural effusion)','Therapeutic (large effusion)','Empyema drainage','Cytology'],
    sites: ['Right posterior 7-8th ICS','Left posterior 7-8th ICS','USG-guided safest point'],
    techniqueSteps: ['USG marking of effusion','Sterile prep','Local anesthesia','Needle inserted above rib','Fluid aspirated','Samples collected','Volume drained recorded','Post-procedure CXR'],
    commonFindings: ['Clear/turbid/bloody fluid','Fluid sent for: LDH, protein, cell count, Gram stain, culture, cytology','Light criteria assessed'],
    commonComplications: ['None','Pneumothorax','Bleeding','Re-expansion pulmonary edema','Vasovagal reaction'],
    specimenFields: true, },
  { type: 'foley_catheter', label: 'Foley Catheter', icon: '🏥',
    defaultIndications: ['Urinary retention','Strict I/O monitoring','Peri-operative','Immobilized patient','Bladder irrigation'],
    sites: ['Urethral'],
    techniqueSteps: ['Sterile technique','Lubrication applied','Catheter inserted gently','Balloon inflated with 10ml sterile water','Urine flow confirmed','Catheter secured to thigh','Drainage bag connected'],
    commonFindings: ['Smooth insertion','Clear urine output','No hematuria','Residual volume: ___ml'],
    commonComplications: ['None','Traumatic insertion','Hematuria','False passage','UTI','Urethral stricture'], },
  { type: 'ng_tube', label: 'Nasogastric Tube', icon: '🔬',
    defaultIndications: ['Gastric decompression','Enteral feeding','GI bleed lavage','Medication administration','Bowel obstruction'],
    sites: ['Right nostril','Left nostril'],
    techniqueSteps: ['Length measured (nose-ear-xiphoid)','Lubricated tube inserted through nostril','Patient asked to swallow','Tube advanced to measured length','Position confirmed: aspiration + pH test','Secured to nose','CXR for position (if feeding)'],
    commonFindings: ['Smooth insertion','Gastric aspirate obtained','pH < 5.5','Position confirmed on CXR'],
    commonComplications: ['None','Epistaxis','Coiling in pharynx','Tracheal malposition','Aspiration','Nasal ulceration'], },
  { type: 'bone_marrow', label: 'Bone Marrow Biopsy', icon: '🦴',
    defaultIndications: ['Pancytopenia workup','Leukemia/lymphoma staging','Fever of unknown origin','Myelodysplasia','Myelofibrosis'],
    sites: ['Right posterior iliac crest','Left posterior iliac crest','Sternum (aspirate only)'],
    techniqueSteps: ['Consent obtained','Local anesthesia + sedation','Jamshidi needle inserted','Aspirate obtained first','Trephine biopsy taken','Hemostasis achieved','Pressure dressing applied','Samples sent: aspirate smear, biopsy in formalin, flow cytometry'],
    commonFindings: ['Adequate aspirate and trephine obtained','Grossly normal/abnormal','Samples dispatched'],
    commonComplications: ['None','Pain','Bleeding','Infection','Dry tap','Needle breakage'],
    specimenFields: true, },
  { type: 'arterial_line', label: 'Arterial Line', icon: '📈',
    defaultIndications: ['Continuous BP monitoring','Frequent ABG sampling','Vasopressor titration','Hemodynamic instability'],
    sites: ['Left radial','Right radial','Left femoral','Right femoral','Left dorsalis pedis','Right dorsalis pedis'],
    techniqueSteps: ['Allen test performed (if radial)','Sterile prep','Local anesthesia','USG-guided arterial puncture','Guidewire inserted (Seldinger)','Catheter advanced','Arterial waveform confirmed','Secured and dressed','Transducer zeroed'],
    commonFindings: ['Good arterial waveform','Allen test positive (dual supply)','Arterial blood confirmed'],
    commonComplications: ['None','Hematoma','Thrombosis','Distal ischemia','Infection','Pseudoaneurysm','Accidental decannulation'], },
];

export default function SmartProcedures({ procedures, admissionId, staffId, onSave, onFlash }: Props) {
  const [showForm, setShowForm] = useState(false);
  const [selectedTemplate, setSelectedTemplate] = useState<ProcTemplate | null>(null);
  const [form, setForm] = useState({
    procedureType: '', procedureName: '', indication: '', site: '',
    laterality: 'na', technique: '', findings: '', complications: 'None',
    checklist: [] as string[], specimenSent: '', specimenDetails: '',
    assistedBy: '', duration: '', anesthesia: '',
  });

  const selectTemplate = (t: ProcTemplate) => {
    setSelectedTemplate(t);
    setForm(f => ({
      ...f, procedureType: t.type, procedureName: t.label,
      complications: 'None', checklist: t.checklistItems ? [...t.checklistItems] : [],
    }));
    setShowForm(true);
  };

  const appendTechnique = (step: string) => {
    setForm(f => {
      const current = f.technique.trim();
      return { ...f, technique: current ? current + '. ' + step : step };
    });
  };

  const toggleChecklist = (item: string) => {
    setForm(f => ({ ...f, checklist: f.checklist.includes(item) ? f.checklist.filter(x => x !== item) : [...f.checklist, item] }));
  };

  const saveProcedure = async () => {
    if (!form.procedureName || !form.indication) return;
    await onSave({
      procedureType: form.procedureType, procedureName: form.procedureName,
      indication: form.indication, site: form.site, laterality: form.laterality,
      technique: (form.checklist.length > 0 ? 'Checklist: ' + form.checklist.join(', ') + '. ' : '') + form.technique,
      findings: form.findings + (form.specimenSent ? '. Specimen: ' + form.specimenSent + (form.specimenDetails ? ' — ' + form.specimenDetails : '') : ''),
      complications: form.complications,
    }, staffId);
    setShowForm(false); setSelectedTemplate(null);
    setForm({ procedureType: '', procedureName: '', indication: '', site: '', laterality: 'na', technique: '', findings: '', complications: 'None', checklist: [], specimenSent: '', specimenDetails: '', assistedBy: '', duration: '', anesthesia: '' });
    onFlash('Procedure documented');
  };

  return (
    <div>
      <div className="flex justify-between items-center mb-3">
        <h2 className="font-semibold text-sm">Procedural Notes</h2>
        <button onClick={() => { setShowForm(!showForm); if (showForm) setSelectedTemplate(null); }}
          className="px-3 py-1.5 bg-blue-600 text-white text-xs rounded-lg">{showForm ? 'Cancel' : '+ New Procedure'}</button>
      </div>

      {/* Template selector */}
      {showForm && !selectedTemplate && <div className="bg-white rounded-xl border p-5 mb-4">
        <h3 className="text-sm font-medium mb-3">Select Procedure Type</h3>
        <div className="grid grid-cols-2 gap-2">{TEMPLATES.map(t => (
          <button key={t.type} onClick={() => selectTemplate(t)}
            className="text-left p-3 rounded-lg border hover:border-blue-300 hover:bg-blue-50 transition-colors flex items-center gap-2">
            <span className="text-lg">{t.icon}</span>
            <div><div className="font-medium text-sm">{t.label}</div>
              <div className="text-[10px] text-gray-400">{t.sites.length} sites | {t.techniqueSteps.length} steps</div></div>
          </button>
        ))}</div>
      </div>}

      {/* Procedure documentation form */}
      {showForm && selectedTemplate && <div className="bg-white rounded-xl border p-5 mb-4 space-y-3">
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-2 flex items-center gap-2">
          <span className="text-xl">{selectedTemplate.icon}</span>
          <div><h3 className="font-semibold text-sm text-blue-800">{selectedTemplate.label}</h3>
            <span className="text-[10px] text-blue-600">Click chips to build documentation quickly</span></div>
        </div>

        {/* Checklist (if available) */}
        {selectedTemplate.checklistItems && selectedTemplate.checklistItems.length > 0 && (
          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3">
            <label className="text-xs text-yellow-800 font-medium mb-2 block">Safety Checklist</label>
            <div className="space-y-1">{selectedTemplate.checklistItems.map(item => (
              <label key={item} className="flex items-center gap-2 text-xs cursor-pointer">
                <input type="checkbox" checked={form.checklist.includes(item)} onChange={() => toggleChecklist(item)} className="w-4 h-4 rounded border-yellow-300 text-yellow-600" />
                <span className={form.checklist.includes(item) ? 'text-green-700' : 'text-gray-600'}>{item}</span>
              </label>
            ))}</div>
          </div>
        )}

        {/* Indication — click chips */}
        <div><label className="text-xs text-gray-500 font-medium">Indication *</label>
          <div className="flex flex-wrap gap-1 my-1">{selectedTemplate.defaultIndications.map(ind => (
            <button key={ind} onClick={() => setForm(f => ({...f, indication: ind}))}
              className={`px-2 py-0.5 rounded border text-[10px] ${form.indication === ind ? 'bg-blue-100 text-blue-700 border-blue-300' : 'bg-white text-gray-500 border-gray-200'}`}>{ind}</button>
          ))}</div>
          <input type="text" value={form.indication} onChange={e => setForm(f => ({...f, indication: e.target.value}))} className="w-full px-3 py-2 border rounded-lg text-sm" placeholder="Or type custom indication..." />
        </div>

        {/* Site — click chips */}
        <div className="grid grid-cols-2 gap-3">
          <div><label className="text-xs text-gray-500 font-medium">Site *</label>
            <div className="flex flex-wrap gap-1 mt-1">{selectedTemplate.sites.map(s => (
              <button key={s} onClick={() => setForm(f => ({...f, site: s}))}
                className={`px-2 py-0.5 rounded border text-[10px] ${form.site === s ? 'bg-green-100 text-green-700 border-green-300' : 'bg-white text-gray-500 border-gray-200'}`}>{s}</button>
            ))}</div>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div><label className="text-xs text-gray-500">Anesthesia</label>
              <select value={form.anesthesia} onChange={e => setForm(f => ({...f, anesthesia: e.target.value}))} className="w-full px-2 py-1.5 border rounded-lg text-xs">
                <option value="">None/NA</option>{['Local','Local + sedation','GA','Spinal','Epidural','Regional block'].map(a => <option key={a}>{a}</option>)}</select></div>
            <div><label className="text-xs text-gray-500">Duration (min)</label>
              <input type="number" value={form.duration} onChange={e => setForm(f => ({...f, duration: e.target.value}))} className="w-full px-2 py-1.5 border rounded-lg text-xs" /></div>
          </div>
        </div>

        {/* Technique — click steps */}
        <div><label className="text-xs text-gray-500 font-medium">Technique (click steps in order, or type)</label>
          <div className="flex flex-wrap gap-1 my-1">{selectedTemplate.techniqueSteps.map((s, i) => (
            <button key={i} onClick={() => appendTechnique(s)}
              className="px-2 py-0.5 rounded border text-[10px] bg-purple-50 text-purple-700 border-purple-200 hover:bg-purple-100">{s}</button>
          ))}</div>
          <textarea value={form.technique} onChange={e => setForm(f => ({...f, technique: e.target.value}))} rows={3} className="w-full px-3 py-2 border rounded-lg text-sm" /></div>

        {/* Findings — click chips */}
        <div><label className="text-xs text-gray-500 font-medium">Findings</label>
          <div className="flex flex-wrap gap-1 my-1">{selectedTemplate.commonFindings.map(f => (
            <button key={f} onClick={() => setForm(prev => ({...prev, findings: prev.findings ? prev.findings + '. ' + f : f}))}
              className="px-2 py-0.5 rounded border text-[10px] bg-green-50 text-green-700 border-green-200 hover:bg-green-100">{f}</button>
          ))}</div>
          <textarea value={form.findings} onChange={e => setForm(f => ({...f, findings: e.target.value}))} rows={2} className="w-full px-3 py-2 border rounded-lg text-sm" /></div>

        {/* Specimen (if applicable) */}
        {selectedTemplate.specimenFields && (
          <div className="grid grid-cols-2 gap-3">
            <div><label className="text-xs text-gray-500 font-medium">Specimen sent to</label>
              <div className="flex gap-1 mt-1">{['Biochemistry','Cytology','Microbiology','Histopathology','Flow cytometry'].map(s => (
                <button key={s} onClick={() => setForm(f => ({...f, specimenSent: f.specimenSent ? f.specimenSent + ', ' + s : s}))}
                  className="px-2 py-0.5 rounded border text-[10px] bg-orange-50 text-orange-700 border-orange-200 hover:bg-orange-100">{s}</button>
              ))}</div>
              <input type="text" value={form.specimenSent} onChange={e => setForm(f => ({...f, specimenSent: e.target.value}))} className="w-full mt-1 px-2 py-1.5 border rounded text-xs" /></div>
            <div><label className="text-xs text-gray-500 font-medium">Specimen details</label>
              <input type="text" value={form.specimenDetails} onChange={e => setForm(f => ({...f, specimenDetails: e.target.value}))} className="w-full mt-1 px-3 py-2 border rounded-lg text-sm" placeholder="e.g., 4 tubes CSF, 2L ascitic fluid..." /></div>
          </div>
        )}

        {/* Complications — click chips */}
        <div><label className="text-xs text-gray-500 font-medium">Complications</label>
          <div className="flex flex-wrap gap-1 mt-1">{selectedTemplate.commonComplications.map(c => (
            <button key={c} onClick={() => setForm(f => ({...f, complications: c}))}
              className={`px-2 py-0.5 rounded border text-[10px] ${form.complications === c ? (c === 'None' ? 'bg-green-100 text-green-700 border-green-300' : 'bg-red-100 text-red-700 border-red-300') : 'bg-white text-gray-500 border-gray-200'}`}>{c}</button>
          ))}</div></div>

        <div className="flex gap-2">
          <button onClick={saveProcedure} className="px-4 py-2 bg-green-600 text-white text-sm rounded-lg font-medium">Save Procedure Note</button>
          <button onClick={() => { setShowForm(false); setSelectedTemplate(null); }} className="px-4 py-2 bg-gray-100 text-gray-600 text-sm rounded-lg">Cancel</button>
        </div>
      </div>}

      {/* Procedure history */}
      {procedures.length === 0 ? <div className="text-center py-8 bg-white rounded-xl border text-gray-400 text-sm">No procedural notes</div> :
      <div className="space-y-3">{procedures.map((n: any) => (
        <div key={n.id} className="bg-white rounded-xl border p-4">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <span className="font-medium text-sm">{n.procedure_name}</span>
              <span className="bg-gray-100 text-gray-600 text-[10px] px-1.5 py-0.5 rounded">{n.procedure_type?.replace(/_/g,' ')}</span>
              {n.site && <span className="text-xs text-gray-500">{n.site}</span>}
            </div>
            <span className="text-xs text-gray-400">{new Date(n.procedure_date || n.created_at).toLocaleString('en-IN', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}</span>
          </div>
          <div className="space-y-1 text-xs">
            <div><span className="font-medium text-blue-600">Indication:</span> {n.indication}</div>
            {n.technique && <div><span className="font-medium text-purple-600">Technique:</span> {n.technique}</div>}
            {n.findings && <div><span className="font-medium text-green-600">Findings:</span> {n.findings}</div>}
            <div><span className="font-medium">Complications:</span> <span className={n.complications === 'None' || !n.complications ? 'text-green-600' : 'text-red-600 font-medium'}>{n.complications || 'None'}</span></div>
          </div>
          <div className="text-[10px] text-gray-400 mt-2">Dr. {n.doctor?.full_name}</div>
        </div>
      ))}</div>}
    </div>
  );
}
