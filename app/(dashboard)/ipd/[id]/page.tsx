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
import ServiceBillingEngine from '@/components/billing/service-billing-engine';
import CPOEPanel from '@/components/ipd/cpoe-panel';
import Link from 'next/link';

let _sb: any = null;
function sb() { if (typeof window === 'undefined') return null as any; if (!_sb) { try { _sb = createClient(); } catch { return null; } } return _sb; }

type ClinicalTab = 'overview' | 'rounds' | 'icu' | 'trends' | 'io' | 'meds' | 'mar' | 'scores' | 'cpoe' | 'consents' | 'procedures' | 'nursing' | 'lab' | 'imaging' | 'billing' | 'transfer' | 'discharge';

function IPDClinicalInner() {
  const { id } = useParams();
  const searchParams = useSearchParams();
  const admissionId = id as string;
  const { staff } = useAuthStore();
  const staffId = staff?.id || '';
  const [admission, setAdmission] = useState<any>(null);
  const initialTab = (searchParams.get('tab') as ClinicalTab) || 'overview';
  const [tab, setTab] = useState<ClinicalTab>(initialTab);
  const [toast, setToast] = useState('');
  const flash = (m: string) => { setToast(m); setTimeout(() => setToast(''), 2500); };
  // Overview data
  const [charges, setCharges] = useState<any[]>([]);
  const [advances, setAdvances] = useState<number>(0);
  const [activeOrders, setActiveOrders] = useState({ lab: 0, rad: 0, pharmacy: 0 });
  const [recentVitals, setRecentVitals] = useState<any[]>([]);
  // Transfer
  const [availBeds, setAvailBeds] = useState<any[]>([]);
  const [transferBedId, setTransferBedId] = useState('');
  const [transferReason, setTransferReason] = useState('');

  useEffect(() => {
    if (!admissionId || !sb()) return;
    sb().from('hmis_admissions')
      .select('*, patient:hmis_patients!inner(id, uhid, first_name, last_name, age_years, gender, blood_group, phone_primary, date_of_birth), department:hmis_departments!inner(name), doctor:hmis_staff!hmis_admissions_primary_doctor_id_fkey(full_name, specialisation), bed:hmis_beds(bed_number, room:hmis_rooms(name, ward:hmis_wards(name)))')
      .eq('id', admissionId).single()
      .then(({ data }: any) => setAdmission(data));
  }, [admissionId]);

  // Load overview data
  useEffect(() => {
    if (!admissionId || !sb()) return;
    // Charges
    sb().from('hmis_charge_log').select('id, amount, category, service_date, description')
      .eq('admission_id', admissionId).neq('status', 'reversed').order('service_date', { ascending: false })
      .then(({ data }: any) => setCharges(data || []));
    // Advances
    sb().from('hmis_advances').select('amount').eq('admission_id', admissionId).eq('status', 'collected')
      .then(({ data }: any) => setAdvances((data || []).reduce((s: number, a: any) => s + parseFloat(a.amount || 0), 0)));
    // Active orders
    Promise.all([
      sb().from('hmis_lab_orders').select('id', { count: 'exact', head: true }).eq('admission_id', admissionId).in('status', ['ordered', 'collected', 'in_progress']),
      sb().from('hmis_radiology_orders').select('id', { count: 'exact', head: true }).eq('admission_id', admissionId).in('status', ['ordered', 'scheduled']),
      sb().from('hmis_pharmacy_dispensing').select('id', { count: 'exact', head: true }).eq('admission_id', admissionId).eq('status', 'pending'),
    ]).then(([lab, rad, rx]) => setActiveOrders({ lab: lab.count || 0, rad: rad.count || 0, pharmacy: rx.count || 0 }));
    // Vitals
    sb().from('hmis_vitals').select('bp_systolic, bp_diastolic, heart_rate, spo2, temperature, respiratory_rate, recorded_at')
      .eq('admission_id', admissionId).order('recorded_at', { ascending: false }).limit(10)
      .then(({ data }: any) => setRecentVitals(data || []));
    // Available beds for transfer
    sb().from('hmis_beds').select('id, bed_number, status, room:hmis_rooms!inner(name, ward:hmis_wards!inner(name))')
      .eq('status', 'available').limit(100)
      .then(({ data }: any) => setAvailBeds(data || []));
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
    ['overview', 'Overview', ''],
    ['rounds', 'Rounds', `${rounds.rounds.length}`],
    ['icu', 'ICU Chart', `${icu.entries.length}`],
    ['trends', 'Trends', ''],
    ['io', 'I/O', `${io.entries.length}`],
    ['meds', 'Meds', `${meds.orders.filter((m: any) => m.status === 'active').length}`],
    ['mar', 'MAR', `${mar.records.filter((r: any) => r.status === 'scheduled').length}`],
    ['scores', 'Scores', `${scores.scores.length}`],
    ['cpoe', 'Orders (CPOE)', ''],
    ['consents', 'Consents', `${consents.consents.length}`],
    ['procedures', 'Procedures', `${procedures.notes.length}`],
    ['nursing', 'Nursing', ''],
    ['lab', 'Lab', ''],
    ['imaging', 'Imaging', ''],
    ['billing', 'Running Bill', ''],
    ['transfer', 'Bed Transfer', ''],
    ['discharge', 'Discharge', ''],
  ];

  return (
    <div className="max-w-6xl mx-auto">
      {toast && <div className="fixed top-4 left-1/2 -translate-x-1/2 z-50 bg-emerald-600 text-white px-4 py-2 rounded-xl shadow-lg text-sm">{toast}</div>}

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
                {admission.bed && <span className="bg-purple-50 text-purple-700 px-1.5 py-0.5 rounded">{admission.bed.bed_number} · {admission.bed.room?.ward?.name}</span>}
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
              {(admission.status === 'active' || admission.status === 'discharge_initiated') && <button onClick={() => setTab('discharge')} className="px-3 py-1.5 bg-emerald-600 text-white text-xs rounded-lg hover:bg-emerald-700 font-medium">Discharge</button>}
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
            className={`px-2.5 py-2 text-[11px] font-medium whitespace-nowrap rounded-xl flex items-center gap-1 ${tab === k ? 'bg-teal-600 text-white shadow-sm' : 'bg-white text-gray-500 border border-gray-100 hover:bg-gray-50'}`}>
            {l}{count && <span className={`text-[9px] px-1 rounded-full ${tab === k ? 'bg-blue-100 text-blue-600' : 'bg-gray-100 text-gray-400'}`}>{count}</span>}
          </button>
        ))}
      </div>

      {/* ===== TAB CONTENT ===== */}
      {tab === 'overview' && (() => {
        const totalCharges = charges.reduce((s, c) => s + parseFloat(c.amount || 0), 0);
        const balance = totalCharges - advances;
        const chargesByCategory: Record<string, number> = {};
        charges.forEach(c => { const cat = c.category || 'other'; chargesByCategory[cat] = (chargesByCategory[cat] || 0) + parseFloat(c.amount || 0); });
        const fmt = (n: number) => Math.round(n).toLocaleString('en-IN');
        const activeMedCount = meds.orders.filter((m: any) => m.status === 'active').length;
        return (
          <div className="space-y-4">
            {/* Financial summary */}
            <div className="grid grid-cols-4 gap-3">
              <div className="bg-white rounded-2xl border p-4 text-center"><div className="text-[9px] text-gray-400 uppercase font-semibold">Total Charges</div><div className="text-2xl font-black text-gray-800">₹{fmt(totalCharges)}</div></div>
              <div className="bg-white rounded-2xl border p-4 text-center"><div className="text-[9px] text-gray-400 uppercase font-semibold">Advances Paid</div><div className="text-2xl font-black text-emerald-700">₹{fmt(advances)}</div></div>
              <div className={`rounded-2xl border p-4 text-center ${balance > 0 ? 'bg-red-50 border-red-200' : 'bg-emerald-50 border-emerald-200'}`}><div className="text-[9px] text-gray-400 uppercase font-semibold">Balance</div><div className={`text-2xl font-black ${balance > 0 ? 'text-red-600' : 'text-emerald-600'}`}>₹{fmt(Math.abs(balance))}</div></div>
              <div className="bg-white rounded-2xl border p-4 text-center"><div className="text-[9px] text-gray-400 uppercase font-semibold">LOS</div><div className="text-2xl font-black text-teal-700">{daysSince} days</div></div>
            </div>
            {/* Active orders + meds */}
            <div className="grid grid-cols-4 gap-3">
              <div className="bg-white rounded-xl border p-3 text-center"><div className="text-[9px] text-gray-400 uppercase font-semibold">Lab Pending</div><div className={`text-xl font-black ${activeOrders.lab > 0 ? 'text-cyan-700' : 'text-gray-300'}`}>{activeOrders.lab}</div></div>
              <div className="bg-white rounded-xl border p-3 text-center"><div className="text-[9px] text-gray-400 uppercase font-semibold">Rad Pending</div><div className={`text-xl font-black ${activeOrders.rad > 0 ? 'text-indigo-700' : 'text-gray-300'}`}>{activeOrders.rad}</div></div>
              <div className="bg-white rounded-xl border p-3 text-center"><div className="text-[9px] text-gray-400 uppercase font-semibold">Rx Pending</div><div className={`text-xl font-black ${activeOrders.pharmacy > 0 ? 'text-amber-700' : 'text-gray-300'}`}>{activeOrders.pharmacy}</div></div>
              <div className="bg-white rounded-xl border p-3 text-center"><div className="text-[9px] text-gray-400 uppercase font-semibold">Active Meds</div><div className="text-xl font-black text-purple-700">{activeMedCount}</div></div>
            </div>
            {/* Charges by category + Vitals trend */}
            <div className="grid grid-cols-2 gap-4">
              <div className="bg-white rounded-2xl border p-4">
                <h3 className="text-xs font-bold text-gray-700 mb-3">Charges by Category</h3>
                {Object.keys(chargesByCategory).length === 0 ? <div className="text-center py-6 text-gray-300 text-xs">No charges yet</div> :
                <div className="space-y-2">{Object.entries(chargesByCategory).sort((a, b) => b[1] - a[1]).map(([cat, amt]) => (
                  <div key={cat}>
                    <div className="flex justify-between mb-0.5"><span className="text-[10px] capitalize text-gray-600">{cat.replace('_', ' ')}</span><span className="text-[10px] font-bold">₹{fmt(amt)}</span></div>
                    <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden"><div className="h-full bg-teal-500 rounded-full" style={{ width: `${totalCharges > 0 ? (amt / totalCharges * 100) : 0}%` }} /></div>
                  </div>
                ))}</div>}
              </div>
              <div className="bg-white rounded-2xl border p-4">
                <h3 className="text-xs font-bold text-gray-700 mb-3">Recent Vitals</h3>
                {recentVitals.length === 0 ? <div className="text-center py-6 text-gray-300 text-xs">No vitals recorded</div> :
                <div className="space-y-1.5">{recentVitals.slice(0, 5).map((v, i) => (
                  <div key={i} className="flex items-center gap-2 text-[10px] bg-gray-50 rounded-lg px-2.5 py-1.5">
                    <span className="text-gray-400 w-12">{new Date(v.recorded_at).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}</span>
                    {v.bp_systolic && <span className={`font-bold ${v.bp_systolic > 160 || v.bp_systolic < 90 ? 'text-red-600' : 'text-gray-700'}`}>BP {v.bp_systolic}/{v.bp_diastolic}</span>}
                    {v.heart_rate && <span className={`font-bold ${v.heart_rate > 120 || v.heart_rate < 50 ? 'text-red-600' : 'text-gray-700'}`}>HR {v.heart_rate}</span>}
                    {v.spo2 && <span className={`font-bold ${v.spo2 < 94 ? 'text-red-600' : 'text-gray-700'}`}>SpO2 {v.spo2}%</span>}
                    {v.temperature && <span className={`font-bold ${v.temperature > 38.5 ? 'text-red-600' : 'text-gray-700'}`}>T {v.temperature}°</span>}
                  </div>
                ))}</div>}
              </div>
            </div>
            {/* Quick actions */}
            <div className="flex gap-2">
              <button onClick={() => setTab('meds')} className="flex-1 py-2.5 bg-purple-50 text-purple-700 text-xs rounded-xl font-medium hover:bg-purple-100">View Medications</button>
              <button onClick={() => setTab('cpoe')} className="flex-1 py-2.5 bg-cyan-50 text-cyan-700 text-xs rounded-xl font-medium hover:bg-cyan-100">Place Orders</button>
              <button onClick={() => setTab('billing')} className="flex-1 py-2.5 bg-emerald-50 text-emerald-700 text-xs rounded-xl font-medium hover:bg-emerald-100">Running Bill</button>
              <button onClick={() => setTab('transfer')} className="flex-1 py-2.5 bg-amber-50 text-amber-700 text-xs rounded-xl font-medium hover:bg-amber-100">Transfer Bed</button>
            </div>
          </div>
        );
      })()}
      {tab === 'rounds' && <SmartRounds rounds={rounds.rounds} admissionDx={admDx} staffId={staffId} loading={rounds.loading} onSave={async (round: any) => { await rounds.addRound(round); }} onFlash={flash} />}
      {tab === 'icu' && <SmartICUChart entries={icu.entries} admissionId={admissionId} staffId={staffId} onAdd={async (entry: any, sid: string) => { await icu.addEntry(entry, sid); }} onFlash={flash} />}
      {tab === 'trends' && <VitalsTrendChart entries={icu.entries} hoursBack={48} />}
      {tab === 'io' && <SmartIOChart entries={io.entries} admissionId={admissionId} staffId={staffId} onAdd={async (entry: any, sid: string) => { await io.addEntry(entry, sid); }} onFlash={flash} />}
      {tab === 'meds' && <SmartMedOrders meds={meds.orders} admissionId={admissionId} staffId={staffId} admissionDx={admDx} onAdd={async (med: any) => { await meds.addOrder(med, staffId); }} onDiscontinue={async (id: string, reason: string) => { await meds.discontinue(id, staffId, reason); }} onFlash={flash} />}
      {tab === 'mar' && <SmartMAR records={mar.records} meds={meds.orders} admissionId={admissionId} staffId={staffId} onAdminister={async (id: string, sid: string) => { await mar.administer(id, sid); }} onHold={async (id: string, reason: string) => { await mar.holdDose(id, reason); }} onFlash={flash} />}
      {tab === 'scores' && <AutoICUScores scores={scores.scores} admissionId={admissionId} staffId={staffId} onSave={async (score: any, sid: string) => { await scores.addScore(score.scoreType, score.scoreValue, {}, score.interpretation, sid); }} onFlash={flash} />}
      {tab === 'cpoe' && <CPOEPanel admissionId={admissionId} patientId={pt.id} onFlash={flash} />}
      {tab === 'consents' && <ConsentBuilder consents={consents.consents} patientId={pt.id} patientName={patientName} admissionId={admissionId} admissionDx={admDx} staffId={staffId} onSave={async (c: any, sid: string) => { await consents.addConsent(c, sid); }} onFlash={flash} />}
      {tab === 'procedures' && <SmartProcedures procedures={procedures.notes} admissionId={admissionId} staffId={staffId} onSave={async (proc: any, sid: string) => { await procedures.addNote(proc, sid); }} onFlash={flash} />}
      {tab === 'nursing' && <NursingShiftNotes admissionId={admissionId} staffId={staffId} patientName={patientName} onFlash={flash} />}
      {tab === 'lab' && <PatientLabHistory patientId={pt.id} admissionId={admissionId} />}
      {tab === 'imaging' && <PatientImagingPanel patientId={pt.id} admissionId={admissionId} />}
      {tab === 'billing' && <ServiceBillingEngine centreId={admission.centre_id} staffId={staffId} mode="ipd"
        patientId={pt.id} patientName={`${pt.first_name} ${pt.last_name} (${pt.uhid})`}
        admissionId={admissionId} payorType={admission.payor_type || 'self'} onFlash={flash} />}
      {tab === 'transfer' && (
        <div className="bg-white rounded-2xl border p-6 max-w-lg">
          <h3 className="text-sm font-bold text-gray-800 mb-4">Bed Transfer</h3>
          <div className="space-y-3">
            <div className="bg-gray-50 rounded-xl p-3">
              <div className="text-[10px] text-gray-400 uppercase font-semibold">Current Bed</div>
              <div className="font-bold text-gray-800 mt-0.5">{admission.bed?.bed_number || 'No bed assigned'}</div>
              <div className="text-[10px] text-gray-500">{admission.bed?.room?.name || ''} · {admission.bed?.room?.ward?.name || ''}</div>
            </div>
            <div><label className="text-[10px] text-gray-500 uppercase font-semibold">Transfer to *</label>
              <select value={transferBedId} onChange={e => setTransferBedId(e.target.value)} className="w-full mt-1 px-3 py-2 border rounded-xl text-sm">
                <option value="">Select new bed...</option>
                {(() => {
                  const groups: Record<string, any[]> = {};
                  availBeds.forEach(b => { const k = b.room?.ward?.name || 'General'; if (!groups[k]) groups[k] = []; groups[k].push(b); });
                  return Object.entries(groups).map(([ward, wBeds]) => (
                    <optgroup key={ward} label={`${ward} (${wBeds.length} free)`}>
                      {wBeds.map(b => <option key={b.id} value={b.id}>{b.bed_number} — {b.room?.name || ''}</option>)}
                    </optgroup>
                  ));
                })()}
              </select>
            </div>
            <div><label className="text-[10px] text-gray-500 uppercase font-semibold">Reason</label>
              <input value={transferReason} onChange={e => setTransferReason(e.target.value)} className="w-full mt-1 px-3 py-2 border rounded-xl text-sm" placeholder="e.g., Step-down from ICU, patient request" /></div>
            <button disabled={!transferBedId} onClick={async () => {
              if (!transferBedId || !sb()) return;
              const oldBedId = admission.bed_id;
              // Create transfer record
              await sb().from('hmis_bed_transfers').insert({
                admission_id: admissionId, from_bed_id: oldBedId, to_bed_id: transferBedId,
                transferred_by: staffId, reason: transferReason, transferred_at: new Date().toISOString(),
              });
              // Free old bed
              if (oldBedId) await sb().from('hmis_beds').update({ status: 'available' }).eq('id', oldBedId);
              // Occupy new bed
              await sb().from('hmis_beds').update({ status: 'occupied', patient_id: admission.patient?.id }).eq('id', transferBedId);
              // Update admission
              await sb().from('hmis_admissions').update({ bed_id: transferBedId }).eq('id', admissionId);
              flash('Bed transferred');
              setTransferBedId(''); setTransferReason('');
              // Reload admission
              sb().from('hmis_admissions')
                .select('*, patient:hmis_patients!inner(id, uhid, first_name, last_name, age_years, gender, blood_group, phone_primary, date_of_birth), department:hmis_departments!inner(name), doctor:hmis_staff!hmis_admissions_primary_doctor_id_fkey(full_name, specialisation), bed:hmis_beds(bed_number, room:hmis_rooms(name, ward:hmis_wards(name)))')
                .eq('id', admissionId).single().then(({ data }: any) => setAdmission(data));
            }} className="w-full py-2.5 bg-teal-600 text-white text-sm rounded-xl font-semibold disabled:opacity-40 hover:bg-teal-700">Transfer Patient</button>
          </div>
        </div>
      )}
      {tab === 'discharge' && <DischargeEngine admissionId={admissionId} patientId={pt.id} staffId={staffId} admission={admission} onFlash={flash} />}
    </div>
  );
}

export default function IPDClinicalPage() {
  return <Suspense fallback={<div className="text-center py-12 text-gray-400">Loading...</div>}><IPDClinicalInner /></Suspense>;
}
