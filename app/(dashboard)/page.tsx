'use client';

import {
  Users, BedDouble, Calendar, CreditCard, TrendingUp, Activity,
  Clock, AlertCircle, ArrowUpRight, ArrowDownRight, Stethoscope,
  Bell, ChevronRight, Circle, Pill, FlaskConical, Scissors,
} from 'lucide-react';
import { cn, formatCurrency } from '@/lib/utils';

const STATS = [
  { label: 'OPD today', value: '127', change: '+12%', up: true, icon: Calendar, color: 'bg-blue-50 text-blue-600' },
  { label: 'IPD active', value: '83', change: '+3', up: true, icon: BedDouble, color: 'bg-teal-50 text-teal-600' },
  { label: 'Revenue today', value: formatCurrency(1247000), change: '+8.2%', up: true, icon: CreditCard, color: 'bg-emerald-50 text-emerald-600' },
  { label: 'Bed occupancy', value: '79%', change: '-2%', up: false, icon: Activity, color: 'bg-amber-50 text-amber-600' },
];

const BED_SUMMARY = [
  { ward: 'General', total: 40, occupied: 32, available: 6, maintenance: 2, color: 'bg-blue-500' },
  { ward: 'ICU', total: 18, occupied: 16, available: 1, maintenance: 1, color: 'bg-red-500' },
  { ward: 'Transplant ICU', total: 5, occupied: 5, available: 0, maintenance: 0, color: 'bg-red-600' },
  { ward: 'Private', total: 20, occupied: 14, available: 5, maintenance: 1, color: 'bg-purple-500' },
  { ward: 'Semi-private', total: 15, occupied: 11, available: 3, maintenance: 1, color: 'bg-indigo-500' },
  { ward: 'Emergency', total: 5, occupied: 3, available: 2, maintenance: 0, color: 'bg-orange-500' },
];

const OPD_QUEUE = [
  { token: 'T-042', patient: 'Rajesh Sharma', age: 58, doctor: 'Dr. Sunil Gurmukhani', dept: 'Cardiology', status: 'with_doctor', time: '10:15 AM' },
  { token: 'T-043', patient: 'Priya Desai', age: 34, doctor: 'Dr. Jignesh Patel', dept: 'Cardiology', status: 'waiting', time: '10:30 AM' },
  { token: 'T-044', patient: 'Amit Thakur', age: 45, doctor: 'Dr. Sunil Gurmukhani', dept: 'Cardiology', status: 'waiting', time: '10:45 AM' },
  { token: 'T-045', patient: 'Meera Patel', age: 62, doctor: 'Dr. Nidhi Shukla', dept: 'Neurology', status: 'with_doctor', time: '10:20 AM' },
  { token: 'T-046', patient: 'Kiran Joshi', age: 29, doctor: 'Dr. Nidhi Shukla', dept: 'Neurology', status: 'waiting', time: '10:50 AM' },
  { token: 'T-047', patient: 'Dinesh Modi', age: 71, doctor: 'Dr. Amit Patanvadiya', dept: 'Internal Medicine', status: 'checked_in', time: '11:00 AM' },
];

const RECENT_ADMISSIONS = [
  { ipd: 'SHI-I-000412', patient: 'Harshad Mehta', age: 55, dept: 'Cardiology', doctor: 'Dr. Sunil Gurmukhani', payor: 'Star Health', type: 'elective', time: '2h ago' },
  { ipd: 'SHI-I-000411', patient: 'Sunita Verma', age: 48, dept: 'Orthopaedics', doctor: 'Dr. Karmay Shah', payor: 'Self-pay', type: 'emergency', time: '4h ago' },
  { ipd: 'SHI-I-000410', patient: 'Prakash Chauhan', age: 67, dept: 'Nephrology', doctor: 'Dr. Amit Patanvadiya', payor: 'PMJAY', type: 'elective', time: '6h ago' },
];

const PENDING_ACTIONS = [
  { text: '3 pre-auth requests pending TPA response', severity: 'warning', icon: AlertCircle },
  { text: '7 critical lab results awaiting validation', severity: 'critical', icon: FlaskConical },
  { text: '12 drugs below reorder level', severity: 'warning', icon: Pill },
  { text: '5 patients with discharge orders pending billing', severity: 'info', icon: Clock },
  { text: '2 OT bookings tomorrow need anaesthetist assignment', severity: 'warning', icon: Scissors },
];

const REVENUE_HOURS = [
  { hour: '8AM', amount: 85000 }, { hour: '9AM', amount: 192000 }, { hour: '10AM', amount: 347000 },
  { hour: '11AM', amount: 520000 }, { hour: '12PM', amount: 680000 }, { hour: '1PM', amount: 790000 },
  { hour: '2PM', amount: 940000 }, { hour: '3PM', amount: 1080000 }, { hour: '4PM', amount: 1247000 },
];

const DEPT_REVENUE = [
  { dept: 'Cardiology', amount: 412000, pct: 33 },
  { dept: 'Orthopaedics', amount: 287000, pct: 23 },
  { dept: 'Internal Medicine', amount: 198000, pct: 16 },
  { dept: 'Nephrology', amount: 156000, pct: 13 },
  { dept: 'Neurology', amount: 112000, pct: 9 },
  { dept: 'Others', amount: 82000, pct: 6 },
];

const statusColors: Record<string, string> = { with_doctor: 'bg-green-100 text-green-700', waiting: 'bg-amber-100 text-amber-700', checked_in: 'bg-blue-100 text-blue-700' };
const statusLabels: Record<string, string> = { with_doctor: 'In consultation', waiting: 'Waiting', checked_in: 'Checked in' };
const severityStyles: Record<string, string> = { critical: 'bg-red-50 border-red-200 text-red-800', warning: 'bg-amber-50 border-amber-200 text-amber-800', info: 'bg-blue-50 border-blue-200 text-blue-800' };

export default function DashboardPage() {
  const maxRevenue = Math.max(...REVENUE_HOURS.map((r) => r.amount));
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="page-title">Dashboard</h1>
          <p className="text-sm text-gray-500 mt-0.5">Shilaj · Monday, 16 March 2026 · 4:15 PM</p>
        </div>
        <button className="relative p-2 rounded-lg hover:bg-gray-100 transition-colors">
          <Bell size={18} className="text-gray-500" />
          <span className="absolute top-1 right-1 w-2 h-2 rounded-full bg-red-500" />
        </button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {STATS.map((s) => { const I = s.icon; return (
          <div key={s.label} className="bg-white rounded-xl border border-gray-200 p-5 shadow-sm hover:shadow-md transition-shadow">
            <div className="flex items-center justify-between mb-3">
              <span className="text-sm font-medium text-gray-500">{s.label}</span>
              <div className={cn('w-9 h-9 rounded-lg flex items-center justify-center', s.color)}><I size={18} /></div>
            </div>
            <div className="flex items-end justify-between">
              <p className="text-2xl font-display font-bold text-gray-900">{s.value}</p>
              <span className={cn('flex items-center gap-0.5 text-xs font-medium', s.up ? 'text-emerald-600' : 'text-red-500')}>
                {s.up ? <ArrowUpRight size={12} /> : <ArrowDownRight size={12} />}{s.change}
              </span>
            </div>
          </div>
        );})}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
        <div className="lg:col-span-3 bg-white rounded-xl border border-gray-200 shadow-sm">
          <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
            <h2 className="text-sm font-semibold text-gray-900 flex items-center gap-2"><BedDouble size={16} className="text-gray-400" />Bed occupancy — Shilaj</h2>
            <span className="text-xs text-gray-500">105 beds operational</span>
          </div>
          <div className="p-5 space-y-3">
            {BED_SUMMARY.map((w) => { const pct = Math.round((w.occupied / w.total) * 100); return (
              <div key={w.ward}>
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-sm font-medium text-gray-700">{w.ward}</span>
                  <div className="flex items-center gap-3 text-xs">
                    <span className="text-gray-500">{w.occupied}/{w.total}</span>
                    <span className={cn('font-semibold', pct >= 90 ? 'text-red-600' : pct >= 75 ? 'text-amber-600' : 'text-emerald-600')}>{pct}%</span>
                  </div>
                </div>
                <div className="h-2.5 bg-gray-100 rounded-full overflow-hidden flex">
                  <div className={cn('rounded-full', w.color)} style={{ width: `${(w.occupied / w.total) * 100}%` }} />
                  {w.maintenance > 0 && <div className="bg-gray-300 rounded-full ml-0.5" style={{ width: `${(w.maintenance / w.total) * 100}%` }} />}
                </div>
                <div className="flex gap-4 mt-1 text-[10px] text-gray-400">
                  <span className="flex items-center gap-1"><Circle size={6} className="fill-green-400 text-green-400" />{w.available} available</span>
                  {w.maintenance > 0 && <span className="flex items-center gap-1"><Circle size={6} className="fill-gray-300 text-gray-300" />{w.maintenance} maintenance</span>}
                </div>
              </div>
            );})}
          </div>
        </div>

        <div className="lg:col-span-2 bg-white rounded-xl border border-gray-200 shadow-sm">
          <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
            <h2 className="text-sm font-semibold text-gray-900 flex items-center gap-2"><Stethoscope size={16} className="text-gray-400" />OPD queue</h2>
            <span className="text-xs font-medium text-brand-600">{OPD_QUEUE.length} in queue</span>
          </div>
          <div className="divide-y divide-gray-50">
            {OPD_QUEUE.map((q) => (
              <div key={q.token} className="px-5 py-3 hover:bg-gray-50 transition-colors cursor-pointer">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <span className="text-xs font-mono font-bold text-gray-900 bg-gray-100 px-2 py-1 rounded">{q.token}</span>
                    <div>
                      <p className="text-sm font-medium text-gray-900">{q.patient} <span className="text-gray-400 font-normal">· {q.age}y</span></p>
                      <p className="text-xs text-gray-500">{q.doctor} · {q.dept}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <span className={cn('text-[10px] font-semibold px-2 py-0.5 rounded-full uppercase', statusColors[q.status])}>{statusLabels[q.status]}</span>
                    <p className="text-[10px] text-gray-400 mt-1">{q.time}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
          <div className="px-5 py-3 border-t border-gray-100">
            <button className="text-xs font-medium text-brand-600 hover:text-brand-700 flex items-center gap-1">View full queue <ChevronRight size={12} /></button>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 bg-white rounded-xl border border-gray-200 shadow-sm">
          <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
            <h2 className="text-sm font-semibold text-gray-900 flex items-center gap-2"><TrendingUp size={16} className="text-gray-400" />Revenue today</h2>
            <span className="text-lg font-display font-bold text-emerald-600">{formatCurrency(1247000)}</span>
          </div>
          <div className="p-5">
            <div className="flex items-end gap-2 h-32 mb-3">
              {REVENUE_HOURS.map((r) => (
                <div key={r.hour} className="flex-1 flex flex-col items-center gap-1">
                  <div className="w-full bg-emerald-100 hover:bg-emerald-200 rounded-t transition-colors cursor-pointer relative group" style={{ height: `${(r.amount / maxRevenue) * 100}%`, minHeight: 4 }}>
                    <div className="absolute -top-6 left-1/2 -translate-x-1/2 bg-gray-800 text-white text-[9px] px-1.5 py-0.5 rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap">{formatCurrency(r.amount)}</div>
                  </div>
                  <span className="text-[9px] text-gray-400">{r.hour}</span>
                </div>
              ))}
            </div>
            <div className="border-t border-gray-100 pt-3 space-y-2">
              <p className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-2">By department</p>
              {DEPT_REVENUE.map((d) => (
                <div key={d.dept} className="flex items-center gap-3">
                  <span className="text-xs text-gray-600 w-28 truncate">{d.dept}</span>
                  <div className="flex-1 h-1.5 bg-gray-100 rounded-full overflow-hidden"><div className="h-full bg-emerald-400 rounded-full" style={{ width: `${d.pct}%` }} /></div>
                  <span className="text-xs font-medium text-gray-700 w-16 text-right">{formatCurrency(d.amount)}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl border border-gray-200 shadow-sm">
          <div className="px-5 py-4 border-b border-gray-100">
            <h2 className="text-sm font-semibold text-gray-900 flex items-center gap-2">
              <AlertCircle size={16} className="text-gray-400" />Pending actions
              <span className="ml-auto text-xs font-medium bg-red-100 text-red-700 px-2 py-0.5 rounded-full">{PENDING_ACTIONS.length}</span>
            </h2>
          </div>
          <div className="p-3 space-y-2">
            {PENDING_ACTIONS.map((a, i) => { const I = a.icon; return (
              <div key={i} className={cn('flex items-start gap-3 px-3 py-2.5 rounded-lg border cursor-pointer hover:shadow-sm transition-shadow', severityStyles[a.severity])}>
                <I size={14} className="mt-0.5 flex-shrink-0" />
                <span className="text-xs leading-relaxed">{a.text}</span>
              </div>
            );})}
          </div>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 shadow-sm">
        <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-gray-900 flex items-center gap-2"><Clock size={16} className="text-gray-400" />Recent admissions</h2>
          <button className="text-xs font-medium text-brand-600 hover:text-brand-700 flex items-center gap-1">View all <ChevronRight size={12} /></button>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead><tr className="border-b border-gray-100">
              {['IPD #','Patient','Department','Doctor','Payor','Type','When'].map((h,i) => (
                <th key={h} className={cn('px-5 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider', i === 6 ? 'text-right' : 'text-left')}>{h}</th>
              ))}
            </tr></thead>
            <tbody className="divide-y divide-gray-50">
              {RECENT_ADMISSIONS.map((a) => (
                <tr key={a.ipd} className="hover:bg-gray-50 cursor-pointer transition-colors">
                  <td className="px-5 py-3 font-mono text-xs font-medium text-gray-900">{a.ipd}</td>
                  <td className="px-5 py-3"><span className="font-medium text-gray-900">{a.patient}</span><span className="text-gray-400 ml-1">· {a.age}y</span></td>
                  <td className="px-5 py-3 text-gray-600">{a.dept}</td>
                  <td className="px-5 py-3 text-gray-600">{a.doctor}</td>
                  <td className="px-5 py-3"><span className={cn('text-xs font-medium px-2 py-0.5 rounded-full', a.payor === 'Self-pay' ? 'bg-gray-100 text-gray-600' : a.payor === 'PMJAY' ? 'bg-green-100 text-green-700' : 'bg-blue-100 text-blue-700')}>{a.payor}</span></td>
                  <td className="px-5 py-3"><span className={cn('text-xs font-medium px-2 py-0.5 rounded-full', a.type === 'emergency' ? 'bg-red-100 text-red-700' : 'bg-gray-100 text-gray-600')}>{a.type}</span></td>
                  <td className="px-5 py-3 text-right text-xs text-gray-500">{a.time}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
