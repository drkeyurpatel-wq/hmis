'use client';
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useAuthStore } from '@/lib/store/auth';
import { RoleGuard } from '@/components/ui/shared';
import { sb } from '@/lib/supabase/browser';

const fmt = (n: number) => `₹${Math.round(n).toLocaleString('en-IN')}`;
const STATUS_COLORS: Record<string, string> = {
  pending: 'bg-amber-100 text-amber-700', submitted: 'bg-blue-100 text-blue-700',
  approved: 'bg-green-100 text-green-700', rejected: 'bg-red-100 text-red-700',
  queried: 'bg-purple-100 text-purple-700', expired: 'bg-gray-100 text-gray-500',
  enhancement: 'bg-orange-100 text-orange-700', under_review: 'bg-blue-100 text-blue-700',
  settled: 'bg-emerald-100 text-emerald-700', denied: 'bg-red-100 text-red-700',
  partially_approved: 'bg-amber-100 text-amber-700',
};

type View = 'dashboard' | 'preauths' | 'claims' | 'detail' | 'new';

function InsuranceInner() {
  const { staff, activeCentreId } = useAuthStore();
  const centreId = activeCentreId || '';
  const staffId = staff?.id || '';
  const [view, setView] = useState<View>('dashboard');
  const [toast, setToast] = useState('');
  const flash = (m: string) => { setToast(m); setTimeout(() => setToast(''), 2500); };

  // Data
  const [preAuths, setPreAuths] = useState<any[]>([]);
  const [claims, setClaims] = useState<any[]>([]);
  const [documents, setDocuments] = useState<any[]>([]);
  const [detail, setDetail] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all');

  // New pre-auth form
  const [admissions, setAdmissions] = useState<any[]>([]);
  const [newPA, setNewPA] = useState({ admissionId: '', insuranceId: '', procedure: '', amount: '', notes: '' });

  const load = useCallback(async () => {
    if (!centreId || !sb()) return;
    setLoading(true);
    const [pa, cl] = await Promise.all([
      sb().from('hmis_pre_auth_requests').select('*, admission:hmis_admissions!inner(id, ipd_number, patient:hmis_patients!inner(first_name, last_name, uhid)), insurance:hmis_patient_insurance(policy_number, insurer_name, tpa_name, scheme)').order('created_at', { ascending: false }).limit(100),
      sb().from('hmis_claims').select('*, bill:hmis_bills(bill_number, net_amount, patient:hmis_patients!inner(first_name, last_name, uhid)), preauth:hmis_pre_auth_requests(pre_auth_number, approved_amount)').order('created_at', { ascending: false }).limit(100),
    ]);
    setPreAuths(pa.data || []);
    setClaims(cl.data || []);
    setLoading(false);
  }, [centreId]);

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { load(); }, [load]);

  // Load active admissions for new pre-auth
  useEffect(() => {
    if (!centreId || !sb()) return;
    sb().from('hmis_admissions').select('id, ipd_number, patient:hmis_patients!inner(first_name, last_name, uhid), insurance:hmis_patient_insurance(id, policy_number, insurer_name)')
      .eq('centre_id', centreId).eq('status', 'active').order('admission_date', { ascending: false })
      .then(({ data }: any) => setAdmissions(data || []));
  }, [centreId]);

  const submitPreAuth = async () => {
    if (!newPA.admissionId || !newPA.amount) { flash('Select admission and enter amount'); return; }
    await sb().from('hmis_pre_auth_requests').insert({
      admission_id: newPA.admissionId,
      patient_insurance_id: newPA.insuranceId || null,
      requested_amount: parseFloat(newPA.amount),
      procedure_name: newPA.procedure,
      status: 'pending', submitted_by: staffId,
      notes: newPA.notes,
    });
    setNewPA({ admissionId: '', insuranceId: '', procedure: '', amount: '', notes: '' });
    flash('Pre-auth submitted'); setView('preauths'); load();
  };

  const updatePreAuth = async (id: string, status: string, extra: any = {}) => {
    const upd: any = { status, responded_at: new Date().toISOString(), ...extra };
    await sb().from('hmis_pre_auth_requests').update(upd).eq('id', id);
    flash(`Status updated to ${status}`); load();
    if (detail?.id === id) setDetail({ ...detail, ...upd });
  };

  const submitClaim = async (preAuthId: string, billId: string, amount: number) => {
    await sb().from('hmis_claims').insert({
      pre_auth_id: preAuthId, bill_id: billId,
      claimed_amount: amount, claim_type: 'cashless',
      claim_number: `CLM-${Date.now()}`, status: 'submitted',
    });
    flash('Claim submitted'); load();
  };

  const updateClaim = async (id: string, updates: any) => {
    await sb().from('hmis_claims').update(updates).eq('id', id);
    flash('Claim updated'); load();
  };

  const openDetail = async (pa: any) => {
    setDetail(pa);
    // Load documents
    const { data: docs } = await sb().from('hmis_insurance_documents')
      .select('*').eq('pre_auth_id', pa.id).order('uploaded_at', { ascending: false });
    setDocuments(docs || []);
    setView('detail');
  };

  // Stats
  const paStats = useMemo(() => ({
    pending: preAuths.filter(p => p.status === 'pending').length,
    approved: preAuths.filter(p => p.status === 'approved').length,
    queried: preAuths.filter(p => p.status === 'queried').length,
    rejected: preAuths.filter(p => p.status === 'rejected').length,
    totalRequested: preAuths.reduce((s, p) => s + parseFloat(p.requested_amount || 0), 0),
    totalApproved: preAuths.filter(p => p.approved_amount).reduce((s, p) => s + parseFloat(p.approved_amount || 0), 0),
  }), [preAuths]);

  const clStats = useMemo(() => ({
    submitted: claims.filter(c => ['submitted', 'under_review'].includes(c.status)).length,
    settled: claims.filter(c => c.status === 'settled').length,
    totalClaimed: claims.reduce((s, c) => s + parseFloat(c.claimed_amount || 0), 0),
    totalSettled: claims.filter(c => c.settled_amount).reduce((s, c) => s + parseFloat(c.settled_amount || 0), 0),
    totalDisallowance: claims.reduce((s, c) => s + parseFloat(c.disallowance_amount || 0), 0),
  }), [claims]);

  const filteredPA = filter === 'all' ? preAuths : preAuths.filter(p => p.status === filter);

  return (
    <div className="max-w-7xl mx-auto space-y-4">
      {toast && <div className="fixed top-4 left-1/2 -translate-x-1/2 z-50 bg-teal-600 text-white px-4 py-2 rounded-lg shadow-lg text-sm">{toast}</div>}

      <div className="flex items-center justify-between">
        <div><h1 className="text-xl font-bold">Insurance Management</h1><p className="text-xs text-gray-500">Pre-auth, claims, settlement tracking</p></div>
        <div className="flex gap-1">
          {(['dashboard', 'preauths', 'claims', 'new'] as View[]).map(v => (
            <button key={v} onClick={() => setView(v)} className={`px-3 py-1.5 text-xs rounded-lg ${view === v ? 'bg-teal-600 text-white' : 'bg-white border'}`}>
              {v === 'dashboard' ? 'Dashboard' : v === 'preauths' ? 'Pre-Auths' : v === 'claims' ? 'Claims' : '+ New Pre-Auth'}
            </button>
          ))}
        </div>
      </div>

      {/* DASHBOARD */}
      {view === 'dashboard' && <>
        <div className="grid grid-cols-6 gap-3">
          <div className="bg-amber-50 rounded-xl border p-3 text-center cursor-pointer" onClick={() => { setFilter('pending'); setView('preauths'); }}><div className="text-2xl font-bold text-amber-700">{paStats.pending}</div><div className="text-[10px] text-gray-500">Pending</div></div>
          <div className="bg-green-50 rounded-xl border p-3 text-center cursor-pointer" onClick={() => { setFilter('approved'); setView('preauths'); }}><div className="text-2xl font-bold text-green-700">{paStats.approved}</div><div className="text-[10px] text-gray-500">Approved</div></div>
          <div className="bg-purple-50 rounded-xl border p-3 text-center cursor-pointer" onClick={() => { setFilter('queried'); setView('preauths'); }}><div className="text-2xl font-bold text-purple-700">{paStats.queried}</div><div className="text-[10px] text-gray-500">Queried</div></div>
          <div className="bg-red-50 rounded-xl border p-3 text-center cursor-pointer" onClick={() => { setFilter('rejected'); setView('preauths'); }}><div className="text-2xl font-bold text-red-700">{paStats.rejected}</div><div className="text-[10px] text-gray-500">Rejected</div></div>
          <div className="bg-blue-50 rounded-xl border p-3 text-center"><div className="text-2xl font-bold text-blue-700">{clStats.submitted}</div><div className="text-[10px] text-gray-500">Claims Pending</div></div>
          <div className="bg-emerald-50 rounded-xl border p-3 text-center"><div className="text-2xl font-bold text-emerald-700">{clStats.settled}</div><div className="text-[10px] text-gray-500">Settled</div></div>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div className="bg-white rounded-xl border p-4">
            <h3 className="font-bold text-sm mb-3">Pre-Auth Summary</h3>
            <div className="space-y-2 text-xs">
              <div className="flex justify-between"><span className="text-gray-500">Total Requested</span><span className="font-bold">{fmt(paStats.totalRequested)}</span></div>
              <div className="flex justify-between"><span className="text-gray-500">Total Approved</span><span className="font-bold text-green-700">{fmt(paStats.totalApproved)}</span></div>
              <div className="flex justify-between"><span className="text-gray-500">Approval Rate</span><span className="font-bold">{preAuths.length > 0 ? Math.round((paStats.approved / preAuths.length) * 100) : 0}%</span></div>
            </div>
          </div>
          <div className="bg-white rounded-xl border p-4">
            <h3 className="font-bold text-sm mb-3">Claims Summary</h3>
            <div className="space-y-2 text-xs">
              <div className="flex justify-between"><span className="text-gray-500">Total Claimed</span><span className="font-bold">{fmt(clStats.totalClaimed)}</span></div>
              <div className="flex justify-between"><span className="text-gray-500">Total Settled</span><span className="font-bold text-emerald-700">{fmt(clStats.totalSettled)}</span></div>
              <div className="flex justify-between"><span className="text-gray-500">Total Disallowance</span><span className="font-bold text-red-600">{fmt(clStats.totalDisallowance)}</span></div>
            </div>
          </div>
        </div>
      </>}

      {/* PRE-AUTH LIST */}
      {view === 'preauths' && <>
        <div className="flex gap-1 mb-2">
          {['all', 'pending', 'approved', 'queried', 'rejected'].map(s => (
            <button key={s} onClick={() => setFilter(s)} className={`px-2 py-1 text-[10px] rounded border ${filter === s ? 'bg-teal-600 text-white border-teal-600' : 'bg-white'}`}>{s === 'all' ? 'All' : s.charAt(0).toUpperCase() + s.slice(1)}</button>
          ))}
        </div>
        <div className="bg-white rounded-xl border overflow-hidden">
          <table className="w-full text-xs"><thead><tr className="bg-gray-50 border-b">
            <th className="p-2 text-left">Patient</th><th className="p-2">IPD</th><th className="p-2">Insurer</th><th className="p-2">Procedure</th><th className="p-2 text-right">Requested</th><th className="p-2 text-right">Approved</th><th className="p-2">Status</th><th className="p-2">Date</th>
          </tr></thead><tbody>{filteredPA.map(pa => {
            const pt = pa.admission?.patient;
            return (
              <tr key={pa.id} className="border-b hover:bg-gray-50 cursor-pointer" onClick={() => openDetail(pa)}>
                <td className="p-2 font-medium">{pt?.first_name} {pt?.last_name}<div className="text-[10px] text-gray-400">{pt?.uhid}</div></td>
                <td className="p-2 text-center font-mono">{pa.admission?.ipd_number}</td>
                <td className="p-2 text-center text-gray-500">{pa.insurance?.insurer_name || '—'}</td>
                <td className="p-2 text-center">{pa.procedure_name || '—'}</td>
                <td className="p-2 text-right">{fmt(parseFloat(pa.requested_amount || 0))}</td>
                <td className="p-2 text-right font-medium text-green-700">{pa.approved_amount ? fmt(parseFloat(pa.approved_amount)) : '—'}</td>
                <td className="p-2 text-center"><span className={`px-1.5 py-0.5 rounded text-[9px] font-medium ${STATUS_COLORS[pa.status] || 'bg-gray-100'}`}>{pa.status}</span></td>
                <td className="p-2 text-center text-gray-400">{pa.created_at ? new Date(pa.created_at).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' }) : '—'}</td>
              </tr>
            );
          })}</tbody></table>
          {filteredPA.length === 0 && <div className="p-8 text-center text-gray-400 text-sm">No pre-auth requests</div>}
        </div>
      </>}

      {/* CLAIMS LIST */}
      {view === 'claims' && <div className="bg-white rounded-xl border overflow-hidden">
        <table className="w-full text-xs"><thead><tr className="bg-gray-50 border-b">
          <th className="p-2 text-left">Patient</th><th className="p-2">Bill</th><th className="p-2 text-right">Claimed</th><th className="p-2 text-right">Settled</th><th className="p-2 text-right">Disallowance</th><th className="p-2">Status</th><th className="p-2">UTR</th>
        </tr></thead><tbody>{claims.map(cl => {
          const pt = cl.bill?.patient;
          return (
            <tr key={cl.id} className="border-b hover:bg-gray-50">
              <td className="p-2 font-medium">{pt?.first_name} {pt?.last_name}<div className="text-[10px] text-gray-400">{pt?.uhid}</div></td>
              <td className="p-2 text-center font-mono">{cl.bill?.bill_number}</td>
              <td className="p-2 text-right">{fmt(parseFloat(cl.claimed_amount || 0))}</td>
              <td className="p-2 text-right font-medium text-emerald-700">{cl.settled_amount ? fmt(parseFloat(cl.settled_amount)) : '—'}</td>
              <td className="p-2 text-right text-red-600">{cl.disallowance_amount ? fmt(parseFloat(cl.disallowance_amount)) : '—'}</td>
              <td className="p-2 text-center"><span className={`px-1.5 py-0.5 rounded text-[9px] font-medium ${STATUS_COLORS[cl.status] || 'bg-gray-100'}`}>{cl.status}</span></td>
              <td className="p-2 text-center text-gray-400 font-mono text-[10px]">{cl.utr_number || '—'}</td>
            </tr>
          );
        })}</tbody></table>
        {claims.length === 0 && <div className="p-8 text-center text-gray-400 text-sm">No claims</div>}
      </div>}

      {/* PRE-AUTH DETAIL */}
      {view === 'detail' && detail && <>
        <button onClick={() => { setView('preauths'); setDetail(null); }} className="text-xs text-gray-500 hover:text-teal-600">← Back to list</button>
        <div className="bg-white rounded-xl border p-5 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-base font-bold">{detail.admission?.patient?.first_name} {detail.admission?.patient?.last_name}</h2>
              <div className="text-xs text-gray-500">{detail.admission?.patient?.uhid} · IPD: {detail.admission?.ipd_number}</div>
            </div>
            <span className={`px-2 py-1 rounded text-xs font-medium ${STATUS_COLORS[detail.status]}`}>{detail.status?.toUpperCase()}</span>
          </div>
          <div className="grid grid-cols-3 gap-3 text-xs">
            <div className="bg-gray-50 rounded-lg p-2"><b>Insurer:</b> {detail.insurance?.insurer_name || '—'}</div>
            <div className="bg-gray-50 rounded-lg p-2"><b>Policy:</b> {detail.insurance?.policy_number || '—'}</div>
            <div className="bg-gray-50 rounded-lg p-2"><b>Scheme:</b> {detail.insurance?.scheme || '—'}</div>
            <div className="bg-gray-50 rounded-lg p-2"><b>Requested:</b> {fmt(parseFloat(detail.requested_amount || 0))}</div>
            <div className="bg-green-50 rounded-lg p-2"><b>Approved:</b> {detail.approved_amount ? fmt(parseFloat(detail.approved_amount)) : '—'}</div>
            <div className="bg-gray-50 rounded-lg p-2"><b>Pre-Auth #:</b> {detail.pre_auth_number || '—'}</div>
          </div>
          {detail.procedure_name && <div className="text-xs"><b>Procedure:</b> {detail.procedure_name}</div>}
          {detail.remarks && <div className="text-xs bg-amber-50 rounded-lg p-2"><b>Remarks:</b> {detail.remarks}</div>}

          {/* Status Actions */}
          <div className="flex flex-wrap gap-2">
            {detail.status === 'pending' && <>
              <button onClick={() => updatePreAuth(detail.id, 'approved', {})} className="px-3 py-1.5 bg-green-600 text-white text-xs rounded-lg">Mark Approved</button>
              <button onClick={() => updatePreAuth(detail.id, 'queried', {})} className="px-3 py-1.5 bg-purple-600 text-white text-xs rounded-lg">Query Raised</button>
              <button onClick={() => updatePreAuth(detail.id, 'rejected', {})} className="px-3 py-1.5 bg-red-600 text-white text-xs rounded-lg">Rejected</button>
            </>}
            {detail.status === 'queried' && <button onClick={() => updatePreAuth(detail.id, 'pending', {})} className="px-3 py-1.5 bg-blue-600 text-white text-xs rounded-lg">Query Responded</button>}
            {detail.status === 'approved' && <button onClick={() => updatePreAuth(detail.id, 'enhancement', {})} className="px-3 py-1.5 bg-orange-600 text-white text-xs rounded-lg">Request Enhancement</button>}
          </div>

          {/* Documents */}
          <div>
            <h4 className="text-sm font-bold mb-2">Documents ({documents.length})</h4>
            {documents.map(d => (
              <div key={d.id} className="flex items-center justify-between py-1.5 border-b text-xs">
                <div><span className="px-1 py-0.5 bg-gray-100 rounded text-[9px] mr-1">{d.document_type?.replace(/_/g, ' ')}</span>{d.file_name}</div>
                <a href={d.file_url} target="_blank" rel="noopener noreferrer" className="text-teal-600 hover:text-teal-800">View</a>
              </div>
            ))}
            {documents.length === 0 && <div className="text-xs text-gray-400">No documents uploaded</div>}
          </div>
        </div>
      </>}

      {/* NEW PRE-AUTH */}
      {view === 'new' && <div className="bg-white rounded-xl border p-5 space-y-4">
        <h2 className="font-bold text-sm">New Pre-Authorization Request</h2>
        <div>
          <label className="text-xs text-gray-500 font-medium">Select Admission *</label>
          <select value={newPA.admissionId} onChange={e => {
            const adm = admissions.find((a: any) => a.id === e.target.value);
            setNewPA(p => ({ ...p, admissionId: e.target.value, insuranceId: adm?.insurance?.[0]?.id || '' }));
          }} className="w-full mt-1 px-3 py-2.5 border rounded-lg text-sm">
            <option value="">Select...</option>
            {admissions.map((a: any) => <option key={a.id} value={a.id}>{a.ipd_number} — {a.patient?.first_name} {a.patient?.last_name} ({a.patient?.uhid})</option>)}
          </select>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div><label className="text-xs text-gray-500 font-medium">Procedure</label>
            <input type="text" value={newPA.procedure} onChange={e => setNewPA(p => ({ ...p, procedure: e.target.value }))} className="w-full mt-1 px-3 py-2 border rounded-lg text-sm" placeholder="e.g., Lap Cholecystectomy" /></div>
          <div><label className="text-xs text-gray-500 font-medium">Estimated Amount (₹) *</label>
            <input type="number" value={newPA.amount} onChange={e => setNewPA(p => ({ ...p, amount: e.target.value }))} className="w-full mt-1 px-3 py-2 border rounded-lg text-sm" placeholder="150000" /></div>
        </div>
        <div><label className="text-xs text-gray-500 font-medium">Notes</label>
          <textarea value={newPA.notes} onChange={e => setNewPA(p => ({ ...p, notes: e.target.value }))} className="w-full mt-1 px-3 py-2 border rounded-lg text-sm" rows={2} placeholder="Clinical details, co-morbidities..." /></div>
        <button onClick={submitPreAuth} className="px-6 py-2.5 bg-teal-600 text-white text-sm rounded-lg font-medium">Submit Pre-Auth</button>
      </div>}
    </div>
  );
}

export default function InsurancePage() { return <RoleGuard module="billing"><InsuranceInner /></RoleGuard>; }
