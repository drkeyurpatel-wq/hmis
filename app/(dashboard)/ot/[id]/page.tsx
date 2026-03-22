'use client';
import React, { useState, useEffect, useCallback } from 'react';
import { useParams } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { useAuthStore } from '@/lib/store/auth';
import AnaesthesiaForm from '@/components/ot/anaesthesia-form';
import Link from 'next/link';

let _sb: any = null;
function sb() { if (typeof window === 'undefined') return null as any; if (!_sb) { try { _sb = createClient(); } catch { return null; } } return _sb; }

type Tab = 'who' | 'pre_op' | 'intra_op' | 'post_op' | 'anaesthesia' | 'implants';

export default function OTDetailPage() {
  const { id } = useParams();
  const bookingId = id as string;
  const { staff } = useAuthStore();
  const staffId = staff?.id || '';
  const [booking, setBooking] = useState<any>(null);
  const [tab, setTab] = useState<Tab>('who');
  const [toast, setToast] = useState('');
  const flash = (m: string) => { setToast(m); setTimeout(() => setToast(''), 2500); };

  // WHO Checklist
  const [checklist, setChecklist] = useState<any>(null);
  // OT Notes
  const [notes, setNotes] = useState<any>({ pre_op: {}, intra_op: {}, post_op: {} });
  // Implants
  const [implants, setImplants] = useState<any[]>([]);
  const [implantForm, setImplantForm] = useState({ implant_name: '', manufacturer: '', catalogue_number: '', lot_number: '', serial_number: '', size: '', quantity: 1, cost: '', mrp: '' });
  // Errors
  const [actionError, setActionError] = useState('');

  // Load booking
  useEffect(() => {
    if (!bookingId || !sb()) return;
    sb().from('hmis_ot_bookings')
      .select('*, patient:hmis_admissions!inner(ipd_number, admission_date, patient:hmis_patients!inner(first_name, last_name, uhid, age_years, gender)), surgeon:hmis_staff!hmis_ot_bookings_surgeon_id_fkey(full_name), anaesthetist:hmis_staff!hmis_ot_bookings_anaesthetist_id_fkey(full_name), ot_room:hmis_ot_rooms(name, type)')
      .eq('id', bookingId).single()
      .then(({ data }: any) => setBooking(data));
  }, [bookingId]);

  // Load WHO checklist
  const loadChecklist = useCallback(async () => {
    if (!bookingId || !sb()) return;
    const { data } = await sb().from('hmis_ot_safety_checklist').select('*').eq('ot_booking_id', bookingId).maybeSingle();
    setChecklist(data);
  }, [bookingId]);
  useEffect(() => { loadChecklist(); }, [loadChecklist]);

  // Load OT notes
  const loadNotes = useCallback(async () => {
    if (!bookingId || !sb()) return;
    const { data } = await sb().from('hmis_ot_notes').select('*').eq('ot_booking_id', bookingId);
    const map: any = { pre_op: {}, intra_op: {}, post_op: {} };
    (data || []).forEach((n: any) => { map[n.note_type] = n; });
    setNotes(map);
  }, [bookingId]);
  useEffect(() => { loadNotes(); }, [loadNotes]);

  // Load implants
  const loadImplants = useCallback(async () => {
    if (!bookingId || !sb()) return;
    const { data } = await sb().from('hmis_ot_implants').select('*').eq('ot_booking_id', bookingId).order('created_at');
    setImplants(data || []);
  }, [bookingId]);
  useEffect(() => { loadImplants(); }, [loadImplants]);

  // ---- WHO Checklist Actions ----
  const updateChecklist = async (field: string, value: any) => {
    if (!bookingId || !sb()) return;
    const updates = { [field]: value };
    if (checklist?.id) {
      await sb().from('hmis_ot_safety_checklist').update(updates).eq('id', checklist.id);
    } else {
      await sb().from('hmis_ot_safety_checklist').insert({ ot_booking_id: bookingId, ...updates });
    }
    loadChecklist();
  };

  const completePhase = async (phase: 'sign_in' | 'time_out' | 'sign_out') => {
    const now = new Date().toISOString();
    await updateChecklist(`${phase}_done`, true);
    await updateChecklist(`${phase}_at`, now);
    await updateChecklist(`${phase}_by`, staffId);
    flash(`${phase.replace('_', ' ').toUpperCase()} completed`);
  };

  // ---- OT Notes Actions ----
  const saveNote = async (noteType: string, data: any) => {
    if (!bookingId || !sb()) return;
    const existing = notes[noteType];
    if (existing?.id) {
      await sb().from('hmis_ot_notes').update({ ...data, updated_at: new Date().toISOString() }).eq('id', existing.id);
    } else {
      await sb().from('hmis_ot_notes').insert({ ot_booking_id: bookingId, note_type: noteType, author_id: staffId, ...data });
    }
    loadNotes();
    flash(`${noteType.replace('_', '-')} note saved`);
  };

  // ---- Implant Actions ----
  const addImplant = async () => {
    if (!bookingId || !sb()) return;
    if (!implantForm.implant_name.trim()) { setActionError('Implant name required'); return; }
    if (implantForm.quantity < 1) { setActionError('Quantity must be at least 1'); return; }
    setActionError('');
    await sb().from('hmis_ot_implants').insert({
      ot_booking_id: bookingId, ...implantForm,
      cost: parseFloat(implantForm.cost) || 0, mrp: parseFloat(implantForm.mrp) || 0,
    });
    setImplantForm({ implant_name: '', manufacturer: '', catalogue_number: '', lot_number: '', serial_number: '', size: '', quantity: 1, cost: '', mrp: '' });
    loadImplants();
    flash('Implant added');
  };

  const removeImplant = async (implantId: string) => {
    if (!sb()) return;
    await sb().from('hmis_ot_implants').delete().eq('id', implantId);
    loadImplants();
  };

  const patientName = booking ? `${booking.patient?.patient?.first_name || ''} ${booking.patient?.patient?.last_name || ''}` : '';
  const fmt = (n: number) => n.toLocaleString('en-IN', { maximumFractionDigits: 0 });

  if (!booking) return <div className="max-w-5xl mx-auto p-4"><div className="animate-pulse space-y-4"><div className="h-8 bg-gray-200 rounded w-1/3" /><div className="h-48 bg-gray-200 rounded-xl" /></div></div>;

  // Timeline
  const timeline = [
    booking.actual_start ? { label: 'Surgery Start', time: new Date(booking.actual_start).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }), done: true } : null,
    checklist?.sign_in_done ? { label: 'Sign In', time: checklist.sign_in_at ? new Date(checklist.sign_in_at).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }) : 'Done', done: true } : null,
    checklist?.time_out_done ? { label: 'Time Out', time: checklist.time_out_at ? new Date(checklist.time_out_at).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }) : 'Done', done: true } : null,
    checklist?.sign_out_done ? { label: 'Sign Out', time: checklist.sign_out_at ? new Date(checklist.sign_out_at).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }) : 'Done', done: true } : null,
    booking.actual_end ? { label: 'Surgery End', time: new Date(booking.actual_end).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }), done: true } : null,
  ].filter(Boolean);

  const tabs: [Tab, string][] = [['who', 'WHO Safety Checklist'], ['pre_op', 'Pre-Op Assessment'], ['intra_op', 'Intra-Op Notes'], ['post_op', 'Post-Op Orders'], ['anaesthesia', 'Anaesthesia Record'], ['implants', `Implants (${implants.length})`]];

  return (
    <div className="max-w-5xl mx-auto space-y-4">
      {toast && <div className="fixed top-4 left-1/2 -translate-x-1/2 z-50 bg-emerald-600 text-white px-4 py-2 rounded-xl shadow-lg text-sm">{toast}</div>}

      {/* Surgery Header */}
      <div className="bg-white rounded-xl border p-5">
        <div className="flex items-start justify-between mb-3">
          <div>
            <h1 className="text-lg font-bold">{booking.procedure_name}</h1>
            <div className="text-sm text-gray-600 mt-0.5">
              {patientName} <span className="text-gray-400">({booking.patient?.patient?.uhid})</span>
              <span className="text-gray-400 mx-2">|</span>{booking.patient?.patient?.age_years}y {booking.patient?.patient?.gender}
              <span className="text-gray-400 mx-2">|</span>IPD: {booking.patient?.ipd_number}
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span className={`px-2.5 py-1 rounded-lg text-xs font-medium ${booking.status === 'in_progress' ? 'bg-red-100 text-red-700 animate-pulse' : booking.status === 'completed' ? 'bg-green-100 text-green-700' : 'bg-blue-100 text-teal-700'}`}>{booking.status?.replace('_', ' ')}</span>
            <Link href="/ot" className="text-xs text-gray-500 hover:text-teal-600">Back to OT</Link>
          </div>
        </div>

        {/* Team + Details */}
        <div className="grid grid-cols-5 gap-3 text-xs bg-gray-50 rounded-lg p-3">
          <div><span className="text-gray-500 block">Surgeon</span><span className="font-semibold">{booking.surgeon?.full_name}</span></div>
          <div><span className="text-gray-500 block">Anaesthetist</span><span className="font-semibold">{booking.anaesthetist?.full_name || 'Not assigned'}</span></div>
          <div><span className="text-gray-500 block">OT Room</span><span className="font-semibold">{booking.ot_room?.name}</span></div>
          <div><span className="text-gray-500 block">Date</span><span className="font-semibold">{booking.scheduled_date} at {booking.scheduled_start}</span></div>
          <div><span className="text-gray-500 block">Type</span>
            {booking.is_emergency && <span className="bg-red-100 text-red-700 px-1.5 py-0.5 rounded text-[10px] mr-1">EMERGENCY</span>}
            {booking.is_robotic && <span className="bg-purple-100 text-purple-700 px-1.5 py-0.5 rounded text-[10px]">{booking.robot_type === 'cuvis' ? 'Cuvis Robot' : booking.robot_type === 'ssi_mantra' ? 'SSI Mantra' : 'Robotic'}</span>}
            {!booking.is_emergency && !booking.is_robotic && <span>Elective</span>}
          </div>
        </div>

        {/* Surgery Timeline */}
        {timeline.length > 0 && <div className="flex items-center gap-1 mt-3">
          {timeline.map((t: any, i: number) => (
            <React.Fragment key={i}>
              {i > 0 && <div className="flex-1 h-0.5 bg-green-400" />}
              <div className="flex flex-col items-center">
                <div className="w-4 h-4 rounded-full bg-green-500 flex items-center justify-center"><span className="text-white text-[8px]">&#10003;</span></div>
                <span className="text-[9px] text-gray-500 mt-0.5">{t.label}</span>
                <span className="text-[9px] font-semibold text-green-700">{t.time}</span>
              </div>
            </React.Fragment>
          ))}
        </div>}
      </div>

      {/* Tabs */}
      <div className="flex gap-0.5 pb-0.5 overflow-x-auto scrollbar-thin">
        {tabs.map(([k, l]) => <button key={k} onClick={() => setTab(k)}
          className={`px-3 py-2 text-xs font-medium whitespace-nowrap rounded-xl ${tab === k ? 'bg-teal-600 text-white shadow-sm' : 'bg-white text-gray-500 border border-gray-100 hover:bg-gray-50'}`}>{l}</button>)}
      </div>

      {/* ===== WHO SAFETY CHECKLIST ===== */}
      {tab === 'who' && <div className="space-y-4">
        {/* SIGN IN */}
        <div className={`bg-white rounded-xl border p-5 ${checklist?.sign_in_done ? 'border-green-300' : ''}`}>
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-bold text-sm">SIGN IN <span className="text-gray-400 font-normal">— Before anaesthesia</span></h3>
            {checklist?.sign_in_done ? <span className="bg-green-100 text-green-700 px-2 py-0.5 rounded text-xs">Completed {checklist.sign_in_at ? new Date(checklist.sign_in_at).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }) : ''}</span> : <button onClick={() => completePhase('sign_in')} className="px-3 py-1.5 bg-emerald-600 text-white text-xs rounded-lg">Complete Sign In</button>}
          </div>
          <div className="grid grid-cols-2 gap-2">
            {[['patient_identity_confirmed', 'Patient identity confirmed (name, DOB, wristband)'],
              ['site_marked', 'Surgical site marked'],
              ['consent_verified', 'Consent form signed and verified'],
              ['anaesthesia_check', 'Anaesthesia safety check complete'],
              ['pulse_oximeter', 'Pulse oximeter on patient and functioning'],
              ['known_allergy', 'Known allergy checked'],
              ['difficult_airway', 'Difficult airway / aspiration risk assessed'],
              ['blood_loss_risk', 'Risk of blood loss >500ml assessed'],
              ['blood_availability', 'Blood products available if needed'],
            ].map(([field, label]) => (
              <label key={field} className="flex items-center gap-2 text-xs bg-gray-50 rounded-lg px-3 py-2 cursor-pointer hover:bg-gray-100">
                <input type="checkbox" checked={!!checklist?.[field]} onChange={e => updateChecklist(field, e.target.checked)} className="rounded" />
                <span className={checklist?.[field] ? 'text-green-700' : 'text-gray-700'}>{label}</span>
              </label>
            ))}
          </div>
          {checklist?.known_allergy && <div className="mt-2">
            <input type="text" value={checklist?.allergy_details || ''} onChange={e => updateChecklist('allergy_details', e.target.value)} className="w-full px-3 py-2 border rounded-lg text-sm" placeholder="Allergy details..." />
          </div>}
        </div>

        {/* TIME OUT */}
        <div className={`bg-white rounded-xl border p-5 ${checklist?.time_out_done ? 'border-green-300' : ''}`}>
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-bold text-sm">TIME OUT <span className="text-gray-400 font-normal">— Before skin incision</span></h3>
            {checklist?.time_out_done ? <span className="bg-green-100 text-green-700 px-2 py-0.5 rounded text-xs">Completed {checklist.time_out_at ? new Date(checklist.time_out_at).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }) : ''}</span> : <button onClick={() => completePhase('time_out')} className="px-3 py-1.5 bg-emerald-600 text-white text-xs rounded-lg">Complete Time Out</button>}
          </div>
          <div className="grid grid-cols-2 gap-2">
            {[['team_introduced', 'All team members introduced by name and role'],
              ['patient_name_confirmed', 'Patient name confirmed'],
              ['procedure_confirmed', 'Procedure confirmed'],
              ['site_confirmed', 'Site confirmed'],
              ['antibiotic_given', 'Prophylactic antibiotic given within last 60 min'],
              ['imaging_displayed', 'Essential imaging displayed'],
              ['anticipated_events_discussed', 'Anticipated critical events discussed'],
            ].map(([field, label]) => (
              <label key={field} className="flex items-center gap-2 text-xs bg-gray-50 rounded-lg px-3 py-2 cursor-pointer hover:bg-gray-100">
                <input type="checkbox" checked={!!checklist?.[field]} onChange={e => updateChecklist(field, e.target.checked)} className="rounded" />
                <span className={checklist?.[field] ? 'text-green-700' : 'text-gray-700'}>{label}</span>
              </label>
            ))}
          </div>
        </div>

        {/* SIGN OUT */}
        <div className={`bg-white rounded-xl border p-5 ${checklist?.sign_out_done ? 'border-green-300' : ''}`}>
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-bold text-sm">SIGN OUT <span className="text-gray-400 font-normal">— Before patient leaves OT</span></h3>
            {checklist?.sign_out_done ? <span className="bg-green-100 text-green-700 px-2 py-0.5 rounded text-xs">Completed {checklist.sign_out_at ? new Date(checklist.sign_out_at).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }) : ''}</span> : <button onClick={() => completePhase('sign_out')} className="px-3 py-1.5 bg-emerald-600 text-white text-xs rounded-lg">Complete Sign Out</button>}
          </div>
          <div className="grid grid-cols-2 gap-2">
            {[['procedure_recorded', 'Procedure name recorded'],
              ['instrument_count_correct', 'Instrument count correct'],
              ['sponge_count_correct', 'Sponge count correct'],
              ['needle_count_correct', 'Needle count correct'],
              ['specimen_labelled', 'Specimen labelled correctly'],
            ].map(([field, label]) => (
              <label key={field} className="flex items-center gap-2 text-xs bg-gray-50 rounded-lg px-3 py-2 cursor-pointer hover:bg-gray-100">
                <input type="checkbox" checked={!!checklist?.[field]} onChange={e => updateChecklist(field, e.target.checked)} className="rounded" />
                <span className={checklist?.[field] ? 'text-green-700' : 'text-gray-700'}>{label}</span>
              </label>
            ))}
          </div>
          <div className="grid grid-cols-2 gap-3 mt-2">
            <div><label className="text-xs text-gray-500">Equipment problems</label>
              <input type="text" value={checklist?.equipment_issues || ''} onChange={e => updateChecklist('equipment_issues', e.target.value)} className="w-full px-3 py-2 border rounded-lg text-sm" placeholder="None / describe..." /></div>
            <div><label className="text-xs text-gray-500">Key recovery concerns</label>
              <input type="text" value={checklist?.recovery_concerns || ''} onChange={e => updateChecklist('recovery_concerns', e.target.value)} className="w-full px-3 py-2 border rounded-lg text-sm" placeholder="None / describe..." /></div>
          </div>
        </div>
      </div>}

      {/* ===== PRE-OP ===== */}
      {tab === 'pre_op' && <div className="bg-white rounded-xl border p-5 space-y-3">
        <h3 className="font-bold text-sm">Pre-Operative Assessment</h3>
        <div className="grid grid-cols-2 gap-3">
          <div><label className="text-xs text-gray-500">Pre-op diagnosis</label>
            <textarea value={notes.pre_op?.pre_op_diagnosis || ''} onChange={e => setNotes((n: any) => ({ ...n, pre_op: { ...n.pre_op, pre_op_diagnosis: e.target.value } }))} rows={2} className="w-full px-3 py-2 border rounded-lg text-sm" /></div>
          <div><label className="text-xs text-gray-500">Investigations</label>
            <textarea value={notes.pre_op?.pre_op_investigations || ''} onChange={e => setNotes((n: any) => ({ ...n, pre_op: { ...n.pre_op, pre_op_investigations: e.target.value } }))} rows={2} className="w-full px-3 py-2 border rounded-lg text-sm" placeholder="CBC, RFT, ECG, CXR..." /></div>
        </div>
        <div className="grid grid-cols-3 gap-3">
          <div><label className="text-xs text-gray-500">Fitness</label>
            <div className="flex gap-1 mt-1">{['fit', 'unfit', 'conditional'].map(f => (
              <button key={f} onClick={() => setNotes((n: any) => ({ ...n, pre_op: { ...n.pre_op, pre_op_fitness: f } }))}
                className={`flex-1 py-1.5 rounded text-xs border ${notes.pre_op?.pre_op_fitness === f ? 'bg-teal-600 text-white' : 'bg-white'}`}>{f}</button>
            ))}</div></div>
          <div><label className="text-xs text-gray-500">ASA Grade</label>
            <div className="flex gap-1 mt-1">{[1, 2, 3, 4, 5, 6].map(g => (
              <button key={g} onClick={() => setNotes((n: any) => ({ ...n, pre_op: { ...n.pre_op, pre_op_asa_grade: g } }))}
                className={`flex-1 py-1.5 rounded text-xs border ${notes.pre_op?.pre_op_asa_grade === g ? 'bg-teal-600 text-white' : 'bg-white'}`}>ASA {g}</button>
            ))}</div></div>
          <div className="flex items-end"><button onClick={() => saveNote('pre_op', notes.pre_op)} className="w-full px-4 py-2 bg-emerald-600 text-white text-sm rounded-lg">Save Pre-Op</button></div>
        </div>
      </div>}

      {/* ===== INTRA-OP ===== */}
      {tab === 'intra_op' && <div className="bg-white rounded-xl border p-5 space-y-3">
        <h3 className="font-bold text-sm">Intra-Operative Notes</h3>
        <div className="grid grid-cols-2 gap-3">
          <div><label className="text-xs text-gray-500">Procedure performed</label>
            <textarea value={notes.intra_op?.procedure_performed || ''} onChange={e => setNotes((n: any) => ({ ...n, intra_op: { ...n.intra_op, procedure_performed: e.target.value } }))} rows={3} className="w-full px-3 py-2 border rounded-lg text-sm" /></div>
          <div><label className="text-xs text-gray-500">Findings</label>
            <textarea value={notes.intra_op?.findings || ''} onChange={e => setNotes((n: any) => ({ ...n, intra_op: { ...n.intra_op, findings: e.target.value } }))} rows={3} className="w-full px-3 py-2 border rounded-lg text-sm" /></div>
        </div>
        <div className="grid grid-cols-4 gap-3">
          <div><label className="text-xs text-gray-500">Approach</label><input type="text" value={notes.intra_op?.approach || ''} onChange={e => setNotes((n: any) => ({ ...n, intra_op: { ...n.intra_op, approach: e.target.value } }))} className="w-full px-3 py-2 border rounded-lg text-sm" placeholder="Lap / Open / Robotic" /></div>
          <div><label className="text-xs text-gray-500">EBL (ml)</label><input type="number" value={notes.intra_op?.ebl_ml || ''} onChange={e => setNotes((n: any) => ({ ...n, intra_op: { ...n.intra_op, ebl_ml: parseInt(e.target.value) || 0 } }))} className="w-full px-3 py-2 border rounded-lg text-sm" /></div>
          <div><label className="text-xs text-gray-500">Duration (min)</label><input type="number" value={notes.intra_op?.duration_minutes || ''} onChange={e => setNotes((n: any) => ({ ...n, intra_op: { ...n.intra_op, duration_minutes: parseInt(e.target.value) || 0 } }))} className="w-full px-3 py-2 border rounded-lg text-sm" /></div>
          <div><label className="text-xs text-gray-500">Specimens sent</label><input type="text" value={notes.intra_op?.specimens_sent || ''} onChange={e => setNotes((n: any) => ({ ...n, intra_op: { ...n.intra_op, specimens_sent: e.target.value } }))} className="w-full px-3 py-2 border rounded-lg text-sm" placeholder="None / describe" /></div>
        </div>
        <div><label className="text-xs text-gray-500">Complications</label><input type="text" value={notes.intra_op?.complications || ''} onChange={e => setNotes((n: any) => ({ ...n, intra_op: { ...n.intra_op, complications: e.target.value } }))} className="w-full px-3 py-2 border rounded-lg text-sm" placeholder="None / describe..." /></div>
        <button onClick={() => saveNote('intra_op', notes.intra_op)} className="px-4 py-2 bg-emerald-600 text-white text-sm rounded-lg">Save Intra-Op</button>
      </div>}

      {/* ===== POST-OP ===== */}
      {tab === 'post_op' && <div className="bg-white rounded-xl border p-5 space-y-3">
        <h3 className="font-bold text-sm">Post-Operative Orders</h3>
        <div className="grid grid-cols-2 gap-3">
          <div><label className="text-xs text-gray-500">Post-op diagnosis</label><textarea value={notes.post_op?.post_op_diagnosis || ''} onChange={e => setNotes((n: any) => ({ ...n, post_op: { ...n.post_op, post_op_diagnosis: e.target.value } }))} rows={2} className="w-full px-3 py-2 border rounded-lg text-sm" /></div>
          <div><label className="text-xs text-gray-500">Post-op instructions</label><textarea value={notes.post_op?.post_op_instructions || ''} onChange={e => setNotes((n: any) => ({ ...n, post_op: { ...n.post_op, post_op_instructions: e.target.value } }))} rows={2} className="w-full px-3 py-2 border rounded-lg text-sm" placeholder="Vitals Q15min x4, NPO x6h..." /></div>
        </div>
        <div className="grid grid-cols-4 gap-3">
          <div><label className="text-xs text-gray-500">Diet</label><input type="text" value={notes.post_op?.post_op_diet || ''} onChange={e => setNotes((n: any) => ({ ...n, post_op: { ...n.post_op, post_op_diet: e.target.value } }))} className="w-full px-3 py-2 border rounded-lg text-sm" placeholder="NPO / Sips / Soft" /></div>
          <div><label className="text-xs text-gray-500">Activity</label><input type="text" value={notes.post_op?.post_op_activity || ''} onChange={e => setNotes((n: any) => ({ ...n, post_op: { ...n.post_op, post_op_activity: e.target.value } }))} className="w-full px-3 py-2 border rounded-lg text-sm" placeholder="Bed rest / OOB" /></div>
          <div><label className="text-xs text-gray-500">Drains</label><input type="text" value={notes.post_op?.drain_details || ''} onChange={e => setNotes((n: any) => ({ ...n, post_op: { ...n.post_op, drain_details: e.target.value } }))} className="w-full px-3 py-2 border rounded-lg text-sm" placeholder="ICD, abdominal drain..." /></div>
          <div><label className="text-xs text-gray-500">DVT prophylaxis</label><input type="text" value={notes.post_op?.dvt_prophylaxis || ''} onChange={e => setNotes((n: any) => ({ ...n, post_op: { ...n.post_op, dvt_prophylaxis: e.target.value } }))} className="w-full px-3 py-2 border rounded-lg text-sm" placeholder="Enoxaparin 40mg SC OD" /></div>
        </div>
        <button onClick={() => saveNote('post_op', notes.post_op)} className="px-4 py-2 bg-emerald-600 text-white text-sm rounded-lg">Save Post-Op</button>
      </div>}

      {/* ===== ANAESTHESIA ===== */}
      {tab === 'anaesthesia' && <AnaesthesiaForm bookingId={bookingId} staffId={staffId} patientName={patientName} onFlash={flash} />}

      {/* ===== IMPLANTS ===== */}
      {tab === 'implants' && <div className="space-y-4">
        <div className="bg-white rounded-xl border p-5 space-y-3">
          <h3 className="font-bold text-sm">Add Implant / Consumable</h3>
          <div className="grid grid-cols-4 gap-3">
            <div><label className="text-xs text-gray-500">Implant name *</label><input type="text" value={implantForm.implant_name} onChange={e => setImplantForm(f => ({ ...f, implant_name: e.target.value }))} className="w-full px-3 py-2 border rounded-lg text-sm" placeholder="e.g., DePuy TKR Implant" /></div>
            <div><label className="text-xs text-gray-500">Manufacturer</label><input type="text" value={implantForm.manufacturer} onChange={e => setImplantForm(f => ({ ...f, manufacturer: e.target.value }))} className="w-full px-3 py-2 border rounded-lg text-sm" placeholder="DePuy / Zimmer / Medtronic" /></div>
            <div><label className="text-xs text-gray-500">Catalogue #</label><input type="text" value={implantForm.catalogue_number} onChange={e => setImplantForm(f => ({ ...f, catalogue_number: e.target.value }))} className="w-full px-3 py-2 border rounded-lg text-sm" /></div>
            <div><label className="text-xs text-gray-500">Lot #</label><input type="text" value={implantForm.lot_number} onChange={e => setImplantForm(f => ({ ...f, lot_number: e.target.value }))} className="w-full px-3 py-2 border rounded-lg text-sm" /></div>
          </div>
          <div className="grid grid-cols-5 gap-3">
            <div><label className="text-xs text-gray-500">Serial #</label><input type="text" value={implantForm.serial_number} onChange={e => setImplantForm(f => ({ ...f, serial_number: e.target.value }))} className="w-full px-3 py-2 border rounded-lg text-sm" /></div>
            <div><label className="text-xs text-gray-500">Size</label><input type="text" value={implantForm.size} onChange={e => setImplantForm(f => ({ ...f, size: e.target.value }))} className="w-full px-3 py-2 border rounded-lg text-sm" placeholder="e.g., 12mm, Size 5" /></div>
            <div><label className="text-xs text-gray-500">Qty</label><input type="number" value={implantForm.quantity} onChange={e => setImplantForm(f => ({ ...f, quantity: parseInt(e.target.value) || 1 }))} className="w-full px-3 py-2 border rounded-lg text-sm" min="1" /></div>
            <div><label className="text-xs text-gray-500">Cost</label><input type="number" value={implantForm.cost} onChange={e => setImplantForm(f => ({ ...f, cost: e.target.value }))} className="w-full px-3 py-2 border rounded-lg text-sm" placeholder="Purchase rate" /></div>
            <div><label className="text-xs text-gray-500">MRP</label><input type="number" value={implantForm.mrp} onChange={e => setImplantForm(f => ({ ...f, mrp: e.target.value }))} className="w-full px-3 py-2 border rounded-lg text-sm" placeholder="Patient charge" /></div>
          </div>
          {actionError && <div className="text-sm text-red-700">{actionError}</div>}
          <button onClick={addImplant} className="px-4 py-2 bg-emerald-600 text-white text-sm rounded-lg">Add Implant</button>
        </div>

        {implants.length > 0 && <div className="bg-white rounded-xl border overflow-hidden">
          <table className="w-full text-xs"><thead><tr className="bg-gray-50 border-b">
            <th className="p-2 text-left">Implant</th><th className="p-2">Manufacturer</th><th className="p-2">Lot #</th><th className="p-2">Serial #</th><th className="p-2">Size</th><th className="p-2 text-right">Qty</th><th className="p-2 text-right">Cost</th><th className="p-2 text-right">MRP</th><th className="p-2"></th>
          </tr></thead><tbody>{implants.map(imp => (
            <tr key={imp.id} className="border-b">
              <td className="p-2 font-medium">{imp.implant_name}</td>
              <td className="p-2 text-center text-gray-500">{imp.manufacturer || '-'}</td>
              <td className="p-2 text-center font-mono text-[10px]">{imp.lot_number || '-'}</td>
              <td className="p-2 text-center font-mono text-[10px]">{imp.serial_number || '-'}</td>
              <td className="p-2 text-center">{imp.size || '-'}</td>
              <td className="p-2 text-right">{imp.quantity}</td>
              <td className="p-2 text-right">{parseFloat(imp.cost) > 0 ? `₹${fmt(parseFloat(imp.cost))}` : '-'}</td>
              <td className="p-2 text-right font-semibold">{parseFloat(imp.mrp) > 0 ? `₹${fmt(parseFloat(imp.mrp))}` : '-'}</td>
              <td className="p-2"><button onClick={() => removeImplant(imp.id)} className="text-red-500 text-[10px]">Remove</button></td>
            </tr>
          ))}</tbody>
          <tfoot><tr className="bg-gray-50 font-semibold"><td colSpan={5} className="p-2 text-right">Total</td><td className="p-2 text-right">{implants.reduce((s, i) => s + i.quantity, 0)}</td><td className="p-2 text-right">₹{fmt(implants.reduce((s, i) => s + parseFloat(i.cost || 0) * i.quantity, 0))}</td><td className="p-2 text-right">₹{fmt(implants.reduce((s, i) => s + parseFloat(i.mrp || 0) * i.quantity, 0))}</td><td></td></tr></tfoot>
          </table>
        </div>}
        {implants.length === 0 && <div className="text-center py-6 bg-white rounded-xl border text-gray-400 text-sm">No implants recorded for this surgery</div>}
      </div>}
    </div>
  );
}
