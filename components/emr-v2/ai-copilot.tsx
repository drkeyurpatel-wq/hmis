// components/emr-v2/ai-copilot.tsx
'use client';

import React, { useState, useCallback, useEffect, useMemo } from 'react';
import { createPortal } from 'react-dom';
import {
  getDifferentialDiagnosis, reviewPrescription, getCopilotSuggestions,
  type DDxResult, type RxReviewResult, type CopilotResult,
} from '@/lib/cdss/ai-engine';
import { checkDrugInteractions, validateDose } from '@/lib/cdss/engine';
import { checkAllergyConflict } from '@/lib/cdss/allergies';

interface CopilotProps {
  patient: { name: string; age: number | string; gender: string; allergies: string[] };
  vitals: any;
  complaints: string[];
  examFindings: any[];
  diagnoses: { code: string; label: string; type: string }[];
  investigations: any[];
  prescriptions: any[];
  advice: string[];
  followUp: string;
  isOpen: boolean;
  onClose: () => void;
  onAddDiagnosis?: (dx: { code: string; label: string }) => void;
  onAddInvestigation?: (name: string) => void;
}

type Tab = 'ddx' | 'rx' | 'copilot';

export default function AICopilot({
  patient, vitals, complaints, examFindings, diagnoses,
  investigations, prescriptions, advice, followUp,
  isOpen, onClose,
  onAddDiagnosis, onAddInvestigation,
}: CopilotProps) {
  const [tab, setTab] = useState<Tab>('copilot');
  const [ddxResult, setDdxResult] = useState<DDxResult | null>(null);
  const [rxResult, setRxResult] = useState<RxReviewResult | null>(null);
  const [copilotResult, setCopilotResult] = useState<CopilotResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const runDDx = useCallback(async () => {
    setLoading(true); setError(''); setTab('ddx');
    const { result, error: err } = await getDifferentialDiagnosis({
      age: patient.age, gender: patient.gender,
      complaints, vitals, examFindings, allergies: patient.allergies,
    });
    if (err) setError(err);
    else if (result) setDdxResult(result);
    setLoading(false);
  }, [patient, complaints, vitals, examFindings]);

  const runRxReview = useCallback(async () => {
    if (prescriptions.length === 0) { setError('No prescriptions to review'); return; }
    setLoading(true); setError(''); setTab('rx');
    const { result, error: err } = await reviewPrescription({
      age: patient.age, gender: patient.gender, allergies: patient.allergies,
      vitals, diagnoses, prescriptions,
    });
    if (err) setError(err);
    else if (result) setRxResult(result);
    setLoading(false);
  }, [patient, vitals, diagnoses, prescriptions]);

  const runCopilot = useCallback(async () => {
    setLoading(true); setError(''); setTab('copilot');
    const { result, error: err } = await getCopilotSuggestions({
      age: patient.age, gender: patient.gender,
      complaints, vitals, examFindings, diagnoses,
      investigations, prescriptions, advice, followUp,
    });
    if (err) setError(err);
    else if (result) setCopilotResult(result);
    setLoading(false);
  }, [patient, complaints, vitals, examFindings, diagnoses, investigations, prescriptions, advice, followUp]);

  // Local CDSS checks — instant, no API call needed
  const localRxAlerts = useMemo(() => {
    if (prescriptions.length === 0) return [];
    const alerts: { type: string; severity: string; drug: string; message: string }[] = [];
    const drugNames = prescriptions.map((p: any) => p.generic || p.drug);

    // Drug interactions (engine.ts — 50 critical pairs)
    const interactions = checkDrugInteractions(drugNames);
    for (const ix of interactions) {
      alerts.push({
        type: 'interaction', drug: `${ix.drug_a} + ${ix.drug_b}`,
        severity: ix.severity === 'contraindicated' ? 'critical' : ix.severity === 'severe' ? 'critical' : 'warning',
        message: `${ix.description}. ${ix.recommendation}`,
      });
    }

    // Allergy conflicts (allergies.ts cross-reference)
    for (const rx of prescriptions) {
      const medName = (rx as any).generic || (rx as any).drug;
      const conflicts = checkAllergyConflict(patient.allergies, medName);
      for (const c of conflicts) {
        alerts.push({
          type: 'allergy', drug: (rx as any).drug,
          severity: c.severity === 'contraindicated' ? 'critical' : 'warning',
          message: c.warning,
        });
      }
    }

    // Dose validation (engine.ts — 19 common meds)
    for (const rx of prescriptions) {
      const medName = (rx as any).generic || (rx as any).drug;
      const doseStr = (rx as any).dose || '';
      const match = doseStr.match(/([\d.]+)\s*(mg|g|mcg)/i);
      if (match) {
        let doseMg = parseFloat(match[1]);
        const unit = match[2].toLowerCase();
        if (unit === 'g') doseMg *= 1000;
        if (unit === 'mcg') doseMg /= 1000;
        const freq = (rx as any).frequency || '';
        let daily = 1;
        if (freq.startsWith('BD')) daily = 2;
        else if (freq.startsWith('TDS')) daily = 3;
        else if (freq.startsWith('QID')) daily = 4;
        else if (freq.startsWith('Q4H')) daily = 6;
        else if (freq.startsWith('Q6H')) daily = 4;
        else if (freq.startsWith('Q8H')) daily = 3;
        const route = (rx as any).route || 'Oral';
        const doseAlerts = validateDose(medName, doseMg, route, daily);
        for (const da of doseAlerts) {
          if (da.severity !== 'info') {
            alerts.push({ type: 'dose', drug: (rx as any).drug, severity: da.severity, message: da.message });
          }
        }
      }
    }

    return alerts;
  }, [prescriptions, patient.allergies]);

  const scoreColor = (s: string) =>
    s === 'safe' ? 'bg-green-100 text-green-800' :
    s === 'caution' ? 'bg-yellow-100 text-yellow-800' :
    s === 'warning' ? 'bg-orange-100 text-orange-800' :
    'bg-red-100 text-red-800';

  const priorityColor = (p: string) =>
    p === 'high' ? 'text-red-600' : p === 'medium' ? 'text-orange-600' : 'text-blue-600';

  const severityIcon = (s: string) =>
    s === 'critical' ? '🔴' : s === 'warning' ? '🟡' : 'ℹ️';

  const probColor = (p: string) =>
    p === 'high' ? 'bg-red-100 text-red-700' : p === 'moderate' ? 'bg-yellow-100 text-yellow-700' : 'bg-gray-100 text-gray-600';

  // Portal mount — ensures we render to document.body so fixed positioning isn't clipped
  const [mounted, setMounted] = useState(false);
  useEffect(() => { setMounted(true); }, []);
  if (!mounted || !isOpen) return null;

  return createPortal(
    <div className="fixed right-0 top-0 h-screen w-[380px] bg-white border-l border-gray-200 z-[9999] flex flex-col shadow-2xl">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b bg-gradient-to-r from-purple-50 to-blue-50">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-purple-600 to-blue-600 flex items-center justify-center">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5"><path d="M12 2a5 5 0 0 1 5 5v3a5 5 0 0 1-10 0V7a5 5 0 0 1 5-5z"/><path d="M7 13a7 7 0 0 0 10 0"/></svg>
          </div>
          <div>
            <span className="text-sm font-semibold text-gray-900">AI Copilot</span>
            <span className="text-[10px] text-gray-400 ml-1.5">Claude Sonnet</span>
          </div>
        </div>
        <button onClick={onClose} className="w-7 h-7 rounded-lg hover:bg-gray-100 flex items-center justify-center text-gray-400">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 6 6 18M6 6l12 12"/></svg>
        </button>
      </div>

      {/* Tab bar */}
      <div className="flex border-b">
        {([
          ['ddx', 'DDx', runDDx],
          ['rx', 'Rx Review', runRxReview],
          ['copilot', 'Copilot', runCopilot],
        ] as [Tab, string, () => void][]).map(([k, l, fn]) => (
          <button key={k} onClick={() => { setTab(k); fn(); }}
            className={`flex-1 py-2.5 text-xs font-medium border-b-2 transition-colors ${tab === k ? 'border-purple-600 text-purple-700 bg-purple-50/50' : 'border-transparent text-gray-500 hover:text-gray-700'}`}>{l}</button>
        ))}
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-4">
        {loading && (
          <div className="flex flex-col items-center justify-center py-12">
            <div className="w-8 h-8 border-2 border-purple-600 border-t-transparent rounded-full animate-spin mb-3" />
            <span className="text-xs text-gray-400">
              {tab === 'ddx' ? 'Analyzing differentials...' : tab === 'rx' ? 'Reviewing prescriptions...' : 'Analyzing encounter...'}
            </span>
          </div>
        )}

        {error && !loading && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-xs text-red-700">{error}</div>
        )}

        {/* ===== DDx Results ===== */}
        {tab === 'ddx' && ddxResult && !loading && (
          <div className="space-y-3">
            {/* Clinical reasoning */}
            <div className="bg-blue-50 rounded-lg p-3">
              <div className="text-xs font-medium text-blue-800 mb-1">Clinical reasoning</div>
              <div className="text-xs text-blue-700">{ddxResult.clinical_reasoning}</div>
            </div>

            {/* Differentials */}
            <div className="text-xs font-medium text-gray-500 mb-1">Differential diagnoses</div>
            {ddxResult.differentials.map((d, i) => (
              <div key={i} className="border rounded-lg p-3 hover:border-purple-300 transition-colors">
                <div className="flex items-center justify-between mb-1">
                  <div className="flex items-center gap-2">
                    <span className="w-5 h-5 rounded-full bg-purple-100 text-purple-700 text-[10px] font-bold flex items-center justify-center">{d.rank}</span>
                    <span className="text-sm font-medium">{d.diagnosis}</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${probColor(d.probability)}`}>{d.probability}</span>
                    <span className="font-mono text-[10px] text-blue-600">{d.icd10}</span>
                  </div>
                </div>
                <div className="text-xs text-gray-600 mb-1">{d.reasoning}</div>
                <div className="text-[10px] text-gray-400">{d.distinguishing}</div>
                {onAddDiagnosis && (
                  <button onClick={() => onAddDiagnosis({ code: d.icd10, label: d.diagnosis })}
                    className="mt-1.5 text-[10px] text-purple-600 hover:text-purple-800 font-medium">+ Add to encounter</button>
                )}
              </div>
            ))}

            {/* Recommended investigations */}
            {ddxResult.recommended_investigations.length > 0 && (
              <div>
                <div className="text-xs font-medium text-gray-500 mb-1.5">Recommended investigations</div>
                <div className="flex flex-wrap gap-1.5">
                  {ddxResult.recommended_investigations.map((inv, i) => (
                    <button key={i} onClick={() => onAddInvestigation?.(inv)}
                      className="px-2 py-1 bg-blue-50 text-blue-700 text-[10px] rounded-lg border border-blue-200 hover:bg-blue-100 transition-colors">
                      + {inv}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Red flags */}
            {ddxResult.red_flags.length > 0 && (
              <div className="bg-red-50 border border-red-200 rounded-lg p-3">
                <div className="text-xs font-medium text-red-800 mb-1">Red flags</div>
                {ddxResult.red_flags.map((f, i) => (
                  <div key={i} className="text-xs text-red-700 flex items-start gap-1.5 mt-1">
                    <span className="text-red-500 mt-0.5">!</span>{f}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ===== Local CDSS Alerts (instant, no API) ===== */}
        {tab === 'rx' && !loading && localRxAlerts.length > 0 && (
          <div className="space-y-2 mb-3">
            <div className="text-xs font-medium text-gray-500">Local CDSS Analysis (instant)</div>
            {localRxAlerts.filter(a => a.severity === 'critical').map((a, i) => (
              <div key={`crit-${i}`} className="bg-red-50 border border-red-300 rounded-lg p-2.5">
                <div className="flex items-center gap-1.5 mb-0.5">
                  <span className="text-sm">🔴</span>
                  <span className="text-xs font-bold text-red-700">{a.drug}</span>
                  <span className="text-[10px] px-1.5 py-0.5 rounded bg-red-100 text-red-700">{a.type}</span>
                </div>
                <div className="text-xs text-red-600">{a.message}</div>
              </div>
            ))}
            {localRxAlerts.filter(a => a.severity === 'warning').map((a, i) => (
              <div key={`warn-${i}`} className="bg-amber-50 border border-amber-200 rounded-lg p-2.5">
                <div className="flex items-center gap-1.5 mb-0.5">
                  <span className="text-sm">🟡</span>
                  <span className="text-xs font-medium text-amber-700">{a.drug}</span>
                  <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-100 text-amber-700">{a.type}</span>
                </div>
                <div className="text-xs text-amber-600">{a.message}</div>
              </div>
            ))}
          </div>
        )}

        {tab === 'rx' && !loading && localRxAlerts.length === 0 && prescriptions.length > 0 && !rxResult && (
          <div className="bg-green-50 rounded-lg p-3 mb-3 text-xs text-green-700 font-medium text-center">No local CDSS issues detected</div>
        )}

        {/* ===== Rx Review Results ===== */}
        {tab === 'rx' && rxResult && !loading && (
          <div className="space-y-3">
            {/* Overall score */}
            <div className={`rounded-lg p-3 ${scoreColor(rxResult.overall_score)}`}>
              <div className="flex items-center justify-between">
                <span className="text-sm font-bold capitalize">{rxResult.overall_score}</span>
                <span className="text-xs">{rxResult.issues.length} issue{rxResult.issues.length !== 1 ? 's' : ''} found</span>
              </div>
              <div className="text-xs mt-1">{rxResult.summary}</div>
            </div>

            {/* Issues */}
            {rxResult.issues.length > 0 && (
              <div>
                <div className="text-xs font-medium text-gray-500 mb-1.5">Issues</div>
                {rxResult.issues.map((issue, i) => (
                  <div key={i} className="border rounded-lg p-2.5 mb-2">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-sm">{severityIcon(issue.severity)}</span>
                      <span className="text-xs font-medium">{issue.drug}</span>
                      <span className={`text-[10px] px-1.5 py-0.5 rounded ${issue.severity === 'critical' ? 'bg-red-100 text-red-700' : issue.severity === 'warning' ? 'bg-yellow-100 text-yellow-700' : 'bg-blue-100 text-blue-700'}`}>{issue.type}</span>
                    </div>
                    <div className="text-xs text-gray-600">{issue.message}</div>
                  </div>
                ))}
              </div>
            )}

            {/* Missing medications */}
            {rxResult.missing_medications.length > 0 && (
              <div>
                <div className="text-xs font-medium text-gray-500 mb-1.5">Consider adding</div>
                {rxResult.missing_medications.map((m, i) => (
                  <div key={i} className="bg-orange-50 border border-orange-200 rounded-lg p-2.5 mb-2">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-medium text-orange-800">{m.drug}</span>
                      <span className={`text-[10px] px-1.5 py-0.5 rounded ${m.urgency === 'required' ? 'bg-red-100 text-red-700' : m.urgency === 'recommended' ? 'bg-orange-100 text-orange-700' : 'bg-gray-100 text-gray-600'}`}>{m.urgency}</span>
                    </div>
                    <div className="text-[10px] text-orange-700 mt-0.5">{m.reason}</div>
                  </div>
                ))}
              </div>
            )}

            {rxResult.issues.length === 0 && rxResult.missing_medications.length === 0 && (
              <div className="text-center py-6 text-green-600 text-sm font-medium">Prescription looks good</div>
            )}
          </div>
        )}

        {/* ===== Copilot Results ===== */}
        {tab === 'copilot' && copilotResult && !loading && (
          <div className="space-y-3">
            {/* Completeness score */}
            <div className="bg-gray-50 rounded-lg p-3">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-medium text-gray-500">Encounter completeness</span>
                <span className={`text-sm font-bold ${copilotResult.completeness.score >= 80 ? 'text-green-600' : copilotResult.completeness.score >= 50 ? 'text-yellow-600' : 'text-red-600'}`}>
                  {copilotResult.completeness.score}%
                </span>
              </div>
              <div className="w-full h-2 bg-gray-200 rounded-full overflow-hidden">
                <div className={`h-full rounded-full transition-all ${copilotResult.completeness.score >= 80 ? 'bg-green-500' : copilotResult.completeness.score >= 50 ? 'bg-yellow-500' : 'bg-red-500'}`}
                  style={{ width: `${copilotResult.completeness.score}%` }} />
              </div>
              {copilotResult.completeness.missing.length > 0 && (
                <div className="mt-2 flex flex-wrap gap-1">
                  {copilotResult.completeness.missing.map((m, i) => (
                    <span key={i} className="px-1.5 py-0.5 bg-red-50 text-red-600 text-[10px] rounded">{m}</span>
                  ))}
                </div>
              )}
            </div>

            {/* Alerts */}
            {copilotResult.alerts.length > 0 && (
              <div className="bg-red-50 border border-red-200 rounded-lg p-3">
                <div className="text-xs font-medium text-red-800 mb-1">Alerts</div>
                {copilotResult.alerts.map((a, i) => (
                  <div key={i} className="text-xs text-red-700 mt-1">! {a}</div>
                ))}
              </div>
            )}

            {/* Suggestions */}
            {copilotResult.suggestions.length > 0 && (
              <div>
                <div className="text-xs font-medium text-gray-500 mb-1.5">Suggestions</div>
                {copilotResult.suggestions.map((s, i) => (
                  <div key={i} className="border rounded-lg p-2.5 mb-2 hover:border-purple-300 transition-colors">
                    <div className="flex items-center gap-2 mb-1">
                      <span className={`text-xs font-medium ${priorityColor(s.priority)}`}>{s.priority.toUpperCase()}</span>
                      <span className={`text-[10px] px-1.5 py-0.5 rounded ${s.category === 'clinical' ? 'bg-blue-100 text-blue-700' : s.category === 'documentation' ? 'bg-purple-100 text-purple-700' : s.category === 'quality' ? 'bg-green-100 text-green-700' : 'bg-orange-100 text-orange-700'}`}>{s.category}</span>
                    </div>
                    <div className="text-xs text-gray-700">{s.message}</div>
                    {s.action && <div className="text-[10px] text-purple-600 mt-1 font-medium">{s.action}</div>}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Empty states */}
        {!loading && !error && tab === 'ddx' && !ddxResult && (
          <div className="text-center py-8">
            <div className="text-3xl mb-2">🔬</div>
            <div className="text-sm font-medium text-gray-700 mb-1">AI Differential Diagnosis</div>
            <div className="text-xs text-gray-400 mb-3">Enter complaints and vitals, then click DDx tab to generate differentials</div>
            <button onClick={runDDx} disabled={complaints.length === 0}
              className="px-4 py-2 bg-purple-600 text-white text-xs rounded-lg disabled:opacity-50 hover:bg-purple-700">
              Generate DDx
            </button>
          </div>
        )}
        {!loading && !error && tab === 'rx' && !rxResult && (
          <div className="text-center py-8">
            <div className="text-3xl mb-2">💊</div>
            <div className="text-sm font-medium text-gray-700 mb-1">AI Prescription Review</div>
            <div className="text-xs text-gray-400 mb-3">Add diagnoses and prescriptions, then click to review</div>
            <button onClick={runRxReview} disabled={prescriptions.length === 0}
              className="px-4 py-2 bg-purple-600 text-white text-xs rounded-lg disabled:opacity-50 hover:bg-purple-700">
              Review Rx
            </button>
          </div>
        )}
        {!loading && !error && tab === 'copilot' && !copilotResult && (
          <div className="text-center py-8">
            <div className="text-3xl mb-2">🤖</div>
            <div className="text-sm font-medium text-gray-700 mb-1">AI Clinical Copilot</div>
            <div className="text-xs text-gray-400 mb-3">Analyzes your encounter and suggests next steps</div>
            <button onClick={runCopilot}
              className="px-4 py-2 bg-purple-600 text-white text-xs rounded-lg hover:bg-purple-700">
              Analyze Encounter
            </button>
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="px-4 py-2 border-t bg-gray-50 text-[10px] text-gray-400 text-center">
        AI suggestions are advisory only — clinical judgment takes precedence
      </div>
    </div>,
    document.body
  );
}
