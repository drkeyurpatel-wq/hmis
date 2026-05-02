'use client';

import { useState, useEffect } from 'react';
import { useAuthStore } from '@/lib/store/auth';
import { sb } from '@/lib/supabase/browser';
import Link from 'next/link';
import {
  Calendar, Pill, TestTube, ArrowUpRight, CreditCard,
  RefreshCw, Clock, Users, ShoppingCart, CheckCircle,
  TrendingUp,
} from 'lucide-react';

interface ClinicStats {
  opdToday: number;
  opdWaiting: number;
  pharmacySalesToday: number;
  pharmacyAppOrders: number;
  labCollected: number;
  labDispatched: number;
  referralsSentToday: number;
  referralsCompleted: number;
  revenueToday: number;
}

function useClinicStats(centreId: string) {
  const [stats, setStats] = useState<ClinicStats>({
    opdToday: 0, opdWaiting: 0, pharmacySalesToday: 0, pharmacyAppOrders: 0,
    labCollected: 0, labDispatched: 0, referralsSentToday: 0, referralsCompleted: 0,
    revenueToday: 0,
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!centreId) return;
    const load = async () => {
      try {
        const today = new Date().toISOString().slice(0, 10);
        const client = sb();

        const [opd, opdWait, bills, labCol, labDisp, refSent, refDone] = await Promise.all([
          client.from('hmis_appointments').select('id', { count: 'exact', head: true })
            .eq('centre_id', centreId).gte('appointment_date', today).lte('appointment_date', today + 'T23:59:59'),
          client.from('hmis_appointments').select('id', { count: 'exact', head: true })
            .eq('centre_id', centreId).eq('status', 'checked_in').gte('appointment_date', today),
          client.from('hmis_bills').select('net_amount')
            .eq('centre_id', centreId).gte('bill_date', today).eq('status', 'final'),
          client.from('hmis_lab_collections').select('id', { count: 'exact', head: true })
            .eq('centre_id', centreId).eq('status', 'collected'),
          client.from('hmis_lab_collections').select('id', { count: 'exact', head: true })
            .eq('centre_id', centreId).in('status', ['dispatched', 'in_transit']),
          client.from('hmis_clinic_referrals').select('id', { count: 'exact', head: true })
            .eq('from_centre_id', centreId).gte('created_at', today),
          client.from('hmis_clinic_referrals').select('id', { count: 'exact', head: true })
            .eq('from_centre_id', centreId).eq('status', 'completed'),
        ]);

        const rev = (bills.data || []).reduce((s: number, b: any) => s + (parseFloat(b.net_amount) || 0), 0);

        setStats({
          opdToday: opd.count || 0,
          opdWaiting: opdWait.count || 0,
          pharmacySalesToday: rev,
          pharmacyAppOrders: 0,
          labCollected: labCol.count || 0,
          labDispatched: labDisp.count || 0,
          referralsSentToday: refSent.count || 0,
          referralsCompleted: refDone.count || 0,
          revenueToday: rev,
        });
      } catch (e) {
        console.error('Clinic stats error:', e);
      }
      setLoading(false);
    };
    load();
    const interval = setInterval(load, 60000);
    return () => clearInterval(interval);
  }, [centreId]);

  return { stats, loading };
}

function fmt(n: number) {
  return new Intl.NumberFormat('en-IN').format(Math.round(n));
}

interface Appointment {
  id: string;
  appointment_time: string | null;
  type: string;
  status: string;
  patient?: { first_name: string; last_name: string; uhid: string };
  doctor?: { full_name: string };
}

function useTodayAppointments(centreId: string) {
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!centreId) return;
    const load = async () => {
      const today = new Date().toISOString().slice(0, 10);
      const client = sb();
      const { data } = await client
        .from('hmis_appointments')
        .select('id, appointment_time, type, status, patient:hmis_patients(first_name, last_name, uhid), doctor:hmis_staff!doctor_id(full_name)')
        .eq('centre_id', centreId)
        .gte('appointment_date', today)
        .lte('appointment_date', today + 'T23:59:59')
        .order('appointment_time', { ascending: true })
        .limit(20);
      setAppointments((data as any) || []);
      setLoading(false);
    };
    load();
  }, [centreId]);

  return { appointments, loading };
}

export function ClinicDashboard() {
  const { staff, activeCentreId, centres, isFranchise } = useAuthStore();
  const centreId = activeCentreId || '';
  const { stats, loading } = useClinicStats(centreId);
  const { appointments, loading: apptLoading } = useTodayAppointments(centreId);

  const activeCentre = centres.find((c: any) => c.centre_id === centreId);
  const centreName = (activeCentre as Record<string, any>)?.centre?.name || 'Wellness Clinic';
  const greeting = () => {
    const h = new Date().getHours();
    return h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening';
  };

  return (
    <div className="w-full max-w-[1280px] mx-auto space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-900">
            {greeting()}, {staff?.full_name?.replace(/^Dr\.?\s*/i, '') || 'Doctor'}
          </h1>
          <p className="text-sm text-gray-500">
            {centreName} &middot; {new Date().toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'short' })}
          </p>
        </div>
      </div>

      {/* Stat Cards */}
      {loading ? (
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="bg-white rounded-xl border border-gray-100 p-4 animate-pulse">
              <div className="h-9 w-9 rounded-lg bg-gray-100 mb-3" />
              <div className="h-6 w-16 bg-gray-100 rounded mb-1" />
              <div className="h-3 w-24 bg-gray-50 rounded" />
            </div>
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
          <StatCard
            label="OPD Today"
            value={stats.opdToday}
            sub={`${stats.opdWaiting} waiting`}
            icon={Calendar}
            color="bg-blue-500"
          />
          <StatCard
            label="Pharmacy Sales"
            value={stats.pharmacySalesToday > 0 ? `₹${fmt(stats.pharmacySalesToday)}` : '₹0'}
            sub={`${stats.pharmacyAppOrders} app orders`}
            icon={Pill}
            color="bg-emerald-500"
          />
          <StatCard
            label="Lab Samples"
            value={stats.labCollected}
            sub={`${stats.labDispatched} dispatched`}
            icon={TestTube}
            color="bg-purple-500"
          />
          <StatCard
            label="Referrals"
            value={stats.referralsSentToday}
            sub={`${stats.referralsCompleted} completed`}
            icon={ArrowUpRight}
            color="bg-orange-500"
          />
          <StatCard
            label="Revenue Today"
            value={stats.revenueToday > 0 ? `₹${fmt(stats.revenueToday)}` : '₹0'}
            icon={CreditCard}
            color="bg-amber-500"
          />
          <StatCard
            label="Patients"
            value={stats.opdToday}
            sub="Total visits today"
            icon={Users}
            color="bg-teal-500"
          />
        </div>
      )}

      {/* Quick Actions */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        {[
          { href: '/patients/register', label: 'Register Patient', icon: Users, color: 'text-teal-600' },
          { href: '/opd', label: 'Open OPD', icon: Calendar, color: 'text-blue-600' },
          { href: '/clinic/pharmacy-pos', label: 'Pharmacy POS', icon: ShoppingCart, color: 'text-emerald-600' },
          { href: '/clinic/lab-collection', label: 'Lab Collection', icon: TestTube, color: 'text-purple-600' },
        ].map((item) => (
          <Link key={item.href} href={item.href}
            className="flex items-center gap-2.5 px-3.5 py-2.5 bg-white rounded-xl border border-gray-100 hover:border-gray-200 hover:shadow-sm transition-all group cursor-pointer">
            <item.icon size={16} className={item.color} />
            <span className="text-[12px] font-semibold text-gray-700 group-hover:text-gray-900">{item.label}</span>
          </Link>
        ))}
      </div>

      {/* Today's Appointments */}
      <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
        <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between">
          <h2 className="text-sm font-bold text-gray-800">Today&apos;s Appointments</h2>
          <Link href="/opd" className="text-xs text-teal-600 font-medium hover:underline cursor-pointer">View all</Link>
        </div>
        {apptLoading ? (
          <div className="p-6 text-center">
            <RefreshCw className="animate-spin text-gray-300 mx-auto" size={20} />
          </div>
        ) : appointments.length === 0 ? (
          <div className="p-6 text-center">
            <CheckCircle size={32} className="mx-auto text-gray-200 mb-2" />
            <p className="text-sm text-gray-400">No appointments scheduled today</p>
          </div>
        ) : (
          <div className="divide-y divide-gray-50">
            {appointments.slice(0, 10).map((appt) => (
              <div key={appt.id} className="px-4 py-2.5 flex items-center gap-3 hover:bg-gray-50 transition-colors">
                <span className="text-xs font-mono text-gray-400 w-12 shrink-0">
                  {appt.appointment_time?.slice(0, 5) || '--:--'}
                </span>
                <div className="flex-1 min-w-0">
                  <span className="text-sm font-medium text-gray-800">
                    {(appt.patient as Record<string, any> | undefined)?.first_name} {(appt.patient as Record<string, any> | undefined)?.last_name}
                  </span>
                  <span className="text-xs text-gray-400 ml-2 font-mono">
                    {(appt.patient as Record<string, any> | undefined)?.uhid}
                  </span>
                </div>
                <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${
                  appt.status === 'completed' ? 'bg-green-100 text-green-700' :
                  appt.status === 'checked_in' ? 'bg-blue-100 text-blue-700' :
                  appt.status === 'in_progress' ? 'bg-amber-100 text-amber-700' :
                  'bg-gray-100 text-gray-600'
                }`}>
                  {appt.status.replace('_', ' ')}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Franchise Performance (if franchise centre) */}
      {isFranchise && (
        <div className="bg-white rounded-xl border border-gray-100 p-4">
          <h2 className="text-sm font-bold text-gray-800 mb-3">Franchise Performance</h2>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-xs text-gray-500">Gross Revenue (MTD)</p>
              <p className="text-lg font-bold text-gray-900">₹{fmt(stats.revenueToday * 30)}</p>
            </div>
            <div>
              <p className="text-xs text-gray-500">Revenue Share</p>
              <p className="text-lg font-bold text-gray-900">
                ₹{fmt(stats.revenueToday * 30 * ((activeCentre as Record<string, any>)?.centre?.franchise_revenue_share_pct || 20) / 100)}
              </p>
              <p className="text-[10px] text-gray-400">
                {(activeCentre as Record<string, any>)?.centre?.franchise_revenue_share_pct || 20}% share
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function StatCard({ label, value, icon: Icon, color, sub }: {
  label: string; value: string | number; icon: any; color: string; sub?: string;
}) {
  return (
    <div className="bg-white rounded-xl border border-gray-100 p-4 hover:shadow-md transition-shadow">
      <div className="flex items-center justify-between mb-3">
        <div className={`w-9 h-9 rounded-lg flex items-center justify-center ${color}`}>
          <Icon size={17} className="text-white" />
        </div>
      </div>
      <div className="text-2xl font-bold text-gray-900 tabular-nums">{value}</div>
      <div className="text-[11px] text-gray-500 font-medium mt-0.5">{label}</div>
      {sub && <div className="text-[10px] text-gray-400 mt-1">{sub}</div>}
    </div>
  );
}
