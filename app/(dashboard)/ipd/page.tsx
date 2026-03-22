'use client';
import React, { useState, useEffect } from 'react';
import { useIPD, type Admission } from '@/lib/revenue/phase2-hooks';
import { useDoctors } from '@/lib/revenue/hooks';
import { RoleGuard, TableSkeleton } from '@/components/ui/shared';
import { useAuthStore } from '@/lib/store/auth';
import { createClient } from '@/lib/supabase/client';
import { Plus, Search, X, BedDouble, Users, Clock, Activity } from 'lucide-react';
import Link from 'next/link';

let _sb: any = null;
function sb() { if (typeof window === 'undefined') return null as any; if (!_sb) { try { _sb = createClient(); } catch { return null; } } return _sb; }

function IPDPageInner() {
  const { staff, activeCentreId } = useAuthStore();
  const centreId = activeCentreId || '';
  const { admissions, beds, loading, loadAdmissions, admitPatient, initiateDischarge } = useIPD(centreId);
  const doctors = useDoctors(centreId);
  const [statusFilter, setStatusFilter] = useState('active');
  const [wardFilter, setWardFilter] = useState('all');
  const [doctorFilter, setDoctorFilter] = useState('all');
  const [showAdmit, setShowAdmit] = useState(false);
  const [ipdSearch, setIpdSearch] = useState('');
  const [departments, setDepartments] = useState<any[]>([]);
  const [toast, setToast] = useState('');
  const flash = (m: string) => { setToast(m); setTimeout(() => setToast(''), 3000); };
  const [searchQ, setSearchQ] = useState('');
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [selPatient, setSelPatient] = useState<any>(null);
  const [roomTypeFilter, setRoomTypeFilter] = useState('all');
  const [form, setForm] = useState({ patientId: '', admittingDoctorId: '', primaryDoctorId: '', departmentId: '', bedId: '', admissionType: 'elective', payorType: 'self', provisionalDiagnosis: '', expectedDischarge: '', insurerName: '', policyNumber: '' });

  useEffect(() => {
    if (!centreId || !sb()) return;
    sb().from('hmis_departments').select('id, name').eq('is_active', true).then(({ data }: any) => setDepartments(data || []));
  }, [centreId]);
  useEffect(() => { loadAdmissions(statusFilter); }, [statusFilter, loadAdmissions]);
  useEffect(() => {
    if (searchQ.length < 2 || !sb()) { setSearchResults([]); return; }
    const t = setTimeout(async () => {
      const { data } = await sb().from('hmis_patients').select('id, uhid, first_name, last_name, age_years, gender, phone_primary')
        .or(`uhid.ilike.%${searchQ}%,first_name.ilike.%${searchQ}%,phone_primary.ilike.%${searchQ}%`).eq('is_active', true).limit(8);
      setSearchResults(data || []);
    }, 300);
    return () => clearTimeout(t);
  }, [searchQ]);

  const handleAdmit = async () => {
    if (!form.patientId || !form.admittingDoctorId || !form.primaryDoctorId || !form.departmentId) return;
    await admitPatient(form);
    flash('Patient admitted'); setShowAdmit(false); setSelPatient(null);
    setForm({ patientId: '', admittingDoctorId: '', primaryDoctorId: '', departmentId: '', bedId: '', admissionType: 'elective', payorType: 'self', provisionalDiagnosis: '', expectedDischarge: '', insurerName: '', policyNumber: '' });
  };

  const activeCount = admissions.filter(a => a.status === 'active').length;
  const dischargeInit = admissions.filter(a => a.status === 'discharge_initiated').length;
  const availBeds = beds.filter((b: any) => b.status === 'available').length;
  const occupiedBeds = beds.filter((b: any) => b.status === 'occupied').length;
  const occupancy = beds.length > 0 ? Math.round(occupiedBeds / beds.length * 100) : 0;
  const todayAdm = admissions.filter(a => a.admissionDate?.startsWith(new Date().toISOString().split('T')[0])).length;
  const wards = [...new Set(beds.map((b: any) => b.room?.ward?.name).filter(Boolean))];
  const uniqueDoctors = [...new Set(admissions.map(a => a.primaryDoctor).filter(Boolean))];

  const filtered = admissions.filter(a => {
    if (ipdSearch) { const q = ipdSearch.toLowerCase(); if (!a.patientName?.toLowerCase().includes(q) && !a.patientUhid?.toLowerCase().includes(q) && !a.ipdNumber?.toLowerCase().includes(q)) return false; }
    if (wardFilter !== 'all' && a.wardName !== wardFilter) return false;
    if (doctorFilter !== 'all' && a.primaryDoctor !== doctorFilter) return false;
    return true;
  });

  const bedGroups: Record<string, any[]> = {};
  beds.filter((b: any) => b.status === 'available').forEach((b: any) => {
    const ward = b.room?.ward?.name || 'General';
    const type = b.room?.room_type || 'general';
    const key = `${ward} — ${type}`;
    if (!bedGroups[key]) bedGroups[key] = [];
    if (roomTypeFilter === 'all' || type === roomTypeFilter) bedGroups[key].push(b);
  });

  const stBadge = (s: string) => s === 'active' ? 'inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-50 text-emerald-700' : s === 'discharge_initiated' ? 'inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold bg-amber-50 text-amber-700' : s === 'discharged' ? 'inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold bg-blue-50 text-blue-700' : 'inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold bg-gray-100 text-gray-600';
  const typeBadge = (t: string) => t === 'emergency' ? 'inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold bg-red-50 text-red-700' : t === 'daycare' ? 'inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold bg-purple-50 text-purple-700' : 'inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold bg-blue-50 text-blue-700';
  const daysSince = (d: string) => Math.ceil((Date.now() - new Date(d).getTime()) / 86400000);

  return (
    <div className="max-w-[1400px] mx-auto space-y-4">
      {toast && <div className="fixed top-4 left-1/2 -translate-x-1/2 z-50 bg-teal-600 text-white px-5 py-2.5 rounded-xl shadow-lg text-sm font-medium">{toast}</div>}
      <div className="flex items-center justify-between">
        <div><h1 className="text-xl font-bold tracking-tight">IPD / Admissions</h1><p className="text-xs text-gray-400">{activeCount} active · {availBeds} beds free · {occupancy}% occupancy</p></div>
        <button onClick={() => setShowAdmit(true)} className="flex items-center gap-2 px-4 py-2.5 bg-teal-600 text-white text-sm rounded-xl font-semibold hover:bg-teal-700"><Plus size={15} /> New Admission</button>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-6 gap-2">
        {[
          { l: 'Active', v: activeCount, c: 'text-teal-700' },
          { l: 'Discharge Init', v: dischargeInit, c: dischargeInit > 0 ? 'text-amber-700' : 'text-gray-400' },
          { l: 'Today', v: todayAdm, c: 'text-blue-700' },
          { l: 'Available', v: availBeds, c: 'text-emerald-700' },
          { l: 'Occupied', v: occupiedBeds, c: 'text-purple-700' },
          { l: 'Occupancy', v: `${occupancy}%`, c: occupancy > 85 ? 'text-red-600' : 'text-gray-800' },
        ].map(s => (
          <div key={s.l} className="bg-white rounded-xl border px-3 py-3 text-center"><div className="text-[9px] text-gray-400 uppercase font-semibold">{s.l}</div><div className={`text-2xl font-black ${s.c}`}>{s.v}</div></div>
        ))}
      </div>

      {/* Bed Board */}
      {beds.length > 0 && (
        <div className="bg-white rounded-2xl border p-4">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-xs font-bold text-gray-700">Bed Board</h2>
            <div className="flex gap-3 text-[9px] text-gray-400">
              <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-sm bg-emerald-400" /> Free</span>
              <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-sm bg-red-400" /> Occupied</span>
              <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-sm bg-amber-400" /> Reserved</span>
            </div>
          </div>
          {(() => {
            const wardMap: Record<string, any[]> = {};
            beds.forEach((b: any) => { const w = b.room?.ward?.name || 'General'; if (!wardMap[w]) wardMap[w] = []; wardMap[w].push(b); });
            return Object.entries(wardMap).map(([ward, wBeds]) => (
              <div key={ward} className="mb-2">
                <div className="text-[10px] font-semibold text-gray-500 mb-1">{ward} <span className="text-gray-300">({wBeds.filter((b: any) => b.status === 'available').length}/{wBeds.length})</span></div>
                <div className="flex flex-wrap gap-1">{wBeds.map((b: any) => {
                  const bg = b.status === 'available' ? 'bg-emerald-100 border-emerald-300 text-emerald-700' : b.status === 'occupied' ? 'bg-red-50 border-red-200 text-red-600' : b.status === 'reserved' ? 'bg-amber-50 border-amber-200 text-amber-600' : 'bg-gray-100 border-gray-200 text-gray-400';
                  return <div key={b.id} className={`px-2 py-1 text-[9px] font-mono font-bold rounded-lg border ${bg}`} title={`${b.bed_number} — ${b.room?.name || ''}`}>{b.bed_number}</div>;
                })}</div>
              </div>
            ));
          })()}
        </div>
      )}

      {/* Filters */}
      <div className="flex items-center gap-2 flex-wrap">
        <div className="flex gap-1">{[['active','Active'],['discharge_initiated','Disch Init'],['discharged','Discharged'],['all','All']].map(([k,l]) =>
          <button key={k} onClick={() => setStatusFilter(k)} className={`px-3 py-1.5 text-[10px] font-medium rounded-xl ${statusFilter === k ? 'bg-teal-600 text-white shadow-sm' : 'bg-white text-gray-500 border border-gray-100'}`}>{l}</button>
        )}</div>
        <select value={wardFilter} onChange={e => setWardFilter(e.target.value)} className="px-2.5 py-1.5 text-[10px] border rounded-xl"><option value="all">All Wards</option>{wards.map(w => <option key={w} value={w}>{w}</option>)}</select>
        <select value={doctorFilter} onChange={e => setDoctorFilter(e.target.value)} className="px-2.5 py-1.5 text-[10px] border rounded-xl"><option value="all">All Doctors</option>{uniqueDoctors.map(d => <option key={d} value={d}>{d}</option>)}</select>
        <div className="relative ml-auto"><Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" /><input value={ipdSearch} onChange={e => setIpdSearch(e.target.value)} placeholder="Patient, UHID, IPD#..." className="pl-8 pr-3 py-1.5 text-[10px] border rounded-xl w-52 outline-none" /></div>
      </div>

      {/* Table */}
      {loading ? <TableSkeleton rows={6} cols={5} /> :
      filtered.length === 0 ? <div className="text-center py-12 bg-white rounded-2xl border text-gray-400">No admissions</div> :
      <div className="bg-white rounded-2xl border overflow-hidden">
        <table className="w-full text-xs"><thead><tr><th>IPD #</th><th>Patient</th><th>Doctor</th><th>Dept</th><th>Type</th><th>Payor</th><th>Admitted</th><th>LOS</th><th>Status</th><th>Actions</th></tr></thead>
          <tbody>{filtered.map(a => (
            <tr key={a.id}>
              <td><Link href={`/ipd/${a.id}`} className="font-mono text-teal-600 hover:underline text-[11px] font-bold">{a.ipdNumber}</Link></td>
              <td><div className="font-semibold">{a.patientName}</div><div className="text-[10px] text-gray-400">{a.patientUhid}</div></td>
              <td className="text-[11px]">{a.primaryDoctor}</td>
              <td className="text-[11px]">{a.department}</td>
              <td><span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold ${typeBadge(a.admissionType)} uppercase text-[8px]`}>{a.admissionType}</span></td>
              <td className="text-[10px] capitalize">{a.payorType?.replace('_', ' ')}</td>
              <td className="text-[10px]">{new Date(a.admissionDate).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })}</td>
              <td className="font-bold text-[11px]">{a.status === 'discharged' ? '—' : `${daysSince(a.admissionDate)}d`}</td>
              <td><span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold ${stBadge(a.status)}`}>{a.status.replace('_',' ')}</span></td>
              <td><div className="flex gap-1">
                <Link href={`/ipd/${a.id}`} className="px-2 py-1 bg-teal-50 text-teal-700 text-[10px] rounded-lg font-medium hover:bg-teal-100">View</Link>
                {a.status === 'active' && <button onClick={() => { initiateDischarge(a.id); flash('Discharge initiated'); }} className="px-2 py-1 bg-amber-50 text-amber-700 text-[10px] rounded-lg font-medium">Init Disch</button>}
                {a.status === 'discharge_initiated' && <Link href={`/ipd/${a.id}?tab=discharge`} className="px-2 py-1 bg-emerald-600 text-white text-[10px] rounded-lg font-semibold">Discharge</Link>}
              </div></td>
            </tr>
          ))}</tbody>
        </table>
      </div>}

      {/* Admission Modal */}
      {showAdmit && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4" onClick={() => setShowAdmit(false)}>
          <div className="bg-white rounded-2xl w-full max-w-lg p-6 max-h-[90vh] overflow-y-auto space-y-3" onClick={e => e.stopPropagation()}>
            <div className="flex justify-between"><h2 className="text-lg font-bold">New Admission</h2><button onClick={() => setShowAdmit(false)}><X size={18} className="text-gray-400" /></button></div>
            {selPatient ? (
              <div className="flex items-center gap-3 bg-teal-50 rounded-xl p-3 border border-teal-200">
                <div><div className="font-bold text-sm">{selPatient.first_name} {selPatient.last_name}</div><div className="text-[10px] text-gray-500">{selPatient.uhid} · {selPatient.age_years}/{selPatient.gender?.charAt(0)} · {selPatient.phone_primary}</div></div>
                <button onClick={() => { setSelPatient(null); setSearchQ(''); setForm(f => ({ ...f, patientId: '' })); }} className="ml-auto text-xs text-red-500">Change</button>
              </div>
            ) : (
              <div className="relative"><label className="text-[10px] text-gray-500 uppercase font-semibold">Patient *</label>
                <input value={searchQ} onChange={e => setSearchQ(e.target.value)} className="w-full mt-1 px-3 py-2.5 border rounded-xl text-sm" placeholder="Search..." />
                {searchResults.length > 0 && <div className="absolute z-10 mt-1 w-full bg-white border rounded-xl shadow-xl max-h-40 overflow-y-auto">{searchResults.map(p => <button key={p.id} onClick={() => { setSelPatient(p); setForm(f => ({...f, patientId: p.id})); setSearchQ(''); setSearchResults([]); }} className="w-full text-left px-3 py-2.5 hover:bg-teal-50 border-b text-xs">{p.first_name} {p.last_name} — {p.uhid}</button>)}</div>}
              </div>
            )}
            <div className="grid grid-cols-2 gap-3">
              <div><label className="text-[10px] text-gray-500 uppercase font-semibold">Admitting Doctor *</label><select value={form.admittingDoctorId} onChange={e => setForm(f => ({...f, admittingDoctorId: e.target.value}))} className="w-full mt-1 px-3 py-2 border rounded-xl text-sm"><option value="">Select</option>{doctors.map(d => <option key={d.id} value={d.id}>{d.full_name}</option>)}</select></div>
              <div><label className="text-[10px] text-gray-500 uppercase font-semibold">Primary Doctor *</label><select value={form.primaryDoctorId} onChange={e => setForm(f => ({...f, primaryDoctorId: e.target.value}))} className="w-full mt-1 px-3 py-2 border rounded-xl text-sm"><option value="">Select</option>{doctors.map(d => <option key={d.id} value={d.id}>{d.full_name}</option>)}</select></div>
              <div><label className="text-[10px] text-gray-500 uppercase font-semibold">Department *</label><select value={form.departmentId} onChange={e => setForm(f => ({...f, departmentId: e.target.value}))} className="w-full mt-1 px-3 py-2 border rounded-xl text-sm"><option value="">Select</option>{departments.map((d: any) => <option key={d.id} value={d.id}>{d.name}</option>)}</select></div>
              <div><label className="text-[10px] text-gray-500 uppercase font-semibold">Type</label><div className="flex gap-1 mt-1">{['elective','emergency','daycare','transfer'].map(t => <button key={t} onClick={() => setForm(f => ({...f, admissionType: t}))} className={`flex-1 py-2 rounded-lg text-[10px] font-semibold capitalize ${form.admissionType === t ? (t === 'emergency' ? 'bg-red-600 text-white' : 'bg-teal-600 text-white') : 'bg-gray-100 text-gray-500'}`}>{t}</button>)}</div></div>
              <div><label className="text-[10px] text-gray-500 uppercase font-semibold">Payor</label><select value={form.payorType} onChange={e => setForm(f => ({...f, payorType: e.target.value}))} className="w-full mt-1 px-3 py-2 border rounded-xl text-sm">{['self','insurance','corporate','govt_pmjay','govt_cghs','govt_esi'].map(p => <option key={p} value={p}>{p.replace(/_/g,' ')}</option>)}</select></div>
              <div><label className="text-[10px] text-gray-500 uppercase font-semibold">Expected Discharge</label><input type="date" value={form.expectedDischarge} onChange={e => setForm(f => ({...f, expectedDischarge: e.target.value}))} className="w-full mt-1 px-3 py-2 border rounded-xl text-sm" /></div>
            </div>
            {form.payorType === 'insurance' && <div className="grid grid-cols-2 gap-3 bg-blue-50/50 rounded-xl p-3"><div><label className="text-[10px] text-gray-500 uppercase font-semibold">Insurer</label><input value={form.insurerName} onChange={e => setForm(f => ({...f, insurerName: e.target.value}))} className="w-full mt-1 px-3 py-2 border rounded-xl text-sm" /></div><div><label className="text-[10px] text-gray-500 uppercase font-semibold">Policy#</label><input value={form.policyNumber} onChange={e => setForm(f => ({...f, policyNumber: e.target.value}))} className="w-full mt-1 px-3 py-2 border rounded-xl text-sm" /></div></div>}
            <div><div className="flex items-center justify-between"><label className="text-[10px] text-gray-500 uppercase font-semibold">Bed</label><select value={roomTypeFilter} onChange={e => setRoomTypeFilter(e.target.value)} className="px-2 py-1 text-[9px] border rounded-lg"><option value="all">All Types</option>{['general','semi_private','private','icu','nicu','hdu'].map(t => <option key={t} value={t}>{t.replace('_',' ')}</option>)}</select></div>
              <select value={form.bedId} onChange={e => setForm(f => ({...f, bedId: e.target.value}))} className="w-full mt-1 px-3 py-2 border rounded-xl text-sm"><option value="">Assign later</option>{Object.entries(bedGroups).map(([g, gb]) => gb.length > 0 && <optgroup key={g} label={`${g} (${gb.length})`}>{gb.map((b: any) => <option key={b.id} value={b.id}>{b.bed_number} — {b.room?.name||''}</option>)}</optgroup>)}</select>
              <p className="text-[9px] text-gray-400 mt-0.5">{availBeds} beds available</p></div>
            <div><label className="text-[10px] text-gray-500 uppercase font-semibold">Provisional Diagnosis</label><input value={form.provisionalDiagnosis} onChange={e => setForm(f => ({...f, provisionalDiagnosis: e.target.value}))} className="w-full mt-1 px-3 py-2 border rounded-xl text-sm" placeholder="e.g., Acute MI" /></div>
            <button onClick={handleAdmit} disabled={!form.patientId||!form.admittingDoctorId||!form.primaryDoctorId||!form.departmentId} className="w-full py-2.5 bg-teal-600 text-white text-sm rounded-xl font-semibold disabled:opacity-40">Admit Patient</button>
          </div>
        </div>
      )}
    </div>
  );
}

export default function IPDPage() { return <RoleGuard module="ipd"><IPDPageInner /></RoleGuard>; }
