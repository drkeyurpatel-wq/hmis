'use client';
import React, { useState, useEffect } from 'react';
import { useIPD, type Admission } from '@/lib/revenue/phase2-hooks';
import { useDoctors } from '@/lib/revenue/hooks';
import { RoleGuard, TableSkeleton, ConfirmModal } from '@/components/ui/shared';
import DischargeForm from '@/components/emr-v2/discharge-form';
import { useAuthStore } from '@/lib/store/auth';
import { createClient } from '@/lib/supabase/client';

let _sb: any = null;
function sb() { if (typeof window === 'undefined') return null as any; if (!_sb) { try { _sb = createClient(); } catch { return null; } } return _sb; }

function IPDPageInner() {
  const { staff, activeCentreId } = useAuthStore();
  const centreId = activeCentreId || '';
  const { admissions, beds, loading, loadAdmissions, admitPatient, dischargePatient, initiateDischarge } = useIPD(centreId);
  const doctors = useDoctors(centreId);
  const [statusFilter, setStatusFilter] = useState('active');
  const [showAdmit, setShowAdmit] = useState(false);
  const [selectedAdm, setSelectedAdm] = useState<Admission | null>(null);
  const [showDischarge, setShowDischarge] = useState(false);
  const [departments, setDepartments] = useState<any[]>([]);

  // Form state
  const [searchQ, setSearchQ] = useState('');
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [form, setForm] = useState({ patientId:'', admittingDoctorId:'', primaryDoctorId:'', departmentId:'', bedId:'', admissionType:'elective', payorType:'self', provisionalDiagnosis:'', expectedDischarge:'' });

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
    setShowAdmit(false); setForm({ patientId:'', admittingDoctorId:'', primaryDoctorId:'', departmentId:'', bedId:'', admissionType:'elective', payorType:'self', provisionalDiagnosis:'', expectedDischarge:'' });
  };

  const activeCount = admissions.filter(a => a.status === 'active').length;
  const dischargeInit = admissions.filter(a => a.status === 'discharge_initiated').length;
  const availBeds = beds.filter((b: any) => b.status === 'available').length;
  const occupiedBeds = beds.filter((b: any) => b.status === 'occupied').length;
  const occupancy = beds.length > 0 ? Math.round(occupiedBeds / beds.length * 100) : 0;

  const stColor = (s: string) => s === 'active' ? 'bg-blue-100 text-blue-800' : s === 'discharge_initiated' ? 'bg-orange-100 text-orange-800' : s === 'discharged' ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-700';
  const typeColor = (t: string) => t === 'emergency' ? 'bg-red-100 text-red-700' : t === 'elective' ? 'bg-blue-100 text-blue-700' : t === 'daycare' ? 'bg-purple-100 text-purple-700' : 'bg-gray-100 text-gray-700';

  return (
    <div className="max-w-6xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div><h1 className="text-2xl font-bold text-gray-900">IPD / Admissions</h1><p className="text-sm text-gray-500">Inpatient management and bed board</p></div>
        <button onClick={() => setShowAdmit(true)} className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700">+ New Admission</button>
      </div>

      <div className="grid grid-cols-5 gap-4 mb-6">
        <div className="bg-blue-50 rounded-xl p-4"><div className="text-xs text-gray-500">Active</div><div className="text-2xl font-bold text-blue-700">{activeCount}</div></div>
        <div className="bg-orange-50 rounded-xl p-4"><div className="text-xs text-gray-500">Discharge initiated</div><div className="text-2xl font-bold text-orange-700">{dischargeInit}</div></div>
        <div className="bg-green-50 rounded-xl p-4"><div className="text-xs text-gray-500">Beds available</div><div className="text-2xl font-bold text-green-700">{availBeds}</div></div>
        <div className="bg-purple-50 rounded-xl p-4"><div className="text-xs text-gray-500">Beds occupied</div><div className="text-2xl font-bold text-purple-700">{occupiedBeds}</div></div>
        <div className={`rounded-xl p-4 ${occupancy > 85 ? 'bg-red-50' : 'bg-gray-50'}`}><div className="text-xs text-gray-500">Occupancy</div><div className={`text-2xl font-bold ${occupancy > 85 ? 'text-red-700' : 'text-gray-700'}`}>{occupancy}%</div></div>
      </div>

      <div className="flex gap-2 mb-4">{[['active','Active'],['discharge_initiated','Discharge Init'],['discharged','Discharged'],['all','All']].map(([k,l]) =>
        <button key={k} onClick={() => setStatusFilter(k)} className={`px-3 py-1.5 text-xs rounded-lg border ${statusFilter === k ? 'bg-blue-600 text-white border-blue-600' : 'bg-white border-gray-200'}`}>{l}</button>
      )}</div>

      {loading ? <div className="text-center py-8 text-gray-400">Loading...</div> :
      admissions.length === 0 ? <div className="text-center py-12 bg-white rounded-xl border text-gray-400">No admissions</div> :
      <div className="bg-white rounded-xl border overflow-hidden"><table className="w-full text-sm"><thead><tr className="bg-gray-50 border-b">
        <th className="text-left p-3 font-medium text-gray-500">IPD #</th><th className="text-left p-3 font-medium text-gray-500">Patient</th>
        <th className="text-left p-3 font-medium text-gray-500">Doctor</th><th className="text-left p-3 font-medium text-gray-500">Dept</th>
        <th className="text-left p-3 font-medium text-gray-500">Type</th><th className="text-left p-3 font-medium text-gray-500">Payor</th>
        <th className="text-left p-3 font-medium text-gray-500">Admitted</th><th className="text-left p-3 font-medium text-gray-500">Status</th>
        <th className="p-3">Actions</th>
      </tr></thead><tbody>{admissions.map(a => (
        <tr key={a.id} className="border-b hover:bg-gray-50">
          <td className="p-3 font-mono text-xs text-blue-600">{a.ipdNumber}</td>
          <td className="p-3"><div className="font-medium">{a.patientName}</div><div className="text-xs text-gray-400">{a.patientUhid}</div></td>
          <td className="p-3 text-xs">{a.primaryDoctor}</td><td className="p-3 text-xs">{a.department}</td>
          <td className="p-3"><span className={`px-2 py-0.5 rounded-full text-xs ${typeColor(a.admissionType)}`}>{a.admissionType}</span></td>
          <td className="p-3 text-xs">{a.payorType}</td>
          <td className="p-3 text-xs">{new Date(a.admissionDate).toLocaleDateString('en-IN')}</td>
          <td className="p-3"><span className={`px-2 py-0.5 rounded-full text-xs ${stColor(a.status)}`}>{a.status.replace('_', ' ')}</span></td>
          <td className="p-3"><div className="flex gap-1">
            {a.status === 'active' && <button onClick={() => initiateDischarge(a.id)} className="px-2 py-1 bg-orange-50 text-orange-700 text-xs rounded hover:bg-orange-100">Init Discharge</button>}
            {a.status === 'discharge_initiated' && <button onClick={() => setSelectedAdm(a)} className="px-2 py-1 bg-green-50 text-green-700 text-xs rounded hover:bg-green-100">Discharge</button>}
            <a href={`/emr-v2?patient=${a.patientId}`} className="px-2 py-1 bg-blue-50 text-blue-700 text-xs rounded hover:bg-blue-100">EMR</a>
          </div></td>
        </tr>
      ))}</tbody></table></div>}

      {showAdmit && <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center" onClick={() => setShowAdmit(false)}>
        <div className="bg-white rounded-xl p-6 w-full max-w-lg shadow-xl max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
          <h2 className="text-lg font-semibold mb-4">New Admission</h2>
          <div className="space-y-3">
            <div><label className="text-xs text-gray-500">Patient *</label>
              <input type="text" placeholder="Search patient..." value={searchQ} onChange={e => setSearchQ(e.target.value)} className="w-full px-3 py-2 border rounded-lg text-sm" />
              {searchResults.length > 0 && <div className="border rounded-lg mt-1 max-h-32 overflow-y-auto">{searchResults.map(p =>
                <button key={p.id} onClick={() => { setForm(f => ({...f, patientId: p.id})); setSearchQ(p.first_name + ' ' + (p.last_name||'')); setSearchResults([]); }}
                  className="w-full text-left px-3 py-1.5 text-xs hover:bg-blue-50">{p.first_name} {p.last_name} — {p.uhid}</button>
              )}</div>}</div>
            <div className="grid grid-cols-2 gap-3">
              <div><label className="text-xs text-gray-500">Admitting Doctor *</label>
                <select value={form.admittingDoctorId} onChange={e => setForm(f => ({...f, admittingDoctorId: e.target.value}))} className="w-full px-3 py-2 border rounded-lg text-sm">
                  <option value="">Select...</option>{doctors.map(d => <option key={d.id} value={d.id}>{d.full_name}</option>)}</select></div>
              <div><label className="text-xs text-gray-500">Primary Doctor *</label>
                <select value={form.primaryDoctorId} onChange={e => setForm(f => ({...f, primaryDoctorId: e.target.value}))} className="w-full px-3 py-2 border rounded-lg text-sm">
                  <option value="">Select...</option>{doctors.map(d => <option key={d.id} value={d.id}>{d.full_name}</option>)}</select></div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div><label className="text-xs text-gray-500">Department *</label>
                <select value={form.departmentId} onChange={e => setForm(f => ({...f, departmentId: e.target.value}))} className="w-full px-3 py-2 border rounded-lg text-sm">
                  <option value="">Select...</option>{departments.map((d: any) => <option key={d.id} value={d.id}>{d.name}</option>)}</select></div>
              <div><label className="text-xs text-gray-500">Admission Type</label>
                <select value={form.admissionType} onChange={e => setForm(f => ({...f, admissionType: e.target.value}))} className="w-full px-3 py-2 border rounded-lg text-sm">
                  {['elective','emergency','transfer','daycare'].map(t => <option key={t}>{t}</option>)}</select></div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div><label className="text-xs text-gray-500">Payor</label>
                <select value={form.payorType} onChange={e => setForm(f => ({...f, payorType: e.target.value}))} className="w-full px-3 py-2 border rounded-lg text-sm">
                  {['self','insurance','corporate','govt_pmjay','govt_cghs','govt_esi'].map(p => <option key={p}>{p}</option>)}</select></div>
              <div><label className="text-xs text-gray-500">Expected discharge</label>
                <input type="date" value={form.expectedDischarge} onChange={e => setForm(f => ({...f, expectedDischarge: e.target.value}))} className="w-full px-3 py-2 border rounded-lg text-sm" /></div>
            </div>
            <div><label className="text-xs text-gray-500">Provisional diagnosis</label>
              <input type="text" value={form.provisionalDiagnosis} onChange={e => setForm(f => ({...f, provisionalDiagnosis: e.target.value}))} placeholder="e.g., Acute MI, Appendicitis..." className="w-full px-3 py-2 border rounded-lg text-sm" /></div>
            <div className="flex gap-2 pt-2">
              <button onClick={handleAdmit} disabled={!form.patientId||!form.admittingDoctorId||!form.primaryDoctorId||!form.departmentId} className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm disabled:opacity-50">Admit Patient</button>
              <button onClick={() => setShowAdmit(false)} className="px-4 py-2 bg-gray-100 rounded-lg text-sm">Cancel</button>
            </div>
          </div>
        </div>
      </div>}

      {/* Discharge Summary Form */}
      {selectedAdm && selectedAdm.status === 'discharge_initiated' && (
        <DischargeForm
          admission={selectedAdm}
          centreId={centreId}
          onClose={() => setSelectedAdm(null)}
          onDischarge={(id, type, dx) => { dischargePatient(id, type, dx); setSelectedAdm(null); }}
        />
      )}
    </div>
  );
}

export default function IPDPage() { return <RoleGuard module="ipd"><IPDPageInner /></RoleGuard>; }
