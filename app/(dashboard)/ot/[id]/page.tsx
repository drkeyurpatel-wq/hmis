'use client';
import React, { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { useAuthStore } from '@/lib/store/auth';
import { useWHOChecklist, useOTNotes } from '@/lib/ipd/clinical-hooks';
import Link from 'next/link';

let _sb: any = null;
function sb() { if (typeof window === 'undefined') return null as any; if (!_sb) { try { _sb = createClient(); } catch { return null; } } return _sb; }

type Tab = 'who' | 'pre_op' | 'intra_op' | 'post_op' | 'anaesthesia';

export default function OTClinicalPage() {
  const { id } = useParams();
  const bookingId = id as string;
  const { staff } = useAuthStore();
  const staffId = staff?.id || '';
  const [booking, setBooking] = useState<any>(null);
  const [tab, setTab] = useState<Tab>('who');
  const [toast, setToast] = useState('');
  const flash = (m: string) => { setToast(m); setTimeout(() => setToast(''), 2500); };

  const who = useWHOChecklist(bookingId);
  const otNotes = useOTNotes(bookingId);

  // Anaesthesia record state
  const [anaesRecord, setAnaesRecord] = useState<any>(null);
  const [anaesForm, setAnaesForm] = useState<any>({ anaesthesia_type: 'general', pre_op_assessment: '', drugs_used: '', vitals_timeline: '', complications: '' });

  useEffect(() => {
    if (!bookingId || !sb()) return;
    sb().from('hmis_ot_bookings')
      .select('*, admission:hmis_admissions!inner(ipd_number, patient:hmis_patients!inner(id, uhid, first_name, last_name, age_years, gender, blood_group)), ot_room:hmis_ot_rooms!inner(name), surgeon:hmis_staff!hmis_ot_bookings_surgeon_id_fkey(full_name), anaesthetist:hmis_staff!hmis_ot_bookings_anaesthetist_id_fkey(full_name)')
      .eq('id', bookingId).single()
      .then(({ data }: any) => setBooking(data));
    // Load anaesthesia record
    sb().from('hmis_anaesthesia_records').select('*').eq('ot_booking_id', bookingId).single()
      .then(({ data }: any) => { if (data) { setAnaesRecord(data); setAnaesForm({ anaesthesia_type: data.anaesthesia_type, pre_op_assessment: JSON.stringify(data.pre_op_assessment || {}), drugs_used: JSON.stringify(data.drugs_used || []), vitals_timeline: JSON.stringify(data.vitals_timeline || []), complications: data.complications || '' }); } });
  }, [bookingId]);

  // WHO checklist local state
  const [whoForm, setWhoForm] = useState<any>({});
  useEffect(() => { if (who.checklist) setWhoForm(who.checklist); }, [who.checklist]);
  const updateWho = (key: string, val: any) => setWhoForm((f: any) => ({ ...f, [key]: val }));
  const saveWho = async (phase: string) => {
    const updates: any = { ...whoForm };
    if (phase === 'sign_in') { updates.sign_in_time = new Date().toISOString(); updates.sign_in_by = staffId; updates.status = 'sign_in_done'; }
    if (phase === 'time_out') { updates.time_out_time = new Date().toISOString(); updates.time_out_by = staffId; updates.status = 'time_out_done'; }
    if (phase === 'sign_out') { updates.sign_out_time = new Date().toISOString(); updates.sign_out_by = staffId; updates.status = 'completed'; }
    await who.createOrUpdate(updates, staffId);
    flash(phase.replace('_', ' ').toUpperCase() + ' saved');
  };

  // OT Notes form
  const [noteForm, setNoteForm] = useState<any>({});

  const saveOTNote = async (noteType: string) => {
    await otNotes.addNote({ note_type: noteType, ...noteForm }, staffId);
    setNoteForm({});
    flash(noteType.replace('_', ' ') + ' note saved');
  };

  // Save anaesthesia
  const saveAnaes = async () => {
    if (!sb() || !bookingId) return;
    const payload = {
      ot_booking_id: bookingId, anaesthetist_id: staffId,
      anaesthesia_type: anaesForm.anaesthesia_type,
      pre_op_assessment: tryParse(anaesForm.pre_op_assessment),
      drugs_used: tryParse(anaesForm.drugs_used),
      vitals_timeline: tryParse(anaesForm.vitals_timeline),
      complications: anaesForm.complications,
    };
    if (anaesRecord?.id) {
      await sb().from('hmis_anaesthesia_records').update(payload).eq('id', anaesRecord.id);
    } else {
      await sb().from('hmis_anaesthesia_records').insert(payload);
    }
    flash('Anaesthesia record saved');
  };

  function tryParse(s: string) { try { return JSON.parse(s); } catch { return s; } }

  if (!booking) return <div className="text-center py-12 text-gray-400">Loading OT booking...</div>;
  const pt = booking.admission?.patient;
  const patientName = pt ? pt.first_name + ' ' + (pt.last_name || '') : '--';

  const Check = ({ label, field }: { label: string; field: string }) => (
    <label className="flex items-center gap-2 py-1.5 border-b last:border-0 text-sm cursor-pointer hover:bg-gray-50 px-2 rounded">
      <input type="checkbox" checked={!!whoForm[field]} onChange={e => updateWho(field, e.target.checked)} className="w-4 h-4 rounded" />
      <span className={whoForm[field] ? 'text-green-700' : 'text-gray-700'}>{label}</span>
    </label>
  );

  const tabs: [Tab, string][] = [['who', 'WHO Checklist'], ['pre_op', 'Pre-Op Note'], ['intra_op', 'Intra-Op Note'], ['post_op', 'Post-Op Note'], ['anaesthesia', 'Anaesthesia']];

  return (
    <div className="max-w-5xl mx-auto">
      {toast && <div className="fixed top-4 left-1/2 -translate-x-1/2 z-50 bg-green-600 text-white px-4 py-2 rounded-lg shadow-lg text-sm">{toast}</div>}

      {/* Header */}
      <div className="bg-white rounded-xl border p-4 mb-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold">{booking.procedure_name}</h1>
            <div className="flex items-center gap-2 text-xs text-gray-500 mt-1">
              <span className="font-medium">{patientName}</span>
              <span>{pt?.uhid}</span><span>{pt?.age_years}yr/{pt?.gender?.charAt(0).toUpperCase()}</span>
              <span className="bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded">{booking.ot_room?.name}</span>
              <span>Surgeon: {booking.surgeon?.full_name}</span>
              {booking.anaesthetist && <span>Anaes: {booking.anaesthetist.full_name}</span>}
              <span>{booking.scheduled_date} {booking.scheduled_start?.slice(0,5)}</span>
              <span className={`px-1.5 py-0.5 rounded ${booking.status === 'in_progress' ? 'bg-blue-100 text-blue-700 animate-pulse' : booking.status === 'completed' ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700'}`}>{booking.status}</span>
            </div>
          </div>
          <Link href="/ot" className="px-3 py-1.5 bg-gray-100 text-gray-600 text-xs rounded-lg">Back to OT</Link>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 mb-4 border-b pb-px">
        {tabs.map(([k, l]) => <button key={k} onClick={() => setTab(k)}
          className={`px-3 py-2 text-xs font-medium whitespace-nowrap border-b-2 -mb-px ${tab === k ? 'border-blue-600 text-blue-700' : 'border-transparent text-gray-500 hover:text-gray-700'}`}>{l}</button>)}
      </div>

      {/* ===== WHO SURGICAL SAFETY CHECKLIST ===== */}
      {tab === 'who' && <div className="space-y-6">
        {/* SIGN IN */}
        <div className="bg-white rounded-xl border p-5">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-semibold text-sm text-red-700">SIGN IN — Before Induction of Anaesthesia</h3>
            {whoForm.sign_in_time && <span className="text-xs text-green-600">Done {new Date(whoForm.sign_in_time).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}</span>}
          </div>
          <div className="space-y-0.5">
            <Check label="Patient identity confirmed (name, DOB, wristband)" field="si_patient_confirmed" />
            <Check label="Surgical site marked" field="si_site_marked" />
            <Check label="Consent signed and on file" field="si_consent_signed" />
            <Check label="Anaesthesia safety check completed" field="si_anaesthesia_check" />
            <Check label="Pulse oximeter on patient and functioning" field="si_pulse_oximeter" />
            <Check label="Known allergies checked" field="si_allergy_checked" />
            <Check label="Difficult airway / aspiration risk assessed" field="si_airway_risk" />
            <Check label="Risk of >500ml blood loss" field="si_blood_loss_risk" />
            <Check label="Blood products available if needed" field="si_blood_available" />
          </div>
          {(!whoForm.sign_in_time) && <button onClick={() => saveWho('sign_in')} className="mt-3 px-4 py-2 bg-red-600 text-white text-sm rounded-lg hover:bg-red-700">Complete Sign In</button>}
        </div>

        {/* TIME OUT */}
        <div className={`bg-white rounded-xl border p-5 ${!whoForm.sign_in_time ? 'opacity-50 pointer-events-none' : ''}`}>
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-semibold text-sm text-orange-700">TIME OUT — Before Skin Incision</h3>
            {whoForm.time_out_time && <span className="text-xs text-green-600">Done {new Date(whoForm.time_out_time).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}</span>}
          </div>
          <div className="space-y-0.5">
            <Check label="All team members introduced (name and role)" field="to_team_introduction" />
            <Check label="Patient name confirmed" field="to_patient_name_confirmed" />
            <Check label="Procedure and site confirmed" field="to_procedure_confirmed" />
            <Check label="Correct site confirmed" field="to_site_confirmed" />
            <Check label="Prophylactic antibiotic given within last 60 min" field="to_antibiotic_given" />
            <Check label="Essential imaging displayed" field="to_imaging_displayed" />
            <Check label="Critical steps discussed with team" field="to_critical_steps_discussed" />
            <Check label="Equipment and sterility confirmed" field="to_equipment_confirmed" />
            <Check label="Sterility confirmed (no indicator concerns)" field="to_sterility_confirmed" />
          </div>
          <div className="grid grid-cols-2 gap-3 mt-3">
            <div><label className="text-xs text-gray-500">Anticipated duration</label>
              <input type="text" value={whoForm.to_anticipated_duration || ''} onChange={e => updateWho('to_anticipated_duration', e.target.value)} className="w-full px-2 py-1.5 border rounded text-sm" placeholder="e.g., 2 hours" /></div>
            <div><label className="text-xs text-gray-500">Anticipated blood loss</label>
              <input type="text" value={whoForm.to_anticipated_blood_loss || ''} onChange={e => updateWho('to_anticipated_blood_loss', e.target.value)} className="w-full px-2 py-1.5 border rounded text-sm" placeholder="e.g., 200ml" /></div>
          </div>
          {whoForm.sign_in_time && !whoForm.time_out_time && <button onClick={() => saveWho('time_out')} className="mt-3 px-4 py-2 bg-orange-600 text-white text-sm rounded-lg hover:bg-orange-700">Complete Time Out</button>}
        </div>

        {/* SIGN OUT */}
        <div className={`bg-white rounded-xl border p-5 ${!whoForm.time_out_time ? 'opacity-50 pointer-events-none' : ''}`}>
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-semibold text-sm text-green-700">SIGN OUT — Before Patient Leaves OT</h3>
            {whoForm.sign_out_time && <span className="text-xs text-green-600">Done {new Date(whoForm.sign_out_time).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}</span>}
          </div>
          <div className="space-y-0.5">
            <Check label="Procedure recorded correctly" field="so_procedure_recorded" />
            <Check label="Instrument, sponge, and needle counts correct" field="so_instrument_count_correct" />
            <Check label="Specimen labelled (including patient name)" field="so_specimen_labelled" />
            <Check label="VTE prophylaxis planned" field="so_vte_prophylaxis_planned" />
          </div>
          <div className="grid grid-cols-2 gap-3 mt-3">
            <div><label className="text-xs text-gray-500">Equipment problems</label>
              <input type="text" value={whoForm.so_equipment_problems || ''} onChange={e => updateWho('so_equipment_problems', e.target.value)} className="w-full px-2 py-1.5 border rounded text-sm" placeholder="None / describe..." /></div>
            <div><label className="text-xs text-gray-500">Recovery concerns</label>
              <input type="text" value={whoForm.so_recovery_concerns || ''} onChange={e => updateWho('so_recovery_concerns', e.target.value)} className="w-full px-2 py-1.5 border rounded text-sm" placeholder="None / describe..." /></div>
          </div>
          {whoForm.time_out_time && !whoForm.sign_out_time && <button onClick={() => saveWho('sign_out')} className="mt-3 px-4 py-2 bg-green-600 text-white text-sm rounded-lg hover:bg-green-700">Complete Sign Out</button>}
        </div>

        {whoForm.status === 'completed' && <div className="text-center py-4 bg-green-50 rounded-xl border border-green-200 text-green-700 font-medium">WHO Surgical Safety Checklist — COMPLETED</div>}
      </div>}

      {/* ===== PRE-OP NOTE ===== */}
      {tab === 'pre_op' && <div className="bg-white rounded-xl border p-5">
        <h3 className="font-semibold text-sm mb-3">Pre-Operative Assessment Note</h3>
        {otNotes.notes.find((n: any) => n.note_type === 'pre_op') ? (
          <div className="space-y-2 text-sm">{(() => { const n = otNotes.notes.find((n: any) => n.note_type === 'pre_op'); return <>
            <div><span className="text-gray-500">Diagnosis:</span> {n.pre_op_diagnosis}</div>
            <div><span className="text-gray-500">Investigations:</span> {n.pre_op_investigations}</div>
            <div><span className="text-gray-500">Fitness:</span> {n.pre_op_fitness}</div>
            <div><span className="text-gray-500">ASA Grade:</span> {n.pre_op_asa_grade}</div>
            <div className="text-xs text-gray-400 mt-2">By {n.author?.full_name} — {new Date(n.created_at).toLocaleString('en-IN')}</div>
          </>; })()}</div>
        ) : (
          <div className="space-y-3">
            <div><label className="text-xs text-gray-500">Pre-op diagnosis *</label>
              <textarea value={noteForm.pre_op_diagnosis || ''} onChange={e => setNoteForm((f: any) => ({...f, pre_op_diagnosis: e.target.value}))} rows={2} className="w-full px-3 py-2 border rounded-lg text-sm" /></div>
            <div><label className="text-xs text-gray-500">Relevant investigations</label>
              <textarea value={noteForm.pre_op_investigations || ''} onChange={e => setNoteForm((f: any) => ({...f, pre_op_investigations: e.target.value}))} rows={2} className="w-full px-3 py-2 border rounded-lg text-sm" placeholder="CBC, RFT, ECG, CXR findings..." /></div>
            <div className="grid grid-cols-2 gap-3">
              <div><label className="text-xs text-gray-500">Fitness for surgery</label>
                <select value={noteForm.pre_op_fitness || ''} onChange={e => setNoteForm((f: any) => ({...f, pre_op_fitness: e.target.value}))} className="w-full px-3 py-2 border rounded-lg text-sm">
                  <option value="">Select...</option>{['fit','fit_with_precautions','unfit','high_risk'].map(f => <option key={f}>{f.replace(/_/g,' ')}</option>)}</select></div>
              <div><label className="text-xs text-gray-500">ASA Grade (1-6)</label>
                <select value={noteForm.pre_op_asa_grade || ''} onChange={e => setNoteForm((f: any) => ({...f, pre_op_asa_grade: parseInt(e.target.value)||null}))} className="w-full px-3 py-2 border rounded-lg text-sm">
                  <option value="">Select...</option>{[1,2,3,4,5,6].map(g => <option key={g} value={g}>ASA {g}</option>)}</select></div>
            </div>
            <button onClick={() => saveOTNote('pre_op')} className="px-4 py-2 bg-green-600 text-white text-sm rounded-lg">Save Pre-Op Note</button>
          </div>
        )}
      </div>}

      {/* ===== INTRA-OP NOTE ===== */}
      {tab === 'intra_op' && <div className="bg-white rounded-xl border p-5">
        <h3 className="font-semibold text-sm mb-3">Intra-Operative / Surgical Note</h3>
        {otNotes.notes.find((n: any) => n.note_type === 'intra_op') ? (
          <div className="space-y-2 text-sm">{(() => { const n = otNotes.notes.find((n: any) => n.note_type === 'intra_op'); return <>
            <div><span className="text-gray-500">Procedure:</span> {n.procedure_performed}</div>
            <div><span className="text-gray-500">Approach:</span> {n.approach}</div>
            <div><span className="text-gray-500">Findings:</span> {n.findings}</div>
            {n.specimens_sent && <div><span className="text-gray-500">Specimens:</span> {n.specimens_sent}</div>}
            {n.implants_used && <div><span className="text-gray-500">Implants:</span> {n.implants_used}</div>}
            <div><span className="text-gray-500">EBL:</span> {n.ebl_ml} ml</div>
            {n.complications && <div className="text-red-600"><span className="font-medium">Complications:</span> {n.complications}</div>}
            <div><span className="text-gray-500">Duration:</span> {n.duration_minutes} min</div>
            <div className="text-xs text-gray-400 mt-2">By {n.author?.full_name} — {new Date(n.created_at).toLocaleString('en-IN')}</div>
          </>; })()}</div>
        ) : (
          <div className="space-y-3">
            <div><label className="text-xs text-gray-500">Procedure performed *</label>
              <textarea value={noteForm.procedure_performed || ''} onChange={e => setNoteForm((f: any) => ({...f, procedure_performed: e.target.value}))} rows={2} className="w-full px-3 py-2 border rounded-lg text-sm" /></div>
            <div className="grid grid-cols-2 gap-3">
              <div><label className="text-xs text-gray-500">Approach</label>
                <input type="text" value={noteForm.approach || ''} onChange={e => setNoteForm((f: any) => ({...f, approach: e.target.value}))} className="w-full px-3 py-2 border rounded-lg text-sm" placeholder="e.g., Laparoscopic, Open, Robotic..." /></div>
              <div><label className="text-xs text-gray-500">Duration (minutes)</label>
                <input type="number" value={noteForm.duration_minutes || ''} onChange={e => setNoteForm((f: any) => ({...f, duration_minutes: parseInt(e.target.value)||null}))} className="w-full px-3 py-2 border rounded-lg text-sm" /></div>
            </div>
            <div><label className="text-xs text-gray-500">Findings *</label>
              <textarea value={noteForm.findings || ''} onChange={e => setNoteForm((f: any) => ({...f, findings: e.target.value}))} rows={3} className="w-full px-3 py-2 border rounded-lg text-sm" /></div>
            <div className="grid grid-cols-2 gap-3">
              <div><label className="text-xs text-gray-500">Specimens sent</label>
                <input type="text" value={noteForm.specimens_sent || ''} onChange={e => setNoteForm((f: any) => ({...f, specimens_sent: e.target.value}))} className="w-full px-3 py-2 border rounded-lg text-sm" /></div>
              <div><label className="text-xs text-gray-500">Implants used</label>
                <input type="text" value={noteForm.implants_used || ''} onChange={e => setNoteForm((f: any) => ({...f, implants_used: e.target.value}))} className="w-full px-3 py-2 border rounded-lg text-sm" /></div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div><label className="text-xs text-gray-500">EBL (ml)</label>
                <input type="number" value={noteForm.ebl_ml || ''} onChange={e => setNoteForm((f: any) => ({...f, ebl_ml: parseInt(e.target.value)||null}))} className="w-full px-3 py-2 border rounded-lg text-sm" /></div>
              <div><label className="text-xs text-gray-500">Complications</label>
                <input type="text" value={noteForm.complications || ''} onChange={e => setNoteForm((f: any) => ({...f, complications: e.target.value}))} className="w-full px-3 py-2 border rounded-lg text-sm" placeholder="None / describe..." /></div>
            </div>
            <button onClick={() => saveOTNote('intra_op')} className="px-4 py-2 bg-green-600 text-white text-sm rounded-lg">Save Intra-Op Note</button>
          </div>
        )}
      </div>}

      {/* ===== POST-OP NOTE ===== */}
      {tab === 'post_op' && <div className="bg-white rounded-xl border p-5">
        <h3 className="font-semibold text-sm mb-3">Post-Operative Orders & Instructions</h3>
        {otNotes.notes.find((n: any) => n.note_type === 'post_op') ? (
          <div className="space-y-2 text-sm">{(() => { const n = otNotes.notes.find((n: any) => n.note_type === 'post_op'); return <>
            <div><span className="text-gray-500">Post-op diagnosis:</span> {n.post_op_diagnosis}</div>
            <div><span className="text-gray-500">Instructions:</span> {n.post_op_instructions}</div>
            <div><span className="text-gray-500">Diet:</span> {n.post_op_diet}</div>
            <div><span className="text-gray-500">Activity:</span> {n.post_op_activity}</div>
            <div><span className="text-gray-500">Drains:</span> {n.drain_details}</div>
            <div><span className="text-gray-500">DVT prophylaxis:</span> {n.dvt_prophylaxis}</div>
            <div className="text-xs text-gray-400 mt-2">By {n.author?.full_name} — {new Date(n.created_at).toLocaleString('en-IN')}</div>
          </>; })()}</div>
        ) : (
          <div className="space-y-3">
            <div><label className="text-xs text-gray-500">Post-op diagnosis</label>
              <input type="text" value={noteForm.post_op_diagnosis || ''} onChange={e => setNoteForm((f: any) => ({...f, post_op_diagnosis: e.target.value}))} className="w-full px-3 py-2 border rounded-lg text-sm" /></div>
            <div><label className="text-xs text-gray-500">Post-op instructions *</label>
              <textarea value={noteForm.post_op_instructions || ''} onChange={e => setNoteForm((f: any) => ({...f, post_op_instructions: e.target.value}))} rows={3} className="w-full px-3 py-2 border rounded-lg text-sm" placeholder="Monitor vitals Q15min x 4, then Q1H. Keep NPO x 6 hours. DVT prophylaxis..." /></div>
            <div className="grid grid-cols-2 gap-3">
              <div><label className="text-xs text-gray-500">Diet</label>
                <input type="text" value={noteForm.post_op_diet || ''} onChange={e => setNoteForm((f: any) => ({...f, post_op_diet: e.target.value}))} className="w-full px-3 py-2 border rounded-lg text-sm" placeholder="NPO / Sips / Soft diet..." /></div>
              <div><label className="text-xs text-gray-500">Activity</label>
                <input type="text" value={noteForm.post_op_activity || ''} onChange={e => setNoteForm((f: any) => ({...f, post_op_activity: e.target.value}))} className="w-full px-3 py-2 border rounded-lg text-sm" placeholder="Strict bed rest / OOB tomorrow..." /></div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div><label className="text-xs text-gray-500">Drain details</label>
                <input type="text" value={noteForm.drain_details || ''} onChange={e => setNoteForm((f: any) => ({...f, drain_details: e.target.value}))} className="w-full px-3 py-2 border rounded-lg text-sm" placeholder="e.g., Abdominal drain in situ, ICD right..." /></div>
              <div><label className="text-xs text-gray-500">DVT prophylaxis</label>
                <input type="text" value={noteForm.dvt_prophylaxis || ''} onChange={e => setNoteForm((f: any) => ({...f, dvt_prophylaxis: e.target.value}))} className="w-full px-3 py-2 border rounded-lg text-sm" placeholder="e.g., Enoxaparin 40mg SC OD, TED stockings" /></div>
            </div>
            <div><label className="text-xs text-gray-500">Follow-up plan</label>
              <input type="text" value={noteForm.follow_up_plan || ''} onChange={e => setNoteForm((f: any) => ({...f, follow_up_plan: e.target.value}))} className="w-full px-3 py-2 border rounded-lg text-sm" /></div>
            <button onClick={() => saveOTNote('post_op')} className="px-4 py-2 bg-green-600 text-white text-sm rounded-lg">Save Post-Op Note</button>
          </div>
        )}
      </div>}

      {/* ===== ANAESTHESIA RECORD ===== */}
      {tab === 'anaesthesia' && <div className="bg-white rounded-xl border p-5">
        <h3 className="font-semibold text-sm mb-3">Anaesthesia Record</h3>
        <div className="space-y-3">
          <div><label className="text-xs text-gray-500">Anaesthesia type *</label>
            <select value={anaesForm.anaesthesia_type} onChange={e => setAnaesForm((f: any) => ({...f, anaesthesia_type: e.target.value}))} className="w-full px-3 py-2 border rounded-lg text-sm">
              {['general','spinal','epidural','combined_spinal_epidural','regional','local','sedation','mac'].map(t =>
                <option key={t} value={t}>{t.replace(/_/g,' ').toUpperCase()}</option>)}</select></div>
          <div><label className="text-xs text-gray-500">Pre-op assessment (JSON or text)</label>
            <textarea value={anaesForm.pre_op_assessment} onChange={e => setAnaesForm((f: any) => ({...f, pre_op_assessment: e.target.value}))} rows={3} className="w-full px-3 py-2 border rounded-lg text-sm font-mono text-xs" placeholder='{"asa_grade": 2, "airway": "Mallampati II", "fasting_hours": 8, "allergies": "NKDA"}' /></div>
          <div><label className="text-xs text-gray-500">Drugs used (JSON or text)</label>
            <textarea value={anaesForm.drugs_used} onChange={e => setAnaesForm((f: any) => ({...f, drugs_used: e.target.value}))} rows={3} className="w-full px-3 py-2 border rounded-lg text-sm font-mono text-xs" placeholder='[{"drug": "Propofol", "dose": "150mg", "time": "09:15"}, {"drug": "Fentanyl", "dose": "100mcg", "time": "09:10"}]' /></div>
          <div><label className="text-xs text-gray-500">Vitals timeline (JSON or text)</label>
            <textarea value={anaesForm.vitals_timeline} onChange={e => setAnaesForm((f: any) => ({...f, vitals_timeline: e.target.value}))} rows={3} className="w-full px-3 py-2 border rounded-lg text-sm font-mono text-xs" placeholder='[{"time": "09:00", "hr": 78, "bp": "120/80", "spo2": 99}, ...]' /></div>
          <div><label className="text-xs text-gray-500">Complications</label>
            <textarea value={anaesForm.complications} onChange={e => setAnaesForm((f: any) => ({...f, complications: e.target.value}))} rows={2} className="w-full px-3 py-2 border rounded-lg text-sm" placeholder="None / describe..." /></div>
          <button onClick={saveAnaes} className="px-4 py-2 bg-green-600 text-white text-sm rounded-lg">Save Anaesthesia Record</button>
        </div>
      </div>}
    </div>
  );
}
