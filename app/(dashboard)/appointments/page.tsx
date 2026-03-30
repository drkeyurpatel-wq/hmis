'use client';
import React, { useState, useEffect, useMemo } from 'react';
import { RoleGuard } from '@/components/ui/shared';
import { useAuthStore } from '@/lib/store/auth';
import { useAppointments, useDoctorSchedules, type Appointment, type TimeSlot } from '@/lib/appointments/appointment-hooks';
import { sb } from '@/lib/supabase/browser';
import Link from 'next/link';

type Tab = 'today' | 'book' | 'calendar' | 'schedules';

const STATUS_COLORS: Record<string, string> = {
  scheduled: 'bg-h1-teal-light text-h1-teal', booked: 'bg-h1-teal-light text-h1-teal', confirmed: 'bg-h1-teal-light text-h1-teal',
  checked_in: 'bg-h1-yellow-light text-h1-yellow', in_consultation: 'bg-h1-navy-light text-h1-navy', in_progress: 'bg-h1-navy-light text-h1-navy',
  completed: 'bg-green-100 text-green-700', cancelled: 'bg-red-100 text-red-700',
  no_show: 'bg-gray-100 text-gray-700', rescheduled: 'bg-orange-100 text-orange-700',
};
const PRIORITY_COLORS: Record<string, string> = { normal: '', urgent: 'bg-red-50/50 border-l-4 border-l-red-400', vip: 'bg-h1-navy-light/50 border-l-4 border-l-h1-navy/60' };
const TYPE_LABELS: Record<string, string> = { new: 'New', followup: 'F/U', review: 'Review', procedure: 'Proc', teleconsult: 'Tele', referral: 'Ref', emergency: 'EM' };
const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const fmtTime = (t: string) => { if (!t) return '—'; const [h, m] = t.split(':'); const hr = parseInt(h); return `${hr > 12 ? hr - 12 : hr || 12}:${m} ${hr >= 12 ? 'PM' : 'AM'}`; };

function AppointmentsInner() {
  const { staff, activeCentreId } = useAuthStore();
  const centreId = activeCentreId || '';
  const staffId = staff?.id || '';
  const appts = useAppointments(centreId);
  const scheds = useDoctorSchedules(centreId);

  const [tab, setTab] = useState<Tab>('today');
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [doctorFilter, setDoctorFilter] = useState('all');
  const [deptFilter, setDeptFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [toast, setToast] = useState('');
  const flash = (m: string) => { setToast(m); setTimeout(() => setToast(''), 3000); };

  // Master data
  const [doctors, setDoctors] = useState<any[]>([]);
  const [departments, setDepartments] = useState<any[]>([]);
  useEffect(() => {
    if (!sb() || !centreId) return;
    sb().from('hmis_staff').select('id, full_name, specialisation').eq('staff_type', 'doctor').eq('is_active', true).order('full_name').then(({ data }: any) => setDoctors(data || []));
    sb().from('hmis_departments').select('id, name, type').eq('centre_id', centreId).order('name').then(({ data }: any) => setDepartments(data || []));
  }, [centreId]);

  // Booking form
  // Booking form — single state object (was 14 individual useStates)
  const [bf, setBf] = useState({ dept: '', doctor: '', date: new Date().toISOString().split('T')[0], type: 'new', priority: 'normal', reason: '', source: 'counter', slot: '', isWalkIn: false });
  const [slots, setSlots] = useState<TimeSlot[]>([]);
  const [patientSearch, setPatientSearch] = useState('');
  const [patientResults, setPatientResults] = useState<any[]>([]);
  const [selectedPatient, setSelectedPatient] = useState<any>(null);
  const [booking, setBooking] = useState(false);
  // Aliases for backward compat (avoid rewriting all JSX refs)
  const bookDept = bf.dept, bookDoctor = bf.doctor, bookDate = bf.date, bookType = bf.type, bookPriority = bf.priority, bookReason = bf.reason, bookSource = bf.source, selectedSlot = bf.slot, isWalkIn = bf.isWalkIn;
  const setBookDept = (v: string) => setBf(p => ({ ...p, dept: v }));
  const setBookDoctor = (v: string) => setBf(p => ({ ...p, doctor: v }));
  const setBookDate = (v: string) => setBf(p => ({ ...p, date: v }));
  const setBookType = (v: string) => setBf(p => ({ ...p, type: v }));
  const setBookPriority = (v: string) => setBf(p => ({ ...p, priority: v }));
  const setBookReason = (v: string) => setBf(p => ({ ...p, reason: v }));
  const setBookSource = (v: string) => setBf(p => ({ ...p, source: v }));
  const setSelectedSlot = (v: string) => setBf(p => ({ ...p, slot: v }));
  const setIsWalkIn = (v: boolean) => setBf(p => ({ ...p, isWalkIn: v }));

  // Cancel/reschedule modal
  const [actionAppt, setActionAppt] = useState<Appointment | null>(null);
  const [cancelReason, setCancelReason] = useState('');
  const [reschedDate, setReschedDate] = useState('');
  const [reschedTime, setReschedTime] = useState('');

  // Schedule form
  const [sf, setSf] = useState({ doctorId: '', deptId: '', day: 1, start: '09:00', end: '13:00', duration: 15, max: 20, room: '', fee: 500 });
  // Leave form
  const [leaveDoc, setLeaveDoc] = useState('');
  const [leaveDate, setLeaveDate] = useState('');
  const [leaveReason, setLeaveReason] = useState('');

  // Filter doctors by department
  const filteredDoctors = useMemo(() => {
    if (!bookDept) return doctors;
    const deptScheds = scheds.schedules.filter(s => s.departmentId === bookDept);
    const deptDocIds = new Set(deptScheds.map(s => s.doctorId));
    return doctors.filter(d => deptDocIds.has(d.id));
  }, [doctors, bookDept, scheds.schedules]);

  // Load on filters
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { appts.load({ date, doctorId: doctorFilter === 'all' ? undefined : doctorFilter, deptId: deptFilter === 'all' ? undefined : deptFilter }); }, [date, doctorFilter, deptFilter]);

  // Patient search
  useEffect(() => {
    if (patientSearch.length < 2 || !sb()) { setPatientResults([]); return; }
    const t = setTimeout(async () => {
      const { data } = await sb().from('hmis_patients')
        .select('id, uhid, first_name, last_name, phone_primary, age_years, gender')
        .or(`uhid.ilike.%${patientSearch}%,first_name.ilike.%${patientSearch}%,last_name.ilike.%${patientSearch}%,phone_primary.ilike.%${patientSearch}%`)
        .limit(8);
      setPatientResults(data || []);
    }, 300);
    return () => clearTimeout(t);
  }, [patientSearch]);

  // Slots
  useEffect(() => {
    if (bookDoctor && bookDate && !isWalkIn) appts.getAvailableSlots(bookDoctor, bookDate).then(setSlots);
    else setSlots([]);
  }, [bookDoctor, bookDate, isWalkIn]);

  const handleBook = async () => {
    if (!selectedPatient || !bookDoctor || !bookDept) { flash('Select patient, department, and doctor'); return; }
    if (!isWalkIn && !selectedSlot) { flash('Select a time slot'); return; }
    setBooking(true);
    const time = isWalkIn ? new Date().toTimeString().slice(0, 8) : selectedSlot;
    const result = await appts.bookAppointment({
      patientId: selectedPatient.id, doctorId: bookDoctor, departmentId: bookDept,
      date: bookDate, time, type: bookType, visitReason: bookReason,
      priority: bookPriority, source: bookSource, staffId,
    });
    setBooking(false);
    if (result.success) {
      flash(`Booked — Token #${result.appointment?.token_number}`);
      setSelectedPatient(null); setPatientSearch(''); setSelectedSlot(''); setBookReason('');
      setTab('today'); setDate(bookDate);
    } else flash('Error: ' + (result.error || 'Unknown'));
  };

  const filtered = appts.appointments.filter(a => {
    if (doctorFilter !== 'all' && a.doctorId !== doctorFilter) return false;
    if (deptFilter !== 'all' && a.departmentId !== deptFilter) return false;
    if (statusFilter !== 'all' && a.status !== statusFilter) return false;
    return true;
  });

  return (
    <div className="max-w-7xl mx-auto space-y-4">
      {toast && <div className="fixed top-4 left-1/2 -translate-x-1/2 z-50 bg-h1-success text-white px-4 py-2 rounded-xl shadow-lg text-sm font-medium">{toast}</div>}

      {/* Header */}
      <div className="flex items-center justify-between">
        <div><h1 className="text-xl font-bold">Appointments</h1>
          <p className="text-xs text-gray-500">Scheduling, check-in, queue, doctor schedules</p></div>
        <div className="flex gap-2 flex-wrap">
          <input type="date" value={date} onChange={e => setDate(e.target.value)} className="px-3 py-1.5 border rounded-lg text-xs" />
          <select value={deptFilter} onChange={e => setDeptFilter(e.target.value)} className="px-3 py-1.5 border rounded-lg text-xs">
            <option value="all">All Departments</option>
            {departments.filter(d => d.type === 'clinical').map((d: any) => <option key={d.id} value={d.id}>{d.name}</option>)}
          </select>
          <select value={doctorFilter} onChange={e => setDoctorFilter(e.target.value)} className="px-3 py-1.5 border rounded-lg text-xs">
            <option value="all">All Doctors</option>
            {doctors.map((d: any) => <option key={d.id} value={d.id}>{d.full_name}</option>)}
          </select>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1">
        {(['today', 'book', 'calendar', 'schedules'] as Tab[]).map(t =>
          <button key={t} onClick={() => setTab(t)} className={`px-4 py-2 text-xs font-medium rounded-lg transition-colors ${tab === t ? 'bg-h1-navy text-white' : 'bg-white border hover:bg-gray-50'}`}>
            {t === 'today' ? `Today's Queue (${appts.appointments.length})` : t === 'book' ? 'Book New' : t === 'calendar' ? 'Calendar' : 'Schedules & Leaves'}
          </button>
        )}
      </div>

      {/* KPI Strip */}
      {tab === 'today' && <div className="grid grid-cols-8 gap-2">
        {[
          { label: 'Total', val: appts.stats.total, bg: 'bg-white' },
          { label: 'Waiting', val: appts.stats.booked, bg: 'bg-h1-teal-light' },
          { label: 'Checked In', val: appts.stats.checkedIn, bg: appts.stats.checkedIn > 0 ? 'bg-h1-yellow-light' : 'bg-white' },
          { label: 'In Consult', val: appts.stats.inConsult, bg: 'bg-h1-navy-light' },
          { label: 'Completed', val: appts.stats.completed, bg: 'bg-green-50' },
          { label: 'Cancelled', val: appts.stats.cancelled, bg: 'bg-red-50' },
          { label: 'No Show', val: appts.stats.noShow, bg: 'bg-gray-50' },
          { label: 'Avg Wait', val: appts.stats.avgWait + 'm', bg: appts.stats.avgWait > 30 ? 'bg-red-50' : 'bg-white' },
        ].map(k => (
          <div key={k.label} className={`${k.bg} rounded-xl border p-2 text-center`}>
            <div className="text-[9px] text-gray-500">{k.label}</div><div className="text-lg font-bold">{k.val}</div>
          </div>
        ))}
      </div>}

      {/* ═══ TODAY'S QUEUE ═══ */}
      {tab === 'today' && (<>
        <div className="flex gap-1 mb-2">
          {['all','scheduled','checked_in','in_consultation','completed','cancelled','no_show'].map(s =>
            <button key={s} onClick={() => setStatusFilter(s)} className={`px-2 py-1 text-[10px] rounded-lg ${statusFilter === s ? 'bg-h1-teal-light text-h1-navy font-bold' : 'bg-white border text-gray-500'}`}>
              {s === 'all' ? 'All' : s.replace('_', ' ')}
            </button>
          )}
        </div>
        {appts.loading ? <div className="animate-pulse h-48 bg-gray-200 rounded-xl" /> :
        filtered.length === 0 ? <div className="text-center py-12 bg-white rounded-xl border text-gray-400 text-sm">No appointments for {date}</div> :
        <div className="bg-white rounded-xl border overflow-hidden">
          <table className="w-full text-xs"><thead><tr className="bg-gray-50 border-b">
            <th className="p-2 w-14 text-center">Token</th><th className="p-2 text-left">Patient</th>
            <th className="p-2">Time</th><th className="p-2">Doctor / Dept</th>
            <th className="p-2">Type</th><th className="p-2">Wait</th>
            <th className="p-2">Status</th><th className="p-2 text-center">Actions</th>
          </tr></thead><tbody>{filtered.map(a => (
            <tr key={a.id} className={`border-b hover:bg-gray-50 transition-colors ${PRIORITY_COLORS[a.priority] || ''}`}>
              <td className="p-2 text-center"><span className="bg-h1-teal-light text-h1-teal px-2 py-1 rounded-full text-xs font-bold">{a.token || '—'}</span></td>
              <td className="p-2">
                <Link href={`/emr-v2?patient=${a.patientId}`} className="font-medium text-h1-navy hover:underline">{a.patientName}</Link>
                <div className="text-[10px] text-gray-400">{a.uhid} · {a.age}y {a.gender?.charAt(0).toUpperCase()} · {a.phone}</div>
              </td>
              <td className="p-2 text-center font-mono">{fmtTime(a.time)}</td>
              <td className="p-2">{a.doctorName}<div className="text-[10px] text-gray-400">{a.departmentName}</div></td>
              <td className="p-2 text-center"><span className="text-[9px] bg-gray-100 px-1.5 py-0.5 rounded">{TYPE_LABELS[a.type] || a.type}</span>
                {a.priority !== 'normal' && <span className={`ml-1 text-[8px] px-1 py-0.5 rounded ${a.priority === 'urgent' ? 'bg-red-100 text-red-700' : 'bg-h1-navy-light text-h1-navy'}`}>{a.priority.toUpperCase()}</span>}
              </td>
              <td className="p-2 text-center">
                {a.waitMinutes !== null && a.status !== 'completed' && a.status !== 'cancelled'
                  ? <span className={`text-[10px] font-medium ${a.waitMinutes > 30 ? 'text-red-600' : a.waitMinutes > 15 ? 'text-h1-yellow' : 'text-green-600'}`}>{a.waitMinutes}m</span>
                  : <span className="text-[10px] text-gray-300">—</span>}
              </td>
              <td className="p-2 text-center"><span className={`px-1.5 py-0.5 rounded text-[9px] font-medium ${STATUS_COLORS[a.status] || 'bg-gray-100'}`}>{a.status.replace(/_/g, ' ')}</span></td>
              <td className="p-2 text-center">
                <div className="flex gap-0.5 justify-center flex-wrap">
                  {a.status === 'scheduled' && <button onClick={() => appts.checkIn(a.id)} className="px-2 py-1 bg-h1-yellow-light text-h1-yellow rounded text-[9px] font-medium hover:bg-h1-yellow/30">Check In</button>}
                  {a.status === 'checked_in' && <button onClick={() => appts.startConsultation(a.id)} className="px-2 py-1 bg-h1-navy-light text-h1-navy rounded text-[9px] font-medium hover:bg-h1-navy-light">Start</button>}
                  {a.status === 'in_consultation' && <button onClick={() => appts.complete(a.id)} className="px-2 py-1 bg-green-100 text-green-700 rounded text-[9px] font-medium hover:bg-green-200">Done</button>}
                  {['scheduled','checked_in'].includes(a.status) && <button onClick={() => { setActionAppt(a); setCancelReason(''); setReschedDate(''); setReschedTime(''); }} className="px-2 py-1 bg-gray-100 rounded text-[9px] hover:bg-gray-200">⋯</button>}
                  {a.status === 'scheduled' && <button onClick={() => appts.markNoShow(a.id)} className="px-1.5 py-1 text-gray-400 rounded text-[9px] hover:text-red-500">NS</button>}
                </div>
              </td>
            </tr>
          ))}</tbody></table>
        </div>}
      </>)}

      {/* ═══ BOOK NEW ═══ */}
      {tab === 'book' && <div className="bg-white rounded-xl border p-5 space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="font-bold text-sm">Book Appointment</h2>
          <label className="flex items-center gap-2 text-xs cursor-pointer">
            <input type="checkbox" checked={isWalkIn} onChange={e => setIsWalkIn(e.target.checked)} className="rounded" />
            Walk-in (no slot needed)
          </label>
        </div>

        <div className="grid grid-cols-4 gap-4">
          {/* Patient */}
          <div className="relative">
            <label className="text-xs text-gray-500">Patient *</label>
            {selectedPatient ? (
              <div className="bg-h1-teal-light rounded-lg px-3 py-2 text-sm flex justify-between items-center">
                <div>{selectedPatient.first_name} {selectedPatient.last_name} <span className="text-gray-400 text-[10px]">{selectedPatient.uhid}</span></div>
                <button onClick={() => { setSelectedPatient(null); setPatientSearch(''); }} className="text-xs text-red-500 hover:text-red-700">×</button>
              </div>
            ) : (
              <><input type="text" value={patientSearch} onChange={e => setPatientSearch(e.target.value)} className="w-full px-3 py-2 border rounded-lg text-sm" placeholder="UHID, name, or phone..." autoFocus />
              {patientResults.length > 0 && <div className="absolute top-full left-0 right-0 mt-1 bg-white border rounded-lg shadow-lg z-10 max-h-48 overflow-y-auto">{patientResults.map((p: any) => (
                <button key={p.id} onClick={() => { setSelectedPatient(p); setPatientSearch(''); setPatientResults([]); }}
                  className="w-full text-left px-3 py-2 text-xs hover:bg-h1-teal-light border-b">
                  <span className="font-medium">{p.first_name} {p.last_name}</span>
                  <span className="text-gray-400 ml-2">{p.uhid} · {p.age_years}y {p.gender?.charAt(0).toUpperCase()} · {p.phone_primary}</span>
                </button>
              ))}</div>}</>
            )}
          </div>
          {/* Department */}
          <div><label className="text-xs text-gray-500">Department *</label>
            <select value={bookDept} onChange={e => { setBookDept(e.target.value); setBookDoctor(''); }} className="w-full px-3 py-2 border rounded-lg text-sm">
              <option value="">Select department</option>
              {departments.filter(d => d.type === 'clinical').map((d: any) => <option key={d.id} value={d.id}>{d.name}</option>)}
            </select></div>
          {/* Doctor */}
          <div><label className="text-xs text-gray-500">Doctor *</label>
            <select value={bookDoctor} onChange={e => setBookDoctor(e.target.value)} className="w-full px-3 py-2 border rounded-lg text-sm">
              <option value="">Select doctor</option>
              {filteredDoctors.map((d: any) => <option key={d.id} value={d.id}>{d.full_name} ({d.specialisation})</option>)}
            </select></div>
          {/* Date */}
          <div><label className="text-xs text-gray-500">Date *</label>
            <input type="date" value={bookDate} onChange={e => setBookDate(e.target.value)} className="w-full px-3 py-2 border rounded-lg text-sm" min={new Date().toISOString().split('T')[0]} /></div>
        </div>

        {/* Slots */}
        {bookDoctor && bookDate && !isWalkIn && (
          <div><label className="text-xs text-gray-500 mb-1 block">Available Slots ({slots.filter(s => s.available).length}/{slots.length})</label>
            {slots.length === 0 ? (
              <div className="text-xs text-gray-400 bg-gray-50 rounded-lg p-4 text-center">No schedule for this doctor on {DAYS[new Date(bookDate + 'T00:00:00').getDay()]}. Check for leave or add a schedule.</div>
            ) : (
              <div className="flex flex-wrap gap-1.5">{slots.map(s => (
                <button key={s.time} onClick={() => s.available && setSelectedSlot(s.time)} disabled={!s.available}
                  className={`px-3 py-2 rounded-lg text-xs border transition-colors ${selectedSlot === s.time ? 'bg-h1-navy text-white border-h1-navy' : s.available ? 'bg-white hover:bg-h1-teal-light' : 'bg-gray-100 text-gray-400 line-through cursor-not-allowed'}`}>
                  {fmtTime(s.time)}
                </button>
              ))}</div>
            )}
          </div>
        )}

        <div className="grid grid-cols-4 gap-4">
          <div><label className="text-xs text-gray-500">Visit Type</label>
            <select value={bookType} onChange={e => setBookType(e.target.value)} className="w-full px-3 py-2 border rounded-lg text-sm">
              <option value="new">New Visit</option><option value="followup">Follow-up</option><option value="review">Review</option><option value="procedure">Procedure</option><option value="teleconsult">Teleconsult</option><option value="referral">Referral</option>
            </select></div>
          <div><label className="text-xs text-gray-500">Priority</label>
            <select value={bookPriority} onChange={e => setBookPriority(e.target.value)} className="w-full px-3 py-2 border rounded-lg text-sm">
              <option value="normal">Normal</option><option value="urgent">Urgent</option><option value="vip">VIP</option>
            </select></div>
          <div><label className="text-xs text-gray-500">Source</label>
            <select value={bookSource} onChange={e => setBookSource(e.target.value)} className="w-full px-3 py-2 border rounded-lg text-sm">
              <option value="counter">Counter</option><option value="phone">Phone</option><option value="online">Online</option><option value="referral">Referral</option><option value="camp">Health Camp</option>
            </select></div>
          <div><label className="text-xs text-gray-500">Reason / Complaint</label>
            <input type="text" value={bookReason} onChange={e => setBookReason(e.target.value)} className="w-full px-3 py-2 border rounded-lg text-sm" placeholder="e.g. Chest pain follow-up" /></div>
        </div>

        <button onClick={handleBook} disabled={booking || !selectedPatient || !bookDoctor || !bookDept || (!isWalkIn && !selectedSlot)}
          className="px-6 py-2.5 bg-h1-navy text-white text-sm rounded-lg font-medium hover:bg-h1-navy/90 disabled:opacity-40 transition-colors">
          {booking ? 'Booking...' : isWalkIn ? 'Register Walk-in' : 'Book Appointment'}
        </button>
      </div>}

      {/* ═══ CALENDAR ═══ */}
      {tab === 'calendar' && <div className="bg-white rounded-xl border p-4">
        <h2 className="font-bold text-sm mb-3">Week View — {new Date(date).toLocaleDateString('en-IN', { month: 'long', year: 'numeric' })}</h2>
        <div className="grid grid-cols-7 gap-1">
          {Array.from({ length: 7 }, (_, i) => {
            const d = new Date(date); d.setDate(d.getDate() - d.getDay() + i);
            const ds = d.toISOString().split('T')[0];
            const isToday = ds === new Date().toISOString().split('T')[0];
            return (
              <button key={i} onClick={() => { setDate(ds); setTab('today'); }}
                className={`p-3 rounded-lg border text-left min-h-[80px] transition-colors ${isToday ? 'border-h1-teal/40 bg-h1-navy-light' : 'hover:bg-gray-50'}`}>
                <div className="text-[10px] text-gray-500">{DAYS[i]}</div>
                <div className={`text-sm font-bold ${isToday ? 'text-h1-navy' : ''}`}>{d.getDate()}</div>
              </button>
            );
          })}
        </div>
      </div>}

      {/* ═══ SCHEDULES & LEAVES ═══ */}
      {tab === 'schedules' && <div className="space-y-4">
        {/* Add schedule */}
        <div className="bg-white rounded-xl border p-5 space-y-3">
          <h3 className="font-bold text-sm">Add Doctor Schedule</h3>
          <div className="grid grid-cols-4 gap-3">
            <div><label className="text-[9px] text-gray-500">Department *</label>
              <select value={sf.deptId} onChange={e => setSf(f => ({...f, deptId: e.target.value}))} className="w-full px-2 py-1.5 border rounded text-xs">
                <option value="">Select</option>{departments.filter(d=>d.type==='clinical').map((d:any)=><option key={d.id} value={d.id}>{d.name}</option>)}
              </select></div>
            <div><label className="text-[9px] text-gray-500">Doctor *</label>
              <select value={sf.doctorId} onChange={e => setSf(f => ({...f, doctorId: e.target.value}))} className="w-full px-2 py-1.5 border rounded text-xs">
                <option value="">Select</option>{doctors.map((d:any)=><option key={d.id} value={d.id}>{d.full_name}</option>)}
              </select></div>
            <div><label className="text-[9px] text-gray-500">Day</label>
              <select value={sf.day} onChange={e => setSf(f => ({...f, day: parseInt(e.target.value)}))} className="w-full px-2 py-1.5 border rounded text-xs">
                {DAYS.map((d,i)=><option key={i} value={i}>{d}</option>)}
              </select></div>
            <div className="grid grid-cols-2 gap-1">
              <div><label className="text-[9px] text-gray-500">Start</label>
                <input type="time" value={sf.start} onChange={e => setSf(f=>({...f,start:e.target.value}))} className="w-full px-2 py-1.5 border rounded text-xs" /></div>
              <div><label className="text-[9px] text-gray-500">End</label>
                <input type="time" value={sf.end} onChange={e => setSf(f=>({...f,end:e.target.value}))} className="w-full px-2 py-1.5 border rounded text-xs" /></div>
            </div>
          </div>
          <div className="grid grid-cols-4 gap-3">
            <div><label className="text-[9px] text-gray-500">Slot Duration</label>
              <select value={sf.duration} onChange={e=>setSf(f=>({...f,duration:parseInt(e.target.value)}))} className="w-full px-2 py-1.5 border rounded text-xs">
                {[10,15,20,30,45,60].map(d=><option key={d} value={d}>{d} min</option>)}
              </select></div>
            <div><label className="text-[9px] text-gray-500">Max Patients</label>
              <input type="number" value={sf.max} onChange={e=>setSf(f=>({...f,max:parseInt(e.target.value)||20}))} className="w-full px-2 py-1.5 border rounded text-xs" /></div>
            <div><label className="text-[9px] text-gray-500">Room</label>
              <input type="text" value={sf.room} onChange={e=>setSf(f=>({...f,room:e.target.value}))} className="w-full px-2 py-1.5 border rounded text-xs" placeholder="OPD-1" /></div>
            <div><label className="text-[9px] text-gray-500">Fee ₹</label>
              <input type="number" value={sf.fee} onChange={e=>setSf(f=>({...f,fee:parseInt(e.target.value)||0}))} className="w-full px-2 py-1.5 border rounded text-xs" /></div>
          </div>
          <button onClick={async () => {
            if (!sf.doctorId || !sf.deptId) { flash('Select department and doctor'); return; }
            const r = await scheds.addSchedule({ doctorId: sf.doctorId, departmentId: sf.deptId, dayOfWeek: sf.day, startTime: sf.start, endTime: sf.end, slotDuration: sf.duration, maxPatients: sf.max, room: sf.room, fee: sf.fee });
            if (r.success) flash('Schedule added'); else flash('Error: ' + (r.error || ''));
          }} className="px-4 py-2 bg-h1-navy text-white text-xs rounded-lg font-medium hover:bg-h1-navy/90 disabled:opacity-40" disabled={!sf.doctorId || !sf.deptId}>Add Schedule</button>
        </div>

        {/* Schedule list */}
        {scheds.schedules.length > 0 && <div className="bg-white rounded-xl border overflow-hidden">
          <table className="w-full text-xs"><thead><tr className="bg-gray-50 border-b">
            <th className="p-2 text-left">Doctor</th><th className="p-2">Department</th><th className="p-2">Day</th>
            <th className="p-2">Time</th><th className="p-2">Slot</th><th className="p-2">Max</th>
            <th className="p-2">Room</th><th className="p-2 text-right">Fee</th><th className="p-2"></th>
          </tr></thead><tbody>{scheds.schedules.map(s => (
            <tr key={s.id} className="border-b hover:bg-gray-50">
              <td className="p-2 font-medium">{s.doctorName}<div className="text-[10px] text-gray-400">{s.specialisation}</div></td>
              <td className="p-2 text-center text-[10px]">{s.departmentName}</td>
              <td className="p-2 text-center font-medium">{DAYS[s.dayOfWeek]}</td>
              <td className="p-2 text-center">{fmtTime(s.startTime)} – {fmtTime(s.endTime)}</td>
              <td className="p-2 text-center">{s.slotDuration}m</td>
              <td className="p-2 text-center">{s.maxPatients}</td>
              <td className="p-2 text-center text-gray-400">{s.room || '—'}</td>
              <td className="p-2 text-right font-bold">₹{s.fee?.toLocaleString('en-IN')}</td>
              <td className="p-2"><button onClick={() => { scheds.removeSchedule(s.id); flash('Removed'); }} className="text-red-400 hover:text-red-600 text-[10px]">Remove</button></td>
            </tr>
          ))}</tbody></table>
        </div>}

        {/* Doctor Leaves */}
        <div className="bg-white rounded-xl border p-5 space-y-3">
          <h3 className="font-bold text-sm">Doctor Leaves</h3>
          <div className="grid grid-cols-4 gap-3">
            <div><label className="text-[9px] text-gray-500">Doctor</label>
              <select value={leaveDoc} onChange={e=>setLeaveDoc(e.target.value)} className="w-full px-2 py-1.5 border rounded text-xs">
                <option value="">Select</option>{doctors.map((d:any)=><option key={d.id} value={d.id}>{d.full_name}</option>)}
              </select></div>
            <div><label className="text-[9px] text-gray-500">Date</label>
              <input type="date" value={leaveDate} onChange={e=>setLeaveDate(e.target.value)} className="w-full px-2 py-1.5 border rounded text-xs" min={new Date().toISOString().split('T')[0]} /></div>
            <div><label className="text-[9px] text-gray-500">Reason</label>
              <input type="text" value={leaveReason} onChange={e=>setLeaveReason(e.target.value)} className="w-full px-2 py-1.5 border rounded text-xs" placeholder="Personal/Conference/CME" /></div>
            <div className="flex items-end"><button onClick={async () => {
              if (!leaveDoc || !leaveDate) return;
              const r = await scheds.addLeave(leaveDoc, leaveDate, leaveReason, staffId);
              if (r.success) { flash('Leave marked'); setLeaveDoc(''); setLeaveDate(''); setLeaveReason(''); } else flash('Error: ' + (r.error || ''));
            }} className="w-full py-1.5 bg-h1-yellow-light0 text-white text-xs rounded hover:bg-h1-yellow" disabled={!leaveDoc || !leaveDate}>Mark Leave</button></div>
          </div>
          {scheds.leaves.length > 0 && <div className="mt-2 space-y-1">
            {scheds.leaves.map((l:any) => (
              <div key={l.id} className="flex items-center justify-between bg-h1-yellow-light rounded-lg px-3 py-2 text-xs">
                <span><span className="font-medium">{l.doctor?.full_name}</span> — {new Date(l.leave_date).toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short' })}</span>
                <span className="text-gray-500">{l.reason || 'No reason'}</span>
              </div>
            ))}
          </div>}
        </div>
      </div>}

      {/* ═══ CANCEL / RESCHEDULE MODAL ═══ */}
      {actionAppt && <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center" onClick={() => setActionAppt(null)}>
        <div className="bg-white rounded-xl p-5 w-[420px] space-y-4" onClick={e => e.stopPropagation()}>
          <div className="flex justify-between items-center">
            <div><h3 className="font-bold text-sm">{actionAppt.patientName}</h3>
              <p className="text-[10px] text-gray-500">Token #{actionAppt.token} · {fmtTime(actionAppt.time)} · {actionAppt.doctorName}</p></div>
            <button onClick={() => setActionAppt(null)} className="text-gray-400 hover:text-gray-600 text-lg">×</button>
          </div>

          <div className="border-t pt-3 space-y-2">
            <h4 className="text-xs font-bold text-red-700">Cancel</h4>
            <select value={cancelReason} onChange={e => setCancelReason(e.target.value)} className="w-full px-3 py-2 border rounded-lg text-xs">
              <option value="">Select reason</option>
              <option>Patient request</option><option>Doctor unavailable</option><option>Emergency</option><option>Duplicate booking</option><option>Wrong doctor/department</option>
            </select>
            <button onClick={async () => { await appts.cancel(actionAppt!.id, cancelReason, staffId); flash('Cancelled'); setActionAppt(null); }} disabled={!cancelReason}
              className="px-4 py-1.5 bg-red-600 text-white text-xs rounded-lg disabled:opacity-40 hover:bg-red-700">Cancel Appointment</button>
          </div>

          <div className="border-t pt-3 space-y-2">
            <h4 className="text-xs font-bold text-orange-700">Reschedule</h4>
            <div className="flex gap-2">
              <input type="date" value={reschedDate} onChange={e => setReschedDate(e.target.value)} className="flex-1 px-3 py-2 border rounded-lg text-xs" min={new Date().toISOString().split('T')[0]} />
              <input type="time" value={reschedTime} onChange={e => setReschedTime(e.target.value)} className="w-28 px-3 py-2 border rounded-lg text-xs" />
            </div>
            <button onClick={async () => { const r = await appts.reschedule(actionAppt!.id, reschedDate, reschedTime + ':00', staffId); if (r.success) flash('Rescheduled'); setActionAppt(null); }} disabled={!reschedDate || !reschedTime}
              className="px-4 py-1.5 bg-orange-600 text-white text-xs rounded-lg disabled:opacity-40 hover:bg-orange-700">Reschedule</button>
          </div>
        </div>
      </div>}
    </div>
  );
}

export default function AppointmentsPage() { return <RoleGuard module="opd"><AppointmentsInner /></RoleGuard>; }
