'use client';
import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import {
  usePortalAppointments, usePortalLabReports, usePortalBills,
  usePortalPrescriptions, usePortalFeedback, usePortalDoctorSlots,
} from '@/lib/portal/portal-hooks';

type Tab = 'home' | 'appointments' | 'labs' | 'bills' | 'prescriptions';

export default function PortalPage() {
  const router = useRouter();
  const [tab, setTab] = useState<Tab>('home');
  const [toast, setToast] = useState('');
  const flash = (m: string) => { setToast(m); setTimeout(() => setToast(''), 2500); };

  // Auth check
  const [patientName, setPatientName] = useState('');
  useEffect(() => {
    const token = localStorage.getItem('portal_token');
    if (!token) { router.push('/portal/login'); return; }
    setPatientName(localStorage.getItem('portal_patient_name') || 'Patient');
  }, [router]);

  const appts = usePortalAppointments();
  const labs = usePortalLabReports();
  const bills = usePortalBills();
  const rx = usePortalPrescriptions();
  const feedback = usePortalFeedback();
  const slots = usePortalDoctorSlots();

  // Booking state
  const [booking, setBooking] = useState(false);
  const [bookDept, setBookDept] = useState('');
  const [bookDoc, setBookDoc] = useState('');
  const [bookDate, setBookDate] = useState('');
  const [bookSlots, setBookSlots] = useState<string[]>([]);
  const [bookSlot, setBookSlot] = useState('');
  const [bookReason, setBookReason] = useState('');

  // Feedback state
  const [fbVisit, setFbVisit] = useState('');
  const [fbRating, setFbRating] = useState(0);
  const [fbComment, setFbComment] = useState('');

  // Lab detail
  const [viewLab, setViewLab] = useState<any>(null);

  const slotsHook = usePortalDoctorSlots(bookDept || undefined);

  const loadSlots = async () => {
    if (!bookDoc || !bookDate) return;
    const s = await slotsHook.getSlots(bookDoc, bookDate);
    setBookSlots(s);
  };
  useEffect(() => { loadSlots(); }, [bookDoc, bookDate]);

  const handleBook = async () => {
    if (!bookDoc || !bookDate || !bookSlot) { flash('Select all fields'); return; }
    await appts.bookAppointment(bookDoc, bookDate, bookSlot, bookReason);
    setBooking(false); setBookDept(''); setBookDoc(''); setBookDate(''); setBookSlot('');
    flash('Appointment booked!');
  };

  const handleFeedback = async () => {
    if (!fbRating) { flash('Select a rating'); return; }
    await feedback.submitFeedback(fbVisit, fbRating, fbComment);
    setFbVisit(''); setFbRating(0); setFbComment('');
    flash('Thank you for your feedback!');
  };

  const upcoming = appts.appointments.filter(a => ['booked', 'confirmed'].includes(a.status) && a.appointment_date >= new Date().toISOString().split('T')[0]);
  const totalDue = bills.bills.reduce((s, b) => s + parseFloat(b.balance_amount || 0), 0);
  const fmt = (n: number) => `₹${Math.round(n).toLocaleString('en-IN')}`;

  const logout = () => { localStorage.removeItem('portal_token'); localStorage.removeItem('portal_patient_id'); localStorage.removeItem('portal_patient_name'); router.push('/portal/login'); };

  return (
    <div className="space-y-4 pb-20">
      {toast && <div className="fixed top-16 left-1/2 -translate-x-1/2 z-50 bg-teal-600 text-white px-4 py-2 rounded-lg shadow-lg text-sm">{toast}</div>}

      {/* PROFILE HEADER */}
      {tab === 'home' && (
        <div className="bg-gradient-to-br from-teal-600 to-teal-700 rounded-2xl p-5 text-white">
          <div className="flex items-center justify-between">
            <div><p className="text-teal-200 text-xs">Welcome back</p><h1 className="text-xl font-bold mt-0.5">{patientName}</h1></div>
            <button onClick={logout} className="text-teal-200 text-xs hover:text-white">Logout</button>
          </div>
          <div className="grid grid-cols-3 gap-3 mt-4">
            <div className="bg-white/15 rounded-xl p-3 text-center"><div className="text-2xl font-bold">{upcoming.length}</div><div className="text-[10px] text-teal-200">Upcoming</div></div>
            <div className="bg-white/15 rounded-xl p-3 text-center"><div className="text-2xl font-bold">{labs.reports.length}</div><div className="text-[10px] text-teal-200">Lab Reports</div></div>
            <div className="bg-white/15 rounded-xl p-3 text-center"><div className="text-2xl font-bold">{totalDue > 0 ? fmt(totalDue) : '0'}</div><div className="text-[10px] text-teal-200">Balance Due</div></div>
          </div>
        </div>
      )}

      {/* HOME TAB */}
      {tab === 'home' && <>
        {upcoming.length > 0 && <div className="bg-white rounded-2xl border p-4">
          <h3 className="font-bold text-sm mb-2">Upcoming Appointments</h3>
          {upcoming.slice(0, 3).map(a => (
            <div key={a.id} className="flex items-center justify-between py-2 border-b last:border-0">
              <div><div className="text-sm font-medium">Dr. {a.doctor?.full_name}</div><div className="text-xs text-gray-500">{a.department?.name} — {new Date(a.appointment_date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })} at {a.slot_time}</div></div>
              <span className="px-2 py-0.5 rounded text-[10px] bg-teal-100 text-teal-700">{a.status}</span>
            </div>
          ))}
        </div>}
        {labs.reports.length > 0 && <div className="bg-white rounded-2xl border p-4">
          <h3 className="font-bold text-sm mb-2">Recent Lab Reports</h3>
          {labs.reports.slice(0, 3).map(r => (
            <button key={r.id} onClick={() => { setViewLab(r); setTab('labs'); }} className="w-full text-left flex items-center justify-between py-2 border-b last:border-0">
              <div><div className="text-sm font-medium">{r.test_name}</div><div className="text-xs text-gray-400">{new Date(r.created_at).toLocaleDateString('en-IN')}</div></div>
              <span className="text-xs text-teal-600">View →</span>
            </button>
          ))}
        </div>}
        {/* Feedback */}
        <div className="bg-white rounded-2xl border p-4">
          <h3 className="font-bold text-sm mb-2">Rate Your Experience</h3>
          <div className="flex gap-1 mb-2">{[1,2,3,4,5].map(s => (
            <button key={s} onClick={() => setFbRating(s)} className={`text-2xl ${fbRating >= s ? 'text-amber-400' : 'text-gray-200'}`}>★</button>
          ))}</div>
          {fbRating > 0 && <>
            <textarea value={fbComment} onChange={e => setFbComment(e.target.value)} className="w-full px-3 py-2 border rounded-lg text-sm mb-2" rows={2} placeholder="Tell us about your experience..." />
            <button onClick={handleFeedback} className="px-4 py-2 bg-teal-600 text-white text-sm rounded-lg">Submit Feedback</button>
          </>}
        </div>
      </>}

      {/* APPOINTMENTS TAB */}
      {tab === 'appointments' && <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="font-bold text-base">Appointments</h2>
          <button onClick={() => setBooking(!booking)} className="px-3 py-1.5 bg-teal-600 text-white text-xs rounded-lg">{booking ? 'Cancel' : '+ Book New'}</button>
        </div>
        {booking && <div className="bg-white rounded-2xl border p-4 space-y-3">
          <select value={bookDept} onChange={e => { setBookDept(e.target.value); setBookDoc(''); }} className="w-full px-3 py-2.5 border rounded-lg text-sm">
            <option value="">Select Department</option>
            {slotsHook.departments.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
          </select>
          {bookDept && <select value={bookDoc} onChange={e => setBookDoc(e.target.value)} className="w-full px-3 py-2.5 border rounded-lg text-sm">
            <option value="">Select Doctor</option>
            {slotsHook.doctors.map(d => <option key={d.id} value={d.id}>Dr. {d.full_name} ({d.specialisation || d.designation})</option>)}
          </select>}
          {bookDoc && <input type="date" value={bookDate} onChange={e => setBookDate(e.target.value)} min={new Date().toISOString().split('T')[0]} className="w-full px-3 py-2.5 border rounded-lg text-sm" />}
          {bookSlots.length > 0 && <div>
            <div className="text-xs text-gray-500 mb-1">Available Slots</div>
            <div className="flex flex-wrap gap-1.5">{bookSlots.map(s => (
              <button key={s} onClick={() => setBookSlot(s)} className={`px-3 py-2 rounded-lg text-sm border ${bookSlot === s ? 'bg-teal-600 text-white border-teal-600' : 'bg-white'}`}>{s}</button>
            ))}</div>
          </div>}
          {bookSlot && <><textarea value={bookReason} onChange={e => setBookReason(e.target.value)} className="w-full px-3 py-2 border rounded-lg text-sm" rows={2} placeholder="Reason for visit (optional)" />
            <button onClick={handleBook} className="w-full py-3 bg-teal-600 text-white rounded-xl font-semibold text-sm">Confirm Booking</button>
          </>}
          {bookDate && bookSlots.length === 0 && bookDoc && <div className="text-sm text-gray-400 text-center py-4">No slots available for this date</div>}
        </div>}
        {appts.appointments.map(a => (
          <div key={a.id} className="bg-white rounded-2xl border p-4 flex items-center justify-between">
            <div><div className="text-sm font-medium">Dr. {a.doctor?.full_name}</div><div className="text-xs text-gray-500">{a.department?.name}</div>
              <div className="text-xs text-gray-400 mt-0.5">{new Date(a.appointment_date).toLocaleDateString('en-IN', { weekday: 'short', day: '2-digit', month: 'short' })} at {a.slot_time}</div></div>
            <div className="flex flex-col items-end gap-1">
              <span className={`px-2 py-0.5 rounded text-[10px] font-medium ${a.status === 'completed' ? 'bg-green-100 text-green-700' : a.status === 'cancelled' ? 'bg-red-100 text-red-700' : 'bg-teal-100 text-teal-700'}`}>{a.status}</span>
              {['booked', 'confirmed'].includes(a.status) && <button onClick={() => { appts.cancelAppointment(a.id); flash('Cancelled'); }} className="text-[10px] text-red-500">Cancel</button>}
            </div>
          </div>
        ))}
        {appts.appointments.length === 0 && <div className="text-center py-8 text-gray-400 text-sm">No appointments</div>}
      </div>}

      {/* LABS TAB */}
      {tab === 'labs' && <div className="space-y-3">
        <h2 className="font-bold text-base">Lab Reports</h2>
        {viewLab && <div className="bg-white rounded-2xl border p-4">
          <div className="flex justify-between items-start mb-3">
            <div><h3 className="font-bold text-sm">{viewLab.test_name}</h3><div className="text-xs text-gray-400">{new Date(viewLab.created_at).toLocaleDateString('en-IN')}</div></div>
            <button onClick={() => setViewLab(null)} className="text-xs text-gray-500">Close</button>
          </div>
          {(viewLab.results || []).length > 0 ? <table className="w-full text-xs">
            <thead><tr className="border-b"><th className="p-1.5 text-left">Parameter</th><th className="p-1.5 text-right">Value</th><th className="p-1.5 text-right">Ref Range</th></tr></thead>
            <tbody>{viewLab.results.map((r: any, i: number) => (
              <tr key={i} className={`border-b ${r.is_abnormal ? 'bg-red-50' : ''} ${r.is_critical ? 'bg-red-100' : ''}`}>
                <td className="p-1.5 font-medium">{r.parameter_name}</td>
                <td className={`p-1.5 text-right font-mono ${r.is_abnormal ? 'text-red-700 font-bold' : ''}`}>{r.result_value} {r.unit || ''}</td>
                <td className="p-1.5 text-right text-gray-400">{r.reference_range || '—'}</td>
              </tr>
            ))}</tbody>
          </table> : <div className="text-sm text-gray-400">Results pending</div>}
        </div>}
        {labs.reports.filter(r => r.id !== viewLab?.id).map(r => (
          <button key={r.id} onClick={() => setViewLab(r)} className="w-full bg-white rounded-2xl border p-4 text-left flex items-center justify-between">
            <div><div className="text-sm font-medium">{r.test_name}</div><div className="text-xs text-gray-400">{new Date(r.created_at).toLocaleDateString('en-IN')}</div>
              {r.results?.some((x: any) => x.is_abnormal) && <span className="text-[10px] text-red-600 font-medium">Abnormal values</span>}</div>
            <span className="text-xs text-teal-600">View →</span>
          </button>
        ))}
        {labs.reports.length === 0 && <div className="text-center py-8 text-gray-400 text-sm">No lab reports</div>}
      </div>}

      {/* BILLS TAB */}
      {tab === 'bills' && <div className="space-y-3">
        <h2 className="font-bold text-base">Bills & Payments</h2>
        {bills.bills.map(b => (
          <div key={b.id} className="bg-white rounded-2xl border p-4">
            <div className="flex items-center justify-between mb-2">
              <div><div className="text-sm font-medium">{b.bill_number}</div><div className="text-xs text-gray-400">{new Date(b.bill_date).toLocaleDateString('en-IN')} — {b.bill_type?.toUpperCase()}</div></div>
              <span className={`px-2 py-0.5 rounded text-[10px] font-medium ${b.status === 'paid' ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700'}`}>{b.status}</span>
            </div>
            <div className="grid grid-cols-3 gap-2 text-xs">
              <div className="bg-gray-50 rounded-lg p-2 text-center"><div className="text-gray-400">Net</div><div className="font-bold">{fmt(parseFloat(b.net_amount || 0))}</div></div>
              <div className="bg-green-50 rounded-lg p-2 text-center"><div className="text-gray-400">Paid</div><div className="font-bold text-green-700">{fmt(parseFloat(b.paid_amount || 0))}</div></div>
              <div className="bg-red-50 rounded-lg p-2 text-center"><div className="text-gray-400">Balance</div><div className="font-bold text-red-600">{fmt(parseFloat(b.balance_amount || 0))}</div></div>
            </div>
            {parseFloat(b.balance_amount || 0) > 0 && <button onClick={() => flash('Razorpay integration coming soon')} className="w-full mt-3 py-2.5 bg-emerald-600 text-white text-sm rounded-xl font-semibold">Pay {fmt(parseFloat(b.balance_amount))}</button>}
          </div>
        ))}
        {bills.bills.length === 0 && <div className="text-center py-8 text-gray-400 text-sm">No bills</div>}
      </div>}

      {/* PRESCRIPTIONS TAB */}
      {tab === 'prescriptions' && <div className="space-y-3">
        <h2 className="font-bold text-base">Prescriptions</h2>
        {rx.prescriptions.map(enc => (
          <div key={enc.id} className="bg-white rounded-2xl border p-4">
            <div className="flex items-center justify-between mb-2">
              <div><div className="text-sm font-medium">Dr. {enc.doctor?.full_name}</div><div className="text-xs text-gray-400">{new Date(enc.encounter_date).toLocaleDateString('en-IN')}</div></div>
              <button onClick={() => { rx.requestRefill(enc.id, enc.prescriptions); flash('Refill requested!'); }} className="px-3 py-1 bg-blue-100 text-blue-700 text-xs rounded-lg font-medium">Request Refill</button>
            </div>
            <div className="space-y-1">{(enc.prescriptions || []).map((p: any, i: number) => (
              <div key={i} className="text-xs bg-gray-50 rounded-lg px-3 py-1.5 flex justify-between">
                <span className="font-medium">{p.drug} {p.dose}</span><span className="text-gray-400">{p.frequency} × {p.duration}</span>
              </div>
            ))}</div>
          </div>
        ))}
        {rx.prescriptions.length === 0 && <div className="text-center py-8 text-gray-400 text-sm">No prescriptions</div>}
      </div>}

      {/* BOTTOM TAB BAR */}
      <div className="fixed bottom-0 left-0 right-0 bg-white border-t z-30 safe-area-bottom">
        <div className="max-w-lg mx-auto flex">
          {([['home', 'Home', '🏠'], ['appointments', 'Appts', '📅'], ['labs', 'Labs', ''], ['bills', 'Bills', '💳'], ['prescriptions', 'Rx', '']] as [Tab, string, string][]).map(([k, l, icon]) => (
            <button key={k} onClick={() => setTab(k)} className={`flex-1 py-3 flex flex-col items-center gap-0.5 ${tab === k ? 'text-teal-600' : 'text-gray-400'}`}>
              <span className="text-lg">{icon}</span><span className="text-[10px] font-medium">{l}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
