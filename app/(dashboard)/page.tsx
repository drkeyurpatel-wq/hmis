'use client';
import React, { useState, useEffect, useCallback } from 'react';
import { useAuthStore } from '@/lib/store/auth';
import { createClient } from '@/lib/supabase/client';
import Link from 'next/link';

let _sb: any = null;
function sb() { if (typeof window === 'undefined') return null as any; if (!_sb) { try { _sb = createClient(); } catch { return null; } } return _sb; }

const fmt = (n: number) => n >= 10000000 ? '₹' + (n / 10000000).toFixed(2) + ' Cr' : n >= 100000 ? '₹' + (n / 100000).toFixed(2) + ' L' : '₹' + Math.round(n).toLocaleString('en-IN');

export default function DashboardPage() {
  const { staff, activeCentreId } = useAuthStore();
  const centreId = activeCentreId || '';
  const [stats, setStats] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const today = new Date().toISOString().split('T')[0];

  const load = useCallback(async () => {
    if (!centreId || !sb()) { setLoading(false); return; }
    setLoading(true);
    const todayStart = today + 'T00:00:00';
    const todayEnd = today + 'T23:59:59';

    const [opd, ipdActive, ipdToday, beds, bills, labOrders, radOrders, charges, pharmacy, recentVisits, recentBills] = await Promise.all([
      // OPD
      sb().from('hmis_opd_visits').select('id, status', { count: 'exact', head: false })
        .eq('centre_id', centreId).gte('created_at', todayStart).lte('created_at', todayEnd),
      // IPD active
      sb().from('hmis_admissions').select('id', { count: 'exact', head: true })
        .eq('centre_id', centreId).eq('status', 'active'),
      // IPD today admissions
      sb().from('hmis_admissions').select('id', { count: 'exact', head: true })
        .eq('centre_id', centreId).gte('admission_date', todayStart).lte('admission_date', todayEnd),
      // Beds
      sb().from('hmis_beds').select('id, status, room:hmis_rooms!inner(ward:hmis_wards!inner(centre_id))')
        .eq('room.ward.centre_id', centreId).eq('is_active', true),
      // Bills today
      sb().from('hmis_bills').select('id, net_amount, paid_amount, balance_amount, status')
        .eq('centre_id', centreId).eq('bill_date', today).neq('status', 'cancelled'),
      // Lab orders today
      sb().from('hmis_lab_orders').select('id, status', { count: 'exact', head: false })
        .eq('centre_id', centreId).gte('created_at', todayStart).lte('created_at', todayEnd),
      // Radiology orders today
      sb().from('hmis_radiology_orders').select('id, status', { count: 'exact', head: false })
        .eq('centre_id', centreId).gte('created_at', todayStart).lte('created_at', todayEnd),
      // Charges today
      sb().from('hmis_charge_log').select('id, amount, status')
        .eq('centre_id', centreId).eq('service_date', today).neq('status', 'reversed'),
      // Pharmacy pending
      sb().from('hmis_prescriptions').select('id', { count: 'exact', head: true })
        .eq('centre_id', centreId).eq('status', 'prescribed'),
      // Recent OPD
      sb().from('hmis_opd_visits').select('id, status, created_at, patient:hmis_patients!inner(first_name, last_name, uhid), doctor:hmis_staff!inner(full_name)')
        .eq('centre_id', centreId).gte('created_at', todayStart).order('created_at', { ascending: false }).limit(8),
      // Recent bills
      sb().from('hmis_bills').select('id, bill_number, net_amount, status, patient:hmis_patients!inner(first_name, last_name)')
        .eq('centre_id', centreId).order('created_at', { ascending: false }).limit(6),
    ]);

    const opdData = opd.data || [];
    const billsData = bills.data || [];
    const labData = labOrders.data || [];
    const radData = radOrders.data || [];
    const chargeData = charges.data || [];
    const bedsData = beds.data || [];

    setStats({
      // OPD
      opdTotal: opdData.length,
      opdWaiting: opdData.filter((v: any) => v.status === 'waiting' || v.status === 'checked_in').length,
      opdCompleted: opdData.filter((v: any) => v.status === 'completed').length,
      // IPD
      ipdActive: ipdActive.count || 0,
      ipdNewToday: ipdToday.count || 0,
      // Beds
      totalBeds: bedsData.length,
      occupiedBeds: bedsData.filter((b: any) => b.status === 'occupied').length,
      availableBeds: bedsData.filter((b: any) => b.status === 'available').length,
      occupancy: bedsData.length > 0 ? Math.round(bedsData.filter((b: any) => b.status === 'occupied').length / bedsData.length * 100) : 0,
      // Revenue
      revenueToday: billsData.reduce((s: number, b: any) => s + parseFloat(b.net_amount || 0), 0),
      collectedToday: billsData.reduce((s: number, b: any) => s + parseFloat(b.paid_amount || 0), 0),
      outstandingToday: billsData.reduce((s: number, b: any) => s + parseFloat(b.balance_amount || 0), 0),
      billsCount: billsData.length,
      // Lab
      labTotal: labData.length,
      labPending: labData.filter((o: any) => ['ordered', 'sample_collected', 'processing'].includes(o.status)).length,
      labCompleted: labData.filter((o: any) => o.status === 'completed').length,
      // Radiology
      radTotal: radData.length,
      radPending: radData.filter((o: any) => !['reported', 'verified'].includes(o.status)).length,
      // Charges
      chargesTotal: chargeData.reduce((s: number, c: any) => s + parseFloat(c.amount || 0), 0),
      chargesCaptured: chargeData.filter((c: any) => c.status === 'captured').length,
      chargesPosted: chargeData.filter((c: any) => c.status === 'posted').length,
      // Pharmacy
      rxPending: pharmacy.count || 0,
      // Lists
      recentVisits: recentVisits.data || [],
      recentBills: recentBills.data || [],
    });
    setLoading(false);
  }, [centreId, today]);

  useEffect(() => { load(); }, [load]);

  // Auto-refresh every 60 seconds + real-time on bill/admission changes
  useEffect(() => {
    const interval = setInterval(load, 60000);
    if (!centreId || !sb()) return () => clearInterval(interval);
    const ch = sb().channel('dashboard-live-' + centreId)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'hmis_bills', filter: `centre_id=eq.${centreId}` }, () => load())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'hmis_admissions', filter: `centre_id=eq.${centreId}` }, () => load())
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'hmis_opd_visits', filter: `centre_id=eq.${centreId}` }, () => load())
      .subscribe();
    return () => { clearInterval(interval); sb().removeChannel(ch); };
  }, [load, centreId]);

  if (loading) return <div className="max-w-7xl mx-auto space-y-4 animate-pulse"><div className="h-10 bg-gray-200 rounded-xl" /><div className="grid grid-cols-4 gap-3">{[1,2,3,4].map(i => <div key={i} className="h-24 bg-gray-200 rounded-xl" />)}</div><div className="h-64 bg-gray-200 rounded-xl" /></div>;
  if (!stats) return <div className="max-w-7xl mx-auto text-center py-12 text-gray-400">Select a centre to view dashboard</div>;

  const KPI = ({ label, value, sub, color, href }: { label: string; value: string | number; sub?: string; color?: string; href?: string }) => {
    const inner = <div className="bg-white rounded-xl border p-3 hover:shadow-sm transition-shadow"><div className="text-[9px] text-gray-500 uppercase">{label}</div><div className={`text-xl font-bold ${color || ''}`}>{value}</div>{sub && <div className="text-[10px] text-gray-400">{sub}</div>}</div>;
    return href ? <Link href={href}>{inner}</Link> : inner;
  };

  return (
    <div className="max-w-7xl mx-auto space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div><h1 className="text-xl font-bold text-gray-900">Health1 Dashboard</h1><p className="text-xs text-gray-500">{new Date().toLocaleDateString('en-IN', { weekday: 'long', day: '2-digit', month: 'long', year: 'numeric' })} — {staff?.full_name || 'Welcome'}</p></div>
        <button onClick={load} className="px-3 py-1.5 bg-gray-100 text-xs rounded-lg hover:bg-gray-200">Refresh</button>
      </div>

      {/* Row 1: Revenue */}
      <div className="grid grid-cols-5 gap-2">
        <KPI label="Revenue Today" value={fmt(stats.revenueToday)} color="text-blue-700" href="/billing" />
        <KPI label="Collected" value={fmt(stats.collectedToday)} color="text-green-700" href="/billing" />
        <KPI label="Outstanding" value={fmt(stats.outstandingToday)} color={stats.outstandingToday > 0 ? 'text-red-700' : 'text-green-700'} href="/billing" />
        <KPI label="Bills" value={stats.billsCount} href="/billing" />
        <KPI label="Charges Captured" value={fmt(stats.chargesTotal)} sub={`${stats.chargesCaptured} pending, ${stats.chargesPosted} posted`} href="/billing" />
      </div>

      {/* Row 2: Clinical operations */}
      <div className="grid grid-cols-6 gap-2">
        <KPI label="OPD Today" value={stats.opdTotal} sub={`${stats.opdWaiting} waiting`} color="text-blue-700" href="/opd" />
        <KPI label="OPD Completed" value={stats.opdCompleted} color="text-green-700" href="/opd" />
        <KPI label="IPD Active" value={stats.ipdActive} sub={`${stats.ipdNewToday} new today`} color="text-purple-700" href="/ipd" />
        <KPI label="Bed Occupancy" value={stats.occupancy + '%'} sub={`${stats.occupiedBeds}/${stats.totalBeds} beds`} color={stats.occupancy > 85 ? 'text-red-700' : 'text-blue-700'} href="/bed-management" />
        <KPI label="Available Beds" value={stats.availableBeds} color="text-green-700" href="/bed-management" />
        <KPI label="Rx Pending" value={stats.rxPending} color={stats.rxPending > 10 ? 'text-red-700' : 'text-amber-700'} href="/pharmacy" />
      </div>

      {/* Row 3: Diagnostics */}
      <div className="grid grid-cols-4 gap-2">
        <KPI label="Lab Orders Today" value={stats.labTotal} sub={`${stats.labPending} pending`} href="/lab" />
        <KPI label="Lab Completed" value={stats.labCompleted} color="text-green-700" href="/lab" />
        <KPI label="Radiology Orders" value={stats.radTotal} sub={`${stats.radPending} pending`} href="/radiology" />
        <div className="bg-white rounded-xl border p-3">
          <div className="text-[9px] text-gray-500 uppercase">Quick Links</div>
          <div className="flex flex-wrap gap-1 mt-1">
            <Link href="/emr-v2" className="px-2 py-1 bg-blue-50 text-blue-700 text-[10px] rounded hover:bg-blue-100">New Encounter</Link>
            <Link href="/billing" className="px-2 py-1 bg-green-50 text-green-700 text-[10px] rounded hover:bg-green-100">New Bill</Link>
            <Link href="/patients" className="px-2 py-1 bg-purple-50 text-purple-700 text-[10px] rounded hover:bg-purple-100">Register Patient</Link>
            <Link href="/reports" className="px-2 py-1 bg-gray-50 text-gray-700 text-[10px] rounded hover:bg-gray-100">Reports</Link>
          </div>
        </div>
      </div>

      {/* Row 4: Tables */}
      <div className="grid grid-cols-2 gap-4">
        {/* Recent OPD */}
        <div className="bg-white rounded-xl border overflow-hidden">
          <div className="px-4 py-2.5 bg-gray-50 border-b flex justify-between items-center">
            <h3 className="text-xs font-bold text-gray-700">Today's OPD ({stats.opdTotal})</h3>
            <Link href="/opd" className="text-[10px] text-blue-600">View all →</Link>
          </div>
          {stats.recentVisits.length === 0 ? <div className="text-center py-6 text-gray-400 text-xs">No OPD visits today</div> :
          <table className="w-full text-xs"><tbody>{stats.recentVisits.map((v: any) => (
            <tr key={v.id} className="border-b hover:bg-gray-50">
              <td className="px-3 py-2">
                <div className="font-medium">{v.patient?.first_name} {v.patient?.last_name}</div>
                <div className="text-[10px] text-gray-400">{v.patient?.uhid}</div>
              </td>
              <td className="px-3 py-2 text-gray-500 text-[10px]">Dr. {v.doctor?.full_name}</td>
              <td className="px-3 py-2 text-center"><span className={`px-1.5 py-0.5 rounded text-[9px] ${
                v.status === 'completed' ? 'bg-green-100 text-green-700' :
                v.status === 'waiting' || v.status === 'checked_in' ? 'bg-amber-100 text-amber-700' :
                v.status === 'in_consultation' ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-500'
              }`}>{v.status?.replace('_', ' ')}</span></td>
            </tr>
          ))}</tbody></table>}
        </div>

        {/* Recent Bills */}
        <div className="bg-white rounded-xl border overflow-hidden">
          <div className="px-4 py-2.5 bg-gray-50 border-b flex justify-between items-center">
            <h3 className="text-xs font-bold text-gray-700">Recent Bills</h3>
            <Link href="/billing" className="text-[10px] text-blue-600">View all →</Link>
          </div>
          {stats.recentBills.length === 0 ? <div className="text-center py-6 text-gray-400 text-xs">No recent bills</div> :
          <table className="w-full text-xs"><tbody>{stats.recentBills.map((b: any) => (
            <tr key={b.id} className="border-b hover:bg-gray-50">
              <td className="px-3 py-2"><span className="font-mono text-[10px]">{b.bill_number}</span></td>
              <td className="px-3 py-2">{b.patient?.first_name} {b.patient?.last_name}</td>
              <td className="px-3 py-2 text-right font-bold">{fmt(parseFloat(b.net_amount || 0))}</td>
              <td className="px-3 py-2 text-center"><span className={`px-1.5 py-0.5 rounded text-[9px] ${b.status === 'paid' ? 'bg-green-100 text-green-700' : b.status === 'final' ? 'bg-blue-100 text-blue-700' : 'bg-amber-100 text-amber-700'}`}>{b.status}</span></td>
            </tr>
          ))}</tbody></table>}
        </div>
      </div>
    </div>
  );
}
