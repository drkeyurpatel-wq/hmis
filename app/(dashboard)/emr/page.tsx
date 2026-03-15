'use client';

import { useState, useMemo } from 'react';
import {
  Heart, Thermometer, Wind, Droplets, Brain, Activity,
  AlertTriangle, AlertCircle, CheckCircle, Info,
  Search, Plus, Trash2, ChevronRight,
  FileText, Pill, FlaskConical, ScanLine, Stethoscope,
  Clock, Shield, Zap, Save, Send,
} from 'lucide-react';
import { cn, formatDateTime } from '@/lib/utils';
import {
  calculateNEWS2, analyzeVitals, checkDrugInteractions,
  validateDose, searchICD10,
  type VitalAlert, type DrugInteraction, type DoseAlert, type ICD10Code,
} from '@/lib/cdss/engine';
import type { Vitals } from '@/types/database';
import { SmartComplaintBuilder, generateComplaintText, type ActiveComplaint } from '@/components/emr/smart-complaint-builder';
import { SmartExamBuilder, type ExamFindings } from '@/components/emr/smart-exam-builder';
import { searchDrugs, MEDICATION_SETS, DRUG_DATABASE, type DrugSuggestion } from '@/lib/cdss/medications';

const MOCK_PATIENT = {
  uhid: 'H1S-000001', name: 'Rajesh Kumar Sharma', age: 58, gender: 'Male',
  blood_group: 'B+', allergies: ['Penicillin', 'Sulfa drugs'],
  insurance: 'Star Health — Policy #SH2024-88721',
  doctor: 'Dr. Sunil Gurmukhani', department: 'Cardiology',
  ipd: 'SHI-I-000042', admitted: '2026-03-14T10:30:00', bed: 'ICU-3, Bed 2',
  dx: 'Acute STEMI — anterior wall',
  history: [
    { type: 'Medical', desc: 'Type 2 DM (10y), HTN (8y)' },
    { type: 'Surgical', desc: 'Appendectomy (2015)' },
    { type: 'Family', desc: 'Father — MI at 55' },
  ],
};

interface Prescription {
  id: string; drug_name: string; dose_mg: number; dose_label: string;
  route: string; frequency: string; frequency_num: number;
  duration_days: number; instructions: string;
}

interface SelectedDiagnosis {
  code: string; description: string;
  type: 'provisional' | 'confirmed' | 'differential'; is_primary: boolean;
}

export default function EMRPage() {
  const [tab, setTab] = useState<'note' | 'orders' | 'results' | 'history'>('note');
  const [vitals, setVitals] = useState<Partial<Vitals>>({});
  const [rx, setRx] = useState<Prescription[]>([]);
  const [dx, setDx] = useState<SelectedDiagnosis[]>([]);
  const [note, setNote] = useState({
    chief_complaints: '', hpi: '', past_history: '', personal_history: '',
    family_history: '', menstrual_obstetric: '',
    general_examination: '', systemic_examination: '', local_examination: '',
    provisional_diagnosis: '', investigations: '', treatment: '', advice: '', followup: '',
  });
  const [complaints, setComplaints] = useState<ActiveComplaint[]>([]);
  const [examFindings, setExamFindings] = useState<ExamFindings>({});
  const [cdssOpen, setCdssOpen] = useState(true);

  const news2 = useMemo(() => calculateNEWS2(vitals), [vitals]);
  const vAlerts = useMemo(() => analyzeVitals(vitals), [vitals]);
  const dInteractions = useMemo(() => checkDrugInteractions(rx.map(p => p.drug_name)), [rx]);
  const dAlerts = useMemo(() => rx.flatMap(p => validateDose(p.drug_name, p.dose_mg, p.route, p.frequency_num)), [rx]);

  const crits = vAlerts.filter(a => a.severity === 'critical').length + dInteractions.filter(i => i.severity === 'contraindicated' || i.severity === 'severe').length + dAlerts.filter(d => d.severity === 'critical').length;
  const warns = vAlerts.filter(a => a.severity === 'warning').length + dInteractions.filter(i => i.severity === 'moderate').length + dAlerts.filter(d => d.severity === 'warning').length;
  const n2c = news2.risk === 'high' ? 'bg-red-600' : news2.risk === 'medium' ? 'bg-orange-500' : news2.risk === 'low_medium' ? 'bg-yellow-500' : 'bg-green-600';

  return (
    <div className="min-h-screen -mx-6 -mt-6">
      {/* ═══ PATIENT BANNER ═══ */}
      <div className="bg-white border-b border-gray-200 px-6 py-3">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-full bg-brand-600 flex items-center justify-center flex-shrink-0">
            <span className="text-white font-bold">RS</span>
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-3">
              <h1 className="text-base font-bold text-gray-900">{MOCK_PATIENT.name}</h1>
              <span className="text-xs font-mono bg-gray-100 text-gray-600 px-2 py-0.5 rounded">{MOCK_PATIENT.uhid}</span>
              <span className="text-xs bg-blue-50 text-blue-700 px-2 py-0.5 rounded font-medium">{MOCK_PATIENT.ipd}</span>
            </div>
            <div className="flex items-center gap-4 mt-0.5 text-xs text-gray-500">
              <span>{MOCK_PATIENT.age}y · {MOCK_PATIENT.gender} · {MOCK_PATIENT.blood_group}</span>
              <span className="flex items-center gap-1"><Stethoscope size={10} />{MOCK_PATIENT.doctor}</span>
              <span>{MOCK_PATIENT.department}</span>
              <span>{MOCK_PATIENT.bed}</span>
            </div>
          </div>
          {MOCK_PATIENT.allergies.length > 0 && (
            <div className="flex items-center gap-1.5 bg-red-50 border border-red-200 rounded-lg px-3 py-1.5">
              <AlertTriangle size={14} className="text-red-600" />
              <span className="text-xs font-semibold text-red-700">ALLERGIES: {MOCK_PATIENT.allergies.join(', ')}</span>
            </div>
          )}
          <div className={cn('flex flex-col items-center rounded-lg px-3 py-1.5 text-white min-w-[56px]', n2c)}>
            <span className="text-lg font-bold leading-tight">{news2.total}</span>
            <span className="text-[9px] uppercase tracking-wider font-medium">NEWS2</span>
          </div>
          {crits > 0 && (
            <div className="flex items-center gap-1.5 bg-red-600 rounded-lg px-3 py-2 text-white animate-pulse">
              <AlertCircle size={16} /><span className="text-sm font-bold">{crits}</span>
            </div>
          )}
        </div>
      </div>

      <div className="flex">
        {/* ═══ MAIN AREA ═══ */}
        <div className={cn('flex-1 transition-all duration-300', cdssOpen ? 'mr-[340px]' : 'mr-[48px]')}>
          {/* Tabs */}
          <div className="sticky top-0 z-10 bg-white border-b border-gray-200 px-6">
            <div className="flex gap-0">
              {([
                { id: 'note', label: 'Clinical Note', icon: FileText },
                { id: 'orders', label: 'Orders & Rx', icon: Pill },
                { id: 'results', label: 'Results', icon: FlaskConical },
                { id: 'history', label: 'History', icon: Clock },
              ] as const).map(t => {
                const I = t.icon;
                return (
                  <button key={t.id} onClick={() => setTab(t.id)}
                    className={cn('flex items-center gap-2 px-5 py-3.5 text-sm font-medium border-b-2 transition-colors',
                      tab === t.id ? 'border-health1-teal text-health1-teal' : 'border-transparent text-gray-500 hover:text-gray-700')}>
                    <I size={15} />{t.label}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="p-6">
            {/* ═══ VITALS STRIP ═══ */}
            <VitalsStrip vitals={vitals} setVitals={setVitals} alerts={vAlerts} />

            {tab === 'note' && <ClinicalNoteEditor note={note} setNote={setNote} dx={dx} setDx={setDx} complaints={complaints} setComplaints={setComplaints} examFindings={examFindings} setExamFindings={setExamFindings} />}
            {tab === 'orders' && <OrdersPanel rx={rx} setRx={setRx} alerts={dAlerts} />}
            {tab === 'results' && (
              <div className="bg-white border border-gray-200 rounded-xl p-8 text-center">
                <FlaskConical size={32} className="text-gray-300 mx-auto mb-3" />
                <p className="text-sm text-gray-500">Lab and radiology results will appear here once orders are placed</p>
              </div>
            )}
            {tab === 'history' && (
              <div className="space-y-3">
                {MOCK_PATIENT.history.map((h, i) => (
                  <div key={i} className="bg-white border border-gray-200 rounded-xl px-4 py-3">
                    <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">{h.type}</span>
                    <p className="text-sm text-gray-800 mt-1">{h.desc}</p>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* ═══ CDSS SIDEBAR ═══ */}
        <CDSSSidebar open={cdssOpen} toggle={() => setCdssOpen(!cdssOpen)}
          news2={news2} vAlerts={vAlerts} dInteractions={dInteractions} dAlerts={dAlerts}
          allergies={MOCK_PATIENT.allergies} crits={crits} warns={warns} />
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════
   VITALS STRIP
   ═══════════════════════════════════════════════ */

function VitalsStrip({ vitals, setVitals, alerts }: {
  vitals: Partial<Vitals>; setVitals: (v: Partial<Vitals>) => void; alerts: VitalAlert[];
}) {
  const [editing, setEditing] = useState(false);
  const [d, setD] = useState<Partial<Vitals>>({});

  const alertColor = (key: string) => {
    const a = alerts.find(x => x.parameter.toLowerCase().includes(key));
    if (!a) return '';
    return a.severity === 'critical' ? 'ring-2 ring-red-500 bg-red-50' : a.severity === 'warning' ? 'ring-2 ring-amber-400 bg-amber-50' : '';
  };

  const fields = [
    { k: 'bp_systolic', k2: 'bp_diastolic', label: 'BP', unit: 'mmHg', icon: Heart, ak: 'blood pressure' },
    { k: 'pulse', label: 'HR', unit: 'bpm', icon: Activity, ak: 'heart rate' },
    { k: 'spo2', label: 'SpO₂', unit: '%', icon: Droplets, ak: 'spo' },
    { k: 'temperature', label: 'Temp', unit: '°F', icon: Thermometer, ak: 'temperature' },
    { k: 'resp_rate', label: 'RR', unit: '/min', icon: Wind, ak: 'resp' },
    { k: 'blood_sugar', label: 'Sugar', unit: 'mg/dL', icon: Zap, ak: 'blood sugar' },
    { k: 'gcs', label: 'GCS', unit: '/15', icon: Brain, ak: 'gcs' },
  ];

  if (!editing && Object.keys(vitals).length === 0) {
    return (
      <div className="mb-6 bg-gray-50 border border-dashed border-gray-300 rounded-xl p-4 flex items-center justify-between">
        <span className="text-sm text-gray-500">No vitals recorded for this encounter</span>
        <button onClick={() => { setD({}); setEditing(true); }}
          className="flex items-center gap-1.5 text-sm font-medium text-health1-teal hover:text-teal-700">
          <Plus size={14} /> Record vitals
        </button>
      </div>
    );
  }

  return (
    <div className="mb-6 bg-white border border-gray-200 rounded-xl overflow-hidden">
      <div className="flex items-center justify-between px-4 py-2.5 bg-gray-50 border-b border-gray-100">
        <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Vitals</span>
        {!editing && <button onClick={() => { setD(vitals); setEditing(true); }} className="text-xs text-health1-teal font-medium hover:underline">Update</button>}
      </div>
      <div className="grid grid-cols-7 divide-x divide-gray-100">
        {fields.map(f => {
          const I = f.icon;
          const v = (key: string) => editing ? (d[key as keyof Vitals] ?? '') : (vitals[key as keyof Vitals] ?? '—');
          return (
            <div key={f.k} className={cn('px-3 py-3 text-center', !editing && alertColor(f.ak))}>
              <div className="flex items-center justify-center gap-1 mb-1">
                <I size={12} className="text-gray-400" />
                <span className="text-[10px] font-semibold text-gray-500 uppercase">{f.label}</span>
              </div>
              {editing ? (
                f.k2 ? (
                  <div className="flex items-center gap-1 justify-center">
                    <input type="number" className="w-12 text-center text-sm font-bold border border-gray-300 rounded px-1 py-0.5 focus:ring-1 focus:ring-health1-teal outline-none"
                      value={d[f.k as keyof Vitals] ?? ''} onChange={e => setD({ ...d, [f.k]: Number(e.target.value) || undefined })} />
                    <span className="text-gray-300">/</span>
                    <input type="number" className="w-12 text-center text-sm font-bold border border-gray-300 rounded px-1 py-0.5 focus:ring-1 focus:ring-health1-teal outline-none"
                      value={d[f.k2 as keyof Vitals] ?? ''} onChange={e => setD({ ...d, [f.k2!]: Number(e.target.value) || undefined })} />
                  </div>
                ) : (
                  <input type="number" className="w-16 mx-auto text-center text-sm font-bold border border-gray-300 rounded px-1 py-0.5 focus:ring-1 focus:ring-health1-teal outline-none"
                    value={d[f.k as keyof Vitals] ?? ''} onChange={e => setD({ ...d, [f.k]: Number(e.target.value) || undefined })} />
                )
              ) : (
                <p className="text-lg font-bold text-gray-900 leading-tight">{f.k2 ? `${v(f.k)}/${v(f.k2)}` : v(f.k)}</p>
              )}
              <span className="text-[10px] text-gray-400">{f.unit}</span>
            </div>
          );
        })}
      </div>
      {editing && (
        <div className="flex justify-end gap-2 px-4 py-2.5 bg-gray-50 border-t border-gray-100">
          <button onClick={() => setEditing(false)} className="px-3 py-1.5 text-xs text-gray-600 hover:bg-gray-100 rounded-lg">Cancel</button>
          <button onClick={() => { setVitals({ ...vitals, ...d }); setEditing(false); }} className="px-4 py-1.5 text-xs font-medium bg-health1-teal text-white rounded-lg hover:bg-teal-700">Save vitals</button>
        </div>
      )}
    </div>
  );
}

/* ═══════════════════════════════════════════════
   CLINICAL NOTE — Indian OPD Format
   ═══════════════════════════════════════════════ */

type NoteFields = {
  chief_complaints: string; hpi: string; past_history: string; personal_history: string;
  family_history: string; menstrual_obstetric: string;
  general_examination: string; systemic_examination: string; local_examination: string;
  provisional_diagnosis: string; investigations: string; treatment: string; advice: string; followup: string;
};

function ClinicalNoteEditor({ note, setNote, dx, setDx, complaints, setComplaints, examFindings, setExamFindings }: {
  note: NoteFields; setNote: (n: NoteFields) => void;
  dx: SelectedDiagnosis[]; setDx: (d: SelectedDiagnosis[]) => void;
  complaints: ActiveComplaint[]; setComplaints: (c: ActiveComplaint[]) => void;
  examFindings: ExamFindings; setExamFindings: (f: ExamFindings) => void;
}) {
  const [icdQ, setIcdQ] = useState('');
  const icdR = useMemo(() => searchICD10(icdQ), [icdQ]);
  const [expandedGroup, setExpandedGroup] = useState<string>('complaints');

  const groups = [
    {
      id: 'complaints', label: 'Chief Complaints & HPI', color: 'border-l-blue-500', icon: '📋',
      isSmartBuilder: true,
      fields: [],
    },
    {
      id: 'history', label: 'Past / Personal / Family History', color: 'border-l-blue-300', icon: '📁',
      fields: [
        { key: 'past_history', label: 'Past History', ph: 'Known case of DM/HTN/IHD/BA/TB/Epilepsy — duration, treatment\nPrevious surgeries / hospitalisations\nDrug allergies: Penicillin / Sulfa / NSAID / Contrast', rows: 3 },
        { key: 'personal_history', label: 'Personal History', ph: 'Diet: Veg / Non-veg / Mixed\nAppetite, Sleep, Bowel, Micturition\nHabits: Smoking (pack-years) / Alcohol / Tobacco chewing\nOccupation', rows: 3 },
        { key: 'family_history', label: 'Family History', ph: 'DM / HTN / IHD / Malignancy in parents/siblings', rows: 2 },
        { key: 'menstrual_obstetric', label: 'Menstrual / Obstetric (if applicable)', ph: 'LMP, Cycle, G/P/A/L, Contraception', rows: 2 },
      ],
    },
    {
      id: 'examination', label: 'Examination', color: 'border-l-green-500', icon: '🩺',
      isSmartBuilder: true,
      builderType: 'exam',
      fields: [],
    },
    {
      id: 'diagnosis', label: 'Diagnosis & Plan', color: 'border-l-amber-500', icon: '🔍',
      fields: [
        { key: 'provisional_diagnosis', label: 'Provisional Diagnosis', ph: 'e.g. Acute STEMI — Anterior wall MI\nwith Type 2 DM (uncontrolled)\nwith Hypertension Stage 2', rows: 2 },
        { key: 'investigations', label: 'Investigations Advised', ph: 'Blood: CBC, ESR, CRP, RBS, HbA1c, RFT, LFT, Lipid profile, Cardiac enzymes (Trop-I/T, CK-MB), PT/INR, Electrolytes\nUrine: R/M, Culture\nImaging: X-ray Chest PA, ECG, 2D Echo, CT/MRI\nSpecial: TMT, Coronary angiography, EEG, NCS/EMG', rows: 4 },
      ],
    },
    {
      id: 'management', label: 'Treatment & Follow-up', color: 'border-l-purple-500', icon: '💊',
      fields: [
        { key: 'treatment', label: 'Treatment / Rx', ph: 'Tab. Ecosprin 75mg OD after food\nTab. Clopidogrel 75mg OD after food\nTab. Atorvastatin 40mg HS\nTab. Metoprolol 25mg BD\nInj. Enoxaparin 0.6ml SC BD\nTab. Pantoprazole 40mg OD before food\n\n(Also add via Orders & Rx tab for CDSS checking)', rows: 5 },
        { key: 'advice', label: 'Advice / Patient Education', ph: 'Diet: Low salt, low fat, diabetic diet\nActivity: Bed rest / Restricted / As tolerated\nMonitoring: Blood sugar 4 times/day, I/O charting\nPrecautions: Report if chest pain recurs, breathlessness worsens\nLifestyle: Smoking cessation, Regular exercise after recovery', rows: 3 },
        { key: 'followup', label: 'Follow-up', ph: 'Review after 1 week with reports\nOr SOS if symptoms worsen\nNext appointment: ___', rows: 2 },
      ],
    },
  ];

  return (
    <div className="space-y-3">
      {/* Collapsible groups */}
      {groups.map(group => {
        const isExpanded = expandedGroup === group.id;
        const isSmartBuilder = 'isSmartBuilder' in group && group.isSmartBuilder;
        const builderType = 'builderType' in group ? (group as any).builderType : 'complaints';
        const filledCount = isSmartBuilder
          ? (builderType === 'exam' ? Object.keys(examFindings).length : complaints.length)
          : group.fields.filter(f => note[f.key as keyof NoteFields].trim()).length;
        const totalCount = isSmartBuilder ? filledCount : group.fields.length;

        return (
          <div key={group.id} className={cn('bg-white border border-gray-200 rounded-xl overflow-hidden border-l-4', group.color)}>
            {/* Group header — clickable to expand/collapse */}
            <button
              onClick={() => setExpandedGroup(isExpanded ? '' : group.id)}
              className="w-full px-4 py-3 bg-gray-50 border-b border-gray-100 flex items-center justify-between hover:bg-gray-100 transition-colors"
            >
              <div className="flex items-center gap-2">
                <span className="text-sm">{group.icon}</span>
                <span className="text-sm font-bold text-gray-700">{group.label}</span>
                {filledCount > 0 && (
                  <span className="text-[10px] bg-green-100 text-green-700 px-1.5 py-0.5 rounded-full font-medium">
                    {isSmartBuilder
                      ? builderType === 'exam'
                        ? `${filledCount} system${filledCount !== 1 ? 's' : ''}`
                        : `${filledCount} complaint${filledCount !== 1 ? 's' : ''}`
                      : `${filledCount}/${totalCount} filled`}
                  </span>
                )}
              </div>
              <ChevronRight size={16} className={cn('text-gray-400 transition-transform', isExpanded && 'rotate-90')} />
            </button>

            {/* Fields or SmartComplaintBuilder */}
            {isExpanded && isSmartBuilder && builderType === 'complaints' && (
              <div className="p-4">
                <SmartComplaintBuilder complaints={complaints} setComplaints={setComplaints} />
              </div>
            )}
            {isExpanded && isSmartBuilder && builderType === 'exam' && (
              <div className="p-4">
                <SmartExamBuilder findings={examFindings} setFindings={setExamFindings} />
              </div>
            )}
            {isExpanded && !isSmartBuilder && (
              <div className="divide-y divide-gray-50">
                {group.fields.map(field => (
                  <div key={field.key} className="px-4 py-3">
                    <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1.5">
                      {field.label}
                    </label>
                    <textarea
                      value={note[field.key as keyof NoteFields]}
                      onChange={e => setNote({ ...note, [field.key]: e.target.value })}
                      rows={field.rows}
                      placeholder={field.ph}
                      className="w-full px-3 py-2 text-sm text-gray-800 placeholder:text-gray-300 border border-gray-200 rounded-lg resize-none outline-none focus:ring-2 focus:ring-brand-500 focus:border-brand-500 leading-relaxed"
                    />
                  </div>
                ))}
              </div>
            )}
          </div>
        );
      })}

      {/* ICD-10 Diagnoses */}
      <div className="bg-white border border-gray-200 rounded-xl overflow-hidden border-l-4 border-l-red-400">
        <div className="px-4 py-2.5 bg-gray-50 border-b border-gray-100 flex items-center justify-between">
          <label className="text-xs font-bold text-gray-600 uppercase tracking-wider">Diagnoses — ICD-10 Coding</label>
          <span className="text-xs text-gray-400">{dx.length} active</span>
        </div>
        <div className="p-4">
          <div className="relative mb-3">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input value={icdQ} onChange={e => setIcdQ(e.target.value)} placeholder="Search ICD-10 — type diagnosis name or code (e.g. STEMI, I21, diabetes, E11)..."
              className="w-full pl-9 pr-4 py-2 text-sm border border-gray-200 rounded-lg outline-none focus:ring-2 focus:ring-brand-500" />
            {icdR.length > 0 && (
              <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-gray-200 rounded-lg shadow-lg z-20 max-h-48 overflow-y-auto">
                {icdR.map(c => (
                  <button key={c.code} onClick={() => { if (!dx.some(d => d.code === c.code)) setDx([...dx, { code: c.code, description: c.description, type: 'provisional', is_primary: dx.length === 0 }]); setIcdQ(''); }}
                    className="w-full text-left px-3 py-2 hover:bg-gray-50 flex items-center gap-3 text-sm border-b border-gray-50 last:border-0">
                    <span className="font-mono text-xs bg-gray-100 text-gray-600 px-1.5 py-0.5 rounded flex-shrink-0">{c.code}</span>
                    <span className="text-gray-700 truncate">{c.description}</span>
                    <span className="text-[10px] text-gray-400 flex-shrink-0">{c.category}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
          {dx.length === 0 ? <p className="text-xs text-gray-400 py-2">No diagnoses coded yet — search above to add ICD-10</p> : (
            <div className="space-y-2">
              {dx.map((d, i) => (
                <div key={d.code} className="flex items-center gap-3 bg-gray-50 rounded-lg px-3 py-2">
                  <span className="font-mono text-xs bg-red-50 text-red-700 px-1.5 py-0.5 rounded font-medium">{d.code}</span>
                  <span className="text-sm text-gray-800 flex-1">{d.description}</span>
                  <select value={d.type} onChange={e => { const u = [...dx]; u[i] = { ...d, type: e.target.value as SelectedDiagnosis['type'] }; setDx(u); }}
                    className="text-xs border border-gray-300 rounded px-2 py-1 bg-white">
                    <option value="provisional">Provisional</option><option value="confirmed">Confirmed</option><option value="differential">Differential</option>
                  </select>
                  {d.is_primary && <span className="text-[10px] bg-green-100 text-green-700 px-1.5 py-0.5 rounded font-semibold">PRIMARY</span>}
                  <button onClick={() => setDx(dx.filter((_, j) => j !== i))} className="text-gray-400 hover:text-red-500"><Trash2 size={14} /></button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Actions */}
      <div className="flex justify-end gap-3">
        <button className="px-4 py-2.5 text-sm font-medium text-gray-600 border border-gray-300 rounded-lg hover:bg-gray-50 flex items-center gap-2"><Save size={14} /> Save draft</button>
        <button className="px-5 py-2.5 text-sm font-medium bg-health1-teal text-white rounded-lg hover:bg-teal-700 flex items-center gap-2"><Send size={14} /> Sign &amp; finalize</button>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════
   ORDERS & PRESCRIPTIONS
   ═══════════════════════════════════════════════ */

function OrdersPanel({ rx, setRx, alerts }: {
  rx: Prescription[]; setRx: (p: Prescription[]) => void; alerts: DoseAlert[];
}) {
  const [show, setShow] = useState(false);
  const [drugQ, setDrugQ] = useState('');
  const [n, setN] = useState({ drug_name: '', dose: '', route: 'oral', frequency: 'BD', duration: '5', instructions: '' });
  const fm: Record<string, number> = { OD: 1, BD: 2, TDS: 3, QID: 4, SOS: 1, STAT: 1, HS: 1 };
  const drugResults = useMemo(() => searchDrugs(drugQ), [drugQ]);
  const [showSets, setShowSets] = useState(false);

  function addFromDrug(drug: DrugSuggestion) {
    setN({ drug_name: drug.name, dose: drug.default_dose, route: drug.default_route, frequency: drug.default_frequency, duration: drug.default_duration, instructions: drug.instructions });
    setDrugQ('');
  }

  function add() {
    if (!n.drug_name || !n.dose) return;
    setRx([...rx, { id: crypto.randomUUID(), drug_name: n.drug_name, dose_mg: parseFloat(n.dose) || 0, dose_label: n.dose + 'mg', route: n.route, frequency: n.frequency, frequency_num: fm[n.frequency] || 1, duration_days: parseInt(n.duration) || 5, instructions: n.instructions }]);
    setN({ drug_name: '', dose: '', route: 'oral', frequency: 'BD', duration: '5', instructions: '' });
    setShow(false);
  }

  function applyMedSet(setId: string) {
    const medSet = MEDICATION_SETS.find(s => s.id === setId);
    if (!medSet) return;
    const newRx: Prescription[] = [];
    for (const drugName of medSet.drugs) {
      if (rx.some(r => r.drug_name === drugName)) continue;
      const drug = DRUG_DATABASE.find(d => d.name === drugName);
      if (!drug) continue;
      newRx.push({
        id: crypto.randomUUID(), drug_name: drug.name, dose_mg: parseFloat(drug.default_dose) || 0,
        dose_label: drug.default_dose + 'mg', route: drug.default_route, frequency: drug.default_frequency,
        frequency_num: fm[drug.default_frequency] || 1, duration_days: parseInt(drug.default_duration) || 5,
        instructions: drug.instructions,
      });
    }
    setRx([...rx, ...newRx]);
    setShowSets(false);
  }

  return (
    <div className="space-y-4">
      {/* Quick actions */}
      <div className="flex gap-2 flex-wrap">
        {[{ l: 'Lab order', i: FlaskConical, c: 'text-purple-600 bg-purple-50 border-purple-200 hover:bg-purple-100' },
          { l: 'Radiology', i: ScanLine, c: 'text-blue-600 bg-blue-50 border-blue-200 hover:bg-blue-100' },
          { l: 'Prescription', i: Pill, c: 'text-health1-teal bg-teal-50 border-teal-200 hover:bg-teal-100' },
          { l: 'Procedure', i: Stethoscope, c: 'text-orange-600 bg-orange-50 border-orange-200 hover:bg-orange-100' },
        ].map(b => { const I = b.i; return (
          <button key={b.l} onClick={() => b.l === 'Prescription' && setShow(true)}
            className={cn('flex items-center gap-2 px-4 py-2.5 text-sm font-medium rounded-lg border transition-colors', b.c)}>
            <I size={15} />{b.l}
          </button>
        ); })}
        <button onClick={() => setShowSets(!showSets)}
          className="flex items-center gap-2 px-4 py-2.5 text-sm font-medium rounded-lg border bg-amber-50 border-amber-200 text-amber-700 hover:bg-amber-100 transition-colors">
          <FileText size={15} /> Medication Sets
        </button>
      </div>

      {/* Medication Sets Panel */}
      {showSets && (
        <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
          <div className="px-4 py-3 bg-amber-50 border-b border-amber-100 flex items-center justify-between">
            <h3 className="text-xs font-bold text-amber-700 uppercase tracking-wider">Quick-apply medication sets</h3>
            <button onClick={() => setShowSets(false)} className="text-amber-400 hover:text-amber-600 text-lg">&times;</button>
          </div>
          <div className="grid grid-cols-2 gap-2 p-3">
            {MEDICATION_SETS.map(set => (
              <button key={set.id} onClick={() => applyMedSet(set.id)}
                className="text-left p-3 rounded-lg border border-gray-200 hover:border-brand-300 hover:bg-brand-50 transition-colors">
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-xs font-bold text-gray-800">{set.name}</span>
                  <span className="text-[10px] bg-gray-100 text-gray-500 px-1.5 py-0.5 rounded">{set.category}</span>
                </div>
                <p className="text-[11px] text-gray-500 mb-2">{set.description}</p>
                <div className="flex flex-wrap gap-1">
                  {set.drugs.map(d => (
                    <span key={d} className={cn('text-[10px] px-1.5 py-0.5 rounded',
                      rx.some(r => r.drug_name === d) ? 'bg-green-100 text-green-600 line-through' : 'bg-gray-100 text-gray-600')}>
                      {d.replace('Tab. ', '').replace('Inj. ', '').replace('Neb. ', '')}
                    </span>
                  ))}
                </div>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Active prescriptions */}
      <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
        <div className="px-4 py-3 bg-gray-50 border-b border-gray-100 flex items-center justify-between">
          <h3 className="text-xs font-bold text-gray-600 uppercase tracking-wider flex items-center gap-2"><Pill size={14} className="text-health1-teal" /> Active prescriptions ({rx.length})</h3>
          <button onClick={() => setShow(true)} className="text-xs font-medium text-health1-teal hover:underline flex items-center gap-1"><Plus size={12} /> Add drug</button>
        </div>
        {rx.length === 0 ? (
          <div className="p-8 text-center text-sm text-gray-400">No prescriptions yet — use Medication Sets above or add individually</div>
        ) : (
          <div className="divide-y divide-gray-100">
            {rx.map((p, idx) => {
              const al = alerts.find(a => a.drug.toLowerCase().includes(p.drug_name.split(' ')[1]?.toLowerCase() || '___') && a.severity !== 'info');
              return (
                <div key={p.id} className={cn('px-4 py-3 flex items-start gap-3', al?.severity === 'critical' && 'bg-red-50')}>
                  <span className="text-xs font-bold text-gray-400 w-5 mt-0.5">{idx + 1}.</span>
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-semibold text-gray-900">{p.drug_name}</span>
                      {al && <span className={cn('text-[10px] font-bold px-1.5 py-0.5 rounded', al.severity === 'critical' ? 'bg-red-100 text-red-700' : 'bg-amber-100 text-amber-700')}>{al.severity === 'critical' ? 'DOSE ALERT' : 'CHECK'}</span>}
                    </div>
                    <p className="text-xs text-gray-600 mt-0.5">{p.dose_label} · {p.route} · {p.frequency} · {p.duration_days}d{p.instructions && ` · ${p.instructions}`}</p>
                    {al && <p className="text-xs text-red-600 mt-1">{al.message}</p>}
                  </div>
                  <button onClick={() => setRx(rx.filter(x => x.id !== p.id))} className="text-gray-400 hover:text-red-500 mt-1"><Trash2 size={14} /></button>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Add prescription modal with drug autocomplete */}
      {show && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md mx-4">
            <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
              <h2 className="font-display font-semibold text-gray-900">Add prescription</h2>
              <button onClick={() => setShow(false)} className="text-gray-400 hover:text-gray-600 text-xl">&times;</button>
            </div>
            <div className="p-5 space-y-3">
              {/* Drug search with autocomplete */}
              <div className="relative">
                <label className="block text-xs font-medium text-gray-600 mb-1">Drug name *</label>
                <input value={n.drug_name || drugQ} onChange={e => { setDrugQ(e.target.value); setN({ ...n, drug_name: '' }); }}
                  placeholder="Start typing — e.g. Ator, Panto, Ceftri, Metfor..."
                  className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg outline-none focus:ring-2 focus:ring-health1-teal" />
                {drugResults.length > 0 && !n.drug_name && (
                  <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-gray-200 rounded-lg shadow-lg z-20 max-h-52 overflow-y-auto">
                    {drugResults.map(d => (
                      <button key={d.name} onClick={() => addFromDrug(d)}
                        className="w-full text-left px-3 py-2.5 hover:bg-gray-50 border-b border-gray-50 last:border-0">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-medium text-gray-800">{d.name}</span>
                          <span className="text-[10px] bg-gray-100 text-gray-500 px-1.5 py-0.5 rounded">{d.category}</span>
                        </div>
                        <p className="text-[11px] text-gray-400 mt-0.5">
                          {d.default_dose}mg · {d.default_route} · {d.default_frequency} · {d.default_duration}d
                          {d.instructions && ` · ${d.instructions}`}
                        </p>
                      </button>
                    ))}
                  </div>
                )}
                {n.drug_name && (
                  <div className="mt-1 text-[11px] text-green-600 flex items-center gap-1">
                    <CheckCircle size={12} /> Selected: {n.drug_name} — fields auto-filled below
                  </div>
                )}
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Dose (mg) *</label>
                  <input value={n.dose} onChange={e => setN({ ...n, dose: e.target.value })} type="number" placeholder="500"
                    className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg outline-none focus:ring-2 focus:ring-health1-teal" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Route</label>
                  <select value={n.route} onChange={e => setN({ ...n, route: e.target.value })}
                    className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg bg-white outline-none">
                    <option value="oral">Oral</option><option value="iv">IV</option><option value="im">IM</option><option value="sc">SC</option><option value="topical">Topical</option><option value="inhalation">Inhalation</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Frequency</label>
                  <select value={n.frequency} onChange={e => setN({ ...n, frequency: e.target.value })}
                    className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg bg-white outline-none">
                    <option value="STAT">STAT</option><option value="OD">OD</option><option value="BD">BD</option><option value="TDS">TDS</option><option value="QID">QID</option><option value="HS">HS</option><option value="SOS">SOS</option>
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Duration (days)</label>
                  <input value={n.duration} onChange={e => setN({ ...n, duration: e.target.value })} type="number"
                    className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg outline-none focus:ring-2 focus:ring-health1-teal" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Instructions</label>
                  <input value={n.instructions} onChange={e => setN({ ...n, instructions: e.target.value })} placeholder="After food"
                    className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg outline-none focus:ring-2 focus:ring-health1-teal" />
                </div>
              </div>
            </div>
            <div className="flex justify-end gap-2 px-5 py-4 border-t border-gray-100">
              <button onClick={() => { setShow(false); setDrugQ(''); }} className="px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-lg">Cancel</button>
              <button onClick={add} className="px-5 py-2 text-sm font-medium bg-health1-teal text-white rounded-lg hover:bg-teal-700">Add to prescriptions</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/* ═══════════════════════════════════════════════
   CDSS SIDEBAR
   ═══════════════════════════════════════════════ */

function CDSSSidebar({ open, toggle, news2, vAlerts, dInteractions, dAlerts, allergies, crits, warns }: {
  open: boolean; toggle: () => void;
  news2: ReturnType<typeof calculateNEWS2>; vAlerts: VitalAlert[];
  dInteractions: DrugInteraction[]; dAlerts: DoseAlert[];
  allergies: string[]; crits: number; warns: number;
}) {
  const n2c = news2.risk === 'high' ? 'bg-red-50 border-red-200' : news2.risk === 'medium' ? 'bg-orange-50 border-orange-200' : news2.risk === 'low_medium' ? 'bg-yellow-50 border-yellow-200' : 'bg-green-50 border-green-200';
  const n2t = news2.risk === 'high' ? 'text-red-700' : news2.risk === 'medium' ? 'text-orange-700' : news2.risk === 'low_medium' ? 'text-yellow-700' : 'text-green-700';

  const icon = (sev: string) =>
    sev === 'critical' || sev === 'contraindicated' || sev === 'severe' ? <AlertCircle size={13} className="text-red-600 flex-shrink-0" /> :
    sev === 'warning' || sev === 'moderate' ? <AlertTriangle size={13} className="text-amber-600 flex-shrink-0" /> :
    sev === 'info' || sev === 'mild' ? <Info size={13} className="text-blue-500 flex-shrink-0" /> :
    <CheckCircle size={13} className="text-green-500 flex-shrink-0" />;

  if (!open) return (
    <div className="fixed right-0 top-0 bottom-0 w-[48px] bg-gray-50 border-l border-gray-200 flex flex-col items-center pt-4 gap-3 z-20">
      <button onClick={toggle} className="w-8 h-8 rounded-lg bg-white border border-gray-200 flex items-center justify-center hover:bg-gray-100"><ChevronRight size={14} className="rotate-180" /></button>
      {crits > 0 && <div className="w-6 h-6 rounded-full bg-red-600 text-white text-xs font-bold flex items-center justify-center animate-pulse">{crits}</div>}
      {warns > 0 && <div className="w-6 h-6 rounded-full bg-amber-500 text-white text-xs font-bold flex items-center justify-center">{warns}</div>}
    </div>
  );

  return (
    <div className="fixed right-0 top-0 bottom-0 w-[340px] bg-white border-l border-gray-200 overflow-y-auto z-20">
      <div className="sticky top-0 bg-white border-b border-gray-200 px-4 py-3 flex items-center justify-between z-10">
        <div className="flex items-center gap-2">
          <Shield size={16} className="text-health1-teal" /><h2 className="text-sm font-bold text-gray-900">CDSS</h2>
          {crits > 0 && <span className="w-5 h-5 rounded-full bg-red-600 text-white text-[10px] font-bold flex items-center justify-center animate-pulse">{crits}</span>}
          {warns > 0 && <span className="w-5 h-5 rounded-full bg-amber-500 text-white text-[10px] font-bold flex items-center justify-center">{warns}</span>}
        </div>
        <button onClick={toggle} className="text-gray-400 hover:text-gray-600"><ChevronRight size={16} /></button>
      </div>

      <div className="p-4 space-y-4">
        {allergies.length > 0 && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-3">
            <div className="flex items-center gap-2 mb-1"><AlertTriangle size={14} className="text-red-600" /><span className="text-xs font-bold text-red-700 uppercase">Known allergies</span></div>
            <div className="flex flex-wrap gap-1 mt-1.5">
              {allergies.map(a => <span key={a} className="text-xs bg-red-100 text-red-800 px-2 py-0.5 rounded-full font-medium">{a}</span>)}
            </div>
          </div>
        )}

        <div className={cn('border rounded-lg p-3', n2c)}>
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-bold text-gray-600 uppercase tracking-wider">NEWS2 Score</span>
            <span className={cn('text-2xl font-bold', n2t)}>{news2.total}</span>
          </div>
          <p className={cn('text-xs font-medium', n2t)}>{news2.risk.replace('_', '-').toUpperCase()} RISK</p>
          <p className="text-xs text-gray-600 mt-1">{news2.recommendation}</p>
          {Object.keys(news2.components).length > 0 && (
            <div className="flex flex-wrap gap-1.5 mt-2">
              {Object.entries(news2.components).map(([k, v]) => (
                <span key={k} className={cn('text-[10px] px-1.5 py-0.5 rounded font-mono', v >= 3 ? 'bg-red-100 text-red-700' : v >= 1 ? 'bg-amber-100 text-amber-700' : 'bg-gray-100 text-gray-500')}>
                  {k.replace('_', ' ')}: {v}
                </span>
              ))}
            </div>
          )}
        </div>

        {vAlerts.filter(a => a.severity !== 'normal').length > 0 && (
          <div>
            <h3 className="text-xs font-bold text-gray-600 uppercase tracking-wider mb-2">Vital alerts</h3>
            <div className="space-y-1.5">{vAlerts.filter(a => a.severity !== 'normal').map((a, i) => <div key={i} className="flex items-start gap-2 text-xs">{icon(a.severity)}<span className="text-gray-700">{a.message}</span></div>)}</div>
          </div>
        )}

        {dInteractions.length > 0 && (
          <div>
            <h3 className="text-xs font-bold text-gray-600 uppercase tracking-wider mb-2">Drug interactions</h3>
            <div className="space-y-2">
              {dInteractions.map((x, i) => (
                <div key={i} className={cn('rounded-lg p-2.5 text-xs', x.severity === 'contraindicated' || x.severity === 'severe' ? 'bg-red-50 border border-red-200' : 'bg-amber-50 border border-amber-200')}>
                  <div className="flex items-center gap-2">{icon(x.severity)}<span className="font-semibold text-gray-800">{x.drug_a} + {x.drug_b}</span>
                    <span className={cn('text-[10px] font-bold uppercase px-1.5 py-0.5 rounded', x.severity === 'contraindicated' ? 'bg-red-200 text-red-800' : x.severity === 'severe' ? 'bg-red-100 text-red-700' : 'bg-amber-100 text-amber-700')}>{x.severity}</span>
                  </div>
                  <p className="text-gray-600 mt-1">{x.description}</p>
                  <p className="text-gray-700 mt-1 font-medium">{x.recommendation}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {dAlerts.filter(d => d.severity !== 'info').length > 0 && (
          <div>
            <h3 className="text-xs font-bold text-gray-600 uppercase tracking-wider mb-2">Dose validation</h3>
            <div className="space-y-1.5">{dAlerts.filter(d => d.severity !== 'info').map((a, i) => <div key={i} className="flex items-start gap-2 text-xs">{icon(a.severity)}<span className="text-gray-700">{a.message}</span></div>)}</div>
          </div>
        )}

        {dAlerts.filter(d => d.severity === 'info').length > 0 && (
          <div>
            <h3 className="text-xs font-bold text-gray-600 uppercase tracking-wider mb-2">Clinical notes</h3>
            <div className="space-y-1.5">{dAlerts.filter(d => d.severity === 'info').map((a, i) => <div key={i} className="flex items-start gap-2 text-xs"><Info size={13} className="text-blue-500 flex-shrink-0" /><span className="text-gray-600"><span className="font-medium text-gray-700">{a.drug}:</span> {a.message}</span></div>)}</div>
          </div>
        )}

        {vAlerts.filter(a => a.severity !== 'normal').length === 0 && dInteractions.length === 0 && dAlerts.filter(d => d.severity !== 'info').length === 0 && (
          <div className="text-center py-4">
            <CheckCircle size={24} className="text-green-500 mx-auto mb-2" />
            <p className="text-sm text-gray-500">No alerts — all clear</p>
          </div>
        )}
      </div>
    </div>
  );
}
