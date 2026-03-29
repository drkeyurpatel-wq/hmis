'use client';
import React, { useState, useEffect, useCallback, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { sb } from '@/lib/supabase/browser';
import { useAuthStore } from '@/lib/store/auth';
import { RoleGuard } from '@/components/ui/shared';
import VitalsInput from '@/components/emr-mobile/vitals-input';
import QuickNote from '@/components/emr-mobile/quick-note';
import OrderQuick from '@/components/emr-mobile/order-quick';
import Link from 'next/link';

type MobileTab = 'vitals' | 'notes' | 'orders' | 'meds' | 'history';

function MobileEMRInner() {
  const searchParams = useSearchParams();
  const prePatient = searchParams.get('patient');
  const preAdmission = searchParams.get('admission');
  const { staff, activeCentreId } = useAuthStore();
  const staffId = staff?.id || '';
  const centreId = activeCentreId || '';

  const [tab, setTab] = useState<MobileTab>('vitals');
  const [toast, setToast] = useState('');
  const flash = (m: string) => { setToast(m); setTimeout(() => setToast(''), 2500); };

  // Patient state
  const [patient, setPatient] = useState<any>(null);
  const [admission, setAdmission] = useState<any>(null);
  const [searchQ, setSearchQ] = useState('');
  const [searchResults, setSearchResults] = useState<any[]>([]);

  // Clinical data
  const [recentOrders, setRecentOrders] = useState<any[]>([]);
  const [activeMeds, setActiveMeds] = useState<any[]>([]);
  const [encounters, setEncounters] = useState<any[]>([]);
  const [recentVitals, setRecentVitals] = useState<any[]>([]);

  // Search patients
  useEffect(() => {
    if (!searchQ || searchQ.length < 2 || !sb()) { setSearchResults([]); return; }
    const timer = setTimeout(async () => {
      const { data } = await sb()!.from('hmis_patients')
        .select('id, uhid, first_name, last_name, age_years, gender, phone_primary')
        .or(`uhid.ilike.%${searchQ}%,first_name.ilike.%${searchQ}%,last_name.ilike.%${searchQ}%,phone_primary.ilike.%${searchQ}%`)
        .limit(6);
      setSearchResults(data || []);
    }, 300);
    return () => clearTimeout(timer);
  }, [searchQ]);

  // Load patient by ID
  const loadPatient = useCallback(async (pid: string) => {
    if (!sb()) return;
    const { data: pt } = await sb()!.from('hmis_patients')
      .select('id, uhid, first_name, last_name, age_years, gender, blood_group, phone_primary')
      .eq('id', pid).single();
    if (pt) { setPatient(pt); setSearchQ(''); setSearchResults([]); }

    // Check for active admission
    const { data: adm } = await sb()!.from('hmis_admissions')
      .select('id, ipd_number, admission_date, status, ward:hmis_wards(name), doctor:hmis_staff!hmis_admissions_primary_doctor_id_fkey(full_name)')
      .eq('patient_id', pid).eq('status', 'active').limit(1).maybeSingle();
    setAdmission(adm);

    // Load clinical data
    const admId = adm?.id || preAdmission;
    if (admId) {
      const [orders, meds, vitals] = await Promise.all([
        sb()!.from('hmis_cpoe_orders').select('id, order_type, order_text, status, priority, created_at').eq('admission_id', admId).order('created_at', { ascending: false }).limit(10),
        sb()!.from('hmis_ipd_medication_orders').select('id, drug_name, dose, route, frequency, status').eq('admission_id', admId).eq('status', 'active'),
        sb()!.from('hmis_icu_charts').select('hr, bp_sys, bp_dia, spo2, temp, rr, recorded_at').eq('admission_id', admId).order('recorded_at', { ascending: false }).limit(5),
      ]);
      setRecentOrders((orders.data || []).map((o: any) => ({ orderType: o.order_type, orderText: o.order_text, status: o.status })));
      setActiveMeds(meds.data || []);
      setRecentVitals(vitals.data || []);
    }

    // Load recent encounters
    const { data: encs } = await sb()!.from('hmis_emr_encounters')
      .select('id, encounter_date, chief_complaint, diagnosis, prescriptions, doctor:hmis_staff!hmis_emr_encounters_doctor_id_fkey(full_name)')
      .eq('patient_id', pid).order('encounter_date', { ascending: false }).limit(5);
    setEncounters(encs || []);
  }, [preAdmission]);

  useEffect(() => { if (prePatient) loadPatient(prePatient); }, [prePatient, loadPatient]);

  // Save vitals to hmis_icu_charts
  const saveVitals = async (vitals: Record<string, number>) => {
    if (!admission?.id || !sb()) { flash('No active admission'); return; }
    await sb()!.from('hmis_icu_charts').insert({
      admission_id: admission.id, ...vitals,
      recorded_by: staffId, recorded_at: new Date().toISOString(),
    });
    loadPatient(patient.id);
  };

  // Save clinical note
  const saveNote = async (note: string) => {
    if (!patient?.id || !sb()) return;
    await sb()!.from('hmis_emr_encounters').insert({
      patient_id: patient.id, doctor_id: staffId, centre_id: centreId,
      encounter_date: new Date().toISOString().split('T')[0],
      progress_notes: note, status: 'completed', encounter_type: 'progress_note',
    });
    loadPatient(patient.id);
  };

  // Place CPOE order
  const placeOrder = async (order: { orderType: string; orderText: string; details: any; priority: string }) => {
    if (!admission?.id || !sb()) { flash('No active admission for orders'); return; }
    await sb()!.from('hmis_cpoe_orders').insert({
      admission_id: admission.id, patient_id: patient.id,
      order_type: order.orderType, order_text: order.orderText,
      details: order.details, priority: order.priority,
      status: 'ordered', ordered_by: staffId,
    });
    loadPatient(patient.id);
  };

  const ptName = patient ? `${patient.first_name} ${patient.last_name || ''}`.trim() : '';

  return (
    <div className="max-w-lg mx-auto space-y-3 pb-20">
      {toast && <div className="fixed top-4 left-1/2 -translate-x-1/2 z-50 bg-teal-600 text-white px-4 py-2 rounded-lg shadow-lg text-sm">{toast}</div>}

      <h1 className="text-lg font-bold">Mobile EMR</h1>

      {/* Patient Search */}
      {!patient && <div className="space-y-2">
        <input type="text" value={searchQ} onChange={e => setSearchQ(e.target.value)}
          className="w-full px-4 py-3 border rounded-xl text-base" placeholder="Search patient: name, UHID, phone..." autoFocus />
        {searchResults.map(p => (
          <button key={p.id} onClick={() => loadPatient(p.id)}
            className="w-full text-left bg-white border rounded-xl p-3 active:bg-teal-50">
            <div className="font-medium">{p.first_name} {p.last_name}</div>
            <div className="text-xs text-gray-400">{p.uhid} · {p.age_years}yr/{p.gender?.charAt(0)} · {p.phone_primary}</div>
          </button>
        ))}
      </div>}

      {/* Patient Banner */}
      {patient && <div className="bg-white rounded-xl border p-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-10 h-10 rounded-full bg-teal-100 flex items-center justify-center text-teal-700 font-bold text-sm">{patient.first_name?.charAt(0)}{patient.last_name?.charAt(0)}</div>
            <div>
              <div className="font-bold text-sm">{ptName}</div>
              <div className="text-xs text-gray-500">{patient.uhid} · {patient.age_years}yr/{patient.gender?.charAt(0)} {patient.blood_group && <span className="text-red-600 font-bold ml-1">{patient.blood_group}</span>}</div>
            </div>
          </div>
          <button onClick={() => { setPatient(null); setAdmission(null); }} className="text-xs text-gray-400">Change</button>
        </div>
        {admission && <div className="mt-2 flex items-center gap-2 text-xs">
          <span className="px-2 py-0.5 bg-green-100 text-green-700 rounded font-medium">{admission.ipd_number}</span>
          <span className="text-gray-500">{admission.ward?.name}</span>
          <span className="text-gray-400">Dr. {admission.doctor?.full_name}</span>
          {patient.id && <Link href={`/ipd/${admission.id}`} className="ml-auto text-teal-600 text-[10px]">Full Chart →</Link>}
        </div>}
        {!admission && <div className="mt-2 text-xs text-amber-600">No active admission — vitals & orders require admission</div>}
      </div>}

      {/* Tab Content */}
      {patient && <>
        {tab === 'vitals' && <VitalsInput onSave={saveVitals} onFlash={flash} />}
        {tab === 'vitals' && recentVitals.length > 0 && <div className="bg-white rounded-xl border p-3">
          <h4 className="text-xs font-bold text-gray-500 mb-2">Recent Vitals</h4>
          {recentVitals.slice(0, 3).map((v: any, i: number) => (
            <div key={i} className="flex items-center gap-3 text-xs py-1 border-b last:border-0">
              <span className="text-gray-400 w-16">{new Date(v.recorded_at).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}</span>
              {v.hr && <span>HR <b>{v.hr}</b></span>}
              {v.bp_sys && <span>BP <b>{v.bp_sys}/{v.bp_dia}</b></span>}
              {v.spo2 && <span>SpO₂ <b>{v.spo2}%</b></span>}
              {v.temp && <span>T <b>{v.temp}°</b></span>}
            </div>
          ))}
        </div>}
        {tab === 'notes' && <QuickNote onSave={saveNote} onFlash={flash} />}
        {tab === 'orders' && <OrderQuick onPlaceOrder={placeOrder} recentOrders={recentOrders} activeMeds={activeMeds} onFlash={flash} />}
        {tab === 'meds' && <div className="space-y-2">
          <h3 className="font-bold text-sm">Active Medications ({activeMeds.length})</h3>
          {activeMeds.length === 0 && <div className="text-center py-8 bg-white rounded-xl border text-gray-400 text-sm">No active medications</div>}
          {activeMeds.map((m: any) => (
            <div key={m.id} className="bg-white rounded-xl border p-3">
              <div className="font-medium text-sm">{m.drug_name}</div>
              <div className="text-xs text-gray-500">{m.dose} · {m.route} · {m.frequency}</div>
            </div>
          ))}
        </div>}
        {tab === 'history' && <div className="space-y-2">
          <h3 className="font-bold text-sm">Recent Encounters</h3>
          {encounters.length === 0 && <div className="text-center py-8 bg-white rounded-xl border text-gray-400 text-sm">No encounters</div>}
          {encounters.map((e: any) => (
            <div key={e.id} className="bg-white rounded-xl border p-3">
              <div className="flex justify-between text-xs mb-1">
                <span className="text-gray-400">{new Date(e.encounter_date).toLocaleDateString('en-IN')}</span>
                <span className="text-gray-500">Dr. {e.doctor?.full_name}</span>
              </div>
              {e.chief_complaint && <div className="text-sm"><b className="text-gray-600">CC:</b> {typeof e.chief_complaint === 'string' ? e.chief_complaint : JSON.stringify(e.chief_complaint).substring(0, 80)}</div>}
              {e.diagnosis && <div className="text-xs text-gray-500 mt-0.5"><b>Dx:</b> {typeof e.diagnosis === 'string' ? e.diagnosis : JSON.stringify(e.diagnosis).substring(0, 80)}</div>}
            </div>
          ))}
        </div>}
      </>}

      {/* Bottom Tab Bar */}
      {patient && <div className="fixed bottom-0 left-0 right-0 bg-white border-t z-30 md:ml-[256px]">
        <div className="max-w-lg mx-auto flex">
          {([['vitals', 'Vitals', ''], ['notes', 'Notes', ''], ['orders', 'Orders', ''], ['meds', 'Meds', ''], ['history', 'History', '📁']] as [MobileTab, string, string][]).map(([k, l, icon]) => (
            <button key={k} onClick={() => setTab(k)} className={`flex-1 py-3 flex flex-col items-center gap-0.5 ${tab === k ? 'text-teal-600' : 'text-gray-400'}`}>
              <span className="text-lg">{icon}</span><span className="text-[10px] font-medium">{l}</span>
            </button>
          ))}
        </div>
      </div>}
    </div>
  );
}

export default function MobileEMRPage() {
  return <RoleGuard module="emr"><Suspense fallback={<div className="text-center py-12 text-gray-400">Loading...</div>}><MobileEMRInner /></Suspense></RoleGuard>;
}
