'use client';
import React, { useState, useEffect } from 'react';
import { useAuthStore } from '@/lib/store/auth';
import { useMyWorkQueue } from '@/lib/patient/my-workqueue-hooks';
import { sb } from '@/lib/supabase/browser';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  AlertTriangle, Heart, Pill, FlaskConical, ScanLine, BedDouble,
  Stethoscope, Clock, RefreshCw, ChevronRight, Users, Activity,
  CheckCircle, Calendar, UserPlus, CreditCard, TrendingUp,
  ArrowUpRight, ArrowDownRight,
} from 'lucide-react';
import { ClinicDashboard } from './clinic/dashboard';

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

interface LiveStats {
  opdToday: number;
  admissionsActive: number;
  pendingLabs: number;
  revenueToday: number;
  dischargesPending: number;
  bedsOccupied: number;
  bedsTotal: number;
}

function useLiveStats(centreId: string) {
  const [stats, setStats] = useState<LiveStats>({ opdToday: 0, admissionsActive: 0, pendingLabs: 0, revenueToday: 0, dischargesPending: 0, bedsOccupied: 0, bedsTotal: 0 });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!centreId) return;
    const load = async () => {
      try {
        const today = new Date().toISOString().slice(0, 10);
        const client = sb();

        const [opd, adm, labs, bills, disch, bedsOcc, bedsAll] = await Promise.all([
          client.from('hmis_appointments').select('id', { count: 'exact', head: true }).eq('centre_id', centreId).gte('appointment_date', today).lte('appointment_date', today + 'T23:59:59'),
          client.from('hmis_admissions').select('id', { count: 'exact', head: true }).eq('centre_id', centreId).eq('status', 'active'),
          client.from('hmis_lab_orders').select('id', { count: 'exact', head: true }).eq('centre_id', centreId).in('status', ['ordered', 'sample_collected', 'processing']),
          client.from('hmis_bills').select('net_amount').eq('centre_id', centreId).gte('bill_date', today).eq('status', 'final'),
          client.from('hmis_admissions').select('id', { count: 'exact', head: true }).eq('centre_id', centreId).eq('status', 'active').not('discharge_date', 'is', null),
          client.from('hmis_beds').select('id', { count: 'exact', head: true }).eq('status', 'occupied'),
          client.from('hmis_beds').select('id', { count: 'exact', head: true }),
        ]);

        const rev = (bills.data || []).reduce((s: number, b: any) => s + (parseFloat(b.net_amount) || 0), 0);

        setStats({
          opdToday: opd.count || 0,
          admissionsActive: adm.count || 0,
          pendingLabs: labs.count || 0,
          revenueToday: rev,
          dischargesPending: disch.count || 0,
          bedsOccupied: bedsOcc.count || 0,
          bedsTotal: bedsAll.count || 0,
        });
      } catch (e) { console.error(e); }
      setLoading(false);
    };
    load();
    const interval = setInterval(load, 60000);
    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [centreId]);

  return { stats, loading };
}

function StatCard({ label, value, icon: Icon, color, sub }: { label: string; value: string | number; icon: any; color: string; sub?: string }) {
  return (
    <div className="bg-white rounded-xl border border-gray-100 p-4 hover:shadow-md transition-shadow">
      <div className="flex items-center justify-between mb-3">
        <div className={cn('w-9 h-9 rounded-lg flex items-center justify-center', color)}>
          <Icon size={17} className="text-white" />
        </div>
      </div>
      <div className="text-2xl font-bold text-gray-900 tabular-nums">{value}</div>
      <div className="text-[11px] text-gray-500 font-medium mt-0.5">{label}</div>
      {sub && <div className="text-[10px] text-gray-400 mt-1">{sub}</div>}
    </div>
  );
}

function cn(...classes: (string | boolean | undefined)[]) { return classes.filter(Boolean).join(' '); }

function fmt(n: number) { return new Intl.NumberFormat('en-IN').format(Math.round(n)); }

export default function HomePage() {
  const { staff, activeCentreId, centres, isClinicMode } = useAuthStore();
  const router = useRouter();
  const staffType = staff?.staff_type || 'admin';
  const centreId = activeCentreId || '';
  const wq = useMyWorkQueue(centreId, staff?.id || null, staffType);
  const { stats, loading: statsLoading } = useLiveStats(centreId);
  const [filter, setFilter] = useState<string>('all');

  // Client-only: avoids hydration mismatch between server (UTC) and client (IST)
  const [greeting, setGreeting] = useState('Welcome');
  const [dateLabel, setDateLabel] = useState('');
  useEffect(() => {
    const h = new Date().getHours();
    setGreeting(h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening');
    setDateLabel(new Date().toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'short' }));
  }, []);

  // Render clinic dashboard if active centre is a clinic
  if (isClinicMode) {
    return <ClinicDashboard />;
  }

  const activeCentre = centres.find((c: any) => c.centre_id === centreId);
  const centreName = (activeCentre as any)?.centre?.name || 'Health1';

  const filtered = filter === 'all' ? wq.items : wq.items.filter((i: any) => i.type === filter || i.urgency === filter);
  const typeCounts: Record<string, number> = {};
  for (const item of wq.items) { typeCounts[item.type] = (typeCounts[item.type] || 0) + 1; }

  const occupancyPct = stats.bedsTotal > 0 ? Math.round((stats.bedsOccupied / stats.bedsTotal) * 100) : 0;

  return (
    <div className="w-full max-w-[1280px] mx-auto space-y-5">
      {/* HEADER */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-900">{greeting}, {staff?.full_name?.replace(/^Dr\.?\s*/i, '') || 'Doctor'}</h1>
          <p className="text-sm text-gray-500">{centreName} &middot; {dateLabel}</p>
        </div>
        <button onClick={() => { wq.reload(); }} className="p-2 hover:bg-gray-100 rounded-lg transition-colors">
          <RefreshCw size={16} className={wq.loading ? 'animate-spin text-gray-400' : 'text-gray-500'} />
        </button>
      </div>

      {/* LIVE STATS */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        <StatCard label="OPD Today" value={stats.opdToday} icon={Calendar} color="bg-blue-500" />
        <StatCard label="Active Admissions" value={stats.admissionsActive} icon={BedDouble} color="bg-teal-500" />
        <StatCard label="Pending Labs" value={stats.pendingLabs} icon={FlaskConical} color="bg-purple-500" />
        <StatCard label="Today's Revenue" value={stats.revenueToday > 0 ? `₹${fmt(stats.revenueToday)}` : '₹0'} icon={CreditCard} color="bg-amber-500" />
        <StatCard label="Bed Occupancy" value={`${occupancyPct}%`} icon={BedDouble} color="bg-indigo-500" sub={`${stats.bedsOccupied}/${stats.bedsTotal} beds`} />
        <StatCard label="Pending Discharges" value={stats.dischargesPending} icon={CheckCircle} color="bg-rose-500" />
      </div>

      {/* QUICK ACTIONS */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        {[
          { href: '/patients/register', label: 'Register Patient', icon: UserPlus, color: 'text-teal-600' },
          { href: '/opd', label: 'Open OPD', icon: Calendar, color: 'text-blue-600' },
          { href: '/ipd', label: 'New Admission', icon: BedDouble, color: 'text-indigo-600' },
          { href: '/billing', label: 'New Bill', icon: CreditCard, color: 'text-amber-600' },
        ].map((item) => (
          <a key={item.href} href={item.href}
            className="flex items-center gap-2.5 px-3.5 py-2.5 bg-white rounded-xl border border-gray-100 hover:border-gray-200 hover:shadow-sm transition-all group">
            <item.icon size={16} className={item.color} />
            <span className="text-[12px] font-semibold text-gray-700 group-hover:text-gray-900">{item.label}</span>
          </a>
        ))}
      </div>

      {/* ALERTS BAR */}
      {wq.items.length > 0 && (
        <div className="flex gap-3">
          {wq.stats.critical > 0 && <div className="flex items-center gap-1.5 bg-red-600 text-white px-3 py-1.5 rounded-lg text-xs font-bold animate-pulse"><AlertTriangle size={13} /> {wq.stats.critical} Critical</div>}
          {wq.stats.urgent > 0 && <div className="flex items-center gap-1.5 bg-amber-500 text-white px-3 py-1.5 rounded-lg text-xs font-bold"><Clock size={13} /> {wq.stats.urgent} Urgent</div>}
          <div className="flex items-center gap-1.5 bg-gray-100 text-gray-600 px-3 py-1.5 rounded-lg text-xs font-semibold"><Activity size={13} /> {wq.stats.total} pending tasks</div>
        </div>
      )}

      {/* FILTER TABS */}
      {wq.items.length > 0 && (
        <div className="flex gap-1.5 overflow-x-auto pb-1">
          <button onClick={() => setFilter('all')} className={`px-3 py-1.5 text-xs font-medium rounded-lg whitespace-nowrap transition-colors ${filter === 'all' ? 'bg-[#0f1729] text-white' : 'bg-white text-gray-500 border hover:bg-gray-50'}`}>All ({wq.items.length})</button>
          {wq.stats.critical > 0 && <button onClick={() => setFilter('critical')} className={`px-3 py-1.5 text-xs font-medium rounded-lg whitespace-nowrap transition-colors ${filter === 'critical' ? 'bg-red-600 text-white' : 'bg-red-50 text-red-600 border border-red-200'}`}>Critical ({wq.stats.critical})</button>}
          {Object.entries(typeCounts).sort((a: any, b: any) => b[1] - a[1]).map(([type, count]) => (
            <button key={type} onClick={() => setFilter(type)} className={`px-3 py-1.5 text-xs font-medium rounded-lg whitespace-nowrap transition-colors ${filter === type ? 'bg-[#0f1729] text-white' : 'bg-white text-gray-500 border hover:bg-gray-50'}`}>{TYPE_LABELS[type] || type} ({count})</button>
          ))}
        </div>
      )}

      {/* WORK QUEUE */}
      {wq.loading ? (
        <div className="text-center py-16"><RefreshCw className="animate-spin text-gray-300 mx-auto" size={24} /><p className="text-gray-400 text-sm mt-2">Loading your tasks...</p></div>
      ) : wq.items.length === 0 ? (
        <div className="bg-white rounded-xl border border-gray-100 p-8 text-center">
          <CheckCircle size={40} className="mx-auto text-teal-400 mb-3" />
          <h2 className="text-base font-bold text-gray-700">All clear — no pending tasks</h2>
          <p className="text-sm text-gray-400 mt-1">Use the quick actions above or explore the sidebar modules.</p>
        </div>
      ) : (
        <div className="space-y-1.5">
          <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider px-1">My Worklist ({filtered.length})</h3>
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
                  <div className={`px-3 py-1.5 rounded-lg text-xs font-semibold ${item.urgency === 'critical' ? 'bg-red-600 text-white' : 'bg-[#0f1729] text-white'}`}>
                    {item.actionLabel} <ChevronRight size={10} className="inline" />
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
