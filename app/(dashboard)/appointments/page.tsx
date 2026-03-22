'use client';
import React, { useState, useEffect, useMemo } from 'react';
import { RoleGuard } from '@/components/ui/shared';
import { useAuthStore } from '@/lib/store/auth';
import { useAppointments, useDoctorSchedules, type Appointment, type TimeSlot } from '@/lib/appointments/appointment-hooks';
import { createClient } from '@/lib/supabase/client';
import Link from 'next/link';

let _sb: any = null;
function sb() { if (typeof window === 'undefined') return null as any; if (!_sb) { try { _sb = createClient(); } catch { return null; } } return _sb; }

type Tab = 'today' | 'book' | 'calendar' | 'schedules';

const STATUS_COLORS: Record<string, string> = {
  booked: 'bg-blue-100 text-teal-700', confirmed: 'bg-blue-100 text-teal-700',
  checked_in: 'bg-amber-100 text-amber-700', in_consultation: 'bg-purple-100 text-purple-700',
  completed: 'bg-green-100 text-green-700', cancelled: 'bg-red-100 text-red-700',
  no_show: 'bg-gray-100 text-gray-700', rescheduled: 'bg-orange-100 text-orange-700',
};
const TYPE_LABELS: Record<string, string> = { new: 'New', follow_up: 'F/U', review: 'Review', procedure: 'Proc', teleconsult: 'Tele' };
const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const fmtTime = (t: string) => { const [h, m] = t.split(':'); const hr = parseInt(h); return `${hr > 12 ? hr - 12 : hr || 12}:${m} ${hr >= 12 ? 'PM' : 'AM'}`; };

function AppointmentsInner() {
  const { staff, activeCentreId } = useAuthStore();
  const centreId = activeCentreId || '';
  const staffId = staff?.id || '';
  const appts = useAppointments(centreId);
  const scheds = useDoctorSchedules(centreId);

  const [tab, setTab] = useState<Tab>('today');
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [doctorFilter, setDoctorFilter] = useState('all');
  const [toast, setToast] = useState('');
  const flash = (m: string) => { setToast(m); setTimeout(() => setToast(''), 2500); };

  // Booking form
  const [bookDoctor, setBookDoctor] = useState('');
  const [bookDate, setBookDate] = useState(new Date().toISOString().split('T')[0]);
  const [slots, setSlots] = useState<TimeSlot[]>([]);
  const [selectedSlot, setSelectedSlot] = useState('');
  const [patientSearch, setPatientSearch] = useState('');
  const [patientResults, setPatientResults] = useState<any[]>([]);
  const [selectedPatient, setSelectedPatient] = useState<any>(null);
  const [bookType, setBookType] = useState('new');
  const [bookReason, setBookReason] = useState('');
  const [booking, setBooking] = useState(false);

  // Cancel/reschedule
  const [actionAppt, setActionAppt] = useState<Appointment | null>(null);
  const [cancelReason, setCancelReason] = useState('');
  const [reschedDate, setReschedDate] = useState('');
  const [reschedTime, setReschedTime] = useState('');

  // Schedule form
  const [schedForm, setSchedForm] = useState({ doctorId: '', day: 1, start: '09:00', end: '13:00', duration: 15, max: 20, room: '', fee: 0 });
  const [doctors, setDoctors] = useState<any[]>([]);

  useEffect(() => {
    if (!sb() || !centreId) return;
    sb().from('hmis_staff').select('id, full_name, specialisation').eq('staff_type', 'doctor').eq('is_active', true).order('full_name')
      .then(({ data }: any) => setDoctors(data || []));
  }, [centreId]);

  // Load on date/filter change
  useEffect(() => { appts.load({ date, doctorId: doctorFilter === 'all' ? undefined : doctorFilter }); }, [date, doctorFilter]);

  // Patient search
  useEffect(() => {
    if (patientSearch.length < 2 || !sb()) { setPatientResults([]); return; }
    const t = setTimeout(async () => {
      const { data } = await sb().from('hmis_patients')
        .select('id, uhid, first_name, last_name, phone_primary, age_years, gender')
        .or(`uhid.ilike.%${patientSearch}%,first_name.ilike.%${patientSearch}%,last_name.ilike.%${patientSearch}%,phone_primary.ilike.%${patientSearch}%`)
        .limit(5);
      setPatientResults(data || []);
    }, 300);
    return () => clearTimeout(t);
  }, [patientSearch]);

  // Load slots when doctor + date selected
  useEffect(() => {
    if (bookDoctor && bookDate) {
      appts.getAvailableSlots(bookDoctor, bookDate).then(setSlots);
    }
  }, [bookDoctor, bookDate]);

  const handleBook = async () => {
    if (!selectedPatient || !bookDoctor || !selectedSlot) return;
    setBooking(true);
    const result = await appts.bookAppointment({
      patientId: selectedPatient.id, doctorId: bookDoctor, date: bookDate, time: selectedSlot,
      type: bookType, visitReason: bookReason, staffId,
    });
    setBooking(false);
    if (result.success) {
      flash(`Appointment booked — Token #${result.appointment?.token_number}`);
      setSelectedPatient(null); setPatientSearch(''); setSelectedSlot(''); setBookReason('');
      setTab('today'); setDate(bookDate);
    }
  };

  const handleCancel = async () => {
    if (!actionAppt || !cancelReason) return;
    await appts.cancel(actionAppt.id, cancelReason, staffId);
    flash('Appointment cancelled'); setActionAppt(null); setCancelReason('');
  };

  const handleReschedule = async () => {
    if (!actionAppt || !reschedDate || !reschedTime) return;
    await appts.reschedule(actionAppt.id, reschedDate, reschedTime, staffId);
    flash('Appointment rescheduled'); setActionAppt(null);
  };

  const addSchedule = async () => {
    if (!schedForm.doctorId) return;
    const result = await scheds.addSchedule({
      doctorId: schedForm.doctorId, dayOfWeek: schedForm.day,
      startTime: schedForm.start + ':00', endTime: schedForm.end + ':00',
      slotDuration: schedForm.duration, maxPatients: schedForm.max,
      room: schedForm.room, fee: schedForm.fee,
    });
    if (result.success) flash('Schedule added');
  };

  const filtered = doctorFilter === 'all' ? appts.appointments : appts.appointments.filter(a => a.doctorId === doctorFilter);

  return (
    <div className="max-w-7xl mx-auto space-y-4">
      {toast && <div className="fixed top-4 left-1/2 -translate-x-1/2 z-50 bg-emerald-600 text-white px-4 py-2 rounded-xl shadow-lg text-sm">{toast}</div>}

      <div className="flex items-center justify-between">
        <div><h1 className="text-xl font-bold">Appointments</h1><p className="text-xs text-gray-500">Scheduling, booking, check-in, queue management</p></div>
        <div className="flex gap-2">
          <input type="date" value={date} onChange={e => setDate(e.target.value)} className="px-3 py-1.5 border rounded-lg text-xs" />
          <select value={doctorFilter} onChange={e => setDoctorFilter(e.target.value)} className="px-3 py-1.5 border rounded-lg text-xs">
            <option value="all">All Doctors</option>
            {doctors.map((d: any) => <option key={d.id} value={d.id}>Dr. {d.full_name}</option>)}
          </select>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b">{(['today', 'book', 'calendar', 'schedules'] as Tab[]).map(t =>
        <button key={t} onClick={() => setTab(t)} className={`px-4 py-2 text-xs font-medium rounded-xl capitalize ${tab === t ? 'bg-teal-600 text-white shadow-sm' : 'bg-white text-gray-500 border border-gray-100 hover:bg-gray-50'}`}>
          {t === 'today' ? "Today's Queue" : t === 'book' ? 'Book New' : t === 'calendar' ? 'Calendar View' : 'Doctor Schedules'}
        </button>
      )}</div>

      {/* KPIs */}
      {tab === 'today' && <div className="grid grid-cols-7 gap-2">
        <div className="bg-white rounded-xl border p-2 text-center"><div className="text-[9px] text-gray-500">Total</div><div className="text-xl font-bold">{appts.stats.total}</div></div>
        <div className="bg-blue-50 rounded-xl border p-2 text-center"><div className="text-[9px] text-gray-500">Booked</div><div className="text-xl font-bold text-teal-700">{appts.stats.booked}</div></div>
        <div className="bg-amber-50 rounded-xl border p-2 text-center"><div className="text-[9px] text-gray-500">Checked In</div><div className="text-xl font-bold text-amber-700">{appts.stats.checkedIn}</div></div>
        <div className="bg-purple-50 rounded-xl border p-2 text-center"><div className="text-[9px] text-gray-500">In Consult</div><div className="text-xl font-bold text-purple-700">{appts.stats.inConsult}</div></div>
        <div className="bg-green-50 rounded-xl border p-2 text-center"><div className="text-[9px] text-gray-500">Completed</div><div className="text-xl font-bold text-green-700">{appts.stats.completed}</div></div>
        <div className="bg-red-50 rounded-xl border p-2 text-center"><div className="text-[9px] text-gray-500">Cancelled</div><div className="text-xl font-bold text-red-700">{appts.stats.cancelled}</div></div>
        <div className="bg-gray-50 rounded-xl border p-2 text-center"><div className="text-[9px] text-gray-500">No Show</div><div className="text-xl font-bold text-gray-500">{appts.stats.noShow}</div></div>
      </div>}

      {/* TODAY'S QUEUE */}
      {tab === 'today' && (appts.loading ? <div className="animate-pulse h-48 bg-gray-200 rounded-xl" /> :
        filtered.length === 0 ? <div className="text-center py-12 bg-white rounded-xl border text-gray-400 text-sm">No appointments for {date}</div> :
        <div className="bg-white rounded-xl border overflow-hidden">
          <table className="w-full text-xs"><thead><tr className="bg-gray-50 border-b">
            <th className="p-2 text-center w-12">Token</th><th className="p-2 text-left">Patient</th><th className="p-2">Time</th>
            <th className="p-2">Doctor</th><th className="p-2">Type</th><th className="p-2">Status</th><th className="p-2 text-center">Actions</th>
          </tr></thead><tbody>{filtered.map(a => (
            <tr key={a.id} className={`border-b hover:bg-gray-50 ${a.priority === 'urgent' ? 'bg-red-50/30' : a.priority === 'vip' ? 'bg-purple-50/30' : ''}`}>
              <td className="p-2 text-center"><span className="bg-blue-100 text-blue-800 px-2 py-1 rounded-full text-xs font-bold">T-{String(a.token).padStart(3, '0')}</span></td>
              <td className="p-2"><Link href={`/emr-v2?patient=${a.patientId}`} className="font-medium text-teal-700 hover:underline">{a.patientName}</Link>
                <div className="text-[10px] text-gray-400">{a.uhid} | {a.phone}</div></td>
              <td className="p-2 text-center font-mono">{fmtTime(a.time)}</td>
              <td className="p-2">Dr. {a.doctorName}<div className="text-[10px] text-gray-400">{a.specialisation}</div></td>
              <td className="p-2 text-center"><span className="text-[9px] bg-gray-100 px-1 py-0.5 rounded">{TYPE_LABELS[a.type] || a.type}</span></td>
              <td className="p-2 text-center"><span className={`px-1.5 py-0.5 rounded text-[9px] ${STATUS_COLORS[a.status] || 'bg-gray-100'}`}>{a.status.replace('_', ' ')}</span></td>
              <td className="p-2 text-center space-x-1">
                {a.status === 'booked' && <button onClick={() => appts.checkIn(a.id)} className="px-1.5 py-0.5 bg-amber-100 text-amber-700 rounded text-[9px]">Check In</button>}
                {a.status === 'checked_in' && <button onClick={() => appts.startConsultation(a.id)} className="px-1.5 py-0.5 bg-purple-100 text-purple-700 rounded text-[9px]">Start</button>}
                {a.status === 'in_consultation' && <button onClick={() => appts.complete(a.id)} className="px-1.5 py-0.5 bg-green-100 text-green-700 rounded text-[9px]">Complete</button>}
                {['booked', 'confirmed'].includes(a.status) && <>
                  <button onClick={() => setActionAppt(a)} className="px-1.5 py-0.5 bg-gray-100 text-gray-600 rounded text-[9px]">More</button>
                </>}
                {a.status === 'booked' && <button onClick={() => appts.markNoShow(a.id)} className="px-1.5 py-0.5 text-gray-400 rounded text-[9px]">No Show</button>}
              </td>
            </tr>
          ))}</tbody></table>
        </div>
      )}

      {/* BOOK NEW */}
      {tab === 'book' && <div className="bg-white rounded-xl border p-5 space-y-4">
        <h2 className="font-bold text-sm">Book Appointment</h2>
        <div className="grid grid-cols-3 gap-4">
          {/* Patient */}
          <div className="relative">
            <label className="text-xs text-gray-500">Patient *</label>
            {selectedPatient ? <div className="bg-blue-50 rounded-lg px-3 py-2 text-sm flex justify-between"><div>{selectedPatient.first_name} {selectedPatient.last_name} <span className="text-gray-400 text-[10px]">{selectedPatient.uhid}</span></div><button onClick={() => { setSelectedPatient(null); setPatientSearch(''); }} className="text-xs text-red-500">Change</button></div> :
            <><input type="text" value={patientSearch} onChange={e => setPatientSearch(e.target.value)} className="w-full px-3 py-2 border rounded-lg text-sm" placeholder="UHID, name, or phone..." />
            {patientResults.length > 0 && <div className="absolute top-full left-0 right-0 mt-1 bg-white border rounded-lg shadow-lg z-10">{patientResults.map((p: any) => (
              <button key={p.id} onClick={() => { setSelectedPatient(p); setPatientSearch(''); setPatientResults([]); }}
                className="w-full text-left px-3 py-2 text-xs hover:bg-blue-50 border-b">{p.first_name} {p.last_name} <span className="text-gray-400">{p.uhid} | {p.phone_primary}</span></button>
            ))}</div>}</>}
          </div>
          {/* Doctor */}
          <div><label className="text-xs text-gray-500">Doctor *</label>
            <select value={bookDoctor} onChange={e => setBookDoctor(e.target.value)} className="w-full px-3 py-2 border rounded-lg text-sm">
              <option value="">Select doctor</option>{doctors.map((d: any) => <option key={d.id} value={d.id}>Dr. {d.full_name} ({d.specialisation})</option>)}
            </select></div>
          {/* Date */}
          <div><label className="text-xs text-gray-500">Date *</label>
            <input type="date" value={bookDate} onChange={e => setBookDate(e.target.value)} className="w-full px-3 py-2 border rounded-lg text-sm" min={new Date().toISOString().split('T')[0]} /></div>
        </div>
        {/* Time slots */}
        {bookDoctor && bookDate && (
          <div><label className="text-xs text-gray-500 mb-1 block">Available Slots ({slots.filter(s => s.available).length} of {slots.length})</label>
            {slots.length === 0 ? <div className="text-xs text-gray-400 bg-gray-50 rounded-lg p-4 text-center">No schedule for this doctor on {DAYS[new Date(bookDate).getDay()]}. Add schedule in Doctor Schedules tab.</div> :
            <div className="flex flex-wrap gap-1.5">{slots.map(s => (
              <button key={s.time} onClick={() => s.available && setSelectedSlot(s.time)} disabled={!s.available}
                className={`px-3 py-2 rounded-lg text-xs border ${selectedSlot === s.time ? 'bg-teal-600 text-white border-teal-600' : s.available ? 'bg-white hover:bg-blue-50 border-gray-200' : 'bg-gray-100 text-gray-400 line-through'}`}>
                {fmtTime(s.time)}
              </button>
            ))}</div>}</div>
        )}
        <div className="grid grid-cols-3 gap-4">
          <div><label className="text-xs text-gray-500">Visit Type</label>
            <select value={bookType} onChange={e => setBookType(e.target.value)} className="w-full px-3 py-2 border rounded-lg text-sm">
              <option value="new">New Visit</option><option value="follow_up">Follow-up</option><option value="review">Review</option><option value="procedure">Procedure</option><option value="teleconsult">Teleconsult</option>
            </select></div>
          <div className="col-span-2"><label className="text-xs text-gray-500">Visit Reason</label>
            <input type="text" value={bookReason} onChange={e => setBookReason(e.target.value)} className="w-full px-3 py-2 border rounded-lg text-sm" placeholder="Chief complaint or reason" /></div>
        </div>
        <button onClick={handleBook} disabled={booking || !selectedPatient || !bookDoctor || !selectedSlot}
          className="px-6 py-2.5 bg-teal-600 text-white text-sm rounded-lg font-medium disabled:opacity-40">{booking ? 'Booking...' : 'Book Appointment'}</button>
      </div>}

      {/* CALENDAR VIEW */}
      {tab === 'calendar' && <div className="bg-white rounded-xl border p-4">
        <h2 className="font-bold text-sm mb-3">Week View — {new Date(date).toLocaleDateString('en-IN', { month: 'long', year: 'numeric' })}</h2>
        <div className="grid grid-cols-7 gap-1">
          {Array.from({ length: 7 }, (_, i) => {
            const d = new Date(date); d.setDate(d.getDate() - d.getDay() + i);
            const ds = d.toISOString().split('T')[0];
            const dayAppts = appts.appointments.filter(a => a.date === ds);
            const isToday = ds === new Date().toISOString().split('T')[0];
            return (
              <button key={i} onClick={() => { setDate(ds); setTab('today'); }}
                className={`p-2 rounded-lg border text-left min-h-[80px] ${isToday ? 'border-blue-300 bg-blue-50' : 'hover:bg-gray-50'}`}>
                <div className="text-[10px] text-gray-500">{DAYS[i]}</div>
                <div className={`text-sm font-bold ${isToday ? 'text-teal-700' : ''}`}>{d.getDate()}</div>
                {dayAppts.length > 0 && <div className="text-[9px] text-teal-600 mt-1">{dayAppts.length} appts</div>}
              </button>
            );
          })}
        </div>
      </div>}

      {/* DOCTOR SCHEDULES */}
      {tab === 'schedules' && <div className="space-y-4">
        <div className="bg-white rounded-xl border p-5 space-y-3">
          <h3 className="font-bold text-sm">Add Doctor Schedule</h3>
          <div className="grid grid-cols-7 gap-2">
            <div><label className="text-[9px] text-gray-500">Doctor</label>
              <select value={schedForm.doctorId} onChange={e => setSchedForm(f => ({ ...f, doctorId: e.target.value }))} className="w-full px-2 py-1.5 border rounded text-xs">
                <option value="">Select</option>{doctors.map((d: any) => <option key={d.id} value={d.id}>Dr. {d.full_name}</option>)}
              </select></div>
            <div><label className="text-[9px] text-gray-500">Day</label>
              <select value={schedForm.day} onChange={e => setSchedForm(f => ({ ...f, day: parseInt(e.target.value) }))} className="w-full px-2 py-1.5 border rounded text-xs">
                {DAYS.map((d, i) => <option key={i} value={i}>{d}</option>)}
              </select></div>
            <div><label className="text-[9px] text-gray-500">Start</label>
              <input type="time" value={schedForm.start} onChange={e => setSchedForm(f => ({ ...f, start: e.target.value }))} className="w-full px-2 py-1.5 border rounded text-xs" /></div>
            <div><label className="text-[9px] text-gray-500">End</label>
              <input type="time" value={schedForm.end} onChange={e => setSchedForm(f => ({ ...f, end: e.target.value }))} className="w-full px-2 py-1.5 border rounded text-xs" /></div>
            <div><label className="text-[9px] text-gray-500">Slot (min)</label>
              <select value={schedForm.duration} onChange={e => setSchedForm(f => ({ ...f, duration: parseInt(e.target.value) }))} className="w-full px-2 py-1.5 border rounded text-xs">
                {[10, 15, 20, 30, 45, 60].map(d => <option key={d} value={d}>{d} min</option>)}
              </select></div>
            <div><label className="text-[9px] text-gray-500">Fee ₹</label>
              <input type="number" value={schedForm.fee} onChange={e => setSchedForm(f => ({ ...f, fee: parseInt(e.target.value) || 0 }))} className="w-full px-2 py-1.5 border rounded text-xs" /></div>
            <div className="flex items-end"><button onClick={addSchedule} disabled={!schedForm.doctorId} className="w-full py-1.5 bg-teal-600 text-white text-xs rounded disabled:opacity-40">Add</button></div>
          </div>
        </div>
        {scheds.loading ? <div className="animate-pulse h-24 bg-gray-200 rounded-xl" /> :
        <div className="bg-white rounded-xl border overflow-hidden">
          <table className="w-full text-xs"><thead><tr className="bg-gray-50 border-b">
            <th className="p-2 text-left">Doctor</th><th className="p-2">Day</th><th className="p-2">Time</th><th className="p-2">Slot</th><th className="p-2">Max Pts</th><th className="p-2">Room</th><th className="p-2 text-right">Fee</th>
          </tr></thead><tbody>{scheds.schedules.map(s => (
            <tr key={s.id} className="border-b"><td className="p-2 font-medium">Dr. {s.doctorName}<div className="text-[10px] text-gray-400">{s.specialisation}</div></td>
              <td className="p-2 text-center font-medium">{DAYS[s.dayOfWeek]}</td>
              <td className="p-2 text-center">{fmtTime(s.startTime)} – {fmtTime(s.endTime)}</td>
              <td className="p-2 text-center">{s.slotDuration}m</td><td className="p-2 text-center">{s.maxPatients}</td>
              <td className="p-2 text-center text-gray-400">{s.room || '—'}</td>
              <td className="p-2 text-right font-bold">₹{s.fee.toLocaleString('en-IN')}</td></tr>
          ))}</tbody></table>
        </div>}
      </div>}

      {/* Cancel/Reschedule modal */}
      {actionAppt && <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={() => setActionAppt(null)}>
        <div className="bg-white rounded-xl p-5 w-[400px] space-y-3" onClick={e => e.stopPropagation()}>
          <h3 className="font-bold text-sm">Manage: {actionAppt.patientName} — T-{String(actionAppt.token).padStart(3, '0')}</h3>
          <div className="text-xs text-gray-500">{fmtTime(actionAppt.time)} | Dr. {actionAppt.doctorName}</div>
          <div className="border-t pt-3 space-y-2">
            <h4 className="text-xs font-bold">Cancel</h4>
            <select value={cancelReason} onChange={e => setCancelReason(e.target.value)} className="w-full px-3 py-2 border rounded-lg text-xs">
              <option value="">Select reason</option>
              <option>Patient request</option><option>Doctor unavailable</option><option>Emergency</option><option>Duplicate booking</option><option>Wrong doctor</option>
            </select>
            <button onClick={handleCancel} disabled={!cancelReason} className="px-4 py-1.5 bg-red-600 text-white text-xs rounded-lg disabled:opacity-40">Cancel Appointment</button>
          </div>
          <div className="border-t pt-3 space-y-2">
            <h4 className="text-xs font-bold">Reschedule</h4>
            <div className="flex gap-2">
              <input type="date" value={reschedDate} onChange={e => setReschedDate(e.target.value)} className="flex-1 px-3 py-2 border rounded-lg text-xs" min={new Date().toISOString().split('T')[0]} />
              <input type="time" value={reschedTime} onChange={e => setReschedTime(e.target.value)} className="w-28 px-3 py-2 border rounded-lg text-xs" />
            </div>
            <button onClick={handleReschedule} disabled={!reschedDate || !reschedTime} className="px-4 py-1.5 bg-orange-600 text-white text-xs rounded-lg disabled:opacity-40">Reschedule</button>
          </div>
        </div>
      </div>}
    </div>
  );
}

export default function AppointmentsPage() { return <RoleGuard module="opd"><AppointmentsInner /></RoleGuard>; }
