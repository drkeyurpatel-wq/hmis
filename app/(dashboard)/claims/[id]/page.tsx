// @ts-nocheck
// HEALTH1 HMIS — CLAIM DETAIL (Insurance Desk Workstation)
'use client';

import { useState, useEffect, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useAuthStore } from '@/lib/store/auth';
import { sb } from '@/lib/supabase/browser';
import Link from 'next/link';
import {
  Shield, Clock, FileText, AlertTriangle, IndianRupee,
  CheckCircle2, XCircle, MessageSquare, Send, User,
  Building2, Stethoscope, Calendar, Loader2, Upload,
  RefreshCw, ArrowRight, Phone, Hash, Activity,
  ChevronRight, Eye, Zap, Copy, ExternalLink,
} from 'lucide-react';
import { STATUS_CONFIG, CLAIM_TYPE_LABELS, PRIORITY_CONFIG, type ClaimStatus, type ClaimType } from '@/lib/claims/types';
import {
  fetchClaim, fetchClaimTimeline, updateClaim,
  addClaimQuery, fetchClaimQueries, fetchClaimDocuments,
  uploadClaimDocument, recordSettlement, fetchDocChecklist,
} from '@/lib/claims/api';
import { notifyClaimStatusChange } from '@/lib/claims/notifications';

// ─── Formatters ───
const INR = (n: number | null | undefined) => {
  if (!n) return '—';
  return n >= 100000 ? `₹${(n / 100000).toFixed(2)}L` : `₹${Math.round(n).toLocaleString('en-IN')}`;
};
const shortDate = (d: string | null) => d ? new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: '2-digit' }) : '—';
const daysBetween = (a: string | null, b: string | null) => {
  if (!a) return null;
  const end = b ? new Date(b) : new Date();
  return Math.ceil((end.getTime() - new Date(a).getTime()) / 86400000);
};

// ─── Status Transitions ───
const TRANSITIONS: Record<string, { label: string; status: ClaimStatus; color: string; needsAmount?: boolean }[]> = {
  draft: [
    { label: 'Submit Pre-Auth', status: 'preauth_pending', color: 'bg-amber-600' },
    { label: 'Submit Claim Directly', status: 'claim_submitted', color: 'bg-blue-600' },
  ],
  preauth_pending: [
    { label: 'Approved', status: 'preauth_approved', color: 'bg-green-600', needsAmount: true },
    { label: 'Query Raised', status: 'preauth_query', color: 'bg-orange-600' },
    { label: 'Rejected', status: 'preauth_rejected', color: 'bg-red-600' },
  ],
  preauth_approved: [
    { label: 'Submit Final Claim', status: 'claim_submitted', color: 'bg-blue-600' },
    { label: 'Enhancement', status: 'preauth_enhanced', color: 'bg-purple-600', needsAmount: true },
  ],
  preauth_query: [
    { label: 'Resubmit Pre-Auth', status: 'preauth_pending', color: 'bg-amber-600' },
    { label: 'Rejected', status: 'preauth_rejected', color: 'bg-red-600' },
  ],
  preauth_enhanced: [
    { label: 'Submit Final Claim', status: 'claim_submitted', color: 'bg-blue-600' },
  ],
  preauth_rejected: [
    { label: 'Appeal / Resubmit', status: 'preauth_pending', color: 'bg-amber-600' },
  ],
  claim_submitted: [
    { label: 'Under Review', status: 'claim_under_review', color: 'bg-blue-600' },
    { label: 'Query Raised', status: 'claim_query', color: 'bg-orange-600' },
    { label: 'Approved', status: 'claim_approved', color: 'bg-green-600', needsAmount: true },
  ],
  claim_under_review: [
    { label: 'Approved', status: 'claim_approved', color: 'bg-green-600', needsAmount: true },
    { label: 'Partial', status: 'claim_partial', color: 'bg-yellow-600', needsAmount: true },
    { label: 'Query', status: 'claim_query', color: 'bg-orange-600' },
    { label: 'Rejected', status: 'claim_rejected', color: 'bg-red-600' },
  ],
  claim_query: [
    { label: 'Resubmit Claim', status: 'claim_submitted', color: 'bg-blue-600' },
    { label: 'Rejected', status: 'claim_rejected', color: 'bg-red-600' },
  ],
  claim_approved: [{ label: 'Awaiting Settlement', status: 'settlement_pending', color: 'bg-purple-600' }],
  claim_partial: [{ label: 'Awaiting Settlement', status: 'settlement_pending', color: 'bg-purple-600' }],
  settlement_pending: [{ label: 'Record Settlement', status: 'settled', color: 'bg-emerald-600', needsAmount: true }],
  settled: [{ label: 'Close Claim', status: 'closed', color: 'bg-gray-600' }],
  claim_rejected: [
    { label: 'Appeal', status: 'claim_submitted', color: 'bg-blue-600' },
    { label: 'Write Off', status: 'written_off', color: 'bg-red-800' },
  ],
};

type DetailTab = 'overview' | 'timeline' | 'queries' | 'documents' | 'settlement';

export default function ClaimDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { staff } = useAuthStore();

  const [claim, setClaim] = useState<any>(null);
  const [timeline, setTimeline] = useState<any[]>([]);
  const [queries, setQueries] = useState<any[]>([]);
  const [documents, setDocuments] = useState<any[]>([]);
  const [checklist, setChecklist] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<DetailTab>('overview');
  const [toast, setToast] = useState('');
  const [transitioning, setTransitioning] = useState(false);

  // Modal state
  const [showAmountModal, setShowAmountModal] = useState<{ status: ClaimStatus; label: string } | null>(null);
  const [amountInput, setAmountInput] = useState('');
  const [utrInput, setUtrInput] = useState('');
  const [modeInput, setModeInput] = useState('neft');
  const [deductionInput, setDeductionInput] = useState('');

  // Query form
  const [showQueryForm, setShowQueryForm] = useState(false);
  const [qForm, setQForm] = useState({ text: '', category: 'other', priority: 'medium', role: '' });
  const [savingQuery, setSavingQuery] = useState(false);

  // Doc upload
  const [uploading, setUploading] = useState(false);

  const flash = (m: string) => { setToast(m); setTimeout(() => setToast(''), 2500); };

  // ─── Load Everything ───
  const load = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    try {
      const [c, t, q, d] = await Promise.all([
        fetchClaim(id), fetchClaimTimeline(id),
        fetchClaimQueries(id), fetchClaimDocuments(id),
      ]);
      setClaim(c);
      setTimeline(t);
      setQueries(q);
      setDocuments(d);
      // Load doc checklist based on payer + type
      if (c?.payer_id && c?.claim_type) {
        const cl = await fetchDocChecklist(c.payer_id, c.claim_type);
        setChecklist(cl);
      }
    } catch (e) { console.error(e); }
    setLoading(false);
  }, [id]);

  useEffect(() => { load(); }, [load]);

  // ─── Status Transition ───
  const handleTransition = async (t: { status: ClaimStatus; label: string; needsAmount?: boolean }) => {
    if (t.needsAmount) { setShowAmountModal(t); return; }
    setTransitioning(true);
    try {
      await updateClaim(id, { status: t.status });
      notifyClaimStatusChange(id, t.status).catch(() => {});
      flash(`Status → ${STATUS_CONFIG[t.status]?.label || t.status}`);
      await load();
    } catch (e) { console.error(e); flash('Error updating status'); }
    setTransitioning(false);
  };

  const handleAmountSubmit = async () => {
    if (!showAmountModal || !amountInput) return;
    setTransitioning(true);
    try {
      if (showAmountModal.status === 'settled') {
        await recordSettlement({
          claim_id: id,
          settlement_amount: parseFloat(amountInput),
          deduction_amount: parseFloat(deductionInput) || 0,
          utr_number: utrInput || undefined,
          payment_mode: modeInput,
        });
      } else {
        await updateClaim(id, {
          status: showAmountModal.status,
          approved_amount: parseFloat(amountInput),
        });
      }
      notifyClaimStatusChange(id, showAmountModal.status).catch(() => {});
      flash(`Status → ${STATUS_CONFIG[showAmountModal.status]?.label}`);
      setShowAmountModal(null);
      setAmountInput(''); setUtrInput(''); setDeductionInput('');
      await load();
    } catch (e) { console.error(e); flash('Error recording'); }
    setTransitioning(false);
  };

  // ─── Add Query ───
  const handleAddQuery = async () => {
    if (!qForm.text.trim()) return;
    setSavingQuery(true);
    try {
      await addClaimQuery({ claim_id: id, query_text: qForm.text, query_category: qForm.category, priority: qForm.priority, routed_to_role: qForm.role || undefined });
      setShowQueryForm(false);
      setQForm({ text: '', category: 'other', priority: 'medium', role: '' });
      flash('Query added');
      await load();
    } catch (e) { console.error(e); flash('Error adding query'); }
    setSavingQuery(false);
  };

  // ─── Respond to Query ───
  const handleRespondQuery = async (queryId: string, response: string) => {
    try {
      await sb().from('clm_queries').update({
        response_text: response,
        responded_by: staff?.id,
        responded_at: new Date().toISOString(),
        status: 'responded',
      }).eq('id', queryId);
      flash('Response submitted');
      await load();
    } catch (e) { console.error(e); }
  };

  // ─── Upload Document ───
  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>, docName: string, docCat: string) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      await uploadClaimDocument({ claim_id: id, file, document_name: docName || file.name, document_category: docCat || 'clinical' });
      flash('Document uploaded');
      await load();
    } catch (err) { console.error(err); flash('Upload failed'); }
    setUploading(false);
  };

  // ─── Inline Edit ───
  const inlineUpdate = async (field: string, value: any) => {
    try { await updateClaim(id, { [field]: value }); flash('Updated'); await load(); }
    catch { flash('Update failed'); }
  };

  // ─── Loading / Not Found ───
  if (loading) return (
    <div className="flex items-center justify-center min-h-[60vh]">
      <div className="text-center">
        <Loader2 className="w-8 h-8 text-teal-600 animate-spin mx-auto" />
        <p className="text-sm text-gray-400 mt-2">Loading claim...</p>
      </div>
    </div>
  );
  if (!claim) return (
    <div className="text-center py-20">
      <Shield className="w-12 h-12 text-gray-300 mx-auto mb-3" />
      <p className="text-sm text-gray-500">Claim not found</p>
      <Link href="/claims" className="text-teal-600 text-sm hover:underline mt-2 inline-block">← Back to Claims</Link>
    </div>
  );

  const sc = STATUS_CONFIG[claim.status as ClaimStatus] || STATUS_CONFIG.draft;
  const transitions = TRANSITIONS[claim.status] || [];
  const pc = PRIORITY_CONFIG[claim.priority] || PRIORITY_CONFIG.medium;
  const los = daysBetween(claim.admission_date, claim.discharge_date);
  const daysPending = daysBetween(claim.discharge_date || claim.created_at, null);
  const openQueries = queries.filter(q => ['open', 'in_progress', 'escalated'].includes(q.status));

  const tabConfig: [DetailTab, string, number | null][] = [
    ['overview', 'Overview', null],
    ['timeline', 'Timeline', timeline.length],
    ['queries', 'Queries', queries.length],
    ['documents', 'Documents', documents.length],
    ['settlement', 'Settlement', null],
  ];

  return (
    <div className="max-w-6xl mx-auto pb-8">
      {/* Toast */}
      {toast && <div className="fixed top-4 left-1/2 -translate-x-1/2 z-50 bg-teal-600 text-white px-5 py-2.5 rounded-xl shadow-lg text-sm font-medium animate-in fade-in">{toast}</div>}

      {/* ══════ CLAIM HEADER ══════ */}
      <div className="bg-white rounded-xl border p-4 mb-4">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-4">
            {/* Patient Avatar */}
            <div className="w-12 h-12 rounded-full bg-teal-100 flex items-center justify-center text-teal-700 font-bold text-lg shrink-0">
              {claim.patient_name?.split(' ').map((n: string) => n[0]).join('').slice(0, 2)}
            </div>
            <div>
              <h1 className="text-xl font-bold text-gray-900">{claim.patient_name}</h1>
              <div className="flex items-center gap-1.5 text-xs text-gray-500 flex-wrap mt-1">
                <span className="font-mono bg-gray-100 px-1.5 py-0.5 rounded">{claim.claim_number}</span>
                {claim.patient_uhid && <span className="bg-gray-100 px-1.5 py-0.5 rounded">{claim.patient_uhid}</span>}
                <span className={`px-1.5 py-0.5 rounded-full font-semibold ${sc.bg} ${sc.color}`}>{sc.label}</span>
                <span className={`px-1.5 py-0.5 rounded font-medium ${
                  claim.claim_type === 'pmjay' ? 'bg-green-100 text-green-700' :
                  claim.claim_type === 'corporate' ? 'bg-purple-100 text-purple-700' :
                  'bg-blue-50 text-blue-700'
                }`}>{CLAIM_TYPE_LABELS[claim.claim_type as ClaimType] || claim.claim_type}</span>
                <span className={`px-1.5 py-0.5 rounded font-medium ${pc.bg} ${pc.color}`}>{pc.label}</span>
                {claim.treating_doctor_name && <span className="text-gray-600">{claim.treating_doctor_name}</span>}
                {claim.department_name && <span className="bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded">{claim.department_name}</span>}
                {daysPending && daysPending > 30 && (
                  <span className={`px-1.5 py-0.5 rounded font-bold ${daysPending > 90 ? 'bg-red-600 text-white' : daysPending > 60 ? 'bg-orange-100 text-orange-700' : 'bg-amber-50 text-amber-700'}`}>
                    {daysPending}d pending
                  </span>
                )}
                {openQueries.length > 0 && (
                  <button onClick={() => setTab('queries')} className="px-1.5 py-0.5 rounded font-bold text-[10px] bg-orange-600 text-white animate-pulse">
                    {openQueries.length} Query{openQueries.length > 1 ? 's' : ''}
                  </button>
                )}
              </div>
              {claim.primary_diagnosis && (
                <div className="text-xs text-gray-600 mt-1">
                  <span className="font-medium">Dx:</span> {claim.primary_diagnosis}
                  {claim.icd_code && <span className="font-mono text-gray-400 ml-1">({claim.icd_code})</span>}
                  {claim.procedure_name && <> · <span className="font-medium">Proc:</span> {claim.procedure_name}</>}
                </div>
              )}
            </div>
          </div>

          {/* Right: Actions */}
          <div className="flex flex-col gap-1.5 items-end shrink-0">
            <div className="flex items-center gap-2 text-[10px] text-gray-500">
              <span>Payer: <b className="text-gray-700">{claim.clm_payers?.name || '—'}</b></span>
              {claim.clm_payers?.type && <span className="bg-gray-100 px-1.5 py-0.5 rounded">{claim.clm_payers.type}</span>}
            </div>
            <div className="flex gap-1.5 flex-wrap justify-end">
              {transitions.map(t => (
                <button key={t.status} onClick={() => handleTransition(t)} disabled={transitioning}
                  className={`px-3 py-1.5 text-white text-xs rounded-lg font-medium transition-all hover:opacity-90 disabled:opacity-50 ${t.color}`}>
                  {t.label}
                </button>
              ))}
              {claim.patient_id && (
                <Link href={`/patients/${claim.patient_id}`}
                  className="px-3 py-1.5 bg-gray-100 text-gray-600 text-xs rounded-lg hover:bg-gray-200">Patient</Link>
              )}
              <Link href="/claims" className="px-3 py-1.5 bg-gray-100 text-gray-600 text-xs rounded-lg hover:bg-gray-200">Back</Link>
            </div>
          </div>
        </div>
      </div>

      {/* ══════ FINANCIAL STRIP ══════ */}
      <div className="grid grid-cols-6 gap-2 mb-4">
        {[
          { label: 'Estimated', value: claim.estimated_amount, color: 'text-gray-700', bg: 'bg-white' },
          { label: 'Approved', value: claim.approved_amount, color: 'text-blue-700', bg: 'bg-blue-50' },
          { label: 'Claimed', value: claim.claimed_amount, color: 'text-purple-700', bg: 'bg-purple-50' },
          { label: 'Settled', value: claim.settled_amount, color: 'text-emerald-700', bg: 'bg-emerald-50' },
          { label: 'Deductions', value: claim.deduction_amount, color: 'text-red-700', bg: 'bg-red-50' },
          { label: 'Patient Due', value: claim.patient_payable, color: 'text-orange-700', bg: 'bg-orange-50' },
        ].map((f, i) => (
          <div key={f.label} className={`${f.bg} rounded-xl border p-3 text-center relative`}>
            <p className="text-[10px] text-gray-500 uppercase tracking-wider font-medium">{f.label}</p>
            <p className={`text-lg font-bold font-mono tabular-nums ${f.color} mt-0.5`}>{INR(f.value)}</p>
            {i < 5 && <ChevronRight className="absolute -right-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-300 z-10" />}
          </div>
        ))}
      </div>

      {/* ══════ TABS ══════ */}
      <div className="flex gap-0.5 mb-4 overflow-x-auto border-b pb-px">
        {tabConfig.map(([k, l, count]) => (
          <button key={k} onClick={() => setTab(k)}
            className={`px-3 py-2 text-[11px] font-medium whitespace-nowrap border-b-2 -mb-px flex items-center gap-1.5 transition-colors ${
              tab === k ? 'border-teal-600 text-teal-700' : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}>
            {l}
            {count !== null && count > 0 && (
              <span className={`text-[9px] px-1.5 rounded-full ${tab === k ? 'bg-teal-100 text-teal-600' : 'bg-gray-100 text-gray-400'}`}>{count}</span>
            )}
          </button>
        ))}
      </div>

      {/* ══════ TAB CONTENT ══════ */}

      {/* ── OVERVIEW ── */}
      {tab === 'overview' && (
        <div className="grid grid-cols-3 gap-4">
          {/* Left 2 cols */}
          <div className="col-span-2 space-y-4">
            {/* Clinical Details */}
            <div className="bg-white rounded-xl border p-4">
              <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3 flex items-center gap-1.5">
                <Stethoscope className="w-3.5 h-3.5" /> Clinical Details
              </h3>
              <div className="grid grid-cols-2 gap-x-6 gap-y-2 text-sm">
                <div><span className="text-gray-400 text-xs">Diagnosis</span><p className="font-medium text-gray-900">{claim.primary_diagnosis || '—'}</p></div>
                <div><span className="text-gray-400 text-xs">ICD-10</span><p className="font-mono text-gray-700">{claim.icd_code || '—'}</p></div>
                <div><span className="text-gray-400 text-xs">Procedure</span><p className="font-medium text-gray-900">{claim.procedure_name || '—'}</p></div>
                <div><span className="text-gray-400 text-xs">Department</span><p className="text-gray-700">{claim.department_name || '—'}</p></div>
                <div><span className="text-gray-400 text-xs">Treating Doctor</span><p className="text-gray-700">{claim.treating_doctor_name || '—'}</p></div>
                <div><span className="text-gray-400 text-xs">Package</span><p className="text-gray-700">{claim.package_name || '—'} {claim.package_amount ? `(${INR(claim.package_amount)})` : ''}</p></div>
                <div><span className="text-gray-400 text-xs">Admission</span><p className="text-gray-700">{shortDate(claim.admission_date)} {los ? `(${los}d LOS)` : ''}</p></div>
                <div><span className="text-gray-400 text-xs">Discharge</span><p className="text-gray-700">{shortDate(claim.discharge_date)}</p></div>
              </div>
            </div>

            {/* Patient & Policy */}
            <div className="bg-white rounded-xl border p-4">
              <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3 flex items-center gap-1.5">
                <User className="w-3.5 h-3.5" /> Patient & Policy
              </h3>
              <div className="grid grid-cols-2 gap-x-6 gap-y-2 text-sm">
                <div><span className="text-gray-400 text-xs">Patient</span><p className="font-medium text-gray-900">{claim.patient_name}</p></div>
                <div><span className="text-gray-400 text-xs">UHID</span><p className="font-mono text-gray-700">{claim.patient_uhid || '—'}</p></div>
                <div><span className="text-gray-400 text-xs">Phone</span><p className="text-gray-700">{claim.patient_phone || '—'}</p></div>
                <div><span className="text-gray-400 text-xs">ABHA ID</span><p className="font-mono text-gray-700">{claim.abha_id || '—'}</p></div>
                <div><span className="text-gray-400 text-xs">Policy #</span><p className="font-mono text-gray-700">{claim.policy_number || '—'}</p></div>
                <div><span className="text-gray-400 text-xs">Policyholder</span><p className="text-gray-700">{claim.policy_holder_name || '—'}</p></div>
              </div>
            </div>
          </div>

          {/* Right col — Editable fields + Payer */}
          <div className="space-y-4">
            {/* Payer & References */}
            <div className="bg-white rounded-xl border p-4">
              <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3 flex items-center gap-1.5">
                <Building2 className="w-3.5 h-3.5" /> Payer & References
              </h3>
              <p className="font-medium text-sm text-gray-900">{claim.clm_payers?.name}</p>
              <p className="text-xs text-gray-500 mt-0.5">{claim.clm_payers?.type?.toUpperCase()}</p>
              {claim.clm_payers?.portal_url && (
                <a href={claim.clm_payers.portal_url} target="_blank" rel="noopener noreferrer"
                  className="text-xs text-blue-600 hover:underline flex items-center gap-1 mt-1">
                  <ExternalLink className="w-3 h-3" /> Open Portal
                </a>
              )}
              <div className="mt-3 space-y-2">
                <div>
                  <label className="text-[10px] text-gray-400 uppercase tracking-wider">TPA Claim Reference</label>
                  <input type="text" defaultValue={claim.tpa_claim_number || ''}
                    onBlur={e => { if (e.target.value !== (claim.tpa_claim_number || '')) inlineUpdate('tpa_claim_number', e.target.value); }}
                    placeholder="Enter TPA claim #"
                    className="w-full px-2.5 py-1.5 text-xs font-mono border rounded-lg mt-0.5 focus:ring-2 focus:ring-teal-500 focus:border-transparent" />
                </div>
                <div>
                  <label className="text-[10px] text-gray-400 uppercase tracking-wider">TPA Pre-Auth Reference</label>
                  <input type="text" defaultValue={claim.tpa_preauth_number || ''}
                    onBlur={e => { if (e.target.value !== (claim.tpa_preauth_number || '')) inlineUpdate('tpa_preauth_number', e.target.value); }}
                    placeholder="Enter pre-auth #"
                    className="w-full px-2.5 py-1.5 text-xs font-mono border rounded-lg mt-0.5 focus:ring-2 focus:ring-teal-500 focus:border-transparent" />
                </div>
                <div>
                  <label className="text-[10px] text-gray-400 uppercase tracking-wider">Claimed Amount (₹)</label>
                  <input type="number" defaultValue={claim.claimed_amount || ''}
                    onBlur={e => { const v = parseFloat(e.target.value); if (v && v !== claim.claimed_amount) inlineUpdate('claimed_amount', v); }}
                    placeholder="Final claim amount"
                    className="w-full px-2.5 py-1.5 text-xs font-mono border rounded-lg mt-0.5 focus:ring-2 focus:ring-teal-500 focus:border-transparent" />
                </div>
              </div>
              {claim.settlement_utr && (
                <div className="mt-3 p-2 bg-emerald-50 rounded-lg">
                  <p className="text-[10px] text-emerald-600 uppercase tracking-wider font-medium">Settlement UTR</p>
                  <p className="font-mono text-sm text-emerald-800 font-bold">{claim.settlement_utr}</p>
                  <p className="text-[10px] text-emerald-600 mt-0.5">{shortDate(claim.settlement_date)}</p>
                </div>
              )}
              {claim.medpay_synced && (
                <div className="flex items-center gap-1.5 text-[10px] text-green-600 mt-2">
                  <CheckCircle2 className="w-3 h-3" /> MedPay synced {claim.medpay_synced_at ? shortDate(claim.medpay_synced_at) : ''}
                </div>
              )}
            </div>

            {/* Notes */}
            <div className="bg-white rounded-xl border p-4">
              <label className="text-[10px] text-gray-400 uppercase tracking-wider font-medium">Notes</label>
              <textarea defaultValue={claim.notes || ''} rows={3}
                onBlur={e => { if (e.target.value !== (claim.notes || '')) inlineUpdate('notes', e.target.value); }}
                placeholder="Internal notes..."
                className="w-full px-2.5 py-1.5 text-xs border rounded-lg mt-1 focus:ring-2 focus:ring-teal-500 focus:border-transparent resize-none" />
            </div>
          </div>
        </div>
      )}

      {/* ── TIMELINE ── */}
      {tab === 'timeline' && (
        <div className="bg-white rounded-xl border p-4">
          <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-4">Claim Timeline</h3>
          {timeline.length === 0 ? (
            <p className="text-center text-sm text-gray-400 py-8">No events recorded yet</p>
          ) : (
            <div className="space-y-0">
              {timeline.map((evt, i) => {
                const isStatus = evt.event_type === 'status_change';
                const isQuery = evt.event_type === 'query' || evt.event_type === 'query_response';
                const isSettlement = evt.event_type === 'settlement';
                const isDoc = evt.event_type === 'document';
                const dotColor = isStatus ? 'bg-blue-500' : isQuery ? 'bg-orange-500' : isSettlement ? 'bg-emerald-500' : 'bg-gray-400';
                const bgColor = isSettlement ? 'bg-emerald-50' : isQuery ? 'bg-orange-50' : '';
                return (
                  <div key={i} className="flex gap-3">
                    <div className="flex flex-col items-center">
                      <div className={`w-2.5 h-2.5 rounded-full mt-2 ${dotColor} shrink-0`} />
                      {i < timeline.length - 1 && <div className="w-px flex-1 bg-gray-200 mt-1" />}
                    </div>
                    <div className={`pb-4 flex-1 rounded-lg ${bgColor} ${bgColor ? 'p-2 mb-1' : ''}`}>
                      <div className="flex items-center justify-between">
                        <p className="text-sm font-medium text-gray-800">{evt.event_text}</p>
                        <span className="text-[10px] text-gray-400 shrink-0">
                          {new Date(evt.created_at).toLocaleString('en-IN', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit', hour12: true })}
                        </span>
                      </div>
                      {evt.notes && <p className="text-xs text-gray-500 mt-0.5 italic">{evt.notes}</p>}
                      {evt.source && evt.source !== 'manual' && evt.source !== 'system' && (
                        <span className="text-[9px] text-gray-400 mt-0.5 inline-block">via {evt.source}</span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ── QUERIES ── */}
      {tab === 'queries' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
              TPA Queries ({queries.length}) {openQueries.length > 0 && <span className="text-orange-600 normal-case">· {openQueries.length} open</span>}
            </h3>
            <button onClick={() => setShowQueryForm(!showQueryForm)}
              className="px-3 py-1.5 bg-orange-600 text-white text-xs rounded-lg font-medium hover:bg-orange-700">
              {showQueryForm ? 'Cancel' : '+ Log Query'}
            </button>
          </div>

          {/* Add Query Form */}
          {showQueryForm && (
            <div className="bg-orange-50 border border-orange-200 rounded-xl p-4 space-y-3">
              <textarea value={qForm.text} onChange={e => setQForm(f => ({...f, text: e.target.value}))}
                placeholder="Describe the TPA query in detail..." rows={3}
                className="w-full px-3 py-2 text-sm border rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent" autoFocus />
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="text-[10px] text-gray-500 uppercase">Category</label>
                  <select value={qForm.category} onChange={e => setQForm(f => ({...f, category: e.target.value}))}
                    className="w-full px-2 py-1.5 text-xs border rounded-lg mt-0.5">
                    <option value="clinical">Clinical</option>
                    <option value="billing">Billing</option>
                    <option value="documentation">Documentation</option>
                    <option value="policy">Policy</option>
                    <option value="other">Other</option>
                  </select>
                </div>
                <div>
                  <label className="text-[10px] text-gray-500 uppercase">Priority</label>
                  <select value={qForm.priority} onChange={e => setQForm(f => ({...f, priority: e.target.value}))}
                    className="w-full px-2 py-1.5 text-xs border rounded-lg mt-0.5">
                    <option value="low">Low</option>
                    <option value="medium">Medium</option>
                    <option value="high">High</option>
                    <option value="critical">Critical</option>
                  </select>
                </div>
                <div>
                  <label className="text-[10px] text-gray-500 uppercase">Route To</label>
                  <select value={qForm.role} onChange={e => setQForm(f => ({...f, role: e.target.value}))}
                    className="w-full px-2 py-1.5 text-xs border rounded-lg mt-0.5">
                    <option value="">Auto</option>
                    <option value="doctor">Doctor</option>
                    <option value="insurance_desk">Insurance Desk</option>
                    <option value="billing">Billing</option>
                    <option value="accounts">Accounts</option>
                  </select>
                </div>
              </div>
              <div className="flex justify-end gap-2">
                <button onClick={() => setShowQueryForm(false)} className="px-3 py-1.5 text-xs border rounded-lg hover:bg-gray-50">Cancel</button>
                <button onClick={handleAddQuery} disabled={savingQuery || !qForm.text.trim()}
                  className="px-4 py-1.5 text-xs bg-orange-600 text-white rounded-lg hover:bg-orange-700 disabled:opacity-50 font-medium">
                  {savingQuery ? 'Adding...' : 'Add Query'}
                </button>
              </div>
            </div>
          )}

          {/* Query List */}
          {queries.length === 0 ? (
            <div className="bg-white rounded-xl border p-8 text-center">
              <CheckCircle2 className="w-10 h-10 text-green-300 mx-auto mb-2" />
              <p className="text-sm text-gray-500">No queries on this claim</p>
            </div>
          ) : (
            <div className="space-y-2">
              {queries.map(q => {
                const isOpen = ['open', 'in_progress', 'escalated'].includes(q.status);
                const hrs = Math.round((Date.now() - new Date(q.raised_at).getTime()) / 3600000);
                const prc = PRIORITY_CONFIG[q.priority] || PRIORITY_CONFIG.medium;
                return (
                  <QueryCard key={q.id} q={q} isOpen={isOpen} hrs={hrs} prc={prc}
                    onRespond={handleRespondQuery} staff={staff} />
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ── DOCUMENTS ── */}
      {tab === 'documents' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
              Documents ({documents.length}/{checklist.length} checklist items)
            </h3>
            <label className="px-3 py-1.5 bg-teal-600 text-white text-xs rounded-lg font-medium hover:bg-teal-700 cursor-pointer inline-flex items-center gap-1.5">
              <Upload className="w-3.5 h-3.5" /> {uploading ? 'Uploading...' : 'Upload'}
              <input type="file" className="hidden" accept=".pdf,.jpg,.jpeg,.png,.doc,.docx"
                onChange={e => handleUpload(e, '', 'clinical')} disabled={uploading} />
            </label>
          </div>

          {/* Document Checklist */}
          {checklist.length > 0 && (
            <div className="bg-white rounded-xl border p-4">
              <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">
                Required Documents ({claim.clm_payers?.name})
              </h4>
              <div className="space-y-1.5">
                {checklist.map(item => {
                  const uploaded = documents.find(d => d.document_name === item.document_name);
                  return (
                    <div key={item.id} className={`flex items-center justify-between px-3 py-2 rounded-lg ${uploaded ? 'bg-green-50' : item.is_mandatory ? 'bg-red-50' : 'bg-gray-50'}`}>
                      <div className="flex items-center gap-2">
                        {uploaded ? <CheckCircle2 className="w-4 h-4 text-green-600" /> : <div className={`w-4 h-4 rounded-full border-2 ${item.is_mandatory ? 'border-red-400' : 'border-gray-300'}`} />}
                        <span className={`text-xs ${uploaded ? 'text-green-800' : 'text-gray-700'}`}>{item.document_name}</span>
                        {item.is_mandatory && !uploaded && <span className="text-[9px] text-red-500 font-bold">REQUIRED</span>}
                        {item.hmis_auto_source && !uploaded && <span className="text-[9px] text-blue-500">Auto from HMIS</span>}
                      </div>
                      {!uploaded && (
                        <label className="text-[10px] text-teal-600 hover:underline cursor-pointer font-medium">
                          Upload
                          <input type="file" className="hidden" accept=".pdf,.jpg,.jpeg,.png,.doc,.docx"
                            onChange={e => handleUpload(e, item.document_name, item.document_category)} />
                        </label>
                      )}
                      {uploaded && <span className="text-[10px] text-green-600">{uploaded.status}</span>}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Uploaded Documents */}
          {documents.length > 0 && (
            <div className="bg-white rounded-xl border p-4">
              <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">Uploaded Files</h4>
              <div className="space-y-1.5">
                {documents.map(doc => (
                  <div key={doc.id} className="flex items-center justify-between px-3 py-2 bg-gray-50 rounded-lg">
                    <div className="flex items-center gap-2">
                      <FileText className="w-4 h-4 text-gray-400" />
                      <div>
                        <p className="text-xs font-medium text-gray-800">{doc.document_name}</p>
                        <p className="text-[10px] text-gray-400">{doc.document_category} · {doc.mime_type} · {doc.file_size_bytes ? `${(doc.file_size_bytes / 1024).toFixed(0)}KB` : ''}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className={`text-[10px] px-1.5 py-0.5 rounded ${doc.status === 'uploaded' ? 'bg-blue-100 text-blue-600' : doc.status === 'verified' ? 'bg-green-100 text-green-600' : 'bg-red-100 text-red-600'}`}>{doc.status}</span>
                      {doc.file_url && <a href={doc.file_url} target="_blank" rel="noopener noreferrer" className="text-[10px] text-blue-600 hover:underline">View</a>}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── SETTLEMENT ── */}
      {tab === 'settlement' && (
        <div className="space-y-4">
          {claim.status === 'settled' || claim.status === 'closed' ? (
            <div className="bg-emerald-50 rounded-xl border border-emerald-200 p-6 text-center">
              <CheckCircle2 className="w-12 h-12 text-emerald-500 mx-auto mb-3" />
              <p className="text-lg font-bold text-emerald-800">{INR(claim.settled_amount)}</p>
              <p className="text-sm text-emerald-600 mt-1">Settled on {shortDate(claim.settlement_date)}</p>
              {claim.settlement_utr && <p className="font-mono text-sm text-emerald-700 mt-1">UTR: {claim.settlement_utr}</p>}
              {claim.deduction_amount > 0 && <p className="text-xs text-red-600 mt-2">Deductions: {INR(claim.deduction_amount)}</p>}
              {claim.medpay_synced && <p className="text-xs text-green-600 mt-1 flex items-center justify-center gap-1"><CheckCircle2 className="w-3 h-3" /> MedPay Synced</p>}
            </div>
          ) : ['claim_approved', 'claim_partial', 'settlement_pending'].includes(claim.status) ? (
            <div className="bg-white rounded-xl border p-6">
              <h3 className="text-sm font-semibold text-gray-900 mb-4">Record Settlement</h3>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-[10px] text-gray-500 uppercase tracking-wider">Settlement Amount (₹) *</label>
                  <input type="number" value={amountInput} onChange={e => setAmountInput(e.target.value)}
                    placeholder={String(claim.approved_amount || claim.claimed_amount || '')}
                    className="w-full px-3 py-2 text-sm font-mono border rounded-lg mt-1 focus:ring-2 focus:ring-teal-500" />
                </div>
                <div>
                  <label className="text-[10px] text-gray-500 uppercase tracking-wider">UTR Number</label>
                  <input type="text" value={utrInput} onChange={e => setUtrInput(e.target.value)}
                    placeholder="NEFT/RTGS reference"
                    className="w-full px-3 py-2 text-sm font-mono border rounded-lg mt-1 focus:ring-2 focus:ring-teal-500" />
                </div>
                <div>
                  <label className="text-[10px] text-gray-500 uppercase tracking-wider">Payment Mode</label>
                  <select value={modeInput} onChange={e => setModeInput(e.target.value)}
                    className="w-full px-3 py-2 text-sm border rounded-lg mt-1">
                    <option value="neft">NEFT</option><option value="rtgs">RTGS</option>
                    <option value="cheque">Cheque</option><option value="upi">UPI</option>
                  </select>
                </div>
                <div>
                  <label className="text-[10px] text-gray-500 uppercase tracking-wider">Deduction (₹)</label>
                  <input type="number" value={deductionInput} onChange={e => setDeductionInput(e.target.value)}
                    placeholder="0"
                    className="w-full px-3 py-2 text-sm font-mono border rounded-lg mt-1 focus:ring-2 focus:ring-teal-500" />
                </div>
              </div>
              <button onClick={() => {
                if (!amountInput) return;
                setShowAmountModal({ status: 'settled', label: 'Record Settlement' });
              }} disabled={!amountInput || transitioning}
                className="mt-4 px-6 py-2.5 bg-emerald-600 text-white rounded-xl font-semibold text-sm hover:bg-emerald-700 disabled:opacity-50 flex items-center gap-2">
                <IndianRupee className="w-4 h-4" /> Record Settlement
              </button>
            </div>
          ) : (
            <div className="bg-gray-50 rounded-xl border p-8 text-center">
              <Clock className="w-10 h-10 text-gray-300 mx-auto mb-2" />
              <p className="text-sm text-gray-500">Claim needs to be approved before settlement can be recorded</p>
              <p className="text-xs text-gray-400 mt-1">Current status: {sc.label}</p>
            </div>
          )}
        </div>
      )}

      {/* ══════ AMOUNT MODAL ══════ */}
      {showAmountModal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 backdrop-blur-sm">
          <div className="bg-white rounded-2xl p-6 w-full max-w-md shadow-2xl">
            <h3 className="font-bold text-gray-900 text-lg mb-1">{showAmountModal.label}</h3>
            <p className="text-xs text-gray-500 mb-4">Claim: {claim.claim_number} · {claim.patient_name}</p>
            {showAmountModal.status === 'settled' ? (
              <div className="space-y-3">
                <div>
                  <label className="text-[10px] text-gray-500 uppercase">Settlement Amount (₹)</label>
                  <input type="number" value={amountInput} onChange={e => setAmountInput(e.target.value)}
                    placeholder={String(claim.approved_amount || '')} autoFocus
                    className="w-full px-3 py-2.5 text-lg font-mono border rounded-lg mt-0.5 focus:ring-2 focus:ring-teal-500" />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-[10px] text-gray-500 uppercase">UTR</label>
                    <input type="text" value={utrInput} onChange={e => setUtrInput(e.target.value)}
                      className="w-full px-3 py-2 text-sm font-mono border rounded-lg mt-0.5" />
                  </div>
                  <div>
                    <label className="text-[10px] text-gray-500 uppercase">Deduction (₹)</label>
                    <input type="number" value={deductionInput} onChange={e => setDeductionInput(e.target.value)}
                      placeholder="0" className="w-full px-3 py-2 text-sm font-mono border rounded-lg mt-0.5" />
                  </div>
                </div>
              </div>
            ) : (
              <div>
                <label className="text-[10px] text-gray-500 uppercase">Approved Amount (₹)</label>
                <input type="number" value={amountInput} onChange={e => setAmountInput(e.target.value)}
                  placeholder={String(claim.estimated_amount || '')} autoFocus
                  className="w-full px-3 py-2.5 text-lg font-mono border rounded-lg mt-0.5 focus:ring-2 focus:ring-teal-500" />
              </div>
            )}
            <div className="flex gap-3 mt-5">
              <button onClick={() => { setShowAmountModal(null); setAmountInput(''); setUtrInput(''); setDeductionInput(''); }}
                className="flex-1 py-2.5 text-sm border rounded-xl hover:bg-gray-50 font-medium">Cancel</button>
              <button onClick={handleAmountSubmit} disabled={!amountInput || transitioning}
                className="flex-1 py-2.5 text-sm bg-teal-600 text-white rounded-xl hover:bg-teal-700 disabled:opacity-50 font-semibold">
                {transitioning ? 'Processing...' : 'Confirm'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Query Card Component ───
function QueryCard({ q, isOpen, hrs, prc, onRespond, staff }: any) {
  const [responding, setResponding] = useState(false);
  const [response, setResponse] = useState('');
  const [saving, setSaving] = useState(false);

  const submit = async () => {
    if (!response.trim()) return;
    setSaving(true);
    await onRespond(q.id, response);
    setResponding(false);
    setResponse('');
    setSaving(false);
  };

  return (
    <div className={`bg-white rounded-xl border p-4 ${isOpen ? 'border-orange-200' : ''}`}>
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="text-xs font-bold text-gray-500">Q{q.query_number}</span>
            <span className={`px-1.5 py-0.5 rounded text-[10px] font-semibold ${prc.bg} ${prc.color}`}>{prc.label}</span>
            <span className="text-[10px] px-1.5 py-0.5 rounded bg-gray-100 text-gray-600">{q.query_category}</span>
            <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${
              isOpen ? 'bg-orange-100 text-orange-700' : q.status === 'responded' ? 'bg-blue-100 text-blue-700' : 'bg-green-100 text-green-700'
            }`}>{q.status}</span>
            {q.is_sla_breached && <span className="text-[10px] font-bold text-red-600 bg-red-50 px-1.5 py-0.5 rounded">SLA BREACHED</span>}
            {q.routed_to_role && <span className="text-[10px] text-gray-400">→ {q.routed_to_role}</span>}
          </div>
          <p className="text-sm text-gray-800 mt-2 leading-relaxed">{q.query_text}</p>
          {q.response_text && (
            <div className="mt-2 p-2.5 bg-blue-50 rounded-lg border border-blue-100">
              <p className="text-[10px] text-blue-600 uppercase font-medium mb-0.5">Response</p>
              <p className="text-sm text-blue-900">{q.response_text}</p>
              <p className="text-[10px] text-blue-500 mt-1">{q.responded_at ? shortDate(q.responded_at) : ''}</p>
            </div>
          )}
        </div>
        <div className="text-right ml-4 shrink-0">
          <span className={`text-sm font-bold ${hrs > 48 ? 'text-red-600' : hrs > 24 ? 'text-orange-600' : 'text-gray-600'}`}>{hrs}h</span>
          <p className="text-[10px] text-gray-400">open</p>
        </div>
      </div>

      {/* Response form */}
      {isOpen && !responding && (
        <button onClick={() => setResponding(true)}
          className="mt-3 px-3 py-1.5 text-xs font-medium bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center gap-1">
          <MessageSquare className="w-3 h-3" /> Respond
        </button>
      )}
      {responding && (
        <div className="mt-3 border-t pt-3 space-y-2">
          <textarea value={response} onChange={e => setResponse(e.target.value)}
            placeholder="Type response to TPA query..." rows={3}
            className="w-full px-3 py-2 text-sm border rounded-lg focus:ring-2 focus:ring-blue-500" autoFocus />
          <div className="flex gap-2 justify-end">
            <button onClick={() => { setResponding(false); setResponse(''); }}
              className="px-3 py-1.5 text-xs border rounded-lg hover:bg-gray-50">Cancel</button>
            <button onClick={submit} disabled={saving || !response.trim()}
              className="px-4 py-1.5 text-xs bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 flex items-center gap-1 font-medium">
              {saving ? <Loader2 className="w-3 h-3 animate-spin" /> : <Send className="w-3 h-3" />} Submit Response
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
