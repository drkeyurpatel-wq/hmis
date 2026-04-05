'use client';
import React, { useState, useEffect, useMemo } from 'react';
import { RoleGuard, SetupRequired } from '@/components/ui/shared';
import { useAuthStore } from '@/lib/store/auth';
import { useOTSchedule, useOTNotes, useOTUtilization } from '@/lib/ot/ot-hooks';
import { Calendar, ShieldCheck, Package } from 'lucide-react';
import { sb } from '@/lib/supabase/browser';
import Link from 'next/link';

const fmt = (n: number) => n.toLocaleString('en-IN', { maximumFractionDigits: 0 });
type Tab = 'board'|'new_booking'|'utilization'|'admin';

const PROCEDURES = [
  'Appendectomy','Cholecystectomy (Lap)','Cholecystectomy (Robotic SSI Mantra)','Hernia Repair',
  'PTCA + Stenting','Coronary Angiography','CABG','Valve Replacement',
  'Total Knee Replacement (Cuvis Robot)','Total Hip Replacement','Spine Fusion','Arthroscopy',
  'Craniotomy','VP Shunt','Laminectomy','Discectomy',
  'Hysterectomy','LSCS','Normal Delivery','D&C',
  'Cataract (Phaco)','Tonsillectomy','FESS','Mastoidectomy',
  'Nephrectomy','TURP','PCNL','DJ Stent',
  'Emergency Laparotomy','Trauma Surgery','Debridement','Skin Grafting',
];

const ANAESTHESIA_TYPES = ['general','spinal','epidural','regional','local','sedation','combined'];

function OTInner() {
  const { staff, activeCentreId } = useAuthStore();
  const centreId = activeCentreId || '';
  const staffId = staff?.id || '';
  const schedule = useOTSchedule(centreId);
  const utilization = useOTUtilization(centreId);

  const [tab, setTab] = useState<Tab>('board');
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [toast, setToast] = useState('');
  const [selectedBooking, setSelectedBooking] = useState<any>(null);
  const [viewMode, setViewMode] = useState<'list' | 'grid'>('list');
  const [adminView, setAdminView] = useState<'rooms' | 'implants' | 'safety'>('rooms');
  const flash = (m: string) => { setToast(m); setTimeout(() => setToast(''), 2500); };

  // Booking error
  const [bookingError, setBookingError] = useState('');

  // New booking form
  const [admissions, setAdmissions] = useState<any[]>([]);
  const [doctors, setDoctors] = useState<any[]>([]);
  const [bkForm, setBkForm] = useState({
    admission_id:'', ot_room_id:'', surgeon_id:'', anaesthetist_id:'', assistant_surgeon_id:'',
    procedure_name:'', scheduled_date:new Date().toISOString().split('T')[0], scheduled_start:'09:00',
    estimated_duration_min:60, is_emergency:false, is_robotic:false, robot_type:'none' as string,
    anaesthesia_type:'general', priority:'elective', laterality:'na', patient_category:'adult',
  });
  const [procSearch, setProcSearch] = useState('');
  const procResults = procSearch.length >= 2 ? PROCEDURES.filter(p => p.toLowerCase().includes(procSearch.toLowerCase())) : [];

  // WHO Safety checklist for selected booking
  const [checklist, setChecklist] = useState<any>({});
  const [showChecklist, setShowChecklist] = useState(false);

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (!centreId || !sb()) return;
    sb().from('hmis_admissions').select('id, ipd_number, patient:hmis_patients!inner(first_name, last_name, uhid, age_years, gender)')
      .eq('centre_id', centreId).eq('status', 'active').order('admission_date', { ascending: false })
      .then(({ data }: any) => setAdmissions(data || []));
    sb().from('hmis_staff').select('id, full_name, department_name').eq('centre_id', centreId).eq('is_active', true).in('role', ['doctor','surgeon','anaesthetist'])
      .then(({ data }: any) => setDoctors(data || []));
  }, [centreId]);

  // Load utilization for past 30 days
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    const from = new Date(Date.now() - 30 * 86400000).toISOString().split('T')[0];
    const to = new Date().toISOString().split('T')[0];
    utilization.loadRange(from, to);
  }, [utilization.loadRange]);

  const stColor = (s: string) => s === 'completed' ? 'bg-green-100 text-green-700' : s === 'in_progress' ? 'bg-red-100 text-red-700' : s === 'scheduled' ? 'bg-blue-100 text-teal-700' : s === 'cancelled' ? 'bg-gray-100 text-gray-500' : 'bg-yellow-100 text-yellow-700';
  const timeSlots = ['07:00','08:00','09:00','10:00','11:00','12:00','13:00','14:00','15:00','16:00','17:00','18:00','19:00','20:00'];

  const tabs: [Tab,string,string][] = [
    ['board','Schedule','📅'],['new_booking','Book Surgery','➕'],
    ['utilization','Utilization',''],['admin','Admin','⚙️'],
  ];

  return (
    <div className="max-w-7xl mx-auto">
      {toast && <div className="fixed top-4 left-1/2 -translate-x-1/2 z-50 bg-emerald-600 text-white px-4 py-2 rounded-xl shadow-lg text-sm">{toast}</div>}
      <div className="flex items-center justify-between mb-3">
        <div><h1 className="text-xl font-bold text-gray-900">Operation Theatre Management</h1>
          <p className="text-xs text-gray-500">{schedule.rooms.length} OT rooms</p></div>
        <div className="flex items-center gap-2">
          <input type="date" value={date} onChange={e => { setDate(e.target.value); schedule.loadBookings(e.target.value); }} className="px-2 py-1.5 border rounded-lg text-xs" />
          <button onClick={() => setTab('new_booking')} className="px-4 py-2 bg-teal-600 text-white text-sm rounded-lg">+ Book Surgery</button>
        </div>
      </div>

      {/* Stats strip */}
      <div className="grid grid-cols-8 gap-2 mb-3">
        {[['Scheduled',schedule.stats.scheduled,'text-teal-700','bg-blue-50'],['In Progress',schedule.stats.inProgress,'text-red-700','bg-red-50'],
          ['Completed',schedule.stats.completed,'text-green-700','bg-green-50'],['Cancelled',schedule.stats.cancelled,'text-gray-500','bg-gray-50'],
          ['Emergency',schedule.stats.emergency,'text-orange-700','bg-orange-50'],['Robotic',schedule.stats.robotic,'text-purple-700','bg-purple-50'],
          ['Total',schedule.stats.total,'text-gray-700','bg-white'],['Avg Duration',`${Math.round(schedule.stats.avgDuration)}m`,'text-gray-700','bg-white'],
        ].map(([l,v,tc,bg],i) => (
          <div key={i} className={`rounded-xl border p-2 text-center ${bg}`}><div className="text-[9px] text-gray-500 uppercase">{l as string}</div><div className={`text-lg font-bold ${tc}`}>{v}</div></div>
        ))}
      </div>

      {schedule.rooms.length === 0 && (
        <SetupRequired
          moduleName="Operation Theatre"
          prerequisites={[
            { label: 'Configure OT rooms in Settings before booking surgeries', done: false, hint: 'Add at least one OT room with type, equipment, and availability' },
          ]}
          settingsHref="/settings/modules"
        />
      )}

      <div className="flex gap-0.5 mb-4 pb-0.5 overflow-x-auto scrollbar-thin">
        {tabs.map(([k,l,icon]) => <button key={k} onClick={() => setTab(k)}
          className={`px-2 py-2 text-[11px] font-medium whitespace-nowrap rounded-xl ${tab===k?'bg-teal-600 text-white shadow-sm':'bg-white text-gray-500 border border-gray-100 hover:bg-gray-50'}`}>{icon} {l}</button>)}
      </div>

      {/* ===== SCHEDULE BOARD — Visual timeline per OT room ===== */}
      {tab === 'board' && <div className="space-y-2">
        {schedule.rooms.map(room => {
          const roomBookings = schedule.byRoom.get(room.id) || [];
          return (
            <div key={room.id} className="bg-white rounded-xl border p-3">
              <div className="flex items-center gap-2 mb-2">
                <span className="font-bold text-sm">{room.name}</span>
                <span className="text-[10px] text-gray-400">{room.type}</span>
                {room.has_robotic && <span className="text-[9px] bg-purple-100 text-purple-700 px-1.5 py-0.5 rounded">Robotic</span>}
                {room.has_laminar_flow && <span className="text-[9px] bg-blue-100 text-teal-700 px-1.5 py-0.5 rounded">Laminar</span>}
                <span className="ml-auto text-xs text-gray-400">{roomBookings.length} case{roomBookings.length !== 1 ? 's' : ''}</span>
              </div>
              {/* Timeline */}
              <div className="relative h-12 bg-gray-50 rounded-lg overflow-hidden">
                {/* Hour markers */}
                <div className="absolute inset-0 flex">{timeSlots.map((t, i) => (
                  <div key={t} className="flex-1 border-l border-gray-200 relative"><span className="absolute top-0 left-0.5 text-[8px] text-gray-300">{t}</span></div>
                ))}</div>
                {/* Surgery blocks */}
                {roomBookings.map(b => {
                  const TIMELINE_START = 7 * 60;  // 7:00 AM in minutes
                  const TIMELINE_END = 21 * 60;   // 9:00 PM in minutes
                  const TIMELINE_SPAN = TIMELINE_END - TIMELINE_START; // 840 minutes

                  const [h, m] = (b.scheduled_start || '09:00').split(':').map(Number);
                  const surgeryStart = h * 60 + m; // absolute minutes from midnight
                  const dur = b.estimated_duration_min || 60;
                  const surgeryEnd = surgeryStart + dur;

                  // Clamp to timeline bounds
                  const visibleStart = Math.max(surgeryStart, TIMELINE_START);
                  const visibleEnd = Math.min(surgeryEnd, TIMELINE_END);
                  if (visibleEnd <= visibleStart) return null; // entirely outside timeline

                  const left = ((visibleStart - TIMELINE_START) / TIMELINE_SPAN) * 100;
                  const width = ((visibleEnd - visibleStart) / TIMELINE_SPAN) * 100;

                  const bgColor = b.status === 'in_progress' ? 'bg-red-400' : b.status === 'completed' ? 'bg-green-400' : b.status === 'cancelled' ? 'bg-gray-300' : 'bg-blue-400';
                  return (
                    <div key={b.id} onClick={() => setSelectedBooking(b)}
                      className={`absolute top-2 h-8 ${bgColor} rounded cursor-pointer flex items-center px-1 text-white text-[9px] font-medium overflow-hidden shadow-sm hover:opacity-90`}
                      style={{ left: `${left}%`, width: `${Math.max(2, width)}%` }}
                      title={`${b.procedure_name} — ${b.patient?.patient?.first_name} ${b.patient?.patient?.last_name} (${b.scheduled_start}, ${dur}min)`}>
                      {b.is_robotic && '🤖'}{b.is_emergency && '🚨'}{b.procedure_name?.substring(0, 20)}
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
        {schedule.rooms.length === 0 && <div className="flex flex-col items-center justify-center py-10 bg-white rounded-xl border" role="status">
          <Calendar className="w-10 h-10 text-gray-300 mb-3" aria-hidden="true" />
          <p className="text-sm font-medium text-gray-700">No OT bookings</p>
          <p className="text-xs text-gray-400 mt-1 max-w-sm">Create a booking to begin the surgical workflow.</p>
        </div>}
      </div>}

      {/* Selected booking detail panel */}
      {selectedBooking && <div className="bg-white rounded-xl border p-5 mt-3 space-y-3">
        <div className="flex justify-between">
          <div>
            <div className="font-bold">{selectedBooking.procedure_name}</div>
            <div className="text-xs text-gray-500">{selectedBooking.patient?.patient?.first_name} {selectedBooking.patient?.patient?.last_name} ({selectedBooking.patient?.patient?.uhid}) — {selectedBooking.patient?.patient?.age_years}y {selectedBooking.patient?.patient?.gender}</div>
          </div>
          <div className="flex items-center gap-2">
            <span className={`px-2 py-0.5 rounded text-xs ${stColor(selectedBooking.status)}`}>{selectedBooking.status}</span>
            <button onClick={() => setSelectedBooking(null)} className="text-xs text-gray-500">Close</button>
          </div>
        </div>
        <div className="grid grid-cols-5 gap-3 text-xs">
          <div><span className="text-gray-500">OT Room:</span> <span className="font-bold">{selectedBooking.ot_room?.name}</span></div>
          <div><span className="text-gray-500">Surgeon:</span> <span className="font-bold">{selectedBooking.surgeon?.full_name}</span></div>
          <div><span className="text-gray-500">Anaesthetist:</span> <span className="font-bold">{selectedBooking.anaesthetist?.full_name || '—'}</span></div>
          <div><span className="text-gray-500">Time:</span> <span className="font-bold">{selectedBooking.scheduled_start} ({selectedBooking.estimated_duration_min}min)</span></div>
          <div><span className="text-gray-500">Type:</span> {selectedBooking.is_emergency && <span className="bg-red-100 text-red-700 px-1 rounded text-[10px] mr-1">EMERGENCY</span>}{selectedBooking.is_robotic && <span className="bg-purple-100 text-purple-700 px-1 rounded text-[10px]">ROBOTIC</span>}{!selectedBooking.is_emergency && !selectedBooking.is_robotic && <span>Elective</span>}</div>
        </div>
        {/* Status actions */}
        <div className="flex gap-2">{
          selectedBooking.status === 'scheduled' && <>
            <button onClick={async () => { await schedule.updateStatus(selectedBooking.id, 'in_progress'); setSelectedBooking(null); flash('Surgery started'); }} className="px-4 py-2 bg-red-600 text-white text-sm rounded-lg">Start Surgery</button>
            <button onClick={async () => { await schedule.cancel(selectedBooking.id, 'Postponed'); setSelectedBooking(null); flash('Cancelled'); }} className="px-3 py-2 bg-gray-200 text-sm rounded-lg">Cancel</button>
          </>}{
          selectedBooking.status === 'in_progress' && <>
            <button onClick={async () => { await schedule.updateStatus(selectedBooking.id, 'completed'); setSelectedBooking(null); flash('Surgery completed'); }} className="px-4 py-2 bg-emerald-600 text-white text-sm rounded-lg">Complete Surgery</button>
          </>}
          <Link href={`/ot/${selectedBooking.id}`} className="px-3 py-2 bg-blue-100 text-teal-700 text-sm rounded-lg">Open Detail →</Link>
        </div>
      </div>}

      {/* ===== CASE LIST ===== */}
      {tab === 'board' && viewMode === 'list' && schedule.bookings.length === 0 && schedule.rooms.length > 0 && (
        <div className="flex flex-col items-center justify-center py-10 bg-white rounded-xl border" role="status">
          <Calendar className="w-10 h-10 text-gray-300 mb-3" aria-hidden="true" />
          <p className="text-sm font-medium text-gray-700">No OT bookings</p>
          <p className="text-xs text-gray-400 mt-1 max-w-sm">Create a booking to begin the surgical workflow.</p>
          <button onClick={() => setTab('new_booking')} className="mt-3 px-4 py-2 bg-teal-600 text-white text-sm rounded-lg hover:bg-teal-700 cursor-pointer">+ Book Surgery</button>
        </div>
      )}

      {tab === 'board' && viewMode === 'list' && schedule.bookings.length > 0 && <div className="bg-white rounded-xl border overflow-hidden">
        <table className="w-full text-xs"><thead><tr className="bg-gray-50 border-b">
          <th className="p-2 text-left">Time</th><th className="p-2 text-left">Patient</th><th className="p-2 text-left">Procedure</th>
          <th className="p-2">OT</th><th className="p-2">Surgeon</th><th className="p-2">Anaes</th><th className="p-2">Type</th><th className="p-2">Status</th><th className="p-2">Duration</th>
        </tr></thead><tbody>{schedule.bookings.map(b => (
          <tr key={b.id} className="border-b hover:bg-blue-50 cursor-pointer" onClick={() => setSelectedBooking(b)}>
            <td className="p-2 font-mono font-bold">{b.scheduled_start}</td>
            <td className="p-2"><span className="font-medium">{b.patient?.patient?.first_name} {b.patient?.patient?.last_name}</span><span className="text-[10px] text-gray-400 ml-1">{b.patient?.patient?.uhid}</span></td>
            <td className="p-2 font-medium">{b.procedure_name}</td>
            <td className="p-2 text-center">{b.ot_room?.name}</td>
            <td className="p-2 text-center text-[10px]">{b.surgeon?.full_name}</td>
            <td className="p-2 text-center text-[10px]">{b.anaesthetist?.full_name || '—'}</td>
            <td className="p-2 text-center">{b.is_emergency && <span className="bg-red-100 text-red-700 px-1 rounded text-[9px]">EMR</span>}{b.is_robotic && <span className="bg-purple-100 text-purple-700 px-1 rounded text-[9px]">ROB</span>}{!b.is_emergency && !b.is_robotic && <span className="text-gray-400">—</span>}</td>
            <td className="p-2 text-center"><span className={`px-1.5 py-0.5 rounded text-[9px] ${stColor(b.status)}`}>{b.status?.replace('_',' ')}</span></td>
            <td className="p-2 text-center">{b.actual_start && b.actual_end ? `${Math.round((new Date(b.actual_end).getTime() - new Date(b.actual_start).getTime()) / 60000)}m` : `~${b.estimated_duration_min}m`}</td>
          </tr>))}</tbody></table>
      </div>}

      {/* ===== NEW BOOKING ===== */}
      {tab === 'new_booking' && <div className="bg-white rounded-xl border p-5 space-y-4">
        <h2 className="font-semibold text-sm">Book New Surgery</h2>
        <div className="grid grid-cols-3 gap-3">
          <div><label className="text-xs text-gray-500">Patient (IPD) *</label>
            <select value={bkForm.admission_id} onChange={e => setBkForm(f => ({...f, admission_id:e.target.value}))} className="w-full px-3 py-2 border rounded-lg text-sm">
              <option value="">Select admitted patient</option>
              {admissions.map(a => <option key={a.id} value={a.id}>{a.patient?.first_name} {a.patient?.last_name} ({a.ipd_number})</option>)}
            </select></div>
          <div><label className="text-xs text-gray-500">OT Room *</label>
            <select value={bkForm.ot_room_id} onChange={e => setBkForm(f => ({...f, ot_room_id:e.target.value}))} className="w-full px-3 py-2 border rounded-lg text-sm">
              <option value="">Select OT</option>
              {schedule.rooms.map(r => <option key={r.id} value={r.id}>{r.name} ({r.type}){r.has_robotic ? ' 🤖' : ''}</option>)}
            </select></div>
          <div className="relative"><label className="text-xs text-gray-500">Procedure *</label>
            <input type="text" value={procSearch || bkForm.procedure_name} onChange={e => { setProcSearch(e.target.value); setBkForm(f => ({...f, procedure_name:e.target.value})); }} className="w-full px-3 py-2 border rounded-lg text-sm" placeholder="Search or type..." />
            {procResults.length > 0 && <div className="absolute top-full left-0 right-0 bg-white border rounded-lg shadow z-10 mt-1 max-h-40 overflow-y-auto">{procResults.map(p => (
              <button key={p} onClick={() => { setBkForm(f => ({...f, procedure_name:p, is_robotic:p.includes('Robot')||p.includes('Cuvis')||p.includes('SSI'), robot_type:p.includes('Cuvis')?'cuvis':p.includes('SSI')?'ssi_mantra':'none'})); setProcSearch(''); }} className="w-full text-left px-3 py-1.5 text-xs hover:bg-blue-50 border-b">{p}</button>
            ))}</div>}</div>
        </div>
        <div className="grid grid-cols-4 gap-3">
          <div><label className="text-xs text-gray-500">Surgeon *</label>
            <select value={bkForm.surgeon_id} onChange={e => setBkForm(f => ({...f, surgeon_id:e.target.value}))} className="w-full px-3 py-2 border rounded-lg text-sm">
              <option value="">Select</option>
              {doctors.map(d => <option key={d.id} value={d.id}>{d.full_name}</option>)}
            </select></div>
          <div><label className="text-xs text-gray-500">Anaesthetist</label>
            <select value={bkForm.anaesthetist_id} onChange={e => setBkForm(f => ({...f, anaesthetist_id:e.target.value}))} className="w-full px-3 py-2 border rounded-lg text-sm">
              <option value="">Select</option>
              {doctors.map(d => <option key={d.id} value={d.id}>{d.full_name}</option>)}
            </select></div>
          <div><label className="text-xs text-gray-500">Date *</label>
            <input type="date" value={bkForm.scheduled_date} onChange={e => setBkForm(f => ({...f, scheduled_date:e.target.value}))} className="w-full px-3 py-2 border rounded-lg text-sm" /></div>
          <div><label className="text-xs text-gray-500">Start time *</label>
            <input type="time" value={bkForm.scheduled_start} onChange={e => setBkForm(f => ({...f, scheduled_start:e.target.value}))} className="w-full px-3 py-2 border rounded-lg text-sm" /></div>
        </div>
        <div className="grid grid-cols-5 gap-3">
          <div><label className="text-xs text-gray-500">Duration (min)</label>
            <div className="flex gap-1 mt-1">{[30,60,90,120,180,240].map(d => (
              <button key={d} onClick={() => setBkForm(f => ({...f, estimated_duration_min:d}))} className={`flex-1 py-1.5 rounded text-[10px] border ${bkForm.estimated_duration_min===d?'bg-teal-600 text-white':'bg-white'}`}>{d}m</button>
            ))}</div></div>
          <div><label className="text-xs text-gray-500">Anaesthesia</label>
            <div className="flex flex-wrap gap-0.5 mt-1">{ANAESTHESIA_TYPES.map(a => (
              <button key={a} onClick={() => setBkForm(f => ({...f, anaesthesia_type:a}))} className={`px-1.5 py-0.5 rounded text-[9px] border ${bkForm.anaesthesia_type===a?'bg-teal-600 text-white':'bg-white'}`}>{a}</button>
            ))}</div></div>
          <div><label className="text-xs text-gray-500">Priority</label>
            <div className="flex gap-1 mt-1">{['elective','urgent','emergency'].map(p => (
              <button key={p} onClick={() => setBkForm(f => ({...f, priority:p, is_emergency:p==='emergency'}))} className={`flex-1 py-1.5 rounded text-[10px] border ${bkForm.priority===p?p==='emergency'?'bg-red-600 text-white':p==='urgent'?'bg-yellow-500 text-white':'bg-teal-600 text-white':'bg-white'}`}>{p}</button>
            ))}</div></div>
          <div><label className="text-xs text-gray-500">Laterality</label>
            <div className="flex gap-1 mt-1">{['left','right','bilateral','na'].map(l => (
              <button key={l} onClick={() => setBkForm(f => ({...f, laterality:l}))} className={`flex-1 py-1.5 rounded text-[10px] border ${bkForm.laterality===l?'bg-teal-600 text-white':'bg-white'}`}>{l === 'na' ? 'N/A' : l}</button>
            ))}</div></div>
          <div><label className="text-xs text-gray-500">Robot</label>
            <div className="flex gap-1 mt-1">{[['none','None'],['ssi_mantra','SSI Mantra'],['cuvis','Cuvis']].map(([v,l]) => (
              <button key={v} onClick={() => setBkForm(f => ({...f, robot_type:v, is_robotic:v!=='none'}))} className={`flex-1 py-1.5 rounded text-[10px] border ${bkForm.robot_type===v?'bg-purple-600 text-white':'bg-white'}`}>{l}</button>
            ))}</div></div>
        </div>
        {bookingError && <div className="bg-red-50 border border-red-200 rounded-lg px-4 py-3 text-sm text-red-700">{bookingError}</div>}
        <button onClick={async () => {
          if (!bkForm.admission_id || !bkForm.ot_room_id || !bkForm.surgeon_id || !bkForm.procedure_name) return;
          setBookingError('');
          const result = await schedule.create(bkForm);
          if (!result.success) { setBookingError(result.error || 'Booking failed'); return; }
          flash('Surgery booked'); setTab('board'); setBookingError('');
          setBkForm({admission_id:'',ot_room_id:'',surgeon_id:'',anaesthetist_id:'',assistant_surgeon_id:'',procedure_name:'',scheduled_date:new Date().toISOString().split('T')[0],scheduled_start:'09:00',estimated_duration_min:60,is_emergency:false,is_robotic:false,robot_type:'none',anaesthesia_type:'general',priority:'elective',laterality:'na',patient_category:'adult'});
        }} disabled={!bkForm.admission_id||!bkForm.ot_room_id||!bkForm.surgeon_id||!bkForm.procedure_name}
          className="px-6 py-2.5 bg-emerald-600 text-white text-sm rounded-lg font-medium disabled:opacity-40">Book Surgery</button>
      </div>}

      {/* ===== UTILIZATION ===== */}
      {tab === 'utilization' && <div className="space-y-4">
        <h2 className="font-semibold text-sm">OT Utilization — Last 30 Days</h2>
        {utilization.roomUtilization.length === 0 ? <div className="flex flex-col items-center justify-center py-10 bg-white rounded-xl border" role="status"><Calendar className="w-10 h-10 text-gray-300 mb-3" aria-hidden="true" /><p className="text-sm font-medium text-gray-700">No utilization data</p><p className="text-xs text-gray-400 mt-1 max-w-sm">Utilization metrics appear after OT rooms are configured and surgeries are booked.</p></div> :
        <div className="grid grid-cols-2 gap-3">{utilization.roomUtilization.map((r, i) => {
          const pct = r.totalMin > 0 ? Math.round((r.usedMin / r.totalMin) * 100) : 0;
          return (
            <div key={i} className="bg-white rounded-xl border p-4">
              <div className="flex justify-between mb-2"><span className="font-bold text-sm">{r.name}</span><span className={`text-lg font-bold ${pct > 70 ? 'text-green-700' : pct > 40 ? 'text-yellow-700' : 'text-red-700'}`}>{pct}%</span></div>
              <div className="w-full bg-gray-200 rounded-full h-3 mb-2"><div className={`h-full rounded-full ${pct > 70 ? 'bg-green-500' : pct > 40 ? 'bg-yellow-500' : 'bg-red-500'}`} style={{ width: `${pct}%` }} /></div>
              <div className="grid grid-cols-3 gap-2 text-xs text-center">
                <div><span className="text-gray-500">Cases:</span> <span className="font-bold">{r.count}</span></div>
                <div><span className="text-gray-500">Hours used:</span> <span className="font-bold">{Math.round(r.usedMin / 60)}h</span></div>
                <div><span className="text-gray-500">Cancelled:</span> <span className="font-bold text-red-600">{r.cancelled}</span></div>
              </div>
            </div>
          );
        })}</div>}
      </div>}

      {/* ===== OT ROOMS ===== */}
      {tab === 'admin' && adminView === 'rooms' && <div className="space-y-3">
        <h2 className="font-semibold text-sm">OT Rooms — {schedule.rooms.length} rooms</h2>
        <div className="grid grid-cols-3 gap-3">{schedule.rooms.map(r => {
          const roomCases = schedule.byRoom.get(r.id) || [];
          const live = roomCases.find((b: any) => b.status === 'in_progress');
          return (
            <div key={r.id} className={`rounded-xl border p-4 ${live ? 'bg-red-50 border-red-300' : 'bg-white'}`}>
              <div className="flex justify-between items-start mb-2">
                <div><div className="font-bold text-lg">{r.name}</div><div className="text-xs text-gray-400">{r.type}</div></div>
                {live ? <span className="bg-red-600 text-white px-2 py-0.5 rounded text-xs animate-pulse">SURGERY IN PROGRESS</span> : <span className="bg-green-100 text-green-700 px-2 py-0.5 rounded text-xs">Available</span>}
              </div>
              <div className="flex gap-1 flex-wrap mb-2">
                {r.has_robotic && <span className="text-[9px] bg-purple-100 text-purple-700 px-1.5 py-0.5 rounded">Robotic</span>}
                {r.has_laminar_flow && <span className="text-[9px] bg-blue-100 text-teal-700 px-1.5 py-0.5 rounded">Laminar Flow</span>}
              </div>
              {live && <div className="text-xs bg-red-100 rounded-lg p-2">
                <div className="font-bold text-red-700">{live.procedure_name}</div>
                <div className="text-red-600">{live.surgeon?.full_name} | Started {new Date(live.actual_start).toLocaleTimeString('en-IN',{hour:'2-digit',minute:'2-digit'})}</div>
              </div>}
              <div className="text-xs text-gray-400 mt-1">{roomCases.length} cases today | {roomCases.filter((b: any) => b.status === 'completed').length} completed</div>
            </div>
          );
        })}</div>
      </div>}

      {/* ===== IMPLANTS / SAFETY — Framework ===== */}
      {tab === 'admin' && adminView === 'implants' && <div className="bg-white rounded-xl border p-4">
        <h2 className="font-bold text-sm mb-3">Implant & Consumable Tracking</h2>
        <div className="flex items-center gap-3 bg-gray-50 rounded-lg p-4 mb-3" role="status">
          <Package className="w-5 h-5 text-gray-300 shrink-0" aria-hidden="true" />
          <p className="text-xs text-gray-500">No implant records. Implants are logged during surgical procedures.</p>
        </div>
        <p className="text-xs text-gray-500 mb-3">Implants are tracked per surgery in each OT booking detail page. Select a booking above to manage implants.</p>
        <div className="text-xs text-gray-400">Fields tracked: manufacturer, catalogue #, lot #, serial #, size, quantity, cost, MRP. Each implant is linked to the patient record for medicolegal traceability.</div>
      </div>}
      {tab === 'admin' && adminView === 'safety' && <div className="bg-white rounded-xl border p-4">
        <h2 className="font-bold text-sm mb-3">WHO Surgical Safety Checklist</h2>
        {schedule.bookings.length === 0 && (
          <div className="flex items-center gap-3 bg-gray-50 rounded-lg p-4 mb-3" role="status">
            <ShieldCheck className="w-5 h-5 text-gray-300 shrink-0" aria-hidden="true" />
            <p className="text-xs text-gray-500">Safety checklists are created automatically when an OT booking is confirmed.</p>
          </div>
        )}
        <p className="text-xs text-gray-500 mb-3">The WHO checklist runs in 3 phases per surgery — available in each OT booking detail page.</p>
        <div className="grid grid-cols-3 gap-3 text-xs">
          <div className="bg-blue-50 rounded-lg p-3"><div className="font-bold text-teal-700">Sign In</div><div className="text-gray-500 mt-1">Before anaesthesia — patient identity, consent, allergy, airway risk, blood loss risk, equipment check</div></div>
          <div className="bg-amber-50 rounded-lg p-3"><div className="font-bold text-amber-700">Time Out</div><div className="text-gray-500 mt-1">Before incision — team introduction, procedure confirmation, anticipated events, antibiotic prophylaxis, imaging displayed</div></div>
          <div className="bg-green-50 rounded-lg p-3"><div className="font-bold text-green-700">Sign Out</div><div className="text-gray-500 mt-1">Before leaving OT — procedure recorded, instrument/sponge/needle count, specimen labelled, equipment issues, recovery plan</div></div>
        </div>
      </div>}
    </div>
  );
}

export default function OTPage() { return <RoleGuard module="ot"><OTInner /></RoleGuard>; }
