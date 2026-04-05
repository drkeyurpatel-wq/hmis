'use client';
import React, { useState, useEffect } from 'react';
import { RoleGuard } from '@/components/ui/shared';
import { useAuthStore } from '@/lib/store/auth';
import { useTeleconsults } from '@/lib/telemedicine/telemedicine-hooks';
import { sb } from '@/lib/supabase/browser';
import { Plus, X, Video, Phone, Clock, ExternalLink, Search } from 'lucide-react';

type Tab = 'today' | 'schedule' | 'call';
const STATUS_B: Record<string, string> = { scheduled: 'inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold bg-blue-50 text-blue-700', waiting: 'inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold bg-amber-50 text-amber-700', in_progress: 'inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold bg-purple-50 text-purple-700', completed: 'inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-50 text-emerald-700', no_show: 'inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold bg-red-50 text-red-700', cancelled: 'inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold bg-gray-100 text-gray-600' };

function TeleInner() {
  const { staff, activeCentreId } = useAuthStore();
  const centreId = activeCentreId || '';
  const staffId = staff?.id || '';
  const tele = useTeleconsults(centreId, staff?.staff_type === 'doctor' ? staffId : undefined);
  const [tab, setTab] = useState<Tab>('today');
  const [toast, setToast] = useState('');
  const flash = (m: string) => { setToast(m); setTimeout(() => setToast(''), 3000); };
  const [activeCall, setActiveCall] = useState<any>(null);
  const [postNotes, setPostNotes] = useState('');

  // Schedule form
  const [showSchedule, setShowSchedule] = useState(false);
  const [patSearch, setPatSearch] = useState('');
  const [patResults, setPatResults] = useState<any[]>([]);
  const [selPat, setSelPat] = useState<any>(null);
  const [schedForm, setSchedForm] = useState({ doctor_id: '', scheduled_at: '', chief_complaint: '', consultation_fee: '' });
  const [doctors, setDoctors] = useState<any[]>([]);

  useEffect(() => {
    if (!centreId) return;
    sb().from('hmis_staff').select('id, full_name, specialisation').eq('staff_type', 'doctor').eq('is_active', true)
      .then(({ data }: any) => setDoctors(data || []));
  }, [centreId]);

  useEffect(() => {
    if (patSearch.length < 2) { setPatResults([]); return; }
    const t = setTimeout(async () => {
      const { data } = await sb().from('hmis_patients').select('id, uhid, first_name, last_name, age_years, gender, phone_primary')
        .or(`uhid.ilike.%${patSearch}%,first_name.ilike.%${patSearch}%,phone_primary.ilike.%${patSearch}%`).eq('is_active', true).limit(5);
      setPatResults(data || []);
    }, 300);
    return () => clearTimeout(t);
  }, [patSearch]);

  const handleSchedule = async () => {
    if (!selPat || !schedForm.doctor_id || !schedForm.scheduled_at) return;
    const res = await tele.schedule({
      patient_id: selPat.id, doctor_id: schedForm.doctor_id,
      scheduled_at: schedForm.scheduled_at, chief_complaint: schedForm.chief_complaint,
      consultation_fee: schedForm.consultation_fee ? parseFloat(schedForm.consultation_fee) : null,
    });
    if (res.success) { flash('Teleconsult scheduled'); setShowSchedule(false); setSelPat(null); } else { flash(res.error || 'Operation failed'); }
  };

  const joinCall = (consult: any) => {
    tele.startConsult(consult.id);
    setActiveCall(consult);
    setTab('call');
  };

  const endCall = async () => {
    if (activeCall) {
      await tele.endConsult(activeCall.id, postNotes || undefined);
      flash('Teleconsult completed');
      setActiveCall(null);
      setPostNotes('');
      setTab('today');
    }
  };

  return (
    <div className="max-w-[1400px] mx-auto space-y-4">
      {toast && <div className="fixed top-4 left-1/2 -translate-x-1/2 z-50 bg-teal-600 text-white px-5 py-2.5 rounded-xl shadow-lg text-sm font-medium">{toast}</div>}

      <div className="flex items-center justify-between">
        <div><h1 className="text-xl font-bold tracking-tight">Telemedicine <span className="ml-2 px-2 py-0.5 text-[10px] font-medium bg-amber-100 text-amber-700 rounded-full align-middle">Coming soon</span></h1><p className="text-xs text-gray-400">Video integration pending setup. Contact IT to configure Jitsi/Twilio.</p></div>
        <button onClick={() => setShowSchedule(true)} className="flex items-center gap-2 px-4 py-2.5 bg-teal-600 text-white text-sm rounded-xl font-semibold hover:bg-teal-700"><Plus size={15} /> Schedule Consult</button>
      </div>

      <div className="grid grid-cols-7 gap-2">
        {[
          { l: 'Total', v: tele.stats.total, c: 'text-gray-800' },
          { l: 'Scheduled', v: tele.stats.scheduled, c: 'text-blue-700' },
          { l: 'Waiting', v: tele.stats.waiting, c: 'text-amber-700' },
          { l: 'In Progress', v: tele.stats.inProgress, c: 'text-purple-700' },
          { l: 'Completed', v: tele.stats.completed, c: 'text-emerald-700' },
          { l: 'No Show', v: tele.stats.noShow, c: tele.stats.noShow > 0 ? 'text-red-600' : 'text-gray-400' },
          { l: 'Avg Duration', v: tele.stats.avgDuration ? `${tele.stats.avgDuration}m` : '—', c: 'text-teal-700' },
        ].map(s => (
          <div key={s.l} className="bg-white rounded-xl border px-3 py-3 text-center"><div className="text-[9px] text-gray-400 uppercase font-semibold">{s.l}</div><div className={`text-lg font-black ${s.c}`}>{s.v}</div></div>
        ))}
      </div>

      {tab !== 'call' && (
        <div className="flex gap-1">{[{ key: 'today' as Tab, label: "Today's Schedule" }].map(t => <button key={t.key} onClick={() => setTab(t.key)} className={`px-3.5 py-2 text-xs font-medium rounded-xl ${tab === t.key ? 'bg-teal-600 text-white shadow-sm' : 'bg-white text-gray-500 border'}`}>{t.label}</button>)}</div>
      )}

      {/* TODAY'S SCHEDULE */}
      {tab === 'today' && (
        <div className="space-y-3">
          {tele.consults.map(c => {
            const time = new Date(c.scheduled_at).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });
            const isNow = ['waiting', 'in_progress'].includes(c.status);
            return (
              <div key={c.id} className={`bg-white rounded-xl border p-4 flex items-center gap-4 ${isNow ? 'border-teal-200 bg-teal-50/30' : ''}`}>
                <div className="text-center w-16 shrink-0">
                  <div className="text-lg font-bold text-gray-800">{time}</div>
                  <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold ${STATUS_B[c.status] || 'inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold bg-gray-100 text-gray-600'} text-[8px]`}>{c.status?.replace('_', ' ')}</span>
                </div>
                <div className="w-10 h-10 rounded-full bg-teal-100 flex items-center justify-center shrink-0">
                  <Video size={18} className="text-teal-700" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="font-semibold">{c.patient?.first_name} {c.patient?.last_name}</div>
                  <div className="text-[10px] text-gray-400">{c.patient?.uhid} · {c.patient?.age_years}/{c.patient?.gender?.charAt(0)} · {c.patient?.phone_primary}</div>
                  {c.chief_complaint && <div className="text-xs text-gray-500 mt-0.5">{c.chief_complaint}</div>}
                </div>
                <div className="text-right shrink-0">
                  <div className="text-xs text-gray-500">Dr. {c.doctor?.full_name?.split(' ').pop()}</div>
                  <div className="text-[10px] text-gray-400">{c.doctor?.specialisation}</div>
                </div>
                <div className="flex gap-2 shrink-0">
                  {c.status === 'scheduled' && <button onClick={() => tele.updateConsult(c.id, { status: 'waiting' })} className="px-3 py-2 bg-amber-50 text-amber-700 text-xs rounded-xl font-medium hover:bg-amber-100">Patient Waiting</button>}
                  {['scheduled', 'waiting'].includes(c.status) && (
                    <button disabled className="px-4 py-2 bg-teal-600 text-white text-xs rounded-xl font-semibold opacity-50 cursor-not-allowed flex items-center gap-1.5"><Video size={13} /> Join Call <span className="ml-1 px-1.5 py-0.5 text-[9px] bg-amber-100 text-amber-700 rounded-full">Coming soon</span></button>
                  )}
                  {c.status === 'in_progress' && (
                    <button disabled className="px-4 py-2 bg-purple-600 text-white text-xs rounded-xl font-semibold opacity-50 cursor-not-allowed flex items-center gap-1.5"><Video size={13} /> Rejoin <span className="ml-1 px-1.5 py-0.5 text-[9px] bg-amber-100 text-amber-700 rounded-full">Coming soon</span></button>
                  )}
                  {c.room_url && <a href={c.room_url} target="_blank" rel="noopener noreferrer" className="p-2 bg-gray-100 rounded-xl hover:bg-gray-200"><ExternalLink size={14} className="text-gray-500" /></a>}
                </div>
              </div>
            );
          })}
          {tele.consults.length === 0 && (
            <div className="text-center py-16 bg-white rounded-2xl border">
              <Video size={32} className="mx-auto text-gray-300 mb-3" />
              <h3 className="text-sm font-medium text-gray-900">No teleconsultation sessions yet</h3>
              <p className="text-xs text-gray-400 mt-1 max-w-sm mx-auto">Schedule a teleconsult to begin virtual patient care. Video integration requires configuration in Settings.</p>
              <button onClick={() => setShowSchedule(true)} className="mt-4 inline-flex items-center gap-2 px-4 py-2 bg-teal-600 text-white text-sm rounded-xl font-semibold hover:bg-teal-700 cursor-pointer"><Plus size={14} /> Schedule Teleconsult</button>
            </div>
          )}
        </div>
      )}

      {/* VIDEO CALL */}
      {tab === 'call' && activeCall && (
        <div className="space-y-3">
          <div className="bg-gray-900 rounded-2xl overflow-hidden" style={{ height: '60vh' }}>
            <iframe src={activeCall.room_url} allow="camera; microphone; fullscreen; display-capture" className="w-full h-full border-0" />
          </div>
          <div className="bg-white rounded-2xl border p-4 flex items-center gap-4">
            <div className="flex-1">
              <div className="font-bold">{activeCall.patient?.first_name} {activeCall.patient?.last_name}</div>
              <div className="text-xs text-gray-400">{activeCall.patient?.uhid} · {activeCall.chief_complaint || 'Teleconsult'}</div>
            </div>
            <textarea value={postNotes} onChange={e => setPostNotes(e.target.value)} className="flex-1 px-3 py-2 border rounded-xl text-sm h-10 resize-none" placeholder="Consultation notes..." />
            <button onClick={endCall} className="px-6 py-2.5 bg-red-600 text-white text-sm rounded-xl font-semibold hover:bg-red-700">End Call</button>
          </div>
        </div>
      )}

      {/* SCHEDULE MODAL */}
      {showSchedule && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4" onClick={() => setShowSchedule(false)}>
          <div className="bg-white rounded-2xl w-full max-w-lg p-6 space-y-4" onClick={e => e.stopPropagation()}>
            <div className="flex justify-between"><h2 className="text-lg font-bold">Schedule Teleconsult</h2><button onClick={() => setShowSchedule(false)}><X size={18} className="text-gray-400" /></button></div>
            {selPat ? (
              <div className="flex items-center gap-3 bg-teal-50 rounded-xl p-3 border border-teal-200">
                <div className="font-bold">{selPat.first_name} {selPat.last_name}</div><div className="text-xs text-gray-500">{selPat.uhid}</div>
                <button onClick={() => setSelPat(null)} className="ml-auto text-xs text-red-500">Change</button>
              </div>
            ) : (
              <div className="relative"><input value={patSearch} onChange={e => setPatSearch(e.target.value)} className="w-full px-3 py-2.5 border rounded-xl text-sm" placeholder="Search patient..." />
                {patResults.length > 0 && <div className="absolute z-10 mt-1 w-full bg-white border rounded-xl shadow-xl max-h-40 overflow-y-auto">{patResults.map(p => <button key={p.id} onClick={() => { setSelPat(p); setPatSearch(''); setPatResults([]); }} className="w-full text-left px-3 py-2.5 hover:bg-teal-50 border-b text-xs">{p.first_name} {p.last_name} · {p.uhid}</button>)}</div>}
              </div>
            )}
            <div className="grid grid-cols-2 gap-3">
              <div><label className="text-[10px] text-gray-500 uppercase font-semibold">Doctor *</label><select className="w-full mt-1 px-3 py-2 border rounded-xl text-sm" value={schedForm.doctor_id} onChange={e => setSchedForm(f => ({ ...f, doctor_id: e.target.value }))}><option value="">Select</option>{doctors.map(d => <option key={d.id} value={d.id}>{d.full_name} — {d.specialisation || ''}</option>)}</select></div>
              <div><label className="text-[10px] text-gray-500 uppercase font-semibold">Date & Time *</label><input type="datetime-local" className="w-full mt-1 px-3 py-2 border rounded-xl text-sm" value={schedForm.scheduled_at} onChange={e => setSchedForm(f => ({ ...f, scheduled_at: e.target.value }))} /></div>
              <div className="col-span-2"><label className="text-[10px] text-gray-500 uppercase font-semibold">Chief Complaint</label><input className="w-full mt-1 px-3 py-2 border rounded-xl text-sm" value={schedForm.chief_complaint} onChange={e => setSchedForm(f => ({ ...f, chief_complaint: e.target.value }))} /></div>
              <div><label className="text-[10px] text-gray-500 uppercase font-semibold">Fee ₹</label><input type="number" className="w-full mt-1 px-3 py-2 border rounded-xl text-sm" value={schedForm.consultation_fee} onChange={e => setSchedForm(f => ({ ...f, consultation_fee: e.target.value }))} /></div>
            </div>
            <button onClick={handleSchedule} disabled={!selPat || !schedForm.doctor_id || !schedForm.scheduled_at} className="w-full py-2.5 bg-teal-600 text-white text-sm rounded-xl font-semibold disabled:opacity-40">Schedule & Generate Link</button>
          </div>
        </div>
      )}
    </div>
  );
}
export default function TelemedicinePage() { return <RoleGuard module="opd"><TeleInner /></RoleGuard>; }
