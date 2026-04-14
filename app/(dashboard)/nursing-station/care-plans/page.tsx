// @ts-nocheck
'use client';
import { useState } from 'react';

const TEMPLATES = [
  { diagnosis: 'High fall risk', nursing_dx: 'Risk for falls related to impaired gait/confusion', goal: 'Patient will not experience falls during hospitalisation', interventions: ['Fall risk sign at bedside','Non-skid footwear','Bed lowest position, brakes locked','Call bell within reach','Hourly rounding','Reassess Morse q-shift'] },
  { diagnosis: 'Pressure ulcer risk', nursing_dx: 'Risk for impaired skin integrity related to immobility', goal: 'Patient will maintain intact skin throughout hospitalisation', interventions: ['Reposition q2h','Pressure-relieving mattress','Skin assessment with each reposition','Nutritional supplement per dietitian','Keep skin clean and dry','Heel elevation off bed'] },
  { diagnosis: 'Post-surgical pain', nursing_dx: 'Acute pain related to surgical intervention', goal: 'Pain maintained at NRS ≤ 3', interventions: ['Pain assessment q4h using NRS','Administer analgesics as prescribed','Non-pharmacological measures (positioning, ice)','Evaluate effectiveness 30min post-intervention','Educate patient on pain management'] },
  { diagnosis: 'Risk for infection', nursing_dx: 'Risk for infection related to invasive lines/surgical wound', goal: 'No signs of infection during hospital stay', interventions: ['Monitor temp q4h','Assess IV/wound site q-shift for signs of infection','Hand hygiene before and after patient contact','Maintain aseptic technique for dressing changes','Culture if temp > 38.5°C'] },
  { diagnosis: 'Fluid volume deficit', nursing_dx: 'Deficient fluid volume related to inadequate oral intake', goal: 'Maintain fluid balance within normal limits', interventions: ['Strict I/O monitoring','Encourage oral fluids 2L/day (if not restricted)','Monitor for dehydration signs (dry mucosa, tenting)','Daily weight monitoring','Administer IV fluids as prescribed'] },
];

export default function CarePlansPage() {
  const centreId = 'c0000001-0000-0000-0000-000000000001';
  const [admissionId, setAdmissionId] = useState('');
  const [patientId, setPatientId] = useState('');
  const [plans, setPlans] = useState<any[]>([]);
  const [showCreate, setShowCreate] = useState(false);
  const [selectedTemplate, setSelectedTemplate] = useState<number | null>(null);
  const [custom, setCustom] = useState({ diagnosis: '', nursing_diagnosis: '', goal: '', interventions: '' });
  const [saving, setSaving] = useState(false);

  const loadPlans = async () => {
    if (!admissionId) return;
    const data = await fetch(`/api/ipd/care-plans?admission_id=${admissionId}`).then(r => r.json());
    setPlans(data);
  };

  const createPlan = async () => {
    if (!admissionId || !patientId) return;
    setSaving(true);
    const tmpl = selectedTemplate !== null ? TEMPLATES[selectedTemplate] : null;
    const body = {
      centre_id: centreId, admission_id: admissionId, patient_id: patientId,
      diagnosis: tmpl?.diagnosis || custom.diagnosis,
      nursing_diagnosis: tmpl?.nursing_dx || custom.nursing_diagnosis,
      goal: tmpl?.goal || custom.goal,
      interventions: tmpl ? tmpl.interventions.map(a => ({ action: a, frequency: 'Per protocol' })) : custom.interventions.split('\n').filter(Boolean).map(a => ({ action: a.trim(), frequency: 'Per protocol' })),
    };
    const res = await fetch('/api/ipd/care-plans', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    if (res.ok) { loadPlans(); setShowCreate(false); setSelectedTemplate(null); }
    setSaving(false);
  };

  const statusColors: Record<string, string> = { ACTIVE: 'bg-green-100 text-green-800', ACHIEVED: 'bg-blue-100 text-blue-800', MODIFIED: 'bg-amber-100 text-amber-800', DISCONTINUED: 'bg-gray-200 text-gray-600' };

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Individualized Care Plans</h1>
        <p className="text-sm text-gray-500">Nursing care plans per admission. Templates for common diagnoses. Auto-generated from fall/pressure risk assessments.</p>
      </div>

      <div className="border rounded-lg p-4 space-y-3">
        <div className="grid grid-cols-2 gap-3">
          <input type="text" value={admissionId} onChange={e => setAdmissionId(e.target.value)} placeholder="Admission ID" className="border rounded px-3 py-2 text-sm" />
          <input type="text" value={patientId} onChange={e => setPatientId(e.target.value)} placeholder="Patient ID" className="border rounded px-3 py-2 text-sm" />
        </div>
        <div className="flex gap-2">
          <button onClick={loadPlans} className="px-4 py-2 bg-blue-600 text-white rounded text-sm font-medium hover:bg-blue-700">Load Plans</button>
          <button onClick={() => setShowCreate(!showCreate)} className="px-4 py-2 bg-green-600 text-white rounded text-sm font-medium hover:bg-green-700">+ New Plan</button>
        </div>
      </div>

      {showCreate && (
        <div className="border-2 border-green-300 rounded-xl p-5 space-y-4">
          <h3 className="font-bold text-green-800">Create Care Plan</h3>
          <div>
            <div className="text-xs font-medium text-gray-500 mb-2">Quick Templates</div>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
              {TEMPLATES.map((t, i) => (
                <button key={i} onClick={() => { setSelectedTemplate(i); setCustom({ diagnosis: '', nursing_diagnosis: '', goal: '', interventions: '' }); }} className={`text-left border rounded-lg p-2.5 text-xs transition-colors ${selectedTemplate === i ? 'border-green-500 bg-green-50 ring-1 ring-green-200' : 'hover:bg-gray-50'}`}>
                  <div className="font-semibold">{t.diagnosis}</div>
                  <div className="text-gray-500 mt-0.5">{t.interventions.length} interventions</div>
                </button>
              ))}
            </div>
          </div>
          {selectedTemplate !== null && (
            <div className="bg-green-50 rounded-lg p-3 text-sm space-y-2">
              <div><strong>Nursing Diagnosis:</strong> {TEMPLATES[selectedTemplate].nursing_dx}</div>
              <div><strong>Goal:</strong> {TEMPLATES[selectedTemplate].goal}</div>
              <div><strong>Interventions:</strong></div>
              <ul className="list-disc pl-5 text-xs space-y-0.5">{TEMPLATES[selectedTemplate].interventions.map((iv, i) => <li key={i}>{iv}</li>)}</ul>
            </div>
          )}
          <div className="text-xs text-gray-500">— or custom —</div>
          {selectedTemplate === null && (
            <div className="space-y-2">
              <input value={custom.diagnosis} onChange={e => setCustom(p => ({ ...p, diagnosis: e.target.value }))} placeholder="Diagnosis" className="w-full border rounded px-3 py-2 text-sm" />
              <input value={custom.nursing_diagnosis} onChange={e => setCustom(p => ({ ...p, nursing_diagnosis: e.target.value }))} placeholder="Nursing diagnosis" className="w-full border rounded px-3 py-2 text-sm" />
              <input value={custom.goal} onChange={e => setCustom(p => ({ ...p, goal: e.target.value }))} placeholder="Goal" className="w-full border rounded px-3 py-2 text-sm" />
              <textarea value={custom.interventions} onChange={e => setCustom(p => ({ ...p, interventions: e.target.value }))} placeholder="Interventions (one per line)" rows={4} className="w-full border rounded px-3 py-2 text-sm" />
            </div>
          )}
          <button onClick={createPlan} disabled={saving} className="px-6 py-2 bg-green-600 text-white rounded font-medium hover:bg-green-700">{saving ? 'Saving...' : 'Create Care Plan'}</button>
        </div>
      )}

      <div className="space-y-3">{plans.length === 0 && !showCreate && <div className="border rounded-lg p-8 text-center text-gray-500">No care plans loaded. Enter an admission ID and click Load Plans.</div>}
        {plans.map(p => (
          <div key={p.id} className="border rounded-lg p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className={`text-xs px-2 py-0.5 rounded font-medium ${statusColors[p.status]}`}>{p.status}</span>
                <span className={`text-xs px-1.5 py-0.5 rounded ${p.priority === 'HIGH' ? 'bg-red-100 text-red-700' : 'bg-gray-100'}`}>{p.priority}</span>
                <span className="font-semibold text-sm">{p.diagnosis}</span>
              </div>
              <span className="text-xs text-gray-500">{new Date(p.created_at).toLocaleDateString()}</span>
            </div>
            {p.nursing_diagnosis && <div className="text-xs text-gray-600 mt-1 italic">{p.nursing_diagnosis}</div>}
            <div className="text-xs text-blue-700 mt-1 font-medium">Goal: {p.goal}</div>
            {Array.isArray(p.interventions) && (
              <ul className="mt-2 text-xs space-y-1">{p.interventions.map((iv: any, i: number) => (
                <li key={i} className="flex items-start gap-1.5">
                  <span className="text-green-500 mt-0.5">●</span>
                  <span>{typeof iv === 'string' ? iv : iv.action}{iv.frequency && iv.frequency !== 'Per protocol' ? ` (${iv.frequency})` : ''}</span>
                </li>
              ))}</ul>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
