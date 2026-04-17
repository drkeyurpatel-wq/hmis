'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { sb } from '@/lib/supabase/browser';
import { useAuthStore } from '@/lib/store/auth';
import {
  ArrowLeft, Shield, Clock, FileText, AlertTriangle, IndianRupee,
  CheckCircle, XCircle, MessageSquare, Send, ChevronRight,
  User, Building2, Stethoscope, Calendar, ExternalLink, Loader2,
} from 'lucide-react';
import { STATUS_CONFIG, CLAIM_TYPE_LABELS, PRIORITY_CONFIG, type ClaimStatus, type ClaimType } from '@/lib/claims/types';
import { fetchClaim, fetchClaimTimeline, updateClaim } from '@/lib/claims/api';

const INR = (n: number | null | undefined) => {
  if (!n) return '—';
  return n >= 100000 ? `₹${(n / 100000).toFixed(2)}L` : `₹${Math.round(n).toLocaleString('en-IN')}`;
};

// Valid next statuses from current status
const TRANSITIONS: Record<string, { label: string; status: ClaimStatus; color: string }[]> = {
  draft: [
    { label: 'Submit Pre-Auth', status: 'preauth_pending', color: 'bg-amber-600' },
    { label: 'Submit Claim', status: 'claim_submitted', color: 'bg-blue-600' },
  ],
  preauth_pending: [
    { label: 'Mark Approved', status: 'preauth_approved', color: 'bg-green-600' },
    { label: 'Mark Query', status: 'preauth_query', color: 'bg-orange-600' },
    { label: 'Mark Rejected', status: 'preauth_rejected', color: 'bg-red-600' },
  ],
  preauth_approved: [
    { label: 'Submit Final Claim', status: 'claim_submitted', color: 'bg-blue-600' },
    { label: 'Enhancement', status: 'preauth_enhanced', color: 'bg-purple-600' },
  ],
  preauth_query: [
    { label: 'Resubmit', status: 'preauth_pending', color: 'bg-amber-600' },
    { label: 'Mark Rejected', status: 'preauth_rejected', color: 'bg-red-600' },
  ],
  preauth_enhanced: [
    { label: 'Submit Final Claim', status: 'claim_submitted', color: 'bg-blue-600' },
  ],
  claim_submitted: [
    { label: 'Under Review', status: 'claim_under_review', color: 'bg-blue-600' },
    { label: 'Mark Query', status: 'claim_query', color: 'bg-orange-600' },
    { label: 'Mark Approved', status: 'claim_approved', color: 'bg-green-600' },
  ],
  claim_under_review: [
    { label: 'Mark Approved', status: 'claim_approved', color: 'bg-green-600' },
    { label: 'Partial Approval', status: 'claim_partial', color: 'bg-yellow-600' },
    { label: 'Mark Query', status: 'claim_query', color: 'bg-orange-600' },
    { label: 'Mark Rejected', status: 'claim_rejected', color: 'bg-red-600' },
  ],
  claim_query: [
    { label: 'Resubmit', status: 'claim_submitted', color: 'bg-blue-600' },
    { label: 'Mark Rejected', status: 'claim_rejected', color: 'bg-red-600' },
  ],
  claim_approved: [
    { label: 'Settlement Pending', status: 'settlement_pending', color: 'bg-purple-600' },
  ],
  claim_partial: [
    { label: 'Settlement Pending', status: 'settlement_pending', color: 'bg-purple-600' },
  ],
  settlement_pending: [
    { label: 'Mark Settled', status: 'settled', color: 'bg-emerald-600' },
  ],
  settled: [
    { label: 'Close Claim', status: 'closed', color: 'bg-gray-600' },
  ],
  claim_rejected: [
    { label: 'Appeal / Resubmit', status: 'claim_submitted', color: 'bg-blue-600' },
    { label: 'Write Off', status: 'written_off', color: 'bg-red-800' },
  ],
};

export default function ClaimDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { staff } = useAuthStore();
  const [claim, setClaim] = useState<any>(null);
  const [timeline, setTimeline] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [transitioning, setTransitioning] = useState(false);

  // Amount fields for settlement
  const [showAmountModal, setShowAmountModal] = useState<ClaimStatus | null>(null);
  const [amountInput, setAmountInput] = useState('');

  const load = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    try {
      const [c, t] = await Promise.all([fetchClaim(id), fetchClaimTimeline(id)]);
      setClaim(c);
      setTimeline(t);
    } catch (e) { console.error(e); }
    setLoading(false);
  }, [id]);

  useEffect(() => { load(); }, [load]);

  const handleTransition = async (newStatus: ClaimStatus) => {
    // If transitioning to approved/settled, ask for amount
    if (['claim_approved', 'claim_partial', 'settled'].includes(newStatus)) {
      setShowAmountModal(newStatus);
      return;
    }
    setTransitioning(true);
    try {
      await updateClaim(id, { status: newStatus });
      await load();
    } catch (e) { console.error(e); }
    setTransitioning(false);
  };

  const handleAmountSubmit = async () => {
    if (!showAmountModal) return;
    setTransitioning(true);
    const updates: any = { status: showAmountModal };
    if (showAmountModal === 'claim_approved' || showAmountModal === 'claim_partial') {
      updates.approved_amount = parseFloat(amountInput) || 0;
    } else if (showAmountModal === 'settled') {
      updates.settled_amount = parseFloat(amountInput) || 0;
      updates.settlement_date = new Date().toISOString().split('T')[0];
    }
    try {
      await updateClaim(id, updates);
      setShowAmountModal(null);
      setAmountInput('');
      await load();
    } catch (e) { console.error(e); }
    setTransitioning(false);
  };

  if (loading) return <div className="flex items-center justify-center min-h-screen text-gray-400"><Loader2 className="w-6 h-6 animate-spin" /></div>;
  if (!claim) return <div className="text-center py-20 text-gray-500">Claim not found</div>;

  const sc = STATUS_CONFIG[claim.status as ClaimStatus] || STATUS_CONFIG.draft;
  const transitions = TRANSITIONS[claim.status] || [];

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b px-6 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button onClick={() => router.push('/claims')} className="p-1.5 rounded-lg hover:bg-gray-100">
              <ArrowLeft className="w-5 h-5 text-gray-500" />
            </button>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-lg font-bold text-gray-900 font-mono">{claim.claim_number}</h1>
                <span className={`px-2.5 py-0.5 rounded-full text-xs font-medium ${sc.bg} ${sc.color}`}>{sc.label}</span>
              </div>
              <p className="text-sm text-gray-500">{claim.patient_name} • {claim.clm_payers?.name}</p>
            </div>
          </div>
          {/* Action Buttons */}
          <div className="flex gap-2">
            {transitions.map(t => (
              <button key={t.status} onClick={() => handleTransition(t.status)} disabled={transitioning}
                className={`px-3 py-1.5 text-xs font-medium text-white rounded-lg ${t.color} hover:opacity-90 disabled:opacity-50`}>
                {t.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="max-w-5xl mx-auto p-6 grid grid-cols-3 gap-6">
        {/* Left: Claim Details */}
        <div className="col-span-2 space-y-4">
          {/* Financial Summary */}
          <div className="bg-white rounded-xl border p-5">
            <h3 className="text-sm font-semibold text-gray-900 mb-3 flex items-center gap-2">
              <IndianRupee className="w-4 h-4" /> Financial Summary
            </h3>
            <div className="grid grid-cols-3 gap-4">
              {[
                { label: 'Estimated', value: claim.estimated_amount, color: 'text-gray-700' },
                { label: 'Approved', value: claim.approved_amount, color: 'text-blue-700' },
                { label: 'Claimed', value: claim.claimed_amount, color: 'text-purple-700' },
                { label: 'Settled', value: claim.settled_amount, color: 'text-emerald-700' },
                { label: 'Deductions', value: claim.deduction_amount, color: 'text-red-700' },
                { label: 'Patient Payable', value: claim.patient_payable, color: 'text-orange-700' },
              ].map(f => (
                <div key={f.label} className="bg-gray-50 rounded-lg p-3">
                  <p className="text-xs text-gray-500">{f.label}</p>
                  <p className={`text-lg font-bold ${f.color}`}>{INR(f.value)}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Clinical Details */}
          <div className="bg-white rounded-xl border p-5">
            <h3 className="text-sm font-semibold text-gray-900 mb-3 flex items-center gap-2">
              <Stethoscope className="w-4 h-4" /> Clinical Details
            </h3>
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div><span className="text-gray-500">Diagnosis:</span> <span className="font-medium">{claim.primary_diagnosis || '—'}</span></div>
              <div><span className="text-gray-500">ICD-10:</span> <span className="font-mono">{claim.icd_code || '—'}</span></div>
              <div><span className="text-gray-500">Procedure:</span> <span className="font-medium">{claim.procedure_name || '—'}</span></div>
              <div><span className="text-gray-500">Department:</span> <span>{claim.department_name || '—'}</span></div>
              <div><span className="text-gray-500">Doctor:</span> <span>{claim.treating_doctor_name || '—'}</span></div>
              <div><span className="text-gray-500">Package:</span> <span>{claim.package_name || '—'}</span></div>
            </div>
          </div>

          {/* Patient & Policy */}
          <div className="bg-white rounded-xl border p-5">
            <h3 className="text-sm font-semibold text-gray-900 mb-3 flex items-center gap-2">
              <User className="w-4 h-4" /> Patient & Policy
            </h3>
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div><span className="text-gray-500">Patient:</span> <span className="font-medium">{claim.patient_name}</span></div>
              <div><span className="text-gray-500">UHID:</span> <span className="font-mono">{claim.patient_uhid || '—'}</span></div>
              <div><span className="text-gray-500">Phone:</span> <span>{claim.patient_phone || '—'}</span></div>
              <div><span className="text-gray-500">ABHA:</span> <span>{claim.abha_id || '—'}</span></div>
              <div><span className="text-gray-500">Policy #:</span> <span className="font-mono">{claim.policy_number || '—'}</span></div>
              <div><span className="text-gray-500">Policyholder:</span> <span>{claim.policy_holder_name || '—'}</span></div>
              <div><span className="text-gray-500">Admission:</span> <span>{claim.admission_date ? new Date(claim.admission_date).toLocaleDateString('en-IN') : '—'}</span></div>
              <div><span className="text-gray-500">Discharge:</span> <span>{claim.discharge_date ? new Date(claim.discharge_date).toLocaleDateString('en-IN') : '—'}</span></div>
            </div>
          </div>
        </div>

        {/* Right: Timeline */}
        <div className="space-y-4">
          <div className="bg-white rounded-xl border p-5">
            <h3 className="text-sm font-semibold text-gray-900 mb-3 flex items-center gap-2">
              <Clock className="w-4 h-4" /> Claim Timeline
            </h3>
            {timeline.length === 0 ? (
              <p className="text-xs text-gray-400 text-center py-4">No events yet</p>
            ) : (
              <div className="space-y-3">
                {timeline.map((evt, i) => (
                  <div key={i} className="flex gap-3">
                    <div className="flex flex-col items-center">
                      <div className={`w-2 h-2 rounded-full mt-1.5 ${
                        evt.event_type === 'status_change' ? 'bg-blue-500' :
                        evt.event_type === 'query' ? 'bg-orange-500' :
                        evt.event_type === 'settlement' ? 'bg-emerald-500' :
                        'bg-gray-400'
                      }`} />
                      {i < timeline.length - 1 && <div className="w-px flex-1 bg-gray-200 mt-1" />}
                    </div>
                    <div className="pb-3">
                      <p className="text-xs font-medium text-gray-700">{evt.event_text}</p>
                      <p className="text-xs text-gray-400 mt-0.5">
                        {new Date(evt.created_at).toLocaleString('en-IN', {
                          day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit'
                        })}
                        {evt.source !== 'manual' && ` • ${evt.source}`}
                      </p>
                      {evt.notes && <p className="text-xs text-gray-500 mt-0.5 italic">{evt.notes}</p>}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Payer Info */}
          <div className="bg-white rounded-xl border p-5">
            <h3 className="text-sm font-semibold text-gray-900 mb-3 flex items-center gap-2">
              <Building2 className="w-4 h-4" /> Payer
            </h3>
            <p className="font-medium text-sm">{claim.clm_payers?.name}</p>
            <p className="text-xs text-gray-500 mt-1">Type: {claim.clm_payers?.type}</p>
            {claim.tpa_claim_number && <p className="text-xs text-gray-500 mt-1">TPA Ref: <span className="font-mono">{claim.tpa_claim_number}</span></p>}
            {claim.tpa_preauth_number && <p className="text-xs text-gray-500">Pre-Auth Ref: <span className="font-mono">{claim.tpa_preauth_number}</span></p>}
            {claim.settlement_utr && <p className="text-xs text-emerald-600 mt-1">UTR: <span className="font-mono">{claim.settlement_utr}</span></p>}
          </div>

          {/* Query Alert */}
          {claim.is_query_pending && (
            <div className="bg-orange-50 border border-orange-200 rounded-xl p-4">
              <div className="flex items-center gap-2 mb-1">
                <AlertTriangle className="w-4 h-4 text-orange-600" />
                <span className="text-sm font-semibold text-orange-800">{claim.query_count} Open Query</span>
              </div>
              <p className="text-xs text-orange-700">
                {claim.is_sla_breached ? '⚠️ SLA breached — escalate immediately' : 'Response pending from clinical/billing team'}
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Amount Modal */}
      {showAmountModal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl p-6 w-full max-w-sm shadow-xl">
            <h3 className="font-semibold text-gray-900 mb-3">
              {showAmountModal === 'settled' ? 'Enter Settlement Amount' : 'Enter Approved Amount'}
            </h3>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">₹</span>
              <input type="number" value={amountInput} onChange={e => setAmountInput(e.target.value)}
                placeholder="Amount" autoFocus
                className="w-full pl-8 pr-3 py-2.5 text-lg border rounded-lg focus:ring-2 focus:ring-blue-500" />
            </div>
            <div className="flex gap-2 mt-4">
              <button onClick={() => { setShowAmountModal(null); setAmountInput(''); }}
                className="flex-1 py-2 text-sm border rounded-lg hover:bg-gray-50">Cancel</button>
              <button onClick={handleAmountSubmit} disabled={!amountInput || transitioning}
                className="flex-1 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50">
                {transitioning ? 'Saving...' : 'Confirm'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
