'use client';
import React, { useState, useEffect, Suspense } from 'react';
import { useParams, useSearchParams } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { useAuthStore } from '@/lib/store/auth';
import { useDoctorRounds, useICUChart, useICUScores, useIOChart, useMedicationOrders, useMAR, useConsents, useProceduralNotes } from '@/lib/ipd/clinical-hooks';
import NursingShiftNotes from '@/components/ipd/nursing-shift-notes';
import VitalsTrendChart from '@/components/ipd/vitals-trend-chart';
import SmartRounds from '@/components/ipd/smart-rounds';
import SmartICUChart from '@/components/ipd/smart-icu-chart';
import SmartIOChart from '@/components/ipd/smart-io-chart';
import SmartMedOrders from '@/components/ipd/smart-med-orders';
import SmartMAR from '@/components/ipd/smart-mar';
import AutoICUScores from '@/components/ipd/auto-icu-scores';
import DischargeEngine from '@/components/ipd/discharge-engine';
import ConsentBuilder from '@/components/ipd/consent-builder';
import SmartProcedures from '@/components/ipd/smart-procedures';
import PatientImagingPanel from '@/components/radiology/patient-imaging-panel';
import PatientLabHistory from '@/components/lab/patient-lab-history';
import Link from 'next/link';

let _sb: any = null;
function sb() { if (typeof window === 'undefined') return null as any; if (!_sb) { try { _sb = createClient(); } catch { return null; } } return _sb; }

type ClinicalTab = 'rounds' | 'icu' | 'trends' | 'io' | 'meds' | 'mar' | 'scores' | 'consents' | 'procedures' | 'nursing' | 'lab' | 'imaging' | 'discharge';

function IPDClinicalInner() {
  const { id } = useParams();
  const searchParams = useSearchParams();
  const admissionId = id as string;
  const { staff } = useAuthStore();
  const staffId = staff?.id || '';
  const [admission, setAdmission] = useState<any>(null);
  const initialTab = (searchParams.get('tab') as ClinicalTab) || 'rounds';
  const [tab, setTab] = useState<ClinicalTab>(initialTab);
  const [toast, setToast] = useState('');
  const flash = (m: string) => { setToast(m); setTimeout(() => setToast(''), 2500); };

  useEffect(() => {
    if (!admissionId || !sb()) return;
    sb().from('hmis_admissions')
      .select('*, patient:hmis_patients!inner(id, uhid, first_name, last_name, age_years, gender, blood_group, phone_primary, date_of_birth), department:hmis_departments!inner(name), doctor:hmis_staff!hmis_admissions_primary_doctor_id_fkey(full_name, specialisation)')
      .eq('id', admissionId).single()
      .then(({ data }: any) => setAdmission(data));
  }, [admissionId]);

  const rounds = useDoctorRounds(admissionId);
  const icu = useICUChart(admissionId);
  const scores = useICUScores(admissionId);
  const io = useIOChart(admissionId);
  const meds = useMedicationOrders(admissionId);
  const mar = useMAR(admissionId);
  const consents = useConsents(admissionId, admission?.patient?.id);
  const procedures = useProceduralNotes(admissionId);

  if (!admission) return <div className="text-center py-12 text-gray-400">Loading admission...</div>;
  const pt = admission.patient;
  const patientName = pt.first_name + ' ' + (pt.last_name || '');
  const daysSince = Math.ceil((Date.now() - new Date(admission.admission_date).getTime()) / 86400000);
  const admDx = admission.provisional_diagnosis || '';
  const latestVitals = icu.entries.length > 0 ? icu.entries[0] : null;

  const tabs: [ClinicalTab, string, string][] = [
    ['rounds', 'Rounds', `${rounds.rounds.length}`],
    ['icu', 'ICU Chart', `${icu.entries.length}`],
    ['trends', 'Trends', ''],
    ['io', 'I/O', `${io.entries.length}`],
    ['meds', 'Meds', `${meds.orders.filter((m: any) => m.status === 'active').length}`],
    ['mar', 'MAR', `${mar.records.filter((r: any) => r.status === 'scheduled').length}`],
    ['scores', 'Scores', `${scores.scores.length}`],
    ['consents', 'Consents', `${consents.consents.length}`],
    ['procedures', 'Procedures', `${procedures.notes.length}`],
    ['nursing', 'Nursing', ''],
    ['lab', 'Lab', ''],
    ['imaging', 'Imaging', ''],
    ['discharge', 'Discharge', ''],
  ];

  return (
    <div className="max-w-6xl mx-auto">
      {toast && <div className="fixed top-4 left-1/2 -translate-x-1/2 z-50 bg-green-600 text-white px-4 py-2 rounded-lg shadow-lg text-sm">{toast}</div>}

      {/* ===== PATIENT HEADER ===== */}
      <div className="bg-white rounded-xl border p-4 mb-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-full bg-blue-100 flex items-center justify-center text-blue-700 font-bold text-lg">{pt.first_name?.charAt(0)}{pt.last_name?.charAt(0)}</div>
            <div>
              <h1 className="text-xl font-bold">{patientName}</h1>
              <div className="flex items-center gap-2 text-xs text-gray-500 flex-wrap">
                <span className="font-mono bg-gray-100 px-1.5 py-0.5 rounded">{admission.ipd_number}</span>
                <span>{pt.uhid}</span>
                <span>{pt.age_years}yr/{pt.gender?.charAt(0).toUpperCase()}</span>
                {pt.blood_group && <span className="bg-red-50 text-red-700 px-1.5 py-0.5 rounded font-bold">{pt.blood_group}</span>}
                <span className="bg-orange-50 text-orange-700 px-1.5 py-0.5 rounded font-bold">Day {daysSince}</span>
                <span className="bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded">{admission.department?.name}</span>
                <span>Dr. {admission.doctor?.full_name}</span>
                <span className={`px-1.5 py-0.5 rounded font-medium ${admission.status === 'active' ? 'bg-green-100 text-green-700' : admission.status === 'discharge_initiated' ? 'bg-orange-100 text-orange-700' : 'bg-gray-100 text-gray-500'}`}>{admission.status.replace('_', ' ')}</span>
              </div>
              {admDx && <div className="text-xs text-gray-600 mt-1 max-w-[600px]"><span className="font-medium">Dx:</span> {admDx}</div>}
            </div>
          </div>
          <div className="flex flex-col gap-1.5 items-end">
            {latestVitals && <div className="flex gap-2 text-[10px]">
              {latestVitals.hr && <span className="bg-gray-50 px-1.5 py-0.5 rounded">HR <b>{latestVitals.hr}</b></span>}
              {latestVitals.bp_sys && <span className="bg-gray-50 px-1.5 py-0.5 rounded">BP <b>{latestVitals.bp_sys}/{latestVitals.bp_dia}</b></span>}
              {latestVitals.spo2 && <span className="bg-gray-50 px-1.5 py-0.5 rounded">SpO2 <b>{latestVitals.spo2}%</b></span>}
              {latestVitals.temp && <span className="bg-gray-50 px-1.5 py-0.5 rounded">T <b>{latestVitals.temp}°F</b></span>}
            </div>}
            <div className="flex gap-2">
              {(admission.status === 'active' || admission.status === 'discharge_initiated') && <button onClick={() => setTab('discharge')} className="px-3 py-1.5 bg-green-600 text-white text-xs rounded-lg hover:bg-green-700 font-medium">Discharge</button>}
              <Link href={`/emr-v2?patient=${pt.id}`} className="px-3 py-1.5 bg-blue-50 text-blue-700 text-xs rounded-lg hover:bg-blue-100">EMR</Link>
              <Link href="/ipd" className="px-3 py-1.5 bg-gray-100 text-gray-600 text-xs rounded-lg hover:bg-gray-200">Back</Link>
            </div>
          </div>
        </div>
      </div>

      {/* ===== TABS ===== */}
      <div className="flex gap-0.5 mb-4 overflow-x-auto border-b pb-px">
        {tabs.map(([k, l, count]) => (
          <button key={k} onClick={() => setTab(k)}
            className={`px-2.5 py-2 text-[11px] font-medium whitespace-nowrap border-b-2 -mb-px flex items-center gap-1 ${tab === k ? 'border-blue-600 text-blue-700' : 'border-transparent text-gray-500 hover:text-gray-700'}`}>
            {l}{count && <span className={`text-[9px] px-1 rounded-full ${tab === k ? 'bg-blue-100 text-blue-600' : 'bg-gray-100 text-gray-400'}`}>{count}</span>}
          </button>
        ))}
      </div>

      {/* ===== TAB CONTENT ===== */}
      {tab === 'rounds' && <SmartRounds rounds={rounds.rounds} admissionDx={admDx} staffId={staffId} loading={rounds.loading} onSave={async (round: any) => { await rounds.addRound(round); }} onFlash={flash} />}
      {tab === 'icu' && <SmartICUChart entries={icu.entries} admissionId={admissionId} staffId={staffId} onAdd={async (entry: any, sid: string) => { await icu.addEntry(entry, sid); }} onFlash={flash} />}
      {tab === 'trends' && <VitalsTrendChart entries={icu.entries} hoursBack={48} />}
      {tab === 'io' && <SmartIOChart entries={io.entries} admissionId={admissionId} staffId={staffId} onAdd={async (entry: any, sid: string) => { await io.addEntry(entry, sid); }} onFlash={flash} />}
      {tab === 'meds' && <SmartMedOrders meds={meds.orders} admissionId={admissionId} staffId={staffId} admissionDx={admDx} onAdd={async (med: any) => { await meds.addOrder(med, staffId); }} onDiscontinue={async (id: string, reason: string) => { await meds.discontinue(id, staffId, reason); }} onFlash={flash} />}
      {tab === 'mar' && <SmartMAR records={mar.records} meds={meds.orders} admissionId={admissionId} staffId={staffId} onAdminister={async (id: string, sid: string) => { await mar.administer(id, sid); }} onHold={async (id: string, reason: string) => { await mar.holdDose(id, reason); }} onFlash={flash} />}
      {tab === 'scores' && <AutoICUScores scores={scores.scores} admissionId={admissionId} staffId={staffId} onSave={async (score: any, sid: string) => { await scores.addScore(score.scoreType, score.scoreValue, {}, score.interpretation, sid); }} onFlash={flash} />}
      {tab === 'consents' && <ConsentBuilder consents={consents.consents} patientId={pt.id} patientName={patientName} admissionId={admissionId} admissionDx={admDx} staffId={staffId} onSave={async (c: any, sid: string) => { await consents.addConsent(c, sid); }} onFlash={flash} />}
      {tab === 'procedures' && <SmartProcedures procedures={procedures.notes} admissionId={admissionId} staffId={staffId} onSave={async (proc: any, sid: string) => { await procedures.addNote(proc, sid); }} onFlash={flash} />}
      {tab === 'nursing' && <NursingShiftNotes admissionId={admissionId} staffId={staffId} patientName={patientName} onFlash={flash} />}
      {tab === 'lab' && <PatientLabHistory patientId={pt.id} admissionId={admissionId} />}
      {tab === 'imaging' && <PatientImagingPanel patientId={pt.id} admissionId={admissionId} />}
      {tab === 'discharge' && <DischargeEngine admissionId={admissionId} patientId={pt.id} staffId={staffId} admission={admission} onFlash={flash} />}
    </div>
  );
}

export default function IPDClinicalPage() {
  return <Suspense fallback={<div className="text-center py-12 text-gray-400">Loading...</div>}><IPDClinicalInner /></Suspense>;
}
