// components/ipd/smart-rounds.tsx
'use client';

import React, { useState, useMemo } from 'react';

interface Props {
  rounds: any[]; admissionDx: string; staffId: string; loading: boolean;
  onSave: (round: any) => Promise<void>; onFlash: (m: string) => void;
}

const SUBJECTIVE_CHIPS: Record<string, string[]> = {
  general: ['No complaints','Feeling better','Pain improved','Slept well','Appetite improved','Mild discomfort','Weakness','Giddiness','Nausea','Fever','Poor appetite','Not slept well'],
  cardiac: ['No chest pain','Chest pain at rest','Chest pain on exertion','Palpitations','Dyspnea on exertion','Orthopnea','PND','Pedal edema'],
  respiratory: ['No breathlessness','Breathlessness improved','Cough reduced','Sputum less','Wheeze reduced','Oxygen comfortable','Difficulty breathing','Cough persistent'],
  neuro: ['More alert','Speech improving','Weakness same','Weakness improving','Headache','Giddiness','Seizure','Confusion'],
  surgical: ['Pain controlled','Pain 3/10','Pain 5/10','Pain 8/10','Wound comfortable','Drain output reduced','Flatus passed','Bowels opened','Tolerating orals'],
  gi: ['No hematemesis','No melena','Appetite improving','Tolerating liquids','Tolerating solids','Abdominal pain reduced','Nausea resolved'],
};

const OBJECTIVE_CHIPS = ['Vitals stable','Afebrile','Hemodynamically stable','CVS S1S2 normal no murmur','RS AEBE clear','PA soft non-tender','No pedal edema','Wound clean','Drain minimal serous','JVP not raised','GCS 15/15','Alert and oriented','Pupils BERL','Bowel sounds present'];

const ASSESSMENT_CHIPS_BY_DX: Record<string, string[]> = {
  cardiac: ['Hemodynamically stable','Post-PCI Day ','No recurrent ischemia','EF improving','Heart failure compensated','Arrhythmia controlled'],
  respiratory: ['ABG improving','Weaning from ventilator','O2 requirement reducing','Infection resolving','COPD stable'],
  neuro: ['NIHSS improving','GCS stable','No new neuro deficit','Rehab progressing','Seizure free'],
  surgical: ['Post-op Day ','Wound healing well','No SSI','Tolerating orals','Drain output reducing'],
  gi: ['No re-bleed','Hemoglobin stable','Tolerating diet','H. pylori treatment started'],
  metabolic: ['DKA resolving','Anion gap closing','Blood sugar stabilizing','Transitioning to SC insulin'],
  general: ['Improving','Stable','Under observation','Responding to treatment','For step down'],
};

const PLAN_CHIPS_BY_DX: Record<string, string[]> = {
  cardiac: ['Continue DAPT','Continue statin','Continue beta-blocker','Continue ACEi/ARB','Repeat Echo','Cardiac rehab referral','Wean IV to oral','Plan discharge if stable'],
  respiratory: ['Continue nebulization','Wean O2','Switch IV to oral antibiotics','Repeat ABG','Chest physiotherapy','Continue NIV','Sputum culture follow-up'],
  neuro: ['Continue antiplatelets','PT/OT/Speech therapy','MRI follow-up','Repeat NIHSS','DVT prophylaxis','Swallow assessment','Family counseling'],
  surgical: ['Continue antibiotics','Remove drain','Wound dressing','Advance diet','PT mobilization','Suture removal Day ','DVT prophylaxis','Plan discharge Day '],
  gi: ['Continue IV PPI','Switch to oral PPI','H. pylori triple therapy','Repeat EGD in 8 weeks','Avoid NSAIDs','Advance diet gradually'],
  metabolic: ['Insulin titration','Endocrine consult','Diabetes education','Monitor RBS QID','Diabetic diet'],
  general: ['Continue current management','Review labs','Consultant opinion','Increase activity','Dietitian review','Plan discharge'],
};

const DIET_CHIPS = ['NPO','Clear liquids','Liquid diet','Soft diet','Normal diet','Cardiac diet (low salt)','Diabetic diet','High protein','Renal diet','Light diet','Advance as tolerated'];
const ACTIVITY_CHIPS = ['Strict bed rest','Bed rest with BSC','Sit up in bed','Chair transfer','Ambulate with assist','Ambulate freely','PT exercises','CPM machine','OOB to chair'];

export default function SmartRounds({ rounds, admissionDx, staffId, loading, onSave, onFlash }: Props) {
  const [showForm, setShowForm] = useState(false);
  const [copyFrom, setCopyFrom] = useState<any>(null);
  const [form, setForm] = useState({
    roundType: 'routine', subjective: '', objective: '', assessment: '', plan: '',
    dietInstruction: '', activityLevel: '', codeStatus: '',
  });

  // Detect specialty from diagnosis
  const specialty = useMemo(() => {
    const d = (admissionDx || '').toLowerCase();
    if (d.includes('stemi') || d.includes('mi') || d.includes('cardiac') || d.includes('angina') || d.includes('ptca') || d.includes('cabg')) return 'cardiac';
    if (d.includes('copd') || d.includes('pneumonia') || d.includes('respiratory') || d.includes('asthma')) return 'respiratory';
    if (d.includes('stroke') || d.includes('mca') || d.includes('neuro') || d.includes('seizure') || d.includes('gcs')) return 'neuro';
    if (d.includes('surgery') || d.includes('cholecystectomy') || d.includes('tkr') || d.includes('lap') || d.includes('fracture') || d.includes('appendic')) return 'surgical';
    if (d.includes('gi bleed') || d.includes('ulcer') || d.includes('hematemesis') || d.includes('melena') || d.includes('liver') || d.includes('pancreat')) return 'gi';
    if (d.includes('dka') || d.includes('diabet') || d.includes('ketoacid') || d.includes('hypogly')) return 'metabolic';
    return 'general';
  }, [admissionDx]);

  const subChips = [...(SUBJECTIVE_CHIPS[specialty] || []), ...(SUBJECTIVE_CHIPS.general || [])].filter((v, i, a) => a.indexOf(v) === i);
  const assessChips = [...(ASSESSMENT_CHIPS_BY_DX[specialty] || []), ...(ASSESSMENT_CHIPS_BY_DX.general || [])].filter((v, i, a) => a.indexOf(v) === i);
  const planChips = [...(PLAN_CHIPS_BY_DX[specialty] || []), ...(PLAN_CHIPS_BY_DX.general || [])].filter((v, i, a) => a.indexOf(v) === i);

  const appendField = (field: 'subjective' | 'objective' | 'assessment' | 'plan', text: string) => {
    setForm(f => {
      const current = f[field].trim();
      const newVal = current ? current + '. ' + text : text;
      return { ...f, [field]: newVal };
    });
  };

  const copyForward = (round: any) => {
    setCopyFrom(round);
    setForm({
      roundType: 'routine',
      subjective: round.subjective || '',
      objective: round.objective || '',
      assessment: round.assessment || '',
      plan: round.plan || '',
      dietInstruction: round.diet_instruction || '',
      activityLevel: round.activity_level || '',
      codeStatus: round.code_status || '',
    });
    setShowForm(true);
  };

  const saveRound = async () => {
    await onSave({ doctorId: staffId, ...form });
    setShowForm(false);
    setCopyFrom(null);
    setForm({ roundType: 'routine', subjective: '', objective: '', assessment: '', plan: '', dietInstruction: '', activityLevel: '', codeStatus: '' });
    onFlash('Round saved');
  };

  return (
    <div>
      <div className="flex justify-between items-center mb-3">
        <h2 className="font-semibold text-sm">Doctor Rounds / Progress Notes</h2>
        <div className="flex gap-2">
          {rounds.length > 0 && !showForm && <button onClick={() => copyForward(rounds[0])} className="px-3 py-1.5 bg-purple-600 text-white text-xs rounded-lg">Copy Last Note & Edit</button>}
          <button onClick={() => { setShowForm(!showForm); setCopyFrom(null); if (showForm) setForm({ roundType: 'routine', subjective: '', objective: '', assessment: '', plan: '', dietInstruction: '', activityLevel: '', codeStatus: '' }); }}
            className="px-3 py-1.5 bg-blue-600 text-white text-xs rounded-lg">{showForm ? 'Cancel' : '+ New Round'}</button>
        </div>
      </div>

      {showForm && <div className="bg-white rounded-xl border p-5 mb-4 space-y-3">
        {copyFrom && <div className="bg-purple-50 border border-purple-200 rounded-lg p-2 text-xs text-purple-700 mb-2">
          Copied from {new Date(copyFrom.round_date || copyFrom.created_at).toLocaleDateString('en-IN')} round by Dr. {copyFrom.doctor?.full_name}. <b>Edit as needed below.</b>
        </div>}

        <div className="grid grid-cols-3 gap-3">
          <div><label className="text-xs text-gray-500">Round type</label>
            <select value={form.roundType} onChange={e => setForm(f => ({...f, roundType: e.target.value}))} className="w-full px-3 py-2 border rounded-lg text-sm">
              {['admission','routine','consultant','shift_handover','discharge'].map(t => <option key={t}>{t}</option>)}</select></div>
          <div><label className="text-xs text-gray-500">Code status</label>
            <div className="flex gap-1 mt-1">{['full_code','dnr','dni','comfort_only'].map(c => (
              <button key={c} onClick={() => setForm(f => ({...f, codeStatus: f.codeStatus === c ? '' : c}))}
                className={`px-2 py-1 rounded text-[10px] border ${form.codeStatus === c ? (c === 'full_code' ? 'bg-green-100 text-green-700 border-green-300' : 'bg-red-100 text-red-700 border-red-300') : 'bg-white text-gray-500 border-gray-200'}`}>{c.replace('_',' ').toUpperCase()}</button>
            ))}</div></div>
          <div><label className="text-xs text-gray-500 block">Specialty detected</label>
            <span className="inline-block mt-1 px-2 py-1 rounded bg-blue-50 text-blue-700 text-xs font-medium">{specialty}</span></div>
        </div>

        {/* SUBJECTIVE — click chips */}
        <div><label className="text-xs text-gray-500 font-medium">S — Subjective <span className="text-gray-400">(click chips or type)</span></label>
          <div className="flex flex-wrap gap-1 my-1">{subChips.map(c => (
            <button key={c} onClick={() => appendField('subjective', c)} className="px-2 py-0.5 rounded border text-[10px] bg-blue-50 text-blue-700 border-blue-200 hover:bg-blue-100">{c}</button>
          ))}</div>
          <textarea value={form.subjective} onChange={e => setForm(f => ({...f, subjective: e.target.value}))} rows={2} className="w-full px-3 py-2 border rounded-lg text-sm" /></div>

        {/* OBJECTIVE — click chips */}
        <div><label className="text-xs text-gray-500 font-medium">O — Objective <span className="text-gray-400">(click chips or type)</span></label>
          <div className="flex flex-wrap gap-1 my-1">{OBJECTIVE_CHIPS.map(c => (
            <button key={c} onClick={() => appendField('objective', c)} className="px-2 py-0.5 rounded border text-[10px] bg-green-50 text-green-700 border-green-200 hover:bg-green-100">{c}</button>
          ))}</div>
          <textarea value={form.objective} onChange={e => setForm(f => ({...f, objective: e.target.value}))} rows={2} className="w-full px-3 py-2 border rounded-lg text-sm" /></div>

        {/* ASSESSMENT — diagnosis-driven chips */}
        <div><label className="text-xs text-gray-500 font-medium">A — Assessment <span className="text-gray-400">(diagnosis-driven suggestions)</span></label>
          <div className="flex flex-wrap gap-1 my-1">{assessChips.map(c => (
            <button key={c} onClick={() => appendField('assessment', c)} className="px-2 py-0.5 rounded border text-[10px] bg-orange-50 text-orange-700 border-orange-200 hover:bg-orange-100">{c}</button>
          ))}</div>
          <textarea value={form.assessment} onChange={e => setForm(f => ({...f, assessment: e.target.value}))} rows={2} className="w-full px-3 py-2 border rounded-lg text-sm" /></div>

        {/* PLAN — diagnosis-driven chips */}
        <div><label className="text-xs text-gray-500 font-medium">P — Plan <span className="text-gray-400">(diagnosis-driven suggestions)</span></label>
          <div className="flex flex-wrap gap-1 my-1">{planChips.map(c => (
            <button key={c} onClick={() => appendField('plan', c)} className="px-2 py-0.5 rounded border text-[10px] bg-purple-50 text-purple-700 border-purple-200 hover:bg-purple-100">{c}</button>
          ))}</div>
          <textarea value={form.plan} onChange={e => setForm(f => ({...f, plan: e.target.value}))} rows={2} className="w-full px-3 py-2 border rounded-lg text-sm" /></div>

        {/* Diet — click chips */}
        <div><label className="text-xs text-gray-500 font-medium">Diet</label>
          <div className="flex flex-wrap gap-1 mt-1">{DIET_CHIPS.map(c => (
            <button key={c} onClick={() => setForm(f => ({...f, dietInstruction: c}))}
              className={`px-2 py-0.5 rounded border text-[10px] ${form.dietInstruction === c ? 'bg-green-100 text-green-700 border-green-300' : 'bg-white text-gray-500 border-gray-200'}`}>{c}</button>
          ))}</div></div>

        {/* Activity — click chips */}
        <div><label className="text-xs text-gray-500 font-medium">Activity</label>
          <div className="flex flex-wrap gap-1 mt-1">{ACTIVITY_CHIPS.map(c => (
            <button key={c} onClick={() => setForm(f => ({...f, activityLevel: c.substring(0, 30)}))}
              className={`px-2 py-0.5 rounded border text-[10px] ${form.activityLevel === c.substring(0, 30) ? 'bg-blue-100 text-blue-700 border-blue-300' : 'bg-white text-gray-500 border-gray-200'}`}>{c}</button>
          ))}</div></div>

        <button onClick={saveRound} className="px-4 py-2 bg-green-600 text-white text-sm rounded-lg font-medium">Save Round</button>
      </div>}

      {/* Round history */}
      {loading ? <div className="text-center py-6 text-gray-400 text-sm">Loading...</div> :
      rounds.length === 0 ? <div className="text-center py-8 bg-white rounded-xl border text-gray-400 text-sm">No rounds documented</div> :
      <div className="space-y-3">{rounds.map((r: any) => (
        <div key={r.id} className={`bg-white rounded-xl border p-4 ${r.is_critical ? 'border-red-300 bg-red-50' : ''}`}>
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <span className={`px-2 py-0.5 rounded text-xs font-medium ${r.round_type === 'admission' ? 'bg-blue-100 text-blue-700' : r.round_type === 'discharge' ? 'bg-green-100 text-green-700' : r.round_type === 'consultant' ? 'bg-purple-100 text-purple-700' : 'bg-gray-100 text-gray-700'}`}>{r.round_type}</span>
              <span className="text-xs text-gray-400">{new Date(r.created_at).toLocaleString('en-IN', { day:'2-digit', month:'short', hour:'2-digit', minute:'2-digit' })}</span>
              <span className="text-xs text-gray-500">Dr. {r.doctor?.full_name}</span>
              {r.code_status && <span className={`text-[10px] px-1.5 py-0.5 rounded ${r.code_status === 'full_code' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>{r.code_status.replace('_',' ').toUpperCase()}</span>}
            </div>
            <button onClick={() => copyForward(r)} className="px-2 py-1 bg-purple-50 text-purple-700 text-[10px] rounded hover:bg-purple-100" title="Copy this note and edit">Copy & Edit</button>
          </div>
          <div className="grid grid-cols-2 gap-3 text-xs">
            {r.subjective && <div><span className="font-medium text-blue-600">S:</span> {r.subjective}</div>}
            {r.objective && <div><span className="font-medium text-green-600">O:</span> {r.objective}</div>}
            {r.assessment && <div><span className="font-medium text-orange-600">A:</span> {r.assessment}</div>}
            {r.plan && <div><span className="font-medium text-purple-600">P:</span> {r.plan}</div>}
          </div>
          {(r.diet_instruction || r.activity_level) && <div className="text-xs text-gray-500 mt-2">{r.diet_instruction && <span>Diet: {r.diet_instruction}</span>}{r.activity_level && <span className="ml-3">Activity: {r.activity_level}</span>}</div>}
        </div>
      ))}</div>}
    </div>
  );
}
