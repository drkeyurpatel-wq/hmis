'use client';
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useAuthStore } from '@/lib/store/auth';
import { createClient } from '@/lib/supabase/client';
import Link from 'next/link';
import {
  AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid,
} from 'recharts';
import {
  TrendingUp, TrendingDown, Users, BedDouble, CreditCard,
  FlaskConical, Pill, ScanLine, Scissors, Activity, Clock, ArrowUpRight,
} from 'lucide-react';

let _sb: any = null;
function sb() { if (typeof window === 'undefined') return null as any; if (!_sb) { try { _sb = createClient(); } catch { return null; } } return _sb; }

const INR = (n: number) => n >= 10000000 ? `₹${(n/10000000).toFixed(2)} Cr` : n >= 100000 ? `₹${(n/100000).toFixed(1)}L` : `₹${Math.round(n).toLocaleString('en-IN')}`;
const pct = (a: number, b: number) => b > 0 ? Math.round(((a-b)/b)*100) : 0;
const dayLabel = (d: string) => new Date(d+'T12:00:00').toLocaleDateString('en-IN', { weekday: 'short' });
const C = { teal:'#0d9488', green:'#16a34a', blue:'#2563eb', amber:'#d97706', purple:'#7c3aed', slate:'#475569' };

export default function DashboardPage() {
  const { staff, activeCentreId } = useAuthStore();
  const centreId = activeCentreId || '';
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!centreId || !sb()) { setLoading(false); return; }
    setLoading(true);
    const now = new Date();
    const today = now.toISOString().split('T')[0];
    const yesterday = new Date(now.getTime()-86400000).toISOString().split('T')[0];
    const days: string[] = [];
    for (let i=6; i>=0; i--) days.push(new Date(now.getTime()-i*86400000).toISOString().split('T')[0]);

    const [billsWeek,billsYest,opdToday,opdYest,ipdActive,ipdNew,beds,labToday,radToday,otToday,pharmaQ,chargeToday,advToday,recentV,recentB,recentA] = await Promise.all([
      sb().from('hmis_bills').select('bill_date,net_amount,paid_amount,payor_type,bill_type').eq('centre_id',centreId).gte('bill_date',days[0]).lte('bill_date',today).neq('status','cancelled'),
      sb().from('hmis_bills').select('net_amount,paid_amount').eq('centre_id',centreId).eq('bill_date',yesterday).neq('status','cancelled'),
      sb().from('hmis_opd_visits').select('id,status').eq('centre_id',centreId).gte('created_at',today+'T00:00:00').lte('created_at',today+'T23:59:59'),
      sb().from('hmis_opd_visits').select('id',{count:'exact',head:true}).eq('centre_id',centreId).gte('created_at',yesterday+'T00:00:00').lte('created_at',yesterday+'T23:59:59'),
      sb().from('hmis_admissions').select('id',{count:'exact',head:false}).eq('centre_id',centreId).eq('status','active'),
      sb().from('hmis_admissions').select('id',{count:'exact',head:true}).eq('centre_id',centreId).gte('admission_date',today+'T00:00:00'),
      sb().from('hmis_beds').select('id,status,room:hmis_rooms!inner(ward:hmis_wards!inner(centre_id))').eq('room.ward.centre_id',centreId).eq('is_active',true),
      sb().from('hmis_lab_orders').select('id,status').eq('centre_id',centreId).gte('created_at',today+'T00:00:00'),
      sb().from('hmis_radiology_orders').select('id,status').eq('centre_id',centreId).gte('created_at',today+'T00:00:00'),
      sb().from('hmis_ot_bookings').select('id,status').eq('centre_id',centreId).eq('scheduled_date',today),
      sb().from('hmis_pharmacy_dispensing').select('id',{count:'exact',head:true}).eq('centre_id',centreId).eq('status','pending'),
      sb().from('hmis_charge_log').select('amount,category').eq('centre_id',centreId).eq('service_date',today).neq('status','reversed'),
      sb().from('hmis_advances').select('amount').gte('created_at',today+'T00:00:00'),
      sb().from('hmis_opd_visits').select('id,status,created_at,patient:hmis_patients!inner(first_name,last_name,uhid),doctor:hmis_staff!hmis_opd_visits_doctor_id_fkey(full_name)').eq('centre_id',centreId).order('created_at',{ascending:false}).limit(8),
      sb().from('hmis_bills').select('id,bill_number,net_amount,paid_amount,status,payor_type,patient:hmis_patients!inner(first_name,last_name,uhid)').eq('centre_id',centreId).order('created_at',{ascending:false}).limit(6),
      sb().from('hmis_admissions').select('id,ipd_number,status,admission_date,patient:hmis_patients!inner(first_name,last_name,uhid)').eq('centre_id',centreId).order('admission_date',{ascending:false}).limit(5),
    ]);

    const bw=billsWeek.data||[]; const by=billsYest.data||[]; const od=opdToday.data||[]; const bd=beds.data||[];
    const ld=labToday.data||[]; const rd=radToday.data||[]; const ot=otToday.data||[];
    const cd=chargeToday.data||[]; const ad=advToday.data||[];

    const revTrend = days.map(d => {
      const db = bw.filter((b:any) => b.bill_date===d);
      return { date:d, day:dayLabel(d), revenue:db.reduce((s:number,b:any)=>s+parseFloat(b.net_amount||0),0), collected:db.reduce((s:number,b:any)=>s+parseFloat(b.paid_amount||0),0) };
    });
    const todayBills = bw.filter((b:any)=>b.bill_date===today);
    const revToday = todayBills.reduce((s:number,b:any)=>s+parseFloat(b.net_amount||0),0);
    const colToday = todayBills.reduce((s:number,b:any)=>s+parseFloat(b.paid_amount||0),0);
    const revYest = by.reduce((s:number,b:any)=>s+parseFloat(b.net_amount||0),0);
    const colYest = by.reduce((s:number,b:any)=>s+parseFloat(b.paid_amount||0),0);
    const payorMix: Record<string,number> = {};
    todayBills.forEach((b:any)=>{ const p=b.payor_type||'self'; payorMix[p]=(payorMix[p]||0)+parseFloat(b.net_amount||0); });
    const chargeByCat: Record<string,number> = {};
    cd.forEach((c:any)=>{ const cat=c.category||'other'; chargeByCat[cat]=(chargeByCat[cat]||0)+parseFloat(c.amount||0); });
    const totalBeds=bd.length; const occupied=bd.filter((b:any)=>b.status==='occupied').length;
    const available=bd.filter((b:any)=>b.status==='available').length; const hk=bd.filter((b:any)=>b.status==='housekeeping').length;

    setData({
      revTrend, revToday, colToday, revYest, colYest,
      revDelta:pct(revToday,revYest), colDelta:pct(colToday,colYest),
      weekTotal:revTrend.reduce((s,d)=>s+d.revenue,0),
      opdTotal:od.length, opdWaiting:od.filter((o:any)=>['waiting','checked_in'].includes(o.status)).length,
      opdCompleted:od.filter((o:any)=>o.status==='completed').length, opdYest:opdYest.count||0,
      ipdActive:ipdActive.data?.length||0, ipdNew:ipdNew.count||0,
      totalBeds, occupied, available, hk, occupancyPct:totalBeds>0?Math.round((occupied/totalBeds)*100):0,
      labTotal:ld.length, labPending:ld.filter((o:any)=>!['completed','verified'].includes(o.status)).length,
      radTotal:rd.length, radPending:rd.filter((o:any)=>!['reported','verified'].includes(o.status)).length,
      otTotal:ot.length, otDone:ot.filter((o:any)=>o.status==='completed').length,
      rxPending:pharmaQ.count||0,
      chargesTotal:cd.reduce((s:number,c:any)=>s+parseFloat(c.amount||0),0),
      advTotal:ad.reduce((s:number,a:any)=>s+parseFloat(a.amount||0),0),
      billsCount:todayBills.length, payorMix, chargeByCat,
      recentV:recentV.data||[], recentB:recentB.data||[], recentA:recentA.data||[],
    });
    setLoading(false);
  }, [centreId]);

  useEffect(()=>{ load(); },[load]);
  useEffect(()=>{
    const iv=setInterval(load,60000);
    if(!centreId||!sb()) return ()=>clearInterval(iv);
    const ch=sb().channel('ceo-'+centreId)
      .on('postgres_changes',{event:'INSERT',schema:'public',table:'hmis_bills',filter:`centre_id=eq.${centreId}`},load)
      .on('postgres_changes',{event:'*',schema:'public',table:'hmis_admissions',filter:`centre_id=eq.${centreId}`},load)
      .on('postgres_changes',{event:'INSERT',schema:'public',table:'hmis_opd_visits',filter:`centre_id=eq.${centreId}`},load)
      .subscribe();
    return ()=>{ clearInterval(iv); sb().removeChannel(ch); };
  },[load,centreId]);

  const payorData = useMemo(()=>{
    if(!data?.payorMix) return [];
    const colors: Record<string,string>={self:C.teal,insurance:C.blue,pmjay:C.green,cghs:C.amber,corporate:C.purple};
    return Object.entries(data.payorMix).map(([k,v])=>({name:k.replace('_',' '),value:v as number,fill:colors[k]||C.slate}));
  },[data]);
  const chargeChartData = useMemo(()=>{
    if(!data?.chargeByCat) return [];
    return Object.entries(data.chargeByCat).sort((a:any,b:any)=>b[1]-a[1]).slice(0,6).map(([k,v])=>({name:k.replace(/_/g,' '),value:v as number}));
  },[data]);

  if(loading) return (
    <div className="max-w-[1400px] mx-auto p-6 space-y-6 animate-pulse">
      <div className="h-12 bg-gradient-to-r from-gray-200 to-gray-100 rounded-2xl w-72" />
      <div className="grid grid-cols-4 gap-4">{[1,2,3,4].map(i=><div key={i} className="h-32 bg-gray-100 rounded-2xl" />)}</div>
      <div className="grid grid-cols-3 gap-4"><div className="col-span-2 h-64 bg-gray-100 rounded-2xl" /><div className="h-64 bg-gray-100 rounded-2xl" /></div>
    </div>
  );
  if(!data) return <div className="max-w-[1400px] mx-auto p-6 flex items-center justify-center h-[60vh]"><div className="text-center"><div className="text-5xl mb-4">🏥</div><div className="text-lg font-semibold text-gray-400">Select a centre to view dashboard</div></div></div>;

  const D=data;
  const Delta=({val,s=''}:{val:number;s?:string})=>(<span className={`inline-flex items-center gap-0.5 text-[10px] font-bold ${val>0?'text-emerald-600':val<0?'text-red-500':'text-gray-400'}`}>{val>0?<TrendingUp size={10}/>:val<0?<TrendingDown size={10}/>:null}{val>0?'+':''}{val}{s}</span>);
  const Pulse=({c='bg-emerald-500'}:{c?:string})=>(<span className="relative flex h-2 w-2"><span className={`animate-ping absolute inline-flex h-full w-full rounded-full ${c} opacity-75`}/><span className={`relative inline-flex rounded-full h-2 w-2 ${c}`}/></span>);
  const stC=(s:string)=>s==='completed'?'bg-emerald-100 text-emerald-700':s==='waiting'||s==='checked_in'?'bg-amber-100 text-amber-700':s==='in_consultation'?'bg-blue-100 text-blue-700':'bg-gray-100 text-gray-600';

  return (
    <div className="max-w-[1400px] mx-auto p-4 space-y-5">
      {/* HEADER */}
      <div className="flex items-center justify-between">
        <div><h1 className="text-2xl font-black tracking-tight text-gray-900">Health1 <span className="text-teal-600">Command</span></h1><p className="text-xs text-gray-400 mt-0.5">{new Date().toLocaleDateString('en-IN',{weekday:'long',day:'2-digit',month:'long',year:'numeric'})} · {staff?.full_name}</p></div>
        <div className="flex items-center gap-2"><div className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-50 border border-emerald-200 rounded-full"><Pulse/><span className="text-[10px] font-bold text-emerald-700">LIVE</span></div><button onClick={load} className="px-3 py-1.5 text-xs bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors">↻</button></div>
      </div>

      {/* ROW 1: HERO KPIs */}
      <div className="grid grid-cols-4 gap-3">
        <Link href="/billing" className="group bg-gradient-to-br from-teal-600 to-teal-700 rounded-2xl p-4 text-white shadow-lg shadow-teal-200/50 hover:shadow-teal-300/50 transition-all hover:-translate-y-0.5">
          <div className="flex items-center justify-between mb-1"><span className="text-teal-200 text-[10px] font-semibold uppercase tracking-wider">Revenue Today</span><CreditCard size={14} className="text-teal-300"/></div>
          <div className="text-2xl font-black">{INR(D.revToday)}</div>
          <div className="flex items-center justify-between mt-2"><span className="text-teal-200 text-[10px]">vs yesterday {INR(D.revYest)}</span><span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${D.revDelta>=0?'bg-white/20':'bg-red-400/30'}`}>{D.revDelta>=0?'↑':'↓'} {Math.abs(D.revDelta)}%</span></div>
        </Link>
        <Link href="/billing" className="group bg-white rounded-2xl p-4 border border-gray-100 hover:border-emerald-200 hover:shadow-md transition-all hover:-translate-y-0.5">
          <div className="flex items-center justify-between mb-1"><span className="text-gray-400 text-[10px] font-semibold uppercase tracking-wider">Collected</span><Delta val={D.colDelta} s="%"/></div>
          <div className="text-2xl font-black text-emerald-700">{INR(D.colToday)}</div>
          <div className="flex items-center gap-3 mt-2 text-[10px] text-gray-400"><span>{D.billsCount} bills</span><span>·</span><span>Advances: {INR(D.advTotal)}</span></div>
        </Link>
        <Link href="/opd" className="group bg-white rounded-2xl p-4 border border-gray-100 hover:border-blue-200 hover:shadow-md transition-all hover:-translate-y-0.5">
          <div className="flex items-center justify-between mb-1"><span className="text-gray-400 text-[10px] font-semibold uppercase tracking-wider">OPD Today</span><Users size={14} className="text-blue-400"/></div>
          <div className="flex items-baseline gap-2"><span className="text-2xl font-black text-blue-700">{D.opdTotal}</span>{D.opdWaiting>0&&<span className="text-xs text-amber-600 font-bold">{D.opdWaiting} waiting</span>}</div>
          <div className="flex items-center gap-3 mt-2 text-[10px] text-gray-400"><span className="text-emerald-600 font-medium">{D.opdCompleted} done</span><span>·</span><span>Yest: {D.opdYest}</span><Delta val={pct(D.opdTotal,D.opdYest)} s="%"/></div>
        </Link>
        <Link href="/bed-management" className="group bg-white rounded-2xl p-4 border border-gray-100 hover:border-purple-200 hover:shadow-md transition-all hover:-translate-y-0.5">
          <div className="flex items-center justify-between mb-1"><span className="text-gray-400 text-[10px] font-semibold uppercase tracking-wider">Bed Occupancy</span><BedDouble size={14} className="text-purple-400"/></div>
          <div className="flex items-baseline gap-2"><span className={`text-2xl font-black ${D.occupancyPct>85?'text-red-600':D.occupancyPct>70?'text-amber-600':'text-purple-700'}`}>{D.occupancyPct}%</span><span className="text-xs text-gray-400">{D.occupied}/{D.totalBeds}</span></div>
          <div className="mt-2 flex gap-0.5 h-2 rounded-full overflow-hidden bg-gray-100"><div className="bg-red-400 rounded-l-full" style={{width:`${D.totalBeds>0?(D.occupied/D.totalBeds)*100:0}%`}}/><div className="bg-amber-300" style={{width:`${D.totalBeds>0?(D.hk/D.totalBeds)*100:0}%`}}/><div className="bg-emerald-300 rounded-r-full" style={{width:`${D.totalBeds>0?(D.available/D.totalBeds)*100:0}%`}}/></div>
          <div className="flex justify-between mt-1 text-[9px] text-gray-400"><span className="text-emerald-600">{D.available} free</span><span className="text-amber-500">{D.hk} cleaning</span></div>
        </Link>
      </div>

      {/* ROW 2: CHART + LIVE OPS */}
      <div className="grid grid-cols-3 gap-4">
        <div className="col-span-2 bg-white rounded-2xl border border-gray-100 p-5">
          <div className="flex items-center justify-between mb-4"><div><h3 className="text-sm font-bold text-gray-800">Revenue Trend</h3><p className="text-[10px] text-gray-400">Last 7 days · Total: {INR(D.weekTotal)}</p></div>
          <div className="flex items-center gap-4 text-[10px]"><span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-teal-500"/>Revenue</span><span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-emerald-400"/>Collected</span></div></div>
          <ResponsiveContainer width="100%" height={200}>
            <AreaChart data={D.revTrend} margin={{top:5,right:5,left:-20,bottom:0}}>
              <defs><linearGradient id="gR" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor={C.teal} stopOpacity={0.3}/><stop offset="100%" stopColor={C.teal} stopOpacity={0}/></linearGradient><linearGradient id="gC" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor={C.green} stopOpacity={0.2}/><stop offset="100%" stopColor={C.green} stopOpacity={0}/></linearGradient></defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9"/>
              <XAxis dataKey="day" tick={{fontSize:10,fill:'#94a3b8'}} axisLine={false} tickLine={false}/>
              <YAxis tick={{fontSize:9,fill:'#94a3b8'}} axisLine={false} tickLine={false} tickFormatter={(v:number)=>v>=100000?`${(v/100000).toFixed(0)}L`:`${(v/1000).toFixed(0)}K`}/>
              <Tooltip contentStyle={{fontSize:11,borderRadius:12,border:'1px solid #e2e8f0'}} formatter={(v:number)=>INR(v)}/>
              <Area type="monotone" dataKey="revenue" stroke={C.teal} strokeWidth={2.5} fill="url(#gR)" dot={{r:3,fill:C.teal}}/>
              <Area type="monotone" dataKey="collected" stroke={C.green} strokeWidth={1.5} fill="url(#gC)" dot={{r:2,fill:C.green}}/>
            </AreaChart>
          </ResponsiveContainer>
        </div>
        <div className="bg-white rounded-2xl border border-gray-100 p-5">
          <h3 className="text-sm font-bold text-gray-800 mb-3 flex items-center gap-1.5"><Pulse c="bg-blue-500"/> Live Operations</h3>
          <div className="space-y-2">
            {[
              {icon:BedDouble,label:'IPD Active',value:D.ipdActive,sub:`${D.ipdNew} new`,color:'text-purple-700',bg:'bg-purple-50',href:'/ipd'},
              {icon:FlaskConical,label:'Lab Orders',value:D.labTotal,sub:`${D.labPending} pending`,color:'text-blue-700',bg:'bg-blue-50',href:'/lab'},
              {icon:ScanLine,label:'Radiology',value:D.radTotal,sub:`${D.radPending} pending`,color:'text-indigo-700',bg:'bg-indigo-50',href:'/radiology'},
              {icon:Scissors,label:'OT Surgeries',value:D.otTotal,sub:`${D.otDone} done`,color:'text-rose-700',bg:'bg-rose-50',href:'/ot'},
              {icon:Pill,label:'Rx Pending',value:D.rxPending,sub:'in queue',color:D.rxPending>10?'text-red-700':'text-amber-700',bg:D.rxPending>10?'bg-red-50':'bg-amber-50',href:'/pharmacy'},
              {icon:Activity,label:'Charges',value:INR(D.chargesTotal),sub:'today',color:'text-teal-700',bg:'bg-teal-50',href:'/billing'},
            ].map(item=>(
              <Link key={item.label} href={item.href} className={`flex items-center gap-3 p-2.5 rounded-xl ${item.bg} hover:ring-1 hover:ring-gray-200 transition-all group`}>
                <item.icon size={16} className={item.color}/>
                <div className="flex-1 min-w-0"><div className="text-[10px] text-gray-500">{item.label}</div><div className={`text-sm font-bold ${item.color}`}>{item.value}</div></div>
                <div className="text-[9px] text-gray-400">{item.sub}</div>
                <ArrowUpRight size={12} className="text-gray-300 group-hover:text-gray-500"/>
              </Link>
            ))}
          </div>
        </div>
      </div>

      {/* ROW 3: PAYOR + CHARGES + ACTIONS */}
      <div className="grid grid-cols-3 gap-4">
        <div className="bg-white rounded-2xl border border-gray-100 p-5">
          <h3 className="text-sm font-bold text-gray-800 mb-2">Payor Mix</h3>
          {payorData.length===0?<div className="text-center py-8 text-gray-300 text-xs">No bills today</div>:
          <div className="flex items-center gap-4">
            <ResponsiveContainer width={120} height={120}><PieChart><Pie data={payorData} dataKey="value" cx="50%" cy="50%" innerRadius={30} outerRadius={52} paddingAngle={3} strokeWidth={0}>{payorData.map((d:any,i:number)=><Cell key={i} fill={d.fill}/>)}</Pie></PieChart></ResponsiveContainer>
            <div className="flex-1 space-y-1.5">{payorData.map((d:any)=>(<div key={d.name} className="flex items-center justify-between"><div className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full" style={{background:d.fill}}/><span className="text-[10px] capitalize text-gray-600">{d.name}</span></div><span className="text-[10px] font-bold text-gray-800">{INR(d.value)}</span></div>))}</div>
          </div>}
        </div>
        <div className="bg-white rounded-2xl border border-gray-100 p-5">
          <h3 className="text-sm font-bold text-gray-800 mb-2">Charges by Category</h3>
          {chargeChartData.length===0?<div className="text-center py-8 text-gray-300 text-xs">No charges today</div>:
          <ResponsiveContainer width="100%" height={130}><BarChart data={chargeChartData} layout="vertical" margin={{left:0,right:5}}><XAxis type="number" tick={{fontSize:9}} tickFormatter={(v:number)=>v>=1000?`${(v/1000).toFixed(0)}K`:String(v)} axisLine={false} tickLine={false}/><YAxis type="category" dataKey="name" tick={{fontSize:9,fill:'#64748b'}} width={70} axisLine={false} tickLine={false}/><Bar dataKey="value" fill={C.teal} radius={[0,4,4,0]} barSize={14}/></BarChart></ResponsiveContainer>}
        </div>
        <div className="bg-gradient-to-br from-gray-900 to-gray-800 rounded-2xl p-5 text-white">
          <h3 className="text-sm font-bold mb-3">Quick Actions</h3>
          <div className="grid grid-cols-2 gap-2">
            {[{href:'/patients/register',label:'New Patient',icon:'👤'},{href:'/billing',label:'New Bill',icon:'💵'},{href:'/emr-v2',label:'EMR',icon:'📋'},{href:'/appointments',label:'Book Appt',icon:'📅'},{href:'/lab',label:'Lab Orders',icon:'🧪'},{href:'/reports',label:'Reports',icon:'📊'}].map(a=>(
              <Link key={a.href} href={a.href} className="flex items-center gap-2 px-3 py-2.5 bg-white/10 rounded-xl text-xs hover:bg-white/20 transition-colors"><span className="text-base">{a.icon}</span><span className="font-medium">{a.label}</span></Link>
            ))}
          </div>
          <div className="mt-3 pt-3 border-t border-white/10 text-[10px] text-gray-400 flex items-center gap-1"><Clock size={10}/> {new Date().toLocaleTimeString('en-IN',{hour:'2-digit',minute:'2-digit'})}</div>
        </div>
      </div>

      {/* ROW 4: FEEDS */}
      <div className="grid grid-cols-3 gap-4">
        <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
          <div className="px-5 py-3 border-b border-gray-50 flex justify-between items-center"><h3 className="text-xs font-bold text-gray-700">Recent OPD</h3><Link href="/opd" className="text-[10px] text-teal-600 font-medium hover:underline">View all →</Link></div>
          <div className="divide-y divide-gray-50">
            {D.recentV.slice(0,6).map((v:any)=>(<div key={v.id} className="px-5 py-2.5 hover:bg-gray-50/50"><div className="flex items-center justify-between"><div className="font-medium text-xs text-gray-800">{v.patient?.first_name} {v.patient?.last_name}</div><span className={`px-1.5 py-0.5 rounded text-[9px] font-medium ${stC(v.status)}`}>{v.status?.replace('_',' ')}</span></div><div className="text-[10px] text-gray-400 mt-0.5">{v.patient?.uhid} · Dr. {v.doctor?.full_name?.split(' ').pop()}</div></div>))}
            {D.recentV.length===0&&<div className="text-center py-6 text-gray-300 text-xs">No OPD visits</div>}
          </div>
        </div>
        <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
          <div className="px-5 py-3 border-b border-gray-50 flex justify-between items-center"><h3 className="text-xs font-bold text-gray-700">Recent Bills</h3><Link href="/billing" className="text-[10px] text-teal-600 font-medium hover:underline">View all →</Link></div>
          <div className="divide-y divide-gray-50">
            {D.recentB.map((b:any)=>(<div key={b.id} className="px-5 py-2.5 hover:bg-gray-50/50"><div className="flex items-center justify-between"><div className="font-medium text-xs text-gray-800">{b.patient?.first_name} {b.patient?.last_name}</div><div className="text-xs font-bold text-gray-900">{INR(parseFloat(b.net_amount||0))}</div></div><div className="flex items-center justify-between mt-0.5"><span className="text-[10px] text-gray-400">{b.bill_number} · {b.payor_type?.replace('_',' ')}</span><span className={`text-[9px] font-medium ${b.status==='paid'?'text-emerald-600':'text-amber-600'}`}>{b.status}</span></div></div>))}
            {D.recentB.length===0&&<div className="text-center py-6 text-gray-300 text-xs">No recent bills</div>}
          </div>
        </div>
        <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
          <div className="px-5 py-3 border-b border-gray-50 flex justify-between items-center"><h3 className="text-xs font-bold text-gray-700">Recent Admissions</h3><Link href="/ipd" className="text-[10px] text-teal-600 font-medium hover:underline">View all →</Link></div>
          <div className="divide-y divide-gray-50">
            {D.recentA.map((a:any)=>(<Link key={a.id} href={`/ipd/${a.id}`} className="block px-5 py-2.5 hover:bg-gray-50/50"><div className="flex items-center justify-between"><div className="font-medium text-xs text-gray-800">{a.patient?.first_name} {a.patient?.last_name}</div><span className={`px-1.5 py-0.5 rounded text-[9px] font-medium ${a.status==='active'?'bg-blue-100 text-blue-700':a.status==='discharge_initiated'?'bg-amber-100 text-amber-700':'bg-emerald-100 text-emerald-700'}`}>{a.status?.replace('_',' ')}</span></div><div className="text-[10px] text-gray-400 mt-0.5">{a.ipd_number} · {a.patient?.uhid} · {new Date(a.admission_date).toLocaleDateString('en-IN')}</div></Link>))}
            {D.recentA.length===0&&<div className="text-center py-6 text-gray-300 text-xs">No recent admissions</div>}
          </div>
        </div>
      </div>
    </div>
  );
}
