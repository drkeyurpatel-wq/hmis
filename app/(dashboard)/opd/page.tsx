'use client';

import { useState } from 'react';
import { cn, formatDate } from '@/lib/utils';
import {
  Calendar, Plus, Search, Clock, User, ChevronRight, Phone,
  Filter, Stethoscope, Check, X, AlertCircle, Timer, ArrowRight,
} from 'lucide-react';

const DOCTORS = [
  { id: '1', name: 'Dr. Sunil Gurmukhani', dept: 'Cardiology', slots: 4, seen: 12, total: 18 },
  { id: '2', name: 'Dr. Jignesh Patel', dept: 'Cardiology', slots: 2, seen: 8, total: 14 },
  { id: '3', name: 'Dr. Nidhi Shukla', dept: 'Neurology', slots: 6, seen: 5, total: 12 },
  { id: '4', name: 'Dr. Amit Patanvadiya', dept: 'Internal Medicine', slots: 8, seen: 10, total: 20 },
  { id: '5', name: 'Dr. Karmay Shah', dept: 'Orthopaedics', slots: 3, seen: 7, total: 12 },
];

type Appt = { id: string; token: string; time: string; patient: string; age: number; gender: string; phone: string; type: string; doctor: string; dept: string; status: string; chief: string; };
const APPOINTMENTS: Appt[] = [
  { id: '1', token: 'T-042', time: '10:15', patient: 'Rajesh Sharma', age: 58, gender: 'M', phone: '9876543210', type: 'followup', doctor: 'Dr. Sunil Gurmukhani', dept: 'Cardiology', status: 'with_doctor', chief: 'Chest pain on exertion, follow-up after angiography' },
  { id: '2', token: 'T-043', time: '10:30', patient: 'Priya Desai', age: 34, gender: 'F', phone: '9823456789', type: 'new', doctor: 'Dr. Jignesh Patel', dept: 'Cardiology', status: 'waiting', chief: 'Palpitations and breathlessness for 2 weeks' },
  { id: '3', token: 'T-044', time: '10:45', patient: 'Amit Thakur', age: 45, gender: 'M', phone: '9812345678', type: 'new', doctor: 'Dr. Sunil Gurmukhani', dept: 'Cardiology', status: 'waiting', chief: 'Referred from GP for ECG abnormality' },
  { id: '4', token: 'T-045', time: '10:20', patient: 'Meera Patel', age: 62, gender: 'F', phone: '9834567890', type: 'followup', doctor: 'Dr. Nidhi Shukla', dept: 'Neurology', status: 'with_doctor', chief: 'Epilepsy medication review' },
  { id: '5', token: 'T-046', time: '10:50', patient: 'Kiran Joshi', age: 29, gender: 'M', phone: '9845678901', type: 'new', doctor: 'Dr. Nidhi Shukla', dept: 'Neurology', status: 'waiting', chief: 'Recurrent headaches and visual disturbance' },
  { id: '6', token: 'T-047', time: '11:00', patient: 'Dinesh Modi', age: 71, gender: 'M', phone: '9856789012', type: 'new', doctor: 'Dr. Amit Patanvadiya', dept: 'Internal Medicine', status: 'checked_in', chief: 'Uncontrolled diabetes, HbA1c 9.2%' },
  { id: '7', token: 'T-048', time: '11:15', patient: 'Sonal Bhatt', age: 43, gender: 'F', phone: '9867890123', type: 'followup', doctor: 'Dr. Amit Patanvadiya', dept: 'Internal Medicine', status: 'scheduled', chief: 'Thyroid medication adjustment' },
  { id: '8', token: 'T-049', time: '11:30', patient: 'Vijay Rathod', age: 55, gender: 'M', phone: '9878901234', type: 'new', doctor: 'Dr. Karmay Shah', dept: 'Orthopaedics', status: 'scheduled', chief: 'Right knee pain, difficulty climbing stairs' },
  { id: '9', token: 'T-050', time: '11:45', patient: 'Geeta Chauhan', age: 68, gender: 'F', phone: '9889012345', type: 'emergency', doctor: 'Dr. Nidhi Shukla', dept: 'Neurology', status: 'scheduled', chief: 'Sudden onset slurred speech (resolved in 20 min)' },
  { id: '10', token: 'T-051', time: '12:00', patient: 'Ramesh Yadav', age: 50, gender: 'M', phone: '9890123456', type: 'new', doctor: 'Dr. Sunil Gurmukhani', dept: 'Cardiology', status: 'scheduled', chief: 'Pre-operative cardiac clearance for hernia surgery' },
];

const statusConfig: Record<string, { label: string; color: string; bg: string }> = {
  scheduled: { label: 'Scheduled', color: 'text-gray-600', bg: 'bg-gray-100' },
  checked_in: { label: 'Checked in', color: 'text-blue-700', bg: 'bg-blue-100' },
  waiting: { label: 'Waiting', color: 'text-amber-700', bg: 'bg-amber-100' },
  with_doctor: { label: 'With doctor', color: 'text-green-700', bg: 'bg-green-100' },
  completed: { label: 'Completed', color: 'text-gray-500', bg: 'bg-gray-50' },
  no_show: { label: 'No show', color: 'text-red-600', bg: 'bg-red-50' },
};
const typeConfig: Record<string, { label: string; color: string }> = {
  new: { label: 'New', color: 'bg-blue-100 text-blue-700' },
  followup: { label: 'Follow-up', color: 'bg-purple-100 text-purple-700' },
  referral: { label: 'Referral', color: 'bg-teal-100 text-teal-700' },
  emergency: { label: 'Emergency', color: 'bg-red-100 text-red-700' },
};

export default function OPDPage() {
  const [view, setView] = useState<'queue' | 'appointments'>('queue');
  const [selectedDoctor, setSelectedDoctor] = useState<string>('all');
  const [search, setSearch] = useState('');
  const [showBooking, setShowBooking] = useState(false);
  const [selectedAppt, setSelectedAppt] = useState<Appt | null>(null);

  const filtered = APPOINTMENTS.filter((a) => {
    if (selectedDoctor !== 'all' && a.doctor !== DOCTORS.find((d) => d.id === selectedDoctor)?.name) return false;
    if (search && !a.patient.toLowerCase().includes(search.toLowerCase()) && !a.token.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  const queueOrder = ['with_doctor', 'waiting', 'checked_in', 'scheduled'];
  const sortedQueue = [...filtered].sort((a, b) => queueOrder.indexOf(a.status) - queueOrder.indexOf(b.status));

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="page-title">OPD</h1>
          <p className="text-sm text-gray-500 mt-0.5">Today · {APPOINTMENTS.length} appointments · {APPOINTMENTS.filter((a) => a.status === 'with_doctor' || a.status === 'completed').length} seen</p>
        </div>
        <button onClick={() => setShowBooking(true)} className="flex items-center gap-2 px-4 py-2.5 bg-health1-teal text-white text-sm font-medium rounded-lg hover:bg-teal-700 transition-colors shadow-sm">
          <Plus size={16} />Book appointment
        </button>
      </div>

      {/* Doctor cards */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
        {DOCTORS.map((d) => (
          <button key={d.id} onClick={() => setSelectedDoctor(selectedDoctor === d.id ? 'all' : d.id)}
            className={cn('bg-white rounded-xl border p-4 text-left transition-all hover:shadow-md',
              selectedDoctor === d.id ? 'border-brand-300 ring-2 ring-brand-100 shadow-md' : 'border-gray-200')}>
            <p className="text-sm font-semibold text-gray-900 truncate">{d.name}</p>
            <p className="text-xs text-gray-500">{d.dept}</p>
            <div className="flex items-center justify-between mt-3">
              <div className="flex items-center gap-1">
                <div className="h-1.5 w-full bg-gray-100 rounded-full overflow-hidden" style={{ width: 60 }}>
                  <div className="h-full bg-emerald-400 rounded-full" style={{ width: `${(d.seen / d.total) * 100}%` }} />
                </div>
                <span className="text-xs text-gray-500 ml-1">{d.seen}/{d.total}</span>
              </div>
              <span className={cn('text-xs font-medium px-1.5 py-0.5 rounded', d.slots <= 2 ? 'bg-red-100 text-red-700' : d.slots <= 5 ? 'bg-amber-100 text-amber-700' : 'bg-green-100 text-green-700')}>
                {d.slots} slots
              </span>
            </div>
          </button>
        ))}
      </div>

      {/* Controls */}
      <div className="flex items-center gap-3">
        <div className="flex bg-white border border-gray-200 rounded-lg overflow-hidden shadow-sm">
          <button onClick={() => setView('queue')} className={cn('px-4 py-2 text-xs font-medium transition-colors flex items-center gap-1.5', view === 'queue' ? 'bg-brand-600 text-white' : 'text-gray-600 hover:bg-gray-50')}>
            <Timer size={13} />Live queue
          </button>
          <button onClick={() => setView('appointments')} className={cn('px-4 py-2 text-xs font-medium transition-colors flex items-center gap-1.5', view === 'appointments' ? 'bg-brand-600 text-white' : 'text-gray-600 hover:bg-gray-50')}>
            <Calendar size={13} />All appointments
          </button>
        </div>
        <div className="relative flex-1">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input type="text" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search patient or token..." className="w-full pl-9 pr-4 py-2 rounded-lg border border-gray-200 bg-white text-sm outline-none focus:ring-2 focus:ring-brand-500 shadow-sm" />
        </div>
      </div>

      {/* Queue / Appointments */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
            <div className="divide-y divide-gray-50">
              {sortedQueue.map((a) => {
                const st = statusConfig[a.status]; const tp = typeConfig[a.type];
                return (
                  <div key={a.id} onClick={() => setSelectedAppt(a)} className={cn('px-5 py-4 hover:bg-gray-50 cursor-pointer transition-colors', selectedAppt?.id === a.id && 'bg-brand-50/50')}>
                    <div className="flex items-start justify-between">
                      <div className="flex items-start gap-4">
                        <div className="text-center flex-shrink-0 w-12">
                          <span className="text-xs font-mono font-bold text-gray-900 bg-gray-100 px-2 py-1 rounded block">{a.token}</span>
                          <span className="text-[10px] text-gray-400 mt-1 block">{a.time}</span>
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <p className="text-sm font-semibold text-gray-900">{a.patient}</p>
                            <span className="text-xs text-gray-400">{a.age}y/{a.gender}</span>
                            <span className={cn('text-[10px] font-semibold px-1.5 py-0.5 rounded-full uppercase', tp.color)}>{tp.label}</span>
                          </div>
                          <p className="text-xs text-gray-500 mt-0.5">{a.doctor} · {a.dept}</p>
                          <p className="text-xs text-gray-400 mt-1 italic">{a.chief}</p>
                        </div>
                      </div>
                      <span className={cn('text-[10px] font-semibold px-2.5 py-1 rounded-full uppercase whitespace-nowrap', st.bg, st.color)}>{st.label}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Right panel: selected appointment details */}
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm">
          {selectedAppt ? (
            <div>
              <div className="px-5 py-4 border-b border-gray-100">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-semibold text-gray-900">{selectedAppt.patient}</h3>
                  <span className={cn('text-[10px] font-semibold px-2 py-0.5 rounded-full uppercase', statusConfig[selectedAppt.status].bg, statusConfig[selectedAppt.status].color)}>{statusConfig[selectedAppt.status].label}</span>
                </div>
                <p className="text-xs text-gray-500 mt-0.5">{selectedAppt.age}y / {selectedAppt.gender} · Token {selectedAppt.token}</p>
              </div>
              <div className="px-5 py-4 space-y-4">
                <div>
                  <p className="text-[10px] font-medium text-gray-500 uppercase tracking-wider mb-1">Chief complaint</p>
                  <p className="text-sm text-gray-800">{selectedAppt.chief}</p>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div><p className="text-[10px] font-medium text-gray-500 uppercase tracking-wider mb-1">Doctor</p><p className="text-sm text-gray-800">{selectedAppt.doctor}</p></div>
                  <div><p className="text-[10px] font-medium text-gray-500 uppercase tracking-wider mb-1">Department</p><p className="text-sm text-gray-800">{selectedAppt.dept}</p></div>
                  <div><p className="text-[10px] font-medium text-gray-500 uppercase tracking-wider mb-1">Time</p><p className="text-sm text-gray-800">{selectedAppt.time}</p></div>
                  <div><p className="text-[10px] font-medium text-gray-500 uppercase tracking-wider mb-1">Type</p><p className="text-sm text-gray-800 capitalize">{selectedAppt.type}</p></div>
                </div>
                <div className="flex items-center gap-2 text-xs text-gray-500">
                  <Phone size={12} />{selectedAppt.phone}
                </div>
              </div>
              <div className="px-5 py-4 border-t border-gray-100 space-y-2">
                {selectedAppt.status === 'scheduled' && (
                  <button className="w-full py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors flex items-center justify-center gap-2">
                    <Check size={14} />Check in
                  </button>
                )}
                {(selectedAppt.status === 'checked_in' || selectedAppt.status === 'waiting') && (
                  <button className="w-full py-2 bg-health1-teal text-white text-sm font-medium rounded-lg hover:bg-teal-700 transition-colors flex items-center justify-center gap-2">
                    <Stethoscope size={14} />Start consultation
                  </button>
                )}
                {selectedAppt.status === 'with_doctor' && (
                  <button className="w-full py-2 bg-brand-600 text-white text-sm font-medium rounded-lg hover:bg-brand-700 transition-colors flex items-center justify-center gap-2">
                    <ArrowRight size={14} />Open EMR
                  </button>
                )}
                <button className="w-full py-2 border border-gray-200 text-gray-600 text-sm font-medium rounded-lg hover:bg-gray-50 transition-colors flex items-center justify-center gap-2">
                  <X size={14} />Cancel appointment
                </button>
              </div>
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center h-80 text-gray-400">
              <Stethoscope size={32} className="mb-2 text-gray-300" />
              <p className="text-sm">Select a patient to see details</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
