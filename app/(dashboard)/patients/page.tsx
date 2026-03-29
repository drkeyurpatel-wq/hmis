'use client';

import { useState, useEffect, useCallback } from 'react';
import { exportToCSV } from '@/lib/utils/data-export';
import { sb } from '@/lib/supabase/browser';
import { useAuthStore } from '@/lib/store/auth';
import { formatDate, calculateAge, getInitials, cn } from '@/lib/utils';
import {
  Search, Phone, MapPin, ChevronRight, User, UserPlus, Calendar, Activity, AlertTriangle, Download, MessageSquare,
} from 'lucide-react';
import Link from 'next/link';
import type { Patient } from '@/types/database';


const genderOptions = [{ value: 'male', label: 'Male' }, { value: 'female', label: 'Female' }, { value: 'other', label: 'Other' }];

interface PatientEnriched extends Patient {
  last_visit?: string;
  total_visits?: number;
  total_billed?: number;
  outstanding?: number;
  is_admitted?: boolean;
  has_insurance?: boolean;
}

interface Stats {
  total: number;
  today: number;
  thisMonth: number;
  activeAdmissions: number;
  avgAge: number;
}

interface DuplicateGroup { phone: string; patients: PatientEnriched[]; }

export default function PatientsPage() {
  const { activeCentreId } = useAuthStore();
  const [patients, setPatients] = useState<PatientEnriched[]>([]);
  const [searchQ, setSearchQ] = useState('');
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState<Stats>({ total: 0, today: 0, thisMonth: 0, activeAdmissions: 0, avgAge: 0 });
  const [duplicates, setDuplicates] = useState<DuplicateGroup[]>([]);
  const [showDuplicates, setShowDuplicates] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [merging, setMerging] = useState(false);
  const [toast, setToast] = useState('');
  const flash = (m: string) => { setToast(m); setTimeout(() => setToast(''), 2500); };

  // Filters
  const [filterGender, setFilterGender] = useState('');
  const [filterActive, setFilterActive] = useState<'all' | 'active' | 'inactive'>('active');
  const [filterAdmitted, setFilterAdmitted] = useState(false);
  const [filterInsurance, setFilterInsurance] = useState(false);
  const [filterAgeGroup, setFilterAgeGroup] = useState('');
  const [filterDateFrom, setFilterDateFrom] = useState('');
  const [filterDateTo, setFilterDateTo] = useState('');

  // Load stats
  const loadStats = useCallback(async () => {
    if (!sb() || !activeCentreId) return;
    const today = new Date().toISOString().split('T')[0];
    const monthStart = today.substring(0, 8) + '01';

    const [totalRes, todayRes, monthRes, admRes] = await Promise.all([
      sb()!.from('hmis_patients').select('id', { count: 'exact', head: true }),
      sb()!.from('hmis_patients').select('id', { count: 'exact', head: true }).gte('created_at', today),
      sb()!.from('hmis_patients').select('id', { count: 'exact', head: true }).gte('created_at', monthStart),
      sb()!.from('hmis_admissions').select('id', { count: 'exact', head: true }).eq('status', 'admitted'),
    ]);

    const { data: ages } = await sb()!.from('hmis_patients').select('age_years').not('age_years', 'is', null).limit(500);
    const avgAge = ages?.length ? Math.round(ages.reduce((s: number, p: any) => s + (p.age_years || 0), 0) / ages.length) : 0;

    setStats({
      total: totalRes.count || 0,
      today: todayRes.count || 0,
      thisMonth: monthRes.count || 0,
      activeAdmissions: admRes.count || 0,
      avgAge,
    });
  }, [activeCentreId]);

  // Load patients with enrichment
  const loadPatients = useCallback(async () => {
    if (!activeCentreId || !sb()) return;
    setLoading(true);

    let query = sb()!.from('hmis_patients').select('*').order('created_at', { ascending: false }).limit(100);

    if (filterActive === 'active') query = query.eq('is_active', true);
    else if (filterActive === 'inactive') query = query.eq('is_active', false);

    if (searchQ.trim()) query = query.or(`uhid.ilike.%${searchQ}%,phone_primary.ilike.%${searchQ}%,first_name.ilike.%${searchQ}%,last_name.ilike.%${searchQ}%`);
    if (filterGender) query = query.eq('gender', filterGender);
    if (filterDateFrom) query = query.gte('created_at', filterDateFrom);
    if (filterDateTo) query = query.lte('created_at', filterDateTo + 'T23:59:59');
    if (filterAgeGroup) {
      const [min, max] = filterAgeGroup.split('-').map(Number);
      if (!isNaN(min)) query = query.gte('age_years', min);
      if (!isNaN(max)) query = query.lte('age_years', max);
    }

    const { data: pts } = await query;
    if (!pts || pts.length === 0) { setPatients([]); setLoading(false); return; }

    const ids = pts.map((p: any) => p.id);

    // Enrich with visit counts, billing, admission status
    const [visitRes, billRes, admRes, insRes] = await Promise.all([
      sb()!.from('hmis_emr_encounters').select('patient_id, encounter_date').in('patient_id', ids).order('encounter_date', { ascending: false }),
      sb()!.from('hmis_bills').select('patient_id, total_amount, paid_amount').in('patient_id', ids),
      sb()!.from('hmis_admissions').select('patient_id').in('patient_id', ids).eq('status', 'admitted'),
      sb()!.from('hmis_patient_insurance').select('patient_id').in('patient_id', ids).eq('status', 'active'),
    ]);

    const visitMap = new Map<string, { count: number; last: string }>();
    for (const v of (visitRes.data || [])) {
      const existing = visitMap.get(v.patient_id);
      if (!existing) visitMap.set(v.patient_id, { count: 1, last: v.encounter_date });
      else existing.count++;
    }

    const billMap = new Map<string, { total: number; paid: number }>();
    for (const b of (billRes.data || [])) {
      const existing = billMap.get(b.patient_id) || { total: 0, paid: 0 };
      existing.total += b.total_amount || 0;
      existing.paid += b.paid_amount || 0;
      billMap.set(b.patient_id, existing);
    }

    const admittedSet = new Set((admRes.data || []).map((a: any) => a.patient_id));
    const insuredSet = new Set((insRes.data || []).map((i: any) => i.patient_id));

    const enriched: PatientEnriched[] = pts.map((p: any) => {
      const visit = visitMap.get(p.id);
      const bill = billMap.get(p.id);
      return {
        ...p,
        last_visit: visit?.last || undefined,
        total_visits: visit?.count || 0,
        total_billed: bill?.total || 0,
        outstanding: bill ? bill.total - bill.paid : 0,
        is_admitted: admittedSet.has(p.id),
        has_insurance: insuredSet.has(p.id),
      };
    });

    // Apply client-side filters
    let filtered = enriched;
    if (filterAdmitted) filtered = filtered.filter(p => p.is_admitted);
    if (filterInsurance) filtered = filtered.filter(p => p.has_insurance);

    setPatients(filtered);
    setLoading(false);
  }, [activeCentreId, searchQ, filterGender, filterActive, filterAdmitted, filterInsurance, filterAgeGroup, filterDateFrom, filterDateTo]);

  // Duplicate detection
  const detectDuplicates = useCallback(() => {
    const phoneMap = new Map<string, PatientEnriched[]>();
    for (const p of patients) {
      const phone = p.phone_primary?.replace(/[\s\-]/g, '');
      if (!phone || phone.length < 10) continue;
      const key = phone.slice(-10);
      const group = phoneMap.get(key) || [];
      group.push(p);
      phoneMap.set(key, group);
    }
    setDuplicates(Array.from(phoneMap.entries()).filter(([, v]) => v.length > 1).map(([k, v]) => ({ phone: k, patients: v })));
  }, [patients]);

  useEffect(() => { const t = setTimeout(loadPatients, 300); return () => clearTimeout(t); }, [loadPatients]);
  useEffect(() => { loadStats(); }, [loadStats]);
  useEffect(() => { detectDuplicates(); }, [detectDuplicates]);

  const toggleSelect = (id: string) => setSelected(prev => {
    const next = new Set(prev);
    if (next.has(id)) next.delete(id); else next.add(id);
    return next;
  });

  const selectAll = () => {
    if (selected.size === patients.length) setSelected(new Set());
    else setSelected(new Set(patients.map(p => p.id)));
  };

  const exportSelected = () => {
    const toExport = patients.filter(p => selected.has(p.id));
    if (toExport.length === 0) { flash('Select patients first'); return; }
    exportToCSV(toExport.map(p => ({
      uhid: p.uhid, first_name: p.first_name, last_name: p.last_name,
      gender: p.gender, age: p.age_years, phone: p.phone_primary,
      city: p.city, total_visits: p.total_visits, total_billed: p.total_billed,
      outstanding: p.outstanding, registered: p.created_at?.split('T')[0],
    })), 'patients-export');
    flash(`Exported ${toExport.length} patients`);
  };

  const mergePatients = async (keepId: string, mergeId: string) => {
    if (!sb()) return;
    setMerging(true);
    // Move all related records from mergeId to keepId
    const tables = [
      { table: 'hmis_emr_encounters', field: 'patient_id' },
      { table: 'hmis_bills', field: 'patient_id' },
      { table: 'hmis_ipd_admissions', field: 'patient_id' },
      { table: 'hmis_lab_orders', field: 'patient_id' },
      { table: 'hmis_radiology_orders', field: 'patient_id' },
      { table: 'hmis_pharmacy_dispensing', field: 'patient_id' },
      { table: 'hmis_opd_visits', field: 'patient_id' },
      { table: 'hmis_appointments', field: 'patient_id' },
      { table: 'hmis_patient_allergies', field: 'patient_id' },
      { table: 'hmis_charge_log', field: 'patient_id' },
    ];
    for (const t of tables) {
      await sb()!.from(t.table).update({ [t.field]: keepId }).eq(t.field, mergeId);
    }
    // Deactivate merged patient
    await sb()!.from('hmis_patients').update({ is_active: false }).eq('id', mergeId);
    setMerging(false);
    flash('Patients merged successfully');
    loadPatients();
  };

  const fmt = (n: number) => n >= 100000 ? `${(n / 100000).toFixed(1)}L` : n >= 1000 ? `${(n / 1000).toFixed(1)}K` : n.toString();

  return (
    <div className="max-w-7xl mx-auto">
      {toast && <div className="fixed top-4 left-1/2 -translate-x-1/2 z-50 bg-green-600 text-white px-4 py-2 rounded-lg shadow-lg text-sm">{toast}</div>}

      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div>
          <h1 className="text-xl font-display font-bold text-gray-900">Patients</h1>
          <p className="text-sm text-gray-500 mt-0.5">{patients.length} patients shown</p>
        </div>
        <div className="flex gap-2">
          {duplicates.length > 0 && <button onClick={() => setShowDuplicates(!showDuplicates)} className="flex items-center gap-1 px-3 py-2 bg-h1-yellow-light text-h1-yellow text-xs rounded-lg border border-h1-yellow/30">
            <AlertTriangle size={14} /> {duplicates.length} duplicates
          </button>}
          <Link href="/patients/register" className="flex items-center gap-2 px-4 py-2.5 bg-brand-teal text-white text-sm font-semibold rounded-lg hover:bg-h1-navy/90 transition-all shadow-sm">
            <UserPlus size={16} /> New Registration
          </Link>
        </div>
      </div>

      {/* Statistics Strip */}
      <div className="grid grid-cols-5 gap-3 mb-4">
        {[
          { label: 'Total Patients', value: stats.total.toLocaleString('en-IN'), color: 'bg-h1-teal-light text-h1-teal' },
          { label: 'Registered Today', value: stats.today.toString(), color: 'bg-green-50 text-green-700' },
          { label: 'This Month', value: stats.thisMonth.toString(), color: 'bg-h1-navy-light text-h1-navy' },
          { label: 'Active Admissions', value: stats.activeAdmissions.toString(), color: 'bg-red-50 text-red-700' },
          { label: 'Average Age', value: `${stats.avgAge}y`, color: 'bg-h1-navy-light text-h1-navy' },
        ].map(s => (
          <div key={s.label} className={`rounded-xl p-3 ${s.color}`}>
            <div className="text-lg font-bold">{s.value}</div>
            <div className="text-[10px] opacity-80">{s.label}</div>
          </div>
        ))}
      </div>

      {/* Search + Filters */}
      <div className="space-y-2 mb-4">
        <div className="flex gap-2">
          <div className="relative flex-1">
            <Search size={18} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
            <input type="text" value={searchQ} onChange={e => setSearchQ(e.target.value)} placeholder="Search UHID, name, phone..."
              className="w-full pl-10 pr-4 py-2.5 rounded-xl border bg-white text-sm outline-none shadow-sm" />
          </div>
          <select value={filterGender} onChange={e => setFilterGender(e.target.value)} className="px-3 py-2 rounded-xl border bg-white text-sm">
            <option value="">All genders</option>
            {genderOptions.map(g => <option key={g.value} value={g.value}>{g.label}</option>)}
          </select>
          <select value={filterActive} onChange={e => setFilterActive(e.target.value as any)} className="px-3 py-2 rounded-xl border bg-white text-sm">
            <option value="all">All status</option><option value="active">Active</option><option value="inactive">Inactive</option>
          </select>
          <select value={filterAgeGroup} onChange={e => setFilterAgeGroup(e.target.value)} className="px-3 py-2 rounded-xl border bg-white text-sm">
            <option value="">All ages</option>
            <option value="0-18">0-18y</option><option value="19-40">19-40y</option><option value="41-60">41-60y</option><option value="61-120">60+</option>
          </select>
        </div>
        <div className="flex gap-2 items-center">
          <input type="date" value={filterDateFrom} onChange={e => setFilterDateFrom(e.target.value)} className="px-2 py-1.5 rounded-lg border text-xs" />
          <span className="text-xs text-gray-400">to</span>
          <input type="date" value={filterDateTo} onChange={e => setFilterDateTo(e.target.value)} className="px-2 py-1.5 rounded-lg border text-xs" />
          <label className="flex items-center gap-1 text-xs cursor-pointer">
            <input type="checkbox" checked={filterAdmitted} onChange={e => setFilterAdmitted(e.target.checked)} className="rounded" /> Currently admitted
          </label>
          <label className="flex items-center gap-1 text-xs cursor-pointer">
            <input type="checkbox" checked={filterInsurance} onChange={e => setFilterInsurance(e.target.checked)} className="rounded" /> Has insurance
          </label>
          <div className="flex-1" />
          {/* Bulk actions */}
          {selected.size > 0 && <>
            <span className="text-xs text-gray-500">{selected.size} selected</span>
            <button onClick={exportSelected} className="flex items-center gap-1 px-3 py-1.5 bg-gray-100 text-xs rounded-lg border hover:bg-gray-200">
              <Download size={12} /> Export CSV
            </button>
            <button onClick={() => flash(`Bulk messaging ${selected.size} patients — configure in Integrations`)} className="flex items-center gap-1 px-3 py-1.5 bg-green-50 text-green-700 text-xs rounded-lg border border-green-200 hover:bg-green-100">
              <MessageSquare size={12} /> Bulk SMS/WA
            </button>
          </>}
        </div>
      </div>

      {/* Duplicate Detection Panel */}
      {showDuplicates && duplicates.length > 0 && (
        <div className="bg-h1-yellow-light border border-h1-yellow/30 rounded-xl p-4 mb-4 space-y-3">
          <h3 className="font-bold text-sm text-h1-yellow">Potential Duplicates (same phone number)</h3>
          {duplicates.slice(0, 10).map(g => (
            <div key={g.phone} className="bg-white rounded-lg border p-3">
              <div className="text-[10px] text-gray-400 mb-1">Phone: {g.phone}</div>
              <div className="flex flex-wrap gap-2">
                {g.patients.map(p => (
                  <div key={p.id} className="flex items-center gap-2 bg-gray-50 rounded px-2 py-1 text-xs">
                    <span className="font-medium">{p.first_name} {p.last_name}</span>
                    <span className="text-gray-400 font-mono text-[10px]">{p.uhid}</span>
                    <span className="text-[10px] text-gray-400">{p.created_at?.split('T')[0]}</span>
                  </div>
                ))}
                {g.patients.length === 2 && (
                  <button onClick={() => {
                    const sorted = [...g.patients].sort((a, b) => a.created_at.localeCompare(b.created_at));
                    if (confirm(`Merge ${sorted[1].first_name} (${sorted[1].uhid}) into ${sorted[0].first_name} (${sorted[0].uhid})? This keeps the older UHID.`)) {
                      mergePatients(sorted[0].id, sorted[1].id);
                    }
                  }} disabled={merging} className="px-2 py-1 bg-h1-yellow text-white text-[10px] rounded disabled:opacity-40">
                    {merging ? 'Merging...' : 'Merge'}
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Patient Cards */}
      <div className="bg-white rounded-xl border shadow-sm overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center h-48 text-sm text-gray-400">
            <div className="animate-spin w-5 h-5 border-2 border-gray-300 border-t-brand-600 rounded-full mr-3" /> Loading...
          </div>
        ) : patients.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-48 text-gray-400">
            <User size={32} className="mb-3 text-gray-300" />
            <p className="text-sm font-medium">No patients found</p>
            <Link href="/patients/register" className="mt-2 text-sm text-brand-600 hover:underline font-medium">Register first patient</Link>
          </div>
        ) : (
          <>
            {/* Select all header */}
            <div className="flex items-center gap-3 px-5 py-2 bg-gray-50 border-b text-xs text-gray-500">
              <input type="checkbox" checked={selected.size === patients.length && patients.length > 0} onChange={selectAll} className="rounded" />
              <span className="flex-1">Patient</span>
              <span className="w-20 text-center">Visits</span>
              <span className="w-24 text-right">Billed</span>
              <span className="w-24 text-right">Outstanding</span>
              <span className="w-24 text-center">Last Visit</span>
              <span className="w-36 text-center">Actions</span>
            </div>
            <div className="divide-y divide-gray-100">
              {patients.map(p => (
                <div key={p.id} className="flex items-center gap-3 px-5 py-3 hover:bg-gray-50 transition-colors">
                  <input type="checkbox" checked={selected.has(p.id)} onChange={() => toggleSelect(p.id)} className="rounded" />
                  <Link href={`/patients/${p.id}`} className="flex items-center gap-3 flex-1 min-w-0 group">
                    <div className="w-10 h-10 rounded-full bg-gradient-to-br from-brand-100 to-brand-200 flex items-center justify-center flex-shrink-0 ring-2 ring-white shadow-sm">
                      <span className="text-xs font-bold text-brand-700">{getInitials(`${p.first_name} ${p.last_name}`)}</span>
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5">
                        <span className="text-sm font-semibold text-gray-900 truncate">{p.first_name} {p.last_name}</span>
                        <span className="text-[10px] font-mono bg-gray-100 text-gray-600 px-1 py-0.5 rounded">{p.uhid}</span>
                        {p.is_vip && <span className="text-[8px] font-bold bg-h1-yellow-light text-h1-yellow px-1 py-0.5 rounded">VIP</span>}
                        {p.is_admitted && <span className="text-[8px] font-bold bg-red-100 text-red-700 px-1 py-0.5 rounded animate-pulse">ADMITTED</span>}
                        {p.has_insurance && <span className="text-[8px] bg-h1-teal-light text-h1-teal px-1 py-0.5 rounded">INS</span>}
                      </div>
                      <div className="flex items-center gap-2 text-[11px] text-gray-500 mt-0.5">
                        <span>{p.gender === 'male' ? '♂' : p.gender === 'female' ? '♀' : '⚧'} {p.age_years ? `${p.age_years}y` : ''} {p.blood_group ? `· ${p.blood_group}` : ''}</span>
                        <span className="flex items-center gap-0.5"><Phone size={9} />{p.phone_primary}</span>
                        {p.city && <span className="flex items-center gap-0.5"><MapPin size={9} />{p.city}</span>}
                      </div>
                    </div>
                  </Link>
                  <div className="w-20 text-center text-xs text-gray-600">{p.total_visits || 0}</div>
                  <div className="w-24 text-right text-xs font-medium">{p.total_billed ? `₹${fmt(p.total_billed)}` : '—'}</div>
                  <div className={`w-24 text-right text-xs font-medium ${(p.outstanding || 0) > 0 ? 'text-red-600' : 'text-gray-400'}`}>
                    {(p.outstanding || 0) > 0 ? `₹${fmt(p.outstanding || 0)}` : '—'}
                  </div>
                  <div className="w-24 text-center text-[10px] text-gray-500">
                    {p.last_visit ? new Date(p.last_visit).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' }) : '—'}
                  </div>
                  <div className="w-36 flex gap-1 justify-center">
                    <Link href={`/opd?patient=${p.id}`} className="px-2 py-1 bg-h1-teal-light text-h1-teal text-[10px] rounded border border-h1-teal/20 hover:bg-h1-teal-light">Book Appt</Link>
                    <Link href={`/emr-v2?patient=${p.id}`} className="px-2 py-1 bg-green-50 text-green-700 text-[10px] rounded border border-green-200 hover:bg-green-100">EMR</Link>
                    <Link href={`/patients/${p.id}`} className="px-2 py-1 bg-gray-50 text-gray-600 text-[10px] rounded border hover:bg-gray-100">Profile</Link>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
