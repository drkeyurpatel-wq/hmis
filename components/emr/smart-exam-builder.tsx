'use client';

import { useState } from 'react';
import { cn } from '@/lib/utils';
import { ChevronRight, RotateCcw } from 'lucide-react';

// ══════════════════════════════════════
// EXAMINATION TEMPLATES — system-wise clickable
// ══════════════════════════════════════

interface FindingDef {
  label: string;
  normal: string;
  options: string[];
  multi?: boolean;
}

interface SystemTemplate {
  id: string;
  label: string;
  icon: string;
  color: string;
  findings: FindingDef[];
}

const EXAM_SYSTEMS: SystemTemplate[] = [
  {
    id: 'general', label: 'General Examination', icon: '👤', color: 'border-l-gray-400',
    findings: [
      { label: 'Consciousness', normal: 'Conscious', options: ['Conscious', 'Drowsy', 'Stuporous', 'Unconscious', 'Confused', 'Delirious'] },
      { label: 'Orientation', normal: 'Oriented to TPP', options: ['Oriented to TPP', 'Disoriented to time', 'Disoriented to place', 'Disoriented to person', 'Fully disoriented'] },
      { label: 'Built', normal: 'Average', options: ['Average', 'Thin', 'Obese', 'Muscular', 'Cachectic'] },
      { label: 'Nourishment', normal: 'Well nourished', options: ['Well nourished', 'Under-nourished', 'Over-nourished', 'Malnourished'] },
      { label: 'Pallor', normal: 'No pallor', options: ['No pallor', 'Mild pallor', 'Moderate pallor', 'Severe pallor'] },
      { label: 'Icterus', normal: 'No icterus', options: ['No icterus', 'Mild icterus', 'Deep icterus'] },
      { label: 'Cyanosis', normal: 'No cyanosis', options: ['No cyanosis', 'Peripheral cyanosis', 'Central cyanosis'] },
      { label: 'Clubbing', normal: 'No clubbing', options: ['No clubbing', 'Grade 1', 'Grade 2', 'Grade 3', 'Grade 4'] },
      { label: 'Lymphadenopathy', normal: 'No LAP', options: ['No LAP', 'Cervical', 'Axillary', 'Inguinal', 'Generalized', 'Supraclavicular'] ,multi: true },
      { label: 'Oedema', normal: 'No oedema', options: ['No oedema', 'Pedal (pitting)', 'Pedal (non-pitting)', 'Sacral', 'Facial (periorbital)', 'Generalized (anasarca)'], multi: true },
      { label: 'JVP', normal: 'Not raised', options: ['Not raised', 'Raised', 'Raised with hepatojugular reflux'] },
      { label: 'Hydration', normal: 'Well hydrated', options: ['Well hydrated', 'Mildly dehydrated', 'Moderately dehydrated', 'Severely dehydrated'] },
    ],
  },
  {
    id: 'cvs', label: 'CVS — Cardiovascular', icon: '', color: 'border-l-red-400',
    findings: [
      { label: 'Apex beat', normal: 'Normal (5th ICS MCL)', options: ['Normal (5th ICS MCL)', 'Displaced laterally', 'Displaced inferiorly', 'Not palpable', 'Heaving', 'Tapping'] },
      { label: 'Heart sounds', normal: 'S1 S2 heard, normal', options: ['S1 S2 heard, normal', 'S1 S2 normal, S3 present', 'S1 S2 normal, S4 present', 'S1 loud', 'S1 soft', 'S2 loud', 'S2 fixed split', 'S2 paradoxical split'] },
      { label: 'Murmur', normal: 'No murmur', options: ['No murmur', 'Systolic (apex)', 'Systolic (aortic)', 'Systolic (tricuspid)', 'Systolic (pulmonary)', 'Diastolic (mitral)', 'Diastolic (aortic)', 'Continuous', 'Pansystolic'], multi: true },
      { label: 'Murmur grade', normal: 'N/A', options: ['N/A', 'Grade 1/6', 'Grade 2/6', 'Grade 3/6', 'Grade 4/6', 'Grade 5/6', 'Grade 6/6'] },
      { label: 'Peripheral pulses', normal: 'All pulses felt, equal', options: ['All pulses felt, equal', 'Radial weak', 'Dorsalis pedis absent (R)', 'Dorsalis pedis absent (L)', 'Carotid bruit (R)', 'Carotid bruit (L)', 'Radioradial delay', 'Radiofemoral delay'] },
      { label: 'BP (both arms)', normal: 'Equal both arms', options: ['Equal both arms', 'Difference >20 mmHg', 'Measured right arm only', 'Measured left arm only'] },
    ],
  },
  {
    id: 'rs', label: 'RS — Respiratory', icon: '🫁', color: 'border-l-blue-400',
    findings: [
      { label: 'Trachea', normal: 'Central', options: ['Central', 'Deviated to right', 'Deviated to left'] },
      { label: 'Chest shape', normal: 'Normal', options: ['Normal', 'Barrel-shaped', 'Pigeon chest', 'Funnel chest', 'Kyphoscoliosis'] },
      { label: 'Chest movement', normal: 'B/L equal', options: ['B/L equal', 'Reduced right', 'Reduced left', 'Reduced bilateral', 'Paradoxical'] },
      { label: 'Percussion', normal: 'Resonant B/L', options: ['Resonant B/L', 'Dull right base', 'Dull left base', 'Dull B/L bases', 'Stony dull right', 'Stony dull left', 'Hyper-resonant right', 'Hyper-resonant left'] },
      { label: 'Breath sounds', normal: 'B/L vesicular, equal', options: ['B/L vesicular, equal', 'Reduced right', 'Reduced left', 'Reduced B/L', 'Absent right', 'Absent left', 'Bronchial right', 'Bronchial left'] },
      { label: 'Added sounds', normal: 'No added sounds', options: ['No added sounds', 'Crepitations right base', 'Crepitations left base', 'Crepitations B/L bases', 'Crepitations diffuse', 'Wheeze (expiratory)', 'Wheeze (inspiratory)', 'Wheeze B/L', 'Rhonchi', 'Pleural rub right', 'Pleural rub left', 'Stridor'], multi: true },
      { label: 'Vocal resonance', normal: 'Normal', options: ['Normal', 'Increased right', 'Increased left', 'Decreased right', 'Decreased left'] },
    ],
  },
  {
    id: 'pa', label: 'P/A — Per Abdomen', icon: '🩻', color: 'border-l-amber-400',
    findings: [
      { label: 'Shape', normal: 'Flat', options: ['Flat', 'Scaphoid', 'Distended', 'Distended with flanks full', 'Protuberant'] },
      { label: 'Umbilicus', normal: 'Central, inverted', options: ['Central, inverted', 'Everted', 'Displaced', 'Nodule (Sister Joseph)'] },
      { label: 'Tenderness', normal: 'Non-tender', options: ['Non-tender', 'RUQ tender', 'LUQ tender', 'Epigastric tender', 'RIF tender', 'LIF tender', 'Suprapubic tender', 'Diffuse tenderness', 'Rebound tenderness', 'Guarding', 'Rigidity'], multi: true },
      { label: 'Liver', normal: 'Not palpable', options: ['Not palpable', 'Just palpable', '2 cm below costal margin', '4 cm below costal margin', 'Firm', 'Hard', 'Tender', 'Nodular'] },
      { label: 'Spleen', normal: 'Not palpable', options: ['Not palpable', 'Just palpable', 'Moderate splenomegaly', 'Massive splenomegaly'] },
      { label: 'Kidney', normal: 'Not palpable B/L', options: ['Not palpable B/L', 'Right kidney palpable', 'Left kidney palpable', 'Ballottable right', 'Ballottable left'] },
      { label: 'Bowel sounds', normal: 'Present, normal', options: ['Present, normal', 'Hyperactive', 'Sluggish', 'Absent'] },
      { label: 'Free fluid', normal: 'No free fluid', options: ['No free fluid', 'Shifting dullness present', 'Fluid thrill positive', 'Minimal ascites'] },
      { label: 'Hernial orifices', normal: 'Intact', options: ['Intact', 'Right inguinal hernia', 'Left inguinal hernia', 'Umbilical hernia', 'Incisional hernia'] },
    ],
  },
  {
    id: 'cns', label: 'CNS — Neurological', icon: '🧠', color: 'border-l-purple-400',
    findings: [
      { label: 'Higher functions', normal: 'Intact', options: ['Intact', 'Speech — dysarthria', 'Speech — aphasia', 'Memory impaired', 'Calculation impaired'] },
      { label: 'Cranial nerves', normal: 'All intact', options: ['All intact', 'Facial palsy (UMN) R', 'Facial palsy (UMN) L', 'Facial palsy (LMN) R', 'Facial palsy (LMN) L', 'Tongue deviation R', 'Tongue deviation L', 'Ptosis R', 'Ptosis L', 'Pupil dilated R', 'Pupil dilated L', 'Squint'], multi: true },
      { label: 'Motor — Tone (UL)', normal: 'Normal B/L', options: ['Normal B/L', 'Increased R', 'Increased L', 'Increased B/L', 'Decreased R', 'Decreased L', 'Decreased B/L', 'Spasticity', 'Rigidity (lead pipe)', 'Rigidity (cogwheel)'] },
      { label: 'Motor — Tone (LL)', normal: 'Normal B/L', options: ['Normal B/L', 'Increased R', 'Increased L', 'Increased B/L', 'Decreased R', 'Decreased L', 'Decreased B/L'] },
      { label: 'Motor — Power (UL)', normal: '5/5 B/L', options: ['5/5 B/L', '4/5 R', '4/5 L', '3/5 R', '3/5 L', '2/5 R', '2/5 L', '1/5 R', '1/5 L', '0/5 R', '0/5 L'] },
      { label: 'Motor — Power (LL)', normal: '5/5 B/L', options: ['5/5 B/L', '4/5 R', '4/5 L', '3/5 R', '3/5 L', '2/5 R', '2/5 L', '1/5 R', '1/5 L', '0/5 R', '0/5 L'] },
      { label: 'Reflexes', normal: 'Normal, symmetric', options: ['Normal, symmetric', 'Brisk B/L', 'Brisk R', 'Brisk L', 'Absent R', 'Absent L', 'Absent B/L', 'Plantar — flexor B/L', 'Plantar — extensor R (Babinski +)', 'Plantar — extensor L (Babinski +)'] },
      { label: 'Sensory', normal: 'Intact all modalities', options: ['Intact all modalities', 'Reduced R UL', 'Reduced L UL', 'Reduced R LL', 'Reduced L LL', 'Glove-stocking pattern', 'Dermatomal loss', 'Loss below level'] },
      { label: 'Cerebellar', normal: 'NAD', options: ['NAD', 'Finger-nose — positive R', 'Finger-nose — positive L', 'Heel-shin — positive R', 'Heel-shin — positive L', 'Dysdiadochokinesia', 'Nystagmus', 'Gait ataxia'] },
      { label: 'Gait', normal: 'Normal', options: ['Normal', 'Hemiplegic', 'Ataxic', 'Spastic', 'Parkinsonian (shuffling)', 'Waddling', 'Foot drop', 'Antalgic', 'Unable to walk'] },
    ],
  },
  {
    id: 'msk', label: 'MSK — Musculoskeletal', icon: '🦴', color: 'border-l-orange-400',
    findings: [
      { label: 'Joint involved', normal: 'N/A', options: ['Knee (R)', 'Knee (L)', 'Hip (R)', 'Hip (L)', 'Shoulder (R)', 'Shoulder (L)', 'Ankle (R)', 'Ankle (L)', 'Spine (cervical)', 'Spine (lumbar)', 'Wrist', 'Elbow', 'Small joints (hands)'], multi: true },
      { label: 'Swelling', normal: 'No swelling', options: ['No swelling', 'Present', 'Mild effusion', 'Moderate effusion', 'Tense effusion'] },
      { label: 'Warmth', normal: 'No warmth', options: ['No warmth', 'Warm to touch', 'Hot to touch'] },
      { label: 'Tenderness', normal: 'Non-tender', options: ['Non-tender', 'Mild', 'Moderate', 'Severe', 'Joint-line tenderness'] },
      { label: 'ROM', normal: 'Full ROM', options: ['Full ROM', 'Mildly restricted', 'Moderately restricted', 'Severely restricted', 'Fixed flexion deformity', 'Valgus deformity', 'Varus deformity'] },
      { label: 'Crepitus', normal: 'No crepitus', options: ['No crepitus', 'Fine crepitus', 'Coarse crepitus'] },
      { label: 'Special tests', normal: 'N/A', options: ['N/A', 'McMurray +', 'Anterior drawer +', 'Lachman +', 'SLR positive R', 'SLR positive L', 'FABER positive', 'Neer test +', 'Hawkins test +', 'Tinel sign +', 'Phalen test +'], multi: true },
    ],
  },
];

// ══════════════════════════════════════
// EXAMINATION STATE & HELPERS
// ══════════════════════════════════════

export interface ExamFindings {
  [systemId: string]: { [findingLabel: string]: string | string[] };
}

export function generateExamText(findings: ExamFindings): string {
  const parts: string[] = [];
  for (const system of EXAM_SYSTEMS) {
    const sysFindings = findings[system.id];
    if (!sysFindings) continue;
    const items: string[] = [];
    for (const f of system.findings) {
      const val = sysFindings[f.label];
      if (!val || (Array.isArray(val) && val.length === 0)) continue;
      if (Array.isArray(val)) items.push(`${f.label}: ${val.join(', ')}`);
      else if (val !== f.normal) items.push(`${f.label}: ${val}`);
      else items.push(val);
    }
    if (items.length > 0) {
      parts.push(`${system.label.split('—')[0].trim()}: ${items.join('; ')}`);
    }
  }
  return parts.join('\n');
}

// ══════════════════════════════════════
// SMART EXAMINATION BUILDER
// ══════════════════════════════════════

export function SmartExamBuilder({ findings, setFindings }: {
  findings: ExamFindings; setFindings: (f: ExamFindings) => void;
}) {
  const [expandedSystem, setExpandedSystem] = useState<string | null>(null);

  function setValue(systemId: string, label: string, value: string | string[]) {
    setFindings({
      ...findings,
      [systemId]: { ...(findings[systemId] || {}), [label]: value },
    });
  }

  function setAllNormal(systemId: string) {
    const system = EXAM_SYSTEMS.find(s => s.id === systemId);
    if (!system) return;
    const normals: Record<string, string | string[]> = {};
    system.findings.forEach(f => { normals[f.label] = f.multi ? [f.normal] : f.normal; });
    setFindings({ ...findings, [systemId]: normals });
  }

  function getFilledCount(systemId: string): number {
    const sf = findings[systemId];
    if (!sf) return 0;
    return Object.values(sf).filter(v => v && (!Array.isArray(v) || v.length > 0)).length;
  }

  return (
    <div className="space-y-2">
      {EXAM_SYSTEMS.map(system => {
        const isExpanded = expandedSystem === system.id;
        const filled = getFilledCount(system.id);
        const total = system.findings.length;

        return (
          <div key={system.id} className={cn('bg-white border border-gray-200 rounded-xl overflow-hidden border-l-4', system.color)}>
            <div className="flex items-center gap-2 px-4 py-2.5 bg-gray-50 border-b border-gray-100">
              <button onClick={() => setExpandedSystem(isExpanded ? null : system.id)}
                className="flex items-center gap-2 flex-1 text-left hover:text-gray-900">
                <span className="text-sm">{system.icon}</span>
                <span className="text-sm font-bold text-gray-700">{system.label}</span>
                {filled > 0 && <span className="text-[10px] bg-green-100 text-green-700 px-1.5 py-0.5 rounded-full font-medium">{filled}/{total}</span>}
                <ChevronRight size={14} className={cn('text-gray-400 transition-transform ml-auto', isExpanded && 'rotate-90')} />
              </button>
              <button onClick={() => setAllNormal(system.id)}
                className="text-[10px] font-medium text-brand-600 hover:text-brand-800 bg-brand-50 px-2 py-1 rounded-lg hover:bg-brand-100 transition-colors flex items-center gap-1">
                <RotateCcw size={10} /> All normal
              </button>
            </div>

            {isExpanded && (
              <div className="p-3 space-y-3">
                {system.findings.map(finding => {
                  const val = findings[system.id]?.[finding.label];
                  const selected = finding.multi ? (Array.isArray(val) ? val : []) : (typeof val === 'string' ? val : '');

                  return (
                    <div key={finding.label}>
                      <div className="flex items-center gap-2 mb-1.5">
                        <label className="text-xs font-semibold text-gray-500">{finding.label}</label>
                        <span className="text-[10px] text-gray-300">normal: {finding.normal}</span>
                      </div>
                      <div className="flex flex-wrap gap-1">
                        {finding.options.map(opt => {
                          const isNormal = opt === finding.normal;
                          const isSelected = finding.multi
                            ? (selected as string[]).includes(opt)
                            : selected === opt;

                          return (
                            <button key={opt} onClick={() => {
                              if (finding.multi) {
                                const arr = selected as string[];
                                setValue(system.id, finding.label, isSelected ? arr.filter(v => v !== opt) : [...arr, opt]);
                              } else {
                                setValue(system.id, finding.label, isSelected ? '' : opt);
                              }
                            }}
                              className={cn('px-2.5 py-1 text-[11px] font-medium rounded-md border transition-all',
                                isSelected
                                  ? isNormal ? 'bg-green-600 border-green-600 text-white' : 'bg-red-50 border-red-300 text-red-700 ring-1 ring-red-300'
                                  : isNormal ? 'bg-green-50 border-green-200 text-green-700 hover:bg-green-100' : 'bg-white border-gray-200 text-gray-600 hover:border-gray-300')}>
                              {opt}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
