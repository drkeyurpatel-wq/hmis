'use client';
import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useAuthStore } from '@/lib/store/auth';
import { sb } from '@/lib/supabase/browser';
import { AreaChart, Area, ResponsiveContainer } from 'recharts';
import { Maximize2, Minimize2 } from 'lucide-react';

const INR = (n: number) => n >= 10000000 ? `${(n / 10000000).toFixed(2)} Cr` : n >= 100000 ? `${(n / 100000).toFixed(1)}L` : Math.round(n).toLocaleString('en-IN');

// ═══ ANIMATED COUNTER ═══
function AnimCounter({ value, prefix = '', suffix = '', duration = 1200 }: { value: number; prefix?: string; suffix?: string; duration?: number }) {
  const [display, setDisplay] = useState(0);
  const prev = useRef(0);
  useEffect(() => {
    const start = prev.current;
    const diff = value - start;
    if (diff === 0) return;
    const startTime = Date.now();
    const tick = () => {
      const elapsed = Date.now() - startTime;
      const progress = Math.min(elapsed / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3); // ease-out cubic
      setDisplay(Math.round(start + diff * eased));
      if (progress < 1) requestAnimationFrame(tick);
      else prev.current = value;
    };
    requestAnimationFrame(tick);
  }, [value, duration]);
  return <>{prefix}{display.toLocaleString('en-IN')}{suffix}</>;
}

// ═══ CIRCULAR GAUGE ═══
function CircularGauge({ value, max, label, sublabel, color, size = 160, thickness = 10 }: { value: number; max: number; label: string; sublabel?: string; color: string; size?: number; thickness?: number }) {
  const pct = max > 0 ? Math.min(100, (value / max) * 100) : 0;
  const r = (size - thickness) / 2;
  const circumference = 2 * Math.PI * r;
  const offset = circumference - (pct / 100) * circumference;
  const center = size / 2;

  return (
    <div className="flex flex-col items-center">
      <svg width={size} height={size} className="transform -rotate-90">
        <circle cx={center} cy={center} r={r} fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth={thickness} />
        <circle cx={center} cy={center} r={r} fill="none" stroke={color} strokeWidth={thickness}
          strokeDasharray={circumference} strokeDashoffset={offset} strokeLinecap="round"
          className="transition-all duration-1000 ease-out"
          style={{ filter: `drop-shadow(0 0 8px ${color}50)` }} />
      </svg>
      <div className="absolute flex flex-col items-center justify-center" style={{ width: size, height: size }}>
        <div className="text-3xl font-black" style={{ color }}>{Math.round(pct)}%</div>
        <div className="text-[9px] text-gray-500 uppercase tracking-widest mt-0.5">{label}</div>
      </div>
      {sublabel && <div className="text-[10px] text-gray-500 mt-2">{sublabel}</div>}
    </div>
  );
}

// ═══ BED DOT ═══
function BedDot({ status, name, pulse }: { status: string; name?: string; pulse: boolean }) {
  const color = status === 'occupied' ? '#ef4444' : status === 'available' ? '#10b981' : status === 'housekeeping' ? '#f59e0b' : '#374151';
  const glow = status === 'occupied' ? 'rgba(239,68,68,0.4)' : status === 'available' ? 'rgba(16,185,129,0.2)' : 'none';
  return (
    <div className="relative group" title={`${name || 'Bed'} — ${status}`}>
      <div className="w-[18px] h-[18px] rounded-[4px] transition-all duration-700" 
        style={{ backgroundColor: color, boxShadow: `0 0 ${pulse && status === 'occupied' ? '10px' : '4px'} ${glow}`, transform: pulse && status === 'occupied' ? 'scale(1.15)' : 'scale(1)' }} />
      <div className="absolute -bottom-5 left-1/2 -translate-x-1/2 bg-gray-900 text-white text-[7px] px-1.5 py-0.5 rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap z-10 pointer-events-none">{name || 'Bed'}</div>
    </div>
  );
}

// ═══ FLOW PARTICLE ═══
function FlowParticle({ color, delay }: { color: string; delay: number }) {
  return <div className="absolute w-2 h-2 rounded-full animate-flow-particle" style={{ backgroundColor: color, animationDelay: `${delay}s`, filter: `drop-shadow(0 0 4px ${color})` }} />;
}

// ═══ MAIN ═══
export default function HospitalPulsePage() {
  const { activeCentreId } = useAuthStore();
  const centreId = activeCentreId || '';
  const [data, setData] = useState<any>(null);
  const [tick, setTick] = useState(0);
  const [now, setNow] = useState(new Date());
  const [fullscreen, setFullscreen] = useState(false);

  useEffect(() => { const t = setInterval(() => { setNow(new Date()); setTick(p => p + 1); }, 1000); return () => clearInterval(t); }, []);

  const load = useCallback(async () => {
    if (!centreId || !sb()) return;
    const today = new Date().toISOString().split('T')[0];
    const ts = today + 'T00:00:00';

    const [beds, opd, ipdActive, bills, lab, rad, ot, pharma, charges, discharges, er] = await Promise.all([
      sb()!.from('hmis_beds').select('id, name, status, room:hmis_rooms!inner(name, floor, ward:hmis_wards!inner(name, ward_type, centre_id))').eq('room.ward.centre_id', centreId).eq('is_active', true),
      sb()!.from('hmis_opd_visits').select('id, status, created_at').eq('centre_id', centreId).gte('created_at', ts),
      sb()!.from('hmis_admissions').select('id').eq('centre_id', centreId).eq('status', 'active'),
      sb()!.from('hmis_bills').select('net_amount, paid_amount, created_at, payor_type').eq('centre_id', centreId).eq('bill_date', today).neq('status', 'cancelled'),
      sb()!.from('hmis_lab_orders').select('id, status').eq('centre_id', centreId).gte('created_at', ts),
      sb()!.from('hmis_radiology_orders').select('id, status').eq('centre_id', centreId).gte('created_at', ts),
      sb()!.from('hmis_ot_bookings').select('id, status, procedure_name, estimated_duration_min, actual_start, surgeon:hmis_staff!hmis_ot_bookings_surgeon_id_fkey(full_name), ot_room:hmis_ot_rooms(name)').eq('centre_id', centreId).eq('scheduled_date', today),
      sb()!.from('hmis_pharmacy_dispensing').select('id, status').eq('centre_id', centreId).gte('created_at', ts),
      sb()!.from('hmis_charge_log').select('amount').eq('centre_id', centreId).eq('service_date', today).neq('status', 'reversed'),
      sb()!.from('hmis_admissions').select('id').eq('centre_id', centreId).eq('status', 'discharged').gte('discharge_date', ts),
      sb()!.from('hmis_opd_visits').select('id').eq('centre_id', centreId).gte('created_at', ts).eq('visit_type', 'emergency'),
    ]);

    const bd = beds.data || []; const od = opd.data || []; const bl = bills.data || [];
    const ld = lab.data || []; const rd = rad.data || []; const otd = ot.data || [];
    const pd = pharma.data || []; const cd = charges.data || [];

    // Ward grouping
    const wards: Record<string, { name: string; type: string; beds: any[] }> = {};
    bd.forEach((b: any) => {
      const wn = b.room?.ward?.name || 'Unknown';
      if (!wards[wn]) wards[wn] = { name: wn, type: b.room?.ward?.ward_type || 'general', beds: [] };
      wards[wn].beds.push(b);
    });

    // Hourly revenue
    const hourly: number[] = new Array(24).fill(0);
    bl.forEach((b: any) => { const h = new Date(b.created_at).getHours(); hourly[h] += parseFloat(b.net_amount || 0); });
    const spark = hourly.slice(0, new Date().getHours() + 1).map((v, i) => ({ h: i, v }));

    // Payor split
    const payorSplit: Record<string, number> = {};
    bl.forEach((b: any) => { const p = b.payor_type || 'self'; payorSplit[p] = (payorSplit[p] || 0) + parseFloat(b.net_amount || 0); });

    setData({
      totalBeds: bd.length, occupied: bd.filter((b: any) => b.status === 'occupied').length,
      available: bd.filter((b: any) => b.status === 'available').length,
      hk: bd.filter((b: any) => b.status === 'housekeeping').length,
      wards: Object.values(wards).sort((a, b) => b.beds.length - a.beds.length),
      opd: od.length, opdWaiting: od.filter((v: any) => ['waiting', 'checked_in'].includes(v.status)).length,
      opdInConsult: od.filter((v: any) => v.status === 'in_consultation').length,
      opdDone: od.filter((v: any) => v.status === 'completed').length,
      ipd: (ipdActive.data || []).length,
      revenue: bl.reduce((s: number, b: any) => s + parseFloat(b.net_amount || 0), 0),
      collected: bl.reduce((s: number, b: any) => s + parseFloat(b.paid_amount || 0), 0),
      billCount: bl.length, spark, payorSplit,
      lab: ld.length, labPending: ld.filter((o: any) => !['completed', 'verified'].includes(o.status)).length,
      rad: rd.length, radPending: rd.filter((o: any) => !['reported', 'verified'].includes(o.status)).length,
      otSurgeries: otd, otActive: otd.filter((o: any) => o.status === 'in_progress'),
      otDone: otd.filter((o: any) => o.status === 'completed').length,
      rx: pd.length, rxPending: pd.filter((p: any) => p.status === 'pending').length,
      charges: cd.reduce((s: number, c: any) => s + parseFloat(c.amount || 0), 0),
      discharged: (discharges.data || []).length,
      er: (er.data || []).length,
    });
  }, [centreId]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => { const t = setInterval(load, 12000); return () => clearInterval(t); }, [load]);
  useEffect(() => {
    if (!centreId || !sb()) return;
    const ch = sb()!.channel('pulse-v2-' + centreId)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'hmis_beds' }, load)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'hmis_bills', filter: `centre_id=eq.${centreId}` }, load)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'hmis_admissions', filter: `centre_id=eq.${centreId}` }, load)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'hmis_opd_visits', filter: `centre_id=eq.${centreId}` }, load)
      .subscribe();
    return () => { sb()!.removeChannel(ch); };
  }, [centreId, load]);

  const toggleFS = () => {
    if (!document.fullscreenElement) document.documentElement.requestFullscreen();
    else document.exitFullscreen();
    setFullscreen(!fullscreen);
  };

  if (!data) return (
    <div className="fixed inset-0 bg-[#060912] flex items-center justify-center md:ml-[240px]">
      <div className="text-center">
        <div className="relative w-24 h-24 mx-auto mb-6">
          <div className="absolute inset-0 rounded-full border-2 border-teal-500/20" />
          <div className="absolute inset-0 rounded-full border-2 border-teal-500 border-t-transparent animate-spin" />
          <div className="absolute inset-3 rounded-full border-2 border-cyan-400 border-b-transparent animate-spin" style={{ animationDirection: 'reverse', animationDuration: '1.5s' }} />
        </div>
        <div className="text-teal-400 text-sm font-semibold tracking-wider uppercase">Initializing Hospital Pulse</div>
      </div>
    </div>
  );

  const D = data;
  const occPct = D.totalBeds > 0 ? Math.round((D.occupied / D.totalBeds) * 100) : 0;
  const time = now.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false });

  return (
    <div className="fixed inset-0 bg-[#060912] text-white overflow-hidden md:ml-[240px]" style={{ fontFamily: "'DM Sans', system-ui" }}>
      {/* Subtle grid background */}
      <div className="absolute inset-0 opacity-[0.03]" style={{ backgroundImage: 'radial-gradient(circle at 1px 1px, white 1px, transparent 0)', backgroundSize: '40px 40px' }} />

      {/* ═══ TOP BAR ═══ */}
      <div className="relative h-12 flex items-center justify-between px-5 border-b border-white/5 bg-black/20 backdrop-blur-sm z-10">
        <div className="flex items-center gap-3">
          <div className="w-7 h-7 rounded-lg bg-teal-500 flex items-center justify-center"><span className="text-[10px] font-black">H1</span></div>
          <span className="text-sm font-bold tracking-wide">HOSPITAL PULSE</span>
          <div className="flex items-center gap-1.5 ml-3">
            <span className="relative flex h-2 w-2"><span className="animate-ping absolute h-full w-full rounded-full bg-teal-400 opacity-75" /><span className="relative h-2 w-2 rounded-full bg-teal-500" /></span>
            <span className="text-[9px] text-teal-400 font-semibold">LIVE</span>
          </div>
        </div>
        <div className="flex items-center gap-4">
          <div className="font-mono text-xl font-bold tracking-[0.15em] text-teal-400" style={{ textShadow: '0 0 20px rgba(20,184,166,0.3)' }}>{time}</div>
          <button onClick={toggleFS} className="p-1.5 hover:bg-white/5 rounded-lg">{fullscreen ? <Minimize2 size={14} /> : <Maximize2 size={14} />}</button>
        </div>
      </div>

      <div className="h-[calc(100vh-48px)] p-3 flex flex-col gap-3 relative">
        {/* ═══ ROW 1: GAUGES + REVENUE + LIVE OT ═══ */}
        <div className="flex gap-3 h-[38%]">
          {/* GAUGES */}
          <div className="w-[22%] bg-black/30 backdrop-blur rounded-2xl border border-white/5 p-4 flex flex-col items-center justify-center gap-1">
            <div className="relative">
              <CircularGauge value={D.occupied} max={D.totalBeds} label="BED OCCUPANCY" color={occPct > 85 ? '#ef4444' : occPct > 70 ? '#f59e0b' : '#10b981'} size={150} thickness={8} />
            </div>
            <div className="flex gap-4 text-[10px] mt-1">
              <span><span className="inline-block w-2 h-2 rounded-full bg-red-500 mr-1" />{D.occupied} Used</span>
              <span><span className="inline-block w-2 h-2 rounded-full bg-emerald-500 mr-1" />{D.available} Free</span>
              <span><span className="inline-block w-2 h-2 rounded-full bg-amber-500 mr-1" />{D.hk} Clean</span>
            </div>
          </div>

          {/* REVENUE */}
          <div className="w-[30%] bg-black/30 backdrop-blur rounded-2xl border border-white/5 p-5 flex flex-col">
            <div className="text-[9px] text-gray-500 uppercase tracking-[0.2em] font-semibold">Revenue Today</div>
            <div className="text-4xl font-black text-teal-400 mt-1 tracking-tight" style={{ textShadow: '0 0 30px rgba(20,184,166,0.2)' }}>
              ₹<AnimCounter value={D.revenue} />
            </div>
            <div className="flex gap-6 mt-2 text-xs">
              <div><span className="text-gray-500">Collected </span><span className="text-emerald-400 font-bold">₹{INR(D.collected)}</span></div>
              <div><span className="text-gray-500">Bills </span><span className="text-white font-bold">{D.billCount}</span></div>
              <div><span className="text-gray-500">Charges </span><span className="text-cyan-400 font-bold">₹{INR(D.charges)}</span></div>
            </div>
            <div className="flex-1 mt-3 -mx-3">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={D.spark}><defs><linearGradient id="gPulse2" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#14b8a6" stopOpacity={0.5} /><stop offset="100%" stopColor="#14b8a6" stopOpacity={0} /></linearGradient></defs>
                  <Area type="monotone" dataKey="v" stroke="#14b8a6" strokeWidth={2} fill="url(#gPulse2)" dot={false} />
                </AreaChart>
              </ResponsiveContainer>
            </div>
            {/* Payor bars */}
            <div className="flex gap-1 h-2 rounded-full overflow-hidden mt-2">
              {Object.entries(D.payorSplit).map(([k, v]: any) => {
                const pct = D.revenue > 0 ? (v / D.revenue) * 100 : 0;
                const colors: Record<string, string> = { self: '#14b8a6', insurance: '#3b82f6', pmjay: '#22c55e', cghs: '#f59e0b', corporate: '#8b5cf6' };
                return <div key={k} className="h-full rounded-full transition-all duration-1000" style={{ width: `${pct}%`, backgroundColor: colors[k] || '#475569' }} title={`${k}: ₹${INR(v)}`} />;
              })}
            </div>
          </div>

          {/* LIVE OPS GRID */}
          <div className="w-[24%] grid grid-cols-2 gap-2">
            {[
              { label: 'OPD', main: D.opd, sub: `${D.opdWaiting} wait · ${D.opdDone} done`, color: '#3b82f6', glow: 'rgba(59,130,246,0.15)' },
              { label: 'IPD', main: D.ipd, sub: `active inpatients`, color: '#a855f7', glow: 'rgba(168,85,247,0.15)' },
              { label: 'LAB', main: D.lab, sub: `${D.labPending} pending`, color: '#06b6d4', glow: 'rgba(6,182,212,0.15)' },
              { label: 'RADIOLOGY', main: D.rad, sub: `${D.radPending} pending`, color: '#6366f1', glow: 'rgba(99,102,241,0.15)' },
              { label: 'PHARMACY', main: D.rx, sub: `${D.rxPending} queue`, color: D.rxPending > 10 ? '#ef4444' : '#f59e0b', glow: D.rxPending > 10 ? 'rgba(239,68,68,0.15)' : 'rgba(245,158,11,0.15)' },
              { label: 'DISCHARGED', main: D.discharged, sub: 'today', color: '#10b981', glow: 'rgba(16,185,129,0.15)' },
            ].map(item => (
              <div key={item.label} className="rounded-xl border border-white/5 p-3 flex flex-col justify-center transition-all duration-500"
                style={{ background: `linear-gradient(135deg, ${item.glow}, transparent)` }}>
                <div className="text-[8px] text-gray-500 uppercase tracking-[0.15em] font-semibold">{item.label}</div>
                <div className="text-2xl font-black mt-0.5" style={{ color: item.color, textShadow: `0 0 15px ${item.glow}` }}>
                  <AnimCounter value={item.main} duration={800} />
                </div>
                <div className="text-[9px] text-gray-600 mt-0.5">{item.sub}</div>
              </div>
            ))}
          </div>

          {/* ACTIVE OT */}
          <div className="w-[24%] bg-black/30 backdrop-blur rounded-2xl border border-white/5 p-4 flex flex-col">
            <div className="flex items-center justify-between mb-3">
              <div className="text-[9px] text-gray-500 uppercase tracking-[0.2em] font-semibold">Operating Theatres</div>
              <div className="text-xs"><span className="text-white font-bold">{D.otActive.length}</span><span className="text-gray-600"> / {D.otSurgeries.length}</span></div>
            </div>
            <div className="flex-1 space-y-2 overflow-y-auto scrollbar-thin pr-1">
              {D.otActive.length > 0 ? D.otActive.map((o: any) => {
                const elapsed = o.actual_start ? Math.floor((Date.now() - new Date(o.actual_start).getTime()) / 60000) : 0;
                const estDur = o.estimated_duration_min || 120;
                const progress = Math.min(100, (elapsed / estDur) * 100);
                const isOvertime = elapsed > estDur;
                return (
                  <div key={o.id} className="rounded-xl p-3 relative overflow-hidden" style={{ background: 'linear-gradient(135deg, rgba(244,63,94,0.1), transparent)', border: '1px solid rgba(244,63,94,0.2)' }}>
                    {/* Progress bar */}
                    <div className="absolute bottom-0 left-0 h-[3px] rounded-full transition-all duration-1000" style={{ width: `${progress}%`, backgroundColor: isOvertime ? '#ef4444' : '#f43f5e', boxShadow: isOvertime ? '0 0 10px rgba(239,68,68,0.5)' : '0 0 6px rgba(244,63,94,0.3)' }} />
                    <div className="text-xs font-bold text-rose-300 truncate">{o.procedure_name || 'Surgery'}</div>
                    <div className="text-[9px] text-gray-500 mt-0.5">{o.ot_room?.name || 'OT'} · Dr. {o.surgeon?.full_name?.split(' ').pop()}</div>
                    <div className="flex items-center gap-2 mt-1.5">
                      <span className="font-mono text-sm font-bold" style={{ color: isOvertime ? '#ef4444' : '#fb7185' }}>{Math.floor(elapsed / 60)}h {elapsed % 60}m</span>
                      {isOvertime && <span className="text-[8px] bg-red-500/20 text-red-400 px-1.5 py-0.5 rounded-full animate-pulse font-bold">OVERTIME</span>}
                      {!isOvertime && <span className="text-[8px] text-rose-400/50">/ {Math.floor(estDur / 60)}h {estDur % 60}m est</span>}
                    </div>
                  </div>
                );
              }) : D.otSurgeries.length > 0 ? (
                <div className="text-center py-4">
                  <div className="text-gray-600 text-xs">No surgery in progress</div>
                  <div className="text-[10px] text-gray-700 mt-1">{D.otDone} completed · {D.otSurgeries.length - D.otDone - D.otActive.length} upcoming</div>
                </div>
              ) : (
                <div className="text-center py-6 text-gray-700 text-xs">No OT scheduled today</div>
              )}
            </div>
          </div>
        </div>

        {/* ═══ ROW 2: BED HEATMAP ═══ */}
        <div className="flex-1 bg-black/30 backdrop-blur rounded-2xl border border-white/5 p-4 overflow-hidden">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-3">
              <div className="text-[9px] text-gray-500 uppercase tracking-[0.2em] font-semibold">Ward Bed Map</div>
              <div className="flex gap-4 text-[9px]">
                <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-[3px] bg-emerald-500" />Available</span>
                <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-[3px] bg-red-500" />Occupied</span>
                <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-[3px] bg-amber-500" />Housekeeping</span>
              </div>
            </div>
            <div className="text-[10px] text-gray-600">{D.totalBeds} beds across {D.wards.length} wards</div>
          </div>
          <div className="flex gap-4 overflow-x-auto h-[calc(100%-32px)] pb-2 scrollbar-thin">
            {D.wards.map((w: any) => {
              const occ = w.beds.filter((b: any) => b.status === 'occupied').length;
              const pct = w.beds.length > 0 ? Math.round((occ / w.beds.length) * 100) : 0;
              return (
                <div key={w.name} className="flex-shrink-0 min-w-[160px]">
                  <div className="flex items-center justify-between mb-2">
                    <div>
                      <div className="text-xs font-bold text-gray-300">{w.name}</div>
                      <div className="text-[9px] text-gray-600">{w.type}</div>
                    </div>
                    <span className={`text-sm font-black ${pct > 85 ? 'text-red-400' : pct > 70 ? 'text-amber-400' : 'text-emerald-400'}`}>{pct}%</span>
                  </div>
                  {/* Occupancy bar */}
                  <div className="h-1 bg-white/5 rounded-full mb-2 overflow-hidden">
                    <div className="h-full rounded-full transition-all duration-1000" style={{ width: `${pct}%`, backgroundColor: pct > 85 ? '#ef4444' : pct > 70 ? '#f59e0b' : '#10b981' }} />
                  </div>
                  {/* Bed grid */}
                  <div className="flex flex-wrap gap-[4px]">
                    {w.beds.map((b: any) => <BedDot key={b.id} status={b.status} name={b.name || b.room?.name} pulse={tick % 3 === 0} />)}
                  </div>
                </div>
              );
            })}
            {D.wards.length === 0 && <div className="flex items-center justify-center w-full text-gray-700 text-xs">No bed data available</div>}
          </div>
        </div>

        {/* ═══ ROW 3: PATIENT FLOW PIPELINE ═══ */}
        <div className="h-[72px] bg-black/30 backdrop-blur rounded-2xl border border-white/5 px-6 flex items-center gap-0">
          {[
            { label: 'REGISTRATION', value: D.opd, color: '#6366f1' },
            { label: 'WAITING', value: D.opdWaiting, color: '#f59e0b' },
            { label: 'CONSULTATION', value: D.opdInConsult, color: '#8b5cf6' },
            { label: 'DIAGNOSTICS', value: D.labPending + D.radPending, color: '#06b6d4' },
            { label: 'PHARMACY', value: D.rxPending, color: '#f59e0b' },
            { label: 'BILLING', value: D.billCount, color: '#10b981' },
            { label: 'COMPLETED', value: D.opdDone + D.discharged, color: '#14b8a6' },
          ].map((step, i, arr) => (
            <React.Fragment key={step.label}>
              <div className="flex-1 text-center relative">
                <div className="text-2xl font-black transition-all duration-500" style={{ color: step.color, textShadow: `0 0 12px ${step.color}30` }}>
                  <AnimCounter value={step.value} duration={600} />
                </div>
                <div className="text-[7px] text-gray-600 uppercase tracking-[0.2em] mt-0.5">{step.label}</div>
              </div>
              {i < arr.length - 1 && (
                <div className="w-8 flex items-center justify-center shrink-0 relative overflow-hidden">
                  <svg width="32" height="12" viewBox="0 0 32 12" className="opacity-30">
                    <path d="M0 6 L24 6 L20 2 M24 6 L20 10" fill="none" stroke={arr[i + 1].color} strokeWidth="1.5" strokeLinecap="round" />
                  </svg>
                </div>
              )}
            </React.Fragment>
          ))}
        </div>
      </div>
    </div>
  );
}
