// @ts-nocheck
// HEALTH1 HMIS — CLAIM DETAIL (Insurance Desk Workstation)
'use client';

import { useState, useEffect, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useAuthStore } from '@/lib/store/auth';
import Link from 'next/link';
import {
  ArrowLeft, Shield, Clock, FileText, AlertTriangle, IndianRupee,
  CheckCircle, XCircle, MessageSquare, Send, ChevronRight, Zap,
  User, Building2, Stethoscope, Calendar, ExternalLink, Loader2,
  Upload, RefreshCw, ArrowRight, Copy, Phone, Hash, Activity,
} from 'lucide-react';
import { STATUS_CONFIG, CLAIM_TYPE_LABELS, PRIORITY_CONFIG, type ClaimStatus, type ClaimType } from '@/lib/claims/types';
import { fetchClaim, fetchClaimTimeline, updateClaim, addClaimQuery, fetchClaimQueries, fetchClaimDocuments, uploadClaimDocument } from '@/lib/claims/api';
import { notifyClaimStatusChange } from '@/lib/claims/notifications';

// ─── Formatters ───
const INR = (n: number | null | undefined) => {
  if (!n) return '—';
  return n >= 100000 ? `₹${(n / 100000).toFixed(2)}L` : `₹${Math.round(n).toLocaleString('en-IN')}`;
};
const daysBetween = (a: string | null, b?: string) => {
  if (!a) return null;
  const end = b ? new Date(b) : new Date();
  return Math.ceil((end.getTime() - new Date(a).getTime()) / 86400000);
};
const fmtDate = (d: string | null) => d ? new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '—';
const fmtDateTime = (d: string | null) => d ? new Date(d).toLocaleString('en-IN', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }) : '—';

// ─── State Machine ───
const TRANSITIONS: Record<string, { label: string; status: ClaimStatus; color: string; icon: any }[]> = {
  draft: [
    { label: 'Submit Pre-Auth', status: 'preauth_pending', color: 'bg-amber-600 hover:bg-amber-700', icon: Shield },
    { label: 'Direct Claim', status: 'claim_submitted', color: 'bg-blue-600 hover:bg-blue-700', icon: Send },
  ],
  preauth_pending: [
    { label: 'Approved', status: 'preauth_approved', color: 'bg-green-600 hover:bg-green-700', icon: CheckCircle },
    { label: 'Query', status: 'preauth_query', color: 'bg-orange-600 hover:bg-orange-700', icon: MessageSquare },
    { label: 'Rejected', status: 'preauth_rejected', color: 'bg-red-600 hover:bg-red-700', icon: XCircle },
  ],
  preauth_approved: [
    { label: 'Submit Claim', status: 'claim_submitted', color: 'bg-blue-600 hover:bg-blue-700', icon: Send },
    { label: 'Enhancement', status: 'preauth_enhanced', color: 'bg-purple-600 hover:bg-purple-700', icon: ArrowRight },
  ],
  preauth_query: [
    { label: 'Resubmit', status: 'preauth_pending', color: 'bg-amber-600 hover:bg-amber-700', icon: RefreshCw },
    { label: 'Rejected', status: 'preauth_rejected', color: 'bg-red-600 hover:bg-red-700', icon: XCircle },
  ],
  preauth_enhanced: [
    { label: 'Submit Claim', status: 'claim_submitted', color: 'bg-blue-600 hover:bg-blue-700', icon: Send },
  ],
  claim_submitted: [
    { label: 'Under Review', status: 'claim_under_review', color: 'bg-blue-600 hover:bg-blue-700', icon: Clock },
    { label: 'Approved', status: 'claim_approved', color: 'bg-green-600 hover:bg-green-700', icon: CheckCircle },
    { label: 'Query', status: 'claim_query', color: 'bg-orange-600 hover:bg-orange-700', icon: MessageSquare },
  ],
  claim_under_review: [
    { label: 'Approved', status: 'claim_approved', color: 'bg-green-600 hover:bg-green-700', icon: CheckCircle },
    { label: 'Partial', status: 'claim_partial', color: 'bg-yellow-600 hover:bg-yellow-700', icon: Activity },
    { label: 'Query', status: 'claim_query', color: 'bg-orange-600 hover:bg-orange-700', icon: MessageSquare },
    { label: 'Rejected', status: 'claim_rejected', color: 'bg-red-600 hover:bg-red-700', icon: XCircle },
  ],
  claim_query: [
    { label: 'Resubmit', status: 'claim_submitted', color: 'bg-blue-600 hover:bg-blue-700', icon: RefreshCw },
    { label: 'Rejected', status: 'claim_rejected', color: 'bg-red-600 hover:bg-red-700', icon: XCircle },
  ],
  claim_approved: [
    { label: 'Await Settlement', status: 'settlement_pending', color: 'bg-purple-600 hover:bg-purple-700', icon: IndianRupee },
  ],
  claim_partial: [
    { label: 'Await Settlement', status: 'settlement_pending', color: 'bg-purple-600 hover:bg-purple-700', icon: IndianRupee },
  ],
  settlement_pending: [
    { label: 'Mark Settled', status: 'settled', color: 'bg-emerald-600 hover:bg-emerald-700', icon: CheckCircle },
  ],
  settled: [
    { label: 'Close', status: 'closed', color: 'bg-gray-600 hover:bg-gray-700', icon: XCircle },
  ],
  claim_rejected: [
    { label: 'Appeal', status: 'claim_submitted', color: 'bg-blue-600 hover:bg-blue-700', icon: RefreshCw },
    { label: 'Write Off', status: 'written_off', color: 'bg-red-800 hover:bg-red-900', icon: XCircle },
  ],
};

// ─── Tab Type ───
type DetailTab = 'overview' | 'queries' | 'documents' | 'timeline';

export default function ClaimDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { staff } = useAuthStore();

  // Data
  const [claim, setClaim] = useState<any>(null);
  const [timeline, setTimeline] = useState<any[]>([]);
  const [queries, setQueries] = useState<any[]>([]);
  const [documents, setDocuments] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // UI state
  const [tab, setTab] = useState<DetailTab>('overview');
  const [transitioning, setTransitioning] = useState(false);
  const [toast, setToast] = useState('');
  const flash = (m: string) => { setToast(m); setTimeout(() => setToast(''), 2500); };

  // Modals
  const [showAmountModal, setShowAmountModal] = useState<ClaimStatus | null>(null);
  const [amountInput, setAmountInput] = useState('');
  const [utrInput, setUtrInput] = useState('');

  // Query form
  const [showAddQuery, setShowAddQuery] = useState(false);
  const [queryForm, setQueryForm] = useState({ text: '', category: 'other', priority: 'medium', routed_to_role: '' });
  const [savingQuery, setSavingQuery] = useState(false);

  // Upload
  const [uploading, setUploading] = useState(false);

  // ─── Load ───
  const load = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    try {
      const [c, t, q, d] = await Promise.all([
        fetchClaim(id), fetchClaimTimeline(id), fetchClaimQueries(id), fetchClaimDocuments(id),
      ]);
      setClaim(c); setTimeline(t); setQueries(q); setDocuments(d);
    } catch (e) { console.error(e); }
    setLoading(false);
  }, [id]);

  useEffect(() => { load(); }, [load]);

  // ─── Actions ───
  const handleTransition = async (newStatus: ClaimStatus) => {
    if (['claim_approved', 'claim_partial', 'settled'].includes(newStatus)) {
      setShowAmountModal(newStatus);
      return;
    }
    setTransitioning(true);
    try {
      await updateClaim(id, { status: newStatus });
      notifyClaimStatusChange(id, newStatus).catch(() => {});
      flash(`Status → ${STATUS_CONFIG[newStatus]?.label || newStatus}`);
      await load();
    } catch (e) { console.error(e); flash('Error updating status'); }
    setTransitioning(false);
  };

  const handleAmountSubmit = async () => {
    if (!showAmountModal || !amountInput) return;
    setTransitioning(true);
    const updates: any = { status: showAmountModal };
    if (showAmountModal === 'claim_approved' || showAmountModal === 'claim_partial') {
      updates.approved_amount = parseFloat(amountInput) || 0;
    } else if (showAmountModal === 'settled') {
      updates.settled_amount = parseFloat(amountInput) || 0;
      updates.settlement_date = new Date().toISOString().split('T')[0];
      updates.settlement_utr = utrInput || null;
      updates.medpay_synced = true;
      updates.medpay_synced_at = new Date().toISOString();
    }
    try {
      await updateClaim(id, updates);
      notifyClaimStatusChange(id, showAmountModal).catch(() => {});
      flash(showAmountModal === 'settled' ? 'Settlement recorded' : 'Amount approved');
      setShowAmountModal(null); setAmountInput(''); setUtrInput('');
      await load();
    } catch (e) { console.error(e); flash('Error'); }
    setTransitioning(false);
  };

  const handleAddQuery = async () => {
    if (!queryForm.text.trim()) return;
    setSavingQuery(true);
    try {
      await addClaimQuery({ claim_id: id, query_text: queryForm.text, query_category: queryForm.category, priority: queryForm.priority, routed_to_role: queryForm.routed_to_role || undefined });
      setShowAddQuery(false); setQueryForm({ text: '', category: 'other', priority: 'medium', routed_to_role: '' });
      flash('Query added');
      await load();
    } catch (e) { console.error(e); flash('Error adding query'); }
    setSavingQuery(false);
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      await uploadClaimDocument({ claim_id: id, file, document_name: file.name.replace(/\.[^/.]+$/, ''), document_category: 'clinical' });
      flash('Document uploaded');
      await load();
    } catch (err) { console.error(err); flash('Upload failed'); }
    setUploading(false);
    e.target.value = '';
  };

  const handleInlineEdit = async (field: string, value: any) => {
    try {
      await updateClaim(id, { [field]: value });
      flash(`${field.replace(/_/g, ' ')} updated`);
      await load();
    } catch (e) { console.error(e); }
  };

  // ─── Loading / Not Found ───
  if (loading) return (
    <div className="flex items-center justify-center min-h-[60vh]">
      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-teal-600" />
    </div>
  );
  if (!claim) return (
    <div className="text-center py-20">
      <Shield className="w-12 h-12 text-gray-300 mx-auto mb-3" />
      <p className="text-sm text-gray-500">Claim not found</p>
      <Link href="/claims" className="text-xs text-teal-600 hover:underline mt-2 inline-block">← Back to Claims</Link>
    </div>
  );

  const sc = STATUS_CONFIG[claim.status as ClaimStatus] || STATUS_CONFIG.draft;
  const transitions = TRANSITIONS[claim.status] || [];
  const daysPending = daysBetween(claim.discharge_date || claim.admission_date);
  const openQueryCount = queries.filter(q => ['open', 'in_progress', 'escalated'].includes(q.status)).length;

  const detailTabs: [DetailTab, string, number | null][] = [
    ['overview', 'Overview', null],
    ['queries', 'Queries', queries.length],
    ['documents', 'Documents', documents.length],
    ['timeline', 'Timeline', timeline.length],
  ];

  return (
    <div className="min-h-screen bg-gray-50/50">
      {/* Toast */}
      {toast && <div className="fixed top-4 left-1/2 -translate-x-1/2 z-50 bg-teal-600 text-white px-5 py-2.5 rounded-xl shadow-lg text-sm font-medium">{toast}</div>}

      {/* ═══ CLAIM HEADER ═══ */}
      <div className="bg-white border-b">
        <div className="max-w-6xl mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              {/* Avatar */}
              <div className="w-12 h-12 rounded-full bg-teal-100 flex items-center justify-center text-teal-700 font-bold text-lg">
                {claim.patient_name?.split(' ').map((w: string) => w[0]).slice(0, 2).join('')}
              </div>
              <div>
                <h1 className="text-xl font-bold">{claim.patient_name}</h1>
                <div className="flex items-center gap-2 text-xs text-gray-500 flex-wrap mt-0.5">
                  <span className="font-mono bg-gray-100 px-1.5 py-0.5 rounded">{claim.claim_number}</span>
                  {claim.patient_uhid && <span className="font-mono">{claim.patient_uhid}</span>}
                  <span className={`px-1.5 py-0.5 rounded-full font-semibold text-[10px] ${sc.bg} ${sc.color}`}>{sc.label}</span>
                  <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${
                    claim.claim_type === 'pmjay' ? 'bg-green-100 text-green-700' :
                    claim.claim_type === 'corporate' ? 'bg-purple-100 text-purple-700' :
                    'bg-blue-50 text-blue-700'
                  }`}>{CLAIM_TYPE_LABELS[claim.claim_type as ClaimType] || claim.claim_type}</span>
                  {claim.clm_payers?.name && <span className="bg-gray-50 px-1.5 py-0.5 rounded">{claim.clm_payers.name}</span>}
                  {daysPending && daysPending > 0 && (
                    <span className={`px-1.5 py-0.5 rounded font-bold text-[10px] ${daysPending > 90 ? 'bg-red-100 text-red-700' : daysPending > 30 ? 'bg-orange-100 text-orange-700' : 'bg-gray-100 text-gray-600'}`}>
                      Day {daysPending}
                    </span>
                  )}
                  {openQueryCount > 0 && (
                    <button onClick={() => setTab('queries')} className="px-1.5 py-0.5 rounded font-bold text-[10px] bg-orange-500 text-white animate-pulse">
                      {openQueryCount} Query
                    </button>
                  )}
                  {claim.is_sla_breached && <span className="px-1.5 py-0.5 rounded font-bold text-[10px] bg-red-600 text-white">SLA BREACH</span>}
                </div>
                {claim.primary_diagnosis && (
                  <div className="text-xs text-gray-600 mt-1">
                    <span className="font-medium">Dx:</span> {claim.primary_diagnosis}
                    {claim.icd_code && <span className="font-mono text-gray-400 ml-1">({claim.icd_code})</span>}
                  </div>
                )}
              </div>
            </div>
            {/* Action Buttons */}
            <div className="flex flex-col gap-1.5 items-end">
              {/* Financial quick view */}
              <div className="flex gap-2 text-[10px]">
                {claim.estimated_amount && <span className="bg-gray-50 px-1.5 py-0.5 rounded">Est <b className="font-mono">{INR(claim.estimated_amount)}</b></span>}
                {claim.approved_amount && <span className="bg-blue-50 px-1.5 py-0.5 rounded text-blue-700">Appr <b className="font-mono">{INR(claim.approved_amount)}</b></span>}
                {claim.settled_amount && <span className="bg-emerald-50 px-1.5 py-0.5 rounded text-emerald-700">Settled <b className="font-mono">{INR(claim.settled_amount)}</b></span>}
              </div>
              <div className="flex gap-2">
                {transitions.map(t => (
                  <button key={t.status} onClick={() => handleTransition(t.status)} disabled={transitioning}
                    className={`flex items-center gap-1 px-3 py-1.5 text-white text-xs rounded-lg font-medium ${t.color} disabled:opacity-50 transition-colors`}>
                    <t.icon className="w-3 h-3" /> {t.label}
                  </button>
                ))}
                <Link href="/claims" className="px-3 py-1.5 bg-gray-100 text-gray-600 text-xs rounded-lg hover:bg-gray-200">Back</Link>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ═══ TABS ═══ */}
      <div className="max-w-6xl mx-auto px-6">
        <div className="flex gap-0.5 border-b pb-px">
          {detailTabs.map(([k, l, count]) => (
            <button key={k} onClick={() => setTab(k)}
              className={`px-3 py-2.5 text-[11px] font-medium whitespace-nowrap border-b-2 -mb-px flex items-center gap-1 transition-colors ${
                tab === k ? 'border-teal-600 text-teal-700' : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}>
              {l}
              {count !== null && count > 0 && (
                <span className={`text-[9px] px-1.5 rounded-full ${tab === k ? 'bg-teal-100 text-teal-600' : 'bg-gray-100 text-gray-400'}`}>{count}</span>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* ═══ TAB CONTENT ═══ */}
      <div className="max-w-6xl mx-auto px-6 py-4">

        {/* ── OVERVIEW ── */}
        {tab === 'overview' && (
          <div className="grid grid-cols-3 gap-4">
            {/* Left 2 cols */}
            <div className="col-span-2 space-y-4">
              {/* Financial Summary */}
              <div className="bg-white rounded-xl border p-5">
                <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3 flex items-center gap-1.5"><IndianRupee className="w-3.5 h-3.5" /> Financial Summary</h3>
                <div className="grid grid-cols-3 gap-3">
                  {[
                    { label: 'Estimated', value: claim.estimated_amount, color: 'text-gray-700', bg: 'bg-gray-50' },
                    { label: 'Approved', value: claim.approved_amount, color: 'text-blue-700', bg: 'bg-blue-50' },
                    { label: 'Claimed', value: claim.claimed_amount, color: 'text-purple-700', bg: 'bg-purple-50' },
                    { label: 'Settled', value: claim.settled_amount, color: 'text-emerald-700', bg: 'bg-emerald-50' },
                    { label: 'Deductions', value: claim.deduction_amount, color: 'text-red-700', bg: 'bg-red-50' },
                    { label: 'Patient Payable', value: claim.patient_payable, color: 'text-orange-700', bg: 'bg-orange-50' },
                  ].map(f => (
                    <div key={f.label} className={`${f.bg} rounded-lg p-3`}>
                      <p className="text-[10px] text-gray-500 uppercase tracking-wider">{f.label}</p>
                      <p className={`text-lg font-bold font-mono tabular-nums ${f.color}`}>{INR(f.value)}</p>
                    </div>
                  ))}
                </div>
              </div>

              {/* Clinical Details */}
              <div className="bg-white rounded-xl border p-5">
                <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3 flex items-center gap-1.5"><Stethoscope className="w-3.5 h-3.5" /> Clinical Details</h3>
                <div className="grid grid-cols-2 gap-y-2.5 gap-x-6 text-sm">
                  {[
                    ['Diagnosis', claim.primary_diagnosis, 'font-medium'],
                    ['ICD-10', claim.icd_code, 'font-mono text-xs'],
                    ['Procedure', claim.procedure_name, 'font-medium'],
                    ['Department', claim.department_name, ''],
                    ['Doctor', claim.treating_doctor_name ? `Dr. ${claim.treating_doctor_name}` : null, ''],
                    ['Package', claim.package_name, ''],
                  ].map(([label, value, cls]) => (
                    <div key={label as string} className="flex items-baseline gap-2">
                      <span className="text-xs text-gray-400 w-20 shrink-0">{label}</span>
                      <span className={`text-gray-800 ${cls}`}>{(value as string) || '—'}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Patient & Policy */}
              <div className="bg-white rounded-xl border p-5">
                <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3 flex items-center gap-1.5"><User className="w-3.5 h-3.5" /> Patient & Policy</h3>
                <div className="grid grid-cols-2 gap-y-2.5 gap-x-6 text-sm">
                  {[
                    ['Patient', claim.patient_name, 'font-medium'],
                    ['UHID', claim.patient_uhid, 'font-mono text-xs'],
                    ['Phone', claim.patient_phone, ''],
                    ['ABHA', claim.abha_id, 'font-mono text-xs'],
                    ['Policy #', claim.policy_number, 'font-mono text-xs'],
                    ['Holder', claim.policy_holder_name, ''],
                    ['Admission', fmtDate(claim.admission_date), ''],
                    ['Discharge', fmtDate(claim.discharge_date), ''],
                  ].map(([label, value, cls]) => (
                    <div key={label as string} className="flex items-baseline gap-2">
                      <span className="text-xs text-gray-400 w-20 shrink-0">{label}</span>
                      <span className={`text-gray-800 ${cls}`}>{(value as string) || '—'}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Right col — Payer + Refs + Quick actions */}
            <div className="space-y-4">
              {/* Payer Card */}
              <div className="bg-white rounded-xl border p-5">
                <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3 flex items-center gap-1.5"><Building2 className="w-3.5 h-3.5" /> Payer & References</h3>
                <p className="font-semibold text-sm text-gray-900">{claim.clm_payers?.name || '—'}</p>
                <p className="text-[10px] text-gray-500 mt-0.5 uppercase">{claim.clm_payers?.type}</p>

                <div className="mt-3 space-y-2">
                  <div>
                    <label className="text-[10px] text-gray-400 uppercase tracking-wider">TPA Claim Ref</label>
                    <input type="text" key={`tpa_${claim.tpa_claim_number}`} defaultValue={claim.tpa_claim_number || ''}
                      onBlur={e => { if (e.target.value !== (claim.tpa_claim_number || '')) handleInlineEdit('tpa_claim_number', e.target.value); }}
                      placeholder="Enter TPA claim #" className="w-full px-2.5 py-1.5 text-xs font-mono border rounded-lg mt-0.5 focus:ring-2 focus:ring-teal-500 focus:border-transparent" />
                  </div>
                  <div>
                    <label className="text-[10px] text-gray-400 uppercase tracking-wider">Pre-Auth Ref</label>
                    <input type="text" key={`pa_${claim.tpa_preauth_number}`} defaultValue={claim.tpa_preauth_number || ''}
                      onBlur={e => { if (e.target.value !== (claim.tpa_preauth_number || '')) handleInlineEdit('tpa_preauth_number', e.target.value); }}
                      placeholder="Enter pre-auth #" className="w-full px-2.5 py-1.5 text-xs font-mono border rounded-lg mt-0.5 focus:ring-2 focus:ring-teal-500 focus:border-transparent" />
                  </div>
                  <div>
                    <label className="text-[10px] text-gray-400 uppercase tracking-wider">Claimed Amount</label>
                    <input type="number" key={`ca_${claim.claimed_amount}`} defaultValue={claim.claimed_amount || ''}
                      onBlur={e => { const v = parseFloat(e.target.value); if (v && v !== claim.claimed_amount) handleInlineEdit('claimed_amount', v); }}
                      placeholder="₹" className="w-full px-2.5 py-1.5 text-xs font-mono border rounded-lg mt-0.5 focus:ring-2 focus:ring-teal-500 focus:border-transparent" />
                  </div>
                </div>

                {claim.settlement_utr && (
                  <div className="mt-3 p-2 bg-emerald-50 rounded-lg">
                    <span className="text-[10px] text-emerald-600 uppercase tracking-wider">UTR</span>
                    <p className="font-mono text-xs text-emerald-700 font-medium">{claim.settlement_utr}</p>
                  </div>
                )}
                {claim.medpay_synced && (
                  <p className="text-[10px] text-green-600 mt-2 flex items-center gap-1"><CheckCircle className="w-3 h-3" /> MedPay synced {fmtDateTime(claim.medpay_synced_at)}</p>
                )}
              </div>

              {/* Query Alert */}
              {openQueryCount > 0 && (
                <div className={`border rounded-xl p-4 ${claim.is_sla_breached ? 'bg-red-50 border-red-300' : 'bg-orange-50 border-orange-200'}`}>
                  <div className="flex items-center gap-2 mb-1">
                    <AlertTriangle className={`w-4 h-4 ${claim.is_sla_breached ? 'text-red-600' : 'text-orange-600'}`} />
                    <span className={`text-sm font-semibold ${claim.is_sla_breached ? 'text-red-800' : 'text-orange-800'}`}>
                      {openQueryCount} Open {openQueryCount === 1 ? 'Query' : 'Queries'}
                    </span>
                  </div>
                  <p className={`text-xs ${claim.is_sla_breached ? 'text-red-700' : 'text-orange-700'}`}>
                    {claim.is_sla_breached ? 'SLA breached — escalate immediately' : 'Response pending'}
                  </p>
                  <button onClick={() => setTab('queries')} className={`mt-2 text-xs font-medium ${claim.is_sla_breached ? 'text-red-700' : 'text-orange-700'} hover:underline`}>
                    View queries →
                  </button>
                </div>
              )}

              {/* Notes */}
              <div className="bg-white rounded-xl border p-5">
                <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Notes</h3>
                <textarea key={`notes_${claim.notes}`} defaultValue={claim.notes || ''}
                  onBlur={e => { if (e.target.value !== (claim.notes || '')) handleInlineEdit('notes', e.target.value); }}
                  placeholder="Add notes..." rows={3}
                  className="w-full px-2.5 py-2 text-xs border rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent resize-none" />
              </div>
            </div>
          </div>
        )}

        {/* ── QUERIES ── */}
        {tab === 'queries' && (
          <div className="max-w-3xl space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-gray-900">TPA Queries ({queries.length})</h3>
              <button onClick={() => setShowAddQuery(!showAddQuery)}
                className="flex items-center gap-1 px-3 py-1.5 text-xs font-medium bg-teal-600 text-white rounded-lg hover:bg-teal-700 transition-colors">
                <MessageSquare className="w-3 h-3" /> Log Query
              </button>
            </div>

            {showAddQuery && (
              <div className="border rounded-xl p-4 bg-orange-50/50 space-y-3">
                <textarea value={queryForm.text} onChange={e => setQueryForm(f => ({...f, text: e.target.value}))}
                  placeholder="What did the TPA query?" rows={3} autoFocus
                  className="w-full px-3 py-2 text-sm border rounded-lg focus:ring-2 focus:ring-teal-500" />
                <div className="grid grid-cols-3 gap-2">
                  <select value={queryForm.category} onChange={e => setQueryForm(f => ({...f, category: e.target.value}))}
                    className="px-2.5 py-1.5 text-xs border rounded-lg bg-white">
                    <option value="clinical">Clinical</option><option value="billing">Billing</option>
                    <option value="documentation">Documentation</option><option value="policy">Policy</option><option value="other">Other</option>
                  </select>
                  <select value={queryForm.priority} onChange={e => setQueryForm(f => ({...f, priority: e.target.value}))}
                    className="px-2.5 py-1.5 text-xs border rounded-lg bg-white">
                    <option value="low">Low</option><option value="medium">Medium</option>
                    <option value="high">High</option><option value="critical">Critical</option>
                  </select>
                  <select value={queryForm.routed_to_role} onChange={e => setQueryForm(f => ({...f, routed_to_role: e.target.value}))}
                    className="px-2.5 py-1.5 text-xs border rounded-lg bg-white">
                    <option value="">Route to...</option><option value="doctor">Doctor</option>
                    <option value="insurance_desk">Insurance Desk</option><option value="billing">Billing</option><option value="accounts">Accounts</option>
                  </select>
                </div>
                <div className="flex gap-2 justify-end">
                  <button onClick={() => setShowAddQuery(false)} className="px-3 py-1.5 text-xs border rounded-lg hover:bg-gray-50">Cancel</button>
                  <button onClick={handleAddQuery} disabled={savingQuery || !queryForm.text.trim()}
                    className="px-4 py-1.5 text-xs bg-teal-600 text-white rounded-lg hover:bg-teal-700 disabled:opacity-50 flex items-center gap-1">
                    {savingQuery ? <Loader2 className="w-3 h-3 animate-spin" /> : <Send className="w-3 h-3" />} Submit
                  </button>
                </div>
              </div>
            )}

            {queries.length === 0 ? (
              <div className="text-center py-12 bg-white rounded-xl border">
                <CheckCircle className="w-10 h-10 text-green-300 mx-auto mb-2" />
                <p className="text-sm text-gray-500">No queries on this claim</p>
              </div>
            ) : (
              queries.map(q => {
                const isOpen = ['open', 'in_progress', 'escalated'].includes(q.status);
                return (
                  <div key={q.id} className={`bg-white rounded-xl border p-4 ${isOpen ? 'border-l-4 border-l-orange-500' : ''}`}>
                    <div className="flex items-center gap-2 mb-2 flex-wrap">
                      <span className="text-xs font-bold text-gray-900">Q{q.query_number}</span>
                      <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-semibold ${
                        q.status === 'open' ? 'bg-orange-100 text-orange-700' :
                        q.status === 'responded' ? 'bg-blue-100 text-blue-700' :
                        q.status === 'resolved' ? 'bg-green-100 text-green-700' :
                        q.status === 'escalated' ? 'bg-red-100 text-red-700' : 'bg-gray-100 text-gray-600'
                      }`}>{q.status}</span>
                      <span className="text-[10px] bg-gray-100 px-1.5 py-0.5 rounded text-gray-600">{q.query_category}</span>
                      <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${PRIORITY_CONFIG[q.priority]?.bg || ''} ${PRIORITY_CONFIG[q.priority]?.color || ''}`}>
                        {q.priority}
                      </span>
                      {q.is_sla_breached && <span className="text-[10px] font-bold text-red-600 bg-red-50 px-1.5 py-0.5 rounded">SLA BREACHED</span>}
                      {q.routed_to_role && <span className="text-[10px] text-gray-400">→ {q.routed_to_role}</span>}
                      <span className="text-[10px] text-gray-400 ml-auto">{fmtDateTime(q.raised_at)}</span>
                    </div>
                    <p className="text-sm text-gray-800 leading-relaxed">{q.query_text}</p>
                    {q.response_text && (
                      <div className="mt-3 p-3 bg-blue-50 rounded-lg border border-blue-100">
                        <p className="text-[10px] text-blue-600 font-semibold uppercase tracking-wider mb-1">Response</p>
                        <p className="text-sm text-blue-800">{q.response_text}</p>
                        <p className="text-[10px] text-blue-500 mt-1">{fmtDateTime(q.responded_at)}</p>
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>
        )}

        {/* ── DOCUMENTS ── */}
        {tab === 'documents' && (
          <div className="max-w-3xl space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-gray-900">Claim Documents ({documents.length})</h3>
              <label className="flex items-center gap-1 px-3 py-1.5 text-xs font-medium bg-teal-600 text-white rounded-lg hover:bg-teal-700 cursor-pointer transition-colors">
                <Upload className="w-3 h-3" /> {uploading ? 'Uploading...' : 'Upload Document'}
                <input type="file" className="hidden" accept=".pdf,.jpg,.jpeg,.png,.doc,.docx" onChange={handleFileUpload} disabled={uploading} />
              </label>
            </div>

            {documents.length === 0 ? (
              <div className="text-center py-12 bg-white rounded-xl border">
                <FileText className="w-10 h-10 text-gray-300 mx-auto mb-2" />
                <p className="text-sm text-gray-500">No documents uploaded</p>
                <p className="text-xs text-gray-400 mt-1">Upload discharge summary, lab reports, and other claim documents</p>
              </div>
            ) : (
              documents.map(doc => (
                <div key={doc.id} className="bg-white rounded-xl border p-4 flex items-center justify-between hover:border-teal-300 transition-colors">
                  <div className="flex items-center gap-3">
                    <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                      doc.document_category === 'clinical' ? 'bg-blue-100 text-blue-600' :
                      doc.document_category === 'billing' ? 'bg-purple-100 text-purple-600' :
                      doc.document_category === 'identity' ? 'bg-amber-100 text-amber-600' :
                      'bg-gray-100 text-gray-500'
                    }`}>
                      <FileText className="w-5 h-5" />
                    </div>
                    <div>
                      <p className="text-sm font-medium text-gray-900">{doc.document_name}</p>
                      <div className="flex items-center gap-2 text-[10px] text-gray-500 mt-0.5">
                        <span className="uppercase">{doc.document_category}</span>
                        <span className={`px-1.5 py-0.5 rounded-full font-medium ${
                          doc.status === 'uploaded' ? 'bg-blue-100 text-blue-700' :
                          doc.status === 'verified' ? 'bg-green-100 text-green-700' :
                          doc.status === 'rejected' ? 'bg-red-100 text-red-700' : 'bg-gray-100 text-gray-600'
                        }`}>{doc.status}</span>
                        {doc.file_size_bytes && <span>{(doc.file_size_bytes / 1024).toFixed(0)} KB</span>}
                      </div>
                    </div>
                  </div>
                  {doc.file_url && (
                    <a href={doc.file_url} target="_blank" rel="noopener noreferrer"
                      className="flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-teal-600 bg-teal-50 rounded-lg hover:bg-teal-100 transition-colors">
                      <ExternalLink className="w-3 h-3" /> View
                    </a>
                  )}
                </div>
              ))
            )}
          </div>
        )}

        {/* ── TIMELINE ── */}
        {tab === 'timeline' && (
          <div className="max-w-3xl">
            {timeline.length === 0 ? (
              <div className="text-center py-12 bg-white rounded-xl border">
                <Clock className="w-10 h-10 text-gray-300 mx-auto mb-2" />
                <p className="text-sm text-gray-500">No events recorded</p>
              </div>
            ) : (
              <div className="bg-white rounded-xl border p-5">
                <div className="space-y-0">
                  {timeline.map((evt, i) => (
                    <div key={i} className="flex gap-4">
                      <div className="flex flex-col items-center">
                        <div className={`w-3 h-3 rounded-full mt-1 ring-4 ring-white ${
                          evt.event_type === 'status_change' ? 'bg-blue-500' :
                          evt.event_type === 'query' ? 'bg-orange-500' :
                          evt.event_type === 'query_response' ? 'bg-teal-500' :
                          evt.event_type === 'settlement' ? 'bg-emerald-500' :
                          evt.event_type === 'document' ? 'bg-purple-500' : 'bg-gray-400'
                        }`} />
                        {i < timeline.length - 1 && <div className="w-px flex-1 bg-gray-200 my-1" />}
                      </div>
                      <div className="pb-5 flex-1">
                        <p className="text-sm font-medium text-gray-800">{evt.event_text}</p>
                        <p className="text-[10px] text-gray-400 mt-0.5">{fmtDateTime(evt.created_at)}</p>
                        {evt.notes && <p className="text-xs text-gray-500 mt-1 italic">{evt.notes}</p>}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* ═══ AMOUNT / SETTLEMENT MODAL ═══ */}
      {showAmountModal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 backdrop-blur-sm">
          <div className="bg-white rounded-2xl p-6 w-full max-w-md shadow-2xl">
            <h3 className="font-bold text-gray-900 text-lg mb-1">
              {showAmountModal === 'settled' ? 'Record Settlement' : 'Enter Approved Amount'}
            </h3>
            <p className="text-xs text-gray-500 mb-4">
              {showAmountModal === 'settled' ? 'Enter the amount received from payer' : 'Enter the amount approved by TPA/insurer'}
            </p>

            <div className="space-y-3">
              <div>
                <label className="text-[10px] text-gray-400 uppercase tracking-wider">Amount *</label>
                <div className="relative mt-1">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 font-medium">₹</span>
                  <input type="number" value={amountInput} onChange={e => setAmountInput(e.target.value)}
                    placeholder={claim.approved_amount ? String(claim.approved_amount) : 'Amount'} autoFocus
                    className="w-full pl-8 pr-3 py-3 text-lg font-mono border rounded-xl focus:ring-2 focus:ring-teal-500 focus:border-transparent" />
                </div>
              </div>

              {showAmountModal === 'settled' && (
                <div>
                  <label className="text-[10px] text-gray-400 uppercase tracking-wider">UTR / Reference Number</label>
                  <input type="text" value={utrInput} onChange={e => setUtrInput(e.target.value)}
                    placeholder="NEFT/RTGS UTR number"
                    className="w-full px-3 py-2.5 text-sm font-mono border rounded-xl mt-1 focus:ring-2 focus:ring-teal-500 focus:border-transparent" />
                </div>
              )}
            </div>

            <div className="flex gap-2 mt-5">
              <button onClick={() => { setShowAmountModal(null); setAmountInput(''); setUtrInput(''); }}
                className="flex-1 py-2.5 text-sm font-medium border rounded-xl hover:bg-gray-50 transition-colors">Cancel</button>
              <button onClick={handleAmountSubmit} disabled={!amountInput || transitioning}
                className="flex-1 py-2.5 text-sm font-medium bg-teal-600 text-white rounded-xl hover:bg-teal-700 disabled:opacity-50 flex items-center justify-center gap-2 transition-colors">
                {transitioning ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle className="w-4 h-4" />}
                {transitioning ? 'Saving...' : 'Confirm'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
