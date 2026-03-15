'use client';

import { useState, useMemo } from 'react';
import { cn } from '@/lib/utils';
import { Search, Plus, X, ChevronDown, ChevronRight } from 'lucide-react';

// ══════════════════════════════════════
// COMPLAINT TEMPLATES — Indian clinical terminology
// ══════════════════════════════════════

interface AttributeDef {
  label: string;
  type: 'chips' | 'scale' | 'duration' | 'text';
  options?: string[];
  multi?: boolean;
}

interface ComplaintTemplate {
  name: string;
  category: string;
  attributes: Record<string, AttributeDef>;
}

const COMPLAINT_TEMPLATES: ComplaintTemplate[] = [
  {
    name: 'Chest Pain', category: 'Cardiovascular',
    attributes: {
      type: { label: 'Type', type: 'chips', options: ['Burning', 'Squeezing', 'Stabbing', 'Pressure-like', 'Heaviness', 'Dull ache', 'Pricking'] },
      location: { label: 'Location', type: 'chips', options: ['Retrosternal', 'Left-sided', 'Right-sided', 'Precordial', 'Diffuse', 'Epigastric'] },
      radiation: { label: 'Radiation', type: 'chips', options: ['Left arm', 'Right arm', 'Both arms', 'Jaw', 'Back', 'Neck', 'Shoulder', 'No radiation'], multi: true },
      severity: { label: 'Severity', type: 'scale' },
      onset: { label: 'Onset', type: 'chips', options: ['Sudden', 'Gradual', 'At rest', 'On exertion', 'Post-prandial', 'Nocturnal'] },
      duration: { label: 'Duration', type: 'duration' },
      aggravating: { label: 'Aggravating factors', type: 'chips', options: ['Exertion', 'Deep breathing', 'Lying flat', 'Eating', 'Stress', 'Cold weather'], multi: true },
      relieving: { label: 'Relieving factors', type: 'chips', options: ['Rest', 'Sorbitrate SL', 'Sitting up', 'Antacids', 'Nothing'], multi: true },
      associated: { label: 'Associated symptoms', type: 'chips', options: ['Sweating', 'Breathlessness', 'Nausea', 'Vomiting', 'Palpitations', 'Giddiness', 'Syncope', 'Cough'], multi: true },
    },
  },
  {
    name: 'Headache', category: 'Neuro',
    attributes: {
      type: { label: 'Type', type: 'chips', options: ['Throbbing', 'Pressure', 'Sharp', 'Dull', 'Band-like', 'Pulsating', 'Thunderclap'] },
      location: { label: 'Location', type: 'chips', options: ['Frontal', 'Temporal', 'Occipital', 'Vertex', 'Hemi-cranial (L)', 'Hemi-cranial (R)', 'Diffuse', 'Retro-orbital'] },
      severity: { label: 'Severity', type: 'scale' },
      onset: { label: 'Onset', type: 'chips', options: ['Sudden', 'Gradual', 'Morning', 'Evening', 'With activity', 'Post-trauma'] },
      duration: { label: 'Duration', type: 'duration' },
      aggravating: { label: 'Aggravating factors', type: 'chips', options: ['Light', 'Noise', 'Coughing', 'Straining', 'Bending forward', 'Screen time', 'Stress'], multi: true },
      relieving: { label: 'Relieving factors', type: 'chips', options: ['Rest', 'Sleep', 'Dark room', 'Paracetamol', 'Nothing'], multi: true },
      associated: { label: 'Associated symptoms', type: 'chips', options: ['Nausea', 'Vomiting', 'Photophobia', 'Phonophobia', 'Aura', 'Visual disturbance', 'Neck stiffness', 'Fever', 'Seizure'], multi: true },
    },
  },
  {
    name: 'Fever', category: 'General',
    attributes: {
      grade: { label: 'Grade', type: 'chips', options: ['Low (99-100°F)', 'Moderate (100-102°F)', 'High (102-104°F)', 'Very high (>104°F)'] },
      pattern: { label: 'Pattern', type: 'chips', options: ['Continuous', 'Intermittent', 'Remittent', 'Step-ladder', 'Pel-Ebstein', 'Quotidian', 'Tertian'] },
      onset: { label: 'Onset', type: 'chips', options: ['Sudden', 'Gradual', 'With chills', 'Without chills'] },
      duration: { label: 'Duration', type: 'duration' },
      timing: { label: 'Timing', type: 'chips', options: ['Evening rise', 'Night rise', 'Morning', 'Throughout day', 'No fixed pattern'] },
      associated: { label: 'Associated symptoms', type: 'chips', options: ['Chills', 'Rigors', 'Sweating', 'Body ache', 'Headache', 'Rash', 'Joint pain', 'Sore throat', 'Cough', 'Loose stools', 'Burning micturition', 'Altered sensorium'], multi: true },
      treatment_taken: { label: 'Treatment taken', type: 'chips', options: ['Paracetamol', 'Antibiotics (self)', 'Home remedies', 'No treatment', 'Visited local doctor'], multi: true },
    },
  },
  {
    name: 'Breathlessness', category: 'Respiratory',
    attributes: {
      grade: { label: 'NYHA Grade', type: 'chips', options: ['Grade I (strenuous)', 'Grade II (moderate)', 'Grade III (mild activity)', 'Grade IV (at rest)'] },
      onset: { label: 'Onset', type: 'chips', options: ['Sudden', 'Gradual', 'Progressive', 'Episodic'] },
      duration: { label: 'Duration', type: 'duration' },
      trigger: { label: 'Trigger', type: 'chips', options: ['Exertion', 'At rest', 'Lying flat (Orthopnea)', 'Night (PND)', 'Dust/smoke', 'Cold air', 'Emotional'], multi: true },
      severity: { label: 'Severity', type: 'scale' },
      associated: { label: 'Associated symptoms', type: 'chips', options: ['Cough', 'Wheeze', 'Chest pain', 'Palpitations', 'Pedal oedema', 'Hemoptysis', 'Fever', 'Stridor'], multi: true },
    },
  },
  {
    name: 'Abdominal Pain', category: 'GI',
    attributes: {
      location: { label: 'Location', type: 'chips', options: ['Epigastric', 'RUQ', 'LUQ', 'Umbilical', 'RIF', 'LIF', 'Suprapubic', 'Diffuse', 'Loin (R)', 'Loin (L)'] },
      type: { label: 'Type', type: 'chips', options: ['Colicky', 'Burning', 'Dull aching', 'Sharp', 'Cramping', 'Dragging'] },
      severity: { label: 'Severity', type: 'scale' },
      onset: { label: 'Onset', type: 'chips', options: ['Sudden', 'Gradual', 'Post-prandial', 'Early morning', 'Night'] },
      duration: { label: 'Duration', type: 'duration' },
      radiation: { label: 'Radiation', type: 'chips', options: ['Back', 'Right shoulder', 'Groin', 'No radiation'], multi: true },
      aggravating: { label: 'Aggravating factors', type: 'chips', options: ['Eating', 'Fasting', 'Spicy food', 'Fatty food', 'Movement', 'Lying flat'], multi: true },
      relieving: { label: 'Relieving factors', type: 'chips', options: ['Vomiting', 'Antacids', 'Fasting', 'Lying still', 'Passing flatus', 'Nothing'], multi: true },
      associated: { label: 'Associated symptoms', type: 'chips', options: ['Nausea', 'Vomiting', 'Loose stools', 'Constipation', 'Blood in stool', 'Distension', 'Fever', 'Jaundice', 'Burning micturition', 'Anorexia'], multi: true },
    },
  },
  {
    name: 'Cough', category: 'Respiratory',
    attributes: {
      type: { label: 'Type', type: 'chips', options: ['Dry', 'Productive', 'Barking', 'Whooping', 'Hacking'] },
      duration: { label: 'Duration', type: 'duration' },
      timing: { label: 'Timing', type: 'chips', options: ['Morning', 'Night', 'Continuous', 'Seasonal', 'Post-nasal drip'] },
      sputum: { label: 'Sputum', type: 'chips', options: ['None (dry)', 'Mucoid (white)', 'Purulent (yellow-green)', 'Blood-tinged', 'Rusty', 'Frothy (pink)', 'Foul-smelling'] },
      severity: { label: 'Severity', type: 'scale' },
      associated: { label: 'Associated symptoms', type: 'chips', options: ['Fever', 'Breathlessness', 'Wheeze', 'Chest pain', 'Weight loss', 'Night sweats', 'Hemoptysis', 'Sore throat', 'Runny nose'], multi: true },
    },
  },
  {
    name: 'Vomiting', category: 'GI',
    attributes: {
      type: { label: 'Type', type: 'chips', options: ['Non-projectile', 'Projectile', 'Bilious', 'Feculent', 'Coffee-ground', 'Blood-stained'] },
      frequency: { label: 'Frequency', type: 'chips', options: ['1-2 episodes', '3-5 episodes', '5-10 episodes', '>10 episodes', 'Continuous'] },
      relation: { label: 'Relation to food', type: 'chips', options: ['Before food', 'Immediately after food', 'Few hours after food', 'No relation'] },
      duration: { label: 'Duration', type: 'duration' },
      associated: { label: 'Associated symptoms', type: 'chips', options: ['Nausea', 'Abdominal pain', 'Diarrhoea', 'Fever', 'Headache', 'Giddiness', 'Dehydration signs'], multi: true },
    },
  },
  {
    name: 'Joint Pain', category: 'Ortho',
    attributes: {
      joints: { label: 'Joint(s) affected', type: 'chips', options: ['Knee (R)', 'Knee (L)', 'Hip (R)', 'Hip (L)', 'Shoulder (R)', 'Shoulder (L)', 'Ankle', 'Wrist', 'Elbow', 'Small joints (hands)', 'Small joints (feet)', 'Spine', 'Multiple joints'], multi: true },
      type: { label: 'Type', type: 'chips', options: ['Aching', 'Sharp', 'Stiffness', 'Locking', 'Giving way', 'Grinding'] },
      severity: { label: 'Severity', type: 'scale' },
      onset: { label: 'Onset', type: 'chips', options: ['Gradual', 'Sudden', 'Post-trauma', 'Post-activity'] },
      duration: { label: 'Duration', type: 'duration' },
      pattern: { label: 'Pattern', type: 'chips', options: ['Morning stiffness (<30 min)', 'Morning stiffness (>30 min)', 'Worse with activity', 'Worse at rest', 'Migratory', 'Additive'] },
      associated: { label: 'Associated symptoms', type: 'chips', options: ['Swelling', 'Redness', 'Warmth', 'Restricted movement', 'Crepitus', 'Deformity', 'Fever', 'Rash', 'Weight loss'], multi: true },
    },
  },
  {
    name: 'Weakness / Fatigue', category: 'General',
    attributes: {
      type: { label: 'Type', type: 'chips', options: ['Generalized', 'Focal (one side)', 'Proximal', 'Distal', 'Lower limbs', 'Upper limbs'] },
      onset: { label: 'Onset', type: 'chips', options: ['Sudden', 'Gradual', 'Progressive', 'Episodic'] },
      duration: { label: 'Duration', type: 'duration' },
      severity: { label: 'Severity', type: 'scale' },
      associated: { label: 'Associated symptoms', type: 'chips', options: ['Weight loss', 'Anorexia', 'Fever', 'Pallor', 'Numbness', 'Tingling', 'Difficulty walking', 'Falls', 'Slurred speech', 'Visual disturbance'], multi: true },
    },
  },
  {
    name: 'Burning Micturition', category: 'Renal',
    attributes: {
      severity: { label: 'Severity', type: 'scale' },
      duration: { label: 'Duration', type: 'duration' },
      frequency: { label: 'Urinary frequency', type: 'chips', options: ['Normal', 'Increased', 'Very frequent (every 30 min)', 'Nocturia'] },
      associated: { label: 'Associated symptoms', type: 'chips', options: ['Fever', 'Loin pain', 'Suprapubic pain', 'Hematuria', 'Urgency', 'Incomplete voiding', 'Foul-smelling urine', 'Vaginal/urethral discharge'], multi: true },
    },
  },
  {
    name: 'Giddiness / Vertigo', category: 'Neuro',
    attributes: {
      type: { label: 'Type', type: 'chips', options: ['Rotatory (room spinning)', 'Lightheadedness', 'Unsteadiness', 'Pre-syncope'] },
      onset: { label: 'Onset', type: 'chips', options: ['Sudden', 'Gradual', 'Positional', 'On standing'] },
      duration: { label: 'Duration', type: 'duration' },
      severity: { label: 'Severity', type: 'scale' },
      trigger: { label: 'Trigger', type: 'chips', options: ['Head turning', 'Standing up', 'Lying down', 'Looking up', 'No trigger'], multi: true },
      associated: { label: 'Associated symptoms', type: 'chips', options: ['Nausea', 'Vomiting', 'Hearing loss', 'Tinnitus', 'Ear fullness', 'Headache', 'Visual disturbance', 'Syncope'], multi: true },
    },
  },
  {
    name: 'Swelling (Pedal/Facial)', category: 'General',
    attributes: {
      location: { label: 'Location', type: 'chips', options: ['Pedal (bilateral)', 'Pedal (unilateral R)', 'Pedal (unilateral L)', 'Facial (periorbital)', 'Facial (generalized)', 'Abdominal (ascites)', 'Generalized (anasarca)', 'Scrotal'] },
      onset: { label: 'Onset', type: 'chips', options: ['Sudden', 'Gradual', 'Morning', 'Evening', 'Progressive'] },
      type: { label: 'Type', type: 'chips', options: ['Pitting', 'Non-pitting', 'Dependent'] },
      duration: { label: 'Duration', type: 'duration' },
      associated: { label: 'Associated symptoms', type: 'chips', options: ['Breathlessness', 'Decreased urine', 'Frothy urine', 'Jaundice', 'Abdominal distension', 'Chest pain', 'Fever', 'Pain in swollen area'], multi: true },
    },
  },
];

// ══════════════════════════════════════
// ACTIVE COMPLAINT STATE
// ══════════════════════════════════════

export interface ActiveComplaint {
  id: string;
  template: ComplaintTemplate;
  values: Record<string, string | string[] | number>;
}

export function generateComplaintText(complaint: ActiveComplaint): string {
  const { template, values } = complaint;
  const parts: string[] = [`C/O ${template.name}`];

  for (const [key, attr] of Object.entries(template.attributes)) {
    const val = values[key];
    if (!val || (Array.isArray(val) && val.length === 0)) continue;

    if (attr.type === 'scale' && typeof val === 'number') {
      parts.push(`${attr.label}: ${val}/10`);
    } else if (attr.type === 'duration' && typeof val === 'string') {
      parts.push(`since ${val}`);
    } else if (Array.isArray(val)) {
      parts.push(`${attr.label}: ${val.join(', ')}`);
    } else if (typeof val === 'string') {
      parts.push(`${attr.label}: ${val}`);
    }
  }

  return parts.join(' · ');
}

// ══════════════════════════════════════
// SMART COMPLAINT BUILDER COMPONENT
// ══════════════════════════════════════

export function SmartComplaintBuilder({ complaints, setComplaints }: {
  complaints: ActiveComplaint[];
  setComplaints: (c: ActiveComplaint[]) => void;
}) {
  const [searchQ, setSearchQ] = useState('');
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const filtered = useMemo(() => {
    if (!searchQ.trim()) return COMPLAINT_TEMPLATES;
    const q = searchQ.toLowerCase();
    return COMPLAINT_TEMPLATES.filter(t => t.name.toLowerCase().includes(q) || t.category.toLowerCase().includes(q));
  }, [searchQ]);

  function addComplaint(template: ComplaintTemplate) {
    const id = crypto.randomUUID();
    setComplaints([...complaints, { id, template, values: {} }]);
    setExpandedId(id);
    setSearchQ('');
  }

  function updateValue(complaintId: string, key: string, value: string | string[] | number) {
    setComplaints(complaints.map(c => c.id === complaintId ? { ...c, values: { ...c.values, [key]: value } } : c));
  }

  function removeComplaint(id: string) {
    setComplaints(complaints.filter(c => c.id !== id));
  }

  return (
    <div className="space-y-3">
      {/* Quick-add common complaints */}
      <div className="flex flex-wrap gap-1.5 mb-2">
        {['Chest Pain', 'Fever', 'Headache', 'Breathlessness', 'Abdominal Pain', 'Cough', 'Vomiting', 'Joint Pain'].map(name => {
          const tmpl = COMPLAINT_TEMPLATES.find(t => t.name === name);
          const alreadyAdded = complaints.some(c => c.template.name === name);
          if (!tmpl) return null;
          return (
            <button key={name} onClick={() => !alreadyAdded && addComplaint(tmpl)} disabled={alreadyAdded}
              className={cn('px-3 py-1.5 text-xs font-medium rounded-full border transition-colors',
                alreadyAdded
                  ? 'bg-green-50 border-green-200 text-green-600 cursor-default'
                  : 'bg-white border-gray-200 text-gray-600 hover:bg-brand-50 hover:border-brand-300 hover:text-brand-700')}>
              {alreadyAdded ? '✓ ' : '+ '}{name}
            </button>
          );
        })}
      </div>

      {/* Search for more complaints */}
      <div className="relative">
        <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
        <input value={searchQ} onChange={e => setSearchQ(e.target.value)}
          placeholder="Search more complaints (e.g. burning micturition, giddiness, swelling)..."
          className="w-full pl-9 pr-4 py-2 text-sm border border-gray-200 rounded-lg outline-none focus:ring-2 focus:ring-brand-500" />
        {searchQ.trim() && filtered.length > 0 && (
          <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-gray-200 rounded-lg shadow-lg z-20 max-h-48 overflow-y-auto">
            {filtered.map(t => {
              const added = complaints.some(c => c.template.name === t.name);
              return (
                <button key={t.name} onClick={() => !added && addComplaint(t)} disabled={added}
                  className={cn('w-full text-left px-3 py-2 flex items-center gap-3 text-sm border-b border-gray-50 last:border-0',
                    added ? 'bg-green-50 text-green-600' : 'hover:bg-gray-50')}>
                  <span className="text-[10px] uppercase text-gray-400 w-16">{t.category}</span>
                  <span className="text-gray-700 flex-1">{t.name}</span>
                  {added && <span className="text-xs text-green-600">Added</span>}
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* Active complaints with attribute pickers */}
      {complaints.map((complaint, idx) => {
        const isExpanded = expandedId === complaint.id;
        const summary = generateComplaintText(complaint);
        const filledCount = Object.keys(complaint.values).filter(k => {
          const v = complaint.values[k];
          return v && (!Array.isArray(v) || v.length > 0);
        }).length;
        const totalAttrs = Object.keys(complaint.template.attributes).length;

        return (
          <div key={complaint.id} className="bg-white border border-gray-200 rounded-xl overflow-hidden">
            {/* Complaint header */}
            <div className="flex items-center gap-3 px-4 py-3 bg-gray-50 border-b border-gray-100 cursor-pointer hover:bg-gray-100"
              onClick={() => setExpandedId(isExpanded ? null : complaint.id)}>
              <span className="text-xs font-bold text-white bg-brand-600 w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0">{idx + 1}</span>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-bold text-gray-800">{complaint.template.name}</span>
                  <span className="text-[10px] text-gray-400 uppercase">{complaint.template.category}</span>
                  <span className="text-[10px] bg-gray-200 text-gray-600 px-1.5 py-0.5 rounded-full">{filledCount}/{totalAttrs}</span>
                </div>
                {!isExpanded && filledCount > 0 && (
                  <p className="text-xs text-gray-500 truncate mt-0.5">{summary}</p>
                )}
              </div>
              <button onClick={e => { e.stopPropagation(); removeComplaint(complaint.id); }}
                className="text-gray-400 hover:text-red-500 p-1"><X size={14} /></button>
              <ChevronRight size={16} className={cn('text-gray-400 transition-transform', isExpanded && 'rotate-90')} />
            </div>

            {/* Attribute pickers */}
            {isExpanded && (
              <div className="p-4 space-y-4">
                {Object.entries(complaint.template.attributes).map(([key, attr]) => (
                  <AttributePicker
                    key={key}
                    attr={attr}
                    value={complaint.values[key]}
                    onChange={val => updateValue(complaint.id, key, val)}
                  />
                ))}

                {/* Auto-generated summary preview */}
                {filledCount > 0 && (
                  <div className="bg-blue-50 border border-blue-200 rounded-lg px-3 py-2">
                    <span className="text-[10px] font-bold text-blue-600 uppercase tracking-wider">Auto-generated text</span>
                    <p className="text-xs text-blue-800 mt-1 leading-relaxed">{summary}</p>
                  </div>
                )}
              </div>
            )}
          </div>
        );
      })}

      {complaints.length === 0 && (
        <div className="text-center py-6 text-sm text-gray-400">
          Click a complaint above or search to start building the clinical note
        </div>
      )}
    </div>
  );
}

// ══════════════════════════════════════
// ATTRIBUTE PICKER (chips, scale, duration)
// ══════════════════════════════════════

function AttributePicker({ attr, value, onChange }: {
  attr: AttributeDef;
  value: string | string[] | number | undefined;
  onChange: (val: string | string[] | number) => void;
}) {
  if (attr.type === 'chips') {
    const selected = attr.multi ? (Array.isArray(value) ? value : []) : (typeof value === 'string' ? value : '');

    return (
      <div>
        <label className="block text-xs font-semibold text-gray-500 mb-1.5">{attr.label}</label>
        <div className="flex flex-wrap gap-1.5">
          {attr.options?.map(opt => {
            const isSelected = attr.multi
              ? (selected as string[]).includes(opt)
              : selected === opt;

            return (
              <button key={opt} onClick={() => {
                if (attr.multi) {
                  const arr = selected as string[];
                  onChange(isSelected ? arr.filter(v => v !== opt) : [...arr, opt]);
                } else {
                  onChange(isSelected ? '' : opt);
                }
              }}
                className={cn('px-3 py-1.5 text-xs font-medium rounded-lg border transition-all',
                  isSelected
                    ? 'bg-brand-600 border-brand-600 text-white shadow-sm'
                    : 'bg-white border-gray-200 text-gray-600 hover:border-brand-300 hover:bg-brand-50')}>
                {opt}
              </button>
            );
          })}
        </div>
      </div>
    );
  }

  if (attr.type === 'scale') {
    const val = typeof value === 'number' ? value : 0;
    return (
      <div>
        <label className="block text-xs font-semibold text-gray-500 mb-1.5">{attr.label}: <span className="text-brand-600 font-bold">{val}/10</span></label>
        <div className="flex gap-1">
          {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map(n => (
            <button key={n} onClick={() => onChange(n)}
              className={cn('w-8 h-8 rounded-lg text-xs font-bold transition-all',
                val === n ? (n <= 3 ? 'bg-green-500 text-white' : n <= 6 ? 'bg-amber-500 text-white' : 'bg-red-500 text-white')
                : 'bg-gray-100 text-gray-500 hover:bg-gray-200')}>
              {n}
            </button>
          ))}
        </div>
        <div className="flex justify-between mt-1 px-1">
          <span className="text-[10px] text-green-600">Mild</span>
          <span className="text-[10px] text-amber-600">Moderate</span>
          <span className="text-[10px] text-red-600">Severe</span>
        </div>
      </div>
    );
  }

  if (attr.type === 'duration') {
    const val = typeof value === 'string' ? value : '';
    const quickDurations = ['Few hours', '1 day', '2 days', '3 days', '1 week', '2 weeks', '1 month', '3 months', '6 months', '1 year', '>1 year'];

    return (
      <div>
        <label className="block text-xs font-semibold text-gray-500 mb-1.5">{attr.label}</label>
        <div className="flex flex-wrap gap-1.5 mb-2">
          {quickDurations.map(d => (
            <button key={d} onClick={() => onChange(d)}
              className={cn('px-3 py-1.5 text-xs font-medium rounded-lg border transition-all',
                val === d
                  ? 'bg-brand-600 border-brand-600 text-white shadow-sm'
                  : 'bg-white border-gray-200 text-gray-600 hover:border-brand-300 hover:bg-brand-50')}>
              {d}
            </button>
          ))}
        </div>
        <input value={val} onChange={e => onChange(e.target.value)} placeholder="Or type custom duration..."
          className="w-full px-3 py-1.5 text-xs border border-gray-200 rounded-lg outline-none focus:ring-2 focus:ring-brand-500" />
      </div>
    );
  }

  // Fallback: text input
  return (
    <div>
      <label className="block text-xs font-semibold text-gray-500 mb-1.5">{attr.label}</label>
      <input value={typeof value === 'string' ? value : ''} onChange={e => onChange(e.target.value)}
        className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg outline-none focus:ring-2 focus:ring-brand-500" />
    </div>
  );
}
