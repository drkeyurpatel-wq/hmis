'use client';
import { useEffect, useState, useMemo } from 'react';

const ITEMS = [
  { key: 'history_of_falling', label: 'History of Falling', desc: 'Has fallen during this admission or has immediate history of physiological falls (seizures, impaired gait) before admission', options: [{ label: 'No', value: 0 }, { label: 'Yes', value: 25 }] },
  { key: 'secondary_diagnosis', label: 'Secondary Diagnosis', desc: 'More than one medical diagnosis listed in the chart', options: [{ label: 'No', value: 0 }, { label: 'Yes', value: 15 }] },
  { key: 'ambulatory_aid', label: 'Ambulatory Aid', desc: 'Type of walking aid used by the patient', options: [{ label: 'None / Bed rest / Nurse assist', value: 0 }, { label: 'Crutches / Cane / Walker', value: 15 }, { label: 'Furniture (clutching furniture for support)', value: 30 }] },
  { key: 'iv_heparin_lock', label: 'IV / Heparin Lock', desc: 'Patient has intravenous line or heparin lock in place', options: [{ label: 'No', value: 0 }, { label: 'Yes', value: 20 }] },
  { key: 'gait', label: 'Gait / Transferring', desc: 'Assessment of patient gait and transfer ability', options: [{ label: 'Normal / Bed rest / Wheelchair', value: 0 }, { label: 'Weak (requires assistance)', value: 10 }, { label: 'Impaired (shuffling, short steps, propelling wheelchair)', value: 20 }] },
  { key: 'mental_status', label: 'Mental Status', desc: 'Patient overestimates own abilities or forgets limitations', options: [{ label: 'Oriented to own ability (knows limitations)', value: 0 }, { label: 'Overestimates ability / Forgets limitations', value: 15 }] },
];

export default function MorseFallScale() {
  const centreId = 'c0000001-0000-0000-0000-000000000001';
  const [admissionId, setAdmissionId] = useState('');
  const [patientId, setPatientId] = useState('');
  const [patientName, setPatientName] = useState('');
  const [scores, setScores] = useState<Record<string, number>>({});
  const [history, setHistory] = useState<any[]>([]);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [admissions, setAdmissions] = useState<any[]>([]);
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    // Load active admissions for patient selection
    fetch(`/api/ipd/dashboard?centre_id=${centreId}`).then(r => r.json());
  }, []);

  const totalScore = useMemo(() => Object.values(scores).reduce((s, v) => s + v, 0), [scores]);
  const riskLevel = totalScore >= 45 ? 'HIGH' : totalScore >= 25 ? 'MODERATE' : 'LOW';
  const riskColor = riskLevel === 'HIGH' ? 'bg-red-100 text-red-800 border-red-300' : riskLevel === 'MODERATE' ? 'bg-amber-100 text-amber-800 border-amber-300' : 'bg-green-100 text-green-800 border-green-300';
  const allAnswered = ITEMS.every(item => scores[item.key] !== undefined);

  const loadHistory = async (aid: string) => {
    const data = await fetch(`/api/ipd/fall-risk?admission_id=${aid}`).then(r => r.json());
    setHistory(data);
  };

  const handleSubmit = async () => {
    if (!admissionId || !patientId || !allAnswered) return;
    setSaving(true);
    const body = { centre_id: centreId, admission_id: admissionId, patient_id: patientId, ...scores };
    const res = await fetch('/api/ipd/fall-risk', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    if (res.ok) { setSaved(true); loadHistory(admissionId); setScores({}); setTimeout(() => setSaved(false), 3000); }
    setSaving(false);
  };

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Morse Fall Scale Assessment</h1>
        <p className="text-sm text-gray-500">6-item validated fall risk assessment tool • Score range: 0–125 • Auto-triggers quality incident + care plan for HIGH risk</p>
      </div>

      <div className="border rounded-lg p-4 space-y-3">
        <h3 className="font-semibold text-sm">Patient Selection</h3>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-xs text-gray-500 block mb-1">Admission ID</label>
            <input type="text" value={admissionId} onChange={e => { setAdmissionId(e.target.value); if (e.target.value.length === 36) loadHistory(e.target.value); }} placeholder="Paste admission UUID" className="w-full border rounded px-3 py-2 text-sm" />
          </div>
          <div>
            <label className="text-xs text-gray-500 block mb-1">Patient ID</label>
            <input type="text" value={patientId} onChange={e => setPatientId(e.target.value)} placeholder="Paste patient UUID" className="w-full border rounded px-3 py-2 text-sm" />
          </div>
        </div>
      </div>

      <div className="space-y-4">
        {ITEMS.map((item, idx) => (
          <div key={item.key} className="border rounded-lg p-4">
            <div className="flex items-start gap-3">
              <span className="text-xs font-bold bg-gray-200 rounded-full w-6 h-6 flex items-center justify-center shrink-0 mt-0.5">{idx + 1}</span>
              <div className="flex-1">
                <div className="font-semibold text-sm">{item.label}</div>
                <p className="text-xs text-gray-500 mt-0.5">{item.desc}</p>
                <div className="mt-3 space-y-2">
                  {item.options.map(opt => (
                    <label key={opt.value} className={`flex items-center gap-3 p-2.5 rounded-lg border cursor-pointer transition-colors ${scores[item.key] === opt.value ? 'border-blue-500 bg-blue-50 ring-1 ring-blue-200' : 'hover:bg-gray-50'}`}>
                      <input type="radio" name={item.key} checked={scores[item.key] === opt.value} onChange={() => setScores(prev => ({ ...prev, [item.key]: opt.value }))} className="accent-blue-600" />
                      <span className="text-sm flex-1">{opt.label}</span>
                      <span className={`text-xs font-bold px-2 py-0.5 rounded ${opt.value > 0 ? 'bg-red-100 text-red-700' : 'bg-green-100 text-green-700'}`}>{opt.value}</span>
                    </label>
                  ))}
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className={`border-2 rounded-xl p-6 text-center ${riskColor}`}>
        <div className="text-5xl font-black">{totalScore}</div>
        <div className="text-lg font-bold mt-1">{riskLevel} RISK</div>
        <div className="text-xs mt-2">
          {riskLevel === 'HIGH' && '⚠️ Implement HIGH-risk fall prevention protocol. Auto-creates quality incident + 6-intervention care plan.'}
          {riskLevel === 'MODERATE' && 'Standard fall prevention interventions required.'}
          {riskLevel === 'LOW' && 'No specific fall prevention interventions needed. Good basic precautions.'}
        </div>
        <div className="flex justify-center gap-4 mt-3 text-xs">
          <span className="bg-green-200 px-2 py-0.5 rounded">0–24: LOW</span>
          <span className="bg-amber-200 px-2 py-0.5 rounded">25–44: MODERATE</span>
          <span className="bg-red-200 px-2 py-0.5 rounded">≥45: HIGH</span>
        </div>
      </div>

      <button onClick={handleSubmit} disabled={!allAnswered || !admissionId || !patientId || saving} className={`w-full py-3 rounded-lg font-semibold text-white ${allAnswered && admissionId && patientId ? 'bg-blue-600 hover:bg-blue-700' : 'bg-gray-300 cursor-not-allowed'}`}>
        {saving ? 'Saving...' : saved ? '✅ Saved! Care plan auto-generated.' : `Save Assessment (Score: ${totalScore} — ${riskLevel})`}
      </button>

      {history.length > 0 && (
        <div className="border rounded-lg">
          <div className="bg-gray-50 px-4 py-2 font-semibold text-sm">Assessment History ({history.length})</div>
          <div className="divide-y">{history.map(h => (
            <div key={h.id} className="px-4 py-2 flex items-center justify-between text-sm">
              <div>
                <span className={`text-xs px-2 py-0.5 rounded font-medium ${h.risk_level === 'HIGH' ? 'bg-red-100 text-red-800' : h.risk_level === 'MODERATE' ? 'bg-amber-100 text-amber-800' : 'bg-green-100 text-green-800'}`}>{h.risk_level}</span>
                <span className="ml-2 font-bold">{h.total_score}/125</span>
              </div>
              <span className="text-xs text-gray-500">{new Date(h.assessed_at).toLocaleString()}</span>
            </div>
          ))}</div>
        </div>
      )}
    </div>
  );
}
