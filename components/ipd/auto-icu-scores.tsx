// components/ipd/auto-icu-scores.tsx
'use client';

import React, { useState, useMemo } from 'react';

interface Props {
  scores: any[]; admissionId: string; staffId: string;
  onSave: (score: any, staffId: string) => Promise<void>;
  onFlash: (m: string) => void;
}

type ScoreType = 'gcs' | 'news2' | 'sofa' | 'qsofa' | 'apache2' | 'braden' | 'morse' | 'rass' | 'cam_icu';

const SCORE_META: { type: ScoreType; label: string; description: string; ranges: { min: number; max: number; levels: [number, string, string][] } }[] = [
  { type: 'gcs', label: 'Glasgow Coma Scale', description: 'Level of consciousness', ranges: { min: 3, max: 15, levels: [[15,'Normal','bg-green-100 text-green-700'],[13,'Mild','bg-yellow-100 text-yellow-700'],[9,'Moderate','bg-orange-100 text-orange-700'],[3,'Severe','bg-red-100 text-red-700']] } },
  { type: 'news2', label: 'NEWS2 Score', description: 'National Early Warning Score', ranges: { min: 0, max: 20, levels: [[0,'Low risk','bg-green-100 text-green-700'],[5,'Low-medium','bg-yellow-100 text-yellow-700'],[7,'Medium','bg-orange-100 text-orange-700'],[20,'High','bg-red-100 text-red-700']] } },
  { type: 'sofa', label: 'SOFA Score', description: 'Sequential Organ Failure Assessment', ranges: { min: 0, max: 24, levels: [[0,'<2% mortality','bg-green-100 text-green-700'],[6,'<10% mortality','bg-yellow-100 text-yellow-700'],[12,'40-50% mortality','bg-orange-100 text-orange-700'],[24,'>80% mortality','bg-red-100 text-red-700']] } },
  { type: 'qsofa', label: 'qSOFA', description: 'Quick Sepsis-related Organ Failure', ranges: { min: 0, max: 3, levels: [[0,'Low risk','bg-green-100 text-green-700'],[2,'High risk — assess for sepsis','bg-red-100 text-red-700']] } },
  { type: 'rass', label: 'RASS', description: 'Richmond Agitation-Sedation Scale', ranges: { min: -5, max: 4, levels: [[-5,'Unarousable','bg-red-100 text-red-700'],[-3,'Deep sedation','bg-orange-100 text-orange-700'],[-1,'Light sedation','bg-yellow-100 text-yellow-700'],[0,'Alert & calm','bg-green-100 text-green-700'],[2,'Agitated','bg-orange-100 text-orange-700'],[4,'Combative','bg-red-100 text-red-700']] } },
  { type: 'braden', label: 'Braden Scale', description: 'Pressure injury risk', ranges: { min: 6, max: 23, levels: [[23,'No risk','bg-green-100 text-green-700'],[18,'Mild risk','bg-yellow-100 text-yellow-700'],[14,'Moderate risk','bg-orange-100 text-orange-700'],[6,'High risk','bg-red-100 text-red-700']] } },
  { type: 'morse', label: 'Morse Fall Scale', description: 'Fall risk assessment', ranges: { min: 0, max: 125, levels: [[0,'No risk','bg-green-100 text-green-700'],[25,'Low risk','bg-yellow-100 text-yellow-700'],[45,'Moderate','bg-orange-100 text-orange-700'],[125,'High risk','bg-red-100 text-red-700']] } },
];

// GCS Components
const GCS_EYE = [['4','Spontaneous'],['3','To voice'],['2','To pain'],['1','None']];
const GCS_VERBAL = [['5','Oriented'],['4','Confused'],['3','Inappropriate words'],['2','Incomprehensible'],['1','None']];
const GCS_MOTOR = [['6','Obeys commands'],['5','Localizes pain'],['4','Withdraws'],['3','Abnormal flexion'],['2','Extension'],['1','None']];

// NEWS2 Components
const NEWS2_RR = [[0,'12-20'],[1,'9-11'],[2,'21-24'],[3,'≤8 or ≥25']];
const NEWS2_SPO2 = [[0,'≥96'],[1,'94-95'],[2,'92-93'],[3,'≤91']];
const NEWS2_TEMP = [[0,'36.1-38.0'],[1,'35.1-36.0 or 38.1-39.0'],[2,'≥39.1'],[3,'≤35.0']];
const NEWS2_SBP = [[0,'111-219'],[1,'101-110'],[2,'91-100'],[3,'≤90 or ≥220']];
const NEWS2_HR = [[0,'51-90'],[1,'41-50 or 91-110'],[2,'111-130'],[3,'≤40 or ≥131']];
const NEWS2_CONSCIOUSNESS = [[0,'Alert'],[3,'CVPU (Confusion/Voice/Pain/Unresponsive)']];
const NEWS2_O2 = [[0,'Room air'],[2,'Any supplemental O2']];

// qSOFA
const QSOFA_ITEMS = [['RR ≥ 22', 'Respiratory rate ≥ 22/min'],['SBP ≤ 100', 'Systolic BP ≤ 100 mmHg'],['Altered mentation', 'GCS < 15']];

// RASS
const RASS_LEVELS = [['+4','Combative'],['+3','Very agitated'],['+2','Agitated'],['+1','Restless'],['0','Alert and calm'],['-1','Drowsy'],['-2','Light sedation'],['-3','Moderate sedation'],['-4','Deep sedation'],['-5','Unarousable']];

export default function AutoICUScores({ scores, admissionId, staffId, onSave, onFlash }: Props) {
  const [selectedScore, setSelectedScore] = useState<ScoreType | null>(null);

  // GCS state
  const [gcsE, setGcsE] = useState(4);
  const [gcsV, setGcsV] = useState(5);
  const [gcsM, setGcsM] = useState(6);
  const gcsTotal = gcsE + gcsV + gcsM;

  // NEWS2 state
  const [n2, setN2] = useState({ rr: 0, spo2: 0, temp: 0, sbp: 0, hr: 0, consciousness: 0, o2: 0 });
  const news2Total = Object.values(n2).reduce((a, b) => a + b, 0);

  // qSOFA state
  const [qsofa, setQsofa] = useState([false, false, false]);
  const qsofaTotal = qsofa.filter(Boolean).length;

  // RASS state
  const [rassVal, setRassVal] = useState(0);

  // Braden state
  const [braden, setBraden] = useState({ sensory: 4, moisture: 4, activity: 4, mobility: 4, nutrition: 4, friction: 3 });
  const bradenTotal = Object.values(braden).reduce((a, b) => a + b, 0);

  const getInterpretation = (type: ScoreType, value: number): { text: string; color: string } => {
    const meta = SCORE_META.find(s => s.type === type);
    if (!meta) return { text: '', color: '' };
    const levels = meta.ranges.levels;
    // For braden, lower = worse (reverse)
    if (type === 'braden') {
      if (value >= 19) return { text: 'No risk', color: 'bg-green-100 text-green-700' };
      if (value >= 15) return { text: 'Mild risk', color: 'bg-yellow-100 text-yellow-700' };
      if (value >= 13) return { text: 'Moderate risk', color: 'bg-orange-100 text-orange-700' };
      return { text: 'High risk — turn schedule Q2H', color: 'bg-red-100 text-red-700' };
    }
    if (type === 'gcs') {
      if (value >= 13) return { text: 'Mild (GCS 13-15)', color: 'bg-green-100 text-green-700' };
      if (value >= 9) return { text: 'Moderate (GCS 9-12)', color: 'bg-orange-100 text-orange-700' };
      return { text: 'Severe (GCS 3-8) — protect airway', color: 'bg-red-100 text-red-700' };
    }
    if (type === 'news2') {
      if (value <= 4) return { text: 'Low clinical risk', color: 'bg-green-100 text-green-700' };
      if (value <= 6) return { text: 'Low-medium — urgent ward review', color: 'bg-yellow-100 text-yellow-700' };
      return { text: value >= 7 ? 'HIGH — emergency assessment, consider ICU' : 'Medium risk', color: 'bg-red-100 text-red-700' };
    }
    if (type === 'qsofa') return value >= 2 ? { text: 'Screen positive — assess for organ dysfunction', color: 'bg-red-100 text-red-700' } : { text: 'Low risk', color: 'bg-green-100 text-green-700' };
    if (type === 'rass') {
      if (value === 0) return { text: 'Alert and calm — target for most ICU patients', color: 'bg-green-100 text-green-700' };
      if (value >= 1) return { text: value >= 3 ? 'Dangerously agitated' : 'Agitated — consider sedation', color: 'bg-orange-100 text-orange-700' };
      if (value >= -2) return { text: 'Light sedation — acceptable range', color: 'bg-yellow-100 text-yellow-700' };
      return { text: 'Deep sedation — assess need', color: 'bg-red-100 text-red-700' };
    }
    return { text: '', color: '' };
  };

  const saveScore = async (type: ScoreType, value: number) => {
    const interp = getInterpretation(type, value);
    await onSave({ scoreType: type, scoreValue: value, interpretation: interp.text }, staffId);
    setSelectedScore(null);
    onFlash(`${type.toUpperCase()} score saved: ${value}`);
  };

  return (
    <div>
      <h2 className="font-semibold text-sm mb-3">ICU Scoring Tools</h2>

      {!selectedScore ? (
        <>
          {/* Score selector grid */}
          <div className="grid grid-cols-3 gap-3 mb-4">
            {SCORE_META.map(s => {
              const lastScore = scores.filter(sc => sc.score_type === s.type).sort((a: any, b: any) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())[0];
              return (
                <button key={s.type} onClick={() => setSelectedScore(s.type)}
                  className="bg-white rounded-xl border p-4 text-left hover:border-blue-300 hover:shadow-sm transition-all">
                  <div className="font-semibold text-sm">{s.label}</div>
                  <div className="text-[10px] text-gray-400 mt-0.5">{s.description}</div>
                  {lastScore ? (
                    <div className="mt-2 flex items-center gap-2">
                      <span className="text-xl font-bold">{lastScore.score_value}</span>
                      <span className={`text-[10px] px-1.5 py-0.5 rounded ${getInterpretation(s.type, lastScore.score_value).color}`}>{getInterpretation(s.type, lastScore.score_value).text?.substring(0, 25)}</span>
                    </div>
                  ) : <div className="mt-2 text-xs text-gray-300">Not assessed</div>}
                </button>
              );
            })}
          </div>

          {/* Score history */}
          {scores.length > 0 && <div>
            <h3 className="text-xs text-gray-500 font-medium mb-2">Recent Scores</h3>
            <div className="bg-white rounded-xl border overflow-hidden">
              <table className="w-full text-xs"><thead><tr className="bg-gray-50 border-b">
                <th className="p-2 text-left">Score</th><th className="p-2 text-center">Value</th><th className="p-2 text-left">Interpretation</th><th className="p-2">Date</th>
              </tr></thead><tbody>{scores.slice(0, 20).map((s: any) => (
                <tr key={s.id} className="border-b hover:bg-gray-50">
                  <td className="p-2 font-medium uppercase">{s.score_type}</td>
                  <td className="p-2 text-center text-lg font-bold">{s.score_value}</td>
                  <td className="p-2"><span className={`text-[10px] px-1.5 py-0.5 rounded ${getInterpretation(s.score_type, s.score_value).color}`}>{s.interpretation || getInterpretation(s.score_type, s.score_value).text}</span></td>
                  <td className="p-2 text-center text-gray-400">{new Date(s.created_at).toLocaleString('en-IN', { day:'2-digit', month:'short', hour:'2-digit', minute:'2-digit' })}</td>
                </tr>
              ))}</tbody></table>
            </div>
          </div>}
        </>
      ) : (
        <div className="bg-white rounded-xl border p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-sm">{SCORE_META.find(s => s.type === selectedScore)?.label}</h3>
            <button onClick={() => setSelectedScore(null)} className="text-xs text-gray-500 hover:text-gray-700">← Back to all scores</button>
          </div>

          {/* ===== GCS Calculator ===== */}
          {selectedScore === 'gcs' && <div className="space-y-4">
            <div><label className="text-xs font-medium text-gray-600 mb-1 block">Eye Opening (E)</label>
              <div className="flex gap-1.5">{GCS_EYE.map(([v, l]) => (
                <button key={v} onClick={() => setGcsE(parseInt(v))} className={`flex-1 px-2 py-2 rounded-lg border text-xs text-center ${gcsE === parseInt(v) ? 'bg-blue-600 text-white border-blue-600' : 'bg-white border-gray-200'}`}><div className="font-bold text-sm">{v}</div>{l}</button>
              ))}</div></div>
            <div><label className="text-xs font-medium text-gray-600 mb-1 block">Verbal Response (V)</label>
              <div className="flex gap-1.5">{GCS_VERBAL.map(([v, l]) => (
                <button key={v} onClick={() => setGcsV(parseInt(v))} className={`flex-1 px-2 py-2 rounded-lg border text-xs text-center ${gcsV === parseInt(v) ? 'bg-blue-600 text-white border-blue-600' : 'bg-white border-gray-200'}`}><div className="font-bold text-sm">{v}</div>{l}</button>
              ))}</div></div>
            <div><label className="text-xs font-medium text-gray-600 mb-1 block">Motor Response (M)</label>
              <div className="flex gap-1.5">{GCS_MOTOR.map(([v, l]) => (
                <button key={v} onClick={() => setGcsM(parseInt(v))} className={`flex-1 px-2 py-2 rounded-lg border text-xs text-center ${gcsM === parseInt(v) ? 'bg-blue-600 text-white border-blue-600' : 'bg-white border-gray-200'}`}><div className="font-bold text-sm">{v}</div>{l}</button>
              ))}</div></div>
            <div className={`text-center p-4 rounded-xl ${getInterpretation('gcs', gcsTotal).color}`}>
              <div className="text-3xl font-bold">{gcsTotal}/15</div>
              <div className="text-xs font-medium mt-1">E{gcsE} V{gcsV} M{gcsM} — {getInterpretation('gcs', gcsTotal).text}</div>
            </div>
            <button onClick={() => saveScore('gcs', gcsTotal)} className="w-full py-2.5 bg-green-600 text-white rounded-xl text-sm font-medium">Save GCS: {gcsTotal}/15</button>
          </div>}

          {/* ===== NEWS2 Calculator ===== */}
          {selectedScore === 'news2' && <div className="space-y-3">
            {([['Respiratory Rate', NEWS2_RR, 'rr'],['SpO2 (%)', NEWS2_SPO2, 'spo2'],['Temperature (°C)', NEWS2_TEMP, 'temp'],['Systolic BP', NEWS2_SBP, 'sbp'],['Heart Rate', NEWS2_HR, 'hr'],['Consciousness', NEWS2_CONSCIOUSNESS, 'consciousness'],['Supplemental O2', NEWS2_O2, 'o2']] as [string, any[], string][]).map(([label, options, key]) => (
              <div key={key}><label className="text-xs font-medium text-gray-600">{label}</label>
                <div className="flex gap-1 mt-1">{options.map(([v, l]: any) => (
                  <button key={`${key}-${v}`} onClick={() => setN2(prev => ({...prev, [key]: v}))}
                    className={`flex-1 px-2 py-1.5 rounded border text-[10px] text-center ${(n2 as any)[key] === v ? (v === 0 ? 'bg-green-600 text-white' : v >= 3 ? 'bg-red-600 text-white' : 'bg-yellow-500 text-white') : 'bg-white border-gray-200'}`}>
                    <div className="font-bold">{v}</div><div className="truncate">{l}</div>
                  </button>
                ))}</div></div>
            ))}
            <div className={`text-center p-4 rounded-xl ${getInterpretation('news2', news2Total).color}`}>
              <div className="text-3xl font-bold">{news2Total}</div>
              <div className="text-xs font-medium mt-1">{getInterpretation('news2', news2Total).text}</div>
            </div>
            <button onClick={() => saveScore('news2', news2Total)} className="w-full py-2.5 bg-green-600 text-white rounded-xl text-sm font-medium">Save NEWS2: {news2Total}</button>
          </div>}

          {/* ===== qSOFA Calculator ===== */}
          {selectedScore === 'qsofa' && <div className="space-y-3">
            {QSOFA_ITEMS.map(([short, desc], i) => (
              <button key={i} onClick={() => { const q = [...qsofa]; q[i] = !q[i]; setQsofa(q); }}
                className={`w-full p-3 rounded-xl border text-left flex items-center gap-3 ${qsofa[i] ? 'bg-red-50 border-red-300' : 'bg-white border-gray-200'}`}>
                <span className={`w-8 h-8 rounded-lg flex items-center justify-center text-sm font-bold ${qsofa[i] ? 'bg-red-600 text-white' : 'bg-gray-100 text-gray-400'}`}>{qsofa[i] ? '1' : '0'}</span>
                <div><div className="font-medium text-sm">{short}</div><div className="text-[10px] text-gray-500">{desc}</div></div>
              </button>
            ))}
            <div className={`text-center p-4 rounded-xl ${getInterpretation('qsofa', qsofaTotal).color}`}>
              <div className="text-3xl font-bold">{qsofaTotal}/3</div>
              <div className="text-xs font-medium mt-1">{getInterpretation('qsofa', qsofaTotal).text}</div>
            </div>
            <button onClick={() => saveScore('qsofa', qsofaTotal)} className="w-full py-2.5 bg-green-600 text-white rounded-xl text-sm font-medium">Save qSOFA: {qsofaTotal}/3</button>
          </div>}

          {/* ===== RASS ===== */}
          {selectedScore === 'rass' && <div className="space-y-2">
            {RASS_LEVELS.map(([v, l]) => (
              <button key={v} onClick={() => setRassVal(parseInt(v))}
                className={`w-full p-2.5 rounded-lg border text-left flex items-center gap-3 ${rassVal === parseInt(v) ? 'bg-blue-600 text-white border-blue-600' : 'bg-white border-gray-200'}`}>
                <span className="w-10 text-center font-bold text-lg">{v}</span>
                <span className="text-sm">{l}</span>
              </button>
            ))}
            <div className={`text-center p-4 rounded-xl ${getInterpretation('rass', rassVal).color}`}>
              <div className="text-3xl font-bold">{rassVal >= 0 ? '+' : ''}{rassVal}</div>
              <div className="text-xs font-medium mt-1">{getInterpretation('rass', rassVal).text}</div>
            </div>
            <button onClick={() => saveScore('rass', rassVal)} className="w-full py-2.5 bg-green-600 text-white rounded-xl text-sm font-medium">Save RASS: {rassVal}</button>
          </div>}

          {/* ===== Braden Scale ===== */}
          {selectedScore === 'braden' && <div className="space-y-3">
            {([['sensory','Sensory Perception',['Completely limited (1)','Very limited (2)','Slightly limited (3)','No impairment (4)']],
              ['moisture','Moisture',['Constantly moist (1)','Often moist (2)','Occasionally moist (3)','Rarely moist (4)']],
              ['activity','Activity',['Bedfast (1)','Chairfast (2)','Walks occasionally (3)','Walks frequently (4)']],
              ['mobility','Mobility',['Completely immobile (1)','Very limited (2)','Slightly limited (3)','No limitations (4)']],
              ['nutrition','Nutrition',['Very poor (1)','Probably inadequate (2)','Adequate (3)','Excellent (4)']],
              ['friction','Friction & Shear',['Problem (1)','Potential problem (2)','No apparent problem (3)']],
            ] as [string, string, string[]][]).map(([key, label, options]) => (
              <div key={key}><label className="text-xs font-medium text-gray-600">{label}</label>
                <div className="flex gap-1 mt-1">{options.map((o, i) => {
                  const val = i + 1;
                  return <button key={i} onClick={() => setBraden(prev => ({...prev, [key]: val}))}
                    className={`flex-1 px-1 py-1.5 rounded border text-[10px] text-center ${(braden as any)[key] === val ? 'bg-blue-600 text-white border-blue-600' : 'bg-white border-gray-200'}`}>{o}</button>;
                })}</div></div>
            ))}
            <div className={`text-center p-4 rounded-xl ${getInterpretation('braden', bradenTotal).color}`}>
              <div className="text-3xl font-bold">{bradenTotal}/23</div>
              <div className="text-xs font-medium mt-1">{getInterpretation('braden', bradenTotal).text}</div>
            </div>
            <button onClick={() => saveScore('braden', bradenTotal)} className="w-full py-2.5 bg-green-600 text-white rounded-xl text-sm font-medium">Save Braden: {bradenTotal}/23</button>
          </div>}

          {/* ===== Morse Fall Scale ===== */}
          {selectedScore === 'morse' && <MorseFallCalculator onSave={(val) => saveScore('morse', val)} />}
        </div>
      )}
    </div>
  );
}

// Morse Fall Scale sub-component
function MorseFallCalculator({ onSave }: { onSave: (val: number) => void }) {
  const [m, setM] = useState({ history: 0, secondary: 0, ambulatory: 0, iv: 0, gait: 0, mental: 0 });
  const total = Object.values(m).reduce((a, b) => a + b, 0);
  const interp = total >= 45 ? 'High risk — fall precautions' : total >= 25 ? 'Moderate risk — implement fall prevention' : 'Low risk';
  const color = total >= 45 ? 'bg-red-100 text-red-700' : total >= 25 ? 'bg-yellow-100 text-yellow-700' : 'bg-green-100 text-green-700';

  return <div className="space-y-3">
    {([['history','History of falling',[[0,'No'],[25,'Yes']]],
      ['secondary','Secondary diagnosis',[[0,'No'],[15,'Yes']]],
      ['ambulatory','Ambulatory aid',[[0,'None/bed rest/nurse assist'],[15,'Crutches/cane/walker'],[30,'Furniture for support']]],
      ['iv','IV/Heparin Lock',[[0,'No'],[20,'Yes']]],
      ['gait','Gait',[[0,'Normal/bed rest/wheelchair'],[10,'Weak'],[20,'Impaired']]],
      ['mental','Mental status',[[0,'Oriented to own ability'],[15,'Overestimates/forgets limitations']]],
    ] as [string, string, [number, string][]][]).map(([key, label, options]) => (
      <div key={key}><label className="text-xs font-medium text-gray-600">{label}</label>
        <div className="flex gap-1.5 mt-1">{options.map(([v, l]) => (
          <button key={v} onClick={() => setM(prev => ({...prev, [key]: v}))}
            className={`flex-1 px-2 py-1.5 rounded border text-[10px] text-center ${(m as any)[key] === v ? 'bg-blue-600 text-white border-blue-600' : 'bg-white border-gray-200'}`}>{l} ({v})</button>
        ))}</div></div>
    ))}
    <div className={`text-center p-4 rounded-xl ${color}`}>
      <div className="text-3xl font-bold">{total}</div>
      <div className="text-xs font-medium mt-1">{interp}</div>
    </div>
    <button onClick={() => onSave(total)} className="w-full py-2.5 bg-green-600 text-white rounded-xl text-sm font-medium">Save Morse: {total}</button>
  </div>;
}
