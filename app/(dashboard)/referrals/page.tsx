'use client';
import React, { useState, useMemo, useEffect } from 'react';
import { RoleGuard } from '@/components/ui/shared';
import { useAuthStore } from '@/lib/store/auth';
import { useReferrals, useReferringDoctors, type Referral, type ReferringDoctor } from '@/lib/referrals/referral-hooks';
import { sb } from '@/lib/supabase/browser';

const fmt = (n: number) => Math.round(n).toLocaleString('en-IN');
const INR = (n: number) => n >= 100000 ? `₹${(n/100000).toFixed(1)}L` : `₹${fmt(n)}`;
const STATUS_COLORS: Record<string, string> = {
  received: 'bg-blue-100 text-blue-700', appointment_made: 'bg-indigo-100 text-indigo-700',
  visited: 'bg-teal-100 text-teal-700', admitted: 'bg-purple-100 text-purple-700',
  completed: 'bg-green-100 text-green-700', lost: 'bg-red-100 text-red-700',
};
const FEE_TYPES: Record<string, string> = { percentage: '% of bill', flat: 'Flat amount', slab: 'Slab-based', per_service: 'Per service', none: 'No fee' };

type Tab = 'referrals' | 'doctors' | 'payments' | 'analytics';

function RefInner() {
  const { staff, activeCentreId } = useAuthStore();
  const centreId = activeCentreId || '';
  const staffId = staff?.id || '';
  const ref = useReferrals(centreId);
  const refDocs = useReferringDoctors();

  const [tab, setTab] = useState<Tab>('referrals');
  const [toast, setToast] = useState('');
  const flash = (m: string) => { setToast(m); setTimeout(() => setToast(''), 3000); };

  // Filters
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [typeFilter, setTypeFilter] = useState('all');
  const [docFilter, setDocFilter] = useState('all');

  // H1 doctors (internal)
  const [h1Doctors, setH1Doctors] = useState<any[]>([]);
  const [departments, setDepartments] = useState<any[]>([]);
  useEffect(() => {
    if (!sb() || !centreId) return;
    sb()!.from('hmis_staff').select('id, full_name, specialisation').eq('staff_type', 'doctor').eq('is_active', true).order('full_name').then(({ data }: any) => setH1Doctors(data || []));
    sb()!.from('hmis_departments').select('id, name, type').eq('centre_id', centreId).eq('type', 'clinical').order('name').then(({ data }: any) => setDepartments(data || []));
  }, [centreId]);

  // Modals
  const [showNewRef, setShowNewRef] = useState(false);
  const [showNewDoc, setShowNewDoc] = useState(false);
  const [showPayment, setShowPayment] = useState<Referral | null>(null);
  const [showDetail, setShowDetail] = useState<Referral | null>(null);

  // Patient search
  const [patSearch, setPatSearch] = useState('');
  const [patResults, setPatResults] = useState<any[]>([]);
  const [selPat, setSelPat] = useState<any>(null);
  useEffect(() => {
    if (patSearch.length < 2 || !sb()) { setPatResults([]); return; }
    const t = setTimeout(async () => {
      const { data } = await sb()!.from('hmis_patients').select('id, uhid, first_name, last_name, phone_primary, age_years, gender')
        .or(`uhid.ilike.%${patSearch}%,first_name.ilike.%${patSearch}%,last_name.ilike.%${patSearch}%,phone_primary.ilike.%${patSearch}%`).limit(8);
      setPatResults(data || []);
    }, 300);
    return () => clearTimeout(t);
  }, [patSearch]);

  // Referral form
  const [rf, setRf] = useState({
    referral_type: 'external_in' as string, referring_doctor_id: '', referring_doctor_name: '',
    referring_doctor_phone: '', referring_hospital: '', referring_city: '',
    internal_referring_staff_id: '',
    referred_to_doctor_id: '', referred_to_department: '',
    reason: '', diagnosis: '', urgency: 'routine',
    expected_revenue: '', referral_fee_pct: '', fee_type: 'percentage',
  });

  // Doctor form
  const [df, setDf] = useState({ name: '', phone: '', speciality: '', hospital_name: '', city: '', registration_number: '', pan: '', default_fee_type: 'percentage', default_fee_pct: '10', default_flat_amount: '0', tds_pct: '10' });

  // Payment form
  const [pf, setPf] = useState({ mode: 'neft', utr: '', date: new Date().toISOString().split('T')[0] });

  // When selecting a referring doctor from master, auto-fill
  const onSelectRefDoc = (docId: string) => {
    const doc = refDocs.doctors.find(d => d.id === docId);
    if (doc) {
      setRf(f => ({ ...f, referring_doctor_id: doc.id, referring_doctor_name: doc.name, referring_doctor_phone: doc.phone || '', referring_hospital: doc.hospital_name || '', referring_city: doc.city || '', fee_type: doc.default_fee_type, referral_fee_pct: String(doc.default_fee_pct || 0) }));
    }
  };

  const handleCreateRef = async () => {
    if (!selPat) { flash('Select a patient'); return; }
    if (rf.referral_type === 'external_in' && !rf.referring_doctor_name && !rf.referring_doctor_id) { flash('Enter referring doctor'); return; }
    if (rf.referral_type === 'internal' && !rf.internal_referring_staff_id) { flash('Select internal referring doctor'); return; }

    const feeAmt = rf.expected_revenue && rf.referral_fee_pct ? parseFloat(rf.expected_revenue) * parseFloat(rf.referral_fee_pct) / 100 : 0;

    const payload: any = {
      patient_id: selPat.id, referral_type: rf.referral_type,
      referred_to_doctor_id: rf.referred_to_doctor_id || null,
      referred_to_department: rf.referred_to_department,
      reason: rf.reason, diagnosis: rf.diagnosis, urgency: rf.urgency,
      expected_revenue: rf.expected_revenue ? parseFloat(rf.expected_revenue) : 0,
      referral_fee_pct: rf.referral_fee_pct ? parseFloat(rf.referral_fee_pct) : 0,
      referral_fee_amount: feeAmt, fee_type: rf.fee_type,
    };

    if (rf.referral_type === 'external_in') {
      payload.referring_doctor_id = rf.referring_doctor_id || null;
      payload.referring_doctor_name = rf.referring_doctor_name;
      payload.referring_doctor_phone = rf.referring_doctor_phone;
      payload.referring_hospital = rf.referring_hospital;
      payload.referring_city = rf.referring_city;
    } else if (rf.referral_type === 'internal') {
      payload.internal_referring_staff_id = rf.internal_referring_staff_id;
    }

    const res = await ref.create(payload);
    if (res.success) {
      flash('Referral logged'); setShowNewRef(false); setSelPat(null);
      setRf({ referral_type: 'external_in', referring_doctor_id: '', referring_doctor_name: '', referring_doctor_phone: '', referring_hospital: '', referring_city: '', internal_referring_staff_id: '', referred_to_doctor_id: '', referred_to_department: '', reason: '', diagnosis: '', urgency: 'routine', expected_revenue: '', referral_fee_pct: '', fee_type: 'percentage' });
    } else flash('Error: ' + (res.error || ''));
  };

  const handleCreateDoc = async () => {
    if (!df.name) return;
    const res = await refDocs.create({ ...df, default_fee_pct: parseFloat(df.default_fee_pct) || 0, default_flat_amount: parseFloat(df.default_flat_amount) || 0, tds_pct: parseFloat(df.tds_pct) || 10 });
    if (res.success) { flash('Doctor added'); setShowNewDoc(false); } else flash('Error: ' + (res.error || ''));
  };

  const handlePayment = async () => {
    if (!showPayment) return;
    const res = await ref.markPaid(showPayment.id, { mode: pf.mode, utr: pf.utr, date: pf.date, approved_by: staffId });
    if (res.success) { flash('Payment recorded'); setShowPayment(null); } else flash('Error: ' + (res.error || ''));
  };

  // Filtered referrals
  const filtered = useMemo(() => {
    let list = ref.referrals;
    if (statusFilter !== 'all') list = list.filter(r => r.status === statusFilter);
    if (typeFilter !== 'all') list = list.filter(r => r.referral_type === typeFilter);
    if (docFilter !== 'all') list = list.filter(r => r.referring_doctor_id === docFilter);
    if (search) { const q = search.toLowerCase(); list = list.filter(r => r.referring_doctor_name?.toLowerCase().includes(q) || r.patient_name?.toLowerCase().includes(q) || r.uhid?.toLowerCase().includes(q)); }
    return list;
  }, [ref.referrals, statusFilter, typeFilter, docFilter, search]);

  const unpaidRefs = useMemo(() => ref.referrals.filter(r => r.referral_fee_amount > 0 && !r.fee_paid), [ref.referrals]);

  return (
    <div className="max-w-7xl mx-auto space-y-4">
      {toast && <div className="fixed top-4 left-1/2 -translate-x-1/2 z-50 bg-emerald-600 text-white px-4 py-2 rounded-xl shadow-lg text-sm font-medium">{toast}</div>}

      {/* Header */}
      <div className="flex items-center justify-between">
        <div><h1 className="text-xl font-bold">Referral Management</h1>
          <p className="text-xs text-gray-500">External & internal referrals, fee tracking, settlements</p></div>
        <div className="flex gap-2">
          <button onClick={() => setShowNewDoc(true)} className="px-4 py-2 bg-white border text-xs rounded-lg hover:bg-gray-50">+ Referring Doctor</button>
          <button onClick={() => setShowNewRef(true)} className="px-4 py-2 bg-teal-600 text-white text-xs rounded-lg font-medium hover:bg-teal-700">+ Log Referral</button>
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-4 lg:grid-cols-8 gap-2">
        {[
          { l: 'Total', v: ref.stats.total, bg: 'bg-white' },
          { l: 'This Month', v: ref.stats.thisMonth, bg: 'bg-blue-50' },
          { l: 'Converted', v: ref.stats.converted, bg: 'bg-green-50' },
          { l: 'Conv %', v: ref.stats.conversionRate + '%', bg: 'bg-teal-50' },
          { l: 'Revenue', v: INR(ref.stats.totalRevenue), bg: 'bg-purple-50' },
          { l: 'Fees Paid', v: INR(ref.stats.totalFeesPaid), bg: 'bg-green-50' },
          { l: 'Unpaid', v: `${ref.stats.unpaidCount}`, bg: ref.stats.unpaidCount > 0 ? 'bg-red-50' : 'bg-white' },
          { l: 'Unpaid Amt', v: INR(ref.stats.unpaidAmount), bg: ref.stats.unpaidAmount > 0 ? 'bg-red-50' : 'bg-white' },
        ].map(k => (
          <div key={k.l} className={`${k.bg} rounded-xl border p-2 text-center`}>
            <div className="text-[9px] text-gray-500">{k.l}</div>
            <div className="text-lg font-bold">{k.v}</div>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div className="flex gap-1">
        {(['referrals', 'doctors', 'payments', 'analytics'] as Tab[]).map(t =>
          <button key={t} onClick={() => setTab(t)} className={`px-4 py-2 text-xs font-medium rounded-lg transition-colors capitalize ${tab === t ? 'bg-teal-600 text-white' : 'bg-white border hover:bg-gray-50'}`}>
            {t === 'referrals' ? `Referrals (${ref.referrals.length})` : t === 'doctors' ? `Doctor Master (${refDocs.doctors.length})` : t === 'payments' ? `Pending Payments (${unpaidRefs.length})` : 'Analytics'}
          </button>
        )}
      </div>

      {/* ═══ REFERRALS TAB ═══ */}
      {tab === 'referrals' && <>
        <div className="flex gap-2 flex-wrap items-center">
          <input value={search} onChange={e => setSearch(e.target.value)} className="px-3 py-1.5 border rounded-lg text-xs w-48" placeholder="Search patient/doctor..." />
          <select value={statusFilter} onChange={e => { setStatusFilter(e.target.value); ref.load({ status: e.target.value }); }} className="px-3 py-1.5 border rounded-lg text-xs">
            <option value="all">All Status</option>
            {['received','appointment_made','visited','admitted','completed','lost'].map(s => <option key={s} value={s}>{s.replace('_',' ')}</option>)}
          </select>
          <select value={typeFilter} onChange={e => setTypeFilter(e.target.value)} className="px-3 py-1.5 border rounded-lg text-xs">
            <option value="all">All Types</option>
            <option value="external_in">External In</option><option value="internal">Internal</option><option value="external_out">External Out</option>
          </select>
          <select value={docFilter} onChange={e => setDocFilter(e.target.value)} className="px-3 py-1.5 border rounded-lg text-xs">
            <option value="all">All Referring Doctors</option>
            {refDocs.doctors.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
          </select>
        </div>

        {filtered.length === 0 ? <div className="text-center py-12 bg-white rounded-xl border text-gray-400 text-sm">No referrals found</div> :
        <div className="bg-white rounded-xl border overflow-x-auto">
          <table className="w-full text-xs"><thead><tr className="bg-gray-50 border-b">
            <th className="p-2 text-left">Referring Doctor</th><th className="p-2 text-left">Patient</th>
            <th className="p-2">To Dept / Doctor</th><th className="p-2">Type</th><th className="p-2">Urgency</th>
            <th className="p-2">Status</th><th className="p-2 text-right">Revenue</th>
            <th className="p-2 text-right">Fee</th><th className="p-2">Paid</th><th className="p-2">Actions</th>
          </tr></thead><tbody>{filtered.map(r => (
            <tr key={r.id} className="border-b hover:bg-gray-50">
              <td className="p-2"><div className="font-medium">{r.referring_doctor_name || r.internal_staff_name || '—'}</div>
                <div className="text-[10px] text-gray-400">{r.referring_hospital}{r.referring_city ? `, ${r.referring_city}` : ''}</div></td>
              <td className="p-2"><div className="font-medium">{r.patient_name}</div><div className="text-[10px] text-gray-400">{r.uhid}</div></td>
              <td className="p-2 text-center"><div className="text-[10px]">{r.referred_to_department}</div><div className="text-[10px] text-gray-400">{r.referred_to_name}</div></td>
              <td className="p-2 text-center"><span className="text-[9px] bg-gray-100 px-1.5 py-0.5 rounded">{r.referral_type.replace('_',' ')}</span></td>
              <td className="p-2 text-center"><span className={`text-[9px] px-1.5 py-0.5 rounded ${r.urgency === 'emergency' ? 'bg-red-100 text-red-700' : r.urgency === 'urgent' ? 'bg-amber-100 text-amber-700' : 'bg-gray-100 text-gray-600'}`}>{r.urgency}</span></td>
              <td className="p-2 text-center">
                <select value={r.status} onChange={e => ref.update(r.id, { status: e.target.value })}
                  className={`text-[9px] px-1.5 py-0.5 rounded border-0 font-medium ${STATUS_COLORS[r.status] || 'bg-gray-100'}`}>
                  {['received','appointment_made','visited','admitted','completed','lost'].map(s => <option key={s} value={s}>{s.replace('_',' ')}</option>)}
                </select>
              </td>
              <td className="p-2 text-right font-bold">{r.actual_revenue > 0 ? INR(r.actual_revenue) : r.expected_revenue > 0 ? <span className="text-gray-400">{INR(r.expected_revenue)}</span> : '—'}</td>
              <td className="p-2 text-right">
                {r.referral_fee_amount > 0 ? <div>
                  <div className="font-bold">{INR(r.referral_fee_amount)}</div>
                  {r.tds_amount > 0 && <div className="text-[9px] text-gray-400">TDS: {INR(r.tds_amount)} | Net: {INR(r.net_fee_payable)}</div>}
                </div> : <span className="text-gray-300">—</span>}
              </td>
              <td className="p-2 text-center">
                {r.referral_fee_amount > 0 ? (r.fee_paid
                  ? <span className="text-[9px] bg-green-100 text-green-700 px-1.5 py-0.5 rounded font-medium">Paid ✓</span>
                  : <button onClick={() => { setShowPayment(r); setPf({ mode: 'neft', utr: '', date: new Date().toISOString().split('T')[0] }); }} className="text-[9px] bg-red-50 text-red-600 px-1.5 py-0.5 rounded font-medium hover:bg-red-100">Pay</button>
                ) : '—'}
              </td>
              <td className="p-2">
                <div className="flex gap-0.5">
                  <button onClick={() => ref.calculateFee(r.id).then(() => flash('Fee recalculated'))} className="text-[9px] px-1.5 py-0.5 bg-gray-100 rounded hover:bg-blue-50" title="Recalculate fee from bill">⟳ Calc</button>
                  <button onClick={() => setShowDetail(r)} className="text-[9px] px-1.5 py-0.5 bg-gray-100 rounded hover:bg-gray-200">Detail</button>
                </div>
              </td>
            </tr>
          ))}</tbody></table>
        </div>}
      </>}

      {/* ═══ DOCTOR MASTER TAB ═══ */}
      {tab === 'doctors' && <div className="bg-white rounded-xl border overflow-hidden">
        <table className="w-full text-xs"><thead><tr className="bg-gray-50 border-b">
          <th className="p-2 text-left">Doctor Name</th><th className="p-2">Speciality</th><th className="p-2">Hospital / City</th>
          <th className="p-2">Phone</th><th className="p-2">Fee Structure</th><th className="p-2">TDS</th>
          <th className="p-2 text-right">Referrals</th><th className="p-2 text-right">Revenue</th><th className="p-2 text-right">Fees Paid</th>
        </tr></thead><tbody>
          {refDocs.doctors.length === 0 ? <tr><td colSpan={9} className="text-center py-12 text-gray-400">No referring doctors registered. Click "+ Referring Doctor" to add.</td></tr> :
          refDocs.doctors.map(d => (
            <tr key={d.id} className="border-b hover:bg-gray-50">
              <td className="p-2 font-medium">{d.name}{d.registration_number && <div className="text-[9px] text-gray-400">Reg: {d.registration_number}</div>}</td>
              <td className="p-2 text-center text-[10px]">{d.speciality || '—'}</td>
              <td className="p-2 text-center"><div className="text-[10px]">{d.hospital_name || '—'}</div><div className="text-[9px] text-gray-400">{d.city}</div></td>
              <td className="p-2 text-center text-[10px]">{d.phone || '—'}</td>
              <td className="p-2 text-center"><span className="text-[9px] bg-blue-50 text-blue-700 px-1.5 py-0.5 rounded">{FEE_TYPES[d.default_fee_type]}</span>
                {d.default_fee_type === 'percentage' && <div className="text-[10px] font-bold">{d.default_fee_pct}%</div>}
                {d.default_fee_type === 'flat' && <div className="text-[10px] font-bold">₹{fmt(d.default_flat_amount)}</div>}
              </td>
              <td className="p-2 text-center text-[10px]">{d.tds_pct}%</td>
              <td className="p-2 text-right font-bold">{d.total_referrals}</td>
              <td className="p-2 text-right">{d.total_revenue > 0 ? INR(d.total_revenue) : '—'}</td>
              <td className="p-2 text-right">{d.total_fees_paid > 0 ? INR(d.total_fees_paid) : '—'}</td>
            </tr>
          ))}
        </tbody></table>
      </div>}

      {/* ═══ PAYMENTS TAB ═══ */}
      {tab === 'payments' && (unpaidRefs.length === 0
        ? <div className="text-center py-12 bg-white rounded-xl border text-gray-400 text-sm">All referral fees are paid</div>
        : <div className="bg-white rounded-xl border overflow-hidden">
          <table className="w-full text-xs"><thead><tr className="bg-gray-50 border-b">
            <th className="p-2 text-left">Referring Doctor</th><th className="p-2 text-left">Patient</th>
            <th className="p-2">Department</th><th className="p-2 text-right">Revenue</th>
            <th className="p-2 text-right">Fee</th><th className="p-2 text-right">TDS</th>
            <th className="p-2 text-right">Net Payable</th><th className="p-2">Action</th>
          </tr></thead><tbody>{unpaidRefs.map(r => (
            <tr key={r.id} className="border-b hover:bg-gray-50">
              <td className="p-2"><div className="font-medium">{r.referring_doctor_name}</div><div className="text-[10px] text-gray-400">{r.referring_hospital}</div></td>
              <td className="p-2">{r.patient_name} <span className="text-gray-400">{r.uhid}</span></td>
              <td className="p-2 text-center text-[10px]">{r.referred_to_department}</td>
              <td className="p-2 text-right">{INR(r.actual_revenue || r.expected_revenue)}</td>
              <td className="p-2 text-right font-bold">{INR(r.referral_fee_amount)}</td>
              <td className="p-2 text-right text-gray-500">{INR(r.tds_amount)}</td>
              <td className="p-2 text-right font-bold text-red-600">{INR(r.net_fee_payable)}</td>
              <td className="p-2"><button onClick={() => { setShowPayment(r); setPf({ mode: 'neft', utr: '', date: new Date().toISOString().split('T')[0] }); }}
                className="px-2 py-1 bg-green-100 text-green-700 rounded text-[9px] font-medium hover:bg-green-200">Mark Paid</button></td>
            </tr>
          ))}</tbody></table>
          <div className="px-4 py-3 border-t bg-gray-50 flex justify-between text-xs">
            <span>Total unpaid: <b>{unpaidRefs.length}</b> referrals</span>
            <span>Total payable: <b className="text-red-600">{INR(unpaidRefs.reduce((s, r) => s + r.net_fee_payable, 0))}</b></span>
          </div>
        </div>
      )}

      {/* ═══ ANALYTICS TAB ═══ */}
      {tab === 'analytics' && <div className="space-y-4">
        <div className="bg-white rounded-xl border p-5">
          <h3 className="text-sm font-bold mb-3">Top Referring Doctors (by revenue)</h3>
          {ref.stats.topDoctors.length === 0 ? <p className="text-xs text-gray-400">No data yet</p> :
          <div className="space-y-2">{ref.stats.topDoctors.map((d, i) => (
            <div key={i} className="flex items-center gap-3">
              <span className="text-[10px] text-gray-400 w-4">{i + 1}</span>
              <div className="flex-1">
                <div className="flex items-center gap-2"><span className="text-xs font-medium">{d.name}</span><span className="text-[10px] text-gray-400">{d.hospital}</span></div>
                <div className="mt-1 h-2 bg-gray-100 rounded-full overflow-hidden"><div className="h-full bg-teal-500 rounded-full" style={{ width: `${Math.min(100, d.revenue / Math.max(1, ref.stats.topDoctors[0]?.revenue) * 100)}%` }} /></div>
              </div>
              <div className="text-right"><div className="text-xs font-bold">{INR(d.revenue)}</div><div className="text-[10px] text-gray-400">{d.count} refs{d.unpaid > 0 ? ` · ₹${fmt(d.unpaid)} unpaid` : ''}</div></div>
            </div>
          ))}</div>}
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="bg-white rounded-xl border p-5">
            <h3 className="text-sm font-bold mb-3">By Status</h3>
            {Object.entries(ref.stats.byStatus).map(([status, count]) => (
              <div key={status} className="flex items-center justify-between py-1.5 border-b last:border-0">
                <span className={`text-[10px] px-2 py-0.5 rounded font-medium ${STATUS_COLORS[status] || 'bg-gray-100'}`}>{status.replace('_', ' ')}</span>
                <span className="text-xs font-bold">{count as number}</span>
              </div>
            ))}
          </div>
          <div className="bg-white rounded-xl border p-5">
            <h3 className="text-sm font-bold mb-3">By Department</h3>
            {Object.entries(ref.stats.byDept).sort((a: any, b: any) => b[1].revenue - a[1].revenue).map(([dept, data]: any) => (
              <div key={dept} className="flex items-center justify-between py-1.5 border-b last:border-0">
                <span className="text-xs">{dept}</span>
                <div className="text-right"><span className="text-xs font-bold">{data.count}</span><span className="text-[10px] text-gray-400 ml-2">{INR(data.revenue)}</span></div>
              </div>
            ))}
          </div>
        </div>
      </div>}

      {/* ═══ NEW REFERRAL MODAL ═══ */}
      {showNewRef && <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center" onClick={() => setShowNewRef(false)}>
        <div className="bg-white rounded-xl w-[600px] max-h-[90vh] overflow-y-auto p-5 space-y-4" onClick={e => e.stopPropagation()}>
          <div className="flex justify-between"><h3 className="font-bold text-sm">Log Referral</h3><button onClick={() => setShowNewRef(false)} className="text-gray-400 text-lg">×</button></div>

          {/* Referral type */}
          <div className="flex gap-1">{[{v:'external_in',l:'External Incoming'},{v:'internal',l:'Internal'},{v:'external_out',l:'External Outgoing'}].map(t =>
            <button key={t.v} onClick={() => setRf(f => ({...f, referral_type: t.v}))} className={`flex-1 py-2 text-xs rounded-lg font-medium ${rf.referral_type === t.v ? 'bg-teal-600 text-white' : 'bg-gray-100'}`}>{t.l}</button>
          )}</div>

          {/* Patient */}
          {selPat ? <div className="flex items-center gap-3 bg-blue-50 rounded-lg p-3"><div className="font-medium text-sm">{selPat.first_name} {selPat.last_name}</div><div className="text-xs text-gray-500">{selPat.uhid} · {selPat.age_years}y {selPat.gender?.charAt(0)}</div><button onClick={() => setSelPat(null)} className="ml-auto text-xs text-red-500">×</button></div>
          : <div className="relative"><input value={patSearch} onChange={e => setPatSearch(e.target.value)} className="w-full px-3 py-2 border rounded-lg text-sm" placeholder="Search patient..." autoFocus />
            {patResults.length > 0 && <div className="absolute z-10 mt-1 w-full bg-white border rounded-lg shadow-lg max-h-40 overflow-y-auto">{patResults.map(p =>
              <button key={p.id} onClick={() => { setSelPat(p); setPatSearch(''); setPatResults([]); }} className="w-full text-left px-3 py-2 text-xs hover:bg-blue-50 border-b">{p.first_name} {p.last_name} · {p.uhid} · {p.phone_primary}</button>
            )}</div>}</div>}

          {/* Referring Doctor (external) */}
          {rf.referral_type === 'external_in' && <div className="space-y-3">
            <div><label className="text-[10px] text-gray-500">Select from Registered Doctors</label>
              <select value={rf.referring_doctor_id} onChange={e => onSelectRefDoc(e.target.value)} className="w-full px-3 py-2 border rounded-lg text-sm">
                <option value="">— or type new below —</option>
                {refDocs.doctors.map(d => <option key={d.id} value={d.id}>{d.name} ({d.hospital_name || d.city || d.speciality})</option>)}
              </select></div>
            <div className="grid grid-cols-2 gap-3">
              <div><label className="text-[10px] text-gray-500">Doctor Name *</label><input value={rf.referring_doctor_name} onChange={e => setRf(f => ({...f, referring_doctor_name: e.target.value}))} className="w-full px-3 py-2 border rounded-lg text-sm" /></div>
              <div><label className="text-[10px] text-gray-500">Phone</label><input value={rf.referring_doctor_phone} onChange={e => setRf(f => ({...f, referring_doctor_phone: e.target.value}))} className="w-full px-3 py-2 border rounded-lg text-sm" /></div>
              <div><label className="text-[10px] text-gray-500">Hospital</label><input value={rf.referring_hospital} onChange={e => setRf(f => ({...f, referring_hospital: e.target.value}))} className="w-full px-3 py-2 border rounded-lg text-sm" /></div>
              <div><label className="text-[10px] text-gray-500">City</label><input value={rf.referring_city} onChange={e => setRf(f => ({...f, referring_city: e.target.value}))} className="w-full px-3 py-2 border rounded-lg text-sm" /></div>
            </div>
          </div>}

          {/* Internal referral */}
          {rf.referral_type === 'internal' && <div><label className="text-[10px] text-gray-500">Referring Doctor (Internal) *</label>
            <select value={rf.internal_referring_staff_id} onChange={e => setRf(f => ({...f, internal_referring_staff_id: e.target.value}))} className="w-full px-3 py-2 border rounded-lg text-sm">
              <option value="">Select</option>{h1Doctors.map(d => <option key={d.id} value={d.id}>{d.full_name} — {d.specialisation}</option>)}
            </select></div>}

          {/* Referred to */}
          <div className="grid grid-cols-2 gap-3">
            <div><label className="text-[10px] text-gray-500">Referred to Department *</label>
              <select value={rf.referred_to_department} onChange={e => setRf(f => ({...f, referred_to_department: e.target.value}))} className="w-full px-3 py-2 border rounded-lg text-sm">
                <option value="">Select</option>{departments.map(d => <option key={d.id} value={d.name}>{d.name}</option>)}
              </select></div>
            <div><label className="text-[10px] text-gray-500">Referred to Doctor</label>
              <select value={rf.referred_to_doctor_id} onChange={e => setRf(f => ({...f, referred_to_doctor_id: e.target.value}))} className="w-full px-3 py-2 border rounded-lg text-sm">
                <option value="">Select</option>{h1Doctors.map(d => <option key={d.id} value={d.id}>{d.full_name}</option>)}
              </select></div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div><label className="text-[10px] text-gray-500">Reason</label><input value={rf.reason} onChange={e => setRf(f => ({...f, reason: e.target.value}))} className="w-full px-3 py-2 border rounded-lg text-sm" placeholder="e.g. For PTCA" /></div>
            <div><label className="text-[10px] text-gray-500">Diagnosis</label><input value={rf.diagnosis} onChange={e => setRf(f => ({...f, diagnosis: e.target.value}))} className="w-full px-3 py-2 border rounded-lg text-sm" placeholder="e.g. Triple vessel disease" /></div>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div><label className="text-[10px] text-gray-500">Urgency</label><select value={rf.urgency} onChange={e => setRf(f => ({...f, urgency: e.target.value}))} className="w-full px-3 py-2 border rounded-lg text-sm">
              <option value="routine">Routine</option><option value="urgent">Urgent</option><option value="emergency">Emergency</option></select></div>
            <div><label className="text-[10px] text-gray-500">Expected Revenue ₹</label><input type="number" value={rf.expected_revenue} onChange={e => setRf(f => ({...f, expected_revenue: e.target.value}))} className="w-full px-3 py-2 border rounded-lg text-sm" /></div>
            <div><label className="text-[10px] text-gray-500">Fee % <span className="text-[9px] text-gray-400">({rf.fee_type})</span></label><input type="number" value={rf.referral_fee_pct} onChange={e => setRf(f => ({...f, referral_fee_pct: e.target.value}))} className="w-full px-3 py-2 border rounded-lg text-sm" /></div>
          </div>
          {rf.expected_revenue && rf.referral_fee_pct && <div className="text-xs text-gray-500 bg-gray-50 rounded-lg p-2">Estimated fee: <b>₹{fmt(parseFloat(rf.expected_revenue) * parseFloat(rf.referral_fee_pct) / 100)}</b> (recalculated from actual bill on finalization)</div>}

          <button onClick={handleCreateRef} disabled={!selPat} className="w-full py-2.5 bg-teal-600 text-white text-sm rounded-lg font-medium disabled:opacity-40 hover:bg-teal-700">Log Referral</button>
        </div>
      </div>}

      {/* ═══ NEW DOCTOR MODAL ═══ */}
      {showNewDoc && <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center" onClick={() => setShowNewDoc(false)}>
        <div className="bg-white rounded-xl w-[500px] max-h-[90vh] overflow-y-auto p-5 space-y-4" onClick={e => e.stopPropagation()}>
          <div className="flex justify-between"><h3 className="font-bold text-sm">Add Referring Doctor</h3><button onClick={() => setShowNewDoc(false)} className="text-gray-400 text-lg">×</button></div>
          <div className="grid grid-cols-2 gap-3">
            <div><label className="text-[10px] text-gray-500">Name *</label><input value={df.name} onChange={e => setDf(f => ({...f, name: e.target.value}))} className="w-full px-3 py-2 border rounded-lg text-sm" /></div>
            <div><label className="text-[10px] text-gray-500">Phone</label><input value={df.phone} onChange={e => setDf(f => ({...f, phone: e.target.value}))} className="w-full px-3 py-2 border rounded-lg text-sm" /></div>
            <div><label className="text-[10px] text-gray-500">Speciality</label><input value={df.speciality} onChange={e => setDf(f => ({...f, speciality: e.target.value}))} className="w-full px-3 py-2 border rounded-lg text-sm" /></div>
            <div><label className="text-[10px] text-gray-500">Registration #</label><input value={df.registration_number} onChange={e => setDf(f => ({...f, registration_number: e.target.value}))} className="w-full px-3 py-2 border rounded-lg text-sm" /></div>
            <div><label className="text-[10px] text-gray-500">Hospital</label><input value={df.hospital_name} onChange={e => setDf(f => ({...f, hospital_name: e.target.value}))} className="w-full px-3 py-2 border rounded-lg text-sm" /></div>
            <div><label className="text-[10px] text-gray-500">City</label><input value={df.city} onChange={e => setDf(f => ({...f, city: e.target.value}))} className="w-full px-3 py-2 border rounded-lg text-sm" placeholder="Ahmedabad" /></div>
            <div><label className="text-[10px] text-gray-500">PAN</label><input value={df.pan} onChange={e => setDf(f => ({...f, pan: e.target.value}))} className="w-full px-3 py-2 border rounded-lg text-sm" /></div>
            <div><label className="text-[10px] text-gray-500">TDS %</label><input type="number" value={df.tds_pct} onChange={e => setDf(f => ({...f, tds_pct: e.target.value}))} className="w-full px-3 py-2 border rounded-lg text-sm" /></div>
          </div>
          <div className="border-t pt-3">
            <h4 className="text-xs font-bold mb-2">Fee Agreement</h4>
            <div className="grid grid-cols-3 gap-3">
              <div><label className="text-[10px] text-gray-500">Fee Type</label><select value={df.default_fee_type} onChange={e => setDf(f => ({...f, default_fee_type: e.target.value}))} className="w-full px-3 py-2 border rounded-lg text-sm">
                <option value="percentage">Percentage</option><option value="flat">Flat Amount</option><option value="slab">Slab-based</option><option value="none">No Fee</option>
              </select></div>
              {df.default_fee_type === 'percentage' && <div><label className="text-[10px] text-gray-500">Fee %</label><input type="number" value={df.default_fee_pct} onChange={e => setDf(f => ({...f, default_fee_pct: e.target.value}))} className="w-full px-3 py-2 border rounded-lg text-sm" /></div>}
              {df.default_fee_type === 'flat' && <div><label className="text-[10px] text-gray-500">Flat ₹</label><input type="number" value={df.default_flat_amount} onChange={e => setDf(f => ({...f, default_flat_amount: e.target.value}))} className="w-full px-3 py-2 border rounded-lg text-sm" /></div>}
            </div>
          </div>
          <button onClick={handleCreateDoc} disabled={!df.name} className="w-full py-2.5 bg-teal-600 text-white text-sm rounded-lg font-medium disabled:opacity-40 hover:bg-teal-700">Add Doctor</button>
        </div>
      </div>}

      {/* ═══ PAYMENT MODAL ═══ */}
      {showPayment && <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center" onClick={() => setShowPayment(null)}>
        <div className="bg-white rounded-xl w-[400px] p-5 space-y-4" onClick={e => e.stopPropagation()}>
          <h3 className="font-bold text-sm">Record Payment</h3>
          <div className="bg-gray-50 rounded-lg p-3 text-xs space-y-1">
            <div>Doctor: <b>{showPayment.referring_doctor_name}</b></div>
            <div>Patient: <b>{showPayment.patient_name}</b></div>
            <div>Fee: <b>₹{fmt(showPayment.referral_fee_amount)}</b> | TDS: ₹{fmt(showPayment.tds_amount)} | Net: <b className="text-green-700">₹{fmt(showPayment.net_fee_payable)}</b></div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div><label className="text-[10px] text-gray-500">Payment Mode</label><select value={pf.mode} onChange={e => setPf(f => ({...f, mode: e.target.value}))} className="w-full px-3 py-2 border rounded-lg text-sm">
              <option value="neft">NEFT</option><option value="cash">Cash</option><option value="cheque">Cheque</option><option value="upi">UPI</option>
            </select></div>
            <div><label className="text-[10px] text-gray-500">Date</label><input type="date" value={pf.date} onChange={e => setPf(f => ({...f, date: e.target.value}))} className="w-full px-3 py-2 border rounded-lg text-sm" /></div>
          </div>
          <div><label className="text-[10px] text-gray-500">UTR / Reference</label><input value={pf.utr} onChange={e => setPf(f => ({...f, utr: e.target.value}))} className="w-full px-3 py-2 border rounded-lg text-sm" placeholder="NEFT UTR number" /></div>
          <button onClick={handlePayment} className="w-full py-2.5 bg-green-600 text-white text-sm rounded-lg font-medium hover:bg-green-700">Confirm Payment — ₹{fmt(showPayment.net_fee_payable)}</button>
        </div>
      </div>}

      {/* ═══ DETAIL MODAL ═══ */}
      {showDetail && <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center" onClick={() => setShowDetail(null)}>
        <div className="bg-white rounded-xl w-[500px] max-h-[90vh] overflow-y-auto p-5 space-y-3" onClick={e => e.stopPropagation()}>
          <div className="flex justify-between"><h3 className="font-bold text-sm">Referral Detail</h3><button onClick={() => setShowDetail(null)} className="text-gray-400 text-lg">×</button></div>
          <div className="grid grid-cols-2 gap-2 text-xs">
            {[
              ['Type', showDetail.referral_type.replace('_', ' ')], ['Status', showDetail.status],
              ['Patient', showDetail.patient_name], ['UHID', showDetail.uhid],
              ['Referring Dr', showDetail.referring_doctor_name], ['Hospital', showDetail.referring_hospital],
              ['To Dept', showDetail.referred_to_department], ['To Doctor', showDetail.referred_to_name],
              ['Reason', showDetail.reason], ['Diagnosis', showDetail.diagnosis],
              ['Urgency', showDetail.urgency], ['Created', new Date(showDetail.created_at).toLocaleDateString('en-IN')],
              ['Expected Rev', INR(showDetail.expected_revenue)], ['Actual Rev', INR(showDetail.actual_revenue)],
              ['Fee Type', FEE_TYPES[showDetail.fee_type] || showDetail.fee_type], ['Fee %', showDetail.referral_fee_pct + '%'],
              ['Fee Amount', '₹' + fmt(showDetail.referral_fee_amount)], ['TDS', '₹' + fmt(showDetail.tds_amount)],
              ['Net Payable', '₹' + fmt(showDetail.net_fee_payable)], ['Paid', showDetail.fee_paid ? 'Yes ✓' : 'No'],
              ['Payment Mode', showDetail.payment_mode || '—'], ['UTR', showDetail.payment_utr || '—'],
            ].map(([k, v]) => <div key={k as string}><span className="text-gray-400">{k}:</span> <span className="font-medium">{v}</span></div>)}
          </div>
        </div>
      </div>}
    </div>
  );
}

export default function ReferralsPage() { return <RoleGuard module="billing"><RefInner /></RoleGuard>; }
