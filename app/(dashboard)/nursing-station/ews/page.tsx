// @ts-nocheck
'use client';
import { useEffect, useState } from 'react';

const scoreColor = (s: number) => s >= 3 ? 'bg-red-600 text-white' : s >= 2 ? 'bg-orange-500 text-white' : s >= 1 ? 'bg-yellow-400 text-black' : 'bg-green-200 text-green-800';
const riskBadge: Record<string, string> = { HIGH: 'bg-red-600 text-white', MEDIUM: 'bg-orange-500 text-white', LOW_SINGLE: 'bg-amber-400 text-black', LOW: 'bg-yellow-200 text-yellow-800', NONE: 'bg-green-200 text-green-800' };

export default function EWSPage() {
  const centreId = 'c0000001-0000-0000-0000-000000000001';
  const [admissionId, setAdmissionId] = useState('');
  const [scores, setScores] = useState<any[]>([]);
  const [alerts, setAlerts] = useState<any[]>([]);

  useEffect(() => { fetch(`/api/ipd/ews?centre_id=${centreId}`).then(r => r.json()).then(setAlerts); }, []);

  const loadPatient = async (aid: string) => {
    setAdmissionId(aid);
    const data = await fetch(`/api/ipd/ews?admission_id=${aid}`).then(r => r.json());
    setScores(data);
  };

  const latest = scores[0];
  const PARAMS = ['resp_rate', 'spo2', 'supplemental_o2', 'temperature', 'bp_systolic', 'heart_rate', 'consciousness'];
  const PARAM_LABELS: Record<string, string> = { resp_rate: 'Resp Rate', spo2: 'SpO₂', supplemental_o2: 'Supplemental O₂', temperature: 'Temperature', bp_systolic: 'Systolic BP', heart_rate: 'Heart Rate', consciousness: 'Consciousness' };

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold">NEWS2 Early Warning Score</h1>
        <p className="text-sm text-gray-500">Auto-calculated from vitals (7 parameters). Triggers escalation at score ≥5 or any single parameter = 3.</p>
      </div>

      <div className="border rounded-lg p-4">
        <label className="text-xs text-gray-500 block mb-1">Admission ID (paste to view patient trend)</label>
        <div className="flex gap-2">
          <input type="text" value={admissionId} onChange={e => setAdmissionId(e.target.value)} placeholder="Paste admission UUID" className="flex-1 border rounded px-3 py-2 text-sm" />
          <button onClick={() => loadPatient(admissionId)} className="px-4 py-2 bg-blue-600 text-white rounded text-sm font-medium hover:bg-blue-700">Load</button>
        </div>
      </div>

      {alerts.length > 0 && (
        <div className="border-2 border-red-300 rounded-xl overflow-hidden">
          <div className="bg-red-50 px-4 py-2 font-bold text-red-800 text-sm">🚨 Pending Escalations ({alerts.length})</div>
          <div className="divide-y">{alerts.map(a => (
            <div key={a.id} className="px-4 py-3 flex items-center justify-between">
              <div>
                <span className={`text-xs px-2 py-0.5 rounded font-bold ${riskBadge[a.clinical_risk] || 'bg-gray-100'}`}>NEWS2: {a.total_score} — {a.clinical_risk}</span>
                <span className="text-xs ml-2 text-gray-500">Patient: {a.patient_id?.slice(0, 8)}...</span>
              </div>
              <span className="text-xs text-gray-500">{new Date(a.calculated_at).toLocaleString()}</span>
            </div>
          ))}</div>
        </div>
      )}

      {latest && (
        <div className={`border-2 rounded-xl p-6 text-center ${riskBadge[latest.clinical_risk] || 'bg-gray-100'}`}>
          <div className="text-5xl font-black">{latest.total_score}</div>
          <div className="text-lg font-bold mt-1">{latest.clinical_risk?.replace(/_/g, ' ')}</div>
          {latest.escalation_required && <div className="mt-2 text-sm font-semibold">⚠️ ESCALATION REQUIRED — Notify registrar/outreach team</div>}
        </div>
      )}

      {latest && (
        <div className="border rounded-lg overflow-hidden">
          <div className="bg-gray-50 px-4 py-2 font-semibold text-sm">Parameter Breakdown (Latest)</div>
          <div className="grid grid-cols-7 divide-x text-center">
            {PARAMS.map(p => {
              const val = latest[p + '_score'];
              return (
                <div key={p} className="py-3">
                  <div className={`text-2xl font-black mx-auto w-10 h-10 rounded-full flex items-center justify-center ${scoreColor(val)}`}>{val}</div>
                  <div className="text-xs text-gray-500 mt-1">{PARAM_LABELS[p]}</div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {scores.length > 1 && (
        <div className="border rounded-lg">
          <div className="bg-gray-50 px-4 py-2 font-semibold text-sm">Score Trend (last {scores.length})</div>
          <div className="p-4 flex items-end gap-1 h-32">
            {scores.slice().reverse().map((s, i) => (
              <div key={s.id} className="flex-1 flex flex-col items-center gap-1">
                <span className="text-xs font-bold">{s.total_score}</span>
                <div className={`w-full rounded-t ${s.total_score >= 7 ? 'bg-red-500' : s.total_score >= 5 ? 'bg-orange-500' : s.total_score >= 1 ? 'bg-yellow-400' : 'bg-green-400'}`} style={{ height: `${Math.max(4, s.total_score * 6)}px` }} />
                <span className="text-[9px] text-gray-400">{new Date(s.calculated_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="border rounded-lg p-4 text-xs text-gray-500 space-y-1">
        <div className="font-semibold text-gray-700 text-sm mb-2">NEWS2 Response Protocol</div>
        <div className="grid grid-cols-2 gap-2">
          <div className="bg-green-50 p-2 rounded"><strong>Score 0:</strong> Routine monitoring (min q12h)</div>
          <div className="bg-yellow-50 p-2 rounded"><strong>Score 1–4:</strong> Increase monitoring (min q4-6h). Inform nurse-in-charge.</div>
          <div className="bg-amber-50 p-2 rounded"><strong>Score 3 (single param):</strong> Urgent review by ward-based doctor within 30 min.</div>
          <div className="bg-orange-50 p-2 rounded"><strong>Score 5–6:</strong> Urgent response. Monitor q1h. Registrar review within 1h.</div>
          <div className="bg-red-50 p-2 rounded col-span-2"><strong>Score ≥7:</strong> EMERGENCY response. Continuous monitoring. Senior clinician/outreach team immediately. Consider ICU transfer.</div>
        </div>
      </div>
    </div>
  );
}
