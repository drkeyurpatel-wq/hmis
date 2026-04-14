// @ts-nocheck
'use client';
import { useState, useMemo } from 'react';

const SUBSCALES = [
  { key: 'sensory_perception', label: 'Sensory Perception', desc: 'Ability to respond meaningfully to pressure-related discomfort', max: 4,
    options: [
      { value: 1, label: 'Completely Limited', desc: 'Unresponsive to painful stimuli. Cannot feel pain over most of body.' },
      { value: 2, label: 'Very Limited', desc: 'Responds only to painful stimuli. Cannot communicate discomfort except by moaning.' },
      { value: 3, label: 'Slightly Limited', desc: 'Responds to verbal commands but cannot always communicate discomfort.' },
      { value: 4, label: 'No Impairment', desc: 'Responds to verbal commands. Has no sensory deficit.' }
    ] },
  { key: 'moisture', label: 'Moisture', desc: 'Degree to which skin is exposed to moisture', max: 4,
    options: [
      { value: 1, label: 'Constantly Moist', desc: 'Skin kept moist almost constantly. Dampness detected every time repositioned.' },
      { value: 2, label: 'Very Moist', desc: 'Skin often but not always moist. Linen changed at least once per shift.' },
      { value: 3, label: 'Occasionally Moist', desc: 'Skin occasionally moist. Extra linen change approximately once per day.' },
      { value: 4, label: 'Rarely Moist', desc: 'Skin usually dry. Linen only requires changing at routine intervals.' }
    ] },
  { key: 'activity', label: 'Activity', desc: 'Degree of physical activity', max: 4,
    options: [
      { value: 1, label: 'Bedfast', desc: 'Confined to bed.' },
      { value: 2, label: 'Chairfast', desc: 'Ability to walk severely limited or nonexistent. Cannot bear own weight.' },
      { value: 3, label: 'Walks Occasionally', desc: 'Walks occasionally during day but very short distances.' },
      { value: 4, label: 'Walks Frequently', desc: 'Walks outside room at least twice per day and inside room at least every 2 hours.' }
    ] },
  { key: 'mobility', label: 'Mobility', desc: 'Ability to change and control body position', max: 4,
    options: [
      { value: 1, label: 'Completely Immobile', desc: 'Does not make even slight changes in body or extremity position without assistance.' },
      { value: 2, label: 'Very Limited', desc: 'Makes occasional slight changes in body or extremity position but unable to make frequent or significant changes.' },
      { value: 3, label: 'Slightly Limited', desc: 'Makes frequent though slight changes in body or extremity position independently.' },
      { value: 4, label: 'No Limitations', desc: 'Makes major and frequent changes in position without assistance.' }
    ] },
  { key: 'nutrition', label: 'Nutrition', desc: 'Usual food intake pattern', max: 4,
    options: [
      { value: 1, label: 'Very Poor', desc: 'Never eats a complete meal. Rarely eats more than 1/3 of any food offered. Protein intake < 2 servings/day.' },
      { value: 2, label: 'Probably Inadequate', desc: 'Rarely eats a complete meal. Generally eats only about 1/2 of any food offered. Protein intake 3 servings/day.' },
      { value: 3, label: 'Adequate', desc: 'Eats over half of most meals. Eats 4+ servings of protein/day. Occasionally refuses a meal.' },
      { value: 4, label: 'Excellent', desc: 'Eats most of every meal. Never refuses a meal. Usually eats 4+ servings of protein/day.' }
    ] },
  { key: 'friction_shear', label: 'Friction & Shear', desc: 'Resistance to sliding in bed', max: 3,
    options: [
      { value: 1, label: 'Problem', desc: 'Requires moderate to maximum assistance in moving. Complete lifting without sliding against sheets impossible. Frequently slides down in bed.' },
      { value: 2, label: 'Potential Problem', desc: 'Moves feebly or requires minimum assistance. Probably slides to some degree with repositioning.' },
      { value: 3, label: 'No Apparent Problem', desc: 'Moves in bed and chair independently. Has sufficient muscle strength to lift up completely during move.' }
    ] },
];

export default function BradenScale() {
  const centreId = 'c0000001-0000-0000-0000-000000000001';
  const [admissionId, setAdmissionId] = useState('');
  const [patientId, setPatientId] = useState('');
  const [scores, setScores] = useState<Record<string, number>>({});
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [history, setHistory] = useState<any[]>([]);

  const totalScore = useMemo(() => Object.values(scores).reduce((s, v) => s + v, 0), [scores]);
  const riskLevel = totalScore <= 9 ? 'VERY_HIGH' : totalScore <= 12 ? 'HIGH' : totalScore <= 14 ? 'MODERATE' : totalScore <= 18 ? 'LOW' : 'NOT_AT_RISK';
  const allAnswered = SUBSCALES.every(s => scores[s.key] !== undefined);

  const riskColors: Record<string, string> = {
    VERY_HIGH: 'bg-red-100 text-red-800 border-red-400',
    HIGH: 'bg-orange-100 text-orange-800 border-orange-400',
    MODERATE: 'bg-amber-100 text-amber-800 border-amber-400',
    LOW: 'bg-yellow-100 text-yellow-800 border-yellow-300',
    NOT_AT_RISK: 'bg-green-100 text-green-800 border-green-300',
  };

  const handleSubmit = async () => {
    if (!admissionId || !patientId || !allAnswered) return;
    setSaving(true);
    const body = { centre_id: centreId, admission_id: admissionId, patient_id: patientId, ...scores };
    const res = await fetch('/api/ipd/pressure-risk', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    if (res.ok) { setSaved(true); setTimeout(() => setSaved(false), 3000); setScores({}); }
    setSaving(false);
  };

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Braden Scale for Pressure Ulcer Risk</h1>
        <p className="text-sm text-gray-500">6-subscale validated assessment • Score range: 6–23 (lower = higher risk) • Auto-creates prevention care plan for HIGH/VERY HIGH</p>
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

      <div className="space-y-5">
        {SUBSCALES.map((sub, idx) => (
          <div key={sub.key} className="border rounded-lg overflow-hidden">
            <div className="bg-gray-50 px-4 py-3 flex items-center gap-3">
              <span className="text-xs font-bold bg-blue-600 text-white rounded-full w-6 h-6 flex items-center justify-center">{idx + 1}</span>
              <div>
                <div className="font-semibold text-sm">{sub.label}</div>
                <p className="text-xs text-gray-500">{sub.desc}</p>
              </div>
              {scores[sub.key] !== undefined && (
                <span className={`ml-auto text-sm font-bold px-2 py-0.5 rounded ${scores[sub.key] <= 1 ? 'bg-red-100 text-red-700' : scores[sub.key] <= 2 ? 'bg-amber-100 text-amber-700' : 'bg-green-100 text-green-700'}`}>{scores[sub.key]}/{sub.max}</span>
              )}
            </div>
            <div className="divide-y">
              {sub.options.map(opt => (
                <label key={opt.value} className={`flex items-start gap-3 px-4 py-3 cursor-pointer transition-colors ${scores[sub.key] === opt.value ? 'bg-blue-50 ring-inset ring-1 ring-blue-200' : 'hover:bg-gray-50'}`}>
                  <input type="radio" name={sub.key} checked={scores[sub.key] === opt.value} onChange={() => setScores(prev => ({ ...prev, [sub.key]: opt.value }))} className="accent-blue-600 mt-0.5" />
                  <div className="flex-1">
                    <div className="text-sm font-medium">{opt.value}. {opt.label}</div>
                    <p className="text-xs text-gray-500 mt-0.5">{opt.desc}</p>
                  </div>
                </label>
              ))}
            </div>
          </div>
        ))}
      </div>

      <div className={`border-2 rounded-xl p-6 text-center ${riskColors[riskLevel] || 'bg-gray-100'}`}>
        <div className="text-5xl font-black">{allAnswered ? totalScore : '—'}</div>
        <div className="text-lg font-bold mt-1">{allAnswered ? riskLevel.replace(/_/g, ' ') + ' RISK' : 'Complete all 6 subscales'}</div>
        <div className="flex justify-center gap-2 mt-3 text-xs flex-wrap">
          <span className="bg-red-200 px-2 py-0.5 rounded">≤9: VERY HIGH</span>
          <span className="bg-orange-200 px-2 py-0.5 rounded">10–12: HIGH</span>
          <span className="bg-amber-200 px-2 py-0.5 rounded">13–14: MODERATE</span>
          <span className="bg-yellow-200 px-2 py-0.5 rounded">15–18: LOW</span>
          <span className="bg-green-200 px-2 py-0.5 rounded">19–23: NOT AT RISK</span>
        </div>
      </div>

      <button onClick={handleSubmit} disabled={!allAnswered || !admissionId || !patientId || saving} className={`w-full py-3 rounded-lg font-semibold text-white ${allAnswered && admissionId && patientId ? 'bg-blue-600 hover:bg-blue-700' : 'bg-gray-300 cursor-not-allowed'}`}>
        {saving ? 'Saving...' : saved ? '✅ Saved! Prevention care plan auto-generated.' : `Save Assessment${allAnswered ? ` (Score: ${totalScore})` : ''}`}
      </button>
    </div>
  );
}
