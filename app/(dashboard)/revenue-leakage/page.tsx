'use client';
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { RoleGuard } from '@/components/ui/shared';
import { useAuthStore } from '@/lib/store/auth';
import { createClient } from '@/lib/supabase/client';
import { AlertTriangle, IndianRupee, Search, RefreshCw, TrendingDown, BedDouble, FlaskConical, Pill, Scissors } from 'lucide-react';

let _sb: any = null;
function sb() { if (typeof window === 'undefined') return null as any; if (!_sb) { try { _sb = createClient(); } catch { return null; } } return _sb; }

const fmt = (n: number) => Math.round(n).toLocaleString('en-IN');
const INR = (n: number) => n >= 100000 ? `₹${(n / 100000).toFixed(1)}L` : `₹${fmt(n)}`;

interface Leak {
  id: string;
  type: 'unbilled_charge' | 'missing_room_charge' | 'unbilled_procedure' | 'unbilled_pharmacy' | 'unbilled_lab' | 'unpaid_bill';
  patient: string;
  uhid: string;
  description: string;
  amount: number;
  daysOld: number;
  admissionId?: string;
}

const TYPE_CONFIG: Record<string, { label: string; icon: any; color: string; badge: string }> = {
  unbilled_charge: { label: 'Unbilled Charge', icon: IndianRupee, color: 'text-red-600', badge: 'h1-badge-red' },
  missing_room_charge: { label: 'Missing Room Charge', icon: BedDouble, color: 'text-amber-600', badge: 'h1-badge-amber' },
  unbilled_procedure: { label: 'Unbilled Procedure', icon: Scissors, color: 'text-rose-600', badge: 'h1-badge-red' },
  unbilled_pharmacy: { label: 'Unbilled Pharmacy', icon: Pill, color: 'text-purple-600', badge: 'h1-badge-purple' },
  unbilled_lab: { label: 'Unbilled Lab', icon: FlaskConical, color: 'text-cyan-600', badge: 'h1-badge-blue' },
  unpaid_bill: { label: 'Unpaid Bill', icon: IndianRupee, color: 'text-red-600', badge: 'h1-badge-red' },
};

function LeakageInner() {
  const { activeCentreId } = useAuthStore();
  const centreId = activeCentreId || '';
  const [leaks, setLeaks] = useState<Leak[]>([]);
  const [loading, setLoading] = useState(false);
  const [lastScanned, setLastScanned] = useState<string | null>(null);
  const [typeFilter, setTypeFilter] = useState('all');

  const scan = useCallback(async () => {
    if (!centreId || !sb()) return;
    setLoading(true);
    const found: Leak[] = [];
    const today = new Date();
    const todayStr = today.toISOString().split('T')[0];

    try {
      // 1. Charges without bills: charges in hmis_charge_log that have no corresponding bill_item
      const { data: unbilledCharges } = await sb().from('hmis_charge_log')
        .select('id, amount, category, service_date, patient:hmis_patients!inner(first_name, last_name, uhid), bill_id')
        .eq('centre_id', centreId).is('bill_id', null).neq('status', 'reversed')
        .gte('service_date', new Date(Date.now() - 30 * 86400000).toISOString().split('T')[0])
        .order('service_date', { ascending: false }).limit(100);

      (unbilledCharges || []).forEach((c: any) => {
        const days = Math.floor((today.getTime() - new Date(c.service_date + 'T12:00:00').getTime()) / 86400000);
        found.push({
          id: `ch-${c.id}`, type: 'unbilled_charge', patient: `${c.patient?.first_name} ${c.patient?.last_name}`,
          uhid: c.patient?.uhid || '', description: `${c.category || 'Service'} charge ₹${fmt(c.amount)} on ${c.service_date}`,
          amount: parseFloat(c.amount || 0), daysOld: days,
        });
      });

      // 2. Active admissions without today's room charge
      const { data: activeAdmissions } = await sb().from('hmis_admissions')
        .select('id, admission_date, patient:hmis_patients!inner(first_name, last_name, uhid), bed:hmis_beds(name, room:hmis_rooms(name, ward:hmis_wards(name)))')
        .eq('centre_id', centreId).eq('status', 'active');

      for (const adm of (activeAdmissions || [])) {
        const { count } = await sb().from('hmis_charge_log')
          .select('id', { count: 'exact', head: true })
          .eq('admission_id', adm.id).eq('category', 'room')
          .eq('service_date', todayStr);
        if (count === 0) {
          const days = Math.floor((today.getTime() - new Date(adm.admission_date).getTime()) / 86400000);
          found.push({
            id: `room-${adm.id}`, type: 'missing_room_charge', patient: `${adm.patient?.first_name} ${adm.patient?.last_name}`,
            uhid: adm.patient?.uhid || '', description: `No room charge today. Bed: ${adm.bed?.name || '—'}, Ward: ${adm.bed?.room?.ward?.name || '—'}. Admitted ${days}d ago.`,
            amount: 0, daysOld: 0, admissionId: adm.id,
          });
        }
      }

      // 3. Completed lab orders without charges
      const { data: unbilledLabs } = await sb().from('hmis_lab_orders')
        .select('id, test_name, created_at, patient:hmis_patients!inner(first_name, last_name, uhid)')
        .eq('centre_id', centreId).eq('status', 'completed').eq('billing_done', false)
        .gte('created_at', new Date(Date.now() - 7 * 86400000).toISOString())
        .limit(50);

      (unbilledLabs || []).forEach((l: any) => {
        const days = Math.floor((today.getTime() - new Date(l.created_at).getTime()) / 86400000);
        found.push({
          id: `lab-${l.id}`, type: 'unbilled_lab', patient: `${l.patient?.first_name} ${l.patient?.last_name}`,
          uhid: l.patient?.uhid || '', description: `Lab "${l.test_name}" completed but not billed`,
          amount: 0, daysOld: days,
        });
      });

      // 4. Dispensed pharmacy without charges
      const { data: unbilledRx } = await sb().from('hmis_pharmacy_dispensing')
        .select('id, created_at, patient:hmis_patients!inner(first_name, last_name, uhid)')
        .eq('centre_id', centreId).eq('status', 'dispensed').eq('billing_done', false)
        .gte('created_at', new Date(Date.now() - 7 * 86400000).toISOString())
        .limit(50);

      (unbilledRx || []).forEach((r: any) => {
        const days = Math.floor((today.getTime() - new Date(r.created_at).getTime()) / 86400000);
        found.push({
          id: `rx-${r.id}`, type: 'unbilled_pharmacy', patient: `${r.patient?.first_name} ${r.patient?.last_name}`,
          uhid: r.patient?.uhid || '', description: `Medication dispensed but not billed`,
          amount: 0, daysOld: days,
        });
      });

      // 5. Old unpaid bills > ₹10,000
      const { data: unpaidBills } = await sb().from('hmis_bills')
        .select('id, bill_number, net_amount, paid_amount, balance_amount, bill_date, patient:hmis_patients!inner(first_name, last_name, uhid)')
        .eq('centre_id', centreId).neq('status', 'cancelled').neq('status', 'paid')
        .gt('balance_amount', 10000)
        .order('bill_date', { ascending: true }).limit(50);

      (unpaidBills || []).forEach((b: any) => {
        const days = Math.floor((today.getTime() - new Date(b.bill_date + 'T12:00:00').getTime()) / 86400000);
        if (days > 3) {
          found.push({
            id: `bill-${b.id}`, type: 'unpaid_bill', patient: `${b.patient?.first_name} ${b.patient?.last_name}`,
            uhid: b.patient?.uhid || '', description: `Bill ${b.bill_number}: ₹${fmt(b.balance_amount)} unpaid for ${days} days`,
            amount: parseFloat(b.balance_amount || 0), daysOld: days,
          });
        }
      });
    } catch (e) { console.error('Leakage scan error:', e); }

    found.sort((a, b) => b.amount - a.amount || b.daysOld - a.daysOld);
    setLeaks(found);
    setLastScanned(new Date().toISOString());
    setLoading(false);
  }, [centreId]);

  useEffect(() => { scan(); }, [scan]);

  const filtered = typeFilter === 'all' ? leaks : leaks.filter(l => l.type === typeFilter);
  const totalLeakage = leaks.reduce((s, l) => s + l.amount, 0);
  const byType = useMemo(() => {
    const groups: Record<string, { count: number; amount: number }> = {};
    leaks.forEach(l => {
      if (!groups[l.type]) groups[l.type] = { count: 0, amount: 0 };
      groups[l.type].count++;
      groups[l.type].amount += l.amount;
    });
    return groups;
  }, [leaks]);

  return (
    <div className="max-w-[1200px] mx-auto space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold tracking-tight">Revenue Leakage Detector</h1>
          <p className="text-xs text-gray-400">{lastScanned ? `Last scan: ${new Date(lastScanned).toLocaleTimeString('en-IN')}` : 'Scanning...'}</p>
        </div>
        <button onClick={scan} disabled={loading} className="flex items-center gap-1.5 px-4 py-2.5 bg-teal-600 text-white text-sm rounded-xl font-semibold hover:bg-teal-700 disabled:opacity-50">
          <RefreshCw size={14} className={loading ? 'animate-spin' : ''} /> {loading ? 'Scanning...' : 'Re-scan'}
        </button>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-3 gap-3">
        <div className={`rounded-2xl border-2 p-5 text-center ${totalLeakage > 0 ? 'border-red-200 bg-red-50' : 'border-emerald-200 bg-emerald-50'}`}>
          <TrendingDown size={24} className={`mx-auto mb-1 ${totalLeakage > 0 ? 'text-red-500' : 'text-emerald-500'}`} />
          <div className={`text-3xl font-black ${totalLeakage > 0 ? 'text-red-600' : 'text-emerald-600'}`}>{totalLeakage > 0 ? `₹${INR(totalLeakage)}` : '₹0'}</div>
          <div className="text-xs text-gray-500 mt-1">Estimated Leakage</div>
        </div>
        <div className="bg-white rounded-2xl border p-5 text-center">
          <div className="text-3xl font-black text-amber-700">{leaks.length}</div>
          <div className="text-xs text-gray-500 mt-1">Issues Found</div>
        </div>
        <div className="bg-white rounded-2xl border p-5">
          <div className="text-xs font-bold text-gray-700 mb-2">By Category</div>
          <div className="space-y-1.5">{Object.entries(byType).map(([type, data]) => {
            const tc = TYPE_CONFIG[type];
            return (
              <div key={type} className="flex items-center justify-between">
                <span className="text-[10px] text-gray-600">{tc?.label || type}</span>
                <div className="flex items-center gap-2">
                  <span className="text-[10px] font-bold">{data.count}</span>
                  {data.amount > 0 && <span className="text-[10px] text-red-600 font-bold">₹{INR(data.amount)}</span>}
                </div>
              </div>
            );
          })}</div>
        </div>
      </div>

      {/* Filter */}
      <div className="flex gap-1 flex-wrap">
        <button onClick={() => setTypeFilter('all')} className={`px-2.5 py-1.5 text-[10px] font-medium rounded-lg ${typeFilter === 'all' ? 'bg-teal-50 text-teal-700 border border-teal-200' : 'bg-gray-50 text-gray-500'}`}>All ({leaks.length})</button>
        {Object.entries(byType).map(([type, data]) => {
          const tc = TYPE_CONFIG[type];
          return <button key={type} onClick={() => setTypeFilter(type)} className={`px-2.5 py-1.5 text-[10px] font-medium rounded-lg ${typeFilter === type ? 'bg-teal-50 text-teal-700 border border-teal-200' : 'bg-gray-50 text-gray-500'}`}>{tc?.label || type} ({data.count})</button>;
        })}
      </div>

      {/* Leaks table */}
      <div className="bg-white rounded-2xl border overflow-hidden">
        <table className="h1-table">
          <thead><tr><th>Type</th><th>Patient</th><th>UHID</th><th>Issue</th><th className="text-right">Amount</th><th>Age</th></tr></thead>
          <tbody>
            {filtered.map(l => {
              const tc = TYPE_CONFIG[l.type];
              const Icon = tc?.icon || AlertTriangle;
              return (
                <tr key={l.id} className={l.amount > 50000 ? 'bg-red-50/30' : ''}>
                  <td><div className="flex items-center gap-1.5"><Icon size={12} className={tc?.color || 'text-gray-500'} /><span className={`h1-badge ${tc?.badge || 'h1-badge-gray'} text-[8px]`}>{tc?.label || l.type}</span></div></td>
                  <td className="font-semibold">{l.patient}</td>
                  <td className="text-[10px] text-gray-500">{l.uhid}</td>
                  <td className="text-[11px] text-gray-600 max-w-[300px]">{l.description}</td>
                  <td className="text-right font-bold text-red-600">{l.amount > 0 ? `₹${fmt(l.amount)}` : '—'}</td>
                  <td className={`text-[11px] ${l.daysOld > 7 ? 'text-red-600 font-bold' : 'text-gray-500'}`}>{l.daysOld}d</td>
                </tr>
              );
            })}
            {filtered.length === 0 && <tr><td colSpan={6} className="text-center py-12 text-emerald-600 font-medium">No leakage detected — all services are billed</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default function LeakagePage() { return <RoleGuard module="billing"><LeakageInner /></RoleGuard>; }
