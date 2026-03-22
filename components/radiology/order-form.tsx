// components/radiology/order-form.tsx
// Radiology order creation with safety validations
'use client';
import React, { useState, useEffect, useMemo } from 'react';
import { useRadiologyTests, useRadiologyWorklist } from '@/lib/radiology/radiology-hooks';
import { sb } from '@/lib/supabase/browser';

const MOD_COLORS: Record<string, string> = { XR: 'bg-blue-100 text-blue-700', CT: 'bg-purple-100 text-purple-700', MRI: 'bg-indigo-100 text-indigo-700', USG: 'bg-green-100 text-green-700', ECHO: 'bg-red-100 text-red-700', DEXA: 'bg-teal-100 text-teal-700', MAMMO: 'bg-pink-100 text-pink-700', FLUORO: 'bg-amber-100 text-amber-700' };

interface Props {
  centreId: string;
  staffId: string;
  onComplete: (accession: string) => void;
  onFlash: (msg: string) => void;
  // Pre-fill from EMR context
  prefilledPatientId?: string;
  prefilledPatientName?: string;
  prefilledAdmissionId?: string;
  prefilledEncounterId?: string;
}

export default function RadiologyOrderForm({ centreId, staffId, onComplete, onFlash, prefilledPatientId, prefilledPatientName, prefilledAdmissionId, prefilledEncounterId }: Props) {
  const testMaster = useRadiologyTests();
  const worklist = useRadiologyWorklist(centreId);
  const [error, setError] = useState('');
  const [warning, setWarning] = useState('');

  const [form, setForm] = useState({
    test_id: '', patient_id: prefilledPatientId || '', clinical_indication: '',
    urgency: 'routine', creatinine_value: '', contrast_allergy_checked: false,
    pregnancy_status: 'na', lmp_date: '', scheduled_date: '', scheduled_time: '',
    ordered_by: staffId,
    admission_id: prefilledAdmissionId || '', encounter_id: prefilledEncounterId || '',
  });

  const [testSearch, setTestSearch] = useState('');
  const [selectedTest, setSelectedTest] = useState<any>(null);
  const [patSearch, setPatSearch] = useState(prefilledPatientName || '');
  const [patResults, setPatResults] = useState<any[]>([]);
  const [selectedPatient, setSelectedPatient] = useState<any>(prefilledPatientId ? { id: prefilledPatientId, name: prefilledPatientName } : null);

  const testResults = useMemo(() => testMaster.search(testSearch), [testSearch, testMaster]);

  // Patient search
  useEffect(() => {
    if (patSearch.length < 2 || prefilledPatientId || !sb()) { setPatResults([]); return; }
    const t = setTimeout(async () => {
      const { data } = await sb().from('hmis_patients')
        .select('id, uhid, first_name, last_name, age_years, gender, date_of_birth')
        .or(`uhid.ilike.%${patSearch}%,first_name.ilike.%${patSearch}%,phone_primary.ilike.%${patSearch}%`)
        .eq('is_active', true).limit(8);
      setPatResults(data || []);
    }, 300);
    return () => clearTimeout(t);
  }, [patSearch, prefilledPatientId]);

  // Auto-fetch recent creatinine for contrast studies
  useEffect(() => {
    if (!selectedTest?.is_contrast || !form.patient_id || !sb()) return;
    sb().from('hmis_lab_orders')
      .select('id, status, created_at, test:hmis_lab_test_master!inner(test_name)')
      .eq('patient_id', form.patient_id).eq('test.test_name', 'Serum Creatinine')
      .eq('status', 'completed').order('created_at', { ascending: false }).limit(1)
      .then(({ data }: any) => {
        if (data?.[0]) setWarning(`Last creatinine test: ${new Date(data[0].created_at).toLocaleDateString('en-IN')}. Verify value is current.`);
      });
  }, [selectedTest, form.patient_id]);

  // Gender-based pregnancy check
  useEffect(() => {
    if (!selectedPatient || !selectedTest) return;
    if (selectedPatient.gender?.toLowerCase() === 'male') {
      setForm(f => ({ ...f, pregnancy_status: 'na' }));
    }
  }, [selectedPatient, selectedTest]);

  const submit = async () => {
    setError(''); setWarning('');
    const result = await worklist.createOrder(form);
    if (!result.success) { setError(result.error || 'Failed'); return; }
    if ((result as any)._creatinine_warning) setWarning((result as any)._creatinine_warning);
    if ((result as any)._pregnancy_warning) setWarning((result as any)._pregnancy_warning);
    onFlash('Order created: ' + result.order?.accession_number);
    onComplete(result.order?.accession_number);
  };

  return (
    <div className="bg-white rounded-xl border p-5 space-y-4">
      <h2 className="font-bold text-sm">Create Radiology Order</h2>

      {/* Test selection */}
      <div className="grid grid-cols-2 gap-4">
        <div className="relative">
          <label className="text-xs text-gray-500 font-medium">Imaging Test *</label>
          {selectedTest ? (
            <div className="bg-blue-50 rounded-lg px-3 py-2 flex justify-between mt-1">
              <div className="flex items-center gap-2"><span className={`px-1.5 py-0.5 rounded text-[9px] ${MOD_COLORS[selectedTest.modality] || ''}`}>{selectedTest.modality}</span><span className="text-sm font-medium">{selectedTest.test_name}</span>
                {selectedTest.is_contrast && <span className="text-[9px] bg-amber-100 text-amber-700 px-1 rounded">Contrast</span>}</div>
              <button onClick={() => { setSelectedTest(null); setForm(f => ({ ...f, test_id: '' })); }} className="text-xs text-red-500">Change</button>
            </div>
          ) : (
            <div className="relative">
              <input type="text" value={testSearch} onChange={e => setTestSearch(e.target.value)} className="w-full px-3 py-2 border rounded-lg text-sm mt-1" placeholder="Search: CT Brain, MRI Knee, X-Ray Chest..." />
              {testResults.length > 0 && <div className="absolute top-full left-0 right-0 mt-1 bg-white border rounded-lg shadow-lg z-10 max-h-48 overflow-y-auto">
                {testResults.map(t => (
                  <button key={t.id} onClick={() => { setSelectedTest(t); setForm(f => ({ ...f, test_id: t.id })); setTestSearch(''); }}
                    className="w-full text-left px-3 py-2 text-xs hover:bg-blue-50 border-b flex items-center gap-2">
                    <span className={`px-1 py-0.5 rounded text-[9px] ${MOD_COLORS[t.modality] || ''}`}>{t.modality}</span>
                    <span>{t.test_name}</span><span className="text-gray-400">{t.body_part}</span>
                    {t.is_contrast && <span className="text-amber-600 text-[9px]">(Contrast)</span>}
                    <span className="text-gray-300 ml-auto">TAT: {t.tat_hours}h</span>
                  </button>
                ))}
              </div>}
            </div>
          )}
        </div>

        {/* Patient */}
        <div className="relative">
          <label className="text-xs text-gray-500 font-medium">Patient *</label>
          {selectedPatient ? (
            <div className="bg-blue-50 rounded-lg px-3 py-2 flex justify-between mt-1">
              <span className="text-sm font-medium">{selectedPatient.name || selectedPatient.first_name + ' ' + selectedPatient.last_name} — {selectedPatient.uhid} — {selectedPatient.age_years}y {selectedPatient.gender}</span>
              {!prefilledPatientId && <button onClick={() => { setSelectedPatient(null); setForm(f => ({ ...f, patient_id: '' })); setPatSearch(''); }} className="text-xs text-red-500">Change</button>}
            </div>
          ) : (
            <div className="relative">
              <input type="text" value={patSearch} onChange={e => setPatSearch(e.target.value)} className="w-full px-3 py-2 border rounded-lg text-sm mt-1" placeholder="UHID, name, or phone" />
              {patResults.length > 0 && <div className="absolute top-full left-0 right-0 mt-1 bg-white border rounded-lg shadow-lg z-10">
                {patResults.map(p => (
                  <button key={p.id} onClick={() => { setSelectedPatient(p); setForm(f => ({ ...f, patient_id: p.id })); setPatSearch(`${p.first_name} ${p.last_name}`); setPatResults([]); }}
                    className="w-full text-left px-3 py-2 text-sm hover:bg-blue-50 border-b">{p.first_name} {p.last_name} — {p.uhid} — {p.age_years}y {p.gender}</button>
                ))}
              </div>}
            </div>
          )}
        </div>
      </div>

      {/* Clinical indication + urgency */}
      <div className="grid grid-cols-3 gap-4">
        <div className="col-span-2">
          <label className="text-xs text-gray-500 font-medium">Clinical Indication</label>
          <input type="text" value={form.clinical_indication} onChange={e => setForm(f => ({ ...f, clinical_indication: e.target.value }))} className="w-full px-3 py-2 border rounded-lg text-sm mt-1" placeholder="R/O fracture, evaluate mass, post-op check..." />
        </div>
        <div>
          <label className="text-xs text-gray-500 font-medium">Urgency</label>
          <div className="flex gap-1 mt-1">{['routine', 'urgent', 'stat'].map(u => (
            <button key={u} onClick={() => setForm(f => ({ ...f, urgency: u }))}
              className={`flex-1 py-2 rounded-lg text-xs border font-medium ${form.urgency === u ? u === 'stat' ? 'bg-red-600 text-white border-red-600' : u === 'urgent' ? 'bg-amber-500 text-white border-amber-500' : 'bg-blue-600 text-white border-blue-600' : 'bg-white border-gray-200'}`}>{u.toUpperCase()}</button>
          ))}</div>
        </div>
      </div>

      {/* Contrast safety fields */}
      {selectedTest?.is_contrast && <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 space-y-3">
        <div className="text-xs font-bold text-amber-700">⚠ Contrast Study Safety Checks</div>
        <div className="grid grid-cols-3 gap-3">
          <div><label className="text-xs text-gray-500">Creatinine (mg/dL) *</label>
            <input type="number" step="0.1" value={form.creatinine_value} onChange={e => setForm(f => ({ ...f, creatinine_value: e.target.value }))}
              className={`w-full px-3 py-2 border rounded-lg text-sm mt-1 ${parseFloat(form.creatinine_value) > 1.5 ? 'border-red-500 bg-red-50' : ''}`} placeholder="e.g., 0.9" />
            {parseFloat(form.creatinine_value) > 1.5 && <div className="text-[10px] text-red-600 mt-0.5 font-medium">EXCEEDS 1.5 — Nephrology clearance required</div>}
            {parseFloat(form.creatinine_value) > 1.2 && parseFloat(form.creatinine_value) <= 1.5 && <div className="text-[10px] text-amber-600 mt-0.5">Borderline — ensure hydration</div>}
          </div>
          <div className="flex items-end">
            <label className="flex items-center gap-2 bg-white rounded-lg px-3 py-2 border w-full cursor-pointer">
              <input type="checkbox" checked={form.contrast_allergy_checked} onChange={e => setForm(f => ({ ...f, contrast_allergy_checked: e.target.checked }))} className="rounded" />
              <span className="text-xs">Contrast allergy checked — no known allergy *</span>
            </label>
          </div>
          {selectedPatient?.gender?.toLowerCase() !== 'male' && ['CT', 'FLUORO'].includes(selectedTest.modality) && <div>
            <label className="text-xs text-gray-500">Pregnancy Status</label>
            <div className="flex gap-1 mt-1">{['na', 'not_pregnant', 'pregnant', 'unknown'].map(p => (
              <button key={p} onClick={() => setForm(f => ({ ...f, pregnancy_status: p }))}
                className={`flex-1 py-1.5 rounded text-[10px] border ${form.pregnancy_status === p ? p === 'pregnant' ? 'bg-red-600 text-white' : 'bg-blue-600 text-white' : 'bg-white'}`}>{p === 'na' ? 'N/A' : p === 'not_pregnant' ? 'Not preg' : p}</button>
            ))}</div>
          </div>}
        </div>
      </div>}

      {/* Ionizing radiation warning for CT/Fluoro */}
      {selectedTest && ['CT', 'FLUORO'].includes(selectedTest.modality) && !selectedTest.is_contrast && selectedPatient?.gender?.toLowerCase() !== 'male' && (
        <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-3">
          <div className="text-xs text-yellow-700">
            <span className="font-bold">Ionizing radiation study.</span> For female patients of childbearing age, confirm pregnancy status.
          </div>
          <div className="flex gap-1 mt-2">{['na', 'not_pregnant', 'pregnant', 'unknown'].map(p => (
            <button key={p} onClick={() => setForm(f => ({ ...f, pregnancy_status: p }))}
              className={`px-2 py-1 rounded text-[10px] border ${form.pregnancy_status === p ? 'bg-blue-600 text-white' : 'bg-white'}`}>{p === 'na' ? 'N/A' : p === 'not_pregnant' ? 'Not pregnant' : p}</button>
          ))}</div>
        </div>
      )}

      {/* Schedule */}
      <div className="grid grid-cols-2 gap-4">
        <div><label className="text-xs text-gray-500 font-medium">Scheduled Date (optional)</label>
          <input type="date" value={form.scheduled_date} onChange={e => setForm(f => ({ ...f, scheduled_date: e.target.value }))} className="w-full px-3 py-2 border rounded-lg text-sm mt-1" /></div>
        <div><label className="text-xs text-gray-500 font-medium">Scheduled Time (optional)</label>
          <input type="time" value={form.scheduled_time} onChange={e => setForm(f => ({ ...f, scheduled_time: e.target.value }))} className="w-full px-3 py-2 border rounded-lg text-sm mt-1" /></div>
      </div>

      {warning && <div className="bg-amber-50 border border-amber-200 rounded-lg px-4 py-2 text-xs text-amber-700">{warning}</div>}
      {error && <div className="bg-red-50 border border-red-200 rounded-lg px-4 py-2 text-sm text-red-700">{error}</div>}

      <button onClick={submit} disabled={!form.test_id || !form.patient_id}
        className="px-6 py-2.5 bg-green-600 text-white text-sm rounded-lg font-medium disabled:opacity-40">Create Order</button>
    </div>
  );
}
