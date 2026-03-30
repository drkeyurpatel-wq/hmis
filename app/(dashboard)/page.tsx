'use client';
import React, { useState } from 'react';
import { useAuthStore } from '@/lib/store/auth';
import { useMyWorkQueue } from '@/lib/patient/my-workqueue-hooks';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  AlertTriangle, Heart, Pill, FlaskConical, ScanLine, BedDouble,
  Stethoscope, Clock, RefreshCw, ChevronRight, Users, Activity,
  ArrowRight, CheckCircle, User, Calendar,
} from 'lucide-react';

const ago = (d: string) => {
  const mins = Math.floor((Date.now() - new Date(d).getTime()) / 60000);
  if (mins < 1) return 'now';
  if (mins < 60) return `${mins}m`;
  if (mins < 1440) return `${Math.floor(mins / 60)}h`;
  return `${Math.floor(mins / 1440)}d`;
};

const URGENCY: Record<string, { bg: string; badge: string; text: string; ring: string }> = {
  critical: { bg: 'bg-red-50 border-red-200', badge: 'bg-red-600 text-white', text: 'text-red-700', ring: 'ring-2 ring-red-200' },
  urgent: { bg: 'bg-amber-50 border-amber-200', badge: 'bg-amber-500 text-white', text: 'text-amber-700', ring: '' },
  routine: { bg: 'bg-white border-gray-200', badge: 'bg-gray-100 text-gray-600', text: 'text-gray-700', ring: '' },
};

const TYPE_ICONS: Record<string, any> = {
  opd_patient: Calendar, ipd_patient: BedDouble, vitals_due: Heart,
  meds_due: Pill, lab_result: FlaskConical, rad_result: ScanLine,
  critical_alert: AlertTriangle, pending_discharge: CheckCircle,
};

const TYPE_LABELS: Record<string, string> = {
  opd_patient: 'OPD', ipd_patient: 'IPD', vitals_due: 'Vitals',
  meds_due: 'Meds', lab_result: 'Lab', rad_result: 'Radiology',
  critical_alert: 'CRITICAL', pending_discharge: 'Discharge',
};

export default function HomePage() {
  const { staff, activeCentreId, centres } = useAuthStore();
  const router = useRouter();
  const staffType = staff?.staff_type || 'admin';
  const centreId = activeCentreId || '';
  const wq = useMyWorkQueue(centreId, staff?.id || null, staffType);
  const [filter, setFilter] = useState<string>('all');

  const activeCentre = centres.find((c: any) => c.centre_id === centreId);
  const centreName = (activeCentre as any)?.centre?.name || 'Health1';
  const greeting = () => {
    const h = new Date().getHours();
    return h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening';
  };

  const filtered = filter === 'all' ? wq.items : wq.items.filter((i: any) => i.type === filter || i.urgency === filter);
  const typeCounts: Record<string, number> = {};
  for (const item of wq.items) { typeCounts[item.type] = (typeCounts[item.type] || 0) + 1; }

  return (
    <div className="w-full lg:max-w-[1200px] mx-auto">
      {/* HEADER */}
      <div className="mb-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold text-gray-900">{greeting()}, {staff?.full_name?.replace(/^Dr\.?\s*/i, '') || 'Doctor'}</h1>
            <p className="text-sm text-gray-500">{centreName} &middot; {new Date().toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'short' })}</p>
          </div>
          <button onClick={wq.reload} className="p-2 hover:bg-gray-100 rounded-lg">
            <RefreshCw size={16} className={wq.loading ? 'animate-spin text-gray-400' : 'text-gray-500'} />
          </button>
        </div>
        {wq.items.length > 0 && (
          <div className="flex gap-3 mt-3">
            {wq.stats.critical > 0 && <div className="flex items-center gap-1.5 bg-red-600 text-white px-3 py-1.5 rounded-lg text-xs font-bold animate-pulse"><AlertTriangle size={13} /> {wq.stats.critical} Critical</div>}
            {wq.stats.urgent > 0 && <div className="flex items-center gap-1.5 bg-amber-500 text-white px-3 py-1.5 rounded-lg text-xs font-bold"><Clock size={13} /> {wq.stats.urgent} Urgent</div>}
            <div className="flex items-center gap-1.5 bg-teal-50 text-teal-700 px-3 py-1.5 rounded-lg text-xs font-semibold"><Activity size={13} /> {wq.stats.total} tasks</div>
          </div>
        )}
      </div>

      {/* FILTER */}
      {wq.items.length > 0 && (
        <div className="flex gap-1.5 mb-3 overflow-x-auto pb-1">
          <button onClick={() => setFilter('all')} className={`px-3 py-1.5 text-xs font-medium rounded-lg whitespace-nowrap ${filter === 'all' ? 'bg-teal-600 text-white' : 'bg-white text-gray-500 border'}`}>All ({wq.items.length})</button>
          {wq.stats.critical > 0 && <button onClick={() => setFilter('critical')} className={`px-3 py-1.5 text-xs font-medium rounded-lg whitespace-nowrap ${filter === 'critical' ? 'bg-red-600 text-white' : 'bg-red-50 text-red-600 border border-red-200'}`}>Critical ({wq.stats.critical})</button>}
          {Object.entries(typeCounts).sort((a: any, b: any) => b[1] - a[1]).map(([type, count]) => (
            <button key={type} onClick={() => setFilter(type)} className={`px-3 py-1.5 text-xs font-medium rounded-lg whitespace-nowrap ${filter === type ? 'bg-teal-600 text-white' : 'bg-white text-gray-500 border'}`}>{TYPE_LABELS[type] || type} ({count})</button>
          ))}
        </div>
      )}

      {/* WORK QUEUE */}
      {wq.loading ? (
        <div className="text-center py-16"><RefreshCw className="animate-spin text-gray-300 mx-auto" size={24} /><p className="text-gray-400 text-sm mt-2">Loading your tasks...</p></div>
      ) : wq.items.length === 0 ? (
        <div className="text-center py-16 bg-white rounded-xl border">
          <CheckCircle size={48} className="mx-auto text-green-400 mb-3" />
          <h2 className="text-lg font-bold text-gray-700">All clear</h2>
          <p className="text-sm text-gray-400 mt-1">No pending tasks right now.</p>
          <div className="flex gap-2 justify-center mt-6">
            <Link href="/opd" className="px-4 py-2 bg-teal-600 text-white text-sm rounded-lg">Open OPD</Link>
            <Link href="/ward-board" className="px-4 py-2 bg-white text-gray-600 text-sm rounded-lg border">Ward Board</Link>
          </div>
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map((item) => {
            const urg = URGENCY[item.urgency];
            const Icon = TYPE_ICONS[item.type] || Activity;
            return (
              <div key={item.id} onClick={() => router.push(item.action)}
                className={`flex items-center gap-3 p-3 rounded-xl border cursor-pointer hover:shadow-md transition-all ${urg.bg} ${urg.ring}`}>
                <div className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 ${item.urgency === 'critical' ? 'bg-red-100' : item.urgency === 'urgent' ? 'bg-amber-100' : 'bg-gray-100'}`}>
                  <Icon size={16} className={urg.text} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${urg.badge}`}>{TYPE_LABELS[item.type]}</span>
                    <span className="text-xs font-semibold text-gray-800 truncate">{item.patientName}</span>
                    <span className="text-[10px] text-gray-400 font-mono">{item.patientUhid}</span>
                  </div>
                  <div className="text-sm font-medium text-gray-700 mt-0.5 truncate">{item.title}</div>
                  {item.subtitle && <div className="text-xs text-gray-400">{item.subtitle}</div>}
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <span className="text-[10px] text-gray-400">{ago(item.timestamp)}</span>
                  <div className={`px-3 py-1.5 rounded-lg text-xs font-semibold ${item.urgency === 'critical' ? 'bg-red-600 text-white' : 'bg-teal-600 text-white'}`}>
                    {item.actionLabel} <ChevronRight size={10} className="inline" />
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* QUICK LAUNCH */}
      <div className="mt-6 grid grid-cols-2 sm:grid-cols-4 gap-2">
        {[
          { href: '/opd', label: 'OPD Queue', icon: Calendar, desc: 'Today\'s visits', color: 'text-blue-600 bg-blue-50' },
          { href: '/ward-board', label: 'Ward Board', icon: BedDouble, desc: 'All beds live', color: 'text-teal-600 bg-teal-50' },
          { href: '/lab', label: 'Laboratory', icon: FlaskConical, desc: 'Pending samples', color: 'text-purple-600 bg-purple-50' },
          { href: '/billing', label: 'Billing', icon: Activity, desc: 'Today\'s revenue', color: 'text-amber-600 bg-amber-50' },
        ].map((item) => (
          <Link key={item.href} href={item.href} className="flex items-center gap-3 p-3 bg-white rounded-xl border hover:shadow-sm hover:-translate-y-0.5 transition-all">
            <div className={`w-9 h-9 rounded-lg flex items-center justify-center ${item.color}`}><item.icon size={16} /></div>
            <div><div className="text-xs font-semibold text-gray-800">{item.label}</div><div className="text-[10px] text-gray-400">{item.desc}</div></div>
          </Link>
        ))}
      </div>
    </div>
  );
}
