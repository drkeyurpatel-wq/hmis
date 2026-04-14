// @ts-nocheck
'use client';
import { useState, useMemo } from 'react';

const SECTIONS = [
  { title: 'Clinical Readiness', items: [
    { key: 'doctor_clearance', label: 'Doctor clearance obtained' },
    { key: 'vitals_stable', label: 'Vitals stable for ≥24 hours' },
    { key: 'pain_controlled', label: 'Pain controlled (NRS ≤ 3)' },
    { key: 'diet_tolerated', label: 'Oral diet tolerated' },
    { key: 'ambulation_assessed', label: 'Ambulation/mobility assessed' },
  ]},
  { title: 'Documentation', items: [
    { key: 'discharge_summary_prepared', label: 'Discharge summary prepared' },
    { key: 'prescriptions_written', label: 'Discharge prescriptions written' },
    { key: 'follow_up_scheduled', label: 'Follow-up appointment scheduled' },
    { key: 'referrals_sent', label: 'Referrals sent (if applicable)' },
  ]},
  { title: 'Patient Education (NABH PRE.5)', items: [
    { key: 'medication_counseling', label: 'Medication counseling done (dose, frequency, side effects)' },
    { key: 'diet_instructions', label: 'Dietary instructions provided' },
    { key: 'wound_care_instructions', label: 'Wound care / dressing instructions' },
    { key: 'warning_signs_explained', label: 'Warning signs to watch for explained' },
    { key: 'activity_restrictions_explained', label: 'Activity restrictions explained' },
  ]},
  { title: 'Administrative', items: [
    { key: 'billing_cleared', label: 'Final bill generated and cleared' },
    { key: 'insurance_documents_ready', label: 'Insurance / TPA documents ready' },
    { key: 'belongings_returned', label: 'Patient belongings returned' },
    { key: 'transport_arranged', label: 'Transport / ambulance arranged' },
    { key: 'feedback_collected', label: 'Patient feedback / NPS collected' },
  ]},
];

export default function DischargeChecklist() {
  const centreId = 'c0000001-0000-0000-0000-000000000001';
  const [admissionId, setAdmissionId] = useState('');
  const [patientId, setPatientId] = useState('');
  const [checks, setChecks] = useState<Record<string, boolean>>({});
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const allItems = SECTIONS.flatMap(s => s.items);
  const completed = allItems.filter(i => checks[i.key]).length;
  const total = allItems.length;
  const pct = Math.round(completed / total * 100);
  const isReady = pct === 100;

  const toggle = (key: string) => setChecks(prev => ({ ...prev, [key]: !prev[key] }));

  const handleSubmit = async () => {
    if (!admissionId || !patientId) return;
    setSaving(true);
    const body = { centre_id: centreId, admission_id: admissionId, patient_id: patientId, ...checks };
    const res = await fetch('/api/ipd/discharge-checklist', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    if (res.ok) { setSaved(true); setTimeout(() => setSaved(false), 4000); }
    setSaving(false);
  };

  return (
    <div className="p-6 max-w-3xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Discharge Readiness Checklist</h1>
        <p className="text-sm text-gray-500">19-item structured checklist • NABH PRE.5 compliant • Auto-triggers PX discharge survey on completion</p>
      </div>

      <div className="border rounded-lg p-4 grid grid-cols-2 gap-3">
        <div>
          <label className="text-xs text-gray-500 block mb-1">Admission ID</label>
          <input type="text" value={admissionId} onChange={e => setAdmissionId(e.target.value)} placeholder="Paste admission UUID" className="w-full border rounded px-3 py-2 text-sm" />
        </div>
        <div>
          <label className="text-xs text-gray-500 block mb-1">Patient ID</label>
          <input type="text" value={patientId} onChange={e => setPatientId(e.target.value)} placeholder="Paste patient UUID" className="w-full border rounded px-3 py-2 text-sm" />
        </div>
      </div>

      <div className={`border-2 rounded-xl p-4 ${isReady ? 'border-green-400 bg-green-50' : 'border-gray-200'}`}>
        <div className="flex items-center justify-between mb-2">
          <span className="font-bold">{completed}/{total} completed</span>
          <span className={`text-lg font-black ${isReady ? 'text-green-600' : pct >= 50 ? 'text-amber-600' : 'text-red-600'}`}>{pct}%</span>
        </div>
        <div className="w-full h-3 bg-gray-200 rounded-full overflow-hidden">
          <div className={`h-full rounded-full transition-all duration-500 ${isReady ? 'bg-green-500' : pct >= 50 ? 'bg-amber-500' : 'bg-red-500'}`} style={{ width: `${pct}%` }} />
        </div>
        {isReady && <div className="text-center mt-2 text-green-700 font-semibold text-sm">✅ DISCHARGE READY — All items complete</div>}
      </div>

      {SECTIONS.map(section => {
        const sectionComplete = section.items.filter(i => checks[i.key]).length;
        return (
          <div key={section.title} className="border rounded-lg overflow-hidden">
            <div className="bg-gray-50 px-4 py-3 flex items-center justify-between">
              <span className="font-semibold text-sm">{section.title}</span>
              <span className={`text-xs px-2 py-0.5 rounded font-medium ${sectionComplete === section.items.length ? 'bg-green-100 text-green-700' : 'bg-gray-200 text-gray-600'}`}>{sectionComplete}/{section.items.length}</span>
            </div>
            <div className="divide-y">
              {section.items.map(item => (
                <label key={item.key} className={`flex items-center gap-3 px-4 py-3 cursor-pointer transition-colors ${checks[item.key] ? 'bg-green-50' : 'hover:bg-gray-50'}`}>
                  <input type="checkbox" checked={!!checks[item.key]} onChange={() => toggle(item.key)} className="accent-green-600 w-5 h-5 rounded" />
                  <span className={`text-sm ${checks[item.key] ? 'line-through text-gray-400' : ''}`}>{item.label}</span>
                </label>
              ))}
            </div>
          </div>
        );
      })}

      <button onClick={handleSubmit} disabled={!admissionId || !patientId || saving} className={`w-full py-3 rounded-lg font-semibold text-white ${admissionId && patientId ? (isReady ? 'bg-green-600 hover:bg-green-700' : 'bg-blue-600 hover:bg-blue-700') : 'bg-gray-300 cursor-not-allowed'}`}>
        {saving ? 'Saving...' : saved ? '✅ Saved!' : isReady ? '🎉 Save — Patient Discharge Ready!' : `Save Progress (${completed}/${total})`}
      </button>
    </div>
  );
}
