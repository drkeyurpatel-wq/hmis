'use client';

import { useState } from 'react';
import {
  BedDouble, Calendar, CreditCard, TrendingUp, TrendingDown,
  Activity, Clock, AlertTriangle, CheckCircle2, ArrowRight,
  Stethoscope, Pill, FlaskConical, Shield, ChevronRight,
} from 'lucide-react';
import { cn, formatCurrency } from '@/lib/utils';

const stats = [
  { label: 'OPD today', value: 47, prev: 42, icon: Calendar, color: 'text-brand-600', bg: 'bg-brand-50', ring: 'ring-brand-100' },
  { label: 'IPD active', value: 83, prev: 79, icon: BedDouble, color: 'text-teal-600', bg: 'bg-teal-50', ring: 'ring-teal-100' },
  { label: 'Revenue today', value: 847000, prev: 792000, icon: CreditCard, color: 'text-emerald-600', bg: 'bg-emerald-50', ring: 'ring-emerald-100', isCurrency: true },
  { label: 'Bed occupancy', value: 79, prev: 74, icon: Activity, color: 'text-amber-600', bg: 'bg-amber-50', ring: 'ring-amber-100', isPercent: true },
];

const bedBoard = [
  { ward: 'General', total: 40, occupied: 32 },
  { ward: 'ICU', total: 18, occupied: 17 },
  { ward: 'Transplant ICU', total: 5, occupied: 4 },
  { ward: 'Private', total: 20, occupied: 14 },
  { ward: 'Semi-private', total: 15, occupied: 12 },
  { ward: 'Emergency', total: 5, occupied: 3 },
  { ward: 'NICU', total: 2, occupied: 1 },
];

const opdQueue = [
  { doctor: 'Dr. Sunil Gurmukhani', dept: 'Cardiology', waiting: 8, current: 'Ramesh Patel', avgWait: '22 min' },
  { doctor: 'Dr. Jignesh Patel', dept: 'Cardiology', waiting: 5, current: 'Meena Shah', avgWait: '18 min' },
  { doctor: 'Dr. Amit Patanvadiya', dept: 'Neurology', waiting: 6, current: 'Suresh Joshi', avgWait: '25 min' },
  { doctor: 'Dr. Karmay Shah', dept: 'Orthopaedics', waiting: 4, current: 'Bhavna Modi', avgWait: '15 min' },
  { doctor: 'Dr. Nidhi Shukla', dept: 'Internal Med', waiting: 7, current: 'Dinesh Trivedi', avgWait: '20 min' },
];

const recentAdmissions = [
  { name: 'Rajesh Kumar', uhid: 'H1S-000234', dept: 'Cardiology', type: 'emergency', time: '35 min ago', doctor: 'Dr. Sunil G.', payor: 'PMJAY' },
  { name: 'Priya Sharma', uhid: 'H1S-000235', dept: 'Orthopaedics', type: 'elective', time: '1h ago', doctor: 'Dr. Karmay S.', payor: 'Star Health' },
  { name: 'Amit Desai', uhid: 'H1S-000236', dept: 'Neurology', type: 'emergency', time: '2h ago', doctor: 'Dr. Amit P.', payor: 'Self' },
  { name: 'Kavita Patel', uhid: 'H1S-000237', dept: 'General Surgery', type: 'elective', time: '3h ago', doctor: 'Dr. R. Mehta', payor: 'ICICI Lombard' },
];

const pendingActions = [
  { label: 'Pre-auth awaiting response', count: 6, icon: Shield, color: 'text-amber-600 bg-amber-50', urgent: true },
  { label: 'Lab results to validate', count: 12, icon: FlaskConical, color: 'text-blue-600 bg-blue-50', urgent: false },
  { label: 'Discharge summaries pending', count: 4, icon: CheckCircle2, color: 'text-teal-600 bg-teal-50', urgent: false },
  { label: 'Pharmacy orders to fill', count: 9, icon: Pill, color: 'text-purple-600 bg-purple-50', urgent: false },
  { label: 'OT bookings tomorrow', count: 3, icon: Stethoscope, color: 'text-pink-600 bg-pink-50', urgent: false },
];

const revenueByDept = [
  { dept: 'Cardiology', amount: 285000, pct: 33.6 },
  { dept: 'Orthopaedics', amount: 178000, pct: 21.0 },
  { dept: 'Neurology', amount: 142000, pct: 16.8 },
  { dept: 'General Surgery', amount: 98000, pct: 11.6 },
  { dept: 'Internal Medicine', amount: 87000, pct: 10.3 },
  { dept: 'Others', amount: 57000, pct: 6.7 },
];

export default function DashboardPage() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-display font-bold text-gray-900">Dashboard</h1>
          <p className="text-sm text-gray-500 mt-0.5">{new Date().toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })} &middot; Shilaj</p>
        </div>
        <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-emerald-50 border border-emerald-200">
          <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
          <span className="text-xs font-semibold text-emerald-700">Systems operational</span>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {stats.map((s) => {
          const Icon = s.icon;
          const chg = ((s.value - s.prev) / s.prev * 100).toFixed(1);
          const up = Number(chg) >= 0;
          return (
            <div key={s.label} className="bg-white rounded-xl border border-gray-200/80 p-5 shadow-sm hover:shadow-md transition-shadow">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-500">{s.label}</p>
                  <p className="text-2xl font-display font-bold text-gray-900 mt-1">{s.isCurrency ? formatCurrency(s.value) : s.isPercent ? `${s.value}%` : s.value}</p>
                </div>
                <div className={cn('w-10 h-10 rounded-xl flex items-center justify-center ring-1', s.bg, s.ring)}><Icon size={20} className={s.color} /></div>
              </div>
              <div className="flex items-center gap-1 mt-3">
                {up ? <TrendingUp size={14} className="text-emerald-500" /> : <TrendingDown size={14} className="text-red-500" />}
                <span className={cn('text-xs font-semibold', up ? 'text-emerald-600' : 'text-red-600')}>{up ? '+' : ''}{chg}%</span>
                <span className="text-xs text-gray-400 ml-1">vs yesterday</span>
              </div>
            </div>
          );
        })}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 bg-white rounded-xl border border-gray-200/80 shadow-sm">
          <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
            <div className="flex items-center gap-2"><BedDouble size={16} className="text-gray-400" /><h2 className="text-sm font-semibold text-gray-900">Bed occupancy board</h2></div>
            <span className="text-xs font-medium text-gray-500">105 total &middot; 83 occupied &middot; 22 available</span>
          </div>
          <div className="p-5 space-y-3">
            {bedBoard.map((w) => {
              const pct = Math.round((w.occupied / w.total) * 100);
              const avail = w.total - w.occupied;
              return (
                <div key={w.ward} className="flex items-center gap-4">
                  <div className="w-28 flex-shrink-0"><p className="text-sm font-medium text-gray-700">{w.ward}</p><p className="text-xs text-gray-400">{w.occupied}/{w.total}</p></div>
                  <div className="flex-1 h-6 bg-gray-100 rounded-full overflow-hidden relative">
                    <div className={cn('h-full rounded-full transition-all', pct >= 90 ? 'bg-red-500' : pct >= 75 ? 'bg-amber-500' : 'bg-emerald-500')} style={{ width: `${pct}%` }} />
                    <span className="absolute inset-0 flex items-center justify-center text-xs font-bold text-gray-700">{pct}%</span>
                  </div>
                  <div className={cn('w-16 text-center text-xs font-bold rounded-md py-1', avail === 0 ? 'bg-red-50 text-red-700' : avail <= 2 ? 'bg-amber-50 text-amber-700' : 'bg-emerald-50 text-emerald-700')}>{avail === 0 ? 'FULL' : `${avail} free`}</div>
                </div>
              );
            })}
          </div>
        </div>

        <div className="bg-white rounded-xl border border-gray-200/80 shadow-sm">
          <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
            <div className="flex items-center gap-2"><AlertTriangle size={16} className="text-amber-500" /><h2 className="text-sm font-semibold text-gray-900">Pending actions</h2></div>
            <span className="text-xs font-bold text-gray-900 bg-gray-100 rounded-full px-2 py-0.5">{pendingActions.reduce((a, b) => a + b.count, 0)}</span>
          </div>
          <div className="divide-y divide-gray-50">
            {pendingActions.map((item) => { const Icon = item.icon; return (
              <button key={item.label} className="w-full flex items-center gap-3 px-5 py-3.5 hover:bg-gray-50 transition-colors text-left">
                <div className={cn('w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0', item.color)}><Icon size={15} /></div>
                <p className="text-sm text-gray-700 flex-1 truncate">{item.label}</p>
                <div className="flex items-center gap-2">{item.urgent && <div className="w-2 h-2 rounded-full bg-amber-500 animate-pulse" />}<span className="text-sm font-bold text-gray-900">{item.count}</span><ChevronRight size={14} className="text-gray-300" /></div>
              </button>
            ); })}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 bg-white rounded-xl border border-gray-200/80 shadow-sm">
          <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
            <div className="flex items-center gap-2"><Calendar size={16} className="text-gray-400" /><h2 className="text-sm font-semibold text-gray-900">OPD queue &mdash; live</h2><div className="flex items-center gap-1.5 ml-2"><div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" /><span className="text-xs text-gray-400">Real-time</span></div></div>
          </div>
          <table className="w-full">
            <thead><tr className="border-b border-gray-100"><th className="px-5 py-2.5 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Doctor</th><th className="px-3 py-2.5 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Dept</th><th className="px-3 py-2.5 text-center text-xs font-semibold text-gray-500 uppercase tracking-wider">Waiting</th><th className="px-3 py-2.5 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Current patient</th><th className="px-3 py-2.5 text-right text-xs font-semibold text-gray-500 uppercase tracking-wider">Avg wait</th></tr></thead>
            <tbody className="divide-y divide-gray-50">
              {opdQueue.map((q) => (
                <tr key={q.doctor} className="hover:bg-gray-50/50">
                  <td className="px-5 py-3 text-sm font-medium text-gray-900">{q.doctor}</td>
                  <td className="px-3 py-3"><span className="text-xs font-medium bg-gray-100 text-gray-600 rounded-md px-2 py-0.5">{q.dept}</span></td>
                  <td className="px-3 py-3 text-center"><span className={cn('inline-flex items-center justify-center w-7 h-7 rounded-full text-xs font-bold', q.waiting >= 7 ? 'bg-red-50 text-red-700' : q.waiting >= 5 ? 'bg-amber-50 text-amber-700' : 'bg-emerald-50 text-emerald-700')}>{q.waiting}</span></td>
                  <td className="px-3 py-3"><div className="flex items-center gap-1.5"><div className="w-2 h-2 rounded-full bg-blue-500 animate-pulse" /><span className="text-sm text-gray-700">{q.current}</span></div></td>
                  <td className="px-3 py-3 text-right text-sm text-gray-500">{q.avgWait}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="bg-white rounded-xl border border-gray-200/80 shadow-sm">
          <div className="px-5 py-4 border-b border-gray-100"><div className="flex items-center gap-2"><CreditCard size={16} className="text-gray-400" /><h2 className="text-sm font-semibold text-gray-900">Revenue by department</h2></div><p className="text-xs text-gray-400 mt-0.5">Today &middot; {formatCurrency(847000)}</p></div>
          <div className="p-5 space-y-3">
            {revenueByDept.map((d, i) => { const colors = ['bg-brand-500', 'bg-teal-500', 'bg-purple-500', 'bg-amber-500', 'bg-pink-500', 'bg-gray-400']; return (
              <div key={d.dept} className="flex items-center gap-3"><div className={cn('w-2.5 h-2.5 rounded-full flex-shrink-0', colors[i])} /><div className="flex-1"><div className="flex items-center justify-between"><span className="text-sm text-gray-700">{d.dept}</span><span className="text-sm font-semibold text-gray-900">{formatCurrency(d.amount)}</span></div><div className="h-1.5 bg-gray-100 rounded-full mt-1.5 overflow-hidden"><div className={cn('h-full rounded-full', colors[i])} style={{ width: `${d.pct}%` }} /></div></div></div>
            ); })}
          </div>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-gray-200/80 shadow-sm">
        <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between"><div className="flex items-center gap-2"><Clock size={16} className="text-gray-400" /><h2 className="text-sm font-semibold text-gray-900">Recent admissions</h2></div><button className="text-xs font-medium text-brand-600 hover:text-brand-700 flex items-center gap-1">View all IPD <ArrowRight size={12} /></button></div>
        <table className="w-full">
          <thead><tr className="border-b border-gray-100"><th className="px-5 py-2.5 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Patient</th><th className="px-3 py-2.5 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">UHID</th><th className="px-3 py-2.5 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Department</th><th className="px-3 py-2.5 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Doctor</th><th className="px-3 py-2.5 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Type</th><th className="px-3 py-2.5 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Payor</th><th className="px-3 py-2.5 text-right text-xs font-semibold text-gray-500 uppercase tracking-wider">When</th></tr></thead>
          <tbody className="divide-y divide-gray-50">
            {recentAdmissions.map((a) => (
              <tr key={a.uhid} className="hover:bg-gray-50/50 cursor-pointer">
                <td className="px-5 py-3 text-sm font-medium text-gray-900">{a.name}</td>
                <td className="px-3 py-3"><span className="text-xs font-mono bg-gray-100 text-gray-600 rounded px-1.5 py-0.5">{a.uhid}</span></td>
                <td className="px-3 py-3 text-sm text-gray-600">{a.dept}</td>
                <td className="px-3 py-3 text-sm text-gray-600">{a.doctor}</td>
                <td className="px-3 py-3"><span className={cn('text-xs font-semibold px-2 py-0.5 rounded-full', a.type === 'emergency' ? 'bg-red-50 text-red-700' : 'bg-blue-50 text-blue-700')}>{a.type}</span></td>
                <td className="px-3 py-3"><span className={cn('text-xs font-medium px-2 py-0.5 rounded-md', a.payor === 'Self' ? 'bg-gray-100 text-gray-600' : a.payor === 'PMJAY' ? 'bg-emerald-50 text-emerald-700' : 'bg-purple-50 text-purple-700')}>{a.payor}</span></td>
                <td className="px-3 py-3 text-right text-xs text-gray-500">{a.time}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
