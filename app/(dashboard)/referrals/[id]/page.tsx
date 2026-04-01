'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { RoleGuard, CardSkeleton, TableSkeleton } from '@/components/ui/shared';
import { useAuthStore } from '@/lib/store/auth';
import { sb } from '@/lib/supabase/browser';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from 'recharts';
import type { ReferralSource, PatientReferral } from '@/lib/referrals/types';

const INR = (n: number) => {
  if (n >= 10000000) return `₹${(n / 10000000).toFixed(1)} Cr`;
  if (n >= 100000) return `₹${(n / 100000).toFixed(1)} L`;
  return `₹${Math.round(n).toLocaleString('en-IN')}`;
};

const TYPE_COLORS: Record<string, string> = {
  doctor: 'bg-blue-100 text-blue-700',
  hospital: 'bg-purple-100 text-purple-700',
  insurance_agent: 'bg-amber-100 text-amber-700',
  campaign: 'bg-green-100 text-green-700',
  walkin_source: 'bg-gray-100 text-gray-700',
};

interface PatientRow {
  id: string;
  patient_id: string;
  patient_name: string;
  patient_uhid: string;
  visit_type: string;
  bill_amount: number;
  collection_amount: number;
  created_at: string;
  notes: string | null;
}

function DetailInner() {
  const params = useParams();
  const sourceId = params.id as string;
  const { activeCentreId } = useAuthStore();

  const [source, setSource] = useState<ReferralSource | null>(null);
  const [patients, setPatients] = useState<PatientRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);
  const [editData, setEditData] = useState<Partial<ReferralSource>>({});
  const [editSaving, setEditSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      // Load source
      const { data: srcData, error: srcErr } = await sb()
        .from('referral_sources')
        .select('*, type:referral_source_types(code, label)')
        .eq('id', sourceId)
        .single();

      if (srcErr) { setError(srcErr.message); setLoading(false); return; }

      setSource({
        ...srcData,
        type_code: srcData.type?.code || '',
        type_label: srcData.type?.label || '',
      } as ReferralSource);

      // Load patient referrals
      const { data: patData } = await sb()
        .from('patient_referrals')
        .select(`
          id, patient_id, visit_type, bill_amount, collection_amount, created_at, notes,
          patient:hmis_patients!patient_referrals_patient_id_fkey(first_name, last_name, uhid)
        `)
        .eq('source_id', sourceId)
        .order('created_at', { ascending: false })
        .limit(200);

      setPatients((patData || []).map((p: any) => ({
        id: p.id,
        patient_id: p.patient_id,
        patient_name: `${p.patient?.first_name || ''} ${p.patient?.last_name || ''}`.trim(),
        patient_uhid: p.patient?.uhid || '',
        visit_type: p.visit_type || 'opd',
        bill_amount: parseFloat(p.bill_amount || '0'),
        collection_amount: parseFloat(p.collection_amount || '0'),
        created_at: p.created_at,
        notes: p.notes,
      })));
    } catch (e: any) {
      setError(e?.message || 'Failed to load source details');
    }
    setLoading(false);
  }, [sourceId]);

  useEffect(() => { load(); }, [load]);

  // Stats
  const stats = useMemo(() => {
    const totalPatients = patients.length;
    const totalRevenue = patients.reduce((s, p) => s + p.bill_amount, 0);
    const avgRevenue = totalPatients > 0 ? totalRevenue / totalPatients : 0;
    const ipdCount = patients.filter(p => p.visit_type === 'ipd').length;
    const conversionRate = totalPatients > 0 ? Math.round((ipdCount / totalPatients) * 100) : 0;
    return { totalPatients, totalRevenue, avgRevenue, conversionRate };
  }, [patients]);

  // Monthly trend
  const monthlyTrend = useMemo(() => {
    const byMonth: Record<string, { count: number; revenue: number }> = {};
    patients.forEach(p => {
      const month = p.created_at?.substring(0, 7) || '';
      if (!byMonth[month]) byMonth[month] = { count: 0, revenue: 0 };
      byMonth[month].count++;
      byMonth[month].revenue += p.bill_amount;
    });
    return Object.entries(byMonth)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([month, d]) => ({ month, ...d }));
  }, [patients]);

  const handleSaveEdit = async () => {
    if (!source) return;
    setEditSaving(true);
    const { error: upErr } = await sb()
      .from('referral_sources')
      .update({ ...editData, updated_at: new Date().toISOString() })
      .eq('id', source.id);

    if (upErr) {
      setError(upErr.message);
    } else {
      setEditing(false);
      load();
    }
    setEditSaving(false);
  };

  const CI = 'w-full px-3 py-2 rounded-lg border border-gray-300 text-sm outline-none focus:border-h1-teal focus:ring-1 focus:ring-h1-teal bg-white';
  const CL = 'block text-[10px] font-semibold text-gray-500 mb-0.5';

  if (loading) {
    return (
      <div className="space-y-4">
        <CardSkeleton />
        <div className="grid grid-cols-4 gap-4">{[1,2,3,4].map(i => <CardSkeleton key={i} />)}</div>
        <TableSkeleton rows={6} cols={6} />
      </div>
    );
  }

  if (error || !source) {
    return (
      <div className="max-w-md mx-auto mt-12 text-center">
        <div className="bg-white rounded-xl border p-6">
          <p className="text-sm text-red-600">{error || 'Source not found'}</p>
          <Link href="/referrals" className="mt-3 inline-block text-sm text-h1-teal hover:underline cursor-pointer">← Back to Dashboard</Link>
        </div>
      </div>
    );
  }

  const dormantDays = source.last_referral_date
    ? Math.floor((Date.now() - new Date(source.last_referral_date).getTime()) / (86400000))
    : null;
  const isDormant = dormantDays !== null && dormantDays > 60;

  return (
    <div className="space-y-6">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-xs text-gray-500">
        <Link href="/referrals" className="hover:text-h1-teal cursor-pointer">Referral Tracker</Link>
        <span>/</span>
        <span className="text-gray-900 font-medium">{source.name}</span>
      </div>

      {/* Header */}
      <div className="bg-white rounded-xl border p-5">
        {!editing ? (
          <div className="flex items-start justify-between">
            <div>
              <div className="flex items-center gap-3">
                <h1 className="text-lg font-bold text-gray-900">{source.name}</h1>
                <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-medium ${TYPE_COLORS[source.type_code || ''] || 'bg-gray-100 text-gray-600'}`}>
                  {source.type_label}
                </span>
                {isDormant && <span className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-red-100 text-red-700">Dormant ({dormantDays}d)</span>}
                {source.is_active ? (
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-green-100 text-green-700">Active</span>
                ) : (
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-gray-100 text-gray-500">Inactive</span>
                )}
              </div>
              <div className="flex gap-4 mt-2 text-xs text-gray-500">
                {source.speciality && <span>Speciality: {source.speciality}</span>}
                {source.clinic_name && <span>Clinic: {source.clinic_name}</span>}
                {source.hospital_name && <span>Hospital: {source.hospital_name}</span>}
                {source.company && <span>Company: {source.company}</span>}
                {source.city && <span>City: {source.city}</span>}
                {source.phone && <span>Phone: {source.phone}</span>}
                {source.email && <span>Email: {source.email}</span>}
              </div>
            </div>
            <button
              onClick={() => { setEditing(true); setEditData({ name: source.name, speciality: source.speciality, clinic_name: source.clinic_name, hospital_name: source.hospital_name, company: source.company, city: source.city, phone: source.phone, email: source.email, notes: source.notes }); }}
              className="px-3 py-1.5 text-xs font-medium bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors cursor-pointer"
            >
              Edit
            </button>
          </div>
        ) : (
          <div className="space-y-3">
            <h2 className="text-sm font-bold text-gray-700">Edit Source Details</h2>
            <div className="grid grid-cols-3 gap-3">
              <div><label className={CL}>Name</label><input className={CI} value={editData.name || ''} onChange={e => setEditData(p => ({ ...p, name: e.target.value }))} /></div>
              <div><label className={CL}>Speciality</label><input className={CI} value={editData.speciality || ''} onChange={e => setEditData(p => ({ ...p, speciality: e.target.value }))} /></div>
              <div><label className={CL}>Clinic Name</label><input className={CI} value={editData.clinic_name || ''} onChange={e => setEditData(p => ({ ...p, clinic_name: e.target.value }))} /></div>
              <div><label className={CL}>Hospital Name</label><input className={CI} value={editData.hospital_name || ''} onChange={e => setEditData(p => ({ ...p, hospital_name: e.target.value }))} /></div>
              <div><label className={CL}>City</label><input className={CI} value={editData.city || ''} onChange={e => setEditData(p => ({ ...p, city: e.target.value }))} /></div>
              <div><label className={CL}>Phone</label><input className={CI} value={editData.phone || ''} onChange={e => setEditData(p => ({ ...p, phone: e.target.value }))} /></div>
              <div><label className={CL}>Email</label><input className={CI} value={editData.email || ''} onChange={e => setEditData(p => ({ ...p, email: e.target.value }))} /></div>
              <div><label className={CL}>Company</label><input className={CI} value={editData.company || ''} onChange={e => setEditData(p => ({ ...p, company: e.target.value }))} /></div>
            </div>
            <div><label className={CL}>Notes</label><textarea className={CI} rows={2} value={editData.notes || ''} onChange={e => setEditData(p => ({ ...p, notes: e.target.value }))} /></div>
            <div className="flex gap-2">
              <button onClick={handleSaveEdit} disabled={editSaving} className="px-4 py-2 text-xs font-medium bg-h1-navy text-white rounded-lg disabled:opacity-50 cursor-pointer">{editSaving ? 'Saving...' : 'Save'}</button>
              <button onClick={() => setEditing(false)} className="px-4 py-2 text-xs font-medium bg-gray-100 rounded-lg cursor-pointer">Cancel</button>
            </div>
          </div>
        )}
      </div>

      {/* Stats Row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard label="Total Patients" value={stats.totalPatients.toLocaleString('en-IN')} />
        <StatCard label="Total Revenue" value={INR(stats.totalRevenue)} />
        <StatCard label="Avg Revenue/Patient" value={INR(stats.avgRevenue)} />
        <StatCard label="IPD Conversion Rate" value={`${stats.conversionRate}%`} />
      </div>

      {/* Monthly Trend Mini Chart */}
      {monthlyTrend.length > 1 && (
        <div className="bg-white rounded-xl border p-5">
          <h2 className="text-sm font-bold text-gray-900 mb-3">Monthly Trend</h2>
          <ResponsiveContainer width="100%" height={180}>
            <LineChart data={monthlyTrend}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis dataKey="month" tick={{ fontSize: 10 }} />
              <YAxis tick={{ fontSize: 10 }} />
              <Tooltip contentStyle={{ fontSize: 11, borderRadius: 8 }} />
              <Line type="monotone" dataKey="count" stroke="#0d9488" strokeWidth={2} dot={{ r: 3 }} name="Patients" />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Patient List Table */}
      <div className="bg-white rounded-xl border overflow-hidden">
        <div className="px-4 py-3 border-b">
          <h2 className="text-sm font-bold text-gray-900">Referred Patients ({patients.length})</h2>
        </div>
        {patients.length === 0 ? (
          <div className="px-4 py-8 text-center text-gray-400 text-sm">No patients referred by this source yet</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="bg-gray-50 text-left text-gray-500 font-medium">
                  <th className="px-4 py-2.5">UHID</th>
                  <th className="px-4 py-2.5">Patient Name</th>
                  <th className="px-4 py-2.5">Visit Date</th>
                  <th className="px-4 py-2.5">Type</th>
                  <th className="px-4 py-2.5 text-right">Bill Amount</th>
                  <th className="px-4 py-2.5">Notes</th>
                </tr>
              </thead>
              <tbody>
                {patients.map(p => (
                  <tr key={p.id} className="border-t hover:bg-gray-50 transition-colors">
                    <td className="px-4 py-2.5 font-mono text-gray-600">{p.patient_uhid}</td>
                    <td className="px-4 py-2.5 font-medium text-gray-900">
                      <Link href={`/patients/${p.patient_id}`} className="hover:text-h1-teal cursor-pointer">{p.patient_name}</Link>
                    </td>
                    <td className="px-4 py-2.5 text-gray-500">{new Date(p.created_at).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}</td>
                    <td className="px-4 py-2.5">
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-medium ${p.visit_type === 'ipd' ? 'bg-purple-100 text-purple-700' : 'bg-blue-100 text-blue-700'}`}>
                        {p.visit_type.toUpperCase()}
                      </span>
                    </td>
                    <td className="px-4 py-2.5 text-right font-medium">{p.bill_amount > 0 ? INR(p.bill_amount) : '—'}</td>
                    <td className="px-4 py-2.5 text-gray-400 truncate max-w-[150px]">{p.notes || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Notes */}
      {source.notes && (
        <div className="bg-white rounded-xl border p-5">
          <h2 className="text-sm font-bold text-gray-900 mb-2">Notes</h2>
          <p className="text-xs text-gray-600">{source.notes}</p>
        </div>
      )}
    </div>
  );
}

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-white rounded-xl border p-4">
      <p className="text-[10px] font-medium text-gray-500 uppercase tracking-wider">{label}</p>
      <p className="text-lg font-bold text-gray-900 mt-1">{value}</p>
    </div>
  );
}

export default function ReferralSourceDetailPage() {
  return (
    <RoleGuard module="referrals">
      <DetailInner />
    </RoleGuard>
  );
}
