'use client';
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useAuthStore } from '@/lib/store/auth';
import { createClient } from '@/lib/supabase/client';
import {
  AreaChart, Area, ResponsiveContainer, XAxis, YAxis,
} from 'recharts';
import {
  Activity, BedDouble, Users, CreditCard, FlaskConical, Pill,
  ScanLine, Scissors, Heart, Clock, AlertTriangle, TrendingUp,
  Maximize2, Minimize2,
} from 'lucide-react';

let _sb: any = null;
function sb() { if (typeof window === 'undefined') return null as any; if (!_sb) { try { _sb = createClient(); } catch { return null; } } return _sb; }

const INR = (n: number) => n >= 10000000 ? `₹${(n / 10000000).toFixed(2)}Cr` : n >= 100000 ? `₹${(n / 100000).toFixed(1)}L` : `₹${Math.round(n).toLocaleString('en-IN')}`;

export default function HospitalPulsePage() {
  const { activeCentreId } = useAuthStore();
  const centreId = activeCentreId || '';
  const [data, setData] = useState<any>(null);
  const [tick, setTick] = useState(0);
  const [fullscreen, setFullscreen] = useState(false);
  const [now, setNow] = useState(new Date());

  // Clock
  useEffect(() => { const t = setInterval(() => setNow(new Date()), 1000); return () => clearInterval(t); }, []);

  const load = useCallback(async () => {
    if (!centreId || !sb()) return;
    const today = new Date().toISOString().split('T')[0];
    const todayStart = today + 'T00:00:00';

    const [beds, opd, ipdActive, ipdNew, bills, lab, rad, ot, pharma, charges, admissions, recentBills] = await Promise.all([
      sb().from('hmis_beds').select('id, name, status, room:hmis_rooms!inner(name, ward:hmis_wards!inner(name, ward_type, centre_id))').eq('room.ward.centre_id', centreId).eq('is_active', true),
      sb().from('hmis_opd_visits').select('id, status, created_at').eq('centre_id', centreId).gte('created_at', todayStart),
      sb().from('hmis_admissions').select('id, department_id, patient:hmis_patients!inner(first_name, last_name)').eq('centre_id', centreId).eq('status', 'active'),
      sb().from('hmis_admissions').select('id').eq('centre_id', centreId).gte('admission_date', todayStart),
      sb().from('hmis_bills').select('net_amount, paid_amount, created_at').eq('centre_id', centreId).eq('bill_date', today).neq('status', 'cancelled'),
      sb().from('hmis_lab_orders').select('id, status, created_at').eq('centre_id', centreId).gte('created_at', todayStart),
      sb().from('hmis_radiology_orders').select('id, status').eq('centre_id', centreId).gte('created_at', todayStart),
      sb().from('hmis_ot_bookings').select('id, status, procedure_name, surgeon:hmis_staff!hmis_ot_bookings_surgeon_id_fkey(full_name), scheduled_start, actual_start, ot_room:hmis_ot_rooms(name)').eq('centre_id', centreId).eq('scheduled_date', today),
      sb().from('hmis_pharmacy_dispensing').select('id, status').eq('centre_id', centreId).gte('created_at', todayStart),
      sb().from('hmis_charge_log').select('amount, created_at').eq('centre_id', centreId).eq('service_date', today).neq('status', 'reversed'),
      sb().from('hmis_admissions').select('id, admission_date, patient:hmis_patients!inner(first_name, last_name), status').eq('centre_id', centreId).order('admission_date', { ascending: false }).limit(5),
      sb().from('hmis_bills').select('id, bill_number, net_amount, patient:hmis_patients!inner(first_name, last_name)').eq('centre_id', centreId).order('created_at', { ascending: false }).limit(5),
    ]);

    const bd = beds.data || []; const od = opd.data || []; const bl = bills.data || [];
    const ld = lab.data || []; const rd = rad.data || []; const otd = ot.data || [];
    const pd = pharma.data || []; const cd = charges.data || [];

    // Build hourly revenue for sparkline
    const hourly: Record<number, number> = {};
    bl.forEach((b: any) => { const h = new Date(b.created_at).getHours(); hourly[h] = (hourly[h] || 0) + parseFloat(b.net_amount || 0); });
    const sparkline = Array.from({ length: 24 }, (_, i) => ({ h: i, v: hourly[i] || 0 })).filter(d => d.h <= new Date().getHours());

    // Bed heatmap by ward
    const wards: Record<string, { name: string; type: string; total: number; occupied: number; available: number; beds: any[] }> = {};
    bd.forEach((b: any) => {
      const wn = b.room?.ward?.name || 'Unknown';
      if (!wards[wn]) wards[wn] = { name: wn, type: b.room?.ward?.ward_type || '', total: 0, occupied: 0, available: 0, beds: [] };
      wards[wn].total++;
      if (b.status === 'occupied') wards[wn].occupied++;
      else if (b.status === 'available') wards[wn].available++;
      wards[wn].beds.push(b);
    });

    // OPD hourly flow
    const opdHourly: Record<number, number> = {};
    od.forEach((v: any) => { const h = new Date(v.created_at).getHours(); opdHourly[h] = (opdHourly[h] || 0) + 1; });
    const opdFlow = Array.from({ length: 24 }, (_, i) => ({ h: `${i}:00`, v: opdHourly[i] || 0 })).filter(d => parseInt(d.h) <= new Date().getHours());

    // Active OT
    const activeOT = otd.filter((o: any) => o.status === 'in_progress');

    setData({
      totalBeds: bd.length, occupiedBeds: bd.filter((b: any) => b.status === 'occupied').length,
      availableBeds: bd.filter((b: any) => b.status === 'available').length,
      wards: Object.values(wards).sort((a, b) => b.total - a.total),
      opdTotal: od.length, opdWaiting: od.filter((v: any) => ['waiting', 'checked_in'].includes(v.status)).length,
      opdCompleted: od.filter((v: any) => v.status === 'completed').length,
      opdFlow,
      ipdActive: (ipdActive.data || []).length, ipdNew: (ipdNew.data || []).length,
      revenue: bl.reduce((s: number, b: any) => s + parseFloat(b.net_amount || 0), 0),
      collected: bl.reduce((s: number, b: any) => s + parseFloat(b.paid_amount || 0), 0),
      billCount: bl.length, sparkline,
      labTotal: ld.length, labPending: ld.filter((o: any) => !['completed', 'verified'].includes(o.status)).length,
      radTotal: rd.length, radPending: rd.filter((o: any) => !['reported', 'verified'].includes(o.status)).length,
      otTotal: otd.length, otActive: activeOT, otCompleted: otd.filter((o: any) => o.status === 'completed').length,
      rxTotal: pd.length, rxPending: pd.filter((p: any) => p.status === 'pending').length,
      charges: cd.reduce((s: number, c: any) => s + parseFloat(c.amount || 0), 0),
      recentAdmissions: admissions.data || [],
      recentBills: recentBills.data || [],
    });
  }, [centreId]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => { const t = setInterval(() => { load(); setTick(p => p + 1); }, 15000); return () => clearInterval(t); }, [load]);

  // Realtime
  useEffect(() => {
    if (!centreId || !sb()) return;
    const ch = sb().channel('pulse-' + centreId)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'hmis_beds', filter: `is_active=eq.true` }, load)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'hmis_bills', filter: `centre_id=eq.${centreId}` }, load)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'hmis_admissions', filter: `centre_id=eq.${centreId}` }, load)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'hmis_opd_visits', filter: `centre_id=eq.${centreId}` }, load)
      .subscribe();
    return () => sb().removeChannel(ch);
  }, [centreId, load]);

  const toggleFS = () => {
    if (!document.fullscreenElement) document.documentElement.requestFullscreen();
    else document.exitFullscreen();
    setFullscreen(!fullscreen);
  };

  if (!data) return (
    <div className="fixed inset-0 bg-[#0a0e1a] flex items-center justify-center">
      <div className="text-center"><div className="w-16 h-16 rounded-full border-4 border-teal-500 border-t-transparent animate-spin mx-auto" /><div className="text-teal-400 text-sm mt-4 font-medium">Loading Hospital Pulse...</div></div>
    </div>
  );

  const D = data;
  const occPct = D.totalBeds > 0 ? Math.round((D.occupiedBeds / D.totalBeds) * 100) : 0;
  const time = now.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false });
  const date = now.toLocaleDateString('en-IN', { weekday: 'short', day: '2-digit', month: 'short', year: 'numeric' });

  return (
    <div className="fixed inset-0 bg-[#0a0e1a] text-white overflow-hidden select-none md:ml-[240px]" style={{ fontFamily: "'DM Sans', sans-serif" }}>
      {/* ═══ HEADER ═══ */}
      <div className="h-14 flex items-center justify-between px-6 bg-gradient-to-r from-[#0a0e1a] via-[#0f1628] to-[#0a0e1a] border-b border-white/5">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-teal-500 flex items-center justify-center"><span className="text-xs font-black tracking-tight">H1</span></div>
            <div><span className="font-bold text-sm">Hospital Pulse</span><span className="text-teal-400 text-xs ml-2">LIVE</span></div>
          </div>
          <div className="flex items-center gap-2 ml-6">
            <span className="relative flex h-2 w-2"><span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-teal-400 opacity-75" /><span className="relative inline-flex rounded-full h-2 w-2 bg-teal-500" /></span>
            <span className="text-[10px] text-gray-500">Auto-refresh 15s</span>
          </div>
        </div>
        <div className="flex items-center gap-6">
          <div className="text-right"><div className="text-2xl font-mono font-bold text-teal-400 tracking-wider">{time}</div><div className="text-[10px] text-gray-500">{date}</div></div>
          <button onClick={toggleFS} className="p-2 hover:bg-white/5 rounded-lg transition-colors">{fullscreen ? <Minimize2 size={16} /> : <Maximize2 size={16} />}</button>
        </div>
      </div>

      <div className="h-[calc(100vh-56px)] p-4 grid grid-cols-12 grid-rows-6 gap-3">
        {/* ═══ REVENUE TICKER ═══ */}
        <div className="col-span-3 row-span-2 bg-gradient-to-br from-teal-900/40 to-teal-950/20 rounded-2xl border border-teal-500/20 p-4 flex flex-col">
          <div className="flex items-center gap-2 mb-1"><CreditCard size={14} className="text-teal-400" /><span className="text-[10px] text-teal-400/70 uppercase tracking-widest font-semibold">Revenue Today</span></div>
          <div className="text-3xl font-black text-teal-400 tracking-tight mt-1">{INR(D.revenue)}</div>
          <div className="flex gap-4 mt-1 text-xs"><span className="text-emerald-400">Collected {INR(D.collected)}</span><span className="text-gray-500">{D.billCount} bills</span></div>
          <div className="flex-1 mt-2 -mx-2">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={D.sparkline}><defs><linearGradient id="gPulseRev" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#14b8a6" stopOpacity={0.4} /><stop offset="100%" stopColor="#14b8a6" stopOpacity={0} /></linearGradient></defs>
                <Area type="monotone" dataKey="v" stroke="#14b8a6" strokeWidth={2} fill="url(#gPulseRev)" dot={false} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* ═══ BED OCCUPANCY GAUGE ═══ */}
        <div className="col-span-3 row-span-2 bg-[#111827]/80 rounded-2xl border border-white/5 p-4 flex flex-col items-center justify-center relative overflow-hidden">
          <div className="absolute inset-0 flex items-center justify-center opacity-10">
            <div className="w-40 h-40 rounded-full border-[12px]" style={{ borderColor: occPct > 85 ? '#ef4444' : occPct > 70 ? '#f59e0b' : '#10b981', borderTopColor: 'transparent', transform: `rotate(${occPct * 3.6}deg)` }} />
          </div>
          <BedDouble size={18} className="text-gray-500 mb-1" />
          <div className={`text-5xl font-black ${occPct > 85 ? 'text-red-400' : occPct > 70 ? 'text-amber-400' : 'text-emerald-400'}`}>{occPct}%</div>
          <div className="text-xs text-gray-500 mt-1">Bed Occupancy</div>
          <div className="flex gap-4 mt-2 text-xs">
            <span className="text-red-400">{D.occupiedBeds} used</span>
            <span className="text-emerald-400">{D.availableBeds} free</span>
            <span className="text-gray-500">{D.totalBeds} total</span>
          </div>
        </div>

        {/* ═══ OPD FLOW ═══ */}
        <div className="col-span-3 row-span-2 bg-[#111827]/80 rounded-2xl border border-white/5 p-4 flex flex-col">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2"><Users size={14} className="text-blue-400" /><span className="text-[10px] text-gray-500 uppercase tracking-widest font-semibold">OPD Flow</span></div>
            <div className="text-2xl font-black text-blue-400">{D.opdTotal}</div>
          </div>
          <div className="flex gap-3 text-xs mb-2">
            <span className="text-amber-400">{D.opdWaiting} waiting</span>
            <span className="text-emerald-400">{D.opdCompleted} done</span>
          </div>
          <div className="flex-1 -mx-2">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={D.opdFlow}><defs><linearGradient id="gPulseOPD" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#3b82f6" stopOpacity={0.3} /><stop offset="100%" stopColor="#3b82f6" stopOpacity={0} /></linearGradient></defs>
                <XAxis dataKey="h" tick={{ fontSize: 8, fill: '#4b5563' }} axisLine={false} tickLine={false} />
                <Area type="monotone" dataKey="v" stroke="#3b82f6" strokeWidth={2} fill="url(#gPulseOPD)" dot={false} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* ═══ LIVE STATS COLUMN ═══ */}
        <div className="col-span-3 row-span-2 grid grid-rows-4 gap-2">
          {[
            { icon: BedDouble, label: 'IPD Active', value: D.ipdActive, sub: `${D.ipdNew} new`, color: 'text-purple-400', bg: 'from-purple-900/30 to-purple-950/10', border: 'border-purple-500/20' },
            { icon: FlaskConical, label: 'Lab', value: D.labTotal, sub: `${D.labPending} pending`, color: 'text-cyan-400', bg: 'from-cyan-900/30 to-cyan-950/10', border: 'border-cyan-500/20' },
            { icon: ScanLine, label: 'Radiology', value: D.radTotal, sub: `${D.radPending} pending`, color: 'text-indigo-400', bg: 'from-indigo-900/30 to-indigo-950/10', border: 'border-indigo-500/20' },
            { icon: Pill, label: 'Pharmacy', value: D.rxTotal, sub: `${D.rxPending} queue`, color: D.rxPending > 10 ? 'text-red-400' : 'text-amber-400', bg: D.rxPending > 10 ? 'from-red-900/30 to-red-950/10' : 'from-amber-900/30 to-amber-950/10', border: D.rxPending > 10 ? 'border-red-500/20' : 'border-amber-500/20' },
          ].map(s => (
            <div key={s.label} className={`bg-gradient-to-r ${s.bg} rounded-xl border ${s.border} px-4 py-2 flex items-center gap-3`}>
              <s.icon size={18} className={s.color} />
              <div className="flex-1"><div className="text-[9px] text-gray-500 uppercase tracking-wider">{s.label}</div><div className={`text-xl font-black ${s.color}`}>{s.value}</div></div>
              <span className="text-[10px] text-gray-500">{s.sub}</span>
            </div>
          ))}
        </div>

        {/* ═══ BED HEATMAP ═══ */}
        <div className="col-span-6 row-span-3 bg-[#111827]/80 rounded-2xl border border-white/5 p-4 overflow-hidden">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2"><Heart size={14} className="text-pink-400" /><span className="text-xs font-bold text-gray-400">Ward Occupancy Heatmap</span></div>
            <div className="flex gap-3 text-[9px]">
              <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-emerald-500" />Available</span>
              <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-red-500" />Occupied</span>
              <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-amber-500" />Cleaning</span>
            </div>
          </div>
          <div className="space-y-2.5 overflow-y-auto max-h-[calc(100%-40px)] scrollbar-thin pr-1">
            {D.wards.map((w: any) => {
              const pct = w.total > 0 ? Math.round((w.occupied / w.total) * 100) : 0;
              return (
                <div key={w.name}>
                  <div className="flex items-center justify-between mb-1">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-semibold text-gray-300">{w.name}</span>
                      <span className="text-[9px] text-gray-600">{w.type}</span>
                    </div>
                    <span className={`text-xs font-bold ${pct > 85 ? 'text-red-400' : pct > 70 ? 'text-amber-400' : 'text-emerald-400'}`}>{pct}%</span>
                  </div>
                  <div className="flex gap-[3px] flex-wrap">
                    {w.beds.map((b: any) => (
                      <div key={b.id} title={`${b.name || 'Bed'} — ${b.status}`}
                        className={`w-4 h-4 rounded-[3px] transition-all duration-500 ${
                          b.status === 'occupied' ? 'bg-red-500/80 shadow-[0_0_6px_rgba(239,68,68,0.3)]' :
                          b.status === 'available' ? 'bg-emerald-500/60' :
                          b.status === 'housekeeping' ? 'bg-amber-500/60' : 'bg-gray-700/40'
                        } ${b.status === 'occupied' && tick % 2 === 0 ? 'scale-105' : ''}`} />
                    ))}
                  </div>
                </div>
              );
            })}
            {D.wards.length === 0 && <div className="text-center py-8 text-gray-600 text-xs">No ward data</div>}
          </div>
        </div>

        {/* ═══ ACTIVE OT ═══ */}
        <div className="col-span-3 row-span-3 bg-[#111827]/80 rounded-2xl border border-white/5 p-4">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2"><Scissors size={14} className="text-rose-400" /><span className="text-xs font-bold text-gray-400">OT Status</span></div>
            <span className="text-xs text-gray-500">{D.otTotal} today · {D.otCompleted} done</span>
          </div>
          <div className="space-y-2">
            {D.otActive.length > 0 ? D.otActive.map((o: any) => {
              const elapsed = o.actual_start ? Math.round((Date.now() - new Date(o.actual_start).getTime()) / 60000) : 0;
              return (
                <div key={o.id} className="bg-rose-500/10 border border-rose-500/20 rounded-xl p-3 relative overflow-hidden">
                  <div className="absolute top-0 right-0 w-2 h-full bg-rose-500 animate-pulse rounded-r-xl" />
                  <div className="text-xs font-bold text-rose-300 truncate">{o.procedure_name || 'Surgery'}</div>
                  <div className="text-[10px] text-gray-400 mt-0.5">Dr. {o.surgeon?.full_name?.split(' ').pop()} · {o.ot_room?.name || 'OT'}</div>
                  <div className="flex items-center gap-2 mt-1.5">
                    <Clock size={10} className="text-rose-400" />
                    <span className="text-xs font-mono text-rose-400">{Math.floor(elapsed / 60)}h {elapsed % 60}m</span>
                    <span className="text-[9px] bg-rose-500/20 text-rose-300 px-1.5 py-0.5 rounded-full">IN PROGRESS</span>
                  </div>
                </div>
              );
            }) : (
              <div className="text-center py-6 text-gray-600 text-xs">No active surgeries</div>
            )}
          </div>
          {D.otTotal > D.otActive.length + D.otCompleted && (
            <div className="mt-3 text-[10px] text-gray-500 text-center">{D.otTotal - D.otActive.length - D.otCompleted} upcoming</div>
          )}
        </div>

        {/* ═══ LIVE ACTIVITY FEED ═══ */}
        <div className="col-span-3 row-span-1 bg-[#111827]/80 rounded-2xl border border-white/5 p-3 overflow-hidden">
          <div className="text-[9px] text-gray-500 uppercase tracking-widest font-semibold mb-2">Live Feed</div>
          <div className="space-y-1.5 overflow-hidden">
            {D.recentBills.slice(0, 3).map((b: any) => (
              <div key={b.id} className="flex items-center justify-between text-[10px]">
                <span className="text-gray-400 truncate">{b.patient?.first_name} {b.patient?.last_name}</span>
                <span className="text-emerald-400 font-mono font-bold">{INR(parseFloat(b.net_amount || 0))}</span>
              </div>
            ))}
          </div>
        </div>

        {/* ═══ PATIENT FLOW PIPELINE ═══ */}
        <div className="col-span-9 row-span-1 bg-[#111827]/80 rounded-2xl border border-white/5 p-3 flex items-center gap-2">
          {[
            { label: 'Registration', value: D.opdTotal, color: '#6366f1', icon: Users },
            { label: 'Consultation', value: D.opdTotal - D.opdWaiting - D.opdCompleted, color: '#8b5cf6', icon: Activity },
            { label: 'Diagnostics', value: D.labPending + D.radPending, color: '#06b6d4', icon: FlaskConical },
            { label: 'Pharmacy', value: D.rxPending, color: '#f59e0b', icon: Pill },
            { label: 'Billing', value: D.billCount, color: '#10b981', icon: CreditCard },
            { label: 'Discharged', value: D.opdCompleted, color: '#14b8a6', icon: TrendingUp },
          ].map((step, i, arr) => (
            <React.Fragment key={step.label}>
              <div className="flex-1 text-center relative">
                <div className="flex items-center justify-center gap-1.5">
                  <step.icon size={12} style={{ color: step.color }} />
                  <span className="text-xl font-black" style={{ color: step.color }}>{step.value}</span>
                </div>
                <div className="text-[8px] text-gray-500 uppercase tracking-wider mt-0.5">{step.label}</div>
              </div>
              {i < arr.length - 1 && (
                <div className="flex items-center shrink-0">
                  <div className="w-6 h-[2px] bg-gradient-to-r" style={{ backgroundImage: `linear-gradient(to right, ${step.color}, ${arr[i + 1].color})` }} />
                  <div className="w-0 h-0 border-l-[4px] border-y-[3px] border-y-transparent" style={{ borderLeftColor: arr[i + 1].color }} />
                </div>
              )}
            </React.Fragment>
          ))}
        </div>
      </div>
    </div>
  );
}
