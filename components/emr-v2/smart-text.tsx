// components/emr-v2/smart-text.tsx
// Auto-detects clinical concepts (ICD-10, medications, complaints) as clinician types
// Pattern: Medplum SmartText (github.com/medplum/medplum)
// Data: Uses existing lib/cdss/diagnoses.ts + lib/cdss/medications.ts — zero duplication
'use client';

import React, { useState, useCallback, useRef, useMemo } from 'react';
import { DIAGNOSES, type DiagnosisEntry } from '@/lib/cdss/diagnoses';
import { MEDICATIONS, type Medication } from '@/lib/cdss/medications';
import { COMPLAINT_TEMPLATES, type ComplaintTemplate } from '@/lib/cdss/complaints';

// ─── Unified Concept Type ────────────────────────────────────────

interface DetectedConcept {
  type: 'diagnosis' | 'medication' | 'complaint';
  code: string;
  label: string;
  matchedOn: string;
  category: string;
  // Carry forward CDSS autofill data
  suggestedMeds?: string[];
  suggestedLabs?: string[];
  suggestedAdvice?: string[];
  examFocus?: string[];
  // Medication details
  brand?: string;
  strength?: string;
}

// ─── Build search index from existing CDSS (runs once) ──────────

function buildSearchIndex() {
  const index: { term: string; concept: DetectedConcept }[] = [];

  // Diagnoses: use existing keywords array
  for (const dx of DIAGNOSES) {
    const allTerms = [dx.label.toLowerCase(), ...dx.keywords];
    for (const term of allTerms) {
      index.push({
        term: term.toLowerCase(),
        concept: {
          type: 'diagnosis',
          code: dx.code,
          label: dx.label,
          matchedOn: term,
          category: dx.category,
          suggestedMeds: dx.suggestedMeds,
          suggestedLabs: dx.suggestedLabs,
          suggestedAdvice: dx.suggestedAdvice,
          examFocus: dx.examFocus,
        },
      });
    }
  }

  // Medications: search by generic, brand, and ID
  for (const med of MEDICATIONS) {
    const terms = [
      med.generic.toLowerCase(),
      med.brand.toLowerCase(),
      med.id.toLowerCase(),
    ];
    for (const term of terms) {
      index.push({
        term,
        concept: {
          type: 'medication',
          code: med.id,
          label: `${med.generic} (${med.brand}) ${med.strength}`,
          matchedOn: term,
          category: med.category,
          brand: med.brand,
          strength: med.strength,
        },
      });
    }
  }

  // Complaints: use existing keywords (includes Gujarati terms)
  for (const tpl of COMPLAINT_TEMPLATES) {
    const terms = [tpl.label.toLowerCase(), ...tpl.keywords];
    for (const term of terms) {
      index.push({
        term: term.toLowerCase(),
        concept: {
          type: 'complaint',
          code: '',
          label: tpl.label,
          matchedOn: term,
          category: 'Complaint',
        },
      });
    }
  }

  return index;
}

// ─── Concept Detector ────────────────────────────────────────────

function detectConcepts(text: string, index: ReturnType<typeof buildSearchIndex>): DetectedConcept[] {
  if (text.length < 3) return [];
  const lower = text.toLowerCase();
  const found: DetectedConcept[] = [];
  const seen = new Set<string>();

  for (const entry of index) {
    if (entry.term.length < 3) continue;
    const idx = lower.indexOf(entry.term);
    if (idx === -1) continue;

    // Word boundary check
    const before = idx === 0 ? ' ' : lower[idx - 1];
    const after = idx + entry.term.length >= lower.length ? ' ' : lower[idx + entry.term.length];
    const isStart = /[\s,.:;()\-\/]/.test(before) || idx === 0;
    const isEnd = /[\s,.:;()\-\/]/.test(after) || idx + entry.term.length === lower.length;

    if (!isStart || !isEnd) continue;

    const key = `${entry.concept.type}:${entry.concept.code || entry.concept.label}`;
    if (seen.has(key)) continue;
    seen.add(key);
    found.push(entry.concept);
  }

  return found;
}

// ─── Component ───────────────────────────────────────────────────

interface SmartTextProps {
  value?: string;
  onChange?: (text: string) => void;
  onConceptDetected?: (concepts: DetectedConcept[]) => void;
  onDiagnosisSelect?: (dx: DetectedConcept) => void;
  onMedicationSelect?: (med: DetectedConcept) => void;
  placeholder?: string;
  rows?: number;
  label?: string;
  /** Show CDSS autofill suggestions (labs, meds, advice) */
  showAutofill?: boolean;
}

export default function SmartText({
  value = '',
  onChange,
  onConceptDetected,
  onDiagnosisSelect,
  onMedicationSelect,
  placeholder = 'Type clinical notes — diagnoses, medications, and complaints auto-detected...',
  rows = 5,
  label = 'Clinical Notes',
  showAutofill = true,
}: SmartTextProps) {
  const [text, setText] = useState(value);
  const [concepts, setConcepts] = useState<DetectedConcept[]>([]);
  const [confirmed, setConfirmed] = useState<Set<string>>(new Set());
  const debounceRef = useRef<ReturnType<typeof setTimeout>>();

  // Build index once from existing CDSS data
  const searchIndex = useMemo(() => buildSearchIndex(), []);

  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLTextAreaElement>) => {
      const newText = e.target.value;
      setText(newText);
      onChange?.(newText);

      if (debounceRef.current) clearTimeout(debounceRef.current);
      debounceRef.current = setTimeout(() => {
        const detected = detectConcepts(newText, searchIndex);
        setConcepts(detected);
        onConceptDetected?.(detected);
      }, 400);
    },
    [onChange, onConceptDetected, searchIndex]
  );

  const confirm = useCallback(
    (c: DetectedConcept) => {
      const key = `${c.type}:${c.code || c.label}`;
      setConfirmed((prev) => new Set([...prev, key]));
      if (c.type === 'diagnosis') onDiagnosisSelect?.(c);
      if (c.type === 'medication') onMedicationSelect?.(c);
    },
    [onDiagnosisSelect, onMedicationSelect]
  );

  const dismiss = useCallback((c: DetectedConcept) => {
    const key = `${c.type}:${c.code || c.label}`;
    setConcepts((prev) => prev.filter((x) => `${x.type}:${x.code || x.label}` !== key));
  }, []);

  // Group concepts by type
  const grouped = useMemo(() => {
    const dx = concepts.filter((c) => c.type === 'diagnosis');
    const rx = concepts.filter((c) => c.type === 'medication');
    const cx = concepts.filter((c) => c.type === 'complaint');
    return { dx, rx, cx };
  }, [concepts]);

  // Aggregate autofill suggestions from all confirmed diagnoses
  const autofill = useMemo(() => {
    if (!showAutofill) return null;
    const confirmedDx = concepts.filter(
      (c) => c.type === 'diagnosis' && confirmed.has(`diagnosis:${c.code}`)
    );
    if (confirmedDx.length === 0) return null;

    const labs = new Set<string>();
    const meds = new Set<string>();
    const advice = new Set<string>();
    for (const dx of confirmedDx) {
      dx.suggestedLabs?.forEach((l) => labs.add(l));
      dx.suggestedMeds?.forEach((m) => meds.add(m));
      dx.suggestedAdvice?.forEach((a) => advice.add(a));
    }
    return {
      labs: Array.from(labs),
      meds: Array.from(meds),
      advice: Array.from(advice),
    };
  }, [concepts, confirmed, showAutofill]);

  const typeConfig = {
    diagnosis:  { badge: 'Dx', bg: 'bg-blue-50', border: 'border-blue-200', text: 'text-blue-700', badgeBg: 'bg-blue-100' },
    medication: { badge: 'Rx', bg: 'bg-emerald-50', border: 'border-emerald-200', text: 'text-emerald-700', badgeBg: 'bg-emerald-100' },
    complaint:  { badge: 'Cx', bg: 'bg-amber-50', border: 'border-amber-200', text: 'text-amber-700', badgeBg: 'bg-amber-100' },
  };

  return (
    <div className="w-full space-y-2">
      <label className="block text-xs font-semibold text-gray-600 uppercase tracking-wide">
        {label}
      </label>

      <textarea
        value={text}
        onChange={handleChange}
        placeholder={placeholder}
        rows={rows}
        className="w-full border border-gray-200 rounded-lg p-3 text-sm
                   focus:ring-2 focus:ring-blue-500 focus:border-blue-500
                   resize-y bg-white"
      />

      {/* Detected Concepts */}
      {concepts.length > 0 && (
        <div className="border border-gray-200 rounded-lg p-3 bg-gray-50/50 space-y-2">
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">
              Auto-detected
            </span>
            <span className="text-[10px] text-gray-400">
              ({concepts.length} concept{concepts.length !== 1 ? 's' : ''})
            </span>
          </div>

          {/* Diagnoses */}
          {grouped.dx.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {grouped.dx.map((c) => {
                const key = `diagnosis:${c.code}`;
                const isConfirmed = confirmed.has(key);
                const cfg = typeConfig.diagnosis;
                return (
                  <div key={key} className={`inline-flex items-center gap-1 px-2 py-1 rounded-md border text-xs
                    ${isConfirmed ? 'bg-blue-100 border-blue-400 ring-1 ring-blue-300' : `${cfg.bg} ${cfg.border}`}`}>
                    <span className={`font-bold text-[9px] px-1 py-0.5 rounded ${cfg.badgeBg} ${cfg.text}`}>{cfg.badge}</span>
                    <span className="font-medium text-gray-800">{c.label}</span>
                    <span className="font-mono text-[9px] text-gray-400">{c.code}</span>
                    {!isConfirmed ? (
                      <>
                        <button onClick={() => confirm(c)} className="text-blue-600 hover:text-blue-800 font-bold ml-0.5" title="Add to encounter">✓</button>
                        <button onClick={() => dismiss(c)} className="text-gray-300 hover:text-red-400" title="Dismiss">✕</button>
                      </>
                    ) : (
                      <span className="text-blue-600 ml-0.5">✓</span>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          {/* Medications */}
          {grouped.rx.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {grouped.rx.map((c) => {
                const key = `medication:${c.code}`;
                const isConfirmed = confirmed.has(key);
                const cfg = typeConfig.medication;
                return (
                  <div key={key} className={`inline-flex items-center gap-1 px-2 py-1 rounded-md border text-xs
                    ${isConfirmed ? 'bg-emerald-100 border-emerald-400 ring-1 ring-emerald-300' : `${cfg.bg} ${cfg.border}`}`}>
                    <span className={`font-bold text-[9px] px-1 py-0.5 rounded ${cfg.badgeBg} ${cfg.text}`}>{cfg.badge}</span>
                    <span className="font-medium text-gray-800">{c.label}</span>
                    {!isConfirmed ? (
                      <>
                        <button onClick={() => confirm(c)} className="text-emerald-600 hover:text-emerald-800 font-bold ml-0.5" title="Add to prescription">✓</button>
                        <button onClick={() => dismiss(c)} className="text-gray-300 hover:text-red-400" title="Dismiss">✕</button>
                      </>
                    ) : (
                      <span className="text-emerald-600 ml-0.5">✓</span>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          {/* Complaints */}
          {grouped.cx.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {grouped.cx.map((c, i) => {
                const cfg = typeConfig.complaint;
                return (
                  <div key={`complaint:${c.label}:${i}`} className={`inline-flex items-center gap-1 px-2 py-1 rounded-md border text-xs ${cfg.bg} ${cfg.border}`}>
                    <span className={`font-bold text-[9px] px-1 py-0.5 rounded ${cfg.badgeBg} ${cfg.text}`}>{cfg.badge}</span>
                    <span className="font-medium text-gray-800">{c.label}</span>
                    <span className="text-[9px] text-gray-400 italic">via "{c.matchedOn}"</span>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* CDSS Autofill Panel — triggered by confirmed diagnoses */}
      {autofill && (
        <div className="border border-blue-200 rounded-lg p-3 bg-blue-50/30 space-y-2">
          <span className="text-[10px] font-bold text-blue-500 uppercase tracking-widest">
            CDSS Suggestions
          </span>

          {autofill.labs.length > 0 && (
            <div>
              <span className="text-[10px] font-semibold text-gray-500">Investigations:</span>
              <div className="flex flex-wrap gap-1 mt-0.5">
                {autofill.labs.map((l) => (
                  <span key={l} className="px-1.5 py-0.5 bg-white border border-gray-200 rounded text-[10px] text-gray-600">{l}</span>
                ))}
              </div>
            </div>
          )}

          {autofill.meds.length > 0 && (
            <div>
              <span className="text-[10px] font-semibold text-gray-500">Medications:</span>
              <div className="flex flex-wrap gap-1 mt-0.5">
                {autofill.meds.map((m) => {
                  const med = MEDICATIONS.find((x) => x.id === m);
                  return (
                    <span key={m} className="px-1.5 py-0.5 bg-white border border-emerald-200 rounded text-[10px] text-emerald-700">
                      {med ? `${med.generic} ${med.strength} (${med.brand})` : m}
                    </span>
                  );
                })}
              </div>
            </div>
          )}

          {autofill.advice.length > 0 && (
            <div>
              <span className="text-[10px] font-semibold text-gray-500">Advice:</span>
              <div className="flex flex-wrap gap-1 mt-0.5">
                {autofill.advice.slice(0, 5).map((a) => (
                  <span key={a} className="px-1.5 py-0.5 bg-white border border-amber-200 rounded text-[10px] text-amber-700">{a}</span>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// Re-export the type for consumers
export type { DetectedConcept };
