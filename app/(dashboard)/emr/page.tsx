'use client';

import { useState } from 'react';
import { cn } from '@/lib/utils';
import {
  Stethoscope, Activity, FileText, Pill, FlaskConical, ScanLine,
  AlertTriangle, Brain, ChevronDown, ChevronRight, Save, Clock,
  Thermometer, Heart, Wind, Droplets, Eye, Plus, X, Printer,
  CheckCircle, AlertCircle, Info, Zap, Send,
} from 'lucide-react';

// Demo patient context
const PATIENT = {
  name: 'Rajesh Sharma', uhid: 'H1S-000042', age: 58, gender: 'M', blood: 'B+',
  allergies: ['Penicillin (severe — anaphylaxis)', 'Sulfa drugs (moderate — rash)'],
  vitals_history: [
    { date: 'Today 10:20', bp: '148/92', pulse: 88, spo2: 96, temp: 98.4, rr: 18, sugar: 142 },
    { date: '12 Mar', bp: '142/88', pulse: 82, spo2: 97, temp: 98.6, rr: 16, sugar: 135 },
    { date: '28 Feb', bp: '152/96', pulse: 90, spo2: 95, temp: 98.2, rr: 20, sugar: 158 },
  ],
  diagnoses: [
    { code: 'I25.1', desc: 'Atherosclerotic heart disease', status: 'confirmed', date: '2024-06-15' },
    { code: 'I10', desc: 'Essential hypertension', status: 'confirmed', date: '2020-03-10' },
    { code: 'E11.9', desc: 'Type 2 diabetes mellitus', status: 'confirmed', date: '2019-11-20' },
  ],
  medications: [
    { drug: 'Atorvastatin 40mg', freq: 'OD (night)', route: 'Oral', since: 'Jun 2024' },
    { drug: 'Aspirin 75mg', freq: 'OD', route: 'Oral', since: 'Jun 2024' },
    { drug: 'Metoprolol 50mg', freq: 'BD', route: 'Oral', since: 'Jun 2024' },
    { drug: 'Metformin 500mg', freq: 'BD', route: 'Oral', since: 'Nov 2019' },
    { drug: 'Telmisartan 40mg', freq: 'OD', route: 'Oral', since: 'Mar 2020' },
  ],
  recent_labs: [
    { test: 'HbA1c', value: '7.2%', range: '<7.0', flag: 'H', date: '10 Mar' },
    { test: 'LDL Cholesterol', value: '98 mg/dL', range: '<100', flag: '', date: '10 Mar' },
    { test: 'Creatinine', value: '1.1 mg/dL', range: '0.7-1.3', flag: '', date: '10 Mar' },
    { test: 'TSH', value: '3.2 mIU/L', range: '0.4-4.0', flag: '', date: '10 Mar' },
    { test: 'Troponin I', value: '<0.01 ng/mL', range: '<0.04', flag: '', date: '12 Mar' },
  ],
};

const CDSS_ALERTS = [
  { type: 'critical', icon: AlertTriangle, title: 'Drug allergy', msg: 'Patient has severe Penicillin allergy. Avoid all beta-lactam antibiotics. Cross-reactivity risk with cephalosporins.' },
  { type: 'warning', icon: AlertCircle, title: 'BP above target', msg: 'BP 148/92 mmHg — above target of <140/90 for diabetic patient. Consider dose adjustment of Telmisartan or adding Amlodipine.' },
  { type: 'info', icon: Info, title: 'HbA1c trending up', msg: 'HbA1c 7.2% (was 6.8% in Sep). Metformin dose review recommended. Consider adding DPP-4 inhibitor.' },
  { type: 'info', icon: Zap, title: 'AI suggestion', msg: 'Based on current vitals and lab trends, consider ordering: Echocardiography (last done 8 months ago) and Renal function panel.' },
];

const alertStyles: Record<string, string> = {
  critical: 'bg-red-50 border-red-200',
  warning: 'bg-amber-50 border-amber-200',
  info: 'bg-blue-50 border-blue-200',
};
const alertIconStyles: Record<string, string> = {
  critical: 'text-red-500',
  warning: 'text-amber-500',
  info: 'text-blue-500',
};

export default function EMRPage() {
  const [activeTab, setActiveTab] = useState<'soap' | 'vitals' | 'orders' | 'rx' | 'labs' | 'radiology' | 'history'>('soap');
  const [soap, setSoap] = useState({ subjective: '', objective: '', assessment: '', plan: '' });
  const [showCDSS, setShowCDSS] = useState(true);

  const tabs = [
    { id: 'soap' as const, label: 'SOAP Notes', icon: FileText },
    { id: 'vitals' as const, label: 'Vitals', icon: Activity },
    { id: 'orders' as const, label: 'Orders', icon: Send },
    { id: 'rx' as const, label: 'Prescriptions', icon: Pill },
    { id: 'labs' as const, label: 'Lab Results', icon: FlaskConical },
    { id: 'radiology' as const, label: 'Radiology', icon: ScanLine },
    { id: 'history' as const, label: 'History', icon: Clock },
  ];

  return (
    <div className="space-y-4">
      {/* Patient banner */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm px-5 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-full bg-brand-100 flex items-center justify-center">
              <span className="text-lg font-bold text-brand-700">RS</span>
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-lg font-display font-bold text-gray-900">{PATIENT.name}</h1>
                <span className="text-xs font-mono bg-gray-100 text-gray-600 px-2 py-0.5 rounded">{PATIENT.uhid}</span>
                <span className="text-xs bg-red-50 text-red-700 font-medium px-1.5 py-0.5 rounded flex items-center gap-1">
                  <Droplets size={10} />{PATIENT.blood}
                </span>
              </div>
              <div className="flex items-center gap-4 mt-1">
                <span className="text-sm text-gray-500">{PATIENT.age}y / {PATIENT.gender}</span>
                <span className="text-sm text-gray-500">Follow-up · Cardiology</span>
                <span className="text-sm text-gray-500">Dr. Sunil Gurmukhani</span>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button className="px-3 py-2 border border-gray-200 text-sm font-medium text-gray-600 rounded-lg hover:bg-gray-50 flex items-center gap-1.5"><Printer size={14} />Print</button>
            <button className="px-4 py-2 bg-health1-teal text-white text-sm font-medium rounded-lg hover:bg-teal-700 flex items-center gap-1.5"><Save size={14} />Save & sign</button>
          </div>
        </div>

        {/* Allergy banner */}
        {PATIENT.allergies.length > 0 && (
          <div className="mt-3 bg-red-50 border border-red-200 rounded-lg px-3 py-2 flex items-start gap-2">
            <AlertTriangle size={14} className="text-red-500 mt-0.5 flex-shrink-0" />
            <div className="text-xs text-red-700">
              <span className="font-semibold">ALLERGIES: </span>
              {PATIENT.allergies.join(' · ')}
            </div>
          </div>
        )}

        {/* Quick vitals strip */}
        <div className="mt-3 flex items-center gap-6 text-sm">
          {[
            { icon: Heart, label: 'BP', value: PATIENT.vitals_history[0].bp, unit: 'mmHg', warn: true },
            { icon: Activity, label: 'Pulse', value: PATIENT.vitals_history[0].pulse, unit: 'bpm', warn: false },
            { icon: Wind, label: 'SpO₂', value: PATIENT.vitals_history[0].spo2 + '%', unit: '', warn: false },
            { icon: Thermometer, label: 'Temp', value: PATIENT.vitals_history[0].temp + '°F', unit: '', warn: false },
            { icon: Droplets, label: 'Sugar', value: PATIENT.vitals_history[0].sugar, unit: 'mg/dL', warn: true },
          ].map((v) => { const I = v.icon; return (
            <div key={v.label} className="flex items-center gap-1.5">
              <I size={13} className={v.warn ? 'text-amber-500' : 'text-gray-400'} />
              <span className="text-xs text-gray-500">{v.label}</span>
              <span className={cn('text-sm font-semibold', v.warn ? 'text-amber-700' : 'text-gray-900')}>{v.value}</span>
              {v.unit && <span className="text-[10px] text-gray-400">{v.unit}</span>}
            </div>
          );})}
        </div>
      </div>

      {/* Main area: EMR tabs + CDSS sidebar */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
        {/* EMR content */}
        <div className={cn('bg-white rounded-xl border border-gray-200 shadow-sm', showCDSS ? 'lg:col-span-3' : 'lg:col-span-4')}>
          {/* Tab bar */}
          <div className="px-4 border-b border-gray-100 flex items-center gap-1 overflow-x-auto">
            {tabs.map((t) => { const I = t.icon; return (
              <button key={t.id} onClick={() => setActiveTab(t.id)}
                className={cn('flex items-center gap-1.5 px-3 py-3 text-xs font-medium border-b-2 transition-colors whitespace-nowrap',
                  activeTab === t.id ? 'border-brand-600 text-brand-700' : 'border-transparent text-gray-500 hover:text-gray-700')}>
                <I size={13} />{t.label}
              </button>
            );})}
            <button onClick={() => setShowCDSS(!showCDSS)}
              className={cn('ml-auto flex items-center gap-1 px-3 py-3 text-xs font-medium transition-colors', showCDSS ? 'text-brand-600' : 'text-gray-400')}>
              <Brain size={13} />CDSS
            </button>
          </div>

          {/* Tab content */}
          <div className="p-5">
            {activeTab === 'soap' && (
              <div className="space-y-4">
                {[
                  { key: 'subjective', label: 'S — Subjective', placeholder: 'Chief complaint, history of present illness, review of systems...\n\nExample:\nPatient presents for follow-up after coronary angiography done on 12 Mar 2026.\nReports mild chest discomfort on exertion (climbing 2 flights of stairs).\nDenies rest pain, orthopnoea, PND.\nCompliant with medications.\nDiet: reports difficulty maintaining low-salt diet.' },
                  { key: 'objective', label: 'O — Objective', placeholder: 'Physical examination findings, vitals interpretation...\n\nExample:\nGA: Well-oriented, comfortable at rest\nCVS: S1S2 normal, no murmur, no JVP elevation\nChest: AEBE clear, no crepts\nAbdomen: Soft, non-tender\nExtremities: No pedal edema\nBP: 148/92 (above target)' },
                  { key: 'assessment', label: 'A — Assessment', placeholder: 'Diagnoses, clinical impression, differential...\n\nExample:\n1. Stable ischaemic heart disease — post-angiography, medical management\n2. Hypertension — suboptimally controlled (target <140/90)\n3. Type 2 DM — HbA1c 7.2%, trending up from 6.8%' },
                  { key: 'plan', label: 'P — Plan', placeholder: 'Treatment plan, orders, follow-up...\n\nExample:\n1. Continue current cardiac medications\n2. Increase Telmisartan 40mg → 80mg for better BP control\n3. Add Sitagliptin 100mg OD for glycaemic control\n4. Order: Echo, Renal function panel\n5. Diet counselling referral\n6. Follow-up: 4 weeks' },
                ].map((section) => (
                  <div key={section.key}>
                    <label className="flex items-center justify-between mb-2">
                      <span className="text-sm font-semibold text-gray-800">{section.label}</span>
                      <button className="text-[10px] text-brand-600 hover:text-brand-700 font-medium flex items-center gap-1">
                        <Zap size={10} />AI assist
                      </button>
                    </label>
                    <textarea
                      className="w-full px-4 py-3 rounded-lg border border-gray-200 text-sm outline-none focus:ring-2 focus:ring-brand-500 focus:border-brand-500 transition-colors resize-none leading-relaxed font-mono text-gray-700"
                      rows={5}
                      placeholder={section.placeholder}
                      value={soap[section.key as keyof typeof soap]}
                      onChange={(e) => setSoap((p) => ({ ...p, [section.key]: e.target.value }))}
                    />
                  </div>
                ))}
              </div>
            )}

            {activeTab === 'vitals' && (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-semibold text-gray-800">Vitals history</h3>
                  <button className="flex items-center gap-1.5 px-3 py-1.5 bg-brand-600 text-white text-xs font-medium rounded-lg hover:bg-brand-700"><Plus size={12} />Record vitals</button>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead><tr className="border-b border-gray-200">
                      {['Date','BP','Pulse','SpO₂','Temp','RR','Sugar'].map((h) => (
                        <th key={h} className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">{h}</th>
                      ))}
                    </tr></thead>
                    <tbody className="divide-y divide-gray-50">
                      {PATIENT.vitals_history.map((v, i) => (
                        <tr key={i} className={i === 0 ? 'bg-blue-50/30' : ''}>
                          <td className="px-4 py-2.5 text-xs font-medium text-gray-700">{v.date}</td>
                          <td className="px-4 py-2.5"><span className={cn('font-mono font-medium', parseInt(v.bp) > 140 ? 'text-amber-700' : 'text-gray-900')}>{v.bp}</span></td>
                          <td className="px-4 py-2.5 font-mono">{v.pulse}</td>
                          <td className="px-4 py-2.5 font-mono">{v.spo2}%</td>
                          <td className="px-4 py-2.5 font-mono">{v.temp}°F</td>
                          <td className="px-4 py-2.5 font-mono">{v.rr}</td>
                          <td className="px-4 py-2.5"><span className={cn('font-mono font-medium', v.sugar > 140 ? 'text-amber-700' : 'text-gray-900')}>{v.sugar}</span></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {activeTab === 'rx' && (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-semibold text-gray-800">Current medications</h3>
                  <button className="flex items-center gap-1.5 px-3 py-1.5 bg-brand-600 text-white text-xs font-medium rounded-lg hover:bg-brand-700"><Plus size={12} />Add medication</button>
                </div>
                <div className="space-y-2">
                  {PATIENT.medications.map((m, i) => (
                    <div key={i} className="flex items-center justify-between px-4 py-3 bg-gray-50 rounded-lg border border-gray-100">
                      <div>
                        <p className="text-sm font-medium text-gray-900">{m.drug}</p>
                        <p className="text-xs text-gray-500">{m.freq} · {m.route} · Since {m.since}</p>
                      </div>
                      <div className="flex items-center gap-2">
                        <button className="text-xs text-brand-600 hover:text-brand-700 font-medium">Edit</button>
                        <button className="text-xs text-red-500 hover:text-red-600 font-medium">Stop</button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {activeTab === 'labs' && (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-semibold text-gray-800">Recent lab results</h3>
                  <button className="flex items-center gap-1.5 px-3 py-1.5 bg-brand-600 text-white text-xs font-medium rounded-lg hover:bg-brand-700"><Plus size={12} />Order lab test</button>
                </div>
                <table className="w-full text-sm">
                  <thead><tr className="border-b border-gray-200">
                    {['Test','Result','Reference','Date',''].map((h) => (
                      <th key={h} className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">{h}</th>
                    ))}
                  </tr></thead>
                  <tbody className="divide-y divide-gray-50">
                    {PATIENT.recent_labs.map((l, i) => (
                      <tr key={i}>
                        <td className="px-4 py-2.5 font-medium text-gray-900">{l.test}</td>
                        <td className="px-4 py-2.5">
                          <span className={cn('font-mono font-medium', l.flag === 'H' ? 'text-red-600' : l.flag === 'L' ? 'text-blue-600' : 'text-gray-900')}>{l.value}</span>
                          {l.flag && <span className={cn('ml-1 text-[10px] font-bold px-1 py-0.5 rounded', l.flag === 'H' ? 'bg-red-100 text-red-600' : 'bg-blue-100 text-blue-600')}>{l.flag}</span>}
                        </td>
                        <td className="px-4 py-2.5 text-gray-500 text-xs">{l.range}</td>
                        <td className="px-4 py-2.5 text-gray-500 text-xs">{l.date}</td>
                        <td className="px-4 py-2.5"><button className="text-xs text-brand-600 hover:underline">Trend</button></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {activeTab === 'orders' && (
              <div className="flex flex-col items-center justify-center h-48 text-gray-400">
                <Send size={28} className="mb-2 text-gray-300" />
                <p className="text-sm">Order entry — lab, radiology, pharmacy, procedure</p>
                <p className="text-xs mt-1">Coming next session</p>
              </div>
            )}

            {activeTab === 'radiology' && (
              <div className="flex flex-col items-center justify-center h-48 text-gray-400">
                <ScanLine size={28} className="mb-2 text-gray-300" />
                <p className="text-sm">PACS viewer and radiology reports</p>
                <p className="text-xs mt-1">Coming next session</p>
              </div>
            )}

            {activeTab === 'history' && (
              <div className="space-y-4">
                <h3 className="text-sm font-semibold text-gray-800">Active diagnoses</h3>
                <div className="space-y-2">
                  {PATIENT.diagnoses.map((d, i) => (
                    <div key={i} className="flex items-center justify-between px-4 py-3 rounded-lg border border-gray-100 bg-gray-50">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-mono bg-gray-200 text-gray-700 px-1.5 py-0.5 rounded">{d.code}</span>
                          <span className="text-sm font-medium text-gray-900">{d.desc}</span>
                        </div>
                        <p className="text-xs text-gray-500 mt-0.5">Since {d.date} · {d.status}</p>
                      </div>
                      <CheckCircle size={14} className="text-green-500" />
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* CDSS Sidebar */}
        {showCDSS && (
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm">
            <div className="px-4 py-3 border-b border-gray-100 flex items-center gap-2">
              <Brain size={14} className="text-brand-600" />
              <h3 className="text-sm font-semibold text-gray-900">Clinical decision support</h3>
            </div>
            <div className="p-3 space-y-2">
              {CDSS_ALERTS.map((a, i) => { const I = a.icon; return (
                <div key={i} className={cn('rounded-lg border p-3', alertStyles[a.type])}>
                  <div className="flex items-start gap-2">
                    <I size={14} className={cn('mt-0.5 flex-shrink-0', alertIconStyles[a.type])} />
                    <div>
                      <p className="text-xs font-semibold text-gray-800">{a.title}</p>
                      <p className="text-xs text-gray-600 mt-1 leading-relaxed">{a.msg}</p>
                    </div>
                  </div>
                </div>
              );})}
            </div>
            <div className="px-4 py-3 border-t border-gray-100">
              <button className="w-full py-2 bg-brand-50 text-brand-700 text-xs font-medium rounded-lg hover:bg-brand-100 transition-colors flex items-center justify-center gap-1.5">
                <Zap size={12} />Generate AI discharge summary
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
