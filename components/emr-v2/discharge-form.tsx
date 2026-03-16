// components/emr-v2/discharge-form.tsx
'use client';

import React, { useState } from 'react';
import { printDischargeSummary } from '@/components/ui/shared';
import { H1_CENTRES } from '@/lib/cdss/centres';
import type { Admission } from '@/lib/revenue/phase2-hooks';

interface Props {
  admission: Admission;
  centreId: string;
  onClose: () => void;
  onDischarge: (admissionId: string, dischargeType: string, finalDiagnosis: string) => void;
}

export default function DischargeForm({ admission, centreId, onClose, onDischarge }: Props) {
  const [form, setForm] = useState({
    dischargeType: 'normal',
    finalDiagnosis: admission.provisionalDiagnosis || '',
    procedures: '',
    investigations: '',
    courseInHospital: '',
    conditionAtDischarge: 'Stable, afebrile, vitals normal',
    adviceText: '',
    medications: [
      { name: '', dose: '', frequency: '', duration: '' },
    ],
    followUpDate: '',
    followUpNotes: 'With reports',
  });

  const u = (key: string, val: any) => setForm(f => ({ ...f, [key]: val }));

  const addMed = () => setForm(f => ({ ...f, medications: [...f.medications, { name: '', dose: '', frequency: '', duration: '' }] }));
  const removeMed = (i: number) => setForm(f => ({ ...f, medications: f.medications.filter((_, j) => j !== i) }));
  const updateMed = (i: number, key: string, val: string) => {
    const meds = [...form.medications];
    meds[i] = { ...meds[i], [key]: val };
    setForm(f => ({ ...f, medications: meds }));
  };

  const handlePrintAndDischarge = () => {
    const centre = H1_CENTRES.find(c => c.id === centreId) || H1_CENTRES[0];
    const adviceList = form.adviceText.split('\n').filter(a => a.trim());

    printDischargeSummary({
      patientName: admission.patientName,
      uhid: admission.patientUhid,
      ageGender: '--',
      ipdNumber: admission.ipdNumber,
      admissionDate: new Date(admission.admissionDate).toLocaleDateString('en-IN'),
      dischargeDate: new Date().toLocaleDateString('en-IN'),
      department: admission.department,
      admittingDoctor: admission.admittingDoctor,
      primaryDoctor: admission.primaryDoctor,
      payorType: admission.payorType,
      provisionalDiagnosis: admission.provisionalDiagnosis || '--',
      finalDiagnosis: form.finalDiagnosis,
      procedures: form.procedures.split('\n').filter(p => p.trim()),
      investigations: form.investigations,
      courseInHospital: form.courseInHospital,
      conditionAtDischarge: form.conditionAtDischarge,
      adviceOnDischarge: adviceList,
      medications: form.medications.filter(m => m.name.trim()),
      followUp: form.followUpDate ? `${form.followUpDate} — ${form.followUpNotes}` : form.followUpNotes || 'As advised',
    }, {
      name: centre.name,
      address: centre.address,
      phone: centre.phone,
      tagline: centre.tagline,
    });

    onDischarge(admission.id, form.dischargeType, form.finalDiagnosis);
  };

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center overflow-y-auto py-4" onClick={onClose}>
      <div className="bg-white rounded-xl p-6 w-full max-w-2xl shadow-xl my-4 max-h-[95vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
        <h2 className="text-lg font-semibold mb-1">Discharge Summary</h2>
        <p className="text-xs text-gray-400 mb-4">{admission.patientName} — {admission.ipdNumber} — {admission.department}</p>

        <div className="space-y-4">
          {/* Discharge type */}
          <div>
            <label className="text-xs font-medium text-gray-500 mb-1 block">Discharge type *</label>
            <select value={form.dischargeType} onChange={e => u('dischargeType', e.target.value)}
              className="w-full px-3 py-2 border rounded-lg text-sm">
              <option value="normal">Normal discharge</option>
              <option value="lama">LAMA (Left Against Medical Advice)</option>
              <option value="dor">DOR (Discharged On Request)</option>
              <option value="transfer">Transfer to another facility</option>
              <option value="absconded">Absconded</option>
              <option value="death">Death</option>
            </select>
          </div>

          {/* Final diagnosis */}
          <div>
            <label className="text-xs font-medium text-gray-500 mb-1 block">Final diagnosis *</label>
            <textarea value={form.finalDiagnosis} onChange={e => u('finalDiagnosis', e.target.value)}
              rows={2} className="w-full px-3 py-2 border rounded-lg text-sm" placeholder="e.g., Acute Inferior STEMI, DM Type 2 (controlled), Essential Hypertension" />
          </div>

          {/* Procedures */}
          <div>
            <label className="text-xs font-medium text-gray-500 mb-1 block">Procedures performed (one per line)</label>
            <textarea value={form.procedures} onChange={e => u('procedures', e.target.value)}
              rows={2} className="w-full px-3 py-2 border rounded-lg text-sm" placeholder="e.g., Primary PTCA to LAD with DES&#10;Temporary Pacemaker Insertion" />
          </div>

          {/* Investigations summary */}
          <div>
            <label className="text-xs font-medium text-gray-500 mb-1 block">Investigations summary</label>
            <textarea value={form.investigations} onChange={e => u('investigations', e.target.value)}
              rows={3} className="w-full px-3 py-2 border rounded-lg text-sm" placeholder="CBC: Hb 12.5, WBC 8200, Platelets 2.1L&#10;RFT: Creatinine 1.1, BUN 22&#10;Troponin I: 4.5 (H)&#10;ECG: ST elevation V1-V4&#10;Echo: EF 45%, RWMA in LAD territory" />
          </div>

          {/* Course in hospital */}
          <div>
            <label className="text-xs font-medium text-gray-500 mb-1 block">Course in hospital *</label>
            <textarea value={form.courseInHospital} onChange={e => u('courseInHospital', e.target.value)}
              rows={4} className="w-full px-3 py-2 border rounded-lg text-sm" placeholder="Patient was admitted via Emergency with complaints of severe chest pain radiating to left arm with sweating since 2 hours. ECG showed ST elevation in V1-V4. Primary PTCA was performed to LAD..." />
          </div>

          {/* Condition at discharge */}
          <div>
            <label className="text-xs font-medium text-gray-500 mb-1 block">Condition at discharge</label>
            <input type="text" value={form.conditionAtDischarge} onChange={e => u('conditionAtDischarge', e.target.value)}
              className="w-full px-3 py-2 border rounded-lg text-sm" />
          </div>

          {/* Medications at discharge */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-xs font-medium text-gray-500">Medications at discharge</label>
              <button onClick={addMed} className="text-xs text-blue-600 hover:text-blue-800">+ Add medication</button>
            </div>
            <div className="space-y-2">
              {form.medications.map((med, i) => (
                <div key={i} className="flex gap-2 items-center">
                  <input type="text" placeholder="Drug name" value={med.name} onChange={e => updateMed(i, 'name', e.target.value)}
                    className="flex-1 px-2 py-1.5 border rounded text-sm" />
                  <input type="text" placeholder="Dose" value={med.dose} onChange={e => updateMed(i, 'dose', e.target.value)}
                    className="w-20 px-2 py-1.5 border rounded text-sm" />
                  <input type="text" placeholder="Freq" value={med.frequency} onChange={e => updateMed(i, 'frequency', e.target.value)}
                    className="w-16 px-2 py-1.5 border rounded text-sm" />
                  <input type="text" placeholder="Duration" value={med.duration} onChange={e => updateMed(i, 'duration', e.target.value)}
                    className="w-20 px-2 py-1.5 border rounded text-sm" />
                  {form.medications.length > 1 && <button onClick={() => removeMed(i)} className="text-red-400 text-xs">x</button>}
                </div>
              ))}
            </div>
          </div>

          {/* Advice on discharge */}
          <div>
            <label className="text-xs font-medium text-gray-500 mb-1 block">Advice on discharge (one per line)</label>
            <textarea value={form.adviceText} onChange={e => u('adviceText', e.target.value)}
              rows={3} className="w-full px-3 py-2 border rounded-lg text-sm" placeholder="Strict low salt, low fat diet&#10;No heavy lifting for 4 weeks&#10;Regular BP and glucose monitoring&#10;Complete medication course — do not stop without consulting&#10;Emergency: come to ER if chest pain, breathlessness, or palpitations" />
          </div>

          {/* Follow-up */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-medium text-gray-500 mb-1 block">Follow-up date</label>
              <input type="date" value={form.followUpDate} onChange={e => u('followUpDate', e.target.value)}
                className="w-full px-3 py-2 border rounded-lg text-sm" />
            </div>
            <div>
              <label className="text-xs font-medium text-gray-500 mb-1 block">Follow-up notes</label>
              <input type="text" value={form.followUpNotes} onChange={e => u('followUpNotes', e.target.value)}
                className="w-full px-3 py-2 border rounded-lg text-sm" placeholder="With reports" />
            </div>
          </div>

          {/* Actions */}
          <div className="flex gap-2 pt-3 border-t">
            <button onClick={handlePrintAndDischarge} disabled={!form.finalDiagnosis.trim() || !form.courseInHospital.trim()}
              className="flex-1 px-4 py-3 bg-green-600 text-white rounded-lg font-medium hover:bg-green-700 disabled:opacity-50">
              Print Summary & Discharge
            </button>
            <button onClick={onClose} className="px-4 py-3 bg-gray-100 text-gray-600 rounded-lg">Cancel</button>
          </div>
        </div>
      </div>
    </div>
  );
}
