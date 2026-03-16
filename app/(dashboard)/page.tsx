'use client';
import React, { useState, useEffect } from 'react';
import { useAuthStore } from '@/lib/store/auth';
import { CardSkeleton, TableSkeleton } from '@/components/ui/shared';
import { createClient } from '@/lib/supabase/client';
import Link from 'next/link';
import {
  Calendar, BedDouble, CreditCard, Activity, Clock,
  Stethoscope, Pill, FlaskConical, AlertTriangle, TrendingUp,
  ArrowRight, Users,
} from 'lucide-react';
import { cn, formatCurrency } from '@/lib/utils';

let _sb: any = null;
function sb() { if (typeof window === 'undefined') return null as any; if (!_sb) { try { _sb = createClient(); } catch { return null; } } return _sb; }

interface DashStats {
  opdToday: number; opdWaiting: number; opdCompleted: number;
  revenueToday: number; billsPending: number; billsPaid: number;
  rxPending: number; rxDispensed: number;
  patientsToday: number; encountersToday: number;
}

export default function DashboardPage() {
  const { staff, activeCentreId } = useAuthStore();
  const centreId = activeCentreId || '';
  const [stats, setStats] = useState<DashStats>({ opdToday: 0, opdWaiting: 0, opdCompleted: 0, revenueToday: 0, billsPending: 0, billsPaid: 0, rxPending: 0, rxDispensed: 0, patientsToday: 0, encountersToday: 0 });
  const [recentVisits, setRecentVisits] = useState<any[]>([]);
  const [recentBills, setRecentBills] = useState<any[]>([]);
  const [rxQueue, setRxQueue] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!centreId || !sb()) { setLoading(false); return; }
    const today = new Date().toISOString().split('T')[0];

    async function load() {
      try {
        // OPD visits today
        const { data: visits } = await sb().from('hmis_opd_visits').select('id, status, token_number, patient:hmis_patients(first_name, last_name, uhid), doctor:hmis_staff(full_name)')
          .eq('centre_id', centreId).gte('created_at', today + 'T00:00:00').lte('created_at', today + 'T23:59:59').order('token_number', { ascending: true });
        const v = visits || [];

        // Bills today
        const { data: bills } = await sb().from('hmis_bills').select('id, bill_number, net_amount, paid_amount, balance_amount, status, patient:hmis_patients(first_name, last_name, uhid)')
          .eq('centre_id', centreId).eq('bill_date', today).order('created_at', { ascending: false });
        const b = bills || [];

        // Pharmacy
        const { data: rx } = await sb().from('hmis_pharmacy_dispensing').select('id, status, patient:hmis_patients(first_name, last_name)')
          .eq('centre_id', centreId).gte('created_at', today + 'T00:00:00').order('created_at', { ascending: false }).limit(20);
        const r = rx || [];

        // Encounters today
        const { count: encCount } = await sb().from('hmis_emr_encounters').select('id', { count: 'exact', head: true })
          .eq('centre_id', centreId).eq('encounter_date', today);

        // New patients today
        const { count: ptCount } = await sb().from('hmis_patients').select('id', { count: 'exact', head: true })
          .gte('created_at', today + 'T00:00:00').lte('created_at', today + 'T23:59:59');

        setStats({
          opdToday: v.length,
          opdWaiting: v.filter((x: any) => x.status === 'waiting').length,
          opdCompleted: v.filter((x: any) => x.status === 'completed').length,
          revenueToday: b.reduce((s: number, x: any) => s + (x.paid_amount || 0), 0),
          billsPending: b.filter((x: any) => x.balance_amount > 0).length,
          billsPaid: b.filter((x: any) => x.status === 'paid').length,
          rxPending: r.filter((x: any) => x.status === 'pending' || x.status === 'in_progress').length,
          rxDispensed: r.filter((x: any) => x.status === 'dispensed').length,
          patientsToday: ptCount || 0,
          encountersToday: encCount || 0,
        });
        setRecentVisits(v.slice(0, 8));
        setRecentBills(b.slice(0, 6));
        setRxQueue(r.filter((x: any) => x.status === 'pending').slice(0, 5));
      } catch (err) {
        console.error('Dashboard load error:', err);
      }
      setLoading(false);
    }
    load();
    const interval = setInterval(load, 30000); // Refresh every 30s
    return () => clearInterval(interval);
  }, [centreId]);

  const statCards = [
    { label: 'OPD today', value: stats.opdToday, sub: `${stats.opdWaiting} waiting`, icon: Calendar, color: 'text-blue-600', bg: 'bg-blue-50', href: '/opd' },
    { label: 'Revenue collected', value: formatCurrency(stats.revenueToday), sub: `${stats.billsPending} bills pending`, icon: CreditCard, color: 'text-green-600', bg: 'bg-green-50', href: '/billing' },
    { label: 'Encounters', value: stats.encountersToday, sub: `${stats.opdCompleted} consultations done`, icon: Stethoscope, color: 'text-purple-600', bg: 'bg-purple-50', href: '/emr-v2' },
    { label: 'Pharmacy Rx', value: stats.rxPending + stats.rxDispensed, sub: `${stats.rxPending} pending`, icon: Pill, color: 'text-orange-600', bg: 'bg-orange-50', href: '/pharmacy' },
    { label: 'New patients', value: stats.patientsToday, sub: 'registered today', icon: Users, color: 'text-teal-600', bg: 'bg-teal-50', href: '/patients' },
    { label: 'Bills paid', value: stats.billsPaid, sub: `of ${stats.billsPaid + stats.billsPending} total`, icon: Activity, color: 'text-emerald-600', bg: 'bg-emerald-50', href: '/billing' },
  ];

  return (
    <div className="max-w-6xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div><h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
          <p className="text-sm text-gray-500">{new Date().toLocaleDateString('en-IN', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })} {staff?.full_name ? `| ${staff.full_name}` : ''}</p></div>
        {loading && <span className="text-xs text-gray-400 animate-pulse">Loading live data...</span>}
      </div>

      {/* Stat Cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4 mb-6">
        {statCards.map(s => (
          <Link key={s.label} href={s.href} className={`${s.bg} rounded-xl p-4 hover:ring-2 hover:ring-blue-200 transition-all`}>
            <div className="flex items-center justify-between mb-2"><s.icon size={18} className={s.color} /><ArrowRight size={14} className="text-gray-300" /></div>
            <div className="text-2xl font-bold text-gray-900">{s.value}</div>
            <div className="text-xs text-gray-500 mt-0.5">{s.label}</div>
            <div className="text-xs text-gray-400 mt-0.5">{s.sub}</div>
          </Link>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* OPD Queue */}
        <div className="bg-white rounded-xl border p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold text-sm">OPD Queue</h2>
            <Link href="/opd" className="text-xs text-blue-600 hover:text-blue-800">View all</Link>
          </div>
          {recentVisits.length === 0 ? <p className="text-sm text-gray-400 text-center py-4">No visits today</p> :
          <div className="space-y-2">{recentVisits.map((v: any) => (
            <div key={v.id} className="flex items-center justify-between py-1.5 border-b last:border-0">
              <div><div className="text-sm font-medium">{v.patient?.first_name} {v.patient?.last_name}</div>
                <div className="text-xs text-gray-400">{v.doctor?.full_name} | T-{String(v.token_number).padStart(3, '0')}</div></div>
              <span className={`px-2 py-0.5 rounded-full text-xs ${v.status === 'waiting' ? 'bg-yellow-100 text-yellow-700' : v.status === 'with_doctor' ? 'bg-blue-100 text-blue-700' : 'bg-green-100 text-green-700'}`}>{v.status.replace('_', ' ')}</span>
            </div>
          ))}</div>}
        </div>

        {/* Recent Bills */}
        <div className="bg-white rounded-xl border p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold text-sm">Recent Bills</h2>
            <Link href="/billing" className="text-xs text-blue-600 hover:text-blue-800">View all</Link>
          </div>
          {recentBills.length === 0 ? <p className="text-sm text-gray-400 text-center py-4">No bills today</p> :
          <div className="space-y-2">{recentBills.map((b: any) => (
            <div key={b.id} className="flex items-center justify-between py-1.5 border-b last:border-0">
              <div><div className="text-sm font-medium">{b.patient?.first_name} {b.patient?.last_name}</div>
                <div className="text-xs text-gray-400">{b.bill_number}</div></div>
              <div className="text-right">
                <div className="text-sm font-semibold">Rs.{(b.net_amount || 0).toLocaleString('en-IN')}</div>
                <span className={`text-xs ${b.status === 'paid' ? 'text-green-600' : b.balance_amount > 0 ? 'text-red-600' : 'text-gray-400'}`}>{b.status}</span>
              </div>
            </div>
          ))}</div>}
        </div>

        {/* Pharmacy Queue */}
        <div className="bg-white rounded-xl border p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold text-sm">Pharmacy Queue</h2>
            <Link href="/pharmacy" className="text-xs text-blue-600 hover:text-blue-800">View all</Link>
          </div>
          {rxQueue.length === 0 ? <p className="text-sm text-gray-400 text-center py-4">No pending Rx</p> :
          <div className="space-y-2">{rxQueue.map((r: any) => (
            <div key={r.id} className="flex items-center justify-between py-1.5 border-b last:border-0">
              <div className="text-sm font-medium">{r.patient?.first_name} {r.patient?.last_name}</div>
              <span className="px-2 py-0.5 bg-yellow-100 text-yellow-700 rounded-full text-xs animate-pulse">Pending</span>
            </div>
          ))}</div>}
        </div>
      </div>
    </div>
  );
}
